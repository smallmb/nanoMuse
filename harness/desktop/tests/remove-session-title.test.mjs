import assert from 'node:assert/strict';
import { test } from 'node:test';
import { removeSessionTitle } from '../scripts/remove-session-title.mjs';

// 用宿主生成代码的边界验证只删名称，其他入口与页签保留。
const source = `const ancestry = useSessions((s) => deriveAncestry(s, sessionId), equalBreadcrumbs);
const header = { children: [(0, react_jsx_runtime.jsxs)("div", {
className: ConversationRoot_module_css_default.titleCluster,
children: ancestry.map(summary => summary.displayTitle)
}), (0, react_jsx_runtime.jsx)("div", {
className: ConversationRoot_module_css_default.headerUtilities,
children: renderSlot("conversation.session.header.utilities", {})
}), corner, showTabs && tabs.map(viewTab => viewTab.label)] };
const sidebarTitle = session.displayTitle;`;

test('删除顶部名称渲染，保留侧边栏名称、操作入口和页签', () => {
  const result = removeSessionTitle(source);
  assert.doesNotMatch(result, /titleCluster|const ancestry|summary.displayTitle/);
  assert.match(result, /sidebarTitle = session.displayTitle/);
  assert.match(result, /headerUtilities/);
  assert.match(result, /corner, showTabs && tabs.map/);
});

test('构建补丁可重复执行，宿主结构变化时明确拒绝', () => {
  const result = removeSessionTitle(source);
  assert.equal(removeSessionTitle(result), result);
  assert.throws(() => removeSessionTitle('changed host structure'), /结构已变化/);
  assert.throws(() => removeSessionTitle(source + source), /结构已变化/);
});
