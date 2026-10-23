/**
 * 统一渲染宿主各处使用的助手头像，包括侧栏、空会话、胶囊和聊天头部。
 * 默认形象为 Hatch；账号也可以使用彩色底板上的表情符号，或从手机同步的自定义形象。
 * 内置形象按状态播放循环视频。自定义形象使用本机生成的状态视频，并以文件时间戳更新缓存。
 * 小尺寸、列表、选择器、减少动态效果或视频加载失败时使用静态图；没有视频时，头像会轻微呼吸、摇摆或跳动。
 * 窗口隐藏时暂停视频。用户设置的专属视频会覆盖默认状态视频。
 */
import { createElement as h, useEffect, useRef, useState, type CSSProperties, type ReactElement } from 'react'
import { useLive, type Live, type LiveMotion, type LiveOwnClip, type LiveProfile } from './live.ts'
import type { Translate } from './api.ts'

export type Mood = 'idle' | 'working' | 'waiting' | 'happy' | 'error'

// 默认 Hatch 形象及各状态视频，资源由桌面插件统一托管。
const DEFAULT_AVATAR_STILL = 'nanomuse/assets/hatch.jpg'
const DEFAULT_AVATAR_CLIPS: Partial<Record<Mood, string>> = {
  idle: 'hatch.mp4',
  working: 'hatch_working-7x12.mp4',
  waiting: 'hatch_waking.mp4',
  happy: 'hatch_milestone_level_up.mp4',
}

/** 头像尺寸低于此值时使用静态图，避免小头像加载视频。 */
const CLIP_MIN_PX = 44
/** 记录加载失败的视频，后续直接显示静态图。 */
const noClip = new Set<string>()
const reducedMotion = typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * 使用相对路径以适配不同页面挂载点；自有视频的首帧可作为静态预览。
 */
export function stillUrl(profile: LiveProfile | undefined, mood: Mood = 'idle', ownClip?: LiveOwnClip | null, ownClips?: Partial<Record<Mood, LiveOwnClip>>): string {
  if (profile?.avatar === 'face' && profile.faceId) return `nanomuse/assets/face/${profile.faceId}/${mood}.webp`
  const override = ownClips?.[mood]
  if (override?.poster) return `nanomuse/avatar/own-clip-${mood}.png?v=${override.v}`
  if (ownClip?.poster) return `nanomuse/avatar/own-clip.png?v=${ownClip.v}`
  return DEFAULT_AVATAR_STILL
}

/** 返回用户设置的视频地址，并用修改时间更新缓存。 */
export function ownClipUrl(ownClip: LiveOwnClip | null | undefined, mood?: Mood, ownClips?: Partial<Record<Mood, LiveOwnClip>>): string | null {
  const override = mood ? ownClips?.[mood] : undefined
  if (override && mood) return `nanomuse/avatar/own-clip-${mood}.mp4?v=${override.v}`
  return ownClip ? `nanomuse/avatar/own-clip.mp4?v=${ownClip.v}` : null
}

/**
 * 按头像状态选择动画视频；错误状态和表情头像使用静态显示。
 * 绘制头像只有在本机存在对应动画时才播放，并通过修改时间刷新缓存。
 */
export function clipUrl(profile: LiveProfile | undefined, mood: Mood = 'idle', motion?: LiveMotion): string | null {
  if (mood === 'error' || profile?.avatar === 'emoji') return null
  if (profile?.avatar === 'face' && profile.faceId) {
    if (!motion || motion.faceId !== profile.faceId) return null
    const clip = motion.clips[mood]
    return clip ? `nanomuse/avatar/motion/${mood}.mp4?v=${clip.v}` : null
  }
  const clip = DEFAULT_AVATAR_CLIPS[mood]
  return clip ? `nanomuse/assets/${clip}` : null
}

/**
 * 头像动画正在生成时返回标题栏提示；传入翻译函数后使用当前语言文案。
 */
export function motionStatus(live: Pick<Live, 'motion'>, t?: Translate): string | null {
  const p = live.motion.progress
  if (!p || !p.running) return null
  const n = Math.min(p.done + 1, p.total)
  return t ? t('moAnimating', { n, total: p.total }) : `Animating ${n}/${p.total}…`
}

/** 页面不可见时暂停头像视频，减少后台资源占用。 */
function useVisible(): boolean {
  const [visible, setVisible] = useState(() => typeof document === 'undefined' || document.visibilityState !== 'hidden')
  useEffect(() => {
    if (typeof document === 'undefined') return
    const on = () => setVisible(document.visibilityState !== 'hidden')
    document.addEventListener('visibilitychange', on)
    return () => document.removeEventListener('visibilitychange', on)
  }, [])
  return visible
}

export interface AvatarProps {
  size: number
  profile?: LiveProfile | undefined
  mood?: Mood
  className?: string | undefined
  title?: string
  /** 禁用动画，用于列表、选择器等需要静态头像的场景。 */
  still?: boolean
}

/** 按圆形头像结构渲染；表情由组件绘制，图片和视频在圆形区域内铺满裁切。 */
export function Avatar({ size, profile, mood = 'idle', className, title, still = false }: AvatarProps): ReactElement {
  const name = title ?? profile?.name ?? 'nanoMuse'
  const [, bump] = useState(0)
  const live = useLive()
  const visible = useVisible()
  const video = useRef<HTMLVideoElement | null>(null)
  const candidate = still || reducedMotion || size < CLIP_MIN_PX ? null : ownClipUrl(live.ownClip, mood, live.ownClips) ?? clipUrl(profile, mood, live.motion)
  const clip = candidate && !noClip.has(candidate) ? candidate : null
  const poster = stillUrl(profile, mood, live.ownClip, live.ownClips)
  // 无视频动画时，让圆形头像容器播放轻微状态动画。
  const motion = still || clip || reducedMotion ? '' : mood === 'working' ? ' nm-avatar-working' : mood === 'waiting' ? ' nm-avatar-waiting' : mood === 'idle' ? ' nm-avatar-idle' : ''

  useEffect(() => {
    const el = video.current
    if (!el) return
    if (visible) void el.play().catch(() => undefined)
    else el.pause()
  }, [visible, clip])

  // 外层保留圆形边界，内层再裁切一次，避免图片或视频露出方角。
  const box: CSSProperties = { width: size, height: size, borderRadius: '50%', overflow: 'hidden', clipPath: 'circle(50% at 50% 50%)' }
  const emoji = profile?.avatar === 'emoji'
  // 视频、图片和表情都放入同一个圆形面层，保证不同头像来源的边缘一致。
  const content = clip
    ? h('video', {
        key: clip,
        ref: video,
        src: clip,
        poster,
        autoPlay: visible,
        loop: true,
        muted: true,
        playsInline: true,
        disablePictureInPicture: true,
        'aria-hidden': true,
        onError: () => {
          noClip.add(clip)
          bump((n) => n + 1)
        },
      })
    : emoji
      ? h('span', { className: 'nm-avatar-emoji', style: { background: profile.color || '#0064d4', fontSize: Math.round(size * 0.58) } }, profile.emoji || '✨')
      : h('img', { src: poster, alt: '', width: size, height: size, draggable: false })
  const face = h('span', { className: `nm-avatar-face${motion}` }, content)

  return h(
    'span',
    {
      role: 'img',
      'aria-label': name,
      title,
      className: `nm-avatar${className ? ` ${className}` : ''}`,
      style: box,
    },
    face,
  )
}

/** 侧栏标志旁的文字名称，沿用侧栏字体样式。 */
export function BrandName({ text }: { text: string }): ReactElement {
  return h('span', { style: { fontWeight: 600, letterSpacing: '-0.01em' } }, text)
}
