# 基金估值助手 PRD

## 1. 项目概述

### 1.1 项目名称

基金估值助手
英文名：Fund Watcher

### 1.2 项目定位

一个面向个人使用的轻量级基金估值、指数行情、持仓盈亏和阈值提醒工具。

第一版以纯前端 Web H5 / PWA 形式实现，不需要登录系统，不需要云服务器，不接入交易功能，不做自动买卖。

### 1.3 项目目标

实现一个可以本地使用和部署的基金估值助手，帮助用户：

1. 管理自选基金列表。
2. 查看基金实时估值和估算涨跌幅。
3. 查看常用指数实时行情。
4. 维护个人基金持仓。
5. 根据实时估值计算当前持仓盈亏。
6. 当基金估算涨跌幅达到阈值时提醒用户。
7. 支持本地配置导入导出。
8. 后续预留 AI 分析能力。

---

## 2. 用户场景

### 2.1 核心用户

个人基金投资者。

### 2.2 使用场景

1. 用户在工作时间不想频繁打开基金 App，希望快速查看自选基金当天估值。
2. 用户想知道自己当前持仓基于估算净值的大致盈亏。
3. 用户希望某只基金涨跌幅达到 3%、5% 等阈值时收到提醒。
4. 用户希望后续通过 AI 分析整体持仓风险和单只基金情况。

---

## 3. 产品形态

### 3.1 第一版形态

Web H5 / PWA。

### 3.2 第一版部署方式

优先支持静态部署：

1. GitHub Pages
2. Vercel
3. Cloudflare Pages
4. Netlify

### 3.3 第一版不做的事情

1. 不做登录注册。
2. 不做多用户系统。
3. 不做小程序。
4. 不做自动交易。
5. 不做基金账户绑定。
6. 不做后台常驻监控。
7. 不做服务端数据库。
8. 不做 AI 投资建议。

---

## 4. 技术栈要求

### 4.1 前端技术栈

```txt
Vite
Vue 3
TypeScript
Pinia
Vue Router
Element Plus
localStorage
```

### 4.2 后续可选技术栈

```txt
Cloudflare Worker Cron
Cloudflare KV / D1
Telegram Bot
Server酱
PushPlus
OpenAI / DeepSeek / 通义千问 API
```

### 4.3 项目要求

1. 第一版必须可以纯前端运行。
2. 不依赖云服务器。
3. 不要求用户登录。
4. 数据默认存储在浏览器本地。
5. 所有第三方数据源必须封装在 service 层，不允许直接写在组件中。
6. 接口失败不能导致页面白屏。
7. 单只基金数据失败不能影响其他基金展示。
8. 必须支持上次成功数据缓存。

---

## 5. 功能范围

## 5.1 第一阶段：MVP

第一阶段实现以下功能：

1. 自选基金管理。
2. 基金估值查询。
3. 指数行情展示。
4. 持仓管理。
5. 持仓盈亏计算。
6. 阈值提醒。
7. 提醒记录。
8. 设置页。
9. 本地数据导入导出。
10. 免责声明展示。

## 5.2 第二阶段：后台定时提醒

后续通过 Cloudflare Worker Cron 实现页面关闭后的后台提醒。

## 5.3 第三阶段：AI 分析

后续接入 AI，对整体持仓和单只基金进行分析。

---

# 6. 第一阶段详细需求

## 6.1 自选基金管理

### 6.1.1 功能说明

用户可以维护自选基金列表。

### 6.1.2 功能点

1. 添加基金。
2. 删除基金。
3. 编辑基金别名。
4. 设置基金是否启用监控。
5. 设置上涨提醒阈值。
6. 设置下跌提醒阈值。
7. 页面刷新后数据保留。

### 6.1.3 基金代码校验

基金代码必须为 6 位数字。

示例：

```txt
161725
003096
110011
```

### 6.1.4 重复校验

同一个基金代码不能重复添加。

### 6.1.5 数据结构

```ts
export interface FundItem {
  code: string;
  name?: string;
  alias?: string;
  enabled: boolean;
  thresholdUp?: number;
  thresholdDown?: number;
  createdAt: number;
  updatedAt: number;
}
```

### 6.1.6 默认值

```ts
{
  enabled: true,
  thresholdUp: 3,
  thresholdDown: -3
}
```

---

## 6.2 基金估值查询

### 6.2.1 功能说明

系统支持查询自选基金的实时估值数据。

### 6.2.2 查询时机

1. 页面首次打开时自动查询一次。
2. 用户点击刷新按钮时主动查询一次。
3. 页面保持打开时，每 30 分钟自动查询一次。
4. 刷新间隔可在设置页修改。

### 6.2.3 展示字段

每只基金需要展示：

1. 基金名称。
2. 基金代码。
3. 用户别名。
4. 估算净值。
5. 估算涨跌幅。
6. 上一个正式单位净值。
7. 正式净值日期。
8. 估值更新时间。
9. 数据源。
10. 数据状态。

### 6.2.4 数据结构

```ts
export interface FundEstimate {
  code: string;
  name: string;
  estimatedNav: number | null;
  estimatedGrowth: number | null;
  nav: number | null;
  navDate: string | null;
  estimateTime: string | null;
  source: string;
  error?: string;
  stale?: boolean;
  cachedAt?: number;
}
```

### 6.2.5 数据状态

```ts
export type DataStatus = "idle" | "loading" | "success" | "error" | "stale";
```

### 6.2.6 交易时间判断

第一版简单判断 A 股交易时间：

```txt
周一至周五
09:30 - 11:30
13:00 - 15:00
```

不处理法定节假日。

### 6.2.7 非交易时间展示

如果当前不在交易时间，页面需要提示：

```txt
当前为非交易时间，估值数据可能为最近一次更新数据或上次收盘数据。
```

### 6.2.8 错误处理

1. 接口失败时不能白屏。
2. 单只基金失败不影响其他基金。
3. 如果存在上次成功缓存，展示缓存并标记为“可能已过期”。
4. 如果没有缓存，展示“获取失败”。
5. 提供手动重试按钮。

### 6.2.9 并发限制

批量查询基金估值时需要控制并发。

建议：

```txt
最多同时请求 5 个基金
```

---

## 6.3 指数行情展示

### 6.3.1 功能说明

首页展示常用指数行情。

### 6.3.2 默认指数

```txt
上证指数
深证成指
创业板指
沪深300
中证500
恒生指数
恒生科技
纳斯达克100
```

第一版如果部分境外指数数据源不好实现，可以先预留结构，优先实现 A 股指数。

### 6.3.3 展示字段

1. 指数名称。
2. 指数代码。
3. 当前点位。
4. 涨跌额。
5. 涨跌幅。
6. 昨收。
7. 更新时间。
8. 市场状态。
9. 数据源。

### 6.3.4 数据结构

```ts
export interface IndexQuote {
  code: string;
  name: string;
  price: number | null;
  change: number | null;
  changePercent: number | null;
  previousClose: number | null;
  updateTime: string | null;
  marketStatus: "open" | "closed" | "unknown";
  source: string;
  error?: string;
  stale?: boolean;
  cachedAt?: number;
}
```

### 6.3.5 错误处理

1. 指数行情失败不影响基金列表。
2. 如果存在缓存，展示缓存并标记为“可能已过期”。
3. 如果没有缓存，展示“获取失败”。

---

## 6.4 持仓管理

### 6.4.1 功能说明

用户可以为自选基金设置个人持仓，用于计算估算盈亏。

### 6.4.2 功能点

1. 添加持仓。
2. 编辑持仓。
3. 删除持仓。
4. 设置持有金额。
5. 设置目前已有收益。
6. 设置备注。
7. 页面刷新后持仓数据保留。

### 6.4.3 持仓字段

```ts
export interface Holding {
  fundCode: string;
  amount: number;
  currentProfit: number;
  note?: string;
  updatedAt: number;
}
```

### 6.4.4 输入规则

1. `amount` 必须大于 0，且表示当前持仓金额，已包含目前已有收益。
2. `currentProfit` 必须为数字，可以为负数。
3. `amount - currentProfit` 必须大于 0。
4. `fundCode` 必须来自已添加的自选基金。

---

## 6.5 持仓盈亏计算

### 6.5.1 功能说明

根据基金估算净值计算当前持仓情况。

### 6.5.2 计算字段

```ts
export interface HoldingComputed {
  fundCode: string;
  fundName: string;
  amount: number;
  currentProfit: number;
  principalAmount: number;
  currentEstimatedNav: number | null;
  latestNav: number | null;
  latestMarketValue: number;
  estimatedMarketValue: number | null;
  estimatedProfit: number | null;
  estimatedProfitPercent: number | null;
  todayProfit: number | null;
}
```

### 6.5.3 计算公式

```txt
持有金额 = 用户录入的当前持仓金额，已包含目前已有收益

推算本金 = 持有金额 - 目前已有收益

上一净值对应市值 = 持有金额

估算市值 = 上一净值对应市值 * (当前估算净值 / 上一个正式单位净值)

总估算盈亏 = 目前已有收益 + 今日估算盈亏

总估算收益率 = 总估算盈亏 / 推算本金 * 100%

今日估算盈亏 = 估算市值 - 上一净值对应市值
```

### 6.5.4 缺失数据处理

如果缺少当前估算净值，相关字段展示：

```txt
--
```

---

## 6.6 Dashboard 首页

### 6.6.1 功能说明

Dashboard 是用户进入应用后的首页。

### 6.6.2 首页内容

首页需要展示：

1. 持仓总览。
2. 指数行情卡片。
3. 自选基金估值列表。
4. 最近一次更新时间。
5. 手动刷新按钮。
6. 最近提醒记录。
7. 空状态引导。

### 6.6.3 持仓总览字段

1. 总估算市值。
2. 总持仓成本。
3. 总估算盈亏。
4. 总估算收益率。
5. 今日估算盈亏。

### 6.6.4 基金列表字段

1. 基金名称。
2. 基金代码。
3. 别名。
4. 估算净值。
5. 估算涨跌幅。
6. 上一正式净值。
7. 净值日期。
8. 估值更新时间。
9. 持仓盈亏。
10. 数据状态。

### 6.6.5 空状态

如果没有添加基金，展示：

```txt
暂无自选基金，请先添加基金代码。
```

并提供跳转到自选基金管理页的入口。

---

## 6.7 阈值提醒

### 6.7.1 功能说明

当基金估算涨跌幅达到用户设置的阈值时提醒用户。

### 6.7.2 触发条件

上涨提醒：

```txt
estimatedGrowth >= thresholdUp
```

下跌提醒：

```txt
estimatedGrowth <= thresholdDown
```

### 6.7.3 默认阈值

```txt
上涨：3%
下跌：-3%
```

### 6.7.4 自定义阈值

用户可以为每只基金单独设置上涨阈值和下跌阈值。

### 6.7.5 防重复提醒

同一基金、同一阈值、同一交易日只提醒一次。

唯一键建议：

```txt
fundCode + type + threshold + date
```

### 6.7.6 提醒方式

第一版支持：

1. 页面内 toast。
2. 浏览器 Notification API。
3. 提醒记录。

### 6.7.7 浏览器通知

1. 设置页提供通知授权按钮。
2. 用户未授权时不主动弹系统通知。
3. 用户拒绝通知权限后，页面内 toast 仍然可用。
4. 页面关闭后不保证通知。

### 6.7.8 提醒记录数据结构

```ts
export interface AlertRecord {
  id: string;
  fundCode: string;
  fundName: string;
  type: "up" | "down";
  threshold: number;
  actualGrowth: number;
  message: string;
  date: string;
  triggeredAt: number;
}
```

---

## 6.8 提醒记录页

### 6.8.1 功能说明

用户可以查看历史提醒记录。

### 6.8.2 功能点

1. 展示提醒记录列表。
2. 按时间倒序排列。
3. 展示基金名称、代码、提醒类型、阈值、实际涨跌幅、触发时间。
4. 支持清空提醒记录。
5. 没有记录时展示空状态。

---

## 6.9 设置页

### 6.9.1 功能说明

用户可以管理应用配置。

### 6.9.2 设置项

1. 自动刷新间隔。
2. 默认上涨提醒阈值。
3. 默认下跌提醒阈值。
4. 浏览器通知权限。
5. 主题设置。
6. 数据导入。
7. 数据导出。
8. 清空本地数据。
9. 免责声明。

### 6.9.3 设置数据结构

```ts
export interface AppSettings {
  refreshIntervalMinutes: number;
  enableBrowserNotification: boolean;
  defaultThresholdUp: number;
  defaultThresholdDown: number;
  theme: "light" | "dark" | "system";
}
```

### 6.9.4 默认设置

```ts
export const defaultSettings: AppSettings = {
  refreshIntervalMinutes: 30,
  enableBrowserNotification: false,
  defaultThresholdUp: 3,
  defaultThresholdDown: -3,
  theme: "system",
};
```

---

## 6.10 数据导入导出

### 6.10.1 功能说明

用户可以导出当前本地配置，也可以从 JSON 文件导入配置。

### 6.10.2 导出内容

导出 JSON 需要包含：

1. 版本号。
2. 导出时间。
3. 自选基金列表。
4. 持仓列表。
5. 提醒记录。
6. 设置项。

### 6.10.3 数据结构

```ts
export interface BackupData {
  version: string;
  exportedAt: number;
  funds: FundItem[];
  holdings: Holding[];
  alerts: AlertRecord[];
  settings: AppSettings;
}
```

### 6.10.4 导出要求

1. 点击导出按钮后生成 JSON 文件。
2. 文件名格式：

```txt
fund-watcher-backup-YYYY-MM-DD.json
```

### 6.10.5 导入要求

1. 用户选择 JSON 文件。
2. 系统校验 JSON 格式。
3. 校验是否包含必要字段。
4. 导入前提示是否覆盖当前数据。
5. 导入成功后刷新应用状态。
6. 导入失败时展示错误原因。

---

## 6.11 免责声明

设置页必须展示免责声明：

```txt
本工具仅用于个人数据整理和估值观察。

基金估值为第三方估算数据，不等于基金公司最终披露净值。

所有分析内容不构成投资建议。

投资有风险，决策需谨慎。
```

如果后续加入 AI 分析，AI 分析结果页也必须展示免责声明。

---

# 7. 页面设计

## 7.1 页面列表

### 7.1.1 Dashboard 首页

路径：

```txt
/
```

功能：

1. 展示持仓总览。
2. 展示指数行情。
3. 展示基金估值列表。
4. 支持手动刷新。
5. 展示最近提醒记录。

---

### 7.1.2 自选基金管理页

路径：

```txt
/funds
```

功能：

1. 添加基金。
2. 删除基金。
3. 编辑别名。
4. 设置启用状态。
5. 设置提醒阈值。

---

### 7.1.3 持仓管理页

路径：

```txt
/holdings
```

功能：

1. 添加持仓。
2. 编辑持仓。
3. 删除持仓。
4. 展示单只基金持仓盈亏。

---

### 7.1.4 提醒记录页

路径：

```txt
/alerts
```

功能：

1. 展示提醒记录。
2. 清空提醒记录。

---

### 7.1.5 设置页

路径：

```txt
/settings
```

功能：

1. 修改刷新间隔。
2. 修改默认阈值。
3. 管理通知权限。
4. 导入导出数据。
5. 清空本地数据。
6. 展示免责声明。

---

# 8. UI 要求

## 8.1 基础风格

1. 简洁。
2. 移动端优先。
3. 桌面端自适应。
4. 卡片式布局。
5. 信息层级清晰。
6. 操作按钮明显。

## 8.2 颜色规则

中国基金/股票语境：

```txt
上涨：红色
下跌：绿色
持平：灰色
```

## 8.3 响应式

最低适配宽度：

```txt
375px
```

移动端使用卡片布局。
桌面端可以使用表格或多列卡片。

## 8.4 状态展示

每个基金和指数卡片需要支持以下状态：

```txt
loading
success
error
stale
```

---

# 9. 数据源设计

## 9.1 数据源原则

1. 数据源必须封装在 service 层。
2. 组件不直接请求第三方接口。
3. 数据源实现必须可替换。
4. 接口失败时返回错误状态，不直接导致页面崩溃。
5. 支持缓存上次成功数据。
6. 非官方数据源需要在代码注释中说明。

## 9.2 基金数据源接口

```ts
export interface FundDataSource {
  getFundEstimate(code: string): Promise<FundEstimate>;
  getFundEstimates(codes: string[]): Promise<FundEstimate[]>;
}
```

## 9.3 指数数据源接口

```ts
export interface IndexDataSource {
  getIndexQuotes(codes: string[]): Promise<IndexQuote[]>;
}
```

## 9.4 缓存数据结构

```ts
export interface CacheItem<T> {
  data: T;
  updatedAt: number;
  source: string;
}
```

## 9.5 超时要求

单个请求需要设置超时。

建议：

```txt
10 秒
```

---

# 10. 本地存储设计

## 10.1 localStorage key

```txt
fund-watcher:funds
fund-watcher:holdings
fund-watcher:alerts
fund-watcher:settings
fund-watcher:cache:fund-estimates
fund-watcher:cache:index-quotes
```

## 10.2 storageService 要求

实现：

```ts
getItem<T>(key: string, fallback: T): T
setItem<T>(key: string, value: T): void
removeItem(key: string): void
clearAppData(): void
```

## 10.3 异常处理

1. JSON parse 失败时返回 fallback。
2. localStorage 不可用时不能导致页面白屏。
3. 写入失败时需要显示错误提示或写入 console。

---

# 11. 状态管理设计

## 11.1 fundStore

职责：

1. 管理自选基金列表。
2. 管理基金估值缓存。
3. 添加基金。
4. 删除基金。
5. 更新基金。
6. 刷新基金估值。
7. 从 localStorage 加载。
8. 保存到 localStorage。

## 11.2 holdingStore

职责：

1. 管理持仓列表。
2. 添加或更新持仓。
3. 删除持仓。
4. 计算单只持仓盈亏。
5. 计算总持仓盈亏。
6. 从 localStorage 加载。
7. 保存到 localStorage。

## 11.3 alertStore

职责：

1. 管理提醒记录。
2. 添加提醒记录。
3. 清空提醒记录。
4. 判断是否已经提醒过。
5. 从 localStorage 加载。
6. 保存到 localStorage。

## 11.4 settingsStore

职责：

1. 管理自动刷新间隔。
2. 管理默认阈值。
3. 管理浏览器通知设置。
4. 管理主题。
5. 从 localStorage 加载。
6. 保存到 localStorage。

---

# 12. 服务层设计

## 12.1 推荐目录

```txt
src/services/fundDataSource.ts
src/services/indexDataSource.ts
src/services/storageService.ts
src/services/notificationService.ts
src/services/alertService.ts
src/services/timeService.ts
src/services/backupService.ts
```

## 12.2 notificationService

职责：

1. 检查浏览器是否支持 Notification API。
2. 请求浏览器通知权限。
3. 发送浏览器通知。
4. 权限被拒绝时返回明确状态。

## 12.3 alertService

职责：

1. 根据基金估值和阈值判断是否触发提醒。
2. 生成提醒消息。
3. 防止重复提醒。
4. 写入提醒记录。
5. 触发页面 toast。
6. 触发浏览器通知。

## 12.4 timeService

职责：

1. 判断当前是否交易时间。
2. 获取当前交易日字符串。
3. 格式化时间。

## 12.5 backupService

职责：

1. 生成备份 JSON。
2. 下载备份文件。
3. 解析导入 JSON。
4. 校验导入数据结构。

---

# 13. 自动刷新逻辑

## 13.1 应用启动

```txt
App mounted
  -> load settings
  -> load funds
  -> load holdings
  -> load alerts
  -> refresh index quotes
  -> refresh fund estimates
  -> compute holdings
  -> check alerts
  -> start interval timer
```

## 13.2 定时刷新

```txt
Every refreshIntervalMinutes
  -> refresh index quotes
  -> refresh fund estimates
  -> compute holdings
  -> check alerts
```

## 13.3 手动刷新

```txt
User clicks refresh
  -> refresh index quotes
  -> refresh fund estimates
  -> compute holdings
  -> check alerts
```

## 13.4 页面关闭

第一版不处理页面关闭后的任务。

设置页需要明确说明：

```txt
当前版本为本地浏览器版本，页面关闭或设备休眠后无法继续监控提醒。
如需后台提醒，需要后续启用 Serverless 定时任务版本。
```

---

# 14. 错误处理

## 14.1 常见错误类型

1. 网络错误。
2. 请求超时。
3. 第三方接口返回异常。
4. 基金代码不存在。
5. 指数代码不存在。
6. CORS 问题。
7. localStorage 读写失败。
8. JSON 导入格式错误。
9. 浏览器通知权限被拒绝。

## 14.2 错误处理原则

1. 不允许白屏。
2. 不允许单个请求失败影响整个页面。
3. 用户能看到明确错误提示。
4. 有缓存时展示缓存。
5. 没有缓存时展示空状态或错误状态。
6. 开发调试信息可以写入 console。

---

# 15. 非功能需求

## 15.1 性能

1. 支持 100 只以内基金自选列表正常使用。
2. 批量请求需要并发限制。
3. 页面切换不卡顿。
4. 刷新时不阻塞页面操作。
5. 静态资源体积尽量控制。

## 15.2 安全

1. 不存储基金账户信息。
2. 不存储交易密码。
3. 不接入自动交易。
4. 不在前端保存 AI API Key。
5. 不采集用户隐私数据。
6. 所有数据默认保存在用户浏览器本地。

## 15.3 可维护性

1. 类型定义统一放在 `src/types`。
2. 数据请求统一放在 `src/services`。
3. 状态管理统一放在 `src/stores`。
4. 页面组件不要包含复杂数据源逻辑。
5. 后续可以替换数据源，不影响 UI 层。

---

# 16. 项目目录建议

```txt
fund-watcher/
  docs/
    PRD.md
    TASKS.md
  public/
  src/
    main.ts
    App.vue
    router/
      index.ts
    stores/
      fundStore.ts
      holdingStore.ts
      alertStore.ts
      settingsStore.ts
    services/
      fundDataSource.ts
      indexDataSource.ts
      storageService.ts
      notificationService.ts
      alertService.ts
      timeService.ts
      backupService.ts
    types/
      fund.ts
      holding.ts
      alert.ts
      settings.ts
      indexQuote.ts
      backup.ts
    views/
      DashboardView.vue
      FundsView.vue
      HoldingsView.vue
      AlertsView.vue
      SettingsView.vue
    components/
      FundCard.vue
      IndexQuoteCard.vue
      HoldingSummary.vue
      AlertList.vue
      RefreshButton.vue
      EmptyState.vue
  index.html
  package.json
  vite.config.ts
  README.md
```

---

# 17. 验收标准

## 17.1 项目初始化

- [ ] 使用 Vite + Vue 3 + TypeScript。
- [ ] 配置 Pinia。
- [ ] 配置 Vue Router。
- [ ] 配置 Element Plus。
- [ ] 可以运行 `npm install`。
- [ ] 可以运行 `npm run dev`。
- [ ] 可以运行 `npm run build`。

## 17.2 自选基金管理

- [ ] 可以添加 6 位基金代码。
- [ ] 非 6 位数字不能添加。
- [ ] 重复基金不能添加。
- [ ] 可以删除基金。
- [ ] 可以编辑别名。
- [ ] 可以启用或禁用监控。
- [ ] 可以设置上涨阈值。
- [ ] 可以设置下跌阈值。
- [ ] 页面刷新后数据保留。

## 17.3 基金估值查询

- [ ] 页面打开后自动查询。
- [ ] 点击刷新按钮可以主动查询。
- [ ] 页面打开期间可以按设置间隔自动查询。
- [ ] 默认刷新间隔为 30 分钟。
- [ ] 可以展示基金名称、代码、估算净值、估算涨跌幅、正式净值、更新时间。
- [ ] 单只基金失败不影响其他基金。
- [ ] 接口失败时页面不白屏。
- [ ] 有缓存时展示缓存并标记可能过期。

## 17.4 指数行情

- [ ] 首页展示默认指数。
- [ ] 可以展示点位、涨跌额、涨跌幅、更新时间。
- [ ] 指数接口失败不影响基金列表。
- [ ] 有缓存时展示缓存并标记可能过期。

## 17.5 持仓管理

- [ ] 可以为已添加基金设置持仓。
- [ ] 可以输入持有金额。
- [ ] 可以输入目前已有收益。
- [ ] 可以编辑持仓。
- [ ] 可以删除持仓。
- [ ] 页面刷新后持仓保留。

## 17.6 盈亏计算

- [ ] 可以计算持仓成本。
- [ ] 可以计算估算市值。
- [ ] 可以计算估算盈亏。
- [ ] 可以计算估算收益率。
- [ ] 可以计算今日估算盈亏。
- [ ] 缺少估值时展示 `--`。
- [ ] Dashboard 可以展示总估算市值、总盈亏、总收益率、今日盈亏。

## 17.7 阈值提醒

- [ ] 达到上涨阈值时触发提醒。
- [ ] 达到下跌阈值时触发提醒。
- [ ] 同一基金同一阈值同一交易日不重复提醒。
- [ ] 页面内 toast 可用。
- [ ] 浏览器 Notification 可用。
- [ ] 浏览器通知被拒绝后页面内提醒仍可用。
- [ ] 提醒记录可以保存。

## 17.8 提醒记录

- [ ] 可以查看历史提醒。
- [ ] 提醒记录按时间倒序排列。
- [ ] 可以清空提醒记录。
- [ ] 没有记录时展示空状态。

## 17.9 设置页

- [ ] 可以修改自动刷新间隔。
- [ ] 可以修改默认上涨阈值。
- [ ] 可以修改默认下跌阈值。
- [ ] 可以请求浏览器通知权限。
- [ ] 可以导出 JSON。
- [ ] 可以导入 JSON。
- [ ] 可以清空本地数据。
- [ ] 展示免责声明。
- [ ] 说明页面关闭后第一版无法继续监控。

## 17.10 导入导出

- [ ] 导出的 JSON 包含 version、exportedAt、funds、holdings、alerts、settings。
- [ ] 导入前校验 JSON 格式。
- [ ] 导入前提示是否覆盖当前数据。
- [ ] 导入成功后应用状态更新。
- [ ] 导入失败时展示错误原因。

---

# 18. 开发顺序

## Step 1：初始化项目

1. 创建 Vite + Vue 3 + TypeScript 项目。
2. 安装 Pinia。
3. 安装 Vue Router。
4. 安装 Element Plus。
5. 创建基础页面。
6. 配置基础路由。
7. App.vue 提供基础导航。
8. 保证项目可启动和构建。

## Step 2：定义类型和本地存储

1. 创建 `src/types`。
2. 定义核心 interface。
3. 创建 `storageService`。
4. 实现 localStorage 读写。
5. 处理 JSON parse 错误。

## Step 3：实现 Pinia Stores

1. 实现 `fundStore`。
2. 实现 `holdingStore`。
3. 实现 `alertStore`。
4. 实现 `settingsStore`。
5. 确保刷新页面后数据保留。

## Step 4：实现自选基金管理页

1. 实现基金添加。
2. 实现基金删除。
3. 实现别名编辑。
4. 实现启用状态设置。
5. 实现阈值设置。

## Step 5：实现基金估值数据源

1. 实现 `fundDataSource`。
2. 支持单只基金查询。
3. 支持批量基金查询。
4. 支持超时处理。
5. 支持缓存。
6. 支持错误状态。

## Step 6：实现 Dashboard 基金估值展示

1. 页面打开自动刷新。
2. 支持手动刷新。
3. 支持定时刷新。
4. 展示基金估值列表。
5. 展示 loading、error、stale 状态。

## Step 7：实现指数行情

1. 实现 `indexDataSource`。
2. 首页展示默认指数。
3. 支持缓存和错误状态。

## Step 8：实现持仓管理和盈亏计算

1. 实现持仓管理页。
2. 实现单只基金盈亏计算。
3. 实现 Dashboard 总览计算。

## Step 9：实现阈值提醒

1. 实现 `notificationService`。
2. 实现 `alertService`。
3. 实现页面内 toast。
4. 实现浏览器通知。
5. 实现防重复提醒。
6. 实现提醒记录页。

## Step 10：实现设置页和导入导出

1. 修改刷新间隔。
2. 修改默认阈值。
3. 管理通知权限。
4. 导出 JSON。
5. 导入 JSON。
6. 清空本地数据。
7. 展示免责声明。

## Step 11：部署配置

1. 配置 GitHub Pages 部署。
2. 配置 `vite.config.ts` 的 `base`。
3. 添加 GitHub Actions workflow。
4. 更新 README。

---

# 19. 后续阶段规划

## 19.1 第二阶段：后台提醒

### 目标

页面关闭后也能定时监控基金估值并发送通知。

### 技术方案

```txt
Cloudflare Worker Cron
Cloudflare KV
Telegram Bot / Server酱 / PushPlus
```

### 功能

1. 每 30 分钟执行一次。
2. 从配置中读取基金列表。
3. 查询基金估值。
4. 判断阈值。
5. 发送通知。
6. 记录当天已提醒阈值。
7. 避免重复提醒。

---

## 19.2 第三阶段：AI 分析

### 目标

基于用户持仓和基金数据提供辅助分析。

### 整体持仓分析

内容包括：

1. 当前持仓概览。
2. 基金类型分布。
3. 行业或主题集中度。
4. 今日波动原因观察。
5. 风险提示。
6. 可继续观察的指标。

### 单基金分析

内容包括：

1. 基金基本信息。
2. 近期表现。
3. 历史净值走势。
4. 回撤情况。
5. 基金经理信息。
6. 重仓行业或股票。
7. 风险提示。

### AI 安全要求

1. AI API Key 不允许写在前端。
2. 必须通过 Serverless Function 或 Worker 中转。
3. AI 结果必须展示免责声明。
4. 不直接给出买入或卖出指令。
5. 输出定位为信息整理和风险观察。

---

# 20. 限制说明

## 20.1 第一版限制

1. 页面关闭后无法继续定时监控。
2. 设备休眠后无法继续定时监控。
3. 基金估值依赖第三方数据源，可能延迟或失败。
4. 基金估值不等于最终净值。
5. 非交易日或非交易时间数据可能不是实时数据。
6. 本地数据保存在浏览器，清除浏览器数据会导致配置丢失。
7. 不支持多设备同步。
8. 不支持登录。
9. 不支持后台通知。

## 20.2 数据源限制

1. 第三方数据源可能变更格式。
2. 第三方数据源可能限制访问。
3. 某些基金可能没有实时估值。
4. 跨域问题可能需要 JSONP 或代理服务解决。

---

# 21. 开发约束

1. 一次只实现当前步骤，不要提前实现后续功能。
2. 不要引入后端服务。
3. 不要实现登录系统。
4. 不要实现自动交易。
5. 不要把 API Key 写入前端。
6. 不要把复杂业务逻辑写在 Vue 组件里。
7. 数据源必须可替换。
8. 所有 TypeScript 类型必须明确。
9. 每个功能完成后需要保证 `npm run build` 成功。
10. 修改代码后需要说明变更文件和验证方式。
