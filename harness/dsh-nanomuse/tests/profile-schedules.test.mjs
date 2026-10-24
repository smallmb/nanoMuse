import assert from 'node:assert/strict'
import { test } from 'node:test'
import Rooms from '../lib/rooms.js'

test('助手计划包含非目标任务，只展示启用项，目录变化会推送', async () => {
  let rows = [
    { id: 'feed', title: 'Feed', kind: 'daily', time: '08:00:00', scheduledAt: '2026-10-25T00:00:00Z', status: 'active' },
    { id: 'stopped', title: 'Stopped', kind: 'every', everySeconds: 60, scheduledAt: '', status: 'inactive' },
  ]
  const rooms = Object.create(Rooms.prototype)
  // 使用内存调度目录，测试不会创建、修改或删除实际计划。
  Object.defineProperty(rooms, 'ctx', { value: { get: () => ({ catalog: async () => rows }) } })
  rooms.store = { goals: [] }
  rooms.automations = {}
  let pushed = 0
  rooms.broadcast = () => { pushed++ }
  await rooms.refreshAutomations()
  assert.deepEqual(rooms.scheduled.map(row => [row.id, row.rule]), [['feed', 'daily@08:00']])
  assert.equal(pushed, 1)
  await rooms.refreshAutomations()
  assert.equal(pushed, 1)
  rows = []
  await rooms.refreshAutomations()
  assert.deepEqual(rooms.scheduled, [])
  assert.equal(pushed, 2)
})
