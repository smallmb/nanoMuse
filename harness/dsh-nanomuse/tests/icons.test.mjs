import assert from 'node:assert/strict'
import { before, test } from 'node:test'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import { renderToStaticMarkup } from 'react-dom/server'

let icons
before(async () => {
  // 直接编译真实图标模块，验证所有页面依赖的公共入口。
  const result = await build({
    entryPoints: [fileURLToPath(new URL('../src/client/icons.tsx', import.meta.url))],
    bundle: true, write: false, format: 'esm', platform: 'node',
    define: { 'process.env.NODE_ENV': '"production"' },
  })
  icons = await import('data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].contents).toString('base64'))
})

test('公共图标保持尺寸、颜色接口及无障碍属性，所有引用的共用资源均已打包', () => {
  const used = new Set()
  for (const [name, component] of Object.entries(icons)) {
    if (name === 'IconAsset') continue
    const html = renderToStaticMarkup(component({ size: 32, className: 'custom-icon' }))
    assert.match(html, /aria-hidden="true"/, name)
    assert.match(html, /class="nm-icon[^\"]*custom-icon"/, name)
    assert.match(html, /--nm-icon-size, 32px/, name)
    const asset = html.match(/icons-legacy-([A-Za-z0-9]+)\.png/)?.[1]
    if (asset) {
      used.add(asset)
      assert.ok(existsSync(new URL(`../assets/icons-legacy-${asset}.png`, import.meta.url)), name)
    }
  }
  for (const asset of ['speechBubble', 'search', 'calendar', 'laptopPhone', 'microphone', 'folder', 'newspaper', 'lightbulb', 'heart', 'image', 'article', 'globe']) {
    assert.ok(used.has(asset), `缺少共用图标：${asset}`)
  }
})

test('喜欢的两种状态和加载、展开控件保留原有表达能力', () => {
  const empty = renderToStaticMarkup(icons.IconHeart({ size: 18 }))
  const filled = renderToStaticMarkup(icons.IconHeart({ size: 18, filled: true }))
  assert.match(empty, /data-icon="heart"/)
  assert.match(filled, /fill="currentColor"/)
  assert.doesNotMatch(filled, /icons-legacy-/)
  assert.match(renderToStaticMarkup(icons.IconSpinner({})), /class="nm-spin"/)
  assert.match(renderToStaticMarkup(icons.IconChevronRight({})), /<svg/)
})
