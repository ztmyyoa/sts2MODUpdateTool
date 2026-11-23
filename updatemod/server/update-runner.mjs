/**
 * 更新执行引擎
 * ------------------------------------------------------------------
 * 对外只暴露一个异步生成器 runUpdate()，前端通过 SSE 实时收到每条日志。
 *
 * 单个 MOD 的流程：
 *   1. 解析源 DLL 路径（源目录 + 相对子目录 + DLL 文件名，缺文件名时自动探测）
 *   2. 对每个启用的“目标”：复制 DLL / PCK / JSON 到目标目录
 *   3. 该目标若配置了脚本（.bat），复制完成后依次执行并实时回传输出
 *   4. 输出汇总
 *
 * 试运行（dryRun）只打印将要做什么，不动任何文件、不执行脚本。
 */
import { copyFile, mkdir, readFile, readdir, stat } from 'node:fs/promises'
import path from 'node:path'
import { spawn } from 'node:child_process'

/** 生成一条日志事件 */
function ev(level, scope, text) {
  return { ts: Date.now(), level, scope, text }
}

const samePath = (a, b) => {
  if (!a || !b) return false
  return path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase()
}

async function exists(p) {
  try {
    await stat(p)
    return true
  } catch {
    return false
  }
}

async function sizeOf(p) {
  try {
    const s = await stat(p)
    return s.size
  } catch {
    return -1
  }
}

function humanSize(bytes) {
  if (bytes < 0) return '未知大小'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

/** 源目录里没写 DLL 文件名时，去 DLL 所在目录里找一个 .dll */
async function detectDllName(mod) {
  if (mod.dllName) return mod.dllName
  const dir = path.join(mod.sourceDir, mod.dllSubPath || '.godot\\mono\\temp\\bin\\Debug')
  try {
    const entries = await readdir(dir)
    const dlls = entries.filter((n) => n.toLowerCase().endsWith('.dll'))
    if (dlls.length === 1) return dlls[0]
    if (dlls.length > 1) {
      // 优先挑和 MOD 名相似的
      const guess = dlls.find((n) => n.toLowerCase().includes(mod.name.toLowerCase()))
      return guess || dlls[0]
    }
  } catch {
    /* 目录不存在时交给上层报错 */
  }
  return ''
}

/**
 * 解码一行子进程输出。
 * 同一份日志里可能混着两种编码：cmd 回显中文是 GBK，steamcmd 自己是 UTF-8，
 * 所以按“先试 UTF-8，不合法再用 GB18030”的顺序逐行判断，避免中文变成乱码。
 */
const utf8Strict = new TextDecoder('utf-8', { fatal: true })
let gbkDecoder
function decodeLine(buf) {
  if (!buf || !buf.length) return ''
  try {
    return utf8Strict.decode(buf)
  } catch {
    try {
      if (!gbkDecoder) gbkDecoder = new TextDecoder('gb18030')
      return gbkDecoder.decode(buf)
    } catch {
      return buf.toString('utf8')
    }
  }
}

/**
 * 从 .bat 里抠出 steamcmd 的账号密码，用于日志打码。
 * 形如：steamcmd.exe +login <用户名> <密码> +workshop_build_item ...
 */
function extractSecrets(content, out) {
  const re = /\+login\s+(?:"([^"]+)"|(\S+))(?:\s+(?:"([^"]+)"|(\S+)))?/gi
  let match
  while ((match = re.exec(content))) {
    const user = match[1] || match[2] || ''
    const pass = match[3] || match[4] || ''
    if (user && !user.startsWith('+')) out.add(user)
    if (pass && !pass.startsWith('+')) out.add(pass)
  }
}

/**
 * 扫描所有目标脚本：
 * - 收集里面出现的账号密码，返回把日志里敏感字符串替换成 *** 的函数；
 * - 顺便挑出「登录过 steamcmd」的脚本——这类脚本一定会触发手机确认，
 *   要在跑之前就提醒用户，因为 steamcmd 的输出是块缓冲的，等它自己打印
 *   “Please confirm the login...” 时，用户往往已经在手机上点完了。
 */
async function analyzeScripts(config) {
  const secrets = new Set()
  const phoneScripts = new Set()
  for (const mod of config?.mods || []) {
    for (const target of mod.targets || []) {
      if (!target.script) continue
      let content
      try {
        content = decodeLine(await readFile(target.script))
      } catch {
        /* 脚本读不到就跳过，不影响更新 */
        continue
      }
      extractSecrets(content, secrets)
      if (/steamcmd/i.test(content) && /\+login/i.test(content)) {
        phoneScripts.add(path.resolve(target.script).toLowerCase())
      }
    }
  }
  // 长的先替换，避免短串是长串子串时替换不干净
  const list = [...secrets].filter((s) => s.length >= 3).sort((a, b) => b.length - a.length)
  const redact = (text) => {
    if (!text) return text
    let out = text
    for (const secret of list) out = out.split(secret).join('***')
    // 兜底：万一没从脚本里解析出账号密码，也把命令和用户名打掉
    out = out.replace(/(\+login\s+)(\S+)(\s+)(\S+)/gi, '$1***$3***')
    out = out.replace(/(Logging in user\s+')([^']+)(')/gi, '$1***$3')
    return out
  }
  return { redact, phoneScripts }
}

/**
 * 执行一个脚本，并把输出逐行 yield 出来。
 * 返回 { code } 通过最后一个 summary 事件带回不方便，所以用返回值 + 生成器的方式：
 * 这里用 async generator，调用方 for await 拿行，结束后读 child 的退出码存在 runner 对象上。
 */
async function* runScript({ script, cwd, timeoutMs, scope, preAnnounced = false }) {
  const comspec = process.env.ComSpec || 'cmd.exe'
  const queue = []
  const waiters = []
  let finished = false
  let exitCode = null

  const wake = () => {
    while (waiters.length) waiters.shift()()
  }
  const push = (event) => {
    queue.push(event)
    wake()
  }

  let child
  try {
    // 直接用 cmd 跑脚本。注意：脚本里若用 echo 输出中文，本机系统区域设置是 UTF-8(65001)，
    // cmd 会把 GBK 存盘的 bat 读坏（变成方框），这是 cmd 自身行为，改 chcp 也救不回来；
    // steamcmd 自己输出的中文是 UTF-8，不受影响，由下面的 decodeLine 正确处理。
    child = spawn(comspec, ['/d', '/s', '/c', `"${script}"`], {
      cwd: cwd || path.dirname(script),
      windowsHide: true,
      windowsVerbatimArguments: true,
      // stdin 接 NUL：脚本里的 pause 会立刻返回，不会把更新流程挂住
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  } catch (err) {
    yield ev('error', scope, `脚本启动失败：${err.message}`)
    return { code: -1 }
  }

  // ---- 逐行解析脚本输出，顺便把 Steam 手机确认这类“要人操作”的提示挑出来 ----
  let pending = Buffer.alloc(0)
  const guard = { announced: preAnnounced, waiting: 0 }

  /** 把一行输出翻译成一串事件 */
  const classify = (line) => {
    if (/Please confirm the login in the Steam Mobile app/i.test(line)) {
      if (guard.announced) return []
      guard.announced = true
      return [
        ev(
          'action',
          scope,
          'Steam 正在等待手机确认登录。请立刻打开手机上的 Steam App → 点“确认登录”；steamcmd 只会等 60 秒左右，超时这次上传就会失败。',
        ),
      ]
    }
    // 超时那行里也含 "waiting for confirmation"，必须先判断
    if (/Wait for confirmation timed out|Timed out waiting for confirmation/i.test(line)) {
      return [
        ev(
          'error',
          scope,
          '手机确认超时，steamcmd 已经放弃这次登录。重新执行更新时，看到提示后请立刻在手机上确认（只有 60 秒左右）。',
        ),
      ]
    }
    if (/Waiting for confirmation/i.test(line)) {
      // steamcmd 每 2 秒打一行，全转过去会把日志刷爆，只在第一次提示，之后只计数
      guard.waiting++
      return []
    }
    if (/This account is protected by a Steam Guard/i.test(line)) {
      return [ev('info', scope, '这个账号开了 Steam 手机令牌，登录需要手机确认，属正常现象。')]
    }
    if (/There was an error communicating with Steam|ERROR \(Timeout\)|Failed to login|Invalid Password/i.test(line)) {
      return [ev('warn', scope, line)]
    }
    return [ev('script', scope, line)]
  }

  /** 按 \n 切行（自己缓冲，避免多字节字符被 chunk 边界截断） */
  const emitLines = (chunk, flush = false) => {
    pending = pending.length ? Buffer.concat([pending, chunk]) : chunk
    const parts = []
    let start = 0
    for (let i = 0; i < pending.length; i++) {
      if (pending[i] === 0x0a) {
        parts.push(pending.subarray(start, i))
        start = i + 1
      }
    }
    pending = pending.subarray(start)
    if (flush && pending.length) {
      parts.push(pending)
      pending = Buffer.alloc(0)
    }
    for (const raw of parts) {
      const line = decodeLine(raw).replace(/\r$/, '').trimEnd()
      if (!line) continue
      for (const event of classify(line)) push(event)
    }
  }

  child.stdout?.on('data', (buf) => emitLines(buf))
  child.stderr?.on('data', (buf) => emitLines(buf))

  const timer = setTimeout(() => {
    push(ev('warn', scope, `脚本执行超过 ${Math.round(timeoutMs / 1000)} 秒，已强制结束。`))
    try {
      spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true })
    } catch {
      child.kill()
    }
  }, timeoutMs)

  child.on('error', (err) => {
    push(ev('error', scope, `脚本执行出错：${err.message}`))
    finished = true
    wake()
  })
  child.on('close', (code) => {
    emitLines(Buffer.alloc(0), true)
    clearTimeout(timer)
    exitCode = code
    finished = true
    wake()
  })

  for (;;) {
    if (queue.length) {
      yield queue.shift()
      continue
    }
    if (finished) break
    await new Promise((resolve) => waiters.push(resolve))
  }
  // 收尾：把解码器里残留的字符也吐出来（多字节被截断时）
  return { code: exitCode }
}

/** 主流程：执行一次更新，逐条 yield 日志（内部实现，对外由 runUpdate 包一层打码） */
async function* runUpdateInner({ config, modIds, dryRun = false, phoneScripts }) {
  const timeoutMs = Number(config?.global?.scriptTimeoutMs) || 600000
  const picked = Array.isArray(modIds) && modIds.length
    ? config.mods.filter((m) => modIds.includes(m.id))
    : config.mods.filter((m) => m.enabled !== false)

  const totals = { copied: 0, skipped: 0, failed: 0, scripts: 0, scriptFailed: 0 }

  if (!picked.length) {
    yield ev('warn', '总览', '没有需要更新的 MOD（未勾选任何启用项）。')
    yield ev('done', '总览', JSON.stringify(totals))
    return totals
  }

  yield ev('step', '总览', `${dryRun ? '【试运行】' : ''}开始更新 ${picked.length} 个 MOD：${picked.map((m) => m.name).join('、')}`)

  for (const mod of picked) {
    const mScope = mod.name
    yield ev('step', mScope, `—— ${mod.name} ——`)

    if (!mod.sourceDir) {
      yield ev('error', mScope, '未配置“源 MOD 目录”，跳过。')
      totals.failed++
      continue
    }

    // ---- 1. 解析 DLL ----
    const dllName = await detectDllName(mod)
    let dllFrom = ''
    if (!dllName) {
      yield ev('error', mScope, `在 ${path.join(mod.sourceDir, mod.dllSubPath)} 里找不到 DLL，跳过 DLL 复制。`)
      totals.failed++
    } else {
      dllFrom = path.join(mod.sourceDir, mod.dllSubPath || '.godot\\mono\\temp\\bin\\Debug', dllName)
      if (!(await exists(dllFrom))) {
        yield ev('error', mScope, `DLL 不存在：${dllFrom}`)
        totals.failed++
        dllFrom = ''
      } else {
        yield ev('info', mScope, `DLL：${dllFrom}（${humanSize(await sizeOf(dllFrom))}）`)
      }
    }

    // ---- 2. 解析 PCK ----
    const pckDir = mod.pckSourceDir || config?.global?.workshopDir || ''
    const pckList = []
    if (!mod.pckFiles || !mod.pckFiles.length) {
      yield ev('warn', mScope, '未配置 PCK 文件，本次不复制 PCK。可在右侧“PCK”里点“扫描”添加。')
    } else if (!pckDir) {
      yield ev('warn', mScope, '未配置 PCK 来源目录（全局 Workshop 目录或本 MOD 的 PCK 来源目录），跳过 PCK。')
    } else {
      for (const item of mod.pckFiles) {
        const from = path.isAbsolute(item) ? item : path.join(pckDir, item)
        if (!(await exists(from))) {
          yield ev('error', mScope, `PCK 不存在：${from}`)
          totals.failed++
          continue
        }
        pckList.push(from)
      }
    }

    // ---- 3. JSON ----
    let jsonFrom = ''
    if (mod.jsonPath) {
      if (await exists(mod.jsonPath)) {
        jsonFrom = mod.jsonPath
      } else {
        yield ev('warn', mScope, `JSON 模板不存在：${mod.jsonPath}（如果目标目录已有旧 JSON 可忽略）`)
      }
    }

    // ---- 4. 逐目标复制 + 执行脚本 ----
    const targets = (mod.targets || []).filter((t) => t.enabled !== false)
    if (!targets.length) {
      yield ev('warn', mScope, '没有启用的目标目录。')
      continue
    }

    for (const target of targets) {
      const tScope = `${mod.name} / ${target.label}`
      if (!target.dir) {
        yield ev('error', tScope, '目标目录为空，跳过该目标。')
        totals.failed++
        continue
      }

      const jobs = []
      if (target.copyDll !== false && dllFrom) {
        jobs.push({ kind: 'DLL', from: dllFrom, to: path.join(target.dir, path.basename(dllFrom)) })
      }
      if (target.copyPck !== false) {
        for (const from of pckList) {
          jobs.push({ kind: 'PCK', from, to: path.join(target.dir, path.basename(from)) })
        }
      }
      if (target.copyJson === true && jsonFrom) {
        const name = mod.jsonName || path.basename(jsonFrom)
        jobs.push({ kind: 'JSON', from: jsonFrom, to: path.join(target.dir, name) })
      }

      if (!jobs.length) {
        yield ev('info', tScope, '本目标没有需要复制的文件。')
      }

      for (const job of jobs) {
        if (samePath(job.from, job.to)) {
          yield ev('info', tScope, `${job.kind} 源与目标相同，跳过：${job.to}`)
          totals.skipped++
          continue
        }
        if (dryRun) {
          yield ev('plan', tScope, `将复制 ${job.kind}：${job.from} → ${job.to}`)
          totals.copied++
          continue
        }
        try {
          await mkdir(path.dirname(job.to), { recursive: true })
          await copyFile(job.from, job.to)
          yield ev('ok', tScope, `${job.kind} 已复制：${path.basename(job.to)}（${humanSize(await sizeOf(job.to))}）`)
          totals.copied++
        } catch (err) {
          yield ev('error', tScope, `${job.kind} 复制失败：${job.from} → ${job.to}\n${err.message}`)
          totals.failed++
        }
      }

      // ---- 执行该目标的脚本 ----
      if (target.script) {
        if (!(await exists(target.script))) {
          yield ev('error', tScope, `脚本不存在：${target.script}`)
          totals.scriptFailed++
          continue
        }
        if (dryRun) {
          yield ev('plan', tScope, `将执行脚本：${target.script}`)
          totals.scripts++
          continue
        }
        yield ev('step', tScope, `执行脚本：${target.script}`)
        // steamcmd 的输出是块缓冲的，等它自己喊“请确认登录”时往往已经晚了；
        // 所以只要是带 +login 的 steamcmd 脚本，开跑前就先提醒一次。
        if (phoneScripts?.has(path.resolve(target.script).toLowerCase())) {
          yield ev(
            'action',
            tScope,
            '马上要登录 Steam 上传了。请现在把手机拿在手上：稍后手机上会弹出登录确认，点「确认」即可；steamcmd 只等 60 秒左右。',
          )
        }
        const runner = runScript({
          script: target.script,
          cwd: path.dirname(target.script),
          timeoutMs,
          scope: tScope,
          preAnnounced: phoneScripts?.has(path.resolve(target.script).toLowerCase()) === true,
        })
        // 把脚本输出的每一行转发给前端，最后拿到退出码
        let result
        for (;;) {
          const { value, done } = await runner.next()
          if (done) {
            result = value
            break
          }
          yield value
        }
        if (result && result.code === 0) {
          yield ev('ok', tScope, '脚本执行成功（退出码 0）。')
          totals.scripts++
        } else {
          yield ev('error', tScope, `脚本执行失败，退出码 ${result?.code ?? '未知'}。`)
          totals.scriptFailed++
        }
      }
    }
  }

  const summary = `完成：复制 ${totals.copied} 个文件，跳过 ${totals.skipped} 个，失败 ${totals.failed} 个；脚本成功 ${totals.scripts} 个，失败 ${totals.scriptFailed} 个。`
  yield ev(totals.failed || totals.scriptFailed ? 'warn' : 'ok', '总览', summary)
  yield ev('done', '总览', JSON.stringify(totals))
  return totals
}

/**
 * 对外入口。
 * 在流程外面套一层“日志打码”：脚本回显的命令行里带着 steamcmd 的账号密码，
 * 这里是唯一出口，统一把敏感串替换成 ***，保证日志里不会泄露。
 */
export async function* runUpdate(options) {
  const { redact, phoneScripts } = await analyzeScripts(options?.config)
  let totals = null
  for await (const event of runUpdateInner({ ...options, phoneScripts })) {
    if (event.level === 'done') {
      try {
        totals = JSON.parse(event.text)
      } catch {
        /* 汇总解析失败不影响日志 */
      }
    }
    yield { ...event, text: redact(event.text) }
  }
  return totals
}
