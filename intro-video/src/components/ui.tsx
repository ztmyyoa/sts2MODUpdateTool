import React from 'react'
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'
import { C, FONT, alpha } from '../theme'

/* ------------------------------------------------------------------ */
/* 背景：网格 + 两团缓慢移动的光，给画面一点深度，但不抢内容            */
/* ------------------------------------------------------------------ */

export const Backdrop: React.FC<{ tint?: string; dim?: boolean }> = ({ tint = C.accent, dim = false }) => {
  const frame = useCurrentFrame()
  const drift = (frame * 0.25) % 64
  const gx = 22 + Math.sin(frame / 110) * 6
  const gy = 16 + Math.cos(frame / 130) * 5

  return (
    <AbsoluteFill style={{ backgroundColor: C.bg, overflow: 'hidden' }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(1100px 720px at ${gx}% ${gy}%, ${alpha(tint, dim ? 0.1 : 0.17)}, transparent 62%)`,
        }}
      />
      <AbsoluteFill
        style={{
          background: `radial-gradient(900px 620px at ${100 - gx}% ${100 - gy}%, ${alpha(C.ok, dim ? 0.05 : 0.09)}, transparent 60%)`,
        }}
      />
      <AbsoluteFill
        style={{
          backgroundImage: `linear-gradient(${alpha(
            '#ffffff',
            0.05,
          )} 1px, transparent 1px), linear-gradient(90deg, ${alpha('#ffffff', 0.05)} 1px, transparent 1px)`,
          backgroundSize: '64px 64px',
          backgroundPosition: `0px ${drift}px, ${drift}px 0px`,
          maskImage: 'radial-gradient(circle at 50% 46%, black 30%, transparent 76%)',
          WebkitMaskImage: 'radial-gradient(circle at 50% 46%, black 30%, transparent 76%)',
        }}
      />
      {/* 上下压暗，避免内容贴边 */}
      <AbsoluteFill
        style={{
          background: `linear-gradient(180deg, ${alpha('#000000', 0.35)} 0%, transparent 22%, transparent 78%, ${alpha(
            '#000000',
            0.5,
          )} 100%)`,
        }}
      />
    </AbsoluteFill>
  )
}

/* ------------------------------------------------------------------ */
/* 通用入场动画：弹簧位移 + 淡入，delay 单位是帧                          */
/* ------------------------------------------------------------------ */

export const Reveal: React.FC<{
  delay?: number
  y?: number
  x?: number
  scale?: number
  children: React.ReactNode
  style?: React.CSSProperties
}> = ({ delay = 0, y = 26, x = 0, scale = 1, children, style }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const p = spring({ frame: frame - delay, fps, config: { damping: 200, mass: 0.7, stiffness: 90 } })
  const s = interpolate(p, [0, 1], [scale, 1])
  return (
    <div
      style={{
        opacity: p,
        transform: `translate(${(1 - p) * x}px, ${(1 - p) * y}px) scale(${s})`,
        ...style,
      }}
    >
      {children}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* 场景标题：小标签 + 大标题 + 装饰下划线                                */
/* ------------------------------------------------------------------ */

export const SceneHeading: React.FC<{
  kicker: string
  title: string
  sub?: string
  delay?: number
  align?: 'left' | 'center'
}> = ({ kicker, title, sub, delay = 0, align = 'left' }) => {
  const centered = align === 'center'
  return (
    <div style={{ textAlign: centered ? 'center' : 'left', display: 'flex', flexDirection: 'column', alignItems: centered ? 'center' : 'flex-start' }}>
      <Reveal delay={delay} y={14}>
        <div
          style={{
            fontFamily: FONT,
            fontSize: 20,
            letterSpacing: 4,
            color: C.accent,
            textTransform: 'uppercase',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <span style={{ width: 28, height: 2, background: C.accent, display: 'inline-block' }} />
          {kicker}
        </div>
      </Reveal>
      <Reveal delay={delay + 5} y={22}>
        <div
          style={{
            fontFamily: FONT,
            fontSize: 64,
            fontWeight: 800,
            color: C.text,
            letterSpacing: -1,
            marginTop: 18,
            lineHeight: 1.15,
          }}
        >
          {title}
        </div>
      </Reveal>
      {sub ? (
        <Reveal delay={delay + 11} y={18}>
          <div style={{ fontFamily: FONT, fontSize: 26, color: C.dim, marginTop: 16, lineHeight: 1.6, maxWidth: 1100 }}>
            {sub}
          </div>
        </Reveal>
      ) : null}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* 卡片：工具界面里那种面板                                           */
/* ------------------------------------------------------------------ */

export const Card: React.FC<{
  children: React.ReactNode
  style?: React.CSSProperties
  glow?: string
  pad?: number
}> = ({ children, style, glow, pad = 28 }) => (
  <div
    style={{
      background: `linear-gradient(180deg, ${alpha(C.panel2, 0.92)}, ${alpha(C.panel, 0.92)})`,
      border: `1px solid ${glow ? alpha(glow, 0.45) : C.border}`,
      borderRadius: 18,
      padding: pad,
      boxShadow: glow
        ? `0 0 0 1px ${alpha(glow, 0.12)}, 0 24px 60px ${alpha('#000000', 0.45)}`
        : `0 24px 60px ${alpha('#000000', 0.4)}`,
      ...style,
    }}
  >
    {children}
  </div>
)

/* 场景统一的边距容器 */
export const Stage: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
  <AbsoluteFill style={{ padding: '78px 108px', display: 'flex', flexDirection: 'column', ...style }}>{children}</AbsoluteFill>
)

/* 时间轴上的淡出，用在每个场景末尾，避免硬切 */
export const FadeOut: React.FC<{ duration: number; children: React.ReactNode }> = ({ duration, children }) => {
  const frame = useCurrentFrame()
  const opacity = interpolate(frame, [duration - 14, duration - 1], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  return <AbsoluteFill style={{ opacity }}>{children}</AbsoluteFill>
}
