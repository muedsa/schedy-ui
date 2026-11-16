# Schedy Console

[English](./README.md) | 简体中文

一个面向 [Schedy](https://schedy.mintlify.app) 的轻量 Web 控制台。Schedy 是自托管的 HTTP 任务调度器，本界面用于创建、查看和清理定时请求，查看运行状态与 Prometheus 指标，并下载 BadgerDB 备份。

服务地址和 API Key 只在浏览器中填写，源码和构建产物中不包含任何凭据。

![React](https://img.shields.io/badge/React-19-149eca) ![Vite](https://img.shields.io/badge/Vite-8-646cff) ![TypeScript](https://img.shields.io/badge/TypeScript-7-3178c6) ![pnpm](https://img.shields.io/badge/pnpm-12-f69220) ![license](https://img.shields.io/badge/license-MIT-green)

## 功能

- **任务列表**：状态、目标 URL、执行时间、尝试结果；游标分页与可配置的自动刷新。
- **筛选**：状态（通过统计卡片）、目标 URL 精确匹配、计划执行时间范围（`due_after` / `due_before`）、每页数量与「加载更多」。
- **新建 / 编辑任务**：方法、一次性执行时间或重复执行、JSON / 文本请求体、自定义请求头、失败重试（固定间隔或指数退避）、单次超时、失败回调 URL、重复间隔与幂等键。
- **任务详情**：完整请求快照、可复制的 cURL 命令、包含响应体的尝试时间线。
- **任务操作**：软取消待执行任务、重放已结束任务、按条件批量硬删除。
- **系统页**：`/healthz`、`/readyz`、`/metrics` 可视化、原始 Prometheus 文本、投递成功率与 BadgerDB 在线备份下载。
- **界面**：浅色 / 深色主题、响应式布局、中英文切换，日期、相对时间与数字同步本地化。

## 环境要求

- Node.js 20 或更高版本（已在 Node 24 上验证）
- pnpm（已在 pnpm 12 上验证）

```bash
pnpm install
```

## 快速开始

```bash
pnpm dev
```

打开 <http://127.0.0.1:5173> 并填写：

| 字段            | 说明                                   | 示例                    |
| --------------- | -------------------------------------- | ----------------------- |
| 连接方式        | 推荐使用本地代理                       | 本地代理                |
| Schedy 服务地址 | Schedy 的 origin，可带路径前缀         | `http://127.0.0.1:8080` |
| API Key         | 仅在服务端启用 `SCHEDY_API_KEY` 时需要 | `your-api-key`          |

点击「测试连接」确认服务和认证正常，再点击「开始使用」。

### 界面语言

连接页和顶栏都有语言切换按钮。首次打开时按浏览器语言选择（`en*` 显示英文，其余显示中文），之后的选择保存在 `schedy-ui.locale.v1`。日期、相对时间和数字跟随所选语言；主题初始跟随系统设置，并保存在 `schedy-ui.theme.v1`。

### 连接方式

**本地代理（推荐）**

浏览器请求当前页面同源的 `/__schedy/*`，由 Vite 开发服务器或生产服务器转发到 Schedy。目标地址通过 `X-Schedy-Target` 传递，API Key 通过 `X-Schedy-API-Key` 传递，界面语言通过 `X-Schedy-Locale` 传递（仅用于翻译代理自身的错误提示）。代理本身不保存任何配置。

适用于 Schedy 未开启 CORS 的情况。页面必须由 `pnpm dev`、`pnpm preview` 或 `pnpm start` 提供。

**浏览器直连**

浏览器直接请求 Schedy，并在请求中携带 `X-API-Key`。需要 Schedy 允许当前页面来源：

```bash
SCHEDY_CORS_ORIGIN=http://127.0.0.1:5173 schedy server
```

生产部署时请改成实际页面的 origin，例如 `https://schedy-console.example.com`。如果无法在服务端配置 CORS，请使用本地代理模式。

本地代理只存在于 `pnpm dev`、`pnpm preview`、`pnpm start` 提供的页面中。静态导出（`pnpm build:static`）完全没有代理，始终使用浏览器直连，详见 [静态导出](#静态导出)。

## 任务排期

设置执行时间有两种方式：

- **指定时间**：一次性任务，请求中只包含 `execute_at`。
- **延迟执行**：重复任务。所选开始时间作为 `execute_at`，延迟间隔作为 `schedule`。Schedy 在开始时间触发，此后每次运行结束都会按 `fire_time + schedule` 排下一次。间隔为 Go duration（`30m`、`2h`、`1h30m`）；界面中以「天」填写的间隔会换算成小时（`3d` → `72h`）。

说明：

- 只有 `pending` 任务可以编辑；保存会全量替换客户端字段。
- 取消当前待执行任务会同时终止后续的重复链。
- 每个新任务都会携带 `Idempotency-Key`，详见 [API 行为备注](#api-行为备注)。

## 常用命令

| 命令                | 说明                                     |
| ------------------- | ---------------------------------------- |
| `pnpm dev`          | 启动开发服务器（含 `/__schedy` 代理）    |
| `pnpm typecheck`    | TypeScript 类型检查                      |
| `pnpm format`       | 使用 Prettier 格式化源码、配置和文档     |
| `pnpm format:check` | 检查是否符合 Prettier 格式               |
| `pnpm build`        | 类型检查并构建到 `dist/`                 |
| `pnpm build:static` | 构建不带代理的静态导出                   |
| `pnpm preview`      | 预览构建结果（同样带代理）               |
| `pnpm start`        | 启动生产服务器，提供静态文件和代理       |
| `pnpm mock`         | 启动内存版 Schedy 模拟服务，用于安全测试 |

## 本地模拟服务

没有可用的 Schedy 实例时，可以启动内置 mock：

```bash
pnpm mock
```

默认监听 `http://127.0.0.1:8080`，预置待执行、执行中、成功、失败、已取消等示例任务，以及一个重复任务。可选环境变量：

```bash
PORT=8081 MOCK_API_KEY=dev-secret pnpm mock
```

mock 数据保存在内存中，重启即重置。它只实现界面所需的 Schedy API 子集，不包含完整的调度语义。

## 生产部署

```bash
pnpm install
pnpm build
PORT=4173 HOST=0.0.0.0 pnpm start
```

`server.mjs` 会：

- 提供 `dist/` 中的静态资源，未知路径回退到 `index.html`（单页应用）；
- 在同一端口挂载 `/__schedy` 代理；
- 不读取、不写入任何凭据。

环境变量：

| 变量   | 默认值      | 说明                                   |
| ------ | ----------- | -------------------------------------- |
| `PORT` | `4173`      | 监听端口                               |
| `HOST` | `127.0.0.1` | 监听地址；对外提供服务时设为 `0.0.0.0` |

缺少 `dist/index.html` 时 `pnpm start` 会直接退出，请先执行 `pnpm build`。

部署在 Nginx / Caddy 等反向代理后时，建议为备份下载和慢请求设置足够的超时时间（例如 5 分钟），并按需启用 HTTPS。API Key 会随请求经过该服务器，请确保部署环境可信。

## 静态导出

常规 `pnpm build` 的产物本身就是静态文件，但它保留代理与直连两种模式，并默认使用本地代理——而代理只在 `pnpm dev`、`pnpm preview`、`pnpm start` 提供页面时才存在。如果要部署到纯静态服务器（没有 Node 进程、没有代理），请使用静态导出构建：

```bash
pnpm build:static
```

此时 `dist/` 只包含 HTML、CSS 和 JS，可直接交给 Nginx、GitHub Pages、S3 等静态托管。

- 界面不再提供代理选项：所有连接都走浏览器直连，因此需要 Schedy 允许托管页面的来源（`SCHEDY_CORS_ORIGIN`）。
- 路由基于 URL 哈希（`#/tasks`、`#/system`），不需要配置 SPA 重写规则。
- 不需要 `pnpm start` 与 `server.mjs`；它们仍用于常规的服务器部署方式。
- 需要部署到子路径时，用相对 base 构建：`pnpm build:static -- --base=./`。

## 安全说明

- 服务地址和 API Key 保存在当前浏览器的 `localStorage`（键名 `schedy-ui.connection.v1`），不会写入源码或构建产物。
- 同一浏览器配置文件下的其他页面和扩展可能读取 `localStorage`。请使用专用 API Key，并避免在共享电脑上保存生产凭据。
- 直连模式下 API Key 会出现在浏览器请求头中；代理模式下由本地代理转发，仍然不落盘。
- 批量删除是**永久删除**，无法撤销；取消任务则是软取消，会保留历史记录。
- 本项目的代理会向任意用户填写的目标地址发起请求。不要把它暴露给不可信用户，否则可能被当作 SSRF 跳板；生产环境建议限制可访问的目标网段或增加鉴权。

## API 行为备注

- 认证头：`X-API-Key`。
- 新建任务始终携带 `Idempotency-Key`：界面会为每个新任务自动生成唯一键，因此每次提交都会创建新任务；保留同一个键重试时，Schedy 会返回首次创建的任务，而不是重复排期。点击「重新生成」可显式换用新的任务标识。
- 更新使用 `PUT`，是完整替换，且只允许更新 `pending` 任务。
- `DELETE /tasks/{id}` 是软取消；`DELETE /tasks` 需要至少一个筛选条件。
- `POST /tasks/{id}/run` 仅适用于终态任务（成功、失败、已取消）。
- 列表使用游标分页，自动刷新会按已加载页的游标重新拉取。

接口文档：<https://schedy.mintlify.app>

## 项目结构

```
src/
  components/       通用组件、任务表单、抽屉、弹窗
  hooks/            哈希路由、主题、滚动锁
  lib/api.ts        Schedy API 客户端
  lib/config.ts     连接配置与校验
  lib/i18n.tsx      中英文文案、语言状态与翻译辅助
  lib/format.ts     日期、数字、时长格式化
  lib/runtime.ts    构建模式标志（静态导出）
  pages/            任务页、系统页、连接页
  styles.css        设计变量与响应式样式
server/
  proxy.mjs         同源反向代理
server.mjs          生产静态服务器 + 代理
mock/server.mjs     内存版模拟 Schedy
vite.config.ts      开发/预览服务器与代理插件
README.md           英文 README
README.zh-CN.md     本文件（中文）
```

## 说明

本项目是独立的社区界面，不是 Schedy 官方项目。界面支持中文和英文，所有时间按浏览器本地时区显示。
