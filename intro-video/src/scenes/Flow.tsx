import React from 'react'
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'
import { Backdrop, Card, Reveal, SceneHeading, Stage } from '../components/ui'
import { C, FONT, MONO, alpha } from '../theme'

const NODES = [
  { icon: '⚙', title: 'Godot 构建', sub: 'DLL / PCK 更新', tone: C.dim },
  { icon: '◈', title: '一键更新', sub: '工具本体', tone: C.accent },
  { icon: '⤴', title: 'GitHub 目录', sub: '复制 DLL / JSON', tone: C.ok },
  { icon: '☁', title: 'Steam 目录', sub: '复制 DLL / PCK', tone: C.warn },
  { icon: '✓', title: '上传完成', sub: 'git push + 创意工坊', tone: C.accentSoft },
]

const Arrow: React.FC<{ delay: number }> = ({ delay }) => {
  const frame = useCurrentFrame()
  const grow = interpolate(frame, [delay, delay + 12], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const t = ((frame - delay) / 26) % 1
  return (
    <div style={{ width: 92, height: 24, position: 'relative', flex: 'none' }}>
      <div
        style={{
          position: 'absolute',
          top: 11,
          left: 0,
          height: 2,
          width: `${grow * 100}%`,
          background: `linear-gradient(90deg, ${alpha(C.accent, 0.1)}, ${alpha(C.accent, 0.9)})`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: 4,
          left: `${Math.max(0, Math.min(1, grow)) * 100 - 8}%`,
          width: 16,
          height: 16,
          borderRadius: 8,
          background: C.accent,
          opacity: grow > 0.98 ? 0 : 1,
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: 4,
          left: `calc(${Math.min(1, Math.max(0, t)) * 100}% - 6px)`,
          width: 12,
          height: 12,
          borderRadius: 6,
          background: C.accentSoft,
          boxShadow: `0 0 14px ${alpha(C.accent, 0.8)}`,
          opacity: grow > 0.98 ? 1 : 0,
        }}
      />
      <div
        style={{
          position: 'absolute',
          right: 0,
          top: 5,
          width: 0,
          height: 0,
          borderTop: '7px solid transparent',
          borderBottom: '7px solid transparent',
          borderLeft: `10px solid ${alpha(C.accent, 0.9)}`,
          opacity: grow,
        }}
      />
    </div>
  )
}

/** 解决方案：一条流水线，六步变一步 */
export const Flow: React.FC = () => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const pulse = spring({ frame: frame - 128, fps, config: { damping: 200 } })
  const glow = 0.35 + Math.sin(frame / 16) * 0.18

  return (
    <Stage>
      <Backdrop />

      <SceneHeading
        kicker="工具做的事"
        title="把六步压成一步"
        sub="路径配置一次，之后每次构建完，点一下「一键更新」：该复制的复制，该跑的脚本按顺序跑，日志实时给你看。"
      />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: 92 }}>
        {NODES.map((node, index) => (
          <React.Fragment key={node.title}>
            {index > 0 ? <Arrow delay={22 + (index - 1) * 12} /> : null}
            <Reveal delay={14 + index * 12} y={28}>
              <Card
                pad={20}
                glow={node.tone}
                style={{ width: 236, height: 168, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
              >
                <div
                  style={{
                    fontFamily: FONT,
                    fontSize: 30,
                    color: node.tone,
                    width: 48,
                    height: 48,
                    borderRadius: 12,
                    background: alpha(node.tone, 0.12),
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {node.icon}
                </div>
                <div>
                  <div style={{ fontFamily: FONT, fontSize: 24, fontWeight: 700, color: C.text }}>{node.title}</div>
                  <div style={{ fontFamily: FONT, fontSize: 17, color: C.muted, marginTop: 4 }}>{node.sub}</div>
                </div>
              </Card>
            </Reveal>
          </React.Fragment>
        ))}
      </div>

      <Reveal delay={108} y={20} style={{ marginTop: 74, display: 'flex', justifyContent: 'center' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            padding: '18px 30px',
            borderRadius: 16,
            border: `1px solid ${alpha(C.accent, 0.5)}`,
            background: alpha(C.accent, 0.08),
            boxShadow: `0 0 ${40 * glow}px ${alpha(C.accent, 0.35)}`,
            opacity: pulse,
          }}
        >
          <span style={{ fontFamily: MONO, fontSize: 20, color: C.muted }}>目标</span>
          <span style={{ fontFamily: FONT, fontSize: 26, color: C.text, fontWeight: 600 }}>
            同一次更新，GitHub 和 Steam 一起发
          </span>
        </div>
      </Reveal>
    </Stage>
  )
}
