# STS2 MOD 更新工具 · 介绍视频

用 [Remotion](https://www.remotion.dev/) 把代码渲染成视频：一个 75 秒、1920×1080、30fps 的横版介绍片，
内容是「这工具解决什么麻烦 → 它做了什么 → 有哪些功能 → 怎么用 → 后面还想加什么」。

成片：`out/final/stsmod-intro.mp4`（H.264 + AAC，约 20 MB，75 秒）。

背景音乐放在 `public/bgm.mp3`，由 `src/Video.tsx` 里的 `<Audio>` 引用：整体音量 0.42，开头 1.5 秒淡入、结尾 2.6 秒淡出（`BGM_VOLUME` / `FADE_IN` / `FADE_OUT` 三个常量可调）。想换曲子直接覆盖 `public/bgm.mp3` 即可，代码不用动。

## 命令

```bash
npm install          # 第一次
npm run studio       # 打开 Remotion Studio，可拖时间轴实时预览
npm run render       # 渲染成片到 out/stsmod-intro.mp4
npm run still        # 导出一张静帧海报 out/poster.png
```

渲染第一次会自动下载 Chrome Headless Shell（约 131 MB），之后就快了。
这台机器上渲染整片大约几分钟（`--concurrency=4`）。

## 片子结构

| 时间 | 帧区间 | 场景 | 内容 |
| --- | --- | --- | --- |
| 0:00–0:05 | 0–150 | `Intro` | 名字、一句话定位、四个标签 |
| 0:05–0:14 | 150–420 | `Pain` | 改一个 DLL 要手动走六步，六处地方跟着动 |
| 0:14–0:25 | 420–750 | `Flow` | 六步压成一步：一条流水线图 |
| 0:25–0:42 | 750–1260 | `Features` | 六张功能卡：路径靠选、试运行、实时日志、打码、手机确认提醒、布局可拉 |
| 0:42–0:55 | 1260–1650 | `Usage` | 三步开始 + 右侧日志逐行滚出 |
| 0:55–1:07 | 1650–2010 | `Future` | 六条「计划中」，明确标注还没实现 |
| 1:07–1:15 | 2010–2250 | `Outro` | 现在去更新第一个 MOD |

## 文件

```
src/
  index.ts            入口，registerRoot
  Root.tsx            Composition（尺寸、帧率、总帧数都在这里）
  Video.tsx           用 <Series> 串起 7 个场景，导出 SCENES / TOTAL_FRAMES
  theme.ts            配色、字体、alpha() 工具
  components/ui.tsx   Backdrop / Reveal / SceneHeading / Card / Stage / FadeOut
  scenes/*.tsx        七个场景，各自管自己的动画
```

## 改的时候注意

- 时长改在 `src/scenes/<场景>.tsx` 里的 `Series.Sequence durationInFrames` 和 `src/Video.tsx` 的 `SCENES`，两处要一起改，`TOTAL_FRAMES` 会自动跟着算。
- 所有动画都靠 `useCurrentFrame()` 推，不用 CSS transition、不用 `setTimeout`——这样任意一帧都能单独渲染，也能并行渲染。
- 层级坑：`Backdrop` 是 `position: absolute`，会盖住**没有 transform / 没有定位**的静态元素。给这类元素加 `position: relative` 或 `zIndex` 才看得见（开场那条渐变分界线就是这么修的）。
- 字体只用了系统字体（Segoe UI / Microsoft YaHei / Cascadia Code），换机器渲染不会缺字，但字形会略有差别。
- 目前没有解说音轨，只有一段背景音乐；仓库里放的是 `public/bgm.mp3`，用之前请自行确认这首曲子的授权范围。
