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
		function Row({ k, v }) {
			return react.createElement("div", { style: {
				display: "flex",
				justifyContent: "space-between",
				padding: "7px 0",
				borderBottom: "1px solid var(--theme-border,#333)"
			} }, react.createElement("span", { style: { opacity: .8 } }, k), react.createElement("span", { style: {
				fontWeight: 600,
				fontFamily: "monospace"
			} }, v));
		}
		function UpdatePage() {
			const [status, setStatus] = react.useState(null);
			const [data, setData] = react.useState(null);
			const [error, setError] = react.useState("");
			const [busy, setBusy] = react.useState(false);
			const [updating, setUpdating] = react.useState(false);
			const [updateResult, setUpdateResult] = react.useState(null);
			const badgeColor = status?.code === "outdated" ? "#e5534b" : status?.code === "ahead" ? "#e5a13b" : "#2da44e";
			const check = () => {
				setBusy(true);
				setError("");
				setStatus(null);
				setUpdateResult(null);
				fetch(API + "/check", { headers: { "content-type": "application/json" } }).then((r) => r.json()).then((d) => {
					setBusy(false);
					if (!d?.ok) {
						setStatus({
							code: "unknown",
							label: "检查失败"
						});
						return;
					}
					setData(d);
					setStatus(d.status || {
						code: "unknown",
						label: "未知"
					});
					if (d.error) setError(String(d.error));
				}).catch((e) => {
					setBusy(false);
					setError(String(e && e.message ? e.message : e));
				});
			};
			const doUpdate = () => {
				setUpdating(true);
				setUpdateResult(null);
				fetch(API + "/update", {
					method: "POST",
					headers: { "content-type": "application/json" }
				}).then((r) => r.json()).then((d) => {
					setUpdating(false);
					setUpdateResult(d.ok ? d.message : "更新失败: " + (d.error || "未知错误"));
				}).catch((e) => {
					setUpdating(false);
					setUpdateResult("更新请求失败: " + String(e && e.message ? e.message : e));
				});
			};
			const hasUpdate = status?.code === "outdated" && !updateResult;
			return react.createElement("div", { style: {
				fontFamily: "var(--theme-font, sans-serif)",
				fontSize: 12,
				lineHeight: 1.6,
				padding: "14px 16px",
				maxWidth: 640
			} }, react.createElement("h3", { style: {
				margin: "0 0 8px",
				fontSize: 13
			} }, "dsh 官方更新检查"), react.createElement("p", { style: {
				opacity: .7,
				fontSize: 11,
				margin: "0 0 12px"
			} }, "对比 npm 上 @deepseek-ai/dsh 官方发布版本与本地安装版本。"), status ? react.createElement("span", { style: {
				display: "inline-block",
				padding: "2px 10px",
				borderRadius: 10,
				fontSize: 11,
				color: "#fff",
				margin: "4px 0 10px",
				background: badgeColor
			} }, status.label) : null, data ? react.createElement("div", null, react.createElement(Row, {
				k: "当前版本",
				v: data.localVersion ?? "未知"
			}), data.latest != null ? react.createElement(Row, {
				k: "官方 latest",
				v: String(data.latest)
			}) : null, data.next != null ? react.createElement(Row, {
				k: "官方 next（预发布）",
				v: String(data.next)
			}) : null) : null, data?.changelog ? react.createElement("div", { style: {
				margin: "10px 0",
				padding: "10px 12px",
				background: "var(--theme-bg-secondary,#1e1e1e)",
				borderRadius: 8,
				border: "1px solid var(--theme-border,#444)"
			} }, react.createElement("div", { style: {
				fontSize: 11,
				fontWeight: 600,
				marginBottom: 4,
				color: "var(--theme-text, #eee)"
			} }, hasUpdate ? "最新版本更新内容：" : "当前版本说明："), react.createElement("div", { style: {
				fontSize: 11,
				color: "var(--theme-text, #ccc)",
				lineHeight: 1.6,
				whiteSpace: "pre-wrap"
			} }, data.changelog)) : null, react.createElement("div", { style: {
				display: "flex",
				gap: 8,
				marginTop: 14
			} }, react.createElement("button", {
				style: {
					padding: "8px 16px",
					borderRadius: 6,
					cursor: "pointer",
					border: "1px solid var(--theme-border,#444)",
					background: "var(--theme-bg-interactive,#333)",
					color: "#fff"
				},
				disabled: busy,
				onClick: check
			}, busy ? "检查中…" : data ? "重新检查" : "检查更新"), hasUpdate ? react.createElement("button", {
				style: {
					padding: "8px 16px",
					borderRadius: 6,
					cursor: "pointer",
					border: "1px solid #2da44e",
					background: "#2da44e",
					color: "#fff"
				},
				disabled: updating,
				onClick: doUpdate
			}, updating ? "更新中，请勿关闭…" : "立即更新") : null), error ? react.createElement("div", { style: {
				color: "#e5534b",
				marginTop: 8,
				fontSize: 11
			} }, "错误：" + error) : null, updateResult ? react.createElement("div", { style: {
				color: updateResult.includes("成功") || updateResult.includes("重启") ? "#2da44e" : "#e5534b",
				marginTop: 8,
				fontSize: 11
			} }, updateResult) : null);
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