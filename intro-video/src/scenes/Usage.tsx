import React from 'react'
import { spring, useCurrentFrame, useVideoConfig } from 'remotion'
import { Backdrop, Card, SceneHeading, Stage } from '../components/ui'
import { C, FONT, MONO, alpha } from '../theme'

const STEPS = [
  {
    n: '1',
    title: '启动',
    detail: '双击 启动.bat（或 npm run app）。浏览器自动打开 127.0.0.1:5178，不用装任何东西。',
  },
  {
    n: '2',
    title: '配置',
    detail: '「＋ 新增」挑源目录、DLL、PCK、JSON 和两个输出目标；保存一次，以后都认得。',
  },
  {
    n: '3',
    title: '发布',
    detail: '先「试运行」核对计划，再点「一键更新」。看到弹框就把手机拿出来确认登录。',
  },
]

const LOGS = [
  { level: 'step', text: '开始更新：MyMod' },
  { level: 'ok', text: 'DLL 已复制：MyMod.dll（324 KB）' },
  { level: 'ok', text: 'PCK 已复制：MyMod.pck（18.4 MB）' },
  { level: 'script', text: 'Logging in user \'***\' to Steam Public...' },
  { level: 'action', text: '马上要登录 Steam 上传了，请把手机拿在手上' },
  { level: 'script', text: 'Uploading content to Steam Workshop...' },
  { level: 'ok', text: '脚本执行成功（退出码 0）' },
  { level: 'ok', text: '完成：复制 4 个文件，脚本成功 2 个' },
]

const levelColor: Record<string, string> = {
  step: C.text,
  ok: C.ok,
  script: '#9aa5b8',
  action: '#ffd479',
  warn: C.warn,
  error: C.error,
}

/** 使用方法：左边三步，右边一条真实感的日志流 */
export const Usage: React.FC = () => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  return (
    <Stage>
      <Backdrop tint={C.ok} dim />

      <SceneHeading kicker="怎么用" title="三步开始" sub="第一次配置花几分钟，之后每次更新就是点一下、等日志。" />

      <div style={{ display: 'flex', gap: 56, marginTop: 52, flex: 1 }}>
        <div style={{ width: 620, flex: 'none', display: 'flex', flexDirection: 'column', gap: 18 }}>
          {STEPS.map((step, index) => {
            const delay = 24 + index * 16
            const p = spring({ frame: frame - delay, fps, config: { damping: 200 } })
            return (
              <div
                key={step.n}
                style={{
                  opacity: p,
                  transform: `translateX(${(1 - p) * -40}px)`,
                  display: 'flex',
                  gap: 20,
                  alignItems: 'flex-start',
                }}
              >
                <div
                  style={{
                    width: 46,
                    height: 46,
                    borderRadius: 23,
                    flex: 'none',
                    background: alpha(C.ok, 0.13),
                    border: `1px solid ${alpha(C.ok, 0.45)}`,
                    color: C.ok,
                    fontFamily: FONT,
                    fontSize: 22,
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {step.n}
                </div>
                <div>
                  <div style={{ fontFamily: FONT, fontSize: 30, fontWeight: 700, color: C.text }}>{step.title}</div>
                  <div style={{ fontFamily: FONT, fontSize: 19, color: C.dim, lineHeight: 1.65, marginTop: 6 }}>
                    {step.detail}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <Card pad={0} style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '14px 18px',
              borderBottom: `1px solid ${C.border}`,
              background: alpha('#000000', 0.25),
            }}
          >
            <span style={{ width: 12, height: 12, borderRadius: 6, background: '#ff5f6d' }} />
            <span style={{ width: 12, height: 12, borderRadius: 6, background: '#f5a524' }} />
            <span style={{ width: 12, height: 12, borderRadius: 6, background: '#3ecf8e' }} />
            <span style={{ fontFamily: MONO, fontSize: 15, color: C.muted, marginLeft: 10 }}>运行日志</span>
          </div>
          <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {LOGS.map((line, index) => {
              const appear = 40 + index * 12
              const p = spring({ frame: frame - appear, fps, config: { damping: 200, mass: 0.6 } })
              return (
                <div
                  key={line.text}
                  style={{
                    display: 'flex',
                    gap: 12,
                    fontFamily: MONO,
                    fontSize: 17,
                    lineHeight: 1.5,
                    opacity: p,
                    transform: `translateY(${(1 - p) * 8}px)`,
                    background: line.level === 'action' ? alpha(C.warn, 0.12) : 'transparent',
                    borderLeft: line.level === 'action' ? `3px solid ${C.warn}` : '3px solid transparent',
                    paddingLeft: 8,
                    borderRadius: 4,
                  }}
                >
                  <span style={{ color: C.muted, flex: 'none' }}>12:0{index}:0{index}</span>
                  <span style={{ color: levelColor[line.level], flex: 1 }}>{line.text}</span>
                </div>
              )
            })}
          </div>
        </Card>
      </div>

      <div style={{ display: 'flex', gap: 16, marginTop: 30 }}>
        {[
          '账号密码不会出现在日志里',
          '失败会指名是哪一步、哪个脚本',
          '改完 DLL 直接再点一次就行',
        ].map((text, index) => {
          const p = spring({ frame: frame - (120 + index * 10), fps, config: { damping: 200 } })
          return (
            <div
              key={text}
              style={{
                opacity: p,
                transform: `translateY(${(1 - p) * 12}px)`,
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 18px',
                borderRadius: 999,
                border: `1px solid ${alpha(C.ok, 0.3)}`,
                background: alpha(C.ok, 0.07),
                fontFamily: FONT,
                fontSize: 18,
                color: C.dim,
              }}
            >
              <span style={{ color: C.ok, fontSize: 16 }}>✓</span>
              {text}
            </div>
          )
        })}
      </div>
    </Stage>
  )
}
