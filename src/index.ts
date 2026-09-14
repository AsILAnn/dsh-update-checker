import { readFileSync, statSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import type { Context } from 'cordis'
export const name = 'dsh-update-checker'
export const inject = ['webServer']
const DSH_PKG = join('C:', 'Users', 's', 'AppData', 'Roaming', 'npm', 'node_modules', '@deepseek-ai', 'dsh', 'package.json')
const DIST_TAGS_URL = 'https://registry.npmjs.org/-/package/@deepseek-ai/dsh/dist-tags'
const METADATA_URL = 'https://registry.npmjs.org/@deepseek-ai/dsh'
function compare(a: unknown, b: unknown): number {
  const m = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/.exec(String(a ?? '').trim())
  const n = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/.exec(String(b ?? '').trim())
  if (!m || !n) return 0
  const A = [Number(m[1]), Number(m[2]), Number(m[3])]
  const B = [Number(n[1]), Number(n[2]), Number(n[3])]
  for (let i = 0; i < 3; i++) if (A[i] !== B[i]) return A[i] < B[i] ? -1 : 1
  const ap = m[4] ? m[4].split('.') : null
  const bp = n[4] ? n[4].split('.') : null
  if (!ap && !bp) return 0
  if (!ap) return 1
  if (!bp) return -1
  const len = Math.max(ap.length, bp.length)
  for (let i = 0; i < len; i++) { const x = ap[i], y = bp[i]; if (x === undefined) return -1; if (y === undefined) return 1; if (x === y) continue; const nx = /^\d+$/.test(x), ny = /^\d+$/.test(y); if (nx && ny) { if (+x !== +y) return +x < +y ? -1 : 1; continue } if (nx) return -1; if (ny) return 1; if (x < y) return -1; return 1 }
  return 0
}
function readLocalVersion(): string | null { try { const pkg = JSON.parse(readFileSync(DSH_PKG, 'utf8')); return pkg && typeof pkg.version === 'string' ? pkg.version : null } catch { return null } }
interface DistTags { latest?: string; next?: string }
async function fetchDistTags(): Promise<{ latest: string | null; next: string | null; error: string | null }> {
  try { const res = await fetch(DIST_TAGS_URL, { signal: AbortSignal.timeout(15000) }); if (!res.ok) return { latest: null, next: null, error: 'HTTP ' + res.status }; const tags = (await res.json()) as DistTags; return { latest: tags.latest != null ? String(tags.latest) : null, next: tags.next != null ? String(tags.next) : null, error: null } }
  catch (e) { return { latest: null, next: null, error: String(e && (e as Error).message ? (e as Error).message : e) } }
}
/** 从 GitHub Releases 拉取 release notes，提取中文要点、去掉 HTML/markdown 格式 */
async function fetchChangelog(version: string | null): Promise<string | null> {
  if (!version) return null
  try {
    const res = await fetch('https://api.github.com/repos/deepseek-ai/deepseek-harness/releases?per_page=5', { signal: AbortSignal.timeout(10000) })
    if (!res.ok) return null
    const releases = await res.json() as any[]
    // 匹配目标版本
    const match = releases.find((r: any) => {
      const tag = (r.tag_name || '').toLowerCase()
      return tag.includes(version.toLowerCase()) || tag === 'v' + version || tag === version
    })
    const raw = match?.body || releases[0]?.body
    if (!raw) return null
    // 提取中文部分（#cn 和下一个 --- 之间）
    const cnMatch = raw.match(/#cn[\s\S]*?\n([\s\S]*?)(?=\n---|\n<h3 id="en|$)/)
    let text = cnMatch ? cnMatch[1] : raw.split('\n---')[0]
    // 去掉 HTML 标签
    text = text.replace(/<[^>]+>/g, '')
    // 去掉 markdown 标题（### / ##）
    text = text.replace(/^#{1,3}\s*/gm, '')
    // 只保留 * 开头的要点行 + 子标题
    const lines = text.split('\n')
      .map((l: string) => l.trim())
      .filter((l: string) => l.startsWith('*') || l.startsWith('-') || /^[A-Z一-鿿]/.test(l))
      .slice(0, 20) // 最多 20 行
    return lines.join('\n') || null
  } catch { return null }
}
function buildStatus(local: string | null, latest: string | null, next: string | null, error: string | null) {
  if (!local) return { label: '未知', code: 'unknown' }; if (error) return { label: '无法检查', code: 'error' }
  const cmpL = latest != null ? compare(local, latest) : null; const cmpN = next != null ? compare(local, next) : null
  if (cmpL === 0 || cmpN === 0) return { label: '已是最新', code: 'uptodate' }
  if (cmpL != null && cmpL < 0) return { label: '有新版可用', code: 'outdated' }
  if (cmpN != null && cmpN < 0) return { label: '有新版可用', code: 'outdated' }
  return { label: '领先于最新发布', code: 'ahead' }
}
function sendJson(res: any, code: number, body: unknown): void { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)) }

/* ── 更新进度状态机 ──────────────────────────────────────────────
 * 更新在后台异步跑，进度只存在这个模块级对象里；前端轮询 /update/status
 * 拿到「当前阶段 + npm 实时输出」，用来驱动更新动画。
 * 更新结束后**不**自行杀进程重启（重启一律由用户手动执行）。 */
type UpdateStage = 'idle' | 'preparing' | 'downloading' | 'installing' | 'done' | 'failed'

interface UpdateState {
  running: boolean
  stage: UpdateStage
  message: string
  startedAt: number | null
  finishedAt: number | null
  exitCode: number | null
  tail: string[]
}

const TAIL_LIMIT = 80
const updateState: UpdateState = { running: false, stage: 'idle', message: '', startedAt: null, finishedAt: null, exitCode: null, tail: [] }

function errText(e: unknown): string { return String(e && (e as Error).message ? (e as Error).message : e) }

/** 收集 npm 输出：去掉 ANSI 色码、裁剪行数，并按关键词推进阶段 */
function noteOutput(chunk: unknown): void {
  for (const raw of String(chunk).split(/\r\n|\r|\n/)) {
    const line = raw.replace(/\u001b\[[0-9;]*[A-Za-z]/g, '').trim()
    if (!line) continue
    updateState.tail.push(line)
    if (updateState.tail.length > TAIL_LIMIT) updateState.tail.splice(0, updateState.tail.length - TAIL_LIMIT)
    if (updateState.stage === 'done' || updateState.stage === 'failed') continue
    if (/idealTree|http fetch|fetch manifest|npm warn/i.test(line)) { updateState.stage = 'downloading'; updateState.message = '正在从 npm 下载 @deepseek-ai/dsh@latest…'; continue }
    if (/reify|extract|tarball/i.test(line)) { updateState.stage = 'installing'; updateState.message = '正在写入安装文件…'; continue }
    if (/added \d+ package|changed \d+ package|removed \d+ package|up to date/i.test(line)) { updateState.stage = 'installing'; updateState.message = '正在完成安装…' }
  }
}

/** 后台执行 npm 全局更新；返回是否成功启动（重复调用返回 false） */
function runUpdate(): boolean {
  if (updateState.running) return false
  updateState.running = true
  updateState.stage = 'preparing'
  updateState.message = '正在启动 npm…'
  updateState.startedAt = Date.now()
  updateState.finishedAt = null
  updateState.exitCode = null
  updateState.tail = []
  let child: ReturnType<typeof spawn>
  try {
    child = spawn('cmd.exe', ['/c', 'npm i -g @deepseek-ai/dsh@latest'], { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true })
  } catch (e) {
    updateState.running = false
    updateState.stage = 'failed'
    updateState.finishedAt = Date.now()
    updateState.message = '无法启动 npm：' + errText(e)
    return true
  }
  updateState.stage = 'downloading'
  updateState.message = '正在执行 npm i -g @deepseek-ai/dsh@latest…'
  if (child.stdout) (child.stdout as any).on('data', noteOutput)
  if (child.stderr) (child.stderr as any).on('data', noteOutput)
  child.on('error', (e) => {
    updateState.running = false
    updateState.stage = 'failed'
    updateState.finishedAt = Date.now()
    updateState.message = 'npm 启动失败：' + errText(e)
  })
  child.on('exit', (code) => {
    updateState.running = false
    updateState.exitCode = code
    updateState.finishedAt = Date.now()
    if (code === 0) {
      updateState.stage = 'done'
      updateState.message = '更新完成，新版已写入安装目录。请手动重启 dsh 使其生效。'
    } else {
      updateState.stage = 'failed'
      updateState.message = 'npm 退出码 ' + String(code) + '，更新未完成（常见原因：文件被占用或网络不可达）。'
    }
  })
  return true
}

export function apply(ctx: Context): void {
  ctx.effect(() => ctx.webServer.register({ kind: 'prefix', path: '/dsh-update/api', handler: async (req: any, res: any) => {
    const p = (req.url ?? '/').split('?')[0]
    if (req.method === 'GET' && p.endsWith('/check')) { console.log('[dsh-update-check] /check 请求 @', new Date().toISOString()); const local = readLocalVersion(); const { latest, next, error } = await fetchDistTags(); const status = buildStatus(local, latest, next, error); const target = (latest && local && compare(local, latest) < 0) ? latest : next; const changelog = await fetchChangelog(target); return sendJson(res, 200, { ok: true, localVersion: local, latest, next, error, status, changelog }) }
    /* /info：只读本机安装信息（不联网、不判断有无新版），因此不属于「自动检查」。
     * 让一级页在从未点过「检查更新」时也能显示本机版本号与安装目录。 */
    if (req.method === 'GET' && p.endsWith('/info')) {
      const local = readLocalVersion()
      let installed = false
      try { installed = statSync(DSH_PKG).isFile() } catch { installed = false }
      return sendJson(res, 200, { ok: true, localVersion: local, installed, installDir: installed ? dirname(DSH_PKG) : null, registry: 'registry.npmjs.org' })
    }
    if (req.method === 'POST' && p.endsWith('/update')) {
      if (updateState.running) return sendJson(res, 200, { ok: false, error: '更新正在进行中，请稍候…' })
      // 先响应客户端，再后台跑 npm（避免白屏）；进度由 /update/status 轮询
      const started = runUpdate()
      return sendJson(res, 200, { ok: started, message: started ? '更新已开始…' : '更新正在进行中', startedAt: updateState.startedAt })
    }
    if (req.method === 'GET' && p.endsWith('/update/status')) {
      return sendJson(res, 200, {
        ok: true,
        running: updateState.running,
        stage: updateState.stage,
        message: updateState.message,
        startedAt: updateState.startedAt,
        finishedAt: updateState.finishedAt,
        exitCode: updateState.exitCode,
        elapsedMs: updateState.startedAt ? (updateState.finishedAt ?? Date.now()) - updateState.startedAt : 0,
        tail: updateState.tail.slice(-12),
      })
    }
    return sendJson(res, 404, { ok: false, error: 'not found' })
  } }), 'dsh-update-checker: api route')
}
