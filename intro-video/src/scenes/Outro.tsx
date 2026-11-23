import React from 'react'
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'
import { Backdrop, Reveal, Stage } from '../components/ui'
import { C, FONT, MONO, alpha } from '../theme'

/** 结尾：把“下一步做什么”直接写清楚，不留悬念 */
export const Outro: React.FC = () => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const mark = spring({ frame, fps, config: { damping: 200 } })
  const fade = interpolate(frame, [170, 214], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })

  return (
    <Stage style={{ alignItems: 'center', justifyContent: 'center' }}>
      <Backdrop dim />

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 26, opacity: fade }}>
        <Reveal delay={4} y={26}>
          <div
            style={{
              fontFamily: FONT,
              fontSize: 74,
              fontWeight: 800,
              color: C.text,
              letterSpacing: -1,
              textAlign: 'center',
            }}
          >
            现在，去更新你的第一个 MOD
          </div>
        </Reveal>

        <Reveal delay={16} y={18}>
          <div style={{ fontFamily: FONT, fontSize: 28, color: C.dim, textAlign: 'center' }}>
            双击 启动.bat，配一次路径，然后等着点按钮就行
          </div>
        </Reveal>

        <Reveal delay={28} y={14} style={{ marginTop: 12 }}>
          <div
            style={{
              fontFamily: MONO,
              fontSize: 22,
              color: C.accentSoft,
              background: alpha(C.accent, 0.1),
              border: `1px solid ${alpha(C.accent, 0.4)}`,
              borderRadius: 12,
              padding: '16px 26px',
            }}
          >
            npm install &amp;&amp; npm run app &nbsp;→&nbsp; 127.0.0.1:5178
          </div>
        </Reveal>

        <Reveal delay={44} y={10}>
          <div style={{ display: 'flex', gap: 26, marginTop: 34, fontFamily: FONT, fontSize: 20, color: C.muted }}>
            <span>开源</span>
            <span style={{ color: C.border }}>·</span>
            <span>本地运行</span>
            <span style={{ color: C.border }}>·</span>
            <span>配置不进仓库</span>
          </div>
        </Reveal>

        <div
          style={{
            marginTop: 54,
            width: 120,
            height: 3,
            borderRadius: 2,
            background: `linear-gradient(90deg, ${C.accent}, ${C.ok})`,
            transform: `scaleX(${mark})`,
          }}
        />
      </div>
    </Stage>
  )
}
