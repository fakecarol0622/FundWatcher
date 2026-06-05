# Phase 2 Codex 实现步骤：后台提醒 + PushPlus + Web Push

## 使用方式

每次只把当前 Step 的 Prompt 发给 Codex。

每一步完成后必须执行：

```bash
npm run build
```

如果涉及 Worker，还需要执行：

```bash
cd worker
npm install
npm run build
```

或者：

```bash
cd worker
wrangler deploy --dry-run
```

每一步完成后必须让 Codex 输出：

1. 修改了哪些文件。
2. 如何运行。
3. 如何验证。
4. 当前已知限制。

每一步通过后再提交 Git。

---

# Step 1：创建 Cloudflare Worker 项目

## 发给 Codex 的 Prompt

```txt
请阅读 docs/PRD.md 和 docs/PHASE2_BACKGROUND_ALERTS_PRD.md。

现在只实现 Phase 2 Step 1：创建 Cloudflare Worker 项目。

目标：
在当前项目根目录新增 worker 目录，用于后台定时提醒。

要求：
1. 在项目根目录新增 worker/。
2. 使用 Cloudflare Workers + TypeScript。
3. 创建 worker/package.json。
4. 创建 worker/tsconfig.json。
5. 创建 worker/wrangler.toml。
6. 创建 worker/src/index.ts。
7. 实现 GET /health，返回：
   {
     ok: true,
     service: "fund-watcher-worker",
     time: 当前 ISO 时间
   }
8. 实现基础 CORS 处理，支持 GET、POST、OPTIONS。
9. 暂时不要接 KV。
10. 暂时不要实现基金估值查询。
11. 暂时不要实现 PushPlus。
12. 暂时不要实现 Web Push。
13. 在 docs/BACKGROUND_ALERTS.md 中写明：
   - 如何进入 worker 目录
   - 如何安装依赖
   - 如何本地启动
   - 如何访问 /health
14. 更新 docs/PHASE2_CODEX_STEPS.md 或 docs/TASKS.md，将 Step 1 标记为完成。

完成后请输出：
1. 新增和修改了哪些文件
2. 如何本地运行 Worker
3. 如何验证 /health
4. 当前未实现内容
```

## 你怎么验收

```bash
cd worker
npm install
npm run dev
```

访问：

```txt
http://localhost:8787/health
```

应该看到：

```json
{
  "ok": true,
  "service": "fund-watcher-worker",
  "time": "..."
}
```

通过后提交：

```bash
git add .
git commit -m "feat(worker): initialize cloudflare worker"
```

---

# Step 2：接入 Cloudflare KV 和后台配置 API

## 发给 Codex 的 Prompt

```txt
请阅读 docs/PRD.md 和 docs/PHASE2_BACKGROUND_ALERTS_PRD.md。

现在只实现 Phase 2 Step 2：接入 Cloudflare KV 和后台监控配置 API。

要求：
1. 在 worker/wrangler.toml 中增加 KV binding 示例：
   binding = "FUND_WATCHER_KV"
2. 创建 worker/src/types.ts，定义：
   - BackgroundMonitorConfig
   - BackgroundFundItem
   - NotifyConfig
3. 创建 worker/src/services/configService.ts。
4. configService 支持：
   - getBackgroundConfig(env)
   - saveBackgroundConfig(env, config)
   - getDefaultBackgroundConfig()
   - validateBackgroundConfig(input)
5. KV key 使用：
   fund-watcher:background-config
6. 实现 API：
   GET /api/background-config
   POST /api/background-config
7. POST /api/background-config 要校验：
   - enabled 必须是 boolean
   - funds 必须是数组
   - fund.code 必须是 6 位数字
   - thresholdUp / thresholdDown 如果存在必须是 number
   - notify.pushplus.enabled 必须是 boolean
   - notify.webPush.enabled 必须是 boolean
8. 不允许在配置中保存 PushPlus token。
9. token 后续只从 Worker Secret 读取。
10. 如果 KV 中没有配置，GET 返回默认配置。
11. 所有 API 返回统一格式：
   成功：{ ok: true, data: ... }
   失败：{ ok: false, error: "..." }
12. 更新 docs/BACKGROUND_ALERTS.md，写明如何创建 KV namespace、如何配置 wrangler.toml。
13. 不要实现基金估值查询。
14. 不要实现 PushPlus。
15. 不要实现 Web Push。

完成后请输出：
1. 修改了哪些文件
2. KV key 设计
3. 如何本地验证 GET / POST background-config
4. Cloudflare 后台需要手动做什么
```

## 你怎么验收

本地启动：

```bash
cd worker
npm run dev
```

测试：

```bash
curl http://localhost:8787/api/background-config
```

测试 POST：

```bash
curl -X POST http://localhost:8787/api/background-config \
  -H "Content-Type: application/json" \
  -d '{
    "enabled": true,
    "timezone": "Asia/Shanghai",
    "refreshCron": "*/30 * * * *",
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
  }'
```

通过后提交：

```bash
git add .
git commit -m "feat(worker): add kv background config api"
```

---

# Step 3：实现 Worker 端基金估值数据源

## 发给 Codex 的 Prompt

```txt
请阅读 docs/PRD.md 和 docs/PHASE2_BACKGROUND_ALERTS_PRD.md。

现在只实现 Phase 2 Step 3：Worker 端基金估值数据源。

要求：
1. 创建 worker/src/services/fundDataSource.ts。
2. 定义 FundEstimate 类型，字段包括：
   - code
   - name
   - estimatedNav
   - estimatedGrowth
   - nav
   - navDate
   - estimateTime
   - source
   - error
3. 实现：
   - getFundEstimate(code: string): Promise<FundEstimate>
   - getFundEstimates(codes: string[]): Promise<FundEstimate[]>
4. 复用或参考前端已有基金估值数据源逻辑，但不要让 Worker 依赖前端代码。
5. 支持请求超时，默认 10 秒。
6. 支持单只基金失败不影响其他基金。
7. 批量查询并发限制最多 5 个。
8. 如果接口失败，返回带 error 的 FundEstimate，不要 throw 导致整个任务失败。
9. 在代码注释中说明当前基金估值数据源是非官方数据源，未来可替换。
10. 新增 POST /api/test/fund-estimate，body:
    { "codes": ["161725"] }
11. API 返回查询结果。
12. 不要实现阈值判断。
13. 不要实现 PushPlus。
14. 不要实现 Web Push。

完成后请输出：
1. 修改了哪些文件
2. 使用了什么数据源
3. 如何测试 161725
4. 接口失败如何处理
```

## 你怎么验收

```bash
curl -X POST http://localhost:8787/api/test/fund-estimate \
  -H "Content-Type: application/json" \
  -d '{"codes":["161725"]}'
```

检查：

1. 有基金名称。
2. 有估算涨跌幅。
3. 错误时返回 error 字段。
4. 多个基金时单个失败不影响其他基金。

通过后提交：

```bash
git add .
git commit -m "feat(worker): add fund estimate data source"
```

---

# Step 4：实现阈值判断、防重复提醒和手动运行 API

## 发给 Codex 的 Prompt

```txt
请阅读 docs/PRD.md 和 docs/PHASE2_BACKGROUND_ALERTS_PRD.md。

现在只实现 Phase 2 Step 4：阈值判断、防重复提醒和手动运行 API。

要求：
1. 创建 worker/src/services/alertService.ts。
2. 创建 worker/src/services/historyService.ts。
3. 创建 worker/src/services/timeService.ts。
4. 实现阈值判断：
   - estimatedGrowth >= thresholdUp 触发上涨提醒
   - estimatedGrowth <= thresholdDown 触发下跌提醒
5. 如果基金 disabled，不提醒。
6. 如果没有 estimatedGrowth，不提醒。
7. 如果 thresholdUp / thresholdDown 未设置，不提醒。
8. 实现防重复提醒：
   KV key:
   fund-watcher:alert-dedupe:{date}:{fundCode}:{type}:{threshold}
9. 同一基金、同一阈值、同一交易日只提醒一次。
10. dedupe record 设置 expirationTtl 为 7 天。
11. 实现提醒历史：
    KV key:
    fund-watcher:alert-history
12. 提醒历史最多保存最近 100 条。
13. 实现 runOnce(env)：
    - 读取 background-config
    - 如果 config.enabled=false，直接返回
    - 查询启用基金的估值
    - 判断阈值
    - 写入 dedupe
    - 写入 history
    - 暂时只生成提醒记录，不发送通知
14. 实现 POST /api/run-once。
15. POST /api/run-once 返回：
    {
      ok: true,
      checked: number,
      alerts: number,
      records: []
    }
16. 不要实现 PushPlus。
17. 不要实现 Web Push。
18. 不要实现 Cron scheduled。

完成后请输出：
1. 修改了哪些文件
2. 阈值判断逻辑
3. 防重复提醒 key 设计
4. 如何验证 run-once
```

## 你怎么验收

先把某只基金阈值设置得很低，例如：

```json
{
  "thresholdUp": 0.01,
  "thresholdDown": -0.01
}
```

然后运行：

```bash
curl -X POST http://localhost:8787/api/run-once
```

连续运行两次：

1. 第一次应该可能产生 alerts。
2. 第二次同一天不应该重复产生同一个提醒。

通过后提交：

```bash
git add .
git commit -m "feat(worker): add alert evaluation and dedupe"
```

---

# Step 5：实现 PushPlus 移动端提醒

## 发给 Codex 的 Prompt

```txt
请阅读 docs/PRD.md 和 docs/PHASE2_BACKGROUND_ALERTS_PRD.md。

现在只实现 Phase 2 Step 5：PushPlus 移动端提醒。

要求：
1. 创建 worker/src/services/pushplusService.ts。
2. PushPlus token 必须从 env.PUSHPLUS_TOKEN 读取。
3. 不允许把 token 写死到代码里。
4. 不允许把 token 写入 KV 配置。
5. 实现 sendPushPlusMessage(env, message)。
6. 使用 POST 请求调用 PushPlus 发送接口。
7. 支持 title、content、template。
8. 默认 template 使用 html。
9. 实现 POST /api/test/pushplus。
10. /api/test/pushplus 用于发送一条测试通知。
11. 修改 runOnce：
    - 命中阈值后，如果 notify.pushplus.enabled=true，则发送 PushPlus。
    - PushPlus 发送成功后，提醒历史 notifyChannels 包含 pushplus。
12. PushPlus 失败时：
    - 记录错误日志
    - 不影响其他提醒
    - 不影响后续 Web Push
13. 如果未配置 PUSHPLUS_TOKEN：
    - 跳过 PushPlus
    - 返回明确 warning 或 error
14. 更新 docs/BACKGROUND_ALERTS.md，写明如何配置：
    wrangler secret put PUSHPLUS_TOKEN
15. 不要实现 Web Push。
16. 不要实现 Cron scheduled。

完成后请输出：
1. 修改了哪些文件
2. PushPlus token 如何配置
3. 如何发送测试通知
4. runOnce 如何触发 PushPlus
```

## 你怎么验收

配置 secret：

```bash
cd worker
wrangler secret put PUSHPLUS_TOKEN
```

本地测试时，如果使用 `.dev.vars`，注意不要提交到 GitHub：

```txt
PUSHPLUS_TOKEN=你的_token
```

测试：

```bash
curl -X POST http://localhost:8787/api/test/pushplus
```

然后测试 runOnce：

```bash
curl -X POST http://localhost:8787/api/run-once
```

通过后提交：

```bash
git add .
git commit -m "feat(worker): add pushplus notifications"
```

---

# Step 6：接入 Cloudflare Cron Trigger

## 发给 Codex 的 Prompt

```txt
请阅读 docs/PRD.md 和 docs/PHASE2_BACKGROUND_ALERTS_PRD.md。

现在只实现 Phase 2 Step 6：Cloudflare Cron Trigger。

要求：
1. 在 worker/src/index.ts 中实现 scheduled handler。
2. scheduled handler 内部复用 runOnce(env) 逻辑。
3. 在 worker/wrangler.toml 中配置：
   [triggers]
   crons = ["*/30 * * * *"]
4. scheduled 运行时需要记录日志：
   - 开始时间
   - 检查基金数量
   - 触发提醒数量
   - 错误信息
5. scheduled 不能因为单只基金失败而整体失败。
6. 如果 config.enabled=false，scheduled 应该安全退出。
7. 更新 docs/BACKGROUND_ALERTS.md，写明：
   - 如何本地测试 scheduled
   - 如何部署 Worker
   - 如何查看 Cloudflare 日志
8. 不要实现 Web Push。
9. 不要修改前端业务逻辑。

完成后请输出：
1. 修改了哪些文件
2. Cron 表达式
3. 如何本地测试 scheduled
4. 如何部署到 Cloudflare
```

## 你怎么验收

本地：

```bash
cd worker
wrangler dev --test-scheduled
```

然后按文档访问 scheduled 测试路径。

部署：

```bash
wrangler deploy
```

通过后提交：

```bash
git add .
git commit -m "feat(worker): add cron scheduled alerts"
```

---

# Step 7：前端设置页接入后台提醒配置和 PushPlus 测试

## 发给 Codex 的 Prompt

```txt
请阅读 docs/PRD.md、docs/PHASE2_BACKGROUND_ALERTS_PRD.md 和当前前端代码。

现在只实现 Phase 2 Step 7：前端设置页接入后台提醒配置和 PushPlus 测试。

要求：
1. 在前端新增 src/services/backgroundAlertApi.ts。
2. backgroundAlertApi 支持：
   - getBackgroundConfig()
   - saveBackgroundConfig(config)
   - syncFundsToBackgroundConfig(funds)
   - testPushPlus()
   - runOnce()
3. Worker API base URL 从配置读取。
   可以先使用环境变量：
   VITE_WORKER_API_BASE_URL
4. SettingsView 增加“后台提醒”模块。
5. 后台提醒模块包含：
   - Worker API 地址展示或配置说明
   - 后台提醒总开关
   - 同步当前自选基金到后台提醒按钮
   - 测试 PushPlus 通知按钮
   - 手动执行一次后台检查按钮
   - 后台提醒说明
6. 同步当前基金配置时，需要把当前 fundStore 里的基金 code、name、alias、enabled、thresholdUp、thresholdDown 发送给 Worker。
7. 不要在前端输入或保存 PushPlus token。
8. PushPlus token 只允许通过 Cloudflare Worker Secret 配置。
9. 所有请求需要 loading 和 error 状态。
10. 不要实现 Web Push。
11. 不要实现 AI。

完成后请输出：
1. 修改了哪些文件
2. 前端如何配置 Worker API base URL
3. 如何同步基金配置
4. 如何测试 PushPlus
```

## 你怎么验收

在前端 `.env.local`：

```txt
VITE_WORKER_API_BASE_URL=http://localhost:8787
```

启动前端和 Worker：

```bash
npm run dev
```

```bash
cd worker
npm run dev
```

测试：

1. 设置页能看到后台提醒模块。
2. 点击同步当前基金配置到后台。
3. 点击测试 PushPlus。
4. 点击手动执行一次后台检查。

通过后提交：

```bash
git add .
git commit -m "feat: add background alert settings"
```

---

# Step 8：实现桌面 Web Push 前端能力

## 发给 Codex 的 Prompt

```txt
请阅读 docs/PRD.md 和 docs/PHASE2_BACKGROUND_ALERTS_PRD.md。

现在只实现 Phase 2 Step 8：桌面 Web Push 前端能力。

要求：
1. 新增 public/sw.js。
2. sw.js 需要监听 push 事件。
3. sw.js 收到 push 后调用 self.registration.showNotification。
4. sw.js 需要监听 notificationclick 事件。
5. 新增 src/services/webPushClient.ts。
6. webPushClient 支持：
   - isWebPushSupported()
   - registerServiceWorker()
   - requestNotificationPermission()
   - subscribeToPush(publicKey)
   - unsubscribeFromPush()
   - getExistingSubscription()
7. 设置页“后台提醒”模块新增：
   - 桌面通知支持状态
   - 通知权限状态
   - 开启桌面系统通知按钮
   - 取消桌面系统通知按钮
8. 暂时不要上传 subscription 到 Worker。
9. 暂时不要实现 Worker Web Push 发送。
10. VAPID public key 可以先通过环境变量读取：
    VITE_VAPID_PUBLIC_KEY
11. 如果浏览器不支持 Service Worker、PushManager 或 Notification，需要展示明确提示。
12. 如果用户拒绝通知权限，需要展示明确提示。
13. 不要实现 AI。
14. 不要改动 PushPlus 逻辑。

完成后请输出：
1. 修改了哪些文件
2. Web Push 前端流程
3. 需要配置哪些环境变量
4. 如何在 Chrome / Edge 桌面端验证
```

## 你怎么验收

本地 HTTPS 最好，开发环境可以先验证支持状态和权限请求。

检查：

1. 能注册 Service Worker。
2. 能请求通知权限。
3. 能生成 subscription。
4. 取消订阅不报错。
5. 浏览器 Application 面板能看到 Service Worker。

通过后提交：

```bash
git add .
git commit -m "feat: add web push client support"
```

---

# Step 9：实现 Worker Web Push 保存订阅和测试发送

## 发给 Codex 的 Prompt

```txt
请阅读 docs/PRD.md 和 docs/PHASE2_BACKGROUND_ALERTS_PRD.md。

现在只实现 Phase 2 Step 9：Worker Web Push 订阅保存和测试发送。

要求：
1. 在 worker 中安装或实现 Web Push 发送能力。
2. 创建 worker/src/services/subscriptionService.ts。
3. 创建 worker/src/services/webPushService.ts。
4. subscriptionService 支持：
   - saveSubscription(env, subscription)
   - deleteSubscription(env, endpoint)
   - listSubscriptions(env)
   - cleanupInvalidSubscription(env, endpoint)
5. KV key 使用：
   fund-watcher:webpush:subscription:{subscriptionId}
6. subscriptionId 用 endpoint hash 生成。
7. 实现 API：
   POST /api/web-push/subscribe
   POST /api/web-push/unsubscribe
   POST /api/test/web-push
8. /api/web-push/subscribe 要校验：
   - subscription.endpoint 存在
   - subscription.keys.p256dh 存在
   - subscription.keys.auth 存在
9. Web Push 发送需要使用 VAPID：
   - VAPID_PUBLIC_KEY
   - VAPID_PRIVATE_KEY
   - VAPID_SUBJECT
10. VAPID private key 不允许写死。
11. 如果发送 Web Push 返回 404 或 410，需要删除失效 subscription。
12. 更新 docs/BACKGROUND_ALERTS.md，写明如何生成 VAPID keys、如何配置 secrets。
13. 不要改动 PushPlus。
14. 不要实现 AI。

完成后请输出：
1. 修改了哪些文件
2. Web Push Worker 发送流程
3. VAPID keys 如何配置
4. 如何测试 /api/test/web-push
```

## 你怎么验收

配置 secrets：

```bash
cd worker
wrangler secret put VAPID_PUBLIC_KEY
wrangler secret put VAPID_PRIVATE_KEY
wrangler secret put VAPID_SUBJECT
```

本地开发可用 `.dev.vars`，但不要提交。

启动前端和 Worker 后：

1. 设置页开启桌面通知。
2. subscription 上传到 Worker。
3. 调用测试接口：

```bash
curl -X POST http://localhost:8787/api/test/web-push
```

桌面系统通知栏应该收到通知。

通过后提交：

```bash
git add .
git commit -m "feat(worker): add web push subscription and test notification"
```

---

# Step 10：前端上传和删除 Web Push Subscription

## 发给 Codex 的 Prompt

```txt
请阅读 docs/PRD.md 和 docs/PHASE2_BACKGROUND_ALERTS_PRD.md。

现在只实现 Phase 2 Step 10：前端上传和删除 Web Push Subscription。

要求：
1. 完善 src/services/backgroundAlertApi.ts。
2. 新增：
   - subscribeWebPush(subscription)
   - unsubscribeWebPush(endpoint)
   - testWebPush()
3. 修改 SettingsView：
   - 用户开启桌面系统通知后，把 subscription 上传到 Worker。
   - 用户取消桌面系统通知时，先调用浏览器 unsubscribe，再调用 Worker 删除 subscription。
   - 增加测试桌面通知按钮。
4. 显示当前桌面通知状态：
   - unsupported
   - permission-default
   - permission-denied
   - subscribed
   - unsubscribed
5. 所有操作要有 loading、success、error 反馈。
6. 不要改动 PushPlus 逻辑。
7. 不要实现 AI。

完成后请输出：
1. 修改了哪些文件
2. 开启桌面通知的完整前端流程
3. 取消桌面通知的完整前端流程
4. 如何验证桌面系统通知
```

## 你怎么验收

测试：

1. 打开设置页。
2. 点击开启桌面系统通知。
3. 浏览器弹权限申请。
4. 同意。
5. 显示 subscribed。
6. 点击测试桌面通知。
7. 系统通知栏收到消息。
8. 点击取消桌面通知。
9. 状态变为 unsubscribed。

通过后提交：

```bash
git add .
git commit -m "feat: connect web push settings to worker"
```

---

# Step 11：Cron 命中阈值后同时发送 PushPlus 和 Web Push

## 发给 Codex 的 Prompt

```txt
请阅读 docs/PRD.md 和 docs/PHASE2_BACKGROUND_ALERTS_PRD.md。

现在只实现 Phase 2 Step 11：Cron 命中阈值后同时发送 PushPlus 和 Web Push。

要求：
1. 修改 runOnce(env)。
2. 命中阈值后：
   - 如果 notify.pushplus.enabled=true，发送 PushPlus。
   - 如果 notify.webPush.enabled=true，发送 Web Push。
3. PushPlus 和 Web Push 互不影响。
4. 一个渠道失败，不影响另一个渠道。
5. 提醒历史 notifyChannels 需要记录实际成功发送的渠道。
6. Web Push 发送失败时：
   - 记录失败数量
   - 清理 404 / 410 subscription
7. runOnce 返回：
   - checked
   - alerts
   - pushplusSent
   - webPushSent
   - webPushFailed
8. scheduled handler 复用 runOnce。
9. POST /api/run-once 也复用同一逻辑。
10. 不要实现 AI。
11. 不要实现自动交易。

完成后请输出：
1. 修改了哪些文件
2. 多渠道通知逻辑
3. 某个渠道失败时如何处理
4. 如何验证完整链路
```

## 你怎么验收

把某个基金阈值临时调低，例如：

```txt
thresholdUp = 0.01
thresholdDown = -0.01
```

运行：

```bash
curl -X POST http://localhost:8787/api/run-once
```

检查：

1. 手机收到 PushPlus。
2. 桌面收到系统通知。
3. alert history 有记录。
4. 第二次运行不会重复提醒。

通过后提交：

```bash
git add .
git commit -m "feat(worker): send pushplus and web push alerts"
```

---

# Step 12：完善文档和部署说明

## 发给 Codex 的 Prompt

```txt
请阅读 docs/PRD.md 和 docs/PHASE2_BACKGROUND_ALERTS_PRD.md。

现在只实现 Phase 2 Step 12：完善文档和部署说明。

要求：
1. 完善 docs/BACKGROUND_ALERTS.md。
2. 文档必须包含：
   - Phase 2 功能说明
   - Cloudflare 账号准备
   - Worker 部署步骤
   - KV namespace 创建步骤
   - wrangler.toml 配置说明
   - PushPlus token 获取和配置方式
   - VAPID keys 生成方式
   - Worker secrets 配置方式
   - 本地开发方式
   - Cron 本地测试方式
   - 前端环境变量配置
   - 设置页如何同步基金配置
   - 如何测试 PushPlus
   - 如何测试 Web Push
   - 如何查看 Cloudflare Worker 日志
   - 常见问题
3. 常见问题需要包含：
   - 为什么页面关闭后第一阶段不能提醒
   - 为什么移动端用 PushPlus
   - 为什么桌面端用 Web Push
   - 为什么 PushPlus token 不能写在前端
   - 为什么 Web Push 需要 Notification 权限
   - 为什么 iOS 需要添加到主屏幕
   - 为什么同一天不会重复提醒
4. 更新 README.md，增加 Phase 2 简要说明。
5. 不要改业务逻辑。
6. 不要实现 AI。

完成后请输出：
1. 修改了哪些文档
2. 部署前用户需要准备什么
3. 本地完整验证步骤
4. 线上完整验证步骤
```

## 你怎么验收

检查文档是否能让你自己按步骤完成：

1. 创建 KV。
2. 配置 secrets。
3. 部署 Worker。
4. 前端配置 Worker API 地址。
5. 同步基金配置。
6. 测试 PushPlus。
7. 测试 Web Push。
8. 测试 runOnce。
9. 等待 Cron 自动触发。

通过后提交：

```bash
git add .
git commit -m "docs: add background alerts setup guide"
```

---

# 最终验收清单

## Worker

- [ ] `/health` 正常。
- [ ] `/api/background-config` 可读写。
- [ ] `/api/test/fund-estimate` 可查基金估值。
- [ ] `/api/run-once` 可执行一次完整检查。
- [ ] `/api/test/pushplus` 可发送 PushPlus。
- [ ] `/api/web-push/subscribe` 可保存订阅。
- [ ] `/api/test/web-push` 可发送桌面通知。
- [ ] Cron 每 30 分钟自动运行。

## PushPlus

- [ ] token 不在代码里。
- [ ] token 使用 Worker Secret。
- [ ] 手机可以收到测试通知。
- [ ] 命中阈值时手机可以收到通知。

## Web Push

- [ ] 前端可以注册 Service Worker。
- [ ] 前端可以请求通知权限。
- [ ] 前端可以生成 subscription。
- [ ] 前端可以上传 subscription。
- [ ] Worker 可以保存 subscription。
- [ ] 桌面系统通知栏可以收到测试通知。
- [ ] 命中阈值时桌面系统通知栏可以收到提醒。
- [ ] 失效 subscription 可以清理。

## 防重复提醒

- [ ] 同一基金、同一阈值、同一交易日只提醒一次。
- [ ] 第二次 runOnce 不重复提醒。
- [ ] dedupe key 有 TTL。
- [ ] alert history 只保留最近 100 条。

## 安全

- [ ] PushPlus token 没有提交到 GitHub。
- [ ] VAPID private key 没有提交到 GitHub。
- [ ] 前端只使用 VAPID public key。
- [ ] 不保存交易账号。
- [ ] 不实现自动交易。
