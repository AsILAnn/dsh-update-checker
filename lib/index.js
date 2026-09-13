import { readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { join } from "node:path";
//#region src/index.ts
const name = "dsh-update-checker";
const inject = ["webServer"];
const DSH_PKG = join("C:", "Users", "s", "AppData", "Roaming", "npm", "node_modules", "@deepseek-ai", "dsh", "package.json");
const DIST_TAGS_URL = "https://registry.npmjs.org/-/package/@deepseek-ai/dsh/dist-tags";
function compare(a, b) {
	const m = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/.exec(String(a ?? "").trim());
	const n = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/.exec(String(b ?? "").trim());
	if (!m || !n) return 0;
	const A = [
		Number(m[1]),
		Number(m[2]),
		Number(m[3])
	];
	const B = [
		Number(n[1]),
		Number(n[2]),
		Number(n[3])
	];
	for (let i = 0; i < 3; i++) if (A[i] !== B[i]) return A[i] < B[i] ? -1 : 1;
	const ap = m[4] ? m[4].split(".") : null;
	const bp = n[4] ? n[4].split(".") : null;
	if (!ap && !bp) return 0;
	if (!ap) return 1;
	if (!bp) return -1;
	const len = Math.max(ap.length, bp.length);
	for (let i = 0; i < len; i++) {
		const x = ap[i], y = bp[i];
		if (x === void 0) return -1;
		if (y === void 0) return 1;
		if (x === y) continue;
		const nx = /^\d+$/.test(x), ny = /^\d+$/.test(y);
		if (nx && ny) {
			if (+x !== +y) return +x < +y ? -1 : 1;
			continue;
		}
		if (nx) return -1;
		if (ny) return 1;
		if (x < y) return -1;
		return 1;
	}
	return 0;
}
function readLocalVersion() {
	try {
		const pkg = JSON.parse(readFileSync(DSH_PKG, "utf8"));
		return pkg && typeof pkg.version === "string" ? pkg.version : null;
	} catch {
		return null;
	}
}
async function fetchDistTags() {
	try {
		const res = await fetch(DIST_TAGS_URL, { signal: AbortSignal.timeout(15e3) });
		if (!res.ok) return {
			latest: null,
			next: null,
			error: "HTTP " + res.status
		};
		const tags = await res.json();
		return {
			latest: tags.latest != null ? String(tags.latest) : null,
			next: tags.next != null ? String(tags.next) : null,
			error: null
		};
	} catch (e) {
		return {
			latest: null,
			next: null,
			error: String(e && e.message ? e.message : e)
		};
	}
}
/** 从 GitHub Releases 拉取 release notes，提取中文要点、去掉 HTML/markdown 格式 */
async function fetchChangelog(version) {
	if (!version) return null;
	try {
		const res = await fetch("https://api.github.com/repos/deepseek-ai/deepseek-harness/releases?per_page=5", { signal: AbortSignal.timeout(1e4) });
		if (!res.ok) return null;
		const releases = await res.json();
		const raw = releases.find((r) => {
			const tag = (r.tag_name || "").toLowerCase();
			return tag.includes(version.toLowerCase()) || tag === "v" + version || tag === version;
		})?.body || releases[0]?.body;
		if (!raw) return null;
		const cnMatch = raw.match(/#cn[\s\S]*?\n([\s\S]*?)(?=\n---|\n<h3 id="en|$)/);
		let text = cnMatch ? cnMatch[1] : raw.split("\n---")[0];
		text = text.replace(/<[^>]+>/g, "");
		text = text.replace(/^#{1,3}\s*/gm, "");
		return text.split("\n").map((l) => l.trim()).filter((l) => l.startsWith("*") || l.startsWith("-") || /^[A-Z一-鿿]/.test(l)).slice(0, 20).join("\n") || null;
	} catch {
		return null;
	}
}
function buildStatus(local, latest, next, error) {
	if (!local) return {
		label: "未知",
		code: "unknown"
	};
	if (error) return {
		label: "无法检查",
		code: "error"
	};
	const cmpL = latest != null ? compare(local, latest) : null;
	const cmpN = next != null ? compare(local, next) : null;
	if (cmpL === 0 || cmpN === 0) return {
		label: "已是最新",
		code: "uptodate"
	};
	if (cmpL != null && cmpL < 0) return {
		label: "有新版可用",
		code: "outdated"
	};
	if (cmpN != null && cmpN < 0) return {
		label: "有新版可用",
		code: "outdated"
	};
	return {
		label: "领先于最新发布",
		code: "ahead"
	};
}
function sendJson(res, code, body) {
	res.writeHead(code, { "content-type": "application/json" });
	res.end(JSON.stringify(body));
}
const TAIL_LIMIT = 80;
const updateState = {
	running: false,
	stage: "idle",
	message: "",
	startedAt: null,
	finishedAt: null,
	exitCode: null,
	tail: []
};
function errText(e) {
	return String(e && e.message ? e.message : e);
}
/** 收集 npm 输出：去掉 ANSI 色码、裁剪行数，并按关键词推进阶段 */
function noteOutput(chunk) {
	for (const raw of String(chunk).split(/\r\n|\r|\n/)) {
		const line = raw.replace(/\u001b\[[0-9;]*[A-Za-z]/g, "").trim();
		if (!line) continue;
		updateState.tail.push(line);
		if (updateState.tail.length > TAIL_LIMIT) updateState.tail.splice(0, updateState.tail.length - TAIL_LIMIT);
		if (updateState.stage === "done" || updateState.stage === "failed") continue;
		if (/idealTree|http fetch|fetch manifest|npm warn/i.test(line)) {
			updateState.stage = "downloading";
			updateState.message = "正在从 npm 下载 @deepseek-ai/dsh@latest…";
			continue;
		}
		if (/reify|extract|tarball/i.test(line)) {
			updateState.stage = "installing";
			updateState.message = "正在写入安装文件…";
			continue;
		}
		if (/added \d+ package|changed \d+ package|removed \d+ package|up to date/i.test(line)) {
			updateState.stage = "installing";
			updateState.message = "正在完成安装…";
		}
	}
}
/** 后台执行 npm 全局更新；返回是否成功启动（重复调用返回 false） */
function runUpdate() {
	if (updateState.running) return false;
	updateState.running = true;
	updateState.stage = "preparing";
	updateState.message = "正在启动 npm…";
	updateState.startedAt = Date.now();
	updateState.finishedAt = null;
	updateState.exitCode = null;
	updateState.tail = [];
	let child;
	try {
		child = spawn("cmd.exe", ["/c", "npm i -g @deepseek-ai/dsh@latest"], {
			stdio: [
				"ignore",
				"pipe",
				"pipe"
			],
			windowsHide: true
		});
	} catch (e) {
		updateState.running = false;
		updateState.stage = "failed";
		updateState.finishedAt = Date.now();
		updateState.message = "无法启动 npm：" + errText(e);
		return true;
	}
	updateState.stage = "downloading";
	updateState.message = "正在执行 npm i -g @deepseek-ai/dsh@latest…";
	if (child.stdout) child.stdout.on("data", noteOutput);
	if (child.stderr) child.stderr.on("data", noteOutput);
	child.on("error", (e) => {
		updateState.running = false;
		updateState.stage = "failed";
		updateState.finishedAt = Date.now();
		updateState.message = "npm 启动失败：" + errText(e);
	});
	child.on("exit", (code) => {
		updateState.running = false;
		updateState.exitCode = code;
		updateState.finishedAt = Date.now();
		if (code === 0) {
			updateState.stage = "done";
			updateState.message = "更新完成，新版已写入安装目录。请手动重启 dsh 使其生效。";
		} else {
			updateState.stage = "failed";
			updateState.message = "npm 退出码 " + String(code) + "，更新未完成（常见原因：文件被占用或网络不可达）。";
		}
	});
	return true;
}
function apply(ctx) {
	ctx.effect(() => ctx.webServer.register({
		kind: "prefix",
		path: "/dsh-update/api",
		handler: async (req, res) => {
			const p = (req.url ?? "/").split("?")[0];
			if (req.method === "GET" && p.endsWith("/check")) {
				console.log("[dsh-update-check] /check 请求 @", (/* @__PURE__ */ new Date()).toISOString());
				const local = readLocalVersion();
				const { latest, next, error } = await fetchDistTags();
				return sendJson(res, 200, {
					ok: true,
					localVersion: local,
					latest,
					next,
					error,
					status: buildStatus(local, latest, next, error),
					changelog: await fetchChangelog(latest && local && compare(local, latest) < 0 ? latest : next)
				});
			}
			if (req.method === "POST" && p.endsWith("/update")) {
				if (updateState.running) return sendJson(res, 200, {
					ok: false,
					error: "更新正在进行中，请稍候…"
				});
				const started = runUpdate();
				return sendJson(res, 200, {
					ok: started,
					message: started ? "更新已开始…" : "更新正在进行中",
					startedAt: updateState.startedAt
				});
			}
			if (req.method === "GET" && p.endsWith("/update/status")) return sendJson(res, 200, {
				ok: true,
				running: updateState.running,
				stage: updateState.stage,
				message: updateState.message,
				startedAt: updateState.startedAt,
				finishedAt: updateState.finishedAt,
				exitCode: updateState.exitCode,
				elapsedMs: updateState.startedAt ? (updateState.finishedAt ?? Date.now()) - updateState.startedAt : 0,
				tail: updateState.tail.slice(-12)
			});
			return sendJson(res, 404, {
				ok: false,
				error: "not found"
			});
		}
	}), "dsh-update-checker: api route");
}
//#endregion
export { apply, inject, name };

//# sourceMappingURL=index.js.map