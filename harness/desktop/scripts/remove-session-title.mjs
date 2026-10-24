import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const marker = '/* nanoMuse：会话名称仅由侧边栏渲染。 */';

// 只移除宿主顶部的名称区域，不触碰侧边栏、头像、工具入口或页签。
export function removeSessionTitle(source) {
  if (source.includes(marker)) return source;
  const title = /\(0, react_jsx_runtime\.jsxs\)\("div", \{\s*className: ConversationRoot_module_css_default\.titleCluster,[\s\S]*?\}\), (?=\(0, react_jsx_runtime\.jsx\)\("div", \{\s*className: ConversationRoot_module_css_default\.headerUtilities)/g;
  const matches = [...source.matchAll(title)];
  if (matches.length !== 1) throw new Error('DSH 会话顶部结构已变化，停止移除名称，避免误改其他区域。');
  return source.replace(title, marker).replace(/^\s*const ancestry = useSessions\(\(s\) => deriveAncestry\(s, sessionId\), equalBreadcrumbs\);\r?\n/m, '\n');
}

export function patchConversationHeader(root) {
  const path = join(root, 'node_modules/@deepseek-ai/dsh-client-ui-conversation/lib/client.js');
  const source = readFileSync(path, 'utf8');
  const patched = removeSessionTitle(source);
  if (source !== patched) writeFileSync(path, patched);
}

// 开发启动与打包准备共用同一补丁入口，依赖重新安装后仍会生效。
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  patchConversationHeader(resolve(process.argv[2] || 'dsh'));
}
