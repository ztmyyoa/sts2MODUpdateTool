import React from 'react'
import { Audio } from '@remotion/media'
import { AbsoluteFill, interpolate, Series, staticFile } from 'remotion'
import { Intro } from './scenes/Intro'
import { Pain } from './scenes/Pain'
import { Flow } from './scenes/Flow'
import { Features } from './scenes/Features'
import { Usage } from './scenes/Usage'
import { Future } from './scenes/Future'
import { Outro } from './scenes/Outro'
import { C } from './theme'

/** 场景时长（30fps）：5s + 9s + 11s + 17s + 13s + 12s + 8s = 75s */
export const SCENES = [
  { key: 'intro', duration: 150 },
  { key: 'pain', duration: 270 },
  { key: 'flow', duration: 330 },
  { key: 'features', duration: 510 },
  { key: 'usage', duration: 390 },
  { key: 'future', duration: 360 },
  { key: 'outro', duration: 240 },
] as const

export const TOTAL_FRAMES = SCENES.reduce((sum, scene) => sum + scene.duration, 0)

/* 背景音乐：开头 1.5 秒淡入，结尾 2.6 秒淡出，整体压到 0.42，别盖住画面节奏 */
const BGM_VOLUME = 0.42
const FADE_IN = 45
const FADE_OUT = 80

const bgmVolume = (frame: number) => {
  const fadeIn = interpolate(frame, [0, FADE_IN], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const fadeOut = interpolate(frame, [TOTAL_FRAMES - FADE_OUT, TOTAL_FRAMES], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  return BGM_VOLUME * Math.min(fadeIn, fadeOut)
}

export const Video: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: C.bg }}>
    <Audio src={staticFile('bgm.mp3')} volume={bgmVolume} />
    <Series>
      <Series.Sequence durationInFrames={150} name="开场">
        <Intro />
      </Series.Sequence>
      <Series.Sequence durationInFrames={270} name="痛点">
        <Pain />
      </Series.Sequence>
      <Series.Sequence durationInFrames={330} name="流水线">
        <Flow />
      </Series.Sequence>
      <Series.Sequence durationInFrames={510} name="功能">
        <Features />
      </Series.Sequence>
      <Series.Sequence durationInFrames={390} name="使用方法">
        <Usage />
      </Series.Sequence>
      <Series.Sequence durationInFrames={360} name="未来计划">
        <Future />
      </Series.Sequence>
      <Series.Sequence durationInFrames={240} name="结尾">
        <Outro />
      </Series.Sequence>
    </Series>
  </AbsoluteFill>
)
