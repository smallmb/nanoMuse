import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve, sep } from 'node:path'
import Rooms from '../lib/rooms.js'

// 所有磁盘故障均在独立临时目录模拟，不接触用户账号和开发数据。
async function isolated(run) {
  const directory = await mkdtemp(join(tmpdir(), 'nanomuse-storage-'))
  const previous = process.env.DSH_HOME
  process.env.DSH_HOME = directory
  try {
    const rooms = Object.create(Rooms.prototype)
    Object.defineProperty(rooms, 'ctx', { value: { logger: { warn() {} } } })
    rooms.store = await rooms.read()
    rooms.writing = Promise.resolve()
    rooms.writingFirstRun = Promise.resolve()
    rooms.writingNudges = Promise.resolve()
    rooms.firstRun = { done: false }
    rooms.nudges = { policy: {}, fetchedAt: 0, ledger: {}, current: null }
    let broadcasts = 0
    rooms.broadcast = () => { broadcasts++ }
    await run(rooms, directory, () => broadcasts)
  } finally {
    if (previous === undefined) delete process.env.DSH_HOME
    else process.env.DSH_HOME = previous
    const target = resolve(directory)
    if (!target.startsWith(resolve(tmpdir()) + sep + 'nanomuse-storage-')) throw Error('测试目录边界不匹配')
    await rm(target, { recursive: true, force: true })
  }
}

test('保存失败传给调用方，不广播成功，故障解除后队列仍可写入', async () => {
  await isolated(async (rooms, directory, broadcasts) => {
    const folder = join(directory, 'nanomuse')
    await writeFile(folder, '阻止创建数据目录')
    rooms.store.lang = 'zh'
    await assert.rejects(rooms.save())
    assert.equal(broadcasts(), 0)
    await rm(folder)
    await rooms.save()
    assert.equal(JSON.parse(await readFile(join(folder, 'rooms.json'), 'utf8')).lang, 'zh')
    assert.equal(broadcasts(), 1)
    // 多个调用连续排队后，磁盘保留最后一次修改。
    rooms.store.lang = 'en'
    const earlier = rooms.save()
    rooms.store.lang = 'zh-CN'
    await Promise.all([earlier, rooms.save()])
    assert.equal(JSON.parse(await readFile(join(folder, 'rooms.json'), 'utf8')).lang, 'zh-CN')
  })
})

test('损坏或不可读的房间数据不会初始化为空，原文件保持原样', async () => {
  await isolated(async (rooms, directory) => {
    const file = join(directory, 'nanomuse', 'rooms.json')
    await mkdir(join(directory, 'nanomuse'))
    for (const broken of ['{broken', 'null', '[]']) {
      await writeFile(file, broken)
      await assert.rejects(rooms.read())
      assert.equal(await readFile(file, 'utf8'), broken)
    }
    await rm(file)
    await mkdir(file)
    await assert.rejects(rooms.read())
  })
})

test('引导与提示状态的保存失败可重试，损坏的小文件不会当成不存在', async () => {
  await isolated(async (rooms, directory, broadcasts) => {
    const write = rooms.writeSmall
    rooms.writeSmall = async () => { throw Error('模拟磁盘不可写') }
    await assert.rejects(rooms.saveFirstRun(), /模拟磁盘不可写/)
    await assert.rejects(rooms.saveNudges(), /模拟磁盘不可写/)
    assert.equal(broadcasts(), 0)
    rooms.writeSmall = write
    await rooms.saveFirstRun()
    await rooms.saveNudges()
    assert.equal(broadcasts(), 2)
    const file = join(directory, 'nanomuse', 'firstrun.json')
    await writeFile(file, '{broken')
    await assert.rejects(rooms.readSmall(file, value => value))
    assert.equal(await readFile(file, 'utf8'), '{broken')
  })
})
