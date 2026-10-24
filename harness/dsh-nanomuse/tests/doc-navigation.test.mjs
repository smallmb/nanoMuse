import assert from 'node:assert/strict'
import { test } from 'node:test'
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'

test('文档按钮切换会话分栏时保留文档，关闭编辑器清除分栏状态', async () => {
  // 在内存加载导航状态，不访问真实文档、账号或会话数据。
  const result = await build({ stdin: {
    contents: "export { win, peekWin, clampDocChatWidth } from './win.ts'; export { profileBus } from './bus.ts'",
    resolveDir: fileURLToPath(new URL('../src/client/', import.meta.url)),
  }, bundle: true, write: false, format: 'esm', platform: 'node' })
  const { win, peekWin, profileBus, clampDocChatWidth } = await import('data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].contents).toString('base64'))
  // 拖出边界时仍限制在窄栏与平分之间，小窗口不产生负宽度或溢出。
  assert.equal(clampDocChatWidth(100, 1800), 430)
  assert.equal(clampDocChatWidth(2000, 1800), 900)
  assert.equal(clampDocChatWidth(600, 1800), 600)
  assert.equal(clampDocChatWidth(430, 700), 350)
  assert.equal(clampDocChatWidth(430, 0), 0)
  profileBus.open()
  win.split('nanomuse-feed')
  const doc = { kind: 'own', doc: 'identity' }
  win.openDoc(doc)
  assert.equal(profileBus.isOpen(), false)
  assert.equal(peekWin().split, null)
  assert.equal(peekWin().editorChat, false)
  win.docChat(true)
  assert.equal(peekWin().editor, doc)
  assert.equal(peekWin().editorChat, true)
  win.docChat(false)
  assert.equal(peekWin().editor, doc)
  win.openDoc(null)
  assert.equal(peekWin().editor, null)
  assert.equal(peekWin().editorChat, false)
})
