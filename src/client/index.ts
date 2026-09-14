import * as React from 'react'
import type { SlotsService } from '@deepseek-ai/dsh-client-ui-slots'
type ClientContext = { slots: SlotsService }
export const inject = ['slots']
const API = '/dsh-update/api'

/* 持久化键（读写只用这一个常量，避免两处字面量漂移） */

const LS_KEY = 'dsh-update-check:last'

/* 构建戳：由 tsdown 的 define 注入（版本 + 构建时间），用于确认服务器下发的到底是哪份产物 */

declare const __DUC_BUILD__: string

const ACCENT = '#5b8cff'
const OK = '#2da44e'
const BAD = '#e5534b'
const MONO = 'ui-monospace,SFMono-Regular,Menlo,Consolas,monospace'

/* 设计约定（「精确克制」版）：
 *  1. 层次用三级灰度，不靠一堆 opacity；灰度跟随主题文字色，取不到时退回固定灰
 *  2. 字号只留三级：13/12（信息）+ 44（读数），不做 9.5px 这类微缩字
 *  3. 间距走 8 的倍数（8 / 16 / 24）
 *  4. 不用彩色发光、装饰性渐变、假高光；进度线只有 1px 且用主题文字色
 *  5. 动效只做 opacity 与位置，约 200ms
 *  6. 元素能删就删：一屏只留「阶段 / 读数 / 进度 / 时间」四件事 */
const ANIM_CSS = [
  '@keyframes dshUpdSpin{to{transform:rotate(360deg)}}',
  '@keyframes dshUpdFadeIn{from{opacity:0}to{opacity:1}}',
  // 读数变化：3px 位移 + 淡入，无弹跳、无缩放
  '@keyframes dshUpdRiseIn{from{opacity:0;transform:translateY(3px)}to{opacity:1;transform:translateY(0)}}',
  // 检查中：彗尾扫动（两端淡出的软边渐变；只动 transform 与 opacity，不碰 width，走 GPU 合成）
  '@keyframes dshUpdSweep{0%{transform:translateX(-100%);opacity:0}15%{opacity:1}85%{opacity:1}100%{transform:translateX(385%);opacity:0}}',
  '.dsh-upd-sweep{position:absolute;top:0;bottom:0;left:0;width:26%;will-change:transform;background:linear-gradient(90deg,transparent,var(--dsw-alias-label-primary,#545557) 16%,var(--dsw-alias-label-primary,#545557) 84%,transparent);animation:dshUpdSweep 1.1s cubic-bezier(.4,0,.2,1) infinite}',
  '.dsh-upd-btn{display:inline-flex;align-items:center;gap:7px;padding:8px 18px;border-radius:10px;border:1px solid color-mix(in srgb,var(--dsw-alias-label-primary,#545557) 38%,transparent);background:transparent;color:var(--dsw-alias-label-primary,#545557);font-size:12px;font-family:inherit;cursor:pointer;transition:background .15s ease,opacity .15s ease}',
  '.dsh-upd-btn:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.12))}',
  '.dsh-upd-btn:disabled{cursor:default;opacity:.55}',
  '.dsh-upd-btn-primary{background:var(--dsw-alias-label-primary,#545557);border-color:transparent;color:var(--dsw-alias-bg-layer-2,#f2f3f7)}',
  '.dsh-upd-btn-primary:hover:not(:disabled){opacity:.88}',
  '.dsh-upd-btn-primary:disabled{cursor:default;opacity:.55}',
  '.dsh-upd-ink2{color:var(--dsw-alias-label-secondary,#7f8287)}',
  '.dsh-upd-ink3{color:var(--dsw-alias-label-tertiary,#a2a4a6)}',
  '.dsh-upd-rule{background:var(--dsw-alias-border-l2,rgba(84,85,87,.25))}',
  // 文字按钮：一级「查看上次结果」入口（二级页不放返回按钮，切走设置页再回来即回一级）
  '.dsh-upd-link{padding:8px 4px;border:none;background:transparent;color:var(--dsw-alias-label-secondary,#7f8287);font-size:12px;font-family:inherit;cursor:pointer;transition:color .15s ease,opacity .15s ease}',
  '.dsh-upd-link:hover:not(:disabled){color:var(--dsw-alias-label-primary,#545557)}',
  '.dsh-upd-link:disabled{cursor:default;opacity:.4}',
  // 注：不加 prefers-reduced-motion 门 —— 用户系统关闭'动画效果'时浏览器会上报
  // reduce，会把本插件全部 CSS 动画杀成静态（实测）。这些动画本身极小、无眩晕风险。
].join('')

function errMsg(e: unknown): string { return String(e && (e as Error).message ? (e as Error).message : e) }

function Row({ k, v }: { k: string; v: string }) {
  return React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid var(--dsw-alias-border-l2,#d9dde3)' } },
    React.createElement('span', { style: { opacity: 0.8 } }, k),
    React.createElement('span', { style: { fontWeight: 600, fontFamily: 'monospace' } }, v))
}

/** 旋转加载指示器 */
function Spinner({ size = 18, color = 'currentColor' }: { size?: number; color?: string }) {
  return React.createElement('span', {
    className: 'dsh-upd-anim',
    style: {
      display: 'inline-block', boxSizing: 'border-box', flex: '0 0 auto',
      width: size, height: size, borderRadius: '50%',
      border: '2px solid ' + color, borderTopColor: 'transparent',
      animation: 'dshUpdSpin .72s linear infinite',
      verticalAlign: '-3px',
    },
  })
}

/** 阶段 → 进度百分比：给用户「走到哪了」的确定感，末端留余量不封顶 */
function stagePercent(stage: string | undefined, elapsedMs: number): number {
  const base = stage === 'installing' ? 74 : stage === 'downloading' ? 34 : 8
  const cap = stage === 'installing' ? 96 : stage === 'downloading' ? 70 : 20
  const creep = Math.min(1, Math.max(0, elapsedMs) / 90000) * (cap - base)
  return Math.round(Math.min(cap, base + creep))
}

/** 阶段 → 序号：准备 0 / 下载 1 / 安装 2 */
function stageIndex(stage: string | undefined): number {
  return stage === 'installing' ? 2 : stage === 'preparing' ? 0 : 1
}

/** 剩余时间粗估：按「已用时间 / 已完成百分比」线性外推，只作为观感参考 */
function etaText(pct: number, elapsedMs: number): string {
  if (pct < 6 || elapsedMs <= 0) return ''
  const total = elapsedMs / (pct / 100)
  const left = Math.max(0, total - elapsedMs)
  const s = Math.round(left / 1000)
  if (s <= 1) return '即将完成'
  return '约剩 ' + s + ' 秒'
}

/** 已用时间，读作「N 秒」/「M 分 N 秒」 */
function secsText(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000))
  if (s < 60) return s + ' 秒'
  return Math.floor(s / 60) + ' 分 ' + (s % 60) + ' 秒'
}

/** 绝对时间，形如 09-14 20:12 —— 一级页「检查于」用；只用相对时间过一天就糊了 */
function clockText(t: number): string {
  const d = new Date(t)
  const p = (n: number) => (n < 10 ? '0' + n : String(n))
  return p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes())
}

/** 更新进行中：一屏只有四件事 —— 阶段 / 读数 / 进度 / 时间（精确克制版） */
function UpdatingCard({ stage, message, elapsedMs, tail }: { stage?: string; message?: string; elapsedMs: number; tail?: string[] }) {
  const pct = stagePercent(stage, elapsedMs)
  const eta = etaText(pct, elapsedMs)
  const phase = ['准备中', '下载中', '安装中'][stageIndex(stage)]
  const lastLine = tail && tail.length ? tail[tail.length - 1] : ''
  return React.createElement('div', {
    className: 'dsh-upd-anim',
    style: {
      marginTop: 16, padding: '24px 0',
      borderTop: '1px solid var(--dsw-alias-border-l2,#d9dde3)',
      borderBottom: '1px solid var(--dsw-alias-border-l2,#d9dde3)',
      animation: 'dshUpdFadeIn .22s ease-out',
    },
  },
    /* 阶段：唯一的文字标签 */
    React.createElement('div', { className: 'dsh-upd-ink2', style: { fontSize: 11, letterSpacing: '0.1em', marginBottom: 24 } }, phase),
    /* 读数：44px / 字重 500 */
    React.createElement('div', { style: { display: 'flex', alignItems: 'baseline', gap: 2 } },
      React.createElement('span', {
        key: pct,
        className: 'dsh-upd-anim',
        style: {
          fontSize: 44, fontWeight: 500, lineHeight: 1, letterSpacing: '-0.03em',
          fontVariantNumeric: 'tabular-nums', color: 'var(--dsw-alias-label-primary,#545557)', display: 'inline-block',
          animation: 'dshUpdRiseIn .2s cubic-bezier(.4,0,.2,1)',
        },
      }, String(pct)),
      React.createElement('span', { className: 'dsh-upd-ink3', style: { fontSize: 16, fontWeight: 400 } }, '%')),
    /* 进度：1px 硬线，填充跟随主题文字色（不自己发明强调色） */
    React.createElement('div', { className: 'dsh-upd-rule', style: { position: 'relative', height: 1, margin: '24px 0 16px' } },
      React.createElement('div', { style: { position: 'absolute', top: 0, bottom: 0, left: 0, width: pct + '%', background: 'var(--dsw-alias-label-primary,#545557)', transition: 'width .5s cubic-bezier(.4,0,.2,1)' } })),
    /* 时间 */
    React.createElement('div', { className: 'dsh-upd-ink2', style: { display: 'flex', fontSize: 12 } },
      React.createElement('span', null, '已用 ' + secsText(elapsedMs)),
      React.createElement('span', { style: { marginLeft: 'auto' } }, eta)),
    /* 阶段说明与 npm 输出：压到最弱一级 */
    message ? React.createElement('div', { className: 'dsh-upd-ink3', style: { fontSize: 12, marginTop: 12, lineHeight: 1.7 } }, message) : null,
    lastLine ? React.createElement('div', { className: 'dsh-upd-ink3', style: { fontSize: 11, marginTop: 8, fontFamily: MONO, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, lastLine) : null)
}

/** 更新收尾：同一套语言 —— 阶段标签 / 读数 / 1px 线 / 说明 */
function ResultCard({ ok, message, tail }: { ok: boolean; message: string; tail?: string[] }) {
  const ink = 'var(--dsw-alias-label-primary,#545557)'
  return React.createElement('div', {
    className: 'dsh-upd-anim',
    style: {
      marginTop: 16, padding: '24px 0',
      borderTop: '1px solid var(--dsw-alias-border-l2,#d9dde3)',
      borderBottom: '1px solid var(--dsw-alias-border-l2,#d9dde3)',
      animation: 'dshUpdFadeIn .22s ease-out',
    },
  },
    React.createElement('div', {
      className: ok ? 'dsh-upd-ink2' : undefined,
      style: { fontSize: 11, letterSpacing: '0.1em', marginBottom: 24, color: ok ? undefined : BAD },
    }, ok ? '已完成' : '已失败'),
    React.createElement('div', { style: { display: 'flex', alignItems: 'baseline', gap: 2 } },
      React.createElement('span', {
        className: 'dsh-upd-anim',
        style: {
          fontSize: 44, fontWeight: 500, lineHeight: 1, letterSpacing: '-0.03em',
          fontVariantNumeric: 'tabular-nums', color: ok ? ink : BAD, display: 'inline-block',
          animation: 'dshUpdRiseIn .2s cubic-bezier(.4,0,.2,1)',
        },
      }, ok ? '100' : '!'),
      ok ? React.createElement('span', { className: 'dsh-upd-ink3', style: { fontSize: 16, fontWeight: 400 } }, '%') : null),
    React.createElement('div', { style: { position: 'relative', height: 1, background: ok ? ink : BAD, margin: '24px 0 16px' } }),
    React.createElement('div', { className: 'dsh-upd-ink2', style: { fontSize: 12, lineHeight: 1.85 } }, message),
    ok ? React.createElement('div', { className: 'dsh-upd-ink3', style: { fontSize: 12, marginTop: 8, lineHeight: 1.85 } },
      '请手动重启 dsh（关闭桌面版后重新打开，或运行桌面上的 dsh-restart.bat）使新版本生效。') : null,
    tail && tail.length ? React.createElement('div', { className: 'dsh-upd-ink3', style: { fontSize: 11, marginTop: 10, fontFamily: MONO, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, tail[tail.length - 1]) : null)
}

/** 检查中：一屏只有三件事 —— 阶段标签 / 1px 彗尾扫动 / 说明（与更新卡同一套语言，不造假百分比） */
function CheckingCard() {
  return React.createElement('div', {
    className: 'dsh-upd-anim',
    style: {
      marginTop: 16, padding: '24px 0',
      borderTop: '1px solid var(--dsw-alias-border-l2,#d9dde3)',
      borderBottom: '1px solid var(--dsw-alias-border-l2,#d9dde3)',
      animation: 'dshUpdFadeIn .22s ease-out',
    },
  },
    React.createElement('div', { className: 'dsh-upd-ink2', style: { fontSize: 11, letterSpacing: '0.1em', marginBottom: 24 } }, '检查更新'),
    /* 轨道 1px（与更新进度线同宽），彗尾在其中扫过；overflow 裁掉进出场的外溢 */
    React.createElement('div', { className: 'dsh-upd-rule', style: { position: 'relative', height: 1, overflow: 'hidden' } },
      React.createElement('div', { className: 'dsh-upd-sweep' })),
    React.createElement('div', { className: 'dsh-upd-ink3', style: { fontSize: 12, marginTop: 16 } }, '正在对比本地版本与 npm 最新发布版本…'))
}
/* 模块级缓存：跨设置页卸载/重挂载存活。ref 会随实例销毁，挡不住重挂载重复检查。 */
let cacheData: any = null
let cacheStatus: any = null
let lastCheckAt = 0
/* 检查在途时间戳（0 = 空闲）。同样放模块级，重挂载后仍能挡住重复触发。 */
let checkInFlight = 0
/* 本机安装信息缓存（/info）：只含版本与目录，不含任何更新结论 */
let cacheInfo: any = null
let infoInFlight = false

/**
 * 落盘：只从模块级缓存取值。
 * 0.7.2 及以前是在 applyCheck 里写 JSON.stringify({ data, ... })，那个 data 是 useState 的闭包旧值，
 * 于是「本次结果」永远比盘上晚一轮：会话内第一次检查会存下 data:null，
 * 重启后 if (saved.data) 不成立 → 只剩徽章、版本框和上次检查消失（交接文档里的「半恢复」）。
 */
function persist(): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({ data: cacheData, status: cacheStatus, lastCheckAt }))
  } catch (e) {
    console.warn('[dsh-update-checker] 写入 localStorage 失败：' + errMsg(e), e)
  }
}

function UpdatePage() {
  /* 两级视图：entry = 一级入口（标题 + 说明 + 「检查更新」），result = 二级结果（徽章 + 版本表 + 更新流程）。
   * 初始值恒为 'entry'：每次打开设置页都落在一级 —— 这就是「一级页面丢失」的直接修复点。
   * 持久化恢复只负责填充数据，不再决定当前处于哪一级。 */
  const [view, setView] = React.useState<'entry' | 'result'>('entry')
  const [status, setStatus] = React.useState<null | { code: string; label: string }>(cacheStatus)
  const [data, setData] = React.useState<any>(cacheData)
  const [error, setError] = React.useState<string>('')
  const [busy, setBusy] = React.useState(false)
  const [phase, setPhase] = React.useState<'idle' | 'updating' | 'done' | 'failed'>('idle')
  const [progress, setProgress] = React.useState<any>(null)
  const [startedAt, setStartedAt] = React.useState<number>(0)
  const [updateResult, setUpdateResult] = React.useState<string | null>(null)
  const [tick, setTick] = React.useState(0)
  const [round, setRound] = React.useState(0) // 每次手动检查完成 +1：让结果区以 RiseIn 重新登场
  const [lastCheck, setLastCheck] = React.useState(lastCheckAt)
  const [info, setInfo] = React.useState<any>(cacheInfo)
  const checkStart = React.useRef(0)
  const badgeColor = status?.code === 'outdated' ? BAD : status?.code === 'ahead' ? '#e5a13b' : OK

  const agoText = (t: number) => {
    const d = Date.now() - t
    if (d < 60e3) return '刚刚'
    if (d < 3600e3) return Math.floor(d / 60e3) + ' 分钟前'
    if (d < 86400e3) return Math.floor(d / 3600e3) + ' 小时前'
    return Math.floor(d / 86400e3) + ' 天前'
  }

  const applyCheck = (d: any) => {
    if (!d?.ok) { setStatus({ code: 'unknown', label: '检查失败' }); return }
    const nextStatus = d.status || { code: 'unknown', label: '未知' }
    setData(d); cacheData = d
    setStatus(nextStatus); cacheStatus = nextStatus
    if (d.error) setError(String(d.error))
    lastCheckAt = Date.now()
    setLastCheck(lastCheckAt)
    persist()
  }

  const check = (silent?: boolean) => {
    const kind = silent ? 'silent' : 'manual'
    console.info('[dsh-update-checker] check() 触发：' + kind + ' @ ' + new Date().toLocaleTimeString(), new Error('trace').stack)
    /* 在途锁：30 秒内的重复触发一律忽略（用户报告过「点一次检查两遍」） */
    if (checkInFlight && Date.now() - checkInFlight < 30000) {
      console.warn('[dsh-update-checker] 已有一次检查在途，忽略本次 ' + kind + ' 触发')
      return
    }
    checkInFlight = Date.now()
    if (!silent) {
      /* 手动检查 = 从一级进入二级；不清空旧数据，失败时二级页仍保留上一次结果 */
      setView('result'); setBusy(true); setUpdateResult(null); checkStart.current = Date.now()
    }
    setError('')
    fetch(API + '/check', { headers: { 'content-type': 'application/json' } }).then(r => r.json()).then(d => {
      checkInFlight = 0
      if (silent) { applyCheck(d); return }
      /* 最少展示 1.5s：保证检查动画完整走完至少一轮扫动，不被快速返回的结果闪没 */
      const wait = Math.max(0, 1500 - (Date.now() - checkStart.current))
      setTimeout(() => { setBusy(false); setRound(r => r + 1); applyCheck(d) }, wait)
    }).catch(e => {
      checkInFlight = 0
      if (silent) return
      const wait = Math.max(0, 1500 - (Date.now() - checkStart.current))
      setTimeout(() => { setBusy(false); setRound(r => r + 1); setError(errMsg(e)) }, wait)
    })
  }

  /* 打开页面即恢复上次结果（localStorage），不依赖任何自动检查 */
  /* 0.7.3：原实现的 catch {} 会把「读到了但解析失败」和「根本没有记录」混成同一种静默，
     导致重启后全空却查不出原因。这里分层打日志，并把恢复出的值回填模块缓存，
     这样后续即便检查失败也不会把好数据覆盖掉。 */
  React.useEffect(() => {
    let raw: string | null = null
    try { raw = localStorage.getItem(LS_KEY) } catch (e) { console.warn("[dsh-update-checker] 恢复：读 localStorage 抛错 " + errMsg(e), e); return }
    if (raw == null) { console.info("[dsh-update-checker] 恢复：该 origin 下没有记录（LS 键 " + LS_KEY + "）"); return }
    let saved: any = null
    try { saved = JSON.parse(raw) } catch (e) {
      console.warn("[dsh-update-checker] 恢复：JSON 解析失败 rawLen=" + raw.length + " head=" + raw.slice(0, 200), e)
      return
    }
    if (!saved || typeof saved !== "object") { console.warn("[dsh-update-checker] 恢复：记录形态异常", saved); return }
    if (saved.data) { setData(saved.data); cacheData = saved.data }
    if (saved.status) { setStatus(saved.status); cacheStatus = saved.status }
    const t = Number(saved.lastCheckAt) || 0
    if (t) { lastCheckAt = t; setLastCheck(t) }
    console.info("[dsh-update-checker] 恢复：data=" + (saved.data ? "yes" : "NO") + " status=" + ((saved.status && saved.status.code) || "NO") + " lastCheckAt=" + t + " build=" + (typeof __DUC_BUILD__ === "undefined" ? "?" : __DUC_BUILD__))
  }, [])
  /* 读本机安装信息：/info 不联网、不下「有无新版」的结论，只陈述本机版本与目录，
     因此不属于被禁止的自动检查。模块级缓存 + 在途标记，切走再回来也不重复请求。 */
  React.useEffect(() => {
    if (cacheInfo || infoInFlight) return
    infoInFlight = true
    let alive = true
    fetch(API + '/info', { headers: { 'content-type': 'application/json' } })
      .then(r => r.json())
      .then((d: any) => {
        infoInFlight = false
        if (!alive || !d || !d.ok) return
        cacheInfo = d; setInfo(d)
      })
      .catch(() => { infoInFlight = false })
    return () => { alive = false }
  }, [])

  /* 挂载时接续后台更新：刷新页面或切换设置页后，更新动画不会丢失 */
  React.useEffect(() => {
    let alive = true
    fetch(API + '/update/status', { headers: { 'content-type': 'application/json' } }).then(r => r.json()).then((d: any) => {
      if (!alive || !d || !d.ok) return
      if (d.running) { setProgress(d); setStartedAt(Number(d.startedAt) || Date.now()); setPhase('updating'); setView('result'); return }
      const fin = Number(d.finishedAt) || 0
      /* 刚结束（5 分钟内）的更新：回来仍能看到结果卡片 */
      if (fin && Date.now() - fin < 5 * 60 * 1000 && (d.stage === 'done' || d.stage === 'failed')) {
        setProgress(d)
        setUpdateResult(String(d.message || (d.stage === 'done' ? '更新完成，请手动重启 dsh。' : '更新失败。')))
        setPhase(d.stage === 'done' ? 'done' : 'failed')
        check(true)
      }
    }).catch(() => {})
    return () => { alive = false }
  }, [])

  const doUpdate = () => { setError(''); setUpdateResult(null); setProgress(null); setStartedAt(Date.now()); setPhase('updating'); setView('result')
    fetch(API + '/update', { method: 'POST', headers: { 'content-type': 'application/json' } }).then(r => r.json()).then(d => {
      if (!d || !d.ok) { setPhase('failed'); setUpdateResult((d && d.error) ? String(d.error) : '更新未能启动') }
    }).catch(e => { setPhase('failed'); setUpdateResult('更新请求失败：' + errMsg(e)) }) }

  /* 更新期间轮询后台进度，直到 npm 结束 */
  React.useEffect(() => {
    if (phase !== 'updating') return
    let alive = true
    let timer: any = null
    const poll = () => {
      fetch(API + '/update/status', { headers: { 'content-type': 'application/json' } }).then(r => r.json()).then((d: any) => {
        if (!alive) return
        if (d && d.ok) {
          setProgress(d)
          if (d.running) { timer = setTimeout(poll, 900); return }
          if (d.stage === 'done') { setUpdateResult(String(d.message || '更新完成，请手动重启 dsh。')); setPhase('done'); check(true); return }
          if (d.stage === 'failed') { setUpdateResult(String(d.message || '更新失败。')); setPhase('failed'); return }
        }
        timer = setTimeout(poll, 1200)
      }).catch(() => { if (alive) timer = setTimeout(poll, 1500) })
    }
    poll()
    return () => { alive = false; if (timer) clearTimeout(timer) }
  }, [phase])

  /* 每秒推进一次「已用 N 秒」 */
  React.useEffect(() => {
    if (phase !== 'updating') return
    const id = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(id)
  }, [phase])

  const updating = phase === 'updating'
  const elapsedMs = (() => {
    const t0 = progress?.startedAt || startedAt
    if (!t0) return 0
    void tick
    return Math.max(0, (progress?.finishedAt || Date.now()) - t0)
  })()
  const tail: string[] = progress?.tail || []
  const hasUpdate = status?.code === 'outdated' && phase === 'idle'
  const showUpdateBtn = status?.code === 'outdated'
  /* 两级视图判定：entry = 一级入口；result = 二级结果 */
  const entry = view === 'entry'
  const hasResult = !!(data || status)
  const buildStamp = typeof __DUC_BUILD__ === 'undefined' ? 'dev' : String(__DUC_BUILD__)
  const shell = { fontFamily: 'inherit', fontSize: 12, lineHeight: 1.6, padding: '14px 16px', maxWidth: 640 }
  const styleTag = React.createElement('style', { dangerouslySetInnerHTML: { __html: ANIM_CSS } })
  const title = React.createElement('h3', { style: { margin: '0 0 6px', fontSize: 13 } },
    '版本更新',
    entry ? null : React.createElement('span', { style: { opacity: 0.45, fontSize: 10, fontWeight: 400 }, title: '构建 ' + buildStamp }, buildStamp === 'dev' ? 'dev' : 'v' + buildStamp.split('+')[0]))
  const desc = React.createElement('p', { style: { opacity: 0.7, fontSize: 11, margin: '0 0 12px' } },
    '检查本机安装的 dsh 是否为官方最新版本；发现新版本时，可直接一键升级。')
  const checkBtn = React.createElement('button', { className: 'dsh-upd-btn', disabled: busy || updating, onClick: () => check() },
    busy ? React.createElement(Spinner, { size: 13 }) : null, busy ? '检查中…' : (entry || !data ? '检查更新' : '重新检查'))

  /* ---------- 一级：入口态（读数 / 状态 / 动作，共三件事） ----------
   * 0.7.7：版本读数与上次结论提到一级页。这些数据本来就在缓存里，
   * 旧版只在二级页露出，于是一级页除了一个按钮什么都没有。 */
  if (entry) {
    const shown = String((data && data.localVersion) || (info && info.localVersion) || '')
    const checked = !!(status || data)
    const outdated = !!(checked && status && status.code === 'outdated')
    const note = checked
      ? ((status ? status.label : '已有结果') + (lastCheck ? ' · 检查于 ' + clockText(lastCheck) + '（' + agoText(lastCheck) + '）' : ''))
      : '尚未检查 · 点下方按钮对比官方最新版本'
    return React.createElement('div', { style: shell },
      styleTag, title, desc,
      React.createElement('div', {
        key: 'readout-' + (checked ? 'c' : 'n') + '-' + (shown || '-'),
        className: 'dsh-upd-anim',
        style: { marginTop: 24, animation: 'dshUpdRiseIn .2s cubic-bezier(.4,0,.2,1)' },
      },
        React.createElement('div', { className: 'dsh-upd-ink3', style: { fontSize: 11, letterSpacing: '0.1em', marginBottom: 8 } }, '本机版本'),
        React.createElement('div', { style: { fontSize: 28, fontWeight: 500, lineHeight: 1.15, letterSpacing: '-0.02em', fontFamily: MONO, fontVariantNumeric: 'tabular-nums', color: shown ? undefined : 'var(--dsw-alias-label-tertiary,#a2a4a6)' } }, shown || '未获取'),
        React.createElement('div', {
          className: outdated ? undefined : 'dsh-upd-ink2',
          style: { fontSize: 12, marginTop: 8, color: outdated ? BAD : undefined },
          title: info && info.installDir ? '安装目录：' + info.installDir : undefined,
        }, note)),
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8, marginTop: 24 } },
        checkBtn,
        hasResult ? React.createElement('button', { className: 'dsh-upd-link', onClick: () => setView('result') }, '查看上次结果 →') : null))
  }
  /* ---------- 二级：结果态（对齐截图 2） ---------- */
  return React.createElement('div', { style: shell },
    styleTag,
    title, desc,
    /* 检查中：先把旧结果让位给检查卡，结果回来后再以 RiseIn 登场（round 变化触发重挂载） */
    busy ? React.createElement(CheckingCard) : React.createElement('div', { key: 'res' + round, className: 'dsh-upd-anim', style: { animation: 'dshUpdRiseIn .2s cubic-bezier(.4,0,.2,1)' } },
      status ? React.createElement('span', { style: { display: 'inline-block', padding: '2px 10px', borderRadius: 10, fontSize: 11, color: '#fff', margin: '4px 0 12px', background: badgeColor } }, status.label) : null,
      data ? React.createElement('div', { style: { marginTop: 4, padding: '2px 14px', border: '1px solid var(--dsw-alias-border-l2,#d9dde3)', borderRadius: 10, background: 'var(--dsw-alias-bg-layer-2,transparent)' } },
        React.createElement(Row, { k: '当前版本', v: data.localVersion ?? '未知' }),
        data.latest != null ? React.createElement(Row, { k: '官方 latest', v: String(data.latest) }) : null,
        data.next != null ? React.createElement(Row, { k: '官方 next（预发布）', v: String(data.next) }) : null,
        (lastCheck || lastCheckAt) ? React.createElement(Row, { k: '上次检查', v: agoText(lastCheck || lastCheckAt) }) : null) : null,
      data?.changelog ? React.createElement('div', { style: { margin: '12px 0', padding: '10px 12px', background: 'var(--dsw-alias-bg-layer-2,transparent)', borderRadius: 8, border: '1px solid var(--dsw-alias-border-l2,#d9dde3)' } },
        React.createElement('div', { style: { fontSize: 11, fontWeight: 600, marginBottom: 4, color: 'var(--dsw-alias-label-primary,#545557)' } }, hasUpdate ? '最新版本更新内容：' : '当前版本说明：'),
        React.createElement('div', { style: { fontSize: 11, color: 'var(--dsw-alias-label-secondary,#7f8287)', lineHeight: 1.6, whiteSpace: 'pre-wrap' } }, data.changelog)) : null),
    React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8, marginTop: 14 } },
      checkBtn,
      showUpdateBtn && !busy ? React.createElement('button', { className: 'dsh-upd-btn dsh-upd-btn-primary', disabled: updating, onClick: doUpdate },
        updating ? React.createElement(Spinner, { size: 13 }) : null, updating ? '更新中…' : '立即更新') : null),
    updating ? React.createElement(UpdatingCard, { stage: progress?.stage, message: progress?.message, elapsedMs, tail }) : null,
    phase === 'done' ? React.createElement(ResultCard, { ok: true, message: updateResult || '更新完成，请手动重启 dsh。', tail }) : null,
    phase === 'failed' ? React.createElement(ResultCard, { ok: false, message: updateResult || '更新失败。', tail }) : null,
    error ? React.createElement('div', { style: { color: BAD, marginTop: 8, fontSize: 11 } }, '错误：' + error) : null)
}

export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.slots.inject('settings.section', () => ctx.slots.register({ name: 'settings.section', id: 'dsh-update', order: 55, label: () => '更新' }, UpdatePage)), 'dsh-update-checker: settings page')
}
