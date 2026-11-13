import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { BaseUrlError } from "./config";
import type { GoDurationError } from "./format";
import type { TaskStatus } from "../types";

export type Locale = "zh" | "en";

const LOCALE_KEY = "schedy-ui.locale.v1";

export function localeTag(locale: Locale): string {
  return locale === "zh" ? "zh-CN" : "en-US";
}

export function loadLocale(): Locale {
  try {
    const saved = localStorage.getItem(LOCALE_KEY);
    if (saved === "zh" || saved === "en") return saved;
  } catch {
    // localStorage may be unavailable in hardened browser profiles.
  }
  if (typeof navigator !== "undefined" && navigator.language.toLowerCase().startsWith("en")) {
    return "en";
  }
  return "zh";
}

export function saveLocale(locale: Locale): void {
  try {
    localStorage.setItem(LOCALE_KEY, locale);
  } catch {
    // Ignore storage failures; the in-memory preference still works.
  }
}

const zh = {
  "meta.description": "Schedy Console - 管理和监控 Schedy 定时 HTTP 任务的轻量 Web 界面。",

  "common.cancel": "取消",
  "common.confirm": "确认",
  "common.save": "保存",
  "common.close": "关闭",
  "common.back": "返回",
  "common.retry": "重试",
  "common.refresh": "刷新",
  "common.testConnection": "测试连接",
  "common.optional": "可选",
  "common.notSet": "未设置",
  "common.notConfigured": "未配置",
  "common.unknown": "未知",
  "common.copy": "复制",
  "common.copyFailed": "复制失败",
  "common.clipboardDenied": "浏览器拒绝了剪贴板访问。",
  "common.retryLater": "请稍后重试。",
  "common.apiDocs": "API 文档",
  "common.proxyMode": "本地代理",
  "common.directMode": "浏览器直连",
  "common.online": "在线",
  "common.offline": "离线",
  "common.connecting": "连接中",
  "common.ready": "就绪",
  "common.notReady": "未就绪",
  "common.checking": "检查中…",

  "error.metrics": "指标加载失败。",
  "error.list": "任务列表加载失败。",
  "error.listRefresh": "任务列表刷新失败。",
  "error.taskDetail": "任务详情加载失败。",
  "error.refresh": "刷新失败。",
  "error.cancel": "取消失败",
  "error.replay": "重放失败",
  "error.save": "保存失败，请稍后重试。",
  "error.delete": "删除失败，请稍后重试。",
  "error.backup": "备份下载失败",
  "error.health": "健康检查失败。",
  "error.ready": "就绪检查失败。",

  "api.status.400": "请求参数无效。",
  "api.status.401": "缺少 API Key，或服务端未收到 API Key。",
  "api.status.403": "API Key 无效。",
  "api.status.404": "请求的资源不存在。",
  "api.status.405": "服务端不允许此请求方法。",
  "api.status.409": "任务当前状态不允许此操作。",
  "api.status.413": "请求体超过服务端限制。",
  "api.status.500": "Schedy 服务内部错误。",
  "api.status.502": "无法连接 Schedy 服务。",
  "api.httpFailed": (status: number) => `请求失败（HTTP ${status}）。`,
  "api.timeout": "请求超时，Schedy 服务或本地代理没有响应。",
  "api.proxyUnreachable":
    "无法访问本地代理。请确认页面是通过 `pnpm dev` 或 `pnpm start` 打开的，或切换到直连模式。",
  "api.directUnreachable":
    "无法访问 Schedy 服务。请检查服务地址、网络连接，以及服务端是否配置了 SCHEDY_CORS_ORIGIN。",
  "api.nonJson": (status: number, preview: string) =>
    `服务端返回了非 JSON 响应（HTTP ${status}）。请确认地址指向 Schedy 服务或本地代理。${
      preview ? ` 响应片段：${preview}` : ""
    }`,
  "api.invalidJson": "服务端返回了无法解析的 JSON。",
  "api.backupFailed": (status: number) => `备份下载失败（HTTP ${status}）。`,
  "api.authInvalid": "API Key 无效或已被拒绝。",
  "api.authRequired": "该服务要求填写 API Key。",

  "validate.baseUrlRequired": "请填写 Schedy 服务地址",
  "validate.baseUrlQuery": "服务地址不能包含查询参数或锚点",
  "validate.proxyProtocol": "代理模式仅支持 http/https 地址",
  "validate.proxyInvalid": "请填写完整的 http(s) 地址，例如 http://127.0.0.1:8080",
  "validate.directProtocol": "直连模式仅支持 http/https 地址",
  "validate.directInvalid": "请填写完整的 http(s) 地址，或以 / 开头的同源路径",

  "duration.required": "请输入间隔",
  "duration.format": '格式无效，示例："30s"、"15m"、"2h"、"1h30m"',
  "duration.positive": "间隔必须大于 0",

  "nav.label": "主导航",
  "nav.tasks": "任务",
  "nav.system": "系统",

  "header.switchToLight": "切换到浅色主题",
  "header.switchToDark": "切换到深色主题",
  "header.connectionSettings": "连接设置",
  "header.switchLanguage": "切换到英文",
  "header.languageLabel": "EN",

  "app.settingsSaved": "连接设置已保存",
  "app.disconnectedTitle": "已断开连接",
  "app.disconnectedDescription": "本地保存的服务地址和 API Key 已清除。",

  "connect.eyebrow": "Schedy HTTP Task Scheduler",
  "connect.titleLead": "管理你的",
  "connect.titleAccent": "定时 HTTP 任务",
  "connect.lead":
    "创建、检查、重放和清理 Schedy 任务。连接信息只保存在本机浏览器，不会写进构建产物。",
  "connect.point1": "任务列表、状态统计与尝试历史",
  "connect.point2": "新建、编辑、取消、重放与批量清理",
  "connect.point3": "健康检查、Prometheus 指标与数据库备份",
  "connect.heading": "连接到 Schedy",
  "connect.subheading": "填写服务地址和 API Key 后开始管理任务。",
  "connect.testSuccess": (version: string) => `连接成功 · Schedy ${version} · 认证通过`,
  "connect.testWarning": (version: string, reason: string) =>
    `服务可访问（${version}），但 ${reason}`,
  "connect.testFailed": "连接失败，请检查配置。",
  "connect.start": "开始使用",
  "connect.footnoteBefore": "尚未填写 API Key？如果 Schedy 没有设置 ",
  "connect.footnoteAfter": "，可以留空。",

  "connection.mode": "连接方式",
  "connection.proxy": "本地代理",
  "connection.direct": "浏览器直连",
  "connection.recommended": "推荐",
  "connection.proxyHint":
    "请求经当前页面同源的 /__schedy 转发，无需在 Schedy 上开启 CORS。需要页面由 pnpm dev 或 pnpm start 提供。",
  "connection.directHint":
    "浏览器直接访问 Schedy。需要在 Schedy 启动时设置 SCHEDY_CORS_ORIGIN，允许当前页面来源。",
  "connection.serverUrl": "Schedy 服务地址",
  "connection.serverUrlHint": "完整 origin，可带路径前缀，例如 https://example.com/schedy",
  "connection.apiKeyPlaceholder": "未启用 SCHEDY_API_KEY 时可留空",
  "connection.apiKeyHint": "作为 X-API-Key 请求头发送；仅保存在当前浏览器的 localStorage 中。",
  "connection.showApiKey": "显示 API Key",
  "connection.hideApiKey": "隐藏 API Key",
  "connection.autoRefresh": "自动刷新",
  "connection.off": "关闭",
  "connection.everySeconds": (seconds: number) => `每 ${seconds} 秒`,
  "connection.autoRefreshHint": "仅刷新任务列表和统计，不会修改任何任务。",

  "settings.title": "连接设置",
  "settings.description": "服务地址与 API Key 只保存在当前浏览器中。",
  "settings.disconnectConfirm": "清除连接信息？",
  "settings.clear": "清除",
  "settings.disconnect": "断开连接",
  "settings.corsTitle": "关于 CORS",
  "settings.corsPrefix": "直连模式要求 Schedy 服务端设置 ",
  "settings.corsSuffix": "。如果无法修改服务端，请保持“本地代理”模式。",

  "status.pending": "待执行",
  "status.running": "执行中",
  "status.succeeded": "成功",
  "status.failed": "失败",
  "status.cancelled": "已取消",
  "status.desc.pending": "已排期，等待触发",
  "status.desc.running": "请求发送中",
  "status.desc.succeeded": "最近一次投递成功",
  "status.desc.failed": "重试耗尽或请求失败",
  "status.desc.cancelled": "已取消，保留历史",

  "retry.fixed": "固定间隔",
  "retry.exponential": "指数退避",
  "retry.fixedShort": "固定",
  "retry.exponentialShort": "指数",
  "retry.exponentialJitter": "指数退避 + 抖动",

  "stats.all": "全部任务",
  "stats.selectAll": "选择查看全部",
  "stats.deliveries": (count: number) => `${count} 次投递`,
  "stats.overdue": (count: number) => `${count} 个已逾期`,
  "stats.noOverdue": "无逾期任务",

  "table.status": "状态",
  "table.target": "目标",
  "table.scheduled": "计划执行",
  "table.attempts": "尝试",
  "table.view": "查看",
  "table.openTask": (url: string) => `查看任务 ${url}`,
  "table.repeatInterval": "重复间隔",
  "table.failedRetry": "失败重试",
  "table.retryCount": (count: number, mode: string) => `${count} 次 · ${mode}`,
  "table.noRetry": "不重试",
  "table.timeout": "单次超时",
  "table.finishedAt": (time: string) => `完成于 ${time}`,
  "table.attemptsCount": (count: number) => `${count} 次`,

  "tasks.title": "任务",
  "tasks.subtitle": "查看、创建和管理 Schedy 定时 HTTP 任务。",
  "tasks.refreshTitle": "刷新列表与统计",
  "tasks.create": "新建任务",
  "tasks.metricsUnavailable": (error: string) => `状态统计暂不可用：${error}`,
  "tasks.urlPlaceholder": "按目标 URL 精确筛选",
  "tasks.filter": "筛选",
  "tasks.exactMatch": (url: string) => `精确匹配：${url}`,
  "tasks.clearUrlFilter": "清除 URL 筛选",
  "tasks.dueAfter": "执行晚于",
  "tasks.dueBefore": "早于",
  "tasks.perPage": "每页",
  "tasks.pageSize": "每页数量",
  "tasks.clearFilters": "清除筛选",
  "tasks.loaded": (count: number) => `已加载 ${count} 个任务`,
  "tasks.updatedAt": (time: string) => `更新于 ${time}`,
  "tasks.autoRefreshTitle": (seconds: number) => `每 ${seconds} 秒自动刷新`,
  "tasks.bulkDelete": "批量删除",
  "tasks.emptyFilteredTitle": "没有符合条件的任务",
  "tasks.emptyFilteredBody": "尝试放宽筛选条件，或清除筛选后查看全部任务。",
  "tasks.emptyTitle": "还没有任务",
  "tasks.emptyBody": "创建第一个定时 HTTP 请求，Schedy 会在指定时间投递它。",
  "tasks.loadErrorTitle": "无法加载任务列表",
  "tasks.loadErrorHint1": "确认 Schedy 服务地址和 API Key 是否填写正确。",
  "tasks.loadErrorHint2": "如果使用直连模式，确认服务端设置了允许当前来源的 SCHEDY_CORS_ORIGIN。",
  "tasks.loadErrorHint3": "如果使用本地代理，确认页面由 pnpm dev 或 pnpm start 提供。",
  "tasks.checkSettings": "检查连接设置",
  "tasks.loadingMore": "正在加载…",
  "tasks.loadMore": "加载更多",
  "tasks.listFootnote": "按计划执行时间排序 · 游标分页",
  "tasks.createdToast": "任务已创建",
  "tasks.updatedToast": "任务已更新",
  "tasks.loadMoreFailed": "加载更多失败",

  "bulk.title": "批量删除任务",
  "bulk.description": "按条件永久删除任务记录。此操作无法撤销。",
  "bulk.warning": "与“取消任务”不同，这里会从 BadgerDB 中硬删除记录，不影响正在执行的其他任务。",
  "bulk.quickFilters": "快捷筛选",
  "bulk.presetFailed": "7 天前的失败任务",
  "bulk.presetCancelled": "7 天前的已取消任务",
  "bulk.status": "状态",
  "bulk.anyStatus": "任意状态",
  "bulk.urlExact": "URL 精确匹配",
  "bulk.urlPlaceholder": "留空则不按 URL 筛选",
  "bulk.before": "计划执行早于",
  "bulk.after": "计划执行晚于",
  "bulk.summaryLabel": "将删除",
  "bulk.summaryEmpty": "请至少设置一个筛选条件",
  "bulk.summary": (filters: string) => `${filters} 的任务`,
  "bulk.filterStatus": (label: string) => `状态为「${label}」`,
  "bulk.filterUrl": (url: string) => `URL 精确匹配「${url}」`,
  "bulk.filterBefore": (value: string) => `计划执行早于 ${value}`,
  "bulk.filterAfter": (value: string) => `计划执行晚于 ${value}`,
  "bulk.filterJoin": "，",
  "bulk.permanentDelete": "永久删除",
  "bulk.requiresFilter": "至少需要一个筛选条件，服务端不接受无条件删除。",
  "bulk.deletedTitle": (count: number) => `已删除 ${count} 个任务`,
  "bulk.deletedDescription": "删除是永久性的，无法撤销。",

  "drawer.title": "任务详情",
  "drawer.taskId": "任务 ID",
  "drawer.copyTaskId": "复制任务 ID",
  "drawer.refresh": "刷新详情",
  "drawer.close": "关闭详情",
  "drawer.loading": "正在加载任务详情…",
  "drawer.copyUrl": "复制 URL",
  "drawer.copyCurl": "复制 cURL",
  "drawer.overview": "概览",
  "drawer.scheduledAt": "计划执行",
  "drawer.finishedAt": "完成时间",
  "drawer.retryPolicy": "重试策略",
  "drawer.retryPolicyValue": (count: number, interval: number) => `${count} 次 · ${interval} ms`,
  "drawer.retryExponential": "指数退避 + 抖动",
  "drawer.retryFixed": "固定间隔",
  "drawer.timeout": "单次超时",
  "drawer.timeoutDefault": "默认 10 s",
  "drawer.schedule": "重复间隔",
  "drawer.once": "一次性任务",
  "drawer.scheduleNext": "触发后自动创建下一轮",
  "drawer.onFailure": "失败回调",
  "drawer.onFailureSub": "重试耗尽后 POST",
  "drawer.defaultPolicy": "使用服务端默认策略",
  "drawer.idempotencyKey": "幂等键",
  "drawer.status": "任务状态",
  "drawer.attemptsRecorded": (count: number) => `已记录 ${count} 次尝试`,
  "drawer.noAttempts": "尚无投递尝试",
  "drawer.requestBody": "请求体",
  "drawer.copy": "复制",
  "drawer.noBody": "无请求体",
  "drawer.requestHeaders": "请求头",
  "drawer.noHeaders": "无自定义请求头",
  "drawer.attempts": "尝试记录",
  "drawer.attemptsEmpty": "尚未执行，任务到达执行时间后会在这里留下记录。",
  "drawer.attemptNumber": (number: number) => `第 ${number} 次`,
  "drawer.responseBody": "响应体",
  "drawer.truncated": "已截断",
  "drawer.edit": "编辑任务",
  "drawer.replay": "立即重放",
  "drawer.cancel": "取消任务",
  "drawer.closeAction": "关闭",
  "drawer.targetUrl": "目标 URL",
  "drawer.curlCommand": "cURL 命令",
  "drawer.copied": "已复制",
  "drawer.cancelConfirmTitle": "取消这个任务？",
  "drawer.cancelConfirmPrefix": "任务会被标记为 ",
  "drawer.cancelConfirmSuffix": " 并保留历史。若它是重复任务的当前实例，后续实例将不再创建。",
  "drawer.replayConfirmTitle": "立即重放任务？",
  "drawer.replayConfirmPrefix": "任务会重新入队并马上投递。若它此前已经成功，目标服务会",
  "drawer.replayConfirmStrong": "再次收到相同请求",
  "drawer.replayConfirmSuffix": "。",
  "drawer.confirmReplay": "重新投递",
  "drawer.cancelSuccessTitle": "任务已取消",
  "drawer.cancelSuccessDescription": "任务已标记为 cancelled，并保留历史记录。",
  "drawer.replaySuccessTitle": "任务已重新入队",
  "drawer.replaySuccessDescription": "任务将在几秒内再次投递。",

  "form.createTitle": "新建任务",
  "form.editTitle": "编辑任务",
  "form.createDescription": "安排一个在未来执行的 HTTP 请求。",
  "form.editDescription": "只能编辑待执行任务；保存时会全量替换客户端字段。",
  "form.saveChanges": "保存修改",
  "form.create": "创建任务",
  "form.method": "方法",
  "form.url": "请求 URL",
  "form.timezoneHint": (zone: string) => `所有时间按当前浏览器时区显示（${zone}）。`,
  "form.at": "指定时间",
  "form.after": "延迟执行",
  "form.executeAt": "执行时间",
  "form.newExecuteAt": "新的执行时间",
  "form.utcPreview": (iso: string) => `UTC：${iso}`,
  "form.chooseFuture": "请选择未来的时间",
  "form.fromNow": "从现在起",
  "form.minutes": "分钟",
  "form.hours": "小时",
  "form.days": "天",
  "form.delayUnit": "延迟单位",
  "form.body": "请求体",
  "form.bodyHint": "JSON 默认以 application/json 发送；其他类型请自行设置 Content-Type。",
  "form.format": "格式化",
  "form.payloadNone": "无",
  "form.payloadText": "文本",
  "form.noBodyHint": (method: string) => `${method} 请求不发送请求体。`,
  "form.noPayload": "未设置请求体。",
  "form.textPlaceholder": "纯文本请求体",
  "form.headers": "请求头",
  "form.headersHint": "额外的 HTTP 头，会随任务一起保存。",
  "form.add": "添加",
  "form.noHeaders": "未设置自定义请求头。",
  "form.headerName": "Header 名称",
  "form.headerValue": "值",
  "form.headerNameAria": "请求头名称",
  "form.headerValueAria": "请求头值",
  "form.deleteHeader": "删除请求头",
  "form.advancedTitle": "更多设置",
  "form.advancedSub": "重试、超时、失败回调、重复任务与幂等键",
  "form.retries": "失败重试次数",
  "form.retriesHint": "首次失败后最多再尝试的次数",
  "form.retryInterval": "重试间隔（毫秒）",
  "form.retryIntervalHint": "默认 2000 毫秒",
  "form.retryStrategy": "重试策略",
  "form.retryFixedOption": "固定间隔（fixed）",
  "form.retryExpOption": "指数退避（exponential）",
  "form.timeout": "单次超时（毫秒）",
  "form.timeoutPlaceholder": "默认 10000",
  "form.schedule": "重复间隔",
  "form.schedulePlaceholder": "例如 24h、1h30m",
  "form.scheduleHint": "Go duration；触发后按实际时间 + 间隔创建下一轮",
  "form.onFailureUrl": "失败回调 URL",
  "form.idempotencyKey": "幂等键",
  "form.idempotencyPlaceholder": "自动生成；重试时保留同一键可避免重复任务",
  "form.idempotencyHint":
    "每次新建都会自动生成唯一键并随请求发送。保留同一键重试可避免重复任务；重新生成会使用新的任务标识。",
  "form.generate": "生成",
  "form.regenerate": "重新生成",
  "form.taskIdLabel": "任务 ID：",
  "form.err.urlRequired": "请填写请求 URL",
  "form.err.urlInvalid": "请输入完整的 http(s) URL",
  "form.err.executeAtRequired": "请选择执行时间",
  "form.err.executeAtInvalid": "执行时间格式无效",
  "form.err.executeAtPast": "执行时间必须晚于当前时间",
  "form.err.delayPositive": "请输入大于 0 的延迟时间",
  "form.err.delayTooLarge": "延迟时间过大",
  "form.err.payloadInvalid": "JSON 格式无效，请检查逗号、引号或括号。",
  "form.err.jsonFormatInvalid": "JSON 格式无效，无法格式化。",
  "form.err.headerMissingName": "存在没有名称的请求头",
  "form.err.headerDuplicate": (name: string) => `请求头重复：${name}`,
  "form.err.retriesInteger": "重试次数必须是非负整数",
  "form.err.retryIntervalInteger": "重试间隔必须是非负整数（毫秒）",
  "form.err.timeoutRange": "超时必须在 0–300000 毫秒之间",
  "form.err.onFailureInvalid": "失败回调必须是完整的 http(s) URL",
  "form.err.saveFailed": "保存失败，请稍后重试。",

  "system.title": "系统",
  "system.subtitle": "检查 Schedy 运行状态、投递指标并下载数据库备份。",
  "system.health": "服务健康",
  "system.version": "版本",
  "system.latency": "往返时间",
  "system.storage": "数据存储",
  "system.readyNote": "BadgerDB 可访问，服务可以接收任务。",
  "system.notReadyNote": "数据库当前不可访问，服务返回 503。",
  "system.queue": "投递队列",
  "system.queueSubtitle": "Prometheus 指标",
  "system.inflight": "正在投递",
  "system.overdue": "已逾期",
  "system.totalDeliveries": "累计投递",
  "system.connection": "连接",
  "system.connectionSubtitle": "当前浏览器配置",
  "system.change": "修改",
  "system.serverUrl": "服务地址",
  "system.connectionMode": "连接方式",
  "system.apiKey": "API Key",
  "system.autoRefresh": "自动刷新",
  "system.autoRefreshValue": (seconds: number) => `每 ${seconds} 秒`,
  "system.off": "关闭",
  "system.metricsTitle": "任务与投递指标",
  "system.metricsSubtitle": "来自 /metrics，非时间序列快照。",
  "system.copyRaw": "复制原始指标",
  "system.metricsCopied": "指标已复制",
  "system.deliveryResults": "投递结果",
  "system.succeeded": "成功",
  "system.failed": "失败",
  "system.deliveryBarAria": (rate: string) => `投递成功率 ${rate}%`,
  "system.noDeliveryData": "暂无投递数据",
  "system.successRate": (rate: string) => `成功率 ${rate}%`,
  "system.retryCountedSeparately": "重试会分别计数",
  "system.rawSummary": "查看原始 Prometheus 文本",
  "system.metricsLoading": "正在加载指标…",
  "system.backup": "备份",
  "system.backupSubtitle": "下载 BadgerDB 在线快照。",
  "system.backupNoteBefore": "备份包含全部任务和历史记录。下载后可用 ",
  "system.backupNoteAfter": " 离线恢复。",
  "system.backupPreparing": "正在准备备份…",
  "system.downloadBackup": "下载数据库备份",
  "system.securityTitle": "凭据安全",
  "system.securityBody":
    "API Key 只保存在本浏览器 localStorage，并在请求时通过 X-API-Key 发送（代理模式下由本地代理转发）。",
  "system.docs": "阅读 Schedy 文档",
  "system.backupStarted": "备份已开始下载",
};

export type MessageKey = keyof typeof zh;
type MessageSet = typeof zh;
type MessageArgs<K extends MessageKey> = MessageSet[K] extends (...args: infer A) => string
  ? A
  : [];

const en: MessageSet = {
  "meta.description":
    "Schedy Console - a lightweight web UI for managing and monitoring Schedy scheduled HTTP tasks.",

  "common.cancel": "Cancel",
  "common.confirm": "Confirm",
  "common.save": "Save",
  "common.close": "Close",
  "common.back": "Back",
  "common.retry": "Retry",
  "common.refresh": "Refresh",
  "common.testConnection": "Test connection",
  "common.optional": "Optional",
  "common.notSet": "Not set",
  "common.notConfigured": "Not configured",
  "common.unknown": "unknown",
  "common.copy": "Copy",
  "common.copyFailed": "Copy failed",
  "common.clipboardDenied": "The browser denied clipboard access.",
  "common.retryLater": "Please try again later.",
  "common.apiDocs": "API docs",
  "common.proxyMode": "Local proxy",
  "common.directMode": "Direct",
  "common.online": "online",
  "common.offline": "Offline",
  "common.connecting": "Connecting",
  "common.ready": "Ready",
  "common.notReady": "Not ready",
  "common.checking": "Checking…",

  "error.metrics": "Failed to load metrics.",
  "error.list": "Failed to load tasks.",
  "error.listRefresh": "Failed to refresh tasks.",
  "error.taskDetail": "Failed to load task details.",
  "error.refresh": "Refresh failed.",
  "error.cancel": "Could not cancel task",
  "error.replay": "Could not replay task",
  "error.save": "Could not save. Please try again later.",
  "error.delete": "Could not delete. Please try again later.",
  "error.backup": "Backup download failed",
  "error.health": "Health check failed.",
  "error.ready": "Readiness check failed.",

  "api.status.400": "Invalid request parameters.",
  "api.status.401": "Missing API key, or the server did not receive one.",
  "api.status.403": "Invalid API key.",
  "api.status.404": "The requested resource does not exist.",
  "api.status.405": "The server does not allow this request method.",
  "api.status.409": "The task's current state does not allow this operation.",
  "api.status.413": "The request body exceeds the server limit.",
  "api.status.500": "Internal Schedy server error.",
  "api.status.502": "Could not reach the Schedy server.",
  "api.httpFailed": (status: number) => `Request failed (HTTP ${status}).`,
  "api.timeout": "The request timed out. The Schedy server or local proxy did not respond.",
  "api.proxyUnreachable":
    "Could not reach the local proxy. Make sure the page is served by `pnpm dev` or `pnpm start`, or switch to direct mode.",
  "api.directUnreachable":
    "Could not reach the Schedy server. Check the server URL, network connection, and whether the server sets SCHEDY_CORS_ORIGIN.",
  "api.nonJson": (status: number, preview: string) =>
    `The server returned a non-JSON response (HTTP ${status}). Make sure the URL points to a Schedy server or the local proxy.${
      preview ? ` Response preview: ${preview}` : ""
    }`,
  "api.invalidJson": "The server returned invalid JSON.",
  "api.backupFailed": (status: number) => `Backup download failed (HTTP ${status}).`,
  "api.authInvalid": "The API key is invalid or was rejected.",
  "api.authRequired": "This server requires an API key.",

  "validate.baseUrlRequired": "Enter the Schedy server URL",
  "validate.baseUrlQuery": "The server URL cannot contain a query string or fragment",
  "validate.proxyProtocol": "Proxy mode only supports http/https URLs",
  "validate.proxyInvalid": "Enter a full http(s) URL, e.g. http://127.0.0.1:8080",
  "validate.directProtocol": "Direct mode only supports http/https URLs",
  "validate.directInvalid": "Enter a full http(s) URL or a same-origin path starting with /",

  "duration.required": "Enter an interval",
  "duration.format": 'Invalid format. Examples: "30s", "15m", "2h", "1h30m"',
  "duration.positive": "The interval must be greater than 0",

  "nav.label": "Main navigation",
  "nav.tasks": "Tasks",
  "nav.system": "System",

  "header.switchToLight": "Switch to light theme",
  "header.switchToDark": "Switch to dark theme",
  "header.connectionSettings": "Connection settings",
  "header.switchLanguage": "Switch to Chinese",
  "header.languageLabel": "中文",

  "app.settingsSaved": "Connection settings saved",
  "app.disconnectedTitle": "Disconnected",
  "app.disconnectedDescription": "The saved server URL and API key were cleared.",

  "connect.eyebrow": "Schedy HTTP Task Scheduler",
  "connect.titleLead": "Manage your",
  "connect.titleAccent": "scheduled HTTP tasks",
  "connect.lead":
    "Create, inspect, replay, and clean up Schedy tasks. Connection details stay in this browser and are never baked into the build.",
  "connect.point1": "Task list, status stats, and attempt history",
  "connect.point2": "Create, edit, cancel, replay, and bulk cleanup",
  "connect.point3": "Health checks, Prometheus metrics, and database backups",
  "connect.heading": "Connect to Schedy",
  "connect.subheading": "Enter the server URL and API key to start managing tasks.",
  "connect.testSuccess": (version: string) => `Connected · Schedy ${version} · Authenticated`,
  "connect.testWarning": (version: string, reason: string) =>
    `Server reachable (${version}), but ${reason}`,
  "connect.testFailed": "Connection failed. Check your settings.",
  "connect.start": "Get started",
  "connect.footnoteBefore": "No API key yet? Leave this blank if Schedy was started without ",
  "connect.footnoteAfter": ".",

  "connection.mode": "Connection mode",
  "connection.proxy": "Local proxy",
  "connection.direct": "Direct",
  "connection.recommended": "Recommended",
  "connection.proxyHint":
    "Requests are forwarded through the same-origin /__schedy proxy, so Schedy does not need CORS. The page must be served by pnpm dev or pnpm start.",
  "connection.directHint":
    "The browser calls Schedy directly. Start Schedy with SCHEDY_CORS_ORIGIN set to this page's origin.",
  "connection.serverUrl": "Schedy server URL",
  "connection.serverUrlHint":
    "Full origin, optionally with a path prefix, e.g. https://example.com/schedy",
  "connection.apiKeyPlaceholder": "Leave blank if SCHEDY_API_KEY is not enabled",
  "connection.apiKeyHint":
    "Sent as the X-API-Key header; stored only in this browser's localStorage.",
  "connection.showApiKey": "Show API key",
  "connection.hideApiKey": "Hide API key",
  "connection.autoRefresh": "Auto-refresh",
  "connection.off": "Off",
  "connection.everySeconds": (seconds: number) => `Every ${seconds}s`,
  "connection.autoRefreshHint": "Refreshes the task list and stats only; tasks are never modified.",

  "settings.title": "Connection settings",
  "settings.description": "The server URL and API key are stored only in this browser.",
  "settings.disconnectConfirm": "Clear connection details?",
  "settings.clear": "Clear",
  "settings.disconnect": "Disconnect",
  "settings.corsTitle": "About CORS",
  "settings.corsPrefix": "Direct mode requires the Schedy server to set ",
  "settings.corsSuffix": ". If you cannot change the server, keep using local proxy mode.",

  "status.pending": "Pending",
  "status.running": "Running",
  "status.succeeded": "Succeeded",
  "status.failed": "Failed",
  "status.cancelled": "Cancelled",
  "status.desc.pending": "Scheduled and waiting to fire",
  "status.desc.running": "Request in flight",
  "status.desc.succeeded": "Last delivery succeeded",
  "status.desc.failed": "Retries exhausted or request failed",
  "status.desc.cancelled": "Cancelled with history retained",

  "retry.fixed": "Fixed interval",
  "retry.exponential": "Exponential backoff",
  "retry.fixedShort": "Fixed",
  "retry.exponentialShort": "Exponential",
  "retry.exponentialJitter": "Exponential backoff + jitter",

  "stats.all": "All tasks",
  "stats.selectAll": "View all tasks",
  "stats.deliveries": (count: number) =>
    `${count.toLocaleString("en-US")} ${count === 1 ? "delivery" : "deliveries"}`,
  "stats.overdue": (count: number) => `${count.toLocaleString("en-US")} overdue`,
  "stats.noOverdue": "No overdue tasks",

  "table.status": "Status",
  "table.target": "Target",
  "table.scheduled": "Scheduled",
  "table.attempts": "Attempts",
  "table.view": "View",
  "table.openTask": (url: string) => `View task ${url}`,
  "table.repeatInterval": "Repeat interval",
  "table.failedRetry": "Retry on failure",
  "table.retryCount": (count: number, mode: string) =>
    `${count} ${count === 1 ? "retry" : "retries"} · ${mode}`,
  "table.noRetry": "No retries",
  "table.timeout": "Request timeout",
  "table.finishedAt": (time: string) => `Finished ${time}`,
  "table.attemptsCount": (count: number) => `${count} ${count === 1 ? "attempt" : "attempts"}`,

  "tasks.title": "Tasks",
  "tasks.subtitle": "View, create, and manage scheduled HTTP tasks in Schedy.",
  "tasks.refreshTitle": "Refresh list and stats",
  "tasks.create": "New task",
  "tasks.metricsUnavailable": (error: string) => `Stats unavailable: ${error}`,
  "tasks.urlPlaceholder": "Filter by exact target URL",
  "tasks.filter": "Filter",
  "tasks.exactMatch": (url: string) => `Exact match: ${url}`,
  "tasks.clearUrlFilter": "Clear URL filter",
  "tasks.dueAfter": "Due after",
  "tasks.dueBefore": "Before",
  "tasks.perPage": "Per page",
  "tasks.pageSize": "Page size",
  "tasks.clearFilters": "Clear filters",
  "tasks.loaded": (count: number) =>
    `Loaded ${count.toLocaleString("en-US")} ${count === 1 ? "task" : "tasks"}`,
  "tasks.updatedAt": (time: string) => `Updated ${time}`,
  "tasks.autoRefreshTitle": (seconds: number) => `Auto-refresh every ${seconds}s`,
  "tasks.bulkDelete": "Bulk delete",
  "tasks.emptyFilteredTitle": "No matching tasks",
  "tasks.emptyFilteredBody": "Try relaxing the filters, or clear them to see all tasks.",
  "tasks.emptyTitle": "No tasks yet",
  "tasks.emptyBody":
    "Create your first scheduled HTTP request and Schedy will deliver it at the specified time.",
  "tasks.loadErrorTitle": "Could not load tasks",
  "tasks.loadErrorHint1": "Check the Schedy server URL and API key.",
  "tasks.loadErrorHint2":
    "In direct mode, make sure the server sets SCHEDY_CORS_ORIGIN for this origin.",
  "tasks.loadErrorHint3": "In proxy mode, make sure the page is served by pnpm dev or pnpm start.",
  "tasks.checkSettings": "Check connection settings",
  "tasks.loadingMore": "Loading…",
  "tasks.loadMore": "Load more",
  "tasks.listFootnote": "Sorted by scheduled time · Cursor pagination",
  "tasks.createdToast": "Task created",
  "tasks.updatedToast": "Task updated",
  "tasks.loadMoreFailed": "Could not load more tasks",

  "bulk.title": "Bulk delete tasks",
  "bulk.description": "Permanently delete task records by filter. This cannot be undone.",
  "bulk.warning":
    "Unlike cancel, this hard-deletes records from BadgerDB. Other running tasks are unaffected.",
  "bulk.quickFilters": "Quick filters",
  "bulk.presetFailed": "Failed tasks older than 7 days",
  "bulk.presetCancelled": "Cancelled tasks older than 7 days",
  "bulk.status": "Status",
  "bulk.anyStatus": "Any status",
  "bulk.urlExact": "Exact URL",
  "bulk.urlPlaceholder": "Leave blank to ignore URL",
  "bulk.before": "Scheduled before",
  "bulk.after": "Scheduled after",
  "bulk.summaryLabel": "Will delete",
  "bulk.summaryEmpty": "Set at least one filter",
  "bulk.summary": (filters: string) => `Tasks where ${filters}`,
  "bulk.filterStatus": (label: string) => `status is “${label}”`,
  "bulk.filterUrl": (url: string) => `URL exactly matches “${url}”`,
  "bulk.filterBefore": (value: string) => `scheduled before ${value}`,
  "bulk.filterAfter": (value: string) => `scheduled after ${value}`,
  "bulk.filterJoin": " and ",
  "bulk.permanentDelete": "Delete permanently",
  "bulk.requiresFilter":
    "At least one filter is required; the server does not allow unconditional deletion.",
  "bulk.deletedTitle": (count: number) =>
    `Deleted ${count.toLocaleString("en-US")} ${count === 1 ? "task" : "tasks"}`,
  "bulk.deletedDescription": "Deletion is permanent and cannot be undone.",

  "drawer.title": "Task details",
  "drawer.taskId": "Task ID",
  "drawer.copyTaskId": "Copy task ID",
  "drawer.refresh": "Refresh details",
  "drawer.close": "Close details",
  "drawer.loading": "Loading task details…",
  "drawer.copyUrl": "Copy URL",
  "drawer.copyCurl": "Copy cURL",
  "drawer.overview": "Overview",
  "drawer.scheduledAt": "Scheduled",
  "drawer.finishedAt": "Finished",
  "drawer.retryPolicy": "Retry policy",
  "drawer.retryPolicyValue": (count: number, interval: number) =>
    `${count} ${count === 1 ? "retry" : "retries"} · ${interval} ms`,
  "drawer.retryExponential": "Exponential backoff + jitter",
  "drawer.retryFixed": "Fixed interval",
  "drawer.timeout": "Request timeout",
  "drawer.timeoutDefault": "Default 10 s",
  "drawer.schedule": "Repeat interval",
  "drawer.once": "One-off task",
  "drawer.scheduleNext": "Creates the next run after each trigger",
  "drawer.onFailure": "Failure callback",
  "drawer.onFailureSub": "POST after retries are exhausted",
  "drawer.defaultPolicy": "Uses the server default policy",
  "drawer.idempotencyKey": "Idempotency key",
  "drawer.status": "Task status",
  "drawer.attemptsRecorded": (count: number) =>
    `${count} ${count === 1 ? "attempt" : "attempts"} recorded`,
  "drawer.noAttempts": "No delivery attempts yet",
  "drawer.requestBody": "Request body",
  "drawer.copy": "Copy",
  "drawer.noBody": "No request body",
  "drawer.requestHeaders": "Request headers",
  "drawer.noHeaders": "No custom headers",
  "drawer.attempts": "Attempts",
  "drawer.attemptsEmpty": "Not run yet. Attempts will appear here once the task fires.",
  "drawer.attemptNumber": (number: number) => `Attempt ${number}`,
  "drawer.responseBody": "Response body",
  "drawer.truncated": "Truncated",
  "drawer.edit": "Edit task",
  "drawer.replay": "Replay now",
  "drawer.cancel": "Cancel task",
  "drawer.closeAction": "Close",
  "drawer.targetUrl": "Target URL",
  "drawer.curlCommand": "cURL command",
  "drawer.copied": "Copied",
  "drawer.cancelConfirmTitle": "Cancel this task?",
  "drawer.cancelConfirmPrefix": "The task will be marked as ",
  "drawer.cancelConfirmSuffix":
    " and its history kept. If it is the current instance of a repeating task, no further instances will be created.",
  "drawer.replayConfirmTitle": "Replay this task now?",
  "drawer.replayConfirmPrefix":
    "The task will be queued again and delivered immediately. If it previously succeeded, the target service will ",
  "drawer.replayConfirmStrong": "receive the same request again",
  "drawer.replayConfirmSuffix": ".",
  "drawer.confirmReplay": "Deliver again",
  "drawer.cancelSuccessTitle": "Task cancelled",
  "drawer.cancelSuccessDescription": "The task is marked as cancelled and its history is kept.",
  "drawer.replaySuccessTitle": "Task re-queued",
  "drawer.replaySuccessDescription": "The task will be delivered again in a few seconds.",

  "form.createTitle": "New task",
  "form.editTitle": "Edit task",
  "form.createDescription": "Schedule an HTTP request for the future.",
  "form.editDescription":
    "Only pending tasks can be edited. Saving replaces all client-side fields.",
  "form.saveChanges": "Save changes",
  "form.create": "Create task",
  "form.method": "Method",
  "form.url": "Request URL",
  "form.timezoneHint": (zone: string) => `All times are shown in your browser time zone (${zone}).`,
  "form.at": "Specific time",
  "form.after": "Delay",
  "form.executeAt": "Execution time",
  "form.newExecuteAt": "New execution time",
  "form.utcPreview": (iso: string) => `UTC: ${iso}`,
  "form.chooseFuture": "Choose a time in the future",
  "form.fromNow": "From now",
  "form.minutes": "Minutes",
  "form.hours": "Hours",
  "form.days": "Days",
  "form.delayUnit": "Delay unit",
  "form.body": "Request body",
  "form.bodyHint":
    "JSON is sent as application/json by default. Set Content-Type yourself for other types.",
  "form.format": "Format",
  "form.payloadNone": "None",
  "form.payloadText": "Text",
  "form.noBodyHint": (method: string) => `${method} requests do not send a body.`,
  "form.noPayload": "No request body.",
  "form.textPlaceholder": "Plain-text request body",
  "form.headers": "Request headers",
  "form.headersHint": "Additional HTTP headers saved with the task.",
  "form.add": "Add",
  "form.noHeaders": "No custom headers.",
  "form.headerName": "Header name",
  "form.headerValue": "Value",
  "form.headerNameAria": "Header name",
  "form.headerValueAria": "Header value",
  "form.deleteHeader": "Delete header",
  "form.advancedTitle": "Advanced",
  "form.advancedSub": "Retries, timeout, failure callback, repeating tasks, and idempotency key",
  "form.retries": "Retry attempts",
  "form.retriesHint": "Maximum additional attempts after the first failure",
  "form.retryInterval": "Retry interval (ms)",
  "form.retryIntervalHint": "Defaults to 2000 ms",
  "form.retryStrategy": "Retry strategy",
  "form.retryFixedOption": "Fixed interval (fixed)",
  "form.retryExpOption": "Exponential backoff (exponential)",
  "form.timeout": "Request timeout (ms)",
  "form.timeoutPlaceholder": "Default 10000",
  "form.schedule": "Repeat interval",
  "form.schedulePlaceholder": "e.g. 24h, 1h30m",
  "form.scheduleHint": "Go duration; the next run is created at actual time + interval",
  "form.onFailureUrl": "Failure callback URL",
  "form.idempotencyKey": "Idempotency key",
  "form.idempotencyPlaceholder":
    "Generated automatically; reuse the key when retrying to avoid duplicates",
  "form.idempotencyHint":
    "A unique key is generated for each new task and sent with the request. Reusing a key makes retries safe; regenerate it to use a new task identity.",
  "form.generate": "Generate",
  "form.regenerate": "Regenerate",
  "form.taskIdLabel": "Task ID:",
  "form.err.urlRequired": "Enter the request URL",
  "form.err.urlInvalid": "Enter a full http(s) URL",
  "form.err.executeAtRequired": "Choose an execution time",
  "form.err.executeAtInvalid": "Invalid execution time",
  "form.err.executeAtPast": "The execution time must be in the future",
  "form.err.delayPositive": "Enter a delay greater than 0",
  "form.err.delayTooLarge": "The delay is too large",
  "form.err.payloadInvalid": "Invalid JSON. Check commas, quotes, and brackets.",
  "form.err.jsonFormatInvalid": "Invalid JSON; cannot format.",
  "form.err.headerMissingName": "A header has no name",
  "form.err.headerDuplicate": (name: string) => `Duplicate header: ${name}`,
  "form.err.retriesInteger": "Retries must be a non-negative integer",
  "form.err.retryIntervalInteger": "Retry interval must be a non-negative integer (ms)",
  "form.err.timeoutRange": "Timeout must be between 0 and 300000 ms",
  "form.err.onFailureInvalid": "The failure callback must be a full http(s) URL",
  "form.err.saveFailed": "Could not save. Please try again later.",

  "system.title": "System",
  "system.subtitle": "Check Schedy health, delivery metrics, and download database backups.",
  "system.health": "Service health",
  "system.version": "Version",
  "system.latency": "Round-trip time",
  "system.storage": "Data storage",
  "system.readyNote": "BadgerDB is reachable and the service can accept tasks.",
  "system.notReadyNote": "The database is unavailable; the service returns 503.",
  "system.queue": "Delivery queue",
  "system.queueSubtitle": "Prometheus metrics",
  "system.inflight": "In flight",
  "system.overdue": "Overdue",
  "system.totalDeliveries": "Total deliveries",
  "system.connection": "Connection",
  "system.connectionSubtitle": "Current browser configuration",
  "system.change": "Change",
  "system.serverUrl": "Server URL",
  "system.connectionMode": "Connection mode",
  "system.apiKey": "API Key",
  "system.autoRefresh": "Auto-refresh",
  "system.autoRefreshValue": (seconds: number) => `Every ${seconds}s`,
  "system.off": "Off",
  "system.metricsTitle": "Task and delivery metrics",
  "system.metricsSubtitle": "Snapshot from /metrics, not a time series.",
  "system.copyRaw": "Copy raw metrics",
  "system.metricsCopied": "Metrics copied",
  "system.deliveryResults": "Delivery results",
  "system.succeeded": "succeeded",
  "system.failed": "failed",
  "system.deliveryBarAria": (rate: string) => `Delivery success rate ${rate}%`,
  "system.noDeliveryData": "No delivery data yet",
  "system.successRate": (rate: string) => `Success rate ${rate}%`,
  "system.retryCountedSeparately": "Retries are counted separately",
  "system.rawSummary": "View raw Prometheus text",
  "system.metricsLoading": "Loading metrics…",
  "system.backup": "Backup",
  "system.backupSubtitle": "Download an online BadgerDB snapshot.",
  "system.backupNoteBefore": "The backup includes all tasks and history. Restore it offline with ",
  "system.backupNoteAfter": ".",
  "system.backupPreparing": "Preparing backup…",
  "system.downloadBackup": "Download database backup",
  "system.securityTitle": "Credential safety",
  "system.securityBody":
    "The API key is stored only in this browser's localStorage and sent as X-API-Key (forwarded by the local proxy in proxy mode).",
  "system.docs": "Read the Schedy docs",
  "system.backupStarted": "Backup download started",
};

const DICTIONARIES: Record<Locale, MessageSet> = { zh, en };

const STATUS_LABEL_KEYS: Record<TaskStatus, MessageKey> = {
  pending: "status.pending",
  running: "status.running",
  succeeded: "status.succeeded",
  failed: "status.failed",
  cancelled: "status.cancelled",
};

const STATUS_DESCRIPTION_KEYS: Record<TaskStatus, MessageKey> = {
  pending: "status.desc.pending",
  running: "status.desc.running",
  succeeded: "status.desc.succeeded",
  failed: "status.desc.failed",
  cancelled: "status.desc.cancelled",
};

const BASE_URL_ERROR_KEYS: Record<BaseUrlError, MessageKey> = {
  required: "validate.baseUrlRequired",
  query: "validate.baseUrlQuery",
  proxyProtocol: "validate.proxyProtocol",
  proxyInvalid: "validate.proxyInvalid",
  directProtocol: "validate.directProtocol",
  directInvalid: "validate.directInvalid",
};

const DURATION_ERROR_KEYS: Record<GoDurationError, MessageKey> = {
  required: "duration.required",
  format: "duration.format",
  positive: "duration.positive",
};

export function translate<K extends MessageKey>(
  locale: Locale,
  key: K,
  ...args: MessageArgs<K>
): string {
  const message = DICTIONARIES[locale][key] as MessageSet[K];
  if (typeof message === "function") {
    return (message as (...params: unknown[]) => string)(...(args as unknown[]));
  }
  return message;
}

let activeLocale: Locale = loadLocale();

export function getActiveLocale(): Locale {
  return activeLocale;
}

export function setActiveLocale(locale: Locale): void {
  activeLocale = locale;
}

/** For non-React modules such as the API client. */
export function tGlobal<K extends MessageKey>(key: K, ...args: MessageArgs<K>): string {
  return translate(activeLocale, key, ...args);
}

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  toggleLocale: () => void;
  t: <K extends MessageKey>(key: K, ...args: MessageArgs<K>) => string;
  statusLabel: (status: TaskStatus) => string;
  statusDescription: (status: TaskStatus) => string;
  baseUrlError: (error: BaseUrlError) => string;
  durationError: (error: GoDurationError) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function useI18n(): I18nContextValue {
  const value = useContext(I18nContext);
  if (!value) throw new Error("useI18n must be used inside <I18nProvider>");
  return value;
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(loadLocale);
  const localeRef = useRef(locale);

  useEffect(() => {
    setActiveLocale(locale);
    saveLocale(locale);
    document.documentElement.lang = localeTag(locale);
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute("content", translate(locale, "meta.description"));
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    localeRef.current = next;
    setActiveLocale(next);
    setLocaleState(next);
  }, []);

  const toggleLocale = useCallback(() => {
    setLocale(locale === "zh" ? "en" : "zh");
  }, [locale, setLocale]);

  // Keep the function identity stable so locale changes do not retrigger data loading.
  const t = useCallback(
    <K extends MessageKey>(key: K, ...args: MessageArgs<K>) =>
      translate(localeRef.current, key, ...args),
    [],
  );

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      setLocale,
      toggleLocale,
      t,
      statusLabel: (status) => t(STATUS_LABEL_KEYS[status]),
      statusDescription: (status) => t(STATUS_DESCRIPTION_KEYS[status]),
      baseUrlError: (error) => t(BASE_URL_ERROR_KEYS[error]),
      durationError: (error) => t(DURATION_ERROR_KEYS[error]),
    }),
    [locale, setLocale, toggleLocale, t],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
