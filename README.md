# dsh-update-checker

dsh (DeepSeek Harness) 桌面版插件：在设置页检查并一键更新 dsh 官方版本。

## 功能

- 对比本地安装版本与 npm 上 `@deepseek-ai/dsh` 官方版本（latest / next）
- 从 GitHub Releases 自动拉取更新日志（中文要点）
- 一键更新：点击「立即更新」自动执行 `npm i -g @deepseek-ai/dsh@latest`
- 更新完成后自动重启 dsh，无需手动操作

## 安装

```bash
dsh plugin --profile web add ./path/to/dsh-external-dsh-update-checker-0.1.0.tgz
```

或从源码构建：

```bash
git clone https://github.com/AsILAnn/dsh-update-checker.git
cd dsh-update-checker
npm install
npm run build:client
npm pack
dsh plugin --profile web add ./dsh-external-dsh-update-checker-0.1.0.tgz
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
