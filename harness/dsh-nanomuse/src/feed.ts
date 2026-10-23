// 动态展示契约由宿主和桌面页面共享，旧记录缺少新字段时仍可正常读取。
export interface FeedSource { title: string; url: string }
export interface FeedDetails { sources?: FeedSource[]; recommendationReason?: string; imageSource?: string; fetchedAt?: number }
export interface FeedContent extends FeedDetails { title: string; body: string; image?: string }

export function feedUrl(value: unknown): string {
  if (typeof value !== 'string' || value.length > 2400) return ''
  try {
    const url = new URL(value)
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) return ''
    return url.href
  } catch { return '' }
}

// 来源仅取显式地址或正文中的真实链接，不把图片地址和普通话题名当作原文。
export function feedSources(post: { title?: string; body?: string; sources?: unknown; source?: unknown; sourceUrl?: unknown; source_url?: unknown }): FeedSource[] {
  const out: FeedSource[] = []
  const add = (raw: unknown, title: unknown) => {
    const url = feedUrl(raw)
    if (!url || out.some(item => item.url === url) || out.length >= 4) return
    out.push({ url, title: (typeof title === 'string' ? title.trim() : '').slice(0, 180) || new URL(url).hostname })
  }
  const source = post.sources ?? post.source
  for (const item of Array.isArray(source) ? source : source ? [source] : []) {
    if (typeof item === 'string') add(item, post.title)
    else if (item && typeof item === 'object') add((item as FeedSource).url, (item as FeedSource).title)
  }
  add(post.sourceUrl ?? post.source_url, post.title)
  const body = (post.body || '').replace(/```[\s\S]*?```/g, '').replace(/`[^`]*`/g, '')
  for (const match of body.matchAll(/(!?)\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g)) {
    if (!match[1]) add(match[3], match[2])
  }
  if (!out.length) for (const match of body.matchAll(/https?:\/\/[^\s<>()[\]]+/g)) {
    if (body[match.index! - 1] !== '(') add(match[0].replace(/[.,，。；;！!]+$/, ''), post.title)
  }
  return out
}

export function feedDetails(input: { title?: string; body?: string; sources?: unknown; source?: unknown; sourceUrl?: unknown; source_url?: unknown; recommendationReason?: unknown; recommendation_reason?: unknown; imageSource?: unknown; fetchedAt?: unknown }): FeedDetails & { sources: FeedSource[]; recommendationReason: string } {
  const reason = input.recommendationReason ?? input.recommendation_reason
  return { sources: feedSources(input), recommendationReason: typeof reason === 'string' ? reason.trim().slice(0, 1000) : '',
    ...(feedUrl(input.imageSource) ? { imageSource: feedUrl(input.imageSource) } : {}),
    ...(typeof input.fetchedAt === 'number' && Number.isFinite(input.fetchedAt) ? { fetchedAt: input.fetchedAt } : {}),
  }
}

export function feedImageHint(post: FeedContent): string {
  return feedUrl(post.image) || feedUrl(post.body.match(/!\[[^\]]*\]\((https?:\/\/[^\s)]+)\)/)?.[1])
}

// 总结中的链接只能指向已读取的原文，其他链接退回普通文字，配图由宿主单独保存。
export function feedArticleBody(body: string, source: FeedSource): string {
  const clean = body.replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/\[([^\]]+)\]\(([^)]+)\)/g,
    (_match, label: string, url: string) => feedUrl(url) === source.url ? `[${label}](${source.url})` : label)
  return feedLinkedBody({ title: source.title, body: clean, sources: [source] })
}

// 复用原动态的关键词来源跳转做法，只链接正文中已经出现的实体，不改写事实。
export function feedLinkedBody(post: FeedContent): string {
  let body = post.body.replace(/!\[[^\]]*\]\([^\n)]+\)/g, '').trim()
  const source = feedSources(post)[0]
  if (!source || /[`]/.test(body)) return body
  // 将单独的“详情/来源”链接行收回正文，避免卡片底部出现孤立的来源区域。
  let removedSourceLine = false
  body = body.split('\n').filter(line => {
    const match = line.match(/^\s*(?:详情|来源|原文|阅读原文|参考|报告|链接|更多|source|sources|details|read(?:\s+the)?\s+source)\s*[:：]\s*\[[^\]]+\]\((https?:\/\/[^\s)]+)\)\s*[。.!！]?\s*$/iu)
    if (!match || feedUrl(match[1]) !== source.url) return true
    removedSourceLine = true
    return false
  }).join('\n').replace(/\n{3,}/g, '\n\n').trim()
  // 对照 Kami，先展开模型写出的链接，再按标题实体重新锚定，避免泛称抢占高亮。
  const existingLabels: string[] = []
  body = body.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_match, label: string, url: string) => {
    if (feedUrl(url) === source.url) existingLabels.push(label)
    return label
  })
  const ignored = /^(?:create|update|updates|report|original|blog|release|announcing|with|from|this|that|the|and|for)$/iu
  const terms = (title: string) => (title.match(/[A-Za-z][A-Za-z0-9._-]{3,}|[\p{Script=Han}]{4,}/gu) || []).filter(term => !ignored.test(term))
  const candidates = [post.title, source.title, ...terms(post.title), ...terms(source.title), ...existingLabels]
  for (const candidate of candidates) {
    if ((candidate.length < 4 && !existingLabels.includes(candidate)) || /[\[\]\n]/.test(candidate)) continue
    const offset = body.toLowerCase().indexOf(candidate.toLowerCase())
    if (offset < 0) continue
    const latin = /^[A-Za-z0-9_.-]+$/.test(candidate)
    if (latin && (/[A-Za-z0-9_.-]/.test(body[offset - 1] || '') || /[A-Za-z0-9_.-]/.test(body[offset + candidate.length] || ''))) continue
    const label = body.slice(offset, offset + candidate.length)
    // 小型 Markdown 渲染器不支持地址中的括号，使用等价编码保留完整跳转。
    const target = source.url.replace(/\(/g, '%28').replace(/\)/g, '%29')
    return `${body.slice(0, offset)}[${label}](${target})${body.slice(offset + label.length)}`
  }
  if (removedSourceLine && body) {
    // 正文没有可链接实体时，把来源并入最后一句，确保信息保留且链接不再单独成行。
    const link = `[${source.title}](${source.url.replace(/\(/g, '%28').replace(/\)/g, '%29')})`
    const connector = /[\p{Script=Han}]/u.test(body) ? '，详见 ' : '; see '
    const ending = body.match(/([。.!?！？][”’"')\]}]*)$/u)?.[0] || ''
    const sentence = ending ? body.slice(0, -ending.length) : body
    return `${sentence}${connector}${link}${ending}`
  }
  return body
}

// 讨论始终携带当时保存的来源和理由，不用当前用户画像补造历史依据。
export function feedDiscussion(post: FeedContent, zh: boolean): string {
  return [
    `**${post.title}**`, post.body,
    post.recommendationReason ? `${zh ? '为你创建的理由' : 'Why this was created for you'}: ${post.recommendationReason}` : '',
    ...feedSources(post).map(source => `${zh ? '原文' : 'Source'}: ${source.title} ${source.url}`),
  ].filter(Boolean).join('\n\n')
}
