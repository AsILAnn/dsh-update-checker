import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/** 构建戳：插件版本 + 构建时间，注入客户端（__DUC_BUILD__），用于辨认服务器实际下发的产物 */
const PKG_VERSION = (() => {
  for (const p of [join(process.cwd(), 'package.json'), 'package.json']) {
    try { return String(JSON.parse(readFileSync(p, 'utf8')).version || '0.0.0') } catch { }
  }
  return '0.0.0'
})()
const pad2 = (n: number) => String(n).padStart(2, '0')
const _bd = new Date()
const BUILD_STAMP = PKG_VERSION + '+' + _bd.getFullYear() + pad2(_bd.getMonth() + 1) + pad2(_bd.getDate()) + '-' + pad2(_bd.getHours()) + pad2(_bd.getMinutes())

const PLUGIN_ID = '@dsh-external/dsh-update-checker'

const CLIENT_EXTERNALS = [
  'react', 'react/jsx-runtime', 'react-dom', 'react-dom/client',
  'cordis',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-runtime/client',
]

// 宿主自包含打包：把所有非 node: 依赖打进来，任意装配路径都能加载 host 逻辑。
const hostBundle = {
  entry: { index: 'src/index.ts' },
  outDir: 'lib',
  format: 'esm',
  platform: 'node',
  dts: false,
  sourcemap: true,
  clean: false,
  deps: {
    alwaysBundle: (id) => !id.startsWith('node:'),
  },
  outputOptions: {
    entryFileNames: 'index.js',
  },
}

// client 浏览器端：window.__ModuleLoader__ 包装，由 dsh-client-modules 提供到 /plugins/<id>/client.js
const clientBundle = {
  entry: { client: 'src/client/index.ts' },
  outDir: 'lib',
  format: 'cjs',
  platform: 'browser',
  dts: false,
  sourcemap: true,
  clean: false,
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'production'),
    '__DUC_BUILD__': JSON.stringify(BUILD_STAMP),
  },
  deps: {
    neverBundle: [...CLIENT_EXTERNALS],
    alwaysBundle: (id) => !CLIENT_EXTERNALS.includes(id),
  },
  outputOptions: {
    entryFileNames: 'client.js',
    banner: 'window.__ModuleLoader__.load({ id: ' + JSON.stringify(PLUGIN_ID) + ', factory: (require) => {',
    footer: 'return module.exports; } });',
    intro: 'var module = { exports: {} }; var exports = module.exports;',
    codeSplitting: false,
  },
}

export default [hostBundle, clientBundle]