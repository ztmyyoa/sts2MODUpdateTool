import React from 'react'
import { spring, useCurrentFrame, useVideoConfig } from 'remotion'
import { Backdrop, Card, Reveal, SceneHeading, Stage } from '../components/ui'
import { C, FONT, alpha } from '../theme'

const PLANNED = [
  { title: '版本号自动递增', detail: '从 Godot 工程里读版本，写进 JSON，不用手改' },
  { title: 'PCK 自动打包', detail: '调用 Godot 的 --export-pack，省掉手动导出那一步' },
  { title: '更新历史与回滚', detail: '记录每次复制和上传，出问题能退回上一版' },
  { title: '多目标并行 + 重试', detail: 'GitHub 失败不拖累 Steam，失败的脚本单独重跑' },
  { title: '命令行模式', detail: '给 CI 或自己的脚本调用，不必开界面' },
  { title: 'Steam Guard 更省事', detail: '尽量复用登录状态，减少手机确认次数' },
]

/** 未来计划：明确标注“还没做”，不画饼 */
export const Future: React.FC = () => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  return (
    <Stage>
      <Backdrop tint={C.accentSoft} dim />

      <SceneHeading
        kicker="接下来"
        title="这些还在计划里"
        sub="下面每一条都还没实现，是下一步想做的方向——先把当前这套跑稳，再往上加。"
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 18, marginTop: 50 }}>
        {PLANNED.map((item, index) => {
          const delay = 30 + index * 10
          const p = spring({ frame: frame - delay, fps, config: { damping: 200 } })
          return (
            <div
              key={item.title}
              style={{
                opacity: p,
                transform: `translateY(${(1 - p) * 26}px)`,
                display: 'flex',
                alignItems: 'flex-start',
                gap: 16,
                padding: '20px 24px',
                borderRadius: 14,
                border: `1px dashed ${alpha(C.accentSoft, 0.35)}`,
                background: alpha(C.panel, 0.55),
              }}
            >
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 5,
                  marginTop: 9,
                  flex: 'none',
                  border: `1px solid ${C.accentSoft}`,
                  background: alpha(C.accentSoft, 0.25),
                }}
              />
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontFamily: FONT, fontSize: 24, fontWeight: 700, color: C.text }}>{item.title}</span>
                  <span
                    style={{
                      fontFamily: FONT,
                      fontSize: 13,
                      color: C.muted,
                      border: `1px solid ${C.border}`,
                      borderRadius: 999,
                      padding: '2px 8px',
                    }}
                  >
                    计划中
                  </span>
                </div>
                <div style={{ fontFamily: FONT, fontSize: 18, color: C.dim, marginTop: 6 }}>{item.detail}</div>
              </div>
            </div>
          )
        })}
      </div>

      <Reveal delay={110} y={16} style={{ marginTop: 40 }}>
        <Card pad={20} style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontFamily: FONT, fontSize: 22, color: C.warn }}>!</span>
          <span style={{ fontFamily: FONT, fontSize: 20, color: C.dim }}>
            现在的版本只做一件事：把文件搬对、把脚本按顺序跑完、把日志说清楚。
          </span>
        </Card>
      </Reveal>
    </Stage>
  )
}
