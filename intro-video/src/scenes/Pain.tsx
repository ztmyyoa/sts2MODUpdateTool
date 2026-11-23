import React from 'react'
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'
import { Backdrop, Card, Reveal, SceneHeading, Stage } from '../components/ui'
import { C, FONT, MONO, alpha } from '../theme'

const STEPS = [
  { n: '01', title: 'Godot 构建', detail: '等 Debug 目录里出现新的 DLL' },
  { n: '02', title: '复制 DLL → GitHub 目录', detail: 'MyMod_yys\\ 之类，一个 MOD 一个文件夹' },
  { n: '03', title: '复制 DLL → Steam 目录', detail: '再往 paks\\ 里放一份' },
  { n: '04', title: '去创意工坊找 PCK', detail: '数字 ID 子目录，名字还得对上' },
  { n: '05', title: '改 JSON', detail: '版本号、has_pck、has_dll，漏改就白传' },
  { n: '06', title: '跑两个 .bat', detail: '一个上传 Steam，一个 git push' },
]

/** 痛点：把每次更新要做的事摊开，让人一眼看到重复劳动 */
export const Pain: React.FC = () => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const counter = spring({ frame: frame - 96, fps, config: { damping: 200 } })
  const countValue = Math.round(interpolate(counter, [0, 1], [0, 6]))

  return (
    <Stage>
      <Backdrop tint={C.warn} dim />

      <div style={{ display: 'flex', gap: 70, flex: 1, alignItems: 'center' }}>
        <div style={{ width: 640, flex: 'none' }}>
          <SceneHeading
            kicker="每次发版之前"
            title="六步，全靠手"
            sub="工具本身很轻，麻烦的是每次都要把这些动作原样重来一遍。改一个 DLL，六个地方要跟着动。"
          />

          <Reveal delay={70} y={18} style={{ marginTop: 42 }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16 }}>
              <div style={{ fontFamily: FONT, fontSize: 110, fontWeight: 800, color: C.warn, lineHeight: 1 }}>
                {countValue}
              </div>
              <div style={{ fontFamily: FONT, fontSize: 26, color: C.dim, paddingBottom: 16 }}>步手动操作</div>
            </div>
          </Reveal>

          <Reveal delay={100} y={14}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 18, fontFamily: FONT, fontSize: 22, color: C.muted }}>
              <span style={{ color: C.error }}>✕</span>
              漏一步，这次上传就得重来
            </div>
          </Reveal>
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {STEPS.map((step, index) => {
            const delay = 18 + index * 9
            const p = spring({ frame: frame - delay, fps, config: { damping: 200, mass: 0.8 } })
            return (
              <div
                key={step.n}
                style={{
                  opacity: p,
                  transform: `translateX(${(1 - p) * 60}px)`,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 18,
                  background: alpha(C.panel, 0.86),
                  border: `1px solid ${C.border}`,
                  borderLeft: `3px solid ${alpha(C.warn, 0.75)}`,
                  borderRadius: 12,
                  padding: '14px 20px',
                }}
              >
                <span style={{ fontFamily: MONO, fontSize: 20, color: C.warn, width: 34 }}>{step.n}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: FONT, fontSize: 25, fontWeight: 600, color: C.text }}>{step.title}</div>
                  <div style={{ fontFamily: FONT, fontSize: 18, color: C.muted, marginTop: 2 }}>{step.detail}</div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </Stage>
  )
}
