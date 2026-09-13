# dsh-update-checker

dsh (DeepSeek Harness) 桌面版插件：在设置页检查并一键更新 dsh 官方版本。

## 功能

- 对比本地安装版本与 npm 上 `@deepseek-ai/dsh` 官方版本（latest / next）
- 从 GitHub Releases 自动拉取更新日志（中文要点）
- 一键更新：点击「立即更新」后台执行 `npm i -g @deepseek-ai/dsh@latest`
- 更新过程带动画：阶段标签 + 44px 读数 + 1px 进度线 + 已用/剩余时间
- 更新完成后提示手动重启 dsh（插件不会自行杀进程重启，避免服务崩溃循环）

## 检查中的反馈

检查动画（底部扫动卡）已移除：实机使用中它出现在页面底部，看起来像多余的浮动条在闪。检查反馈收敛到按钮本身——「检查中…」+ 转圈，结果最少展示 1.5s 后 RiseIn 登场。

## 更新动画

设计方向是「**精确克制**」：不做卡片、不用彩色发光与装饰性渐变，靠留白、字号与灰度层次说话。一屏只保留四件事——阶段 / 读数 / 进度 / 时间。全部由内联样式 + 一段注入的 `ANIM_CSS` 实现，无额外依赖。

| 部分 | 做法 |
| --- | --- |
| 阶段 | 11px、`letter-spacing: 0.1em`，唯一的文字标签 |
| 读数 | 44px `font-weight:500` + 16px `%`；等宽数字，变化时 200ms `dshUpdRiseIn`（3px 位移 + 淡入，不弹跳、不缩放） |
| 进度 | **1px** 硬线，填充跟随主题文字色（不自己发明强调色）；宽度 500ms `cubic-bezier(.4,0,.2,1)` |
| 时间 | 12px「已用 N 秒」+ 右侧「约剩 N 秒」 |
| 层次 | 三级灰度（主 / 0.56 / 0.32），通过 `color-mix` 跟随 `var(--theme-text)`，亮色主题下自动变深 |
| 收尾 | 同一套语言：`已完成` + `100%` 白线 / `已失败` + `!` 红线 |
| 容器 | 没有卡片底色，只有上下两条 1px `var(--theme-border)` 分隔线，`padding: 24px 0` |
| 状态恢复 | 刷新页面或切换设置页后，挂载时自动接续进行中的更新动画 |
| `Spinner` | 「检查中 / 立即更新」按钮上的旋转圈 |

规则（写在源码注释里，改动时别破坏）：① 层次用三级灰度而不是一堆 opacity；② 字号只留 13/12 + 44 三级；③ 间距走 8 的倍数；④ 不用彩色发光 / 装饰性渐变 / 假高光；⑤ 动效只做 opacity 与位置、约 200ms；⑥ 元素能删就删。

同屏对比与另一个方向（A 融入宿主）见 `preview-styles.html`（支持 `#native` `#precise` `#all`）。

想看「真机外观」而不重启 dsh：`render-preview.html` 由 `scripts/render-preview.cjs` 从构建产物 `lib/client.js` 直接渲染（用的就是插件内部的 `UpdatingCard / ResultCard` 与同一份 `ANIM_CSS`），含 8% / 38% / 77% / 81% / 完成 / 失败 六个示例帧；截图在 `previews/` 下。

## 安装

```bash
dsh plugin --profile web add ./path/to/dsh-external-dsh-update-checker-0.3.0.tgz
```

或从源码构建：

```bash
git clone https://github.com/AsILAnn/dsh-update-checker.git
cd dsh-update-checker
npm install
npm run build:client
npm pack
dsh plugin --profile web add ./dsh-external-dsh-update-checker-0.3.0.tgz
```

## 技术栈

- **Host**：Node.js + Cordis 插件（注册 webServer 路由）
- **Client**：React + slots（`settings.section` 插槽）
- **构建**：tsdown（host: ESM 自包含，client: CJS + `window.__ModuleLoader__` 包装）

## dsh 插件开发注意事项

开发 dsh client UI 插件时，必须遵守以下规则（实测实锤）：

1. **组件必须作为 `register` 的第二参数**：`ctx.slots.register({...options}, Comp)`，不要写在 `options.component` 字段里
2. **React 必须用 namespace import**：`import * as React from 'react'`，编译成 `react.createElement` 直接调用。不要用 `import React from 'react'`（default import 会编译成 `react.default.createElement`，而 dsh 运行时的 react 没有 default 层）
3. **component 要返回 React 元素**，不要用裸 DOM `{ render() {} }` 形式

## License

MIT

## 已知问题排查记录（2026-09）

- 浅色主题下发糊：样式曾依赖不存在的 --theme-text 变量（#eee 兜底），已全部切换到 dsh 设计系统变量（--dsw-alias-*）。
- 重启后徽章/时间消失：status 初始化漏改（useState(null)），已改为 cacheStatus。
- 打开页面自动检查：已彻底移除。页面只显示 localStorage 里的上次结果，检查仅由按钮触发。
- "上次检查"持久化：applyCheck 时写入 localStorage（dsh-update-check:last），模块加载时恢复。
