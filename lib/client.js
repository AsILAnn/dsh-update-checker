window.__ModuleLoader__.load({
	id: "@dsh-external/dsh-update-checker",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		//#region \0rolldown/runtime.js
		var __create = Object.create;
		var __defProp = Object.defineProperty;
		var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
		var __getOwnPropNames = Object.getOwnPropertyNames;
		var __getProtoOf = Object.getPrototypeOf;
		var __hasOwnProp = Object.prototype.hasOwnProperty;
		var __copyProps = (to, from, except, desc) => {
			if (from && typeof from === "object" || typeof from === "function") for (var keys = __getOwnPropNames(from), i = 0, n = keys.length, key; i < n; i++) {
				key = keys[i];
				if (!__hasOwnProp.call(to, key) && key !== except) __defProp(to, key, {
					get: ((k) => from[k]).bind(null, key),
					enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
				});
			}
			return to;
		};
		var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule || !__hasOwnProp.call(mod, "default") ? __defProp(target, "default", {
			value: mod,
			enumerable: true
		}) : target, mod));
		//#endregion
		let react = require("react");
		react = __toESM(react, 1);
		//#region src/client/index.ts
		const inject = ["slots"];
		const API = "/dsh-update/api";
		const LS_KEY = "dsh-update-check:last";
		const OK = "#2da44e";
		const BAD = "#e5534b";
		const MONO = "ui-monospace,SFMono-Regular,Menlo,Consolas,monospace";
		const ANIM_CSS = [
			"@keyframes dshUpdSpin{to{transform:rotate(360deg)}}",
			"@keyframes dshUpdFadeIn{from{opacity:0}to{opacity:1}}",
			"@keyframes dshUpdRiseIn{from{opacity:0;transform:translateY(3px)}to{opacity:1;transform:translateY(0)}}",
			"@keyframes dshUpdSweep{0%{transform:translateX(-100%);opacity:0}15%{opacity:1}85%{opacity:1}100%{transform:translateX(385%);opacity:0}}",
			".dsh-upd-sweep{position:absolute;top:0;bottom:0;left:0;width:26%;will-change:transform;background:linear-gradient(90deg,transparent,var(--dsw-alias-label-primary,#545557) 16%,var(--dsw-alias-label-primary,#545557) 84%,transparent);animation:dshUpdSweep 1.1s cubic-bezier(.4,0,.2,1) infinite}",
			".dsh-upd-btn{display:inline-flex;align-items:center;gap:7px;padding:8px 18px;border-radius:10px;border:1px solid color-mix(in srgb,var(--dsw-alias-label-primary,#545557) 38%,transparent);background:transparent;color:var(--dsw-alias-label-primary,#545557);font-size:12px;font-family:inherit;cursor:pointer;transition:background .15s ease,opacity .15s ease}",
			".dsh-upd-btn:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.12))}",
			".dsh-upd-btn:disabled{cursor:default;opacity:.55}",
			".dsh-upd-btn-primary{background:var(--dsw-alias-label-primary,#545557);border-color:transparent;color:var(--dsw-alias-bg-layer-2,#f2f3f7)}",
			".dsh-upd-btn-primary:hover:not(:disabled){opacity:.88}",
			".dsh-upd-btn-primary:disabled{cursor:default;opacity:.55}",
			".dsh-upd-ink2{color:var(--dsw-alias-label-secondary,#7f8287)}",
			".dsh-upd-ink3{color:var(--dsw-alias-label-tertiary,#a2a4a6)}",
			".dsh-upd-rule{background:var(--dsw-alias-border-l2,rgba(84,85,87,.25))}",
			".dsh-upd-link{padding:8px 4px;border:none;background:transparent;color:var(--dsw-alias-label-secondary,#7f8287);font-size:12px;font-family:inherit;cursor:pointer;transition:color .15s ease,opacity .15s ease}",
			".dsh-upd-link:hover:not(:disabled){color:var(--dsw-alias-label-primary,#545557)}",
			".dsh-upd-link:disabled{cursor:default;opacity:.4}"
		].join("");
		function errMsg(e) {
			return String(e && e.message ? e.message : e);
		}
		function Row({ k, v }) {
			return react.createElement("div", { style: {
				display: "flex",
				justifyContent: "space-between",
				padding: "7px 0",
				borderBottom: "1px solid var(--dsw-alias-border-l2,#d9dde3)"
			} }, react.createElement("span", { style: { opacity: .8 } }, k), react.createElement("span", { style: {
				fontWeight: 600,
				fontFamily: "monospace"
			} }, v));
		}
		/** 旋转加载指示器 */
		function Spinner({ size = 18, color = "currentColor" }) {
			return react.createElement("span", {
				className: "dsh-upd-anim",
				style: {
					display: "inline-block",
					boxSizing: "border-box",
					flex: "0 0 auto",
					width: size,
					height: size,
					borderRadius: "50%",
					border: "2px solid " + color,
					borderTopColor: "transparent",
					animation: "dshUpdSpin .72s linear infinite",
					verticalAlign: "-3px"
				}
			});
		}
		/** 阶段 → 进度百分比：给用户「走到哪了」的确定感，末端留余量不封顶 */
		function stagePercent(stage, elapsedMs) {
			const base = stage === "installing" ? 74 : stage === "downloading" ? 34 : 8;
			const cap = stage === "installing" ? 96 : stage === "downloading" ? 70 : 20;
			const creep = Math.min(1, Math.max(0, elapsedMs) / 9e4) * (cap - base);
			return Math.round(Math.min(cap, base + creep));
		}
		/** 阶段 → 序号：准备 0 / 下载 1 / 安装 2 */
		function stageIndex(stage) {
			return stage === "installing" ? 2 : stage === "preparing" ? 0 : 1;
		}
		/** 剩余时间粗估：按「已用时间 / 已完成百分比」线性外推，只作为观感参考 */
		function etaText(pct, elapsedMs) {
			if (pct < 6 || elapsedMs <= 0) return "";
			const total = elapsedMs / (pct / 100);
			const left = Math.max(0, total - elapsedMs);
			const s = Math.round(left / 1e3);
			if (s <= 1) return "即将完成";
			return "约剩 " + s + " 秒";
		}
		/** 已用时间，读作「N 秒」/「M 分 N 秒」 */
		function secsText(ms) {
			const s = Math.max(0, Math.round(ms / 1e3));
			if (s < 60) return s + " 秒";
			return Math.floor(s / 60) + " 分 " + s % 60 + " 秒";
		}
		/** 更新进行中：一屏只有四件事 —— 阶段 / 读数 / 进度 / 时间（精确克制版） */
		function UpdatingCard({ stage, message, elapsedMs, tail }) {
			const pct = stagePercent(stage, elapsedMs);
			const eta = etaText(pct, elapsedMs);
			const phase = [
				"准备中",
				"下载中",
				"安装中"
			][stageIndex(stage)];
			const lastLine = tail && tail.length ? tail[tail.length - 1] : "";
			return react.createElement("div", {
				className: "dsh-upd-anim",
				style: {
					marginTop: 16,
					padding: "24px 0",
					borderTop: "1px solid var(--dsw-alias-border-l2,#d9dde3)",
					borderBottom: "1px solid var(--dsw-alias-border-l2,#d9dde3)",
					animation: "dshUpdFadeIn .22s ease-out"
				}
			}, react.createElement("div", {
				className: "dsh-upd-ink2",
				style: {
					fontSize: 11,
					letterSpacing: "0.1em",
					marginBottom: 24
				}
			}, phase), react.createElement("div", { style: {
				display: "flex",
				alignItems: "baseline",
				gap: 2
			} }, react.createElement("span", {
				key: pct,
				className: "dsh-upd-anim",
				style: {
					fontSize: 44,
					fontWeight: 500,
					lineHeight: 1,
					letterSpacing: "-0.03em",
					fontVariantNumeric: "tabular-nums",
					color: "var(--dsw-alias-label-primary,#545557)",
					display: "inline-block",
					animation: "dshUpdRiseIn .2s cubic-bezier(.4,0,.2,1)"
				}
			}, String(pct)), react.createElement("span", {
				className: "dsh-upd-ink3",
				style: {
					fontSize: 16,
					fontWeight: 400
				}
			}, "%")), react.createElement("div", {
				className: "dsh-upd-rule",
				style: {
					position: "relative",
					height: 1,
					margin: "24px 0 16px"
				}
			}, react.createElement("div", { style: {
				position: "absolute",
				top: 0,
				bottom: 0,
				left: 0,
				width: pct + "%",
				background: "var(--dsw-alias-label-primary,#545557)",
				transition: "width .5s cubic-bezier(.4,0,.2,1)"
			} })), react.createElement("div", {
				className: "dsh-upd-ink2",
				style: {
					display: "flex",
					fontSize: 12
				}
			}, react.createElement("span", null, "已用 " + secsText(elapsedMs)), react.createElement("span", { style: { marginLeft: "auto" } }, eta)), message ? react.createElement("div", {
				className: "dsh-upd-ink3",
				style: {
					fontSize: 12,
					marginTop: 12,
					lineHeight: 1.7
				}
			}, message) : null, lastLine ? react.createElement("div", {
				className: "dsh-upd-ink3",
				style: {
					fontSize: 11,
					marginTop: 8,
					fontFamily: MONO,
					whiteSpace: "nowrap",
					overflow: "hidden",
					textOverflow: "ellipsis"
				}
			}, lastLine) : null);
		}
		/** 更新收尾：同一套语言 —— 阶段标签 / 读数 / 1px 线 / 说明 */
		function ResultCard({ ok, message, tail }) {
			const ink = "var(--dsw-alias-label-primary,#545557)";
			return react.createElement("div", {
				className: "dsh-upd-anim",
				style: {
					marginTop: 16,
					padding: "24px 0",
					borderTop: "1px solid var(--dsw-alias-border-l2,#d9dde3)",
					borderBottom: "1px solid var(--dsw-alias-border-l2,#d9dde3)",
					animation: "dshUpdFadeIn .22s ease-out"
				}
			}, react.createElement("div", {
				className: ok ? "dsh-upd-ink2" : void 0,
				style: {
					fontSize: 11,
					letterSpacing: "0.1em",
					marginBottom: 24,
					color: ok ? void 0 : BAD
				}
			}, ok ? "已完成" : "已失败"), react.createElement("div", { style: {
				display: "flex",
				alignItems: "baseline",
				gap: 2
			} }, react.createElement("span", {
				className: "dsh-upd-anim",
				style: {
					fontSize: 44,
					fontWeight: 500,
					lineHeight: 1,
					letterSpacing: "-0.03em",
					fontVariantNumeric: "tabular-nums",
					color: ok ? ink : BAD,
					display: "inline-block",
					animation: "dshUpdRiseIn .2s cubic-bezier(.4,0,.2,1)"
				}
			}, ok ? "100" : "!"), ok ? react.createElement("span", {
				className: "dsh-upd-ink3",
				style: {
					fontSize: 16,
					fontWeight: 400
				}
			}, "%") : null), react.createElement("div", { style: {
				position: "relative",
				height: 1,
				background: ok ? ink : BAD,
				margin: "24px 0 16px"
			} }), react.createElement("div", {
				className: "dsh-upd-ink2",
				style: {
					fontSize: 12,
					lineHeight: 1.85
				}
			}, message), ok ? react.createElement("div", {
				className: "dsh-upd-ink3",
				style: {
					fontSize: 12,
					marginTop: 8,
					lineHeight: 1.85
				}
			}, "请手动重启 dsh（关闭桌面版后重新打开，或运行桌面上的 dsh-restart.bat）使新版本生效。") : null, tail && tail.length ? react.createElement("div", {
				className: "dsh-upd-ink3",
				style: {
					fontSize: 11,
					marginTop: 10,
					fontFamily: MONO,
					whiteSpace: "nowrap",
					overflow: "hidden",
					textOverflow: "ellipsis"
				}
			}, tail[tail.length - 1]) : null);
		}
		/** 检查中：一屏只有三件事 —— 阶段标签 / 1px 彗尾扫动 / 说明（与更新卡同一套语言，不造假百分比） */
		function CheckingCard() {
			return react.createElement("div", {
				className: "dsh-upd-anim",
				style: {
					marginTop: 16,
					padding: "24px 0",
					borderTop: "1px solid var(--dsw-alias-border-l2,#d9dde3)",
					borderBottom: "1px solid var(--dsw-alias-border-l2,#d9dde3)",
					animation: "dshUpdFadeIn .22s ease-out"
				}
			}, react.createElement("div", {
				className: "dsh-upd-ink2",
				style: {
					fontSize: 11,
					letterSpacing: "0.1em",
					marginBottom: 24
				}
			}, "检查更新"), react.createElement("div", {
				className: "dsh-upd-rule",
				style: {
					position: "relative",
					height: 1,
					overflow: "hidden"
				}
			}, react.createElement("div", { className: "dsh-upd-sweep" })), react.createElement("div", {
				className: "dsh-upd-ink3",
				style: {
					fontSize: 12,
					marginTop: 16
				}
			}, "正在对比本地版本与 npm 最新发布版本…"));
		}
		let cacheData = null;
		let cacheStatus = null;
		let lastCheckAt = 0;
		let checkInFlight = 0;
		/**
		* 落盘：只从模块级缓存取值。
		* 0.7.2 及以前是在 applyCheck 里写 JSON.stringify({ data, ... })，那个 data 是 useState 的闭包旧值，
		* 于是「本次结果」永远比盘上晚一轮：会话内第一次检查会存下 data:null，
		* 重启后 if (saved.data) 不成立 → 只剩徽章、版本框和上次检查消失（交接文档里的「半恢复」）。
		*/
		function persist() {
			try {
				localStorage.setItem(LS_KEY, JSON.stringify({
					data: cacheData,
					status: cacheStatus,
					lastCheckAt
				}));
			} catch (e) {
				console.warn("[dsh-update-checker] 写入 localStorage 失败：" + errMsg(e), e);
			}
		}
		function UpdatePage() {
			const [view, setView] = react.useState("entry");
			const [status, setStatus] = react.useState(cacheStatus);
			const [data, setData] = react.useState(cacheData);
			const [error, setError] = react.useState("");
			const [busy, setBusy] = react.useState(false);
			const [phase, setPhase] = react.useState("idle");
			const [progress, setProgress] = react.useState(null);
			const [startedAt, setStartedAt] = react.useState(0);
			const [updateResult, setUpdateResult] = react.useState(null);
			const [tick, setTick] = react.useState(0);
			const [round, setRound] = react.useState(0);
			const [lastCheck, setLastCheck] = react.useState(lastCheckAt);
			const checkStart = react.useRef(0);
			const badgeColor = status?.code === "outdated" ? BAD : status?.code === "ahead" ? "#e5a13b" : OK;
			const agoText = (t) => {
				const d = Date.now() - t;
				if (d < 6e4) return "刚刚";
				if (d < 36e5) return Math.floor(d / 6e4) + " 分钟前";
				if (d < 864e5) return Math.floor(d / 36e5) + " 小时前";
				return Math.floor(d / 864e5) + " 天前";
			};
			const applyCheck = (d) => {
				if (!d?.ok) {
					setStatus({
						code: "unknown",
						label: "检查失败"
					});
					return;
				}
				const nextStatus = d.status || {
					code: "unknown",
					label: "未知"
				};
				setData(d);
				cacheData = d;
				setStatus(nextStatus);
				cacheStatus = nextStatus;
				if (d.error) setError(String(d.error));
				lastCheckAt = Date.now();
				setLastCheck(lastCheckAt);
				persist();
			};
			const check = (silent) => {
				const kind = silent ? "silent" : "manual";
				console.info("[dsh-update-checker] check() 触发：" + kind + " @ " + (/* @__PURE__ */ new Date()).toLocaleTimeString(), (/* @__PURE__ */ new Error("trace")).stack);
				if (checkInFlight && Date.now() - checkInFlight < 3e4) {
					console.warn("[dsh-update-checker] 已有一次检查在途，忽略本次 " + kind + " 触发");
					return;
				}
				checkInFlight = Date.now();
				if (!silent) {
					setView("result");
					setBusy(true);
					setUpdateResult(null);
					checkStart.current = Date.now();
				}
				setError("");
				fetch(API + "/check", { headers: { "content-type": "application/json" } }).then((r) => r.json()).then((d) => {
					checkInFlight = 0;
					if (silent) {
						applyCheck(d);
						return;
					}
					const wait = Math.max(0, 1500 - (Date.now() - checkStart.current));
					setTimeout(() => {
						setBusy(false);
						setRound((r) => r + 1);
						applyCheck(d);
					}, wait);
				}).catch((e) => {
					checkInFlight = 0;
					if (silent) return;
					const wait = Math.max(0, 1500 - (Date.now() - checkStart.current));
					setTimeout(() => {
						setBusy(false);
						setRound((r) => r + 1);
						setError(errMsg(e));
					}, wait);
				});
			};
			react.useEffect(() => {
				let raw = null;
				try {
					raw = localStorage.getItem(LS_KEY);
				} catch (e) {
					console.warn("[dsh-update-checker] 恢复：读 localStorage 抛错 " + errMsg(e), e);
					return;
				}
				if (raw == null) {
					console.info("[dsh-update-checker] 恢复：该 origin 下没有记录（LS 键 " + LS_KEY + "）");
					return;
				}
				let saved = null;
				try {
					saved = JSON.parse(raw);
				} catch (e) {
					console.warn("[dsh-update-checker] 恢复：JSON 解析失败 rawLen=" + raw.length + " head=" + raw.slice(0, 200), e);
					return;
				}
				if (!saved || typeof saved !== "object") {
					console.warn("[dsh-update-checker] 恢复：记录形态异常", saved);
					return;
				}
				if (saved.data) {
					setData(saved.data);
					cacheData = saved.data;
				}
				if (saved.status) {
					setStatus(saved.status);
					cacheStatus = saved.status;
				}
				const t = Number(saved.lastCheckAt) || 0;
				if (t) {
					lastCheckAt = t;
					setLastCheck(t);
				}
				console.info("[dsh-update-checker] 恢复：data=" + (saved.data ? "yes" : "NO") + " status=" + (saved.status && saved.status.code || "NO") + " lastCheckAt=" + t + " build=0.7.6+20260914-2009");
			}, []);
			react.useEffect(() => {
				let alive = true;
				fetch(API + "/update/status", { headers: { "content-type": "application/json" } }).then((r) => r.json()).then((d) => {
					if (!alive || !d || !d.ok) return;
					if (d.running) {
						setProgress(d);
						setStartedAt(Number(d.startedAt) || Date.now());
						setPhase("updating");
						setView("result");
						return;
					}
					const fin = Number(d.finishedAt) || 0;
					if (fin && Date.now() - fin < 3e5 && (d.stage === "done" || d.stage === "failed")) {
						setProgress(d);
						setUpdateResult(String(d.message || (d.stage === "done" ? "更新完成，请手动重启 dsh。" : "更新失败。")));
						setPhase(d.stage === "done" ? "done" : "failed");
						check(true);
					}
				}).catch(() => {});
				return () => {
					alive = false;
				};
			}, []);
			const doUpdate = () => {
				setError("");
				setUpdateResult(null);
				setProgress(null);
				setStartedAt(Date.now());
				setPhase("updating");
				setView("result");
				fetch(API + "/update", {
					method: "POST",
					headers: { "content-type": "application/json" }
				}).then((r) => r.json()).then((d) => {
					if (!d || !d.ok) {
						setPhase("failed");
						setUpdateResult(d && d.error ? String(d.error) : "更新未能启动");
					}
				}).catch((e) => {
					setPhase("failed");
					setUpdateResult("更新请求失败：" + errMsg(e));
				});
			};
			react.useEffect(() => {
				if (phase !== "updating") return;
				let alive = true;
				let timer = null;
				const poll = () => {
					fetch(API + "/update/status", { headers: { "content-type": "application/json" } }).then((r) => r.json()).then((d) => {
						if (!alive) return;
						if (d && d.ok) {
							setProgress(d);
							if (d.running) {
								timer = setTimeout(poll, 900);
								return;
							}
							if (d.stage === "done") {
								setUpdateResult(String(d.message || "更新完成，请手动重启 dsh。"));
								setPhase("done");
								check(true);
								return;
							}
							if (d.stage === "failed") {
								setUpdateResult(String(d.message || "更新失败。"));
								setPhase("failed");
								return;
							}
						}
						timer = setTimeout(poll, 1200);
					}).catch(() => {
						if (alive) timer = setTimeout(poll, 1500);
					});
				};
				poll();
				return () => {
					alive = false;
					if (timer) clearTimeout(timer);
				};
			}, [phase]);
			react.useEffect(() => {
				if (phase !== "updating") return;
				const id = setInterval(() => setTick((t) => t + 1), 1e3);
				return () => clearInterval(id);
			}, [phase]);
			const updating = phase === "updating";
			const elapsedMs = (() => {
				const t0 = progress?.startedAt || startedAt;
				if (!t0) return 0;
				return Math.max(0, (progress?.finishedAt || Date.now()) - t0);
			})();
			const tail = progress?.tail || [];
			const hasUpdate = status?.code === "outdated" && phase === "idle";
			const showUpdateBtn = status?.code === "outdated";
			const entry = view === "entry";
			const hasResult = !!(data || status);
			const buildStamp = String("0.7.6+20260914-2009");
			const shell = {
				fontFamily: "inherit",
				fontSize: 12,
				lineHeight: 1.6,
				padding: "14px 16px",
				maxWidth: 640
			};
			const styleTag = react.createElement("style", { dangerouslySetInnerHTML: { __html: ANIM_CSS } });
			const title = react.createElement("h3", { style: {
				margin: "0 0 6px",
				fontSize: 13
			} }, "版本更新", entry ? null : react.createElement("span", {
				style: {
					opacity: .45,
					fontSize: 10,
					fontWeight: 400
				},
				title: "构建 " + buildStamp
			}, buildStamp === "dev" ? "dev" : "v" + buildStamp.split("+")[0]));
			const desc = react.createElement("p", { style: {
				opacity: .7,
				fontSize: 11,
				margin: "0 0 12px"
			} }, "检查本机安装的 dsh 是否为官方最新版本；发现新版本时，可直接一键升级。");
			const checkBtn = react.createElement("button", {
				className: "dsh-upd-btn",
				disabled: busy || updating,
				onClick: () => check()
			}, busy ? react.createElement(Spinner, { size: 13 }) : null, busy ? "检查中…" : entry || !data ? "检查更新" : "重新检查");
			if (entry) return react.createElement("div", { style: shell }, styleTag, title, desc, react.createElement("div", { style: {
				display: "flex",
				alignItems: "center",
				gap: 8,
				marginTop: 14
			} }, checkBtn), hasResult ? react.createElement("div", { style: { marginTop: 2 } }, react.createElement("button", {
				className: "dsh-upd-link",
				style: status?.code === "outdated" ? { color: BAD } : void 0,
				onClick: () => setView("result")
			}, "查看上次结果" + (status ? " · " + status.label : "") + (lastCheck ? " · " + agoText(lastCheck) : ""))) : null);
			return react.createElement("div", { style: shell }, styleTag, title, desc, busy ? react.createElement(CheckingCard) : react.createElement("div", {
				key: "res" + round,
				className: "dsh-upd-anim",
				style: { animation: "dshUpdRiseIn .2s cubic-bezier(.4,0,.2,1)" }
			}, status ? react.createElement("span", { style: {
				display: "inline-block",
				padding: "2px 10px",
				borderRadius: 10,
				fontSize: 11,
				color: "#fff",
				margin: "4px 0 12px",
				background: badgeColor
			} }, status.label) : null, data ? react.createElement("div", { style: {
				marginTop: 4,
				padding: "2px 14px",
				border: "1px solid var(--dsw-alias-border-l2,#d9dde3)",
				borderRadius: 10,
				background: "var(--dsw-alias-bg-layer-2,transparent)"
			} }, react.createElement(Row, {
				k: "当前版本",
				v: data.localVersion ?? "未知"
			}), data.latest != null ? react.createElement(Row, {
				k: "官方 latest",
				v: String(data.latest)
			}) : null, data.next != null ? react.createElement(Row, {
				k: "官方 next（预发布）",
				v: String(data.next)
			}) : null, lastCheck || lastCheckAt ? react.createElement(Row, {
				k: "上次检查",
				v: agoText(lastCheck || lastCheckAt)
			}) : null) : null, data?.changelog ? react.createElement("div", { style: {
				margin: "12px 0",
				padding: "10px 12px",
				background: "var(--dsw-alias-bg-layer-2,transparent)",
				borderRadius: 8,
				border: "1px solid var(--dsw-alias-border-l2,#d9dde3)"
			} }, react.createElement("div", { style: {
				fontSize: 11,
				fontWeight: 600,
				marginBottom: 4,
				color: "var(--dsw-alias-label-primary,#545557)"
			} }, hasUpdate ? "最新版本更新内容：" : "当前版本说明："), react.createElement("div", { style: {
				fontSize: 11,
				color: "var(--dsw-alias-label-secondary,#7f8287)",
				lineHeight: 1.6,
				whiteSpace: "pre-wrap"
			} }, data.changelog)) : null), react.createElement("div", { style: {
				display: "flex",
				alignItems: "center",
				gap: 8,
				marginTop: 14
			} }, checkBtn, showUpdateBtn && !busy ? react.createElement("button", {
				className: "dsh-upd-btn dsh-upd-btn-primary",
				disabled: updating,
				onClick: doUpdate
			}, updating ? react.createElement(Spinner, { size: 13 }) : null, updating ? "更新中…" : "立即更新") : null), updating ? react.createElement(UpdatingCard, {
				stage: progress?.stage,
				message: progress?.message,
				elapsedMs,
				tail
			}) : null, phase === "done" ? react.createElement(ResultCard, {
				ok: true,
				message: updateResult || "更新完成，请手动重启 dsh。",
				tail
			}) : null, phase === "failed" ? react.createElement(ResultCard, {
				ok: false,
				message: updateResult || "更新失败。",
				tail
			}) : null, error ? react.createElement("div", { style: {
				color: BAD,
				marginTop: 8,
				fontSize: 11
			} }, "错误：" + error) : null);
		}
		function apply(ctx) {
			ctx.effect(() => ctx.slots.inject("settings.section", () => ctx.slots.register({
				name: "settings.section",
				id: "dsh-update",
				order: 55,
				label: () => "更新"
			}, UpdatePage)), "dsh-update-checker: settings page");
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map