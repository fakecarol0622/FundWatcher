# Fund Watcher Implementation Tasks

## Phase 1 MVP

- [x] Step 1: 初始化项目
- [ ] Step 2: 定义 types 和 storageService
- [x] Step 3: 实现 Pinia stores
- [x] Step 4: 实现自选基金管理
- [x] Step 5: 实现基金估值数据源
- [x] Step 6: 实现 Dashboard 基金估值展示
- [x] Step 7: 实现指数行情
- [x] Step 8: 实现持仓管理和盈亏计算
- [x] Step 9: 实现阈值提醒
- [x] Step 10: 实现设置页和导入导出
- [x] Step 11: 配置 GitHub Pages 部署

## Phase 2

- [x] Step 1: 创建 Cloudflare Worker 项目
  - [x] 新增 `worker/` TypeScript Worker 项目
  - [x] 实现 `GET /health`
  - [x] 实现基础 CORS
  - [x] 新增 `docs/BACKGROUND_ALERTS.md` 本地启动说明
- [ ] Step 2: 接入 Cloudflare KV 和后台配置 API
  - [ ] 配置 `FUND_WATCHER_KV` binding 示例
  - [ ] 实现后台监控配置类型、默认配置和校验
  - [ ] 实现 `GET /api/background-config`
  - [ ] 实现 `POST /api/background-config`
  - [ ] 文档补充 KV namespace 创建和配置方式
- [ ] Step 3: 实现 Worker 端基金估值数据源
  - [ ] 实现单只基金估值查询
  - [ ] 实现批量查询、超时和并发限制
  - [ ] 实现 `POST /api/test/fund-estimate`
  - [ ] 单只基金失败不影响整批查询
- [ ] Step 4: 实现阈值判断、防重复提醒和手动运行 API
  - [ ] 实现上涨/下跌阈值判断
  - [ ] 实现同一基金、同一阈值、同一交易日防重复提醒
  - [ ] 实现最近 100 条提醒历史
  - [ ] 实现 `POST /api/run-once`
- [ ] Step 5: 实现 PushPlus 移动端提醒
  - [ ] 从 Worker Secret `PUSHPLUS_TOKEN` 读取 token
  - [ ] 实现 PushPlus 发送服务
  - [ ] 实现 `POST /api/test/pushplus`
  - [ ] `runOnce` 命中阈值后发送 PushPlus
  - [ ] 文档补充 PushPlus token 配置方式
- [ ] Step 6: 接入 Cloudflare Cron Trigger
  - [ ] 实现 Worker `scheduled` handler
  - [ ] Cron 复用 `runOnce`
  - [ ] 配置 `*/30 * * * *`
  - [ ] 文档补充 scheduled 本地测试、部署和日志查看
- [ ] Step 7: 前端设置页接入后台提醒配置和 PushPlus 测试
  - [ ] 新增 `src/services/backgroundAlertApi.ts`
  - [ ] Worker API 地址通过 `VITE_WORKER_API_BASE_URL` 配置
  - [ ] 设置页新增后台提醒模块
  - [ ] 支持同步当前自选基金到后台配置
  - [ ] 支持测试 PushPlus 和手动执行后台检查
- [ ] Step 8: 实现桌面 Web Push 前端能力
  - [ ] 新增 `public/sw.js`
  - [ ] 新增 `src/services/webPushClient.ts`
  - [ ] 支持 Service Worker 注册、权限申请、订阅和取消订阅
  - [ ] 设置页展示桌面通知支持状态和权限状态
- [ ] Step 9: 实现 Worker Web Push 保存订阅和测试发送
  - [ ] 实现 Web Push subscription 保存、删除和列表能力
  - [ ] 实现 VAPID Web Push 发送服务
  - [ ] 实现 `POST /api/web-push/subscribe`
  - [ ] 实现 `POST /api/web-push/unsubscribe`
  - [ ] 实现 `POST /api/test/web-push`
  - [ ] 文档补充 VAPID keys 生成和 secrets 配置方式
- [ ] Step 10: 前端上传和删除 Web Push Subscription
  - [ ] 完善 `backgroundAlertApi` 的 Web Push API
  - [ ] 开启桌面通知后上传 subscription 到 Worker
  - [ ] 取消桌面通知后删除 Worker subscription
  - [ ] 设置页支持测试桌面通知
- [ ] Step 11: Cron 命中阈值后同时发送 PushPlus 和 Web Push
  - [ ] `runOnce` 同时支持 PushPlus 和 Web Push
  - [ ] 通知渠道互不影响
  - [ ] 提醒历史记录实际发送成功的渠道
  - [ ] 返回 PushPlus / Web Push 发送统计
- [ ] Step 12: 完善文档和部署说明
  - [ ] 完善 `docs/BACKGROUND_ALERTS.md`
  - [ ] README 增加 Phase 2 简要说明
  - [ ] 补充本地完整验证步骤
  - [ ] 补充线上完整验证步骤

### Phase 2 Final Acceptance

- [ ] `/health` 正常
- [ ] `/api/background-config` 可读写
- [ ] `/api/test/fund-estimate` 可查基金估值
- [ ] `/api/run-once` 可执行完整检查
- [ ] `/api/test/pushplus` 可发送 PushPlus
- [ ] `/api/web-push/subscribe` 可保存订阅
- [ ] `/api/test/web-push` 可发送桌面通知
- [ ] Cron 每 30 分钟自动运行
- [ ] PushPlus token 未提交到仓库
- [ ] VAPID private key 未提交到仓库
- [ ] 同一基金、同一阈值、同一交易日只提醒一次

## Phase 3

- [ ] AI 持仓分析
- [ ] 单基金 AI 分析
