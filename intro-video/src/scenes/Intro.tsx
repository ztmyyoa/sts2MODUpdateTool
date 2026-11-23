import React from 'react'
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'
import { Backdrop, Reveal, Stage } from '../components/ui'
import { C, FONT, MONO, alpha } from '../theme'

/** 开场：名字直接砸出来，副标题说明它解决什么 */
export const Intro: React.FC = () => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const logoIn = spring({ frame, fps, config: { damping: 14, mass: 0.8, stiffness: 120 } })
  const ring = (frame % 90) / 90
  const lineWidth = interpolate(frame, [18, 48], [0, 620], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })

  return (
    <Stage style={{ alignItems: 'center', justifyContent: 'center' }}>
      <Backdrop />

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 30 }}>
        {/* 图标：一个方块 + 呼吸的光环 */}
        <div style={{ position: 'relative', width: 132, height: 132 }}>
          <div
            style={{
              position: 'absolute',
              inset: -18 * ring,
              borderRadius: 40,
              border: `2px solid ${alpha(C.accent, 0.5 * (1 - ring))}`,
            }}
          />
          <div
            style={{
              width: 132,
              height: 132,
              borderRadius: 32,
              background: `linear-gradient(150deg, ${alpha(C.accent, 0.95)}, ${alpha('#2b5fd9', 0.95)})`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: `0 20px 60px ${alpha(C.accent, 0.45)}`,
              transform: `scale(${logoIn}) rotate(${(1 - logoIn) * -12}deg)`,
            }}
          >
            <span style={{ fontFamily: FONT, fontSize: 66, color: '#ffffff', lineHeight: 1 }}>◈</span>
          </div>
        </div>

        <Reveal delay={10} y={34}>
          <div
            style={{
              fontFamily: FONT,
              fontSize: 92,
              fontWeight: 800,
              letterSpacing: -1.5,
              color: C.text,
              textAlign: 'center',
            }}
          >
            STS2 MOD 更新工具
          </div>
        </Reveal>

        <div
          style={{
            height: 4,
            width: Math.max(lineWidth, 1),
            position: 'relative',
            zIndex: 2,
            background: `linear-gradient(90deg, ${C.accent}, ${C.ok})`,
            borderRadius: 2,
            boxShadow: `0 0 18px ${alpha(C.accent, 0.55)}`,
          }}
        />

        <Reveal delay={24} y={20}>
          <div style={{ fontFamily: FONT, fontSize: 32, color: C.dim, textAlign: 'center', lineHeight: 1.6 }}>
            一次点击，把 MOD 同时发到 Steam 创意工坊和 GitHub
          </div>
        </Reveal>

        <Reveal delay={36} y={16}>
          <div style={{ display: 'flex', gap: 14, marginTop: 18 }}>
            {['本地运行', '不联网', '配置文件私有', 'Windows'].map((tag) => (
              <div
                key={tag}
                style={{
                  fontFamily: FONT,
                  fontSize: 20,
                  color: C.dim,
                  border: `1px solid ${C.border}`,
                  background: alpha(C.panel, 0.7),
                  padding: '8px 18px',
                  borderRadius: 999,
                }}
              >
                {tag}
              </div>
            ))}
          </div>
        </Reveal>
      </div>

      <Reveal delay={52} y={0} style={{ position: 'absolute', bottom: 66 }}>
        <div style={{ fontFamily: MONO, fontSize: 18, color: C.muted, letterSpacing: 1 }}>
          Slay the Spire 2 · MOD 发布流水线
        </div>
      </Reveal>
    </Stage>
  )
}
