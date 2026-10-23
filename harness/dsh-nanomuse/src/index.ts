/**
 * 提供桌面插件宿主端能力，并为浏览器界面提供默认 Hatch 形象、账号头像和状态视频。
 * 默认静态图及状态视频位于 `assets/`，通过 `/nanomuse/assets/<file>` 提供。
 * 手机绘制并同步到账户的头像从 `$DSH_HOME/nanomuse/faces/` 读取，图片通过
 * `/nanomuse/assets/face/<id>/<mood>.webp` 提供，也支持同目录下的头像视频。
 * 云端服务由 `dsh-nanomuse/cloud` 插件提供，头像文件由它的资料存储管理。
 */
import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { getDefaultAutoSelectFamilyAttemptTimeout, setDefaultAutoSelectFamilyAttemptTimeout } from 'node:net'
import { basename, join } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-host-webserver'
import { mountGuarded } from './admit.ts'
import { packageAssetsDir } from './profile.ts'
import type {} from './cloud.ts'
import { MOTION_PREFIX, serveClip } from './motion.ts'

export const name = 'nanomuse'

/** Where the browser asks for the stills. */
export const ASSETS_PREFIX = '/nanomuse/assets'

const ASSETS_DIR = packageAssetsDir(import.meta.url)
const TYPES: Record<string, string> = {
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4',
}
const FACE = /^\/face\/([a-f0-9]{6,40})\/([a-z]+)\.(webp|mp4)$/

/**
 * Node tries each address of a host for 250 ms before moving to the next (happy
 * eyeballs); a server 300 ms away — most of them, from here — then never
 * connects and `fetch` says ETIMEDOUT within the second. A second and a half per
 * attempt is still quick to fall back and lets far servers answer. Process-wide,
 * for the relay, the connectors and anything else in this harness that fetches.
 */
const CONNECT_ATTEMPT_MS = 1500

export function apply(ctx: Context): void {
  if (getDefaultAutoSelectFamilyAttemptTimeout() < CONNECT_ATTEMPT_MS) setDefaultAutoSelectFamilyAttemptTimeout(CONNECT_ATTEMPT_MS)
  const handler = (req: IncomingMessage, res: ServerResponse) => serveAsset(req, res, (id, mood, ext) => ctx.get('nanomuseCloud')?.profile.stillPath(id, mood, ext))
  mountGuarded(ctx, ASSETS_PREFIX, handler, 'nanomuse: assets')
  // The clips of a drawn face, made on this computer (`motion.ts`): `/nanomuse/avatar/motion/<mood>.mp4?v=<mtime>`;
  // and the person's own clip (`own-clip.ts`): `/nanomuse/avatar/own-clip.mp4?v=<mtime>`, its first frame, the preview copy.
  mountGuarded(ctx, MOTION_PREFIX, (req, res) => serveClip(req, res, (mood) => ctx.get('nanomuseCloud')?.motion.clipPath(mood), (name) => ctx.get('nanomuseCloud')?.ownClip.path(name)), 'nanomuse: avatar clips')
}

/** One file from `assets/` by its base name, or a still of the account's face; anything else is 404. */
export async function serveAsset(req: IncomingMessage, res: ServerResponse, facePath?: (id: string, mood: string, ext: 'webp' | 'mp4') => string | undefined): Promise<void> {
  const url = new URL(req.url ?? '/', 'http://127.0.0.1')
  const rel = url.pathname.slice(ASSETS_PREFIX.length)
  if (req.method !== 'GET' && req.method !== 'HEAD') return notFound(res)
  const face = FACE.exec(rel)
  let path: string | undefined
  let type: string | undefined
  if (face) {
    const ext = face[3] === 'mp4' ? 'mp4' : 'webp'
    path = facePath?.(face[1] ?? '', face[2] ?? '', ext)
    type = TYPES[`.${ext}`]
  } else {
    const file = basename(url.pathname)
    const ext = file.slice(file.lastIndexOf('.'))
    type = TYPES[ext]
    if (type && file === rel.slice(1)) path = join(ASSETS_DIR, file)
  }
  if (!path || !type) return notFound(res)
  let size: number
  try {
    size = (await stat(path)).size
  } catch {
    return notFound(res)
  }
  res.writeHead(200, { 'content-type': type, 'content-length': size, 'cache-control': face ? 'public, max-age=3600' : 'public, max-age=86400' })
  if (req.method === 'HEAD') {
    res.end()
    return
  }
  createReadStream(path).pipe(res)
}

function notFound(res: ServerResponse): void {
  res.writeHead(404, { 'cache-control': 'no-store' }).end()
}
