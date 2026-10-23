import { lookup } from 'node:dns/promises'
import { request as httpRequest, type IncomingMessage, type RequestOptions } from 'node:http'
import { request as httpsRequest } from 'node:https'
import { isIP } from 'node:net'
import { feedImageHint, feedSources, feedUrl, type FeedContent, type FeedSource } from './feed.ts'

type Address = { address: string; family: number }
type Resolver = (hostname: string) => Promise<Address[]>
type Transport = (url: URL, options: RequestOptions, callback: (response: IncomingMessage) => void) => ReturnType<typeof httpRequest>
export type MediaResult = { bytes: Buffer; contentType: string; url?: string }
const IMAGE_LIMIT = 6 * 1024 * 1024

// 禁止访问本机、私网、映射地址及保留地址，避免来源页或重定向探测本机服务。
export function publicFeedAddress(address: string): boolean {
  if (isIP(address) === 4) {
    const [a = 0, b = 0, c = 0] = address.split('.').map(Number)
    return a > 0 && a < 224 && ![10, 127].includes(a) &&
      !(a === 100 && b >= 64 && b <= 127) && !(a === 169 && b === 254) &&
      !(a === 172 && b >= 16 && b <= 31) && !(a === 192 && [0, 168].includes(b)) &&
      !(a === 192 && b === 88 && c === 99) && !(a === 198 && [18, 19].includes(b)) &&
      !(a === 198 && b === 51 && c === 100) && !(a === 203 && b === 0 && c === 113)
  }
  return isIP(address) === 6 && /^[23][0-9a-f]{3}:/i.test(address) && !/^2001:(?:0:|0?db8:|[01][0-9a-f]{0,2}:)/i.test(address) && !/^2002:/i.test(address)
}

export async function publicFeedTarget(raw: string, resolve: Resolver = hostname => lookup(hostname, { all: true }), signal = AbortSignal.timeout(5000)) {
  const safe = feedUrl(raw)
  if (!safe) throw Error('invalid_feed_url')
  const url = new URL(safe)
  const hostname = url.hostname.replace(/^\[|\]$/g, '')
  if ((url.port && !['80', '443'].includes(url.port)) || !hostname.includes('.') && !isIP(hostname) || /(?:^|\.)(?:localhost|local|internal|test)$/i.test(hostname)) throw Error('private_feed_url')
  signal.throwIfAborted()
  let abort: () => void = () => undefined
  const aborted = new Promise<never>((_, reject) => { abort = () => reject(Error('feed_timeout')); signal.addEventListener('abort', abort, { once: true }) })
  let addresses: Address[]
  try { addresses = isIP(hostname) ? [{ address: hostname, family: isIP(hostname) }] : await Promise.race([resolve(hostname), aborted]) }
  finally { signal.removeEventListener('abort', abort) }
  if (!addresses.length || addresses.some(item => !publicFeedAddress(item.address))) throw Error('private_feed_address')
  return { url, address: addresses.find(item => item.family === 4) || addresses[0]! }
}

// DNS 校验后将连接固定到已核实的地址，保留原域名用于 TLS 和 Host，防止二次解析绕过校验。
export async function readFeedUrl(raw: string, maxBytes: number, signal: AbortSignal, dependencies: { resolve?: Resolver; request?: Transport; referer?: string } = {}) {
  let next = raw
  for (let redirects = 0; redirects <= 3; redirects++) {
    const { url, address } = await publicFeedTarget(next, dependencies.resolve, signal)
    const reply = await new Promise<{ status: number; headers: IncomingMessage['headers']; bytes: Buffer }>((resolve, reject) => {
      const request: Transport = dependencies.request || (url.protocol === 'https:' ? httpsRequest : httpRequest)
      const req = request(url, {
        signal, family: address.family,
        lookup: (_hostname, _options, callback) => callback(null, address.address, address.family),
        headers: { 'user-agent': 'nanoMuse/1.0 FeedPreview', accept: 'text/html,image/avif,image/webp,image/png,image/jpeg,image/gif', 'accept-encoding': 'identity', ...(feedUrl(dependencies.referer) ? { referer: feedUrl(dependencies.referer) } : {}) },
      }, response => {
        const status = response.statusCode || 0
        if ([301, 302, 303, 307, 308].includes(status)) { response.resume(); resolve({ status, headers: response.headers, bytes: Buffer.alloc(0) }); return }
        if (status < 200 || status >= 300 || Number(response.headers['content-length']) > maxBytes || ![undefined, 'identity'].includes(response.headers['content-encoding'])) { response.destroy(); reject(Error('invalid_feed_response')); return }
        const chunks: Buffer[] = []
        let size = 0
        response.on('data', (chunk: Buffer) => {
          size += chunk.length
          if (size > maxBytes) { response.destroy(); reject(Error('feed_response_too_large')) }
          else chunks.push(Buffer.from(chunk))
        })
        response.on('error', reject)
        response.on('end', () => resolve({ status, headers: response.headers, bytes: Buffer.concat(chunks) }))
      })
      req.on('error', reject)
      req.end()
    })
    if ([301, 302, 303, 307, 308].includes(reply.status)) {
      if (!reply.headers.location) throw Error('feed_redirect_missing')
      next = new URL(reply.headers.location, url).href
      continue
    }
    return { ...reply, url: url.href }
  }
  throw Error('feed_redirect_limit')
}

function unescapeAttribute(value: string): string {
  return value.replace(/&(?:amp|quot|apos|lt|gt|#\d+|#x[0-9a-f]+);/gi, entity => {
    const named: Record<string, string> = { '&amp;': '&', '&quot;': '"', '&apos;': "'", '&lt;': '<', '&gt;': '>' }
    if (entity.toLowerCase() in named) return named[entity.toLowerCase()]!
    const point = parseInt(entity.slice(entity[2]?.toLowerCase() === 'x' ? 3 : 2, -1), entity[2]?.toLowerCase() === 'x' ? 16 : 10)
    return point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : ''
  })
}

// 使用来源页的真实元数据和正文图片，禁止用随机占位图冒充文章配图。
export function feedPageImages(html: string, source: string): string[] {
  const metadata: string[] = [], pictures: string[] = []
  const document = html.replace(/<!--[\s\S]*?-->|<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '')
  for (const match of document.matchAll(/<(meta|link|img)\b[^>]*>/gi)) {
    const attributes: Record<string, string> = {}
    for (const part of match[0].matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)) attributes[part[1]!.toLowerCase()] = unescapeAttribute(part[2] ?? part[3] ?? part[4] ?? '')
    const tag = match[1]!.toLowerCase()
    const property = (attributes.property || attributes.name || '').toLowerCase()
    if (tag === 'meta' && /^(?:og:image(?::(?:url|secure_url))?|twitter:image(?::src)?)$/.test(property)) metadata.push(attributes.content || '')
    else if (tag === 'link' && attributes.rel === 'image_src') metadata.push(attributes.href || '')
    else if (tag === 'img') {
      const src = attributes['data-src'] || attributes.src || ''
      if (/logo|avatar|profile_images|\/authors\/|sprite|icon|badge/i.test(src) || Number(attributes.width || 320) < 160 || Number(attributes.height || 180) < 90) continue
      pictures.push(src)
    }
  }
  return [...new Set([...metadata, ...pictures].filter(raw => raw.trim()).map(raw => { try { return feedUrl(new URL(raw, source).href) } catch { return '' } }).filter(Boolean))].slice(0, 8)
}

export function feedImageType(bytes: Buffer): string {
  if (bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))) return 'image/png'
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'image/jpeg'
  if (/^GIF8[79]a/.test(bytes.subarray(0, 6).toString())) return 'image/gif'
  if (bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP') return 'image/webp'
  if (bytes.subarray(4, 8).toString() === 'ftyp' && /avif|avis/.test(bytes.subarray(8, 32).toString())) return 'image/avif'
  return ''
}

export interface FeedArticle {
  source: FeedSource
  text: string
  image: string
  imageSource: string
  fetchedAt: number
}

// 与 Kami 一样先读取原网页，再从网页候选中验证真实图片；不接受模型猜出的配图地址。
export async function readFeedArticle(source: FeedSource, read = readFeedUrl): Promise<FeedArticle> {
  const signal = AbortSignal.timeout(18000)
  const page = await read(source.url, 2 * 1024 * 1024, signal)
  if (!/text\/html|application\/xhtml\+xml/i.test(String(page.headers['content-type']))) throw Error('feed_source_not_html')
  const html = page.bytes.toString('utf8')
  const title = unescapeAttribute(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] || source.title).replace(/\s+/g, ' ').trim().slice(0, 240)
  const clean = html.replace(/<!--[\s\S]*?-->|<(script|style|nav|header|footer)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '')
  const main = clean.match(/<(?:article|main)\b[^>]*>([\s\S]*?)<\/(?:article|main)>/i)?.[1] || clean
  const text = unescapeAttribute(main.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ')).replace(/\s+/g, ' ').trim().slice(0, 10000)
  if (text.length < 80) throw Error('feed_source_has_no_article_text')
  let image = ''
  for (const candidate of feedPageImages(html, page.url).slice(0, 5)) {
    try {
      const reply = await read(candidate, IMAGE_LIMIT, signal, { referer: page.url })
      if (feedImageType(reply.bytes) && /^image\//i.test(String(reply.headers['content-type']))) { image = reply.url; break }
    } catch { /* 一张候选图失败后继续验证下一张，仍然沿用同一个超时预算。 */ }
  }
  return { source: { title, url: page.url }, text, image, imageSource: image ? page.url : '', fetchedAt: Date.now() }
}

export async function fetchFeedImage(post: FeedContent): Promise<MediaResult | null> {
  const signal = AbortSignal.timeout(12000)
  const hint = feedImageHint(post)
  const source = feedSources(post)[0]?.url
  const load = async (candidate: string): Promise<MediaResult | null> => {
    try {
      const image = await readFeedUrl(candidate, IMAGE_LIMIT, signal, { referer: post.imageSource || source || '' })
      const contentType = feedImageType(image.bytes)
      return contentType && /^image\//i.test(String(image.headers['content-type'])) ? { bytes: image.bytes, contentType, url: image.url } : null
    } catch { return null }
  }
  // 先加载已保存的实际图片，避免来源页的反爬或超时拖慢历史动态。
  if (hint) { const existing = await load(hint); if (existing) return existing }
  let candidates: string[] = []
  if (source) {
    try {
      const page = await readFeedUrl(source, 1024 * 1024, signal)
      if (/text\/html|application\/xhtml\+xml/i.test(String(page.headers['content-type']))) candidates = feedPageImages(page.bytes.toString('utf8'), page.url)
    } catch { /* 来源站点不可读时，仍兼容已有记录中保存的图片。 */ }
  }
  for (const candidate of candidates.filter(item => item !== hint).slice(0, 3)) {
    const image = await load(candidate)
    if (image) return image
  }
  return null
}

// 合并同一动态的并发请求，限制并发和缓存总字节，避免打开列表时反复抓取网页。
export class FeedMedia {
  private cache = new Map<string, { expires: number; result: MediaResult | null }>()
  private pending = new Map<string, Promise<MediaResult | null>>()
  private active = 0
  private waiting: (() => void)[] = []
  constructor(private readonly load = fetchFeedImage) {}
  get(post: FeedContent & { id: string }): Promise<MediaResult | null> {
    const key = JSON.stringify([post.id, post.image, post.imageSource, feedSources(post)])
    const cached = this.cache.get(key)
    if (cached && cached.expires > Date.now()) return Promise.resolve(cached.result)
    const pending = this.pending.get(key)
    if (pending) return pending
    if (this.pending.size >= 32) return Promise.resolve(null)
    const task = (async () => {
      if (this.active >= 4) await new Promise<void>(resolve => this.waiting.push(resolve))
      else this.active++
      try {
        const result = await this.load(post).catch(() => null)
        this.cache.set(key, { expires: Date.now() + (result ? 15 : 2) * 60_000, result })
        let bytes = [...this.cache.values()].reduce((sum, item) => sum + (item.result?.bytes.length || 0), 0)
        while (this.cache.size > 64 || bytes > 24 * 1024 * 1024) {
          const oldest = this.cache.keys().next().value!
          bytes -= this.cache.get(oldest)?.result?.bytes.length || 0
          this.cache.delete(oldest)
        }
        return result
      } finally {
        this.pending.delete(key)
        const next = this.waiting.shift()
        if (next) next()
        else this.active--
      }
    })()
    this.pending.set(key, task)
    return task
  }
}
