import React from 'react'
import { spring, useCurrentFrame, useVideoConfig } from 'remotion'
import { Backdrop, Card, SceneHeading, Stage } from '../components/ui'
import { C, FONT, alpha } from '../theme'

const FEATURES = [
  {
    icon: '⊞',
    tone: C.accent,
    title: '路径全靠选',
    detail: '源目录、DLL、PCK、JSON、两个输出目录，都用页面内的文件浏览器挑，不用手敲路径。',
  },
  {
    icon: '◎',
    tone: C.accentSoft,
    title: '试运行',
    detail: '只打印“将要复制什么、将执行哪个脚本”，不碰磁盘。第一次配好先跑它。',
  },
  {
    icon: '≡',
    tone: C.ok,
    title: '实时日志',
    detail: '复制结果和脚本输出逐行推送到界面，成功绿色、警告黄色、错误红色，还能只看问题。',
  },
  {
    icon: '✱',
    tone: C.warn,
    title: '账号密码打码',
    detail: '从 .bat 里读出 +login 的账号密码，在日志唯一出口替换成 ***，截图发出去也不慌。',
  },
  {
    icon: '⌚',
    tone: C.error,
    title: '手机确认提醒',
    detail: 'Steam 上传前提前弹框 + 响铃 + 改标签页标题，框里显示已等待秒数，不再错过 60 秒窗口。',
  },
  {
    icon: '⇔',
    tone: C.accent,
    title: '布局随便拉',
    detail: '左侧列表、底部日志都能拖拽改尺寸，双击恢复默认；尺寸记在浏览器里，下次还是老样子。',
  },
]

/** 功能：六张卡片，逐张弹出来 */
export const Features: React.FC = () => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  return (
    <Stage>
      <Backdrop dim />

      <SceneHeading
        kicker="功能"
        title="该有的都有，不该烦的都不烦"
        sub="不装服务、不联外网、不写注册表；一个 Node 进程加一个浏览器页面。"
      />

      <div
        style={{
          marginTop: 56,
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 22,
          flex: 1,
          alignContent: 'start',
        }}
      >
        {FEATURES.map((feature, index) => {
          const delay = 34 + index * 11
          const p = spring({ frame: frame - delay, fps, config: { damping: 200, mass: 0.85 } })
          return (
            <div key={feature.title} style={{ opacity: p, transform: `translateY(${(1 - p) * 34}px)` }}>
              <Card pad={24} glow={feature.tone} style={{ height: '100%', minHeight: 208 }}>
                <div
                  style={{
                    width: 46,
                    height: 46,
                    borderRadius: 12,
                    background: alpha(feature.tone, 0.13),
                    color: feature.tone,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: FONT,
                    fontSize: 26,
                  }}
                >
                  {feature.icon}
                </div>
                <div style={{ fontFamily: FONT, fontSize: 26, fontWeight: 700, color: C.text, marginTop: 16 }}>
                  {feature.title}
                </div>
                <div style={{ fontFamily: FONT, fontSize: 18, color: C.dim, lineHeight: 1.65, marginTop: 10 }}>
                  {feature.detail}
                </div>
              </Card>
            </div>
          )
        })}
      </div>
    </Stage>
  )
}
