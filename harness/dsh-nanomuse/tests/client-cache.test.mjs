import assert from 'node:assert/strict'
import { test } from 'node:test'
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'

// 用最小订阅适配器测试真实缓存模块，不启动浏览器或访问账号接口。
for (const [name, hook] of [['rooms', 'useRooms'], ['live', 'useLive']]) {
  test(`${name} 快速切页复用连接，离开后释放，再进入保留快照并重连`, async t => {
    const result = await build({
      entryPoints: [fileURLToPath(new URL(`../src/client/${name}.ts`, import.meta.url))],
      bundle: true, write: false, format: 'esm', platform: 'node',
      plugins: [{ name: 'react-test', setup(build) {
        build.onResolve({ filter: /^react$/ }, () => ({ path: 'react', namespace: 'test' }))
        build.onLoad({ filter: /.*/, namespace: 'test' }, () => ({ contents: 'export function useSyncExternalStore(subscribe, get) { globalThis.cacheSubscribe = subscribe; return get() }' }))
      } }],
    })
    const previous = { EventSource: globalThis.EventSource, subscribe: globalThis.cacheSubscribe }
    const connections = []
    globalThis.EventSource = class {
      closed = false
      constructor() { connections.push(this) }
      close() { this.closed = true }
    }
    t.after(() => {
      globalThis.EventSource = previous.EventSource
      globalThis.cacheSubscribe = previous.subscribe
    })
    const module = await import('data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].contents).toString('base64'))
    module[hook]()
    const subscribe = globalThis.cacheSubscribe
    t.mock.timers.enable({ apis: ['setTimeout'] })
    const off = subscribe(() => {})
    assert.equal(connections.length, 1)
    connections[0].onmessage({ data: JSON.stringify({ lang: '', ready: true }) })
    off()
    t.mock.timers.tick(500)
    const again = subscribe(() => {})
    t.mock.timers.tick(1000)
    assert.equal(connections.length, 1)
    assert.equal(connections[0].closed, false)
    assert.equal(module[hook]().ready, true)
    again()
    t.mock.timers.tick(1000)
    assert.equal(connections[0].closed, true)
    assert.equal(module[hook]().ready, true)
    const final = subscribe(() => {})
    assert.equal(connections.length, 2)
    final()
    t.mock.timers.tick(1000)
  })
}
