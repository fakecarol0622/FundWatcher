# 基金估值助手 Phase 2 PRD：后台提醒与桌面推送

## 1. 项目背景

第一阶段已经实现纯前端基金估值助手，支持：

1. 自选基金管理。
2. 基金估值查询。
3. 指数行情展示。
4. 持仓管理。
5. 本地阈值提醒。
6. 提醒记录。
7. 本地导入导出。

但第一阶段存在一个核心限制：

> 页面关闭、浏览器休眠、设备锁屏后，前端定时器无法继续运行，因此无法保证后台提醒。

第二阶段需要增加后台定时提醒能力，使系统可以在用户不打开页面的情况下，定时查询基金估值，并在达到阈值时通知用户。

---

## 2. 阶段目标

Phase 2 的目标是实现：

1. 使用 Cloudflare Worker Cron 每 30 分钟后台查询基金估值。
2. 使用 Cloudflare KV 保存后台监控配置、提醒记录、Web Push 订阅信息。
3. 移动端通过 PushPlus 发送提醒。
4. 桌面端通过 Web Push + Service Worker 发送系统通知栏提醒。
5. 保持第一阶段前端功能不受影响。
6. 不引入传统云服务器。
7. 不实现自动交易。
8. 不实现登录注册。
9. 不实现 AI 分析。

---

## 3. 阶段范围

## 3.1 本阶段实现

### 后台提醒

1. Cloudflare Worker 项目。
2. Cloudflare Cron Trigger。
3. Cloudflare KV 配置读写。
4. 后台基金估值查询。
5. 后台阈值判断。
6. 后台防重复提醒。
7. PushPlus 移动端通知。
8. Web Push 桌面端通知。
9. 提醒历史记录。
10. 前端设置页增加后台提醒配置入口和说明。

### 移动端提醒

使用 PushPlus。

通知场景：

1. 某只基金估算涨幅达到上涨阈值。
2. 某只基金估算跌幅达到下跌阈值。
3. 后台任务运行异常，后续可选。
4. 数据源连续失败，后续可选。

### 桌面端提醒

使用 Web Push + Service Worker。

通知场景：

1. 用户在桌面浏览器授权通知权限。
2. 前端生成 Push Subscription。
3. 前端将 subscription 上传到 Cloudflare Worker。
4. Worker 保存 subscription 到 KV。
5. Cron 命中阈值时，Worker 向 subscription 发送 Web Push。
6. Service Worker 收到 push 后调用 showNotification 展示系统通知。

---

## 3.2 本阶段不实现

1. 不实现自动买卖。
2. 不接入基金交易账户。
3. 不实现登录系统。
4. 不实现多用户复杂权限。
5. 不实现 AI 分析。
6. 不实现短信通知。
7. 不实现 App 原生推送。
8. 不实现复杂数据看板。
9. 不实现云端持仓同步的完整产品化流程。
10. 不保证 iOS 普通 Safari 标签页可以收到 Web Push。

---

# 4. 总体架构

## 4.1 第一阶段已有架构

```txt
Web H5 / PWA
  -> localStorage 保存自选基金、持仓、阈值
  -> 页面打开时查询基金估值
  -> 页面打开期间定时刷新
  -> 页面内提醒 / 浏览器 Notification
```

## 4.2 第二阶段目标架构

```txt
Web H5 / PWA
  -> 管理本地基金、持仓、阈值
  -> 设置页配置 PushPlus token 或引导用户配置 Worker Secret
  -> 设置页开启桌面 Web Push
  -> 注册 Service Worker
  -> 获取 Push Subscription
  -> 上传 Push Subscription 到 Worker

Cloudflare Worker
  -> 提供配置读写 API
  -> 提供 Web Push 订阅 API
  -> 提供手动测试 API
  -> scheduled handler 每 30 分钟执行
  -> 查询基金估值
  -> 判断阈值
  -> 防重复提醒
  -> 发送 PushPlus 移动端通知
  -> 发送 Web Push 桌面端通知
  -> 写入提醒记录

Cloudflare KV
  -> 保存后台监控配置
  -> 保存提醒记录
  -> 保存 Web Push subscriptions
  -> 保存已提醒记录，避免重复通知
```

---

# 5. 技术选型

## 5.1 后台任务

使用：

```txt
Cloudflare Workers
Cloudflare Cron Triggers
TypeScript
Wrangler
```

原因：

1. 不需要购买云服务器。
2. 支持定时任务。
3. 适合轻量 API 和后台任务。
4. 可以和 Cloudflare KV 直接绑定。
5. 免费额度对个人工具通常足够。

---

## 5.2 后台存储

使用：

```txt
Cloudflare KV
```

保存内容：

1. 后台监控配置。
2. PushPlus 通知配置。
3. Web Push 订阅信息。
4. 每日已提醒记录。
5. 最近提醒历史。

---

## 5.3 移动端通知

使用：

```txt
PushPlus
```

原因：

1. 接入简单。
2. 适合个人项目。
3. 可以把消息推送到微信等渠道。
4. Worker 直接调用 HTTP API 即可。

---

## 5.4 桌面端通知

使用：

```txt
Web Push
Service Worker
Push API
Notification API
VAPID keys
```

原因：

1. 可以在页面关闭后通过浏览器推送服务触发系统通知。
2. 符合 Web 标准。
3. 适合桌面 Chrome、Edge、Firefox、Safari 等现代浏览器。
4. 适合作为前端进阶项目亮点。

---

# 6. 数据结构设计

## 6.1 后台监控配置

KV key：

```txt
fund-watcher:background-config
```

数据结构：

```ts
export interface BackgroundMonitorConfig {
  version: string;
  enabled: boolean;
  timezone: string;
  refreshCron: string;
  funds: BackgroundFundItem[];
  notify: NotifyConfig;
  updatedAt: number;
}
```

```ts
export interface BackgroundFundItem {
  code: string;
  name?: string;
  alias?: string;
  enabled: boolean;
  thresholdUp?: number;
  thresholdDown?: number;
}
```

示例：

```json
{
  "version": "1.0.0",
  "enabled": true,
  "timezone": "Asia/Shanghai",
  "refreshCron": "*/30 * * * *",
  "funds": [
    {
      "code": "161725",
      "name": "招商中证白酒指数",
      "alias": "白酒",
      "enabled": true,
      "thresholdUp": 3,
      "thresholdDown": -3
    }
  ],
  "notify": {
    "pushplus": {
      "enabled": true,
      "template": "html"
    },
    "webPush": {
      "enabled": true
    }
  },
  "updatedAt": 1710000000000
}
```

---

## 6.2 通知配置

PushPlus token 不允许直接写入 GitHub 仓库。

推荐方式：

```txt
Cloudflare Worker Secret
```

Secret 名称：

```txt
PUSHPLUS_TOKEN
```

类型定义：

```ts
export interface NotifyConfig {
  pushplus: {
    enabled: boolean;
    template: 'html' | 'txt' | 'json';
  };
  webPush: {
    enabled: boolean;
  };
}
```

---

## 6.3 Web Push 订阅

KV prefix：

```txt
fund-watcher:webpush:subscription:{subscriptionId}
```

数据结构：

```ts
export interface WebPushSubscriptionRecord {
  id: string;
  endpoint: string;
  subscription: PushSubscriptionJSON;
  userAgent?: string;
  createdAt: number;
  updatedAt: number;
  enabled: boolean;
}
```

说明：

1. `id` 可以用 endpoint hash 生成。
2. subscription 原始对象需要完整保存。
3. 如果发送失败且状态为 404 或 410，需要删除失效 subscription。

---

## 6.4 已提醒记录

KV key 格式：

```txt
fund-watcher:alert-dedupe:{date}:{fundCode}:{type}:{threshold}
```

示例：

```txt
fund-watcher:alert-dedupe:2026-06-06:161725:up:3
```

数据结构：

```ts
export interface AlertDedupeRecord {
  fundCode: string;
  fundName: string;
  type: 'up' | 'down';
  threshold: number;
  actualGrowth: number;
  date: string;
  triggeredAt: number;
}
```

TTL：

```txt
7 days
```

说明：

同一基金、同一阈值、同一交易日只提醒一次。

---

## 6.5 提醒历史

KV key：

```txt
fund-watcher:alert-history
```

数据结构：

```ts
export interface BackgroundAlertRecord {
  id: string;
  fundCode: string;
  fundName: string;
  type: 'up' | 'down';
  threshold: number;
  actualGrowth: number;
  estimatedNav: number | null;
  estimateTime: string | null;
  message: string;
  notifyChannels: Array<'pushplus' | 'webpush'>;
  date: string;
  triggeredAt: number;
}
```

最多保存最近 100 条。

---

# 7. Worker 目录设计

在项目根目录新增：

```txt
worker/
  package.json
  tsconfig.json
  wrangler.toml
  src/
    index.ts
    types.ts
    constants.ts
    services/
      configService.ts
      fundDataSource.ts
      alertService.ts
      pushplusService.ts
      webPushService.ts
      subscriptionService.ts
      historyService.ts
      timeService.ts
    utils/
      response.ts
      hash.ts
      concurrency.ts
      logger.ts
```

---

# 8. Worker API 设计

## 8.1 健康检查

```txt
GET /health
```

响应：

```json
{
  "ok": true,
  "service": "fund-watcher-worker",
  "time": "2026-06-06T12:00:00.000Z"
}
```

---

## 8.2 获取后台监控配置

```txt
GET /api/background-config
```

响应：

```json
{
  "ok": true,
  "data": {
    "enabled": true,
    "funds": []
  }
}
```

---

## 8.3 更新后台监控配置

```txt
POST /api/background-config
```

请求 body：

```json
{
  "enabled": true,
  "timezone": "Asia/Shanghai",
  "funds": [
    {
      "code": "161725",
      "alias": "白酒",
      "enabled": true,
      "thresholdUp": 3,
      "thresholdDown": -3
    }
  ],
  "notify": {
    "pushplus": {
      "enabled": true,
      "template": "html"
    },
    "webPush": {
      "enabled": true
    }
  }
}
```

要求：

1. 校验基金代码为 6 位数字。
2. 校验阈值为数字。
3. 不允许把 PushPlus token 写入请求 body。
4. token 只从 Worker Secret 读取。

---

## 8.4 测试 PushPlus 通知

```txt
POST /api/test/pushplus
```

响应：

```json
{
  "ok": true
}
```

说明：

用于确认 PushPlus token 是否配置成功。

---

## 8.5 保存 Web Push 订阅

```txt
POST /api/web-push/subscribe
```

请求 body：

```json
{
  "subscription": {
    "endpoint": "...",
    "keys": {
      "p256dh": "...",
      "auth": "..."
    }
  }
}
```

响应：

```json
{
  "ok": true,
  "subscriptionId": "xxx"
}
```

要求：

1. 校验 subscription.endpoint 存在。
2. 校验 keys.p256dh 和 keys.auth 存在。
3. 保存到 KV。
4. 如果已经存在，则更新 updatedAt。

---

## 8.6 删除 Web Push 订阅

```txt
POST /api/web-push/unsubscribe
```

请求 body：

```json
{
  "endpoint": "..."
}
```

响应：

```json
{
  "ok": true
}
```

---

## 8.7 测试 Web Push 通知

```txt
POST /api/test/web-push
```

响应：

```json
{
  "ok": true,
  "sent": 1,
  "failed": 0
}
```

---

## 8.8 手动触发一次后台检查

```txt
POST /api/run-once
```

用途：

1. 本地调试。
2. 部署后验证。
3. 不等待 cron。

响应：

```json
{
  "ok": true,
  "checked": 3,
  "alerts": 1
}
```

---

# 9. Cron 任务设计

## 9.1 触发频率

默认：

```txt
*/30 * * * *
```

含义：

```txt
每 30 分钟执行一次
```

## 9.2 Cron 执行流程

```txt
scheduled handler
  -> 读取 background-config
  -> 如果 config.enabled=false，直接结束
  -> 过滤 enabled=true 的基金
  -> 查询基金估值
  -> 判断阈值
  -> 检查 dedupe key 是否存在
  -> 如果已提醒，跳过
  -> 如果未提醒，生成提醒消息
  -> 发送 PushPlus
  -> 发送 Web Push
  -> 写入 dedupe record
  -> 写入 alert history
  -> 输出日志
```

---

# 10. 阈值判断规则

## 10.1 上涨提醒

```txt
estimatedGrowth >= thresholdUp
```

## 10.2 下跌提醒

```txt
estimatedGrowth <= thresholdDown
```

## 10.3 跳过条件

以下情况不触发提醒：

1. 基金未启用。
2. 基金没有估算涨跌幅。
3. 阈值未设置。
4. 当天同一基金同一阈值已提醒。
5. 后台提醒总开关关闭。

---

# 11. PushPlus 通知设计

## 11.1 通知标题

上涨：

```txt
基金上涨提醒：{fundName} +{actualGrowth}%
```

下跌：

```txt
基金下跌提醒：{fundName} {actualGrowth}%
```

## 11.2 通知内容

HTML 模板示例：

```html
<h3>基金估值提醒</h3>
<p><strong>基金：</strong>{fundName} ({fundCode})</p>
<p><strong>当前估算涨跌幅：</strong>{actualGrowth}%</p>
<p><strong>触发阈值：</strong>{threshold}%</p>
<p><strong>估算净值：</strong>{estimatedNav}</p>
<p><strong>估值时间：</strong>{estimateTime}</p>
<p>本提醒仅用于个人观察，不构成投资建议。</p>
```

## 11.3 PushPlus 请求要求

1. 使用 POST 请求。
2. token 从 `env.PUSHPLUS_TOKEN` 读取。
3. 支持 title、content、template。
4. 请求失败需要记录日志。
5. PushPlus 失败不影响 Web Push 发送。
6. 如果未配置 token，则跳过 PushPlus 并记录 warning。

---

# 12. Web Push 桌面端通知设计

## 12.1 前端新增能力

前端需要新增：

1. `public/sw.js` 或 Vite PWA Service Worker。
2. `src/services/webPushClient.ts`。
3. 设置页增加桌面推送模块。
4. 用户点击“开启桌面推送通知”。
5. 请求 Notification 权限。
6. 注册 Service Worker。
7. 调用 `registration.pushManager.subscribe()`。
8. 将 subscription 上传到 Worker。
9. 支持取消订阅。
10. 支持发送测试通知。

---

## 12.2 Worker 新增能力

Worker 需要新增：

1. 保存 subscription。
2. 删除 subscription。
3. 读取所有 subscription。
4. 使用 VAPID keys 发送 Web Push。
5. 发送失败时清理失效 subscription。

---

## 12.3 VAPID 配置

需要配置 Worker secrets：

```txt
VAPID_PUBLIC_KEY
VAPID_PRIVATE_KEY
VAPID_SUBJECT
```

前端只允许使用：

```txt
VAPID_PUBLIC_KEY
```

私钥只能保存在 Worker Secret 中。

---

## 12.4 Service Worker 推送事件

Service Worker 需要监听：

```js
self.addEventListener('push', event => {
  const data = event.data ? event.data.json() : {};
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/badge-72.png',
      data: data.url || '/'
    })
  );
});
```

---

## 12.5 通知点击事件

Service Worker 需要监听：

```js
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data || '/')
  );
});
```

---

## 12.6 桌面端限制说明

设置页需要展示：

```txt
桌面系统通知依赖浏览器 Web Push 能力。请使用 Chrome、Edge、Firefox 或 Safari 的较新版本，并确保站点为 HTTPS。

如果浏览器通知权限被拒绝，需要到浏览器设置中重新开启。

iOS 上 Web Push 通常需要将网站添加到主屏幕后，从主屏幕打开 Web App 并授权通知。
```

---

# 13. 前端页面改造

## 13.1 SettingsView 新增“后台提醒”模块

内容包括：

1. 后台提醒总开关。
2. 同步当前自选基金到后台配置。
3. PushPlus 移动端提醒状态。
4. 测试 PushPlus 通知按钮。
5. 桌面 Web Push 状态。
6. 开启桌面推送按钮。
7. 取消桌面推送按钮。
8. 测试桌面推送按钮。
9. 后台提醒限制说明。

---

## 13.2 推荐交互

### 同步后台监控配置

用户点击：

```txt
同步当前基金配置到后台提醒
```

前端将当前自选基金列表、阈值、enabled 状态发送到：

```txt
POST /api/background-config
```

### 测试 PushPlus

用户点击：

```txt
发送 PushPlus 测试通知
```

前端请求：

```txt
POST /api/test/pushplus
```

### 开启桌面推送

用户点击：

```txt
开启桌面系统通知
```

流程：

```txt
检查浏览器支持
  -> 注册 Service Worker
  -> 请求通知权限
  -> 获取 Push Subscription
  -> 上传到 Worker
  -> 显示开启成功
```

---

# 14. 环境变量与 Secrets

## 14.1 Worker Secrets

必须使用 secrets 管理：

```txt
PUSHPLUS_TOKEN
VAPID_PUBLIC_KEY
VAPID_PRIVATE_KEY
VAPID_SUBJECT
```

## 14.2 Wrangler 命令示例

```bash
wrangler secret put PUSHPLUS_TOKEN
wrangler secret put VAPID_PUBLIC_KEY
wrangler secret put VAPID_PRIVATE_KEY
wrangler secret put VAPID_SUBJECT
```

---

# 15. Wrangler 配置要求

`worker/wrangler.toml` 需要包含：

```toml
name = "fund-watcher-worker"
main = "src/index.ts"
compatibility_date = "2026-06-06"

[triggers]
crons = ["*/30 * * * *"]

[[kv_namespaces]]
binding = "FUND_WATCHER_KV"
id = "your-production-kv-id"
preview_id = "your-preview-kv-id"
```

实际 id 需要用户在 Cloudflare 创建 KV 后替换。

---

# 16. CORS 设计

Worker API 需要支持前端调用。

允许方法：

```txt
GET
POST
OPTIONS
```

允许 headers：

```txt
Content-Type
Authorization
```

第一版可以通过环境变量配置允许的前端 origin。

示例：

```txt
ALLOWED_ORIGIN=https://your-github-pages-url
```

本地开发允许：

```txt
http://localhost:5173
```

---

# 17. 安全要求

1. PushPlus token 不允许提交到 GitHub。
2. VAPID private key 不允许提交到 GitHub。
3. Worker API 不应公开敏感 token。
4. 前端只能读取 VAPID public key。
5. 不接收或保存基金交易账户信息。
6. 不接入自动交易。
7. 不输出投资建议。
8. 提醒文案必须包含“不构成投资建议”或在设置页展示免责声明。

---

# 18. 本地开发和测试

## 18.1 Worker 本地启动

```bash
cd worker
npm install
npm run dev
```

或：

```bash
wrangler dev
```

## 18.2 测试 Cron

使用 Wrangler 的 scheduled 测试能力：

```bash
wrangler dev --test-scheduled
```

然后访问测试 scheduled 的本地路径。

## 18.3 测试 API

需要测试：

1. `GET /health`
2. `GET /api/background-config`
3. `POST /api/background-config`
4. `POST /api/test/pushplus`
5. `POST /api/web-push/subscribe`
6. `POST /api/test/web-push`
7. `POST /api/run-once`

---

# 19. 验收标准

## 19.1 Worker 初始化

* [ ] `worker` 目录存在。
* [ ] Worker 使用 TypeScript。
* [ ] `wrangler.toml` 配置存在。
* [ ] `GET /health` 正常返回。
* [ ] `npm run build` 或 `wrangler deploy --dry-run` 通过。

## 19.2 KV 配置

* [ ] Worker 可以读取 KV。
* [ ] Worker 可以写入 KV。
* [ ] 可以保存 background config。
* [ ] 可以读取 background config。
* [ ] KV key 命名符合 PRD。

## 19.3 Cron 后台任务

* [ ] Cron 每 30 分钟执行。
* [ ] 本地可以手动触发 scheduled 测试。
* [ ] `POST /api/run-once` 可以触发一次完整检查。
* [ ] config.enabled=false 时不会执行提醒。
* [ ] 没有启用基金时不会报错。

## 19.4 基金估值查询

* [ ] Worker 可以查询单只基金估值。
* [ ] Worker 可以批量查询基金估值。
* [ ] 单只基金失败不影响其他基金。
* [ ] 请求失败有日志。
* [ ] 请求超时有处理。

## 19.5 阈值判断

* [ ] 上涨达到 thresholdUp 时触发提醒。
* [ ] 下跌达到 thresholdDown 时触发提醒。
* [ ] 未达到阈值时不提醒。
* [ ] 无 estimatedGrowth 时不提醒。
* [ ] 同一基金同一阈值同一交易日只提醒一次。

## 19.6 PushPlus 移动端提醒

* [ ] PushPlus token 从 Worker Secret 读取。
* [ ] 测试通知可以发送成功。
* [ ] 命中阈值后可以收到 PushPlus 通知。
* [ ] PushPlus 失败不影响 Web Push。
* [ ] 未配置 token 时有 warning 日志。

## 19.7 Web Push 桌面端提醒

* [ ] 前端可以注册 Service Worker。
* [ ] 前端可以请求 Notification 权限。
* [ ] 前端可以生成 Push Subscription。
* [ ] 前端可以上传 subscription 到 Worker。
* [ ] Worker 可以保存 subscription 到 KV。
* [ ] Worker 可以发送测试 Web Push。
* [ ] 桌面浏览器系统通知栏可以收到测试通知。
* [ ] 命中基金阈值后可以收到桌面通知。
* [ ] subscription 失效时可以清理。

## 19.8 前端设置页

* [ ] 设置页展示后台提醒模块。
* [ ] 可以同步当前基金配置到后台。
* [ ] 可以测试 PushPlus。
* [ ] 可以开启桌面通知。
* [ ] 可以取消桌面通知。
* [ ] 可以测试桌面通知。
* [ ] 展示后台提醒限制说明。

---

# 20. 开发顺序

## Step 1：创建 Worker 项目

1. 新增 `worker` 目录。
2. 初始化 TypeScript Worker。
3. 配置 Wrangler。
4. 实现 `/health`。
5. 配置基础 CORS。
6. 写文档说明如何本地启动。

## Step 2：接入 KV

1. 配置 KV binding。
2. 实现 `configService`。
3. 实现读取和保存后台监控配置 API。
4. 实现配置校验。
5. 写文档说明如何创建 KV。

## Step 3：实现后台基金估值查询

1. 实现 Worker 端 `fundDataSource`。
2. 复用或迁移前端基金估值数据源逻辑。
3. 实现单只基金查询。
4. 实现批量基金查询。
5. 实现超时和错误处理。
6. 实现并发限制。

## Step 4：实现阈值判断和防重复提醒

1. 实现 `alertService`。
2. 实现上涨/下跌判断。
3. 实现 dedupe key。
4. 实现提醒历史写入。
5. 实现 `POST /api/run-once`。

## Step 5：实现 PushPlus 移动端提醒

1. 实现 `pushplusService`。
2. 从 Worker Secret 读取 `PUSHPLUS_TOKEN`。
3. 实现测试通知 API。
4. 命中阈值后发送 PushPlus。
5. 完善错误处理。

## Step 6：接入 Cron Trigger

1. 实现 `scheduled()` handler。
2. scheduled 内部复用 `runOnce` 逻辑。
3. 配置 `*/30 * * * *`。
4. 本地支持 scheduled 测试。
5. 部署后验证 Cron 运行日志。

## Step 7：前端设置页接入后台提醒配置

1. 增加后台提醒模块。
2. 增加 Worker API base URL 配置。
3. 支持同步当前基金配置到后台。
4. 支持测试 PushPlus。
5. 展示后台提醒说明。

## Step 8：实现桌面 Web Push 前端能力

1. 新增 Service Worker。
2. 新增 `webPushClient`。
3. 设置页支持开启桌面推送。
4. 设置页支持取消桌面推送。
5. 设置页支持测试桌面推送。

## Step 9：实现 Worker Web Push 能力

1. 实现 `subscriptionService`。
2. 实现保存 subscription API。
3. 实现删除 subscription API。
4. 实现 `webPushService`。
5. 使用 VAPID keys 发送 Web Push。
6. 清理失效 subscription。

## Step 10：联调与文档

1. 联调 PushPlus。
2. 联调 Web Push。
3. 联调 Cron。
4. 更新 README。
5. 新增 `docs/BACKGROUND_ALERTS.md`。
6. 补充限制说明。

---

# 21. 风险与限制

## 21.1 PushPlus 风险

1. 第三方服务可能有额度限制。
2. 第三方接口可能变更。
3. 微信通知可能存在延迟。
4. token 泄露会导致被滥用。

## 21.2 Web Push 风险

1. 用户必须授权通知权限。
2. 用户拒绝权限后需要手动到浏览器设置恢复。
3. 不同浏览器支持程度不同。
4. iOS 需要添加到主屏幕才更适合使用 Web Push。
5. subscription 可能过期，需要清理。
6. VAPID private key 必须安全保存。

## 21.3 Cron 风险

1. Cron 不是实时触发，只能按固定周期执行。
2. 第三方基金估值接口失败会影响提醒。
3. 非交易时间可能拿到旧数据。
4. 定时任务日志需要通过 Cloudflare 查看。

---

# 22. 免责声明

本工具仅用于个人数据整理和估值观察。

基金估值为第三方估算数据，不等于基金公司最终披露净值。

所有提醒和分析内容不构成投资建议。

投资有风险，决策需谨慎。
