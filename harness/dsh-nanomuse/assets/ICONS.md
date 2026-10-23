# 共用图标库

已将用户提供的 `assets/ideas/icons-legacy` 中全部 76 个 PNG 原样纳入本项目，总大小 75,325 字节。文件内容已逐个通过 SHA-256 校验。

文件统一保存在本目录，命名为 `icons-legacy-原文件名.png`，例如 `icons-legacy-speechBubble.png`、`icons-legacy-search.png`、`icons-legacy-calendar.png`。统一前缀可避免与其他资源重名，也直接兼容现有静态资源路由。

桌面页面通过 `/nanomuse/assets/icons-legacy-原文件名.png` 使用。侧栏、设置、目标、资源库、点子、设备和聊天工具栏共用同一套资源，无需访问原 Muse 目录。插件打包配置已包含整个 `assets` 目录。

`src/client/icons.tsx` 保留原有 `IconSearch`、`IconCalendar` 等组件入口，有对应资源的 37 个普通组件及空心喜欢状态已改为本地图标。新增页面可复用这些组件，或使用 `IconAsset` 指定库中的其他名称。图标保留 `size` 和 `className` 参数，并继承所在控件的颜色；`--nm-icon-size` 可在场景容器内统一尺寸。

场景规格：主侧栏保留 44px 按钮和 54px 中心间距；普通工具按钮为 36px、内部图标 20px；紧凑按钮为 28px、图标 16px；菜单和动态操作图标为 18px；设置和资源库导航图标为 20px、文字间距 12px、行高至少 40px；点子列表图标 24px、详情图标 40px。这些页面沿用同一视觉体系，未提供其他 Muse 页面的截图，不声明逐像素一致。

点子列表按稳定编号映射共用图标，新增未映射点子暂用灯泡。箭头、关闭、加载、权限盾牌等库中没有准确对应项的图标保留矢量版本；喜欢的实心状态和加载动画也继续保留。

推荐以透明遮罩继承文字颜色，保持明暗主题和选中状态一致：

```css
/* 用原始图标的透明轮廓显示当前文字颜色。 */
.calendar-icon {
  display: inline-block;
  width: 24px;
  height: 24px;
  background: currentColor;
  mask: url('/nanomuse/assets/icons-legacy-calendar.png') center / contain no-repeat;
}
```

目标的圆角勾选框与资源库的四图形在这 76 个位图中没有对应项，仍使用 `src/client/icons.tsx` 中的矢量组件。
