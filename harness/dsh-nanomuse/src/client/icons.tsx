/**
 * 桌面共用图标：优先使用项目内的透明图标库，缺少对应资源时使用同规格矢量图形。
 * 统一继承文字颜色与尺寸，让设置、资源库、目标和聊天工具栏保持一致。
 */
import { createElement as h, type ReactNode } from 'react'

export interface IconProps {
  size?: number
  className?: string
  /** 矢量备用图标的线宽，透明位图保留资源自身的线条。 */
  stroke?: number
}

/** 共用位图以透明遮罩显示，尺寸由页面场景决定，颜色继承文字状态。 */
export function IconAsset({ name, size = 18, className }: IconProps & { name: string }): ReactNode {
  return h('span', {
    className: ['nm-icon', 'nm-asset-icon', className].filter(Boolean).join(' '),
    'data-icon': name,
    'aria-hidden': true,
    style: { width: `var(--nm-icon-size, ${size}px)`, height: `var(--nm-icon-size, ${size}px)`, maskImage: `url('/nanomuse/assets/icons-legacy-${name}.png')` },
  })
}

function icon(paths: ReactNode[], { size = 18, className, stroke = 1.75 }: IconProps): ReactNode {
  return h('svg', {
    width: size,
    height: size,
    style: { width: `var(--nm-icon-size, ${size}px)`, height: `var(--nm-icon-size, ${size}px)` },
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: stroke,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    className: ['nm-icon', className].filter(Boolean).join(' '),
    'aria-hidden': true,
    focusable: false,
  }, ...paths)
}

export const IconChat = (p: IconProps) => IconAsset({ name: 'speechBubble', ...p })
export const IconSearch = (p: IconProps) => IconAsset({ name: 'search', ...p })
export const IconCalendar = (p: IconProps) => IconAsset({ name: 'calendar', ...p })
export const IconDevices = (p: IconProps) => IconAsset({ name: 'laptopPhone', ...p })
export const IconMenu = (p: IconProps) => icon([h('path', { key: 1, d: 'M4 7h16M4 12h16M4 17h16' })], p)
export const IconSettings = (p: IconProps) => icon([h('circle', { key: 1, cx: 12, cy: 12, r: 3 }), h('path', { key: 2, d: 'M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h.1a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v.1a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z' })], p)
export const IconKeyboard = (p: IconProps) => icon([h('rect', { key: 1, x: 3, y: 6, width: 18, height: 12, rx: 2 }), h('path', { key: 2, d: 'M7 10h.01M11 10h.01M15 10h.01M7 14h10' })], p)
export const IconBug = (p: IconProps) => icon([h('path', { key: 1, d: 'M9 9h6v5a3 3 0 0 1-6 0z' }), h('path', { key: 2, d: 'M9 9a3 3 0 0 1 6 0M4 13h3M17 13h3M5 18l3-2M19 18l-3-2M5 8l3 2M19 8l-3 2M12 17v3' })], p)
export const IconPuzzle = (p: IconProps) => icon([h('path', { key: 1, d: 'M10 4.5a1.5 1.5 0 1 1 3 0V6h3a1 1 0 0 1 1 1v3h1.5a1.5 1.5 0 1 1 0 3H17v3a1 1 0 0 1-1 1h-3v-1.5a1.5 1.5 0 1 0-3 0V17H7a1 1 0 0 1-1-1v-3H4.5a1.5 1.5 0 1 1 0-3H6V7a1 1 0 0 1 1-1h3z' })], p)
export const IconPlus = (p: IconProps) => icon([h('path', { key: 1, d: 'M12 5v14M5 12h14' })], p)
export const IconPanelLeft = (p: IconProps) => icon([h('rect', { key: 1, x: 3.5, y: 4.5, width: 17, height: 15, rx: 2.5 }), h('path', { key: 2, d: 'M9.5 4.5v15' })], p)
export const IconStop = (p: IconProps) => icon([h('rect', { key: 1, x: 7, y: 7, width: 10, height: 10, rx: 2, fill: 'currentColor', stroke: 'none' })], p)
export const IconChevronLeft = (p: IconProps) => icon([h('path', { key: 1, d: 'm14.5 6-6 6 6 6' })], p)
export const IconChevronRight = (p: IconProps) => icon([h('path', { key: 1, d: 'm9.5 6 6 6-6 6' })], p)
export const IconCheck = (p: IconProps) => IconAsset({ name: 'check', ...p })
export const IconClose = (p: IconProps) => icon([h('path', { key: 1, d: 'M6 6l12 12M18 6 6 18' })], p)
export const IconMic = (p: IconProps) => IconAsset({ name: 'microphone', ...p })
export const IconFolder = (p: IconProps) => IconAsset({ name: 'folder', ...p })
export const IconHand = (p: IconProps) => icon([h('path', { key: 1, d: 'M8 12.5V6.2a1.4 1.4 0 0 1 2.8 0V11M10.8 10.5V4.9a1.4 1.4 0 0 1 2.8 0V11M13.6 10.8V6.2a1.4 1.4 0 0 1 2.8 0v6.3' }), h('path', { key: 2, d: 'M16.4 12.5a1.4 1.4 0 0 1 2.8 0v2.2c0 3.7-2.6 6.3-6.3 6.3-2.9 0-4.5-1.3-5.6-3.2L4.6 14a1.4 1.4 0 0 1 2.3-1.6L8 13.9' })], p)
export const IconUser = (p: IconProps) => IconAsset({ name: 'user', ...p })
export const IconSliders = (p: IconProps) => icon([h('path', { key: 1, d: 'M5 7h9M18 7h1M5 12h3M12 12h7M5 17h11M20 17h-1' }), h('circle', { key: 2, cx: 16, cy: 7, r: 2 }), h('circle', { key: 3, cx: 10, cy: 12, r: 2 }), h('circle', { key: 4, cx: 18, cy: 17, r: 2 })], p)
export const IconCpu = (p: IconProps) => icon([h('rect', { key: 1, x: 6, y: 6, width: 12, height: 12, rx: 2 }), h('rect', { key: 2, x: 10, y: 10, width: 4, height: 4, rx: 0.8 }), h('path', { key: 3, d: 'M9 3v3M15 3v3M9 18v3M15 18v3M3 9h3M3 15h3M18 9h3M18 15h3' })], p)
export const IconSparkle = (p: IconProps) => icon([h('path', { key: 1, d: 'M12 3.5 13.8 9l5.7 1.8-5.7 1.8L12 18.3l-1.8-5.7-5.7-1.8L10.2 9z' }), h('path', { key: 2, d: 'M19 3v3M17.5 4.5h3' })], p)
export const IconDatabase = (p: IconProps) => icon([h('ellipse', { key: 1, cx: 12, cy: 6, rx: 7, ry: 2.5 }), h('path', { key: 2, d: 'M5 6v12c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5V6M5 12c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5' })], p)
export const IconArchive = (p: IconProps) => IconAsset({ name: 'archive', ...p })
export const IconLogOut = (p: IconProps) => icon([h('path', { key: 1, d: 'M10 4H6.5A2.5 2.5 0 0 0 4 6.5v11A2.5 2.5 0 0 0 6.5 20H10M15 16l4-4-4-4M19 12H9' })], p)
export const IconBell = (p: IconProps) => IconAsset({ name: 'bell', ...p })
export const IconMore = (p: IconProps) => icon([h('circle', { key: 1, cx: 6, cy: 12, r: 1.2, fill: 'currentColor' }), h('circle', { key: 2, cx: 12, cy: 12, r: 1.2, fill: 'currentColor' }), h('circle', { key: 3, cx: 18, cy: 12, r: 1.2, fill: 'currentColor' })], p)
export const IconLaptop = (p: IconProps) => icon([h('rect', { key: 1, x: 4, y: 5, width: 16, height: 11, rx: 2 }), h('path', { key: 2, d: 'M2.5 19h19' })], p)
export const IconPhone = (p: IconProps) => icon([h('rect', { key: 1, x: 7, y: 3, width: 10, height: 18, rx: 2.2 }), h('path', { key: 2, d: 'M11 17.5h2' })], p)
export const IconPencil = (p: IconProps) => icon([h('path', { key: 1, d: 'M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17z' }), h('path', { key: 2, d: 'm13.5 7.5 3 3' })], p)
export const IconShield = (p: IconProps) => icon([h('path', { key: 1, d: 'M12 3.5 5 6.2v5.3c0 4.4 3 7.6 7 9 4-1.4 7-4.6 7-9V6.2z' }), h('path', { key: 2, d: 'm9 12 2 2 4-4' })], p)
export const IconClock = (p: IconProps) => IconAsset({ name: 'clock', ...p })
export const IconList = (p: IconProps) => icon([h('path', { key: 1, d: 'M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01' })], p)
export const IconBrain = (p: IconProps) => icon([h('path', { key: 1, d: 'M9.5 4.5a2.5 2.5 0 0 0-2.5 2.5v.5A2.5 2.5 0 0 0 5 10v1a2.5 2.5 0 0 0 1 2v1.5A2.5 2.5 0 0 0 8.5 17H9a3 3 0 0 0 3 3V7.5a3 3 0 0 0-2.5-3z' }), h('path', { key: 2, d: 'M14.5 4.5A2.5 2.5 0 0 1 17 7v.5a2.5 2.5 0 0 1 2 2.5v1a2.5 2.5 0 0 1-1 2v1.5a2.5 2.5 0 0 1-2.5 2.5H15a3 3 0 0 1-3 3V7.5a3 3 0 0 1 2.5-3z' })], p)
/** 形象面板用闪电标记表达当前连接状态。 */
export const IconBolt = (p: IconProps) => icon([h('path', { key: 1, d: 'M13 2 4.8 13.3h6.1L10.2 22l9-12.3h-6.1z', fill: 'currentColor', stroke: 'none' })], p)
/** 身份面板用指纹标记，和截图中的第四个快捷页签保持一致。 */
export const IconFingerprint = (p: IconProps) => icon([
  h('path', { key: 1, d: 'M12 3a9 9 0 0 0-9 9' }),
  h('path', { key: 2, d: 'M12 6a6 6 0 0 0-6 6' }),
  h('path', { key: 3, d: 'M12 9a3 3 0 0 0-3 3' }),
  h('path', { key: 4, d: 'M12 12v9' }),
  h('path', { key: 5, d: 'M15 12c0 3.2-.5 6-1.6 8.5' }),
  h('path', { key: 6, d: 'M18 12c0 2.4-.3 4.6-1 6.6' }),
  h('path', { key: 7, d: 'M21 12a9 9 0 0 0-9-9' }),
], p)
export const IconGift = (p: IconProps) => IconAsset({ name: 'gift', ...p })
export const IconTarget = (p: IconProps) => icon([h('rect', { key: 1, x: 4, y: 4, width: 16, height: 16, rx: 3.5 }), h('path', { key: 2, d: 'm8.5 12 2.5 2.5 5-5' })], p)
export const IconFile = (p: IconProps) => IconAsset({ name: 'document', ...p })
export const IconLink = (p: IconProps) => icon([h('path', { key: 1, d: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1' }), h('path', { key: 2, d: 'M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1' })], p)
export const IconCopy = (p: IconProps) => icon([h('rect', { key: 1, x: 9, y: 9, width: 11, height: 11, rx: 2 }), h('path', { key: 2, d: 'M5 15V6a2 2 0 0 1 2-2h9' })], p)
export const IconSun = (p: IconProps) => IconAsset({ name: 'sun', ...p })
export const IconMoon = (p: IconProps) => IconAsset({ name: 'moonCrescent', ...p })
export const IconMonitor = (p: IconProps) => icon([h('rect', { key: 1, x: 3, y: 4.5, width: 18, height: 12, rx: 2 }), h('path', { key: 2, d: 'M8 20h8M12 16.5V20' })], p)
export const IconHelp = (p: IconProps) => icon([h('circle', { key: 1, cx: 12, cy: 12, r: 8.5 }), h('path', { key: 2, d: 'M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.7M12 17h.01' })], p)
export const IconScale = (p: IconProps) => icon([h('path', { key: 1, d: 'M12 3.5v17M5 20h14M4 7.5h16' }), h('path', { key: 2, d: 'M7 7.5 4 14a3 3 0 0 0 6 0zM17 7.5 14 14a3 3 0 0 0 6 0z' })], p)
export const IconPaperclip = (p: IconProps) => IconAsset({ name: 'paperclip', ...p })
export const IconArrowUp = (p: IconProps) => icon([h('path', { key: 1, d: 'M12 19V5M5.5 11.5 12 5l6.5 6.5' })], p)
export const IconRefresh = (p: IconProps) => icon([h('path', { key: 1, d: 'M20 11a8 8 0 0 0-14.6-3.5M4 13a8 8 0 0 0 14.6 3.5' }), h('path', { key: 2, d: 'M20 4v4h-4M4 20v-4h4' })], p)
// The rooms' glyphs: the rail's Feed (a page with lines), Ideas (a bulb), Goals (a
// checked square — IconTarget above), Library (four shapes), and what the rooms show.
export const IconFeed = (p: IconProps) => IconAsset({ name: 'newspaper', ...p })
export const IconBulb = (p: IconProps) => IconAsset({ name: 'lightbulb', ...p })
// 资源库四图形依次为左上菱形、右上三角形、左下圆形和右下方形。
export const IconShapes = (p: IconProps) => icon([h('path', { key: 1, d: 'm6.5 2.5 4 4-4 4-4-4zM17.5 2.5l4 8h-8z' }), h('circle', { key: 2, cx: 6.5, cy: 17.5, r: 4 }), h('rect', { key: 3, x: 13.5, y: 13.5, width: 8, height: 8, rx: 1.5 })], p)
// 喜欢的空心状态复用资源，实心状态保留矢量，并扩大轮廓以匹配位图的视觉尺寸。
export const IconHeart = (p: IconProps & { filled?: boolean }) => p.filled
  ? icon([h('path', { key: 1, d: 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z', transform: 'translate(-6 -8) scale(1.5)', fill: 'currentColor', stroke: 'none' })], p)
  : IconAsset({ name: 'heart', ...p })
export const IconComment = (p: IconProps) => IconAsset({ name: 'speechBubble', ...p })
export const IconFilter = (p: IconProps) => icon([h('path', { key: 1, d: 'M4 7h16M7 12h10M10 17h4' })], p)
export const IconGlobe = (p: IconProps) => IconAsset({ name: 'globe', ...p })
export const IconImage = (p: IconProps) => IconAsset({ name: 'image', ...p })
export const IconVideo = (p: IconProps) => IconAsset({ name: 'mediaPlay', ...p })
export const IconWave = (p: IconProps) => IconAsset({ name: 'musicNote', ...p })
export const IconAlarm = (p: IconProps) => IconAsset({ name: 'alarmClock', ...p })
export const IconCheckCircle = (p: IconProps) => icon([h('circle', { key: 1, cx: 12, cy: 12, r: 8.5 }), h('path', { key: 2, d: 'm8.5 12.2 2.4 2.4 4.8-5' })], p)
export const IconHeartLine = (p: IconProps) => IconAsset({ name: 'heart', ...p })
export const IconUsers = (p: IconProps) => IconAsset({ name: 'users2', ...p })
export const IconDollar = (p: IconProps) => IconAsset({ name: 'coinStack', ...p })
export const IconBriefcase = (p: IconProps) => IconAsset({ name: 'briefcase', ...p })
export const IconPalette = (p: IconProps) => IconAsset({ name: 'paintPalette', ...p })
export const IconShare = (p: IconProps) => icon([h('path', { key: 1, d: 'M12 15V4M8 7.5 12 3.5l4 4M5 13v5.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V13' })], p)
export const IconExternal = (p: IconProps) => icon([h('path', { key: 1, d: 'M14 4.5h5.5V10M19.5 4.5 11 13M17 14v4.5a1.5 1.5 0 0 1-1.5 1.5h-10A1.5 1.5 0 0 1 4 18.5v-10A1.5 1.5 0 0 1 5.5 7H10' })], p)
export const IconTrash = (p: IconProps) => icon([h('path', { key: 1, d: 'M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13M10 11v5.5M14 11v5.5' })], p)
export const IconSquare = (p: IconProps) => icon([h('rect', { key: 1, x: 4.5, y: 4.5, width: 15, height: 15, rx: 3 })], p)
export const IconPlay = (p: IconProps) => IconAsset({ name: 'mediaPlay', ...p })
export const IconDoc = (p: IconProps) => IconAsset({ name: 'article', ...p })
export const IconExpand = (p: IconProps) => icon([h('path', { key: 1, d: 'M14 4.5h5.5V10M10 19.5H4.5V14M19.5 4.5 13.5 10.5M4.5 19.5l6-6' })], p)
export const IconPin = (p: IconProps) => IconAsset({ name: 'thumbpin', ...p })
export const IconReply = (p: IconProps) => icon([h('path', { key: 1, d: 'M9.5 7 4.5 11.5l5 4.5' }), h('path', { key: 2, d: 'M4.5 11.5h8a7 7 0 0 1 7 7v1' })], p)
export const IconSmile = (p: IconProps) => icon([h('circle', { key: 1, cx: 12, cy: 12, r: 8.5 }), h('path', { key: 2, d: 'M8.5 14.5s1.2 2 3.5 2 3.5-2 3.5-2M9.3 9.5h.01M14.7 9.5h.01' })], p)
export const IconInfo = (p: IconProps) => icon([h('circle', { key: 1, cx: 12, cy: 12, r: 8.5 }), h('path', { key: 2, d: 'M12 11v5.5M12 7.5h.01' })], p)
export const IconDownload = (p: IconProps) => icon([h('path', { key: 1, d: 'M12 4v11M7 10.5l5 5 5-5M4.5 19.5h15' })], p)
export const IconCode = (p: IconProps) => IconAsset({ name: 'documentFormatCode', ...p })
export const IconBan = (p: IconProps) => icon([h('circle', { key: 1, cx: 12, cy: 12, r: 8.5 }), h('path', { key: 2, d: 'm6 6 12 12' })], p)
export const IconWallet = (p: IconProps) => IconAsset({ name: 'creditCard', ...p })
export const IconLock = (p: IconProps) => icon([h('rect', { key: 1, x: 5.5, y: 10.5, width: 13, height: 10, rx: 2 }), h('path', { key: 2, d: 'M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5' })], p)
export const IconMessage = (p: IconProps) => IconAsset({ name: 'speechBubble', ...p })
export const IconChevronDown = (p: IconProps) => icon([h('path', { key: 1, d: 'm6 9.5 6 6 6-6' })], p)
export const IconKey = (p: IconProps) => icon([h('circle', { key: 1, cx: 8, cy: 14, r: 4 }), h('path', { key: 2, d: 'm10.8 11.2 8.7-8.7M16 6l2.5 2.5M13.5 8.5 16 11' })], p)
export const IconSpinner = (p: IconProps) => icon([h('path', { key: 1, d: 'M12 3.5a8.5 8.5 0 1 1-8.5 8.5', className: 'nm-spin' })], p)
export const IconSend = (p: IconProps) => icon([h('path', { key: 1, d: 'M12 19V5M5.5 11.5 12 5l6.5 6.5' })], p)
export const IconLayout = (p: IconProps) => icon([h('rect', { key: 1, x: 3.5, y: 4.5, width: 17, height: 15, rx: 2.5 }), h('path', { key: 2, d: 'M9.5 4.5v15M6 8.5h1.5M6 11.5h1.5' })], p)
export const IconCircleDot = (p: IconProps) => icon([h('circle', { key: 1, cx: 12, cy: 12, r: 8.5 }), h('circle', { key: 2, cx: 12, cy: 12, r: 2.5 })], p)
export const IconMail = (p: IconProps) => IconAsset({ name: 'envelope', ...p })
export const IconHome = (p: IconProps) => IconAsset({ name: 'house', ...p })
