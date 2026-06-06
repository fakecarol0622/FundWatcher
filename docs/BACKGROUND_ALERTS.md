# 后台定时提醒

本文档记录 Phase 2 后台提醒 Worker 的本地开发方式。

## 当前范围

当前只完成 Phase 2 Step 1：创建 Cloudflare Worker 项目。

已实现：

1. `worker/` TypeScript Worker 项目。
2. `GET /health` 健康检查接口。
3. 基础 CORS 处理，支持 `GET`、`POST`、`OPTIONS`。

暂未实现：

1. Cloudflare KV。
2. 基金估值查询。
3. PushPlus。
4. Web Push。
5. Cron 定时任务。

## 进入 Worker 目录

```bash
cd worker
```

## 安装依赖

```bash
npm install
```

## 本地启动

```bash
npm run dev
```

Wrangler 默认会在本地启动 Worker，通常地址为：

```txt
http://localhost:8787
```

## 访问健康检查

浏览器访问：

```txt
http://localhost:8787/health
```

或使用命令行：

```bash
curl http://localhost:8787/health
```

预期响应：

```json
{
  "ok": true,
  "service": "fund-watcher-worker",
  "time": "2026-06-06T12:00:00.000Z"
}
```

其中 `time` 为当前 ISO 时间。
