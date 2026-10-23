import assert from 'node:assert/strict'
import { before, test } from 'node:test'
import { EventEmitter } from 'node:events'
import { Readable } from 'node:stream'
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import Rooms from '../lib/rooms.js'
import { parseFeedDraft } from '../lib/fences.js'

let feed, media
before(async () => {
  // 在内存构建纯契约和网络边界，不修改实际账号数据或访问公网。
  const load = async file => {
    const result = await build({ entryPoints: [fileURLToPath(new URL(`../src/${file}.ts`, import.meta.url))], bundle: true, write: false, format: 'esm', platform: 'node' })
    return import('data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].contents).toString('base64'))
  }
  ;[feed, media] = await Promise.all([load('feed'), load('feed-media')])
})

const article = { title: 'LiteLLM supply chain update', body: 'LiteLLM has published an update.', sources: [{ title: 'Original report', url: 'https://example.com/report' }] }

test('历史正文恢复真实来源，图片和危险协议不会混入原文链接', () => {
  assert.deepEqual(feed.feedSources({ body: '![cover](https://cdn.example.com/photo.png) [report](https://example.com/a) https://example.com/b' }), [{ title: 'report', url: 'https://example.com/a' }])
  assert.deepEqual(feed.feedSources({ body: '[report](javascript:alert(1))', sources: [{ title: 'bad', url: 'file:///etc/passwd' }] }), [])
  assert.equal(feed.feedUrl('https://user:pass@example.com'), '')
  assert.equal(feed.feedDetails({ body: article.body }).recommendationReason, '')
  assert.equal(feed.feedDetails({ recommendation_reason: '  你正在关注依赖更新。  ' }).recommendationReason, '你正在关注依赖更新。')
})

test('正文中的真实实体获得来源链接，已有链接和代码保持原意', () => {
  assert.equal(feed.feedLinkedBody(article), '[LiteLLM](https://example.com/report) has published an update.')
  assert.equal(feed.feedLinkedBody({ ...article, title: 'Create', body: 'VistaCreate is different.' }), 'VistaCreate is different.')
  assert.equal(feed.feedLinkedBody({ ...article, body: '[report](https://example.com/report)' }), '[report](https://example.com/report)')
  assert.equal(feed.feedLinkedBody({ ...article, body: '`LiteLLM` code' }), '`LiteLLM` code')
  assert.equal(feed.feedImageHint({ ...article, body: '![cover](https://example.com/cover.png)' }), 'https://example.com/cover.png')
  assert.equal(feed.feedLinkedBody({ ...article, body: '![cover](https://example.com/a.png) LiteLLM update' }).startsWith('!'), false)
})

test('单独的详情来源链接并入正文实体，不再独占一行', () => {
  const post = {
    title: 'LiteLLM 供应链投毒',
    body: 'LiteLLM 1.107.0 被植入后门。建议检查你是否装过这个版本。\n\n详情：[SafeDep 分析报告](https://example.com/report)',
    sources: [{ title: 'SafeDep 分析报告', url: 'https://example.com/report' }],
  }
  const linked = feed.feedLinkedBody(post)
  assert.match(linked, /^\[LiteLLM\]\(https:\/\/example\.com\/report\)/)
  assert.doesNotMatch(linked, /详情：|SafeDep 分析报告\]\(/)
  assert.equal([...linked.matchAll(/\[[^\]]+\]\(https?:\/\//g)].length, 1)
})

test('标题关键词优先于模型已经链接的泛称，重复渲染保持稳定', () => {
  for (const [title, body, keyword] of [
    ['LiteLLM 投毒事件的后续思考', 'LiteLLM 的[官方事件说明](https://example.com/report)确认版本受影响。', 'LiteLLM'],
    ['DuckDB 2.0 值得关注的特性', 'DuckDB 发布 [2.0.0 LTS](https://example.com/report)，带来新的改进。', 'DuckDB'],
  ]) {
    const post = { ...article, title, body }
    const result = feed.feedLinkedBody(post)
    assert.ok(result.startsWith(`[${keyword}](https://example.com/report)`))
    assert.equal([...result.matchAll(/\]\(https:/g)].length, 1)
    assert.equal(feed.feedLinkedBody({ ...post, body: result }), result)
  }
})

test('正文没有可链接实体时，来源仍并入最后一句', () => {
  const post = {
    title: 'Update',
    body: '这是一条值得关注的更新。\n\n来源：[Original report](https://example.com/report)',
    sources: [{ title: 'Original report', url: 'https://example.com/report' }],
  }
  assert.equal(feed.feedLinkedBody(post), '这是一条值得关注的更新，详见 [Original report](https://example.com/report)。')
})

test('讨论携带生成当时的理由及来源，历史记录不补造个性化依据', () => {
  const text = feed.feedDiscussion({ ...article, recommendationReason: '你正在检查项目依赖。' }, true)
  assert.match(text, /你正在检查项目依赖/)
  assert.match(text, /https:\/\/example.com\/report/)
  assert.doesNotMatch(feed.feedDiscussion(article, true), /为你创建的理由/)
})

test('元数据兼容属性顺序、相对地址和实体编码，忽略脚本伪标签与小图标', () => {
  const html = '<script>"<meta property="og:image" content="https://evil.example/a">"</script><!-- <img src="ignored.png"> --><meta content="/cover.png?a=1&amp;b=2" property="og:image"><meta name="twitter:image" content="https://cdn.example.com/photo.webp"><img src="/icon.png" width="24"><img data-src="/article.jpg" width="640">'
  assert.deepEqual(media.feedPageImages(html, 'https://example.com/story'), ['https://example.com/cover.png?a=1&b=2', 'https://cdn.example.com/photo.webp', 'https://example.com/article.jpg'])
})

test('公网目标拒绝本机、私网、IPv4 映射、保留段和混合 DNS 回答', async () => {
  for (const address of ['127.0.0.1', '10.0.0.1', '172.16.1.1', '192.168.1.1', '169.254.169.254', '100.64.0.1', '192.0.2.1', '198.18.0.1', '224.0.0.1', '::1', '::ffff:127.0.0.1', 'fd00::1', 'fe80::1', '2001:db8::1', '2002:7f00:1::']) assert.equal(media.publicFeedAddress(address), false, address)
  for (const address of ['93.184.216.34', '1.1.1.1', '2606:4700:4700::1111', '2001:4860:4860::8888']) assert.equal(media.publicFeedAddress(address), true, address)
  const publicOnly = async () => [{ address: '93.184.216.34', family: 4 }]
  for (const url of ['http://localhost/a', 'http://127.1/a', 'http://[::1]/a', 'http://2130706433/a', 'https://example.com:444/a', 'file:///tmp/a', 'https://u:p@example.com/a']) await assert.rejects(media.publicFeedTarget(url, publicOnly))
  await assert.rejects(media.publicFeedTarget('https://example.com/a', async () => [{ address: '93.184.216.34', family: 4 }, { address: '127.0.0.1', family: 4 }]))
  assert.equal((await media.publicFeedTarget('https://example.com/a', publicOnly)).address.address, '93.184.216.34')
})

function fakeTransport(replies, calls) {
  return (url, options, callback) => {
    calls.push(url.href)
    options.lookup(url.hostname, {}, (error, address) => { assert.ifError(error); assert.equal(address, '93.184.216.34') })
    const request = new EventEmitter()
    request.end = () => queueMicrotask(() => {
      const row = replies.shift()
      const response = Readable.from(row.chunks || [Buffer.from(row.body || '')])
      response.statusCode = row.status || 200
      response.headers = row.headers || { 'content-type': 'text/html' }
      callback(response)
    })
    return request
  }
}

test('连接固定到已检查的地址，重定向逐跳校验且不跟随私网地址', async () => {
  const calls = []
  const resolve = async () => [{ address: '93.184.216.34', family: 4 }]
  const reply = await media.readFeedUrl('https://example.com/a', 100, AbortSignal.timeout(1000), { resolve, request: fakeTransport([{ status: 302, headers: { location: '/b' } }, { body: 'article' }], calls) })
  assert.equal(reply.url, 'https://example.com/b')
  assert.equal(reply.bytes.toString(), 'article')
  assert.equal(calls.length, 2)
  const blocked = []
  await assert.rejects(media.readFeedUrl('https://example.com/a', 100, AbortSignal.timeout(1000), { resolve, request: fakeTransport([{ status: 302, headers: { location: 'http://169.254.169.254/latest' } }], blocked) }))
  assert.equal(blocked.length, 1)
})

test('流式响应严格限制实际字节，伪装为图片的 HTML 和 SVG 不被接纳', async () => {
  const options = { resolve: async () => [{ address: '93.184.216.34', family: 4 }], request: fakeTransport([{ chunks: [Buffer.alloc(8), Buffer.alloc(8)] }], []) }
  await assert.rejects(media.readFeedUrl('https://example.com/a', 12, AbortSignal.timeout(1000), options), /too_large/)
  assert.equal(media.feedImageType(Buffer.from('<svg><script/></svg>')), '')
  assert.equal(media.feedImageType(Buffer.from('<html>error</html>')), '')
  assert.equal(media.feedImageType(Buffer.from('89504e470d0a1a0a00000000', 'hex')), 'image/png')
})

test('同一动态只取图一次，失败缓存且全列表抓图并发不超过四个', async () => {
  let calls = 0, active = 0, highest = 0
  const cache = new media.FeedMedia(async () => {
    calls++; active++; highest = Math.max(highest, active)
    await new Promise(resolve => setTimeout(resolve, 10))
    active--
    return null
  })
  const post = { ...article, id: 'one' }
  await Promise.all([cache.get(post), cache.get(post), ...Array.from({ length: 7 }, (_, index) => cache.get({ ...post, id: `other-${index}` }))])
  await cache.get(post)
  assert.equal(calls, 8)
  assert.equal(highest, 4)
})

test('并发讨论复用同一创建请求，不同动态独立，失败后允许重试', async () => {
  const rooms = Object.create(Rooms.prototype)
  rooms.store = { lang: 'zh', feed: { posts: ['one', 'two', 'retry'].map(id => ({ ...article, id })) } }
  rooms.feedDiscussions = new Map()
  rooms.save = async () => undefined
  rooms.alive = async () => true
  let opens = 0
  rooms.open = async () => {
    const session = `discussion-${++opens}`
    await new Promise(resolve => setTimeout(resolve, 5))
    return session
  }
  const [first, duplicate, other] = await Promise.all([rooms.discuss('one'), rooms.discuss('one'), rooms.discuss('two')])
  assert.equal(opens, 2)
  assert.equal(first, duplicate)
  assert.notEqual(first, other)
  assert.equal(await rooms.discuss('one'), first)
  assert.equal(opens, 2)
  // 模拟尚未创建会话就失败，失败请求不能永久占用该动态的重试入口。
  rooms.open = async () => { throw Error('creation unavailable') }
  await assert.rejects(rooms.discuss('retry'), /creation unavailable/)
  rooms.open = async () => 'discussion-retried'
  assert.equal(await rooms.discuss('retry'), 'discussion-retried')
})

test('Feed 生成开始时间跨 Host 重启保存，避免未完成的批次立即重复', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'nanomuse-feed-retry-'))
  const previous = process.env.DSH_HOME
  process.env.DSH_HOME = directory
  try {
    const rooms = Object.create(Rooms.prototype)
    Object.defineProperty(rooms, 'ctx', { value: { logger: { info() {}, warn() {} } } })
    rooms.store = await rooms.read()
    rooms.store.feed.routine = { on: true, time: '08:00', ensuredAt: Date.now() - 86_400_000 }
    rooms.store.feed.generatedAt = 0
    rooms.writing = Promise.resolve()
    rooms.broadcast = () => undefined
    rooms.busy = { feed: false, ideas: false }
    rooms.feedPrompt = () => 'test prompt'
    rooms.run = async () => {
      const saved = JSON.parse(await readFile(join(directory, 'nanomuse', 'rooms.json'), 'utf8'))
      assert.ok(saved.feed.lastTry > 0, '开始模型调用前已持久化 lastTry')
      throw Error('simulated interrupted generation')
    }
    await assert.rejects(rooms.refreshFeed(), /simulated interrupted generation/)

    const restarted = Object.create(Rooms.prototype)
    Object.defineProperty(restarted, 'ctx', { value: { logger: { info() {}, warn() {} } } })
    restarted.store = await restarted.read()
    restarted.busy = { feed: false, ideas: false }
    restarted.syncReady = async () => true
    let repeated = 0
    restarted.refreshFeed = async () => { repeated++ }
    await restarted.tick()
    assert.equal(repeated, 0, '重启后的定时检查遵守已保存的失败重试间隔')
  } finally {
    if (previous === undefined) delete process.env.DSH_HOME
    else process.env.DSH_HOME = previous
    if (!directory.startsWith(join(tmpdir(), 'nanomuse-feed-retry-'))) throw Error('测试目录边界不匹配')
    await rm(directory, { recursive: true, force: true })
  }
})

test('新字段经过工具动态和后台批次保存，重读不丢失，旧记录继续可用', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'nanomuse-feed-contract-'))
  const previous = process.env.DSH_HOME
  process.env.DSH_HOME = directory
  try {
    const rooms = Object.create(Rooms.prototype)
    Object.defineProperty(rooms, 'ctx', { value: { logger: { info() {}, warn() {} } } })
    rooms.store = await rooms.read()
    rooms.store.lang = 'zh'
    rooms.writing = Promise.resolve()
    rooms.broadcast = () => undefined
    rooms.busy = { feed: false, ideas: false }
    rooms.feedDiscussions = new Map()
    rooms.context = () => 'The person explicitly follows dependency updates.'
    // 生成和持久化测试使用已核实的固定网页结果，禁止真实网络调用。
    rooms.readArticle = async source => ({ source, text: 'Verified article text. '.repeat(10), image: 'https://example.com/cover.png', imageSource: source.url, fetchedAt: 123 })
    const saved = await rooms.addPost({ ...article, recommendationReason: '你正在审查项目依赖。' })
    let disk = JSON.parse(await readFile(join(directory, 'nanomuse', 'rooms.json'), 'utf8'))
    assert.equal(disk.feed.posts[0].recommendationReason, '你正在审查项目依赖。')
    assert.equal(disk.feed.posts[0].sources[0].url, article.sources[0].url)
    assert.equal(disk.feed.posts[0].image, 'https://example.com/cover.png')
    assert.equal(disk.feed.posts[0].imageSource, article.sources[0].url)
    assert.equal(disk.feed.posts[0].fetchedAt, 123)
    const at = saved.at
    const readArticle = rooms.readArticle
    rooms.readArticle = async source => {
      // 抓图期间的点赞与讨论状态不能被修复请求的旧快照覆盖。
      rooms.store.feed.posts[0].liked = true
      rooms.store.feed.posts[0].sessionId = 'existing-discussion'
      return readArticle(source)
    }
    const repaired = await rooms.updatePost(saved.id, { body: 'Updated grounded summary.', sources: article.sources })
    assert.equal(repaired.at, at)
    assert.equal(repaired.liked, true)
    assert.equal(repaired.sessionId, 'existing-discussion')
    assert.equal(repaired.image, 'https://example.com/cover.png')
    await assert.rejects(rooms.updatePost(saved.id, { sources: [{ title: 'Internal', url: 'feed://post/fake' }] }), /HTTP/)
    rooms.readArticle = readArticle
    rooms.run = async () => JSON.stringify([{ title: 'New article', body: 'A grounded summary.', sources: article.sources, recommendationReason: '你的动态指令关注这个主题。' }])
    await rooms.refreshFeed()
    assert.equal((await rooms.read()).feed.posts[0].recommendationReason, '你的动态指令关注这个主题。')
    assert.equal((await rooms.read()).feed.posts[0].image, 'https://example.com/cover.png')
    const count = rooms.store.feed.posts.length
    rooms.run = async () => JSON.stringify([{ title: 'Internal link', body: '[详情](feed://post/fake)', recommendationReason: '你关注这个主题。' }])
    await assert.rejects(rooms.refreshFeed(), /real HTTP/)
    assert.equal(rooms.store.feed.posts.length, count)
    rooms.run = async () => JSON.stringify([{ title: 'No reason', body: 'No basis.' }])
    await assert.rejects(rooms.refreshFeed(), /specific reason/)
    assert.equal(rooms.store.feed.posts.some(post => post.title === 'No reason'), false)
    let context = ''
    rooms.open = async (_title, text) => { context = text; return 'discussion-session' }
    // 后面的讨论上下文检查需要走首次创建路径。
    delete rooms.store.feed.posts.find(post => post.id === saved.id).sessionId
    await rooms.discuss(saved.id)
    assert.match(context, /你正在审查项目依赖/)
    assert.match(context, /https:\/\/example.com\/report/)
    disk = JSON.parse(await readFile(join(directory, 'nanomuse', 'rooms.json'), 'utf8'))
    disk.feed.posts = [{ id: 'legacy', title: 'Old post', body: '[Old source](https://example.com/old)', image: '', at: 1, liked: false }]
    await writeFile(join(directory, 'nanomuse', 'rooms.json'), JSON.stringify(disk))
    const legacy = (await rooms.read()).feed.posts[0]
    assert.equal(feed.feedSources(legacy)[0].url, 'https://example.com/old')
    assert.equal(legacy.recommendationReason, undefined)
    assert.equal(parseFeedDraft(JSON.stringify({ title: 'Fence post', body: article.body, recommendationReason: '你提出了这个要求。', sources: article.sources })).recommendationReason, '你提出了这个要求。')
  } finally {
    if (previous === undefined) delete process.env.DSH_HOME
    else process.env.DSH_HOME = previous
    // 只清理本测试创建的临时目录，不接触真实运行数据。
    if (!directory.startsWith(join(tmpdir(), 'nanomuse-feed-contract-'))) throw Error('测试目录边界不匹配')
    await rm(directory, { recursive: true, force: true })
  }
})

test('先读取真实网页和验证配图，再保存可追溯的来源、图片地址和抓取时间', async () => {
  const source = { title: 'Actual article', url: 'https://example.com/report' }
  const body = feed.feedArticleBody('[原文](https://example.com/report) [伪链接](feed://post/fake) ![猜图](https://unseen.example/fake.png)', source)
  assert.match(body, /\[原文\]\(https:\/\/example.com\/report\)/)
  assert.doesNotMatch(body, /feed:\/\/|unseen.example/)
  const calls = []
  const read = async (url, _limit, _signal, options) => {
    calls.push({ url, referer: options?.referer })
    if (url === 'https://example.com/report') return {
      url, headers: { 'content-type': 'text/html' },
      bytes: Buffer.from('<title>Actual article</title><meta property="og:image" content="/real.png"><main>' + 'Actual verified text. '.repeat(10) + '</main>'),
    }
    assert.equal(url, 'https://example.com/real.png')
    return { url, headers: { 'content-type': 'image/png' }, bytes: Buffer.from('89504e470d0a1a0a', 'hex') }
  }
  const result = await media.readFeedArticle({ title: 'Guessed title', url: 'https://example.com/report' }, read)
  assert.equal(result.source.title, 'Actual article')
  assert.equal(result.image, 'https://example.com/real.png')
  assert.equal(result.imageSource, result.source.url)
  assert.ok(result.fetchedAt > 0)
  assert.equal(calls[1].referer, result.source.url)
  await assert.rejects(media.readFeedArticle({ title: 'Error page', url: 'https://example.com/bad' }, async url => ({ url, headers: { 'content-type': 'text/html' }, bytes: Buffer.from('<title>Denied</title>') })), /no_article_text/)
})
