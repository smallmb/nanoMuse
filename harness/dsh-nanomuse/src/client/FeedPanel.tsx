/**
 * The Feed (动态): the posts the agent wrote for the person, newest first — an
 * emoji mark, the title and when, the body with its links, a picture when
 * the story had one, and under each a heart and "Discuss", which opens a chat
 * about it. The sliders at the top right hold the feed's instructions (what
 * the person wants to read here) and a "write a batch now".
 */
import { failureText } from './api.ts'
import { createElement as h, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import type { Translate } from './api.ts'
import { IconComment, IconExternal, IconFeed, IconHeart, IconInfo, IconRefresh, IconSliders } from './icons.tsx'
import { feedImageHint, feedLinkedBody, feedSources } from '../feed.ts'
import { openLink } from './bridge.ts'
import { FEED_PANEL } from './panels.ts'
import { usePageScroll } from './page-cache.ts'
import { setPrefs, usePrefs } from './prefs.ts'
import { markFeedSeen, nav, roomsCall, useRooms, type FeedPost, type FeedRoutine } from './rooms.ts'
import { ago, Empty, Markdown, MoreButton, RoomToggle, Sheet } from './ui.tsx'

export function makeFeedPanel(t: Translate) {
  return function FeedPanel(): ReactNode {
    const rooms = useRooms()
    const scroll = usePageScroll('feed')
    const prefs = usePrefs()
    const [settings, setSettings] = useState(false)
    const [error, setError] = useState<string | undefined>()
    const posts = rooms.feed.posts
    const newest = posts[0]?.at ?? 0
    useEffect(() => { if (newest) markFeedSeen() }, [newest])
    // opening the Feed makes sure the daily routine exists (C5: 08:00, once, on the host)
    useEffect(() => { roomsCall('feed/open', {}).catch(() => undefined) }, [])
    const routine = rooms.feed.routine

    const fail = (err: unknown) => setError(failureText(t, err))
    const refresh = () => { setError(undefined); roomsCall('feed/refresh', {}).catch(fail) }
    const discuss = (post: FeedPost) => {
      setError(undefined)
      // the chat opens beside the feed, the post's words already in it (Muse's 讨论)
      roomsCall<{ sessionId: string }>('feed/discuss', { id: post.id }).then(({ sessionId }) => { nav.openSession(sessionId); nav.split(FEED_PANEL) }).catch(fail)
    }

    return h('div', { className: 'nm-room nm-feed-room nm-room-with-chat' },
      h('div', { className: 'nm-room-top', 'data-window-drag': true }),
      // 开关固定在动态区域左上角，不随居中的标题移动。
      h(RoomToggle, { t, panel: FEED_PANEL }),
      h('div', { className: 'nm-room-head' },
        h('h1', { className: 'nm-room-title' }, t('railFeed')),
        h('div', { className: 'nm-room-actions' },
          rooms.busy.feed ? h('span', { className: 'nm-room-busy' }, h('span', { className: 'nm-spinner nm-spinner-sm' }), t('feedWriting')) : null,
          h('button', { type: 'button', className: 'nm-round-btn', title: t('feedSettings'), 'aria-label': t('feedSettings'), onClick: () => setSettings(true) }, h(IconSliders, { size: 18 })))),
      h('div', { className: 'nm-room-body', ref: scroll },
        h('div', { className: 'nm-room-inner nm-feed' },
          error ? h('div', { className: 'nm-room-error' }, error) : null,
          // the phone's intro card, until "Got it"
          !prefs.feedIntroSeen
            ? h('div', { className: 'nm-feed-intro', role: 'note' },
                h('div', { className: 'nm-feed-intro-title' }, t('feedIntroTitle')),
                h('p', { className: 'nm-feed-intro-body' }, t('feedIntroDesc')),
                h('div', { className: 'nm-feed-intro-actions' },
                  h('button', { type: 'button', className: 'nm-pill nm-pill-ghost nm-pill-sm', onClick: () => setSettings(true) }, t('feedIntroEdit')),
                  h('button', { type: 'button', className: 'nm-pill nm-pill-sm', onClick: () => setPrefs({ feedIntroSeen: true }) }, t('feedIntroGotIt'))))
            : null,
          posts.length === 0
            ? h(Empty, { icon: h(IconFeed, { size: 28 }), text: rooms.busy.feed ? t('feedWriting') : t('feedEmptyTitle') },
                h('p', { className: 'nm-empty-sub' }, rooms.ready ? t('feedEmptyBody', { time: routine.time }) : t('feedRoutineNeedsModel')),
                rooms.ready
                  ? h('div', { className: 'nm-feed-how' },
                      h('div', { className: 'nm-feed-how-title' }, t('feedEmptyHowTitle')),
                      h('p', null, t('feedEmptyHowBody')))
                  : null,
                rooms.ready && !rooms.busy.feed ? h('button', { type: 'button', className: 'nm-pill nm-pill-sm', onClick: refresh }, t('feedWriteNow')) : null)
            : posts.map((post) => h(PostCard, { key: post.id, t, post, lang: rooms.lang, onDiscuss: () => discuss(post), onFail: fail })))),
      settings ? h(FeedSettings, { t, instructions: rooms.feed.instructions, routine, busy: rooms.busy.feed, ready: rooms.ready, onClose: () => setSettings(false), onRefresh: refresh }) : null)
  }
}

export function PostCard({ t, post, lang, onDiscuss, onFail }: { t: Translate; post: FeedPost; lang: string; onDiscuss(): void; onFail(err: unknown): void }): ReactNode {
  const [reason, setReason] = useState(false)
  const sources = feedSources(post)
  const primary = sources[0]
  const like = () => { roomsCall('feed/like', { id: post.id, on: !post.liked }).catch(onFail) }
  const remove = () => { roomsCall('feed/delete', { id: post.id }).catch(onFail) }
  return h('article', { className: 'nm-post' },
    h('div', { className: 'nm-post-mark', 'aria-hidden': true }, post.emoji || '✦'),
    h('div', { className: 'nm-post-main' },
      h('div', { className: 'nm-post-head' },
        h('h3', { className: 'nm-post-title' }, primary ? h('a', externalLink(primary.url), post.title) : post.title),
        h('span', { className: 'nm-post-when' }, ago(t, post.at)),
        h(MoreButton, { label: t('more'), size: 26,
          header: h('div', { className: 'nm-menu-meta' }, new Date(post.at).toLocaleString(lang || undefined, { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' })),
          items: [
          { id: 'reason', label: t('feedWhy'), icon: h(IconInfo, { size: 16 }), onSelect: () => setReason(true) },
          'sep',
          { id: 'delete', label: t('feedRemove'), danger: true, onSelect: remove },
        ] })),
      h(Markdown, { text: feedLinkedBody(post), className: 'nm-post-body' }),
      h(PostImage, { post, t }),
      h('div', { className: 'nm-post-actions' },
        h('button', { type: 'button', className: `nm-post-action${post.liked ? ' nm-liked' : ''}`, 'aria-pressed': post.liked, 'aria-label': t('feedLike'), title: t('feedLike'), onClick: like }, h(IconHeart, { size: 18, filled: post.liked })),
        h('button', { type: 'button', className: 'nm-post-action', onClick: onDiscuss }, h(IconComment, { size: 18 }), h('span', null, t('feedDiscuss'))),
      ),
      reason ? h(Sheet, { title: t('feedWhy'), closeLabel: t('close'), onClose: () => setReason(false) },
        h('p', { className: 'nm-post-reason' }, post.recommendationReason?.trim() || t('feedWhyMissing')),
        primary ? h('a', { className: 'nm-post-original', ...externalLink(primary.url) }, t('feedReadSource'), ' ', h(IconExternal, { size: 14 })) : null) : null))
}

function externalLink(url: string) {
  return { href: url, target: '_blank', rel: 'noopener noreferrer', onClick: (event: MouseEvent) => { event.preventDefault(); openLink(url) } }
}

// 已成功解码的图片跨页面切换复用，按内容版本区分，限制缓存数量。
const loadedImages = new Map<string, string>()

function PostImage({ post, t }: { post: FeedPost; t: Translate }): ReactNode {
  const marker = useRef<HTMLSpanElement>(null)
  const source = feedSources(post)[0]?.url
  const hint = feedImageHint(post)
  const key = JSON.stringify([post.id, source, hint, post.fetchedAt])
  const [loaded, setLoaded] = useState({ key, image: loadedImages.get(key) || '' })
  const image = loaded.key === key ? loaded.image : loadedImages.get(key) || ''
  useEffect(() => {
    const setImage = (image: string) => setLoaded({ key, image })
    if (loadedImages.has(key)) { setImage(loadedImages.get(key)!); return }
    setImage('')
    if (!source && !hint) return
    let disposed = false, started = false
    let probe: HTMLImageElement | undefined
    const src = `nanomuse/rooms/feed/image?id=${encodeURIComponent(post.id)}&v=${encodeURIComponent(key)}`
    const load = () => {
      if (started) return
      started = true
      probe = new Image()
      probe.onload = () => {
        loadedImages.set(key, src)
        if (loadedImages.size > 200) loadedImages.delete(loadedImages.keys().next().value!)
        if (!disposed) setImage(src)
      }
      probe.onerror = () => { if (!disposed) setImage('') }
      probe.src = src
    }
    // 进入视口附近才请求配图；真实图片加载完成前不占位，失败不显示破图。
    const target = marker.current?.closest('article')
    const observer = typeof IntersectionObserver === 'undefined' ? undefined : new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { observer?.disconnect(); load() }
    }, { rootMargin: '240px' })
    if (target && observer) observer.observe(target)
    else load()
    return () => { disposed = true; observer?.disconnect(); if (probe) { probe.onload = null; probe.onerror = null } }
  }, [key, post.id, source, hint])
  return h('span', { ref: marker, className: 'nm-post-media' }, image ? h(source ? 'a' : 'span', { className: 'nm-post-images', ...(source ? externalLink(source) : {}) },
    h('img', { src: image, alt: t('feedImageAlt', { title: post.title }), decoding: 'async', onError: () => { loadedImages.delete(key); setLoaded({ key, image: '' }) } })) : null)
}

function FeedSettings({ t, instructions, routine, busy, ready, onClose, onRefresh }: { t: Translate; instructions: string; routine: FeedRoutine; busy: boolean; ready: boolean; onClose(): void; onRefresh(): void }): ReactNode {
  const [text, setText] = useState(instructions)
  const [on, setOn] = useState(routine.on)
  const [time, setTime] = useState(routine.time)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | undefined>()
  const save = (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    const routineChanged = on !== routine.on || time !== routine.time
    Promise.all([
      roomsCall('feed/instructions', { text }),
      routineChanged ? roomsCall('feed/routine', { on, time }) : Promise.resolve(undefined),
    ]).then(onClose).catch((err: unknown) => setError(failureText(t, err))).finally(() => setSaving(false))
  }
  return h(Sheet, { title: t('feedSettingsTitle'), closeLabel: t('close'), onClose,
    footer: h('div', { className: 'nm-sheet-actions' },
      h('button', { type: 'button', className: 'nm-pill nm-pill-ghost nm-pill-sm', disabled: busy || !ready, onClick: () => { onRefresh(); onClose() } }, h(IconRefresh, { size: 14 }), ' ', t('feedWriteNow')),
      h('span', { style: { flex: 1 } }),
      h('button', { type: 'button', className: 'nm-pill nm-pill-ghost nm-pill-sm', onClick: onClose }, t('cancel')),
      h('button', { type: 'submit', form: 'nm-feed-settings', className: 'nm-pill nm-pill-sm', disabled: saving }, t('save'))) },
    h('form', { id: 'nm-feed-settings', onSubmit: save, className: 'nm-sheet-form' },
      h('p', { className: 'nm-sheet-lead' }, t('feedSettingsLead')),
      h('textarea', { className: 'nm-textarea', rows: 6, value: text, placeholder: t('feedSettingsPlaceholder'), maxLength: 2000, onChange: (e: FormEvent<HTMLTextAreaElement>) => setText(e.currentTarget.value), 'data-modal-autofocus': true }),
      h('p', { className: 'nm-sheet-fine' }, t('feedSettingsFine')),
      // the daily routine (C5): on or off, and when
      h('label', { className: 'nm-feed-routine' },
        h('input', { type: 'checkbox', checked: on, onChange: (e: FormEvent<HTMLInputElement>) => setOn(e.currentTarget.checked) }),
        h('span', { className: 'nm-feed-routine-label' }, t('feedRoutineSwitch')),
        h('span', { className: 'nm-feed-routine-time' },
          h('input', { type: 'time', className: 'nm-field nm-field-time', value: time, disabled: !on, 'aria-label': t('feedRoutineTime', { time }), onChange: (e: FormEvent<HTMLInputElement>) => { if (/^\d{2}:\d{2}$/.test(e.currentTarget.value)) setTime(e.currentTarget.value) } }))),
      !ready ? h('p', { className: 'nm-sheet-fine' }, t('feedRoutineNeedsModel')) : null,
      error ? h('div', { className: 'nm-room-error' }, error) : null))
}
