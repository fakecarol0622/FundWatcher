<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { ArrowDown, ArrowRight, Plus, Refresh, Warning } from "@element-plus/icons-vue";
import { useFundStore } from "../stores/fundStore";
import { useSettingsStore } from "../stores/settingsStore";
import { DEFAULT_INDEX_CODES, DEFAULT_INDEXES, indexDataSource } from "../services/indexDataSource";
import { formatDateTime, isAStockTradingTime } from "../services/timeService";
import type { DataStatus, FundEstimate, FundItem } from "../types/fund";
import type { IndexDefinition } from "../services/indexDataSource";
import type { IndexQuote } from "../types/indexQuote";

interface FundEstimateRow {
  fund: FundItem;
  estimate: FundEstimate | undefined;
  status: DataStatus;
}

interface IndexQuoteRow {
  definition: IndexDefinition;
  quote: IndexQuote | undefined;
  status: DataStatus;
}

interface IndexQuoteGroup {
  key: IndexDefinition["market"];
  title: string;
  rows: IndexQuoteRow[];
}

const DEFAULT_REFRESH_INTERVAL_MINUTES = 30;

const router = useRouter();
const fundStore = useFundStore();
const settingsStore = useSettingsStore();

const indexQuotes = ref<IndexQuote[]>([]);
const isRefreshingIndexes = ref(false);
const indexLastRefreshAt = ref<number | null>(null);
const isIndexSectionExpanded = ref(true);
const expandedIndexGroups = ref<Record<IndexDefinition["market"], boolean>>({
  "a-share": true,
  hk: true,
  us: true,
});

let refreshTimer: number | undefined;

const enabledFunds = computed(() =>
  [...fundStore.enabledFunds].sort((left, right) => right.createdAt - left.createdAt),
);

const estimateRows = computed<FundEstimateRow[]>(() =>
  enabledFunds.value.map((fund) => ({
    fund,
    estimate: fundStore.estimates[fund.code],
    status: fundStore.getEstimateStatus(fund.code),
  })),
);

const indexRows = computed<IndexQuoteRow[]>(() =>
  DEFAULT_INDEXES.map((definition) => {
    const quote = indexQuotes.value.find((item) => item.code === definition.code);

    return {
      definition,
      quote,
      status: getIndexStatus(quote),
    };
  }),
);

const indexGroups = computed<IndexQuoteGroup[]>(() => {
  const groupTitles: Record<IndexDefinition["market"], string> = {
    "a-share": "A 股指数",
    hk: "港股指数",
    us: "美股指数",
  };

  return (["a-share", "hk", "us"] as IndexDefinition["market"][])
    .map((market) => ({
      key: market,
      title: groupTitles[market],
      rows: indexRows.value.filter((row) => row.definition.market === market),
    }))
    .filter((group) => group.rows.length > 0);
});

const hasFunds = computed(() => fundStore.funds.length > 0);
const hasEnabledFunds = computed(() => enabledFunds.value.length > 0);
const isTradingTime = computed(() => isAStockTradingTime());

const refreshIntervalMinutes = computed(() => {
  const value = Number(settingsStore.refreshIntervalMinutes);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_REFRESH_INTERVAL_MINUTES;
});

const refreshIntervalText = computed(() => `${refreshIntervalMinutes.value} 分钟`);
const lastRefreshText = computed(() => formatDateTime(fundStore.lastRefreshAt));
const indexLastRefreshText = computed(() => formatDateTime(indexLastRefreshAt.value));
const isRefreshingDashboard = computed(
  () => fundStore.isRefreshingEstimates || isRefreshingIndexes.value,
);

function formatNumber(value: number | null | undefined, digits = 4): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "--";
  }

  return value.toFixed(digits);
}

function formatGrowth(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "--";
  }

  return `${value.toFixed(2)}%`;
}

function formatSignedNumber(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "--";
  }

  return `${value > 0 ? "+" : ""}${value.toFixed(digits)}`;
}

function formatMarketStatus(status: IndexQuote["marketStatus"] | undefined): string {
  const statusTexts: Record<IndexQuote["marketStatus"], string> = {
    open: "交易中",
    closed: "已休市",
    unknown: "未知",
  };

  return status ? statusTexts[status] : "--";
}

function getGrowthClass(value: number | null | undefined): string {
  if (value === null || value === undefined || value === 0) {
    return "growth-flat";
  }

  return value > 0 ? "growth-up" : "growth-down";
}

function getStatusType(status: DataStatus): "info" | "primary" | "success" | "warning" | "danger" {
  const statusTypes: Record<DataStatus, "info" | "primary" | "success" | "warning" | "danger"> = {
    idle: "info",
    loading: "primary",
    success: "success",
    error: "danger",
    stale: "warning",
  };

  return statusTypes[status];
}

function getStatusText(status: DataStatus): string {
  const statusTexts: Record<DataStatus, string> = {
    idle: "未刷新",
    loading: "刷新中",
    success: "正常",
    error: "获取失败",
    stale: "可能已过期",
  };

  return statusTexts[status];
}

function getIndexStatus(quote: IndexQuote | undefined): DataStatus {
  if (isRefreshingIndexes.value && !quote) {
    return "loading";
  }

  if (!quote) {
    return "idle";
  }

  if (quote.stale) {
    return "stale";
  }

  if (quote.error) {
    return "error";
  }

  return "success";
}

function getDisplayName(row: FundEstimateRow): string {
  return row.estimate?.name || row.fund.name || "未命名基金";
}

function getAlias(fund: FundItem): string {
  return fund.alias?.trim() || "--";
}

function getRowsSummary(rows: IndexQuoteRow[]): string {
  const availableRows = rows.filter((row) => row.quote && !row.quote.error);
  const upCount = availableRows.filter((row) => (row.quote?.changePercent ?? 0) > 0).length;
  const downCount = availableRows.filter((row) => (row.quote?.changePercent ?? 0) < 0).length;
  const staleCount = rows.filter((row) => row.status === "stale").length;
  const errorCount = rows.filter((row) => row.status === "error").length;

  return `${availableRows.length}/${rows.length} 可用 · 涨 ${upCount} · 跌 ${downCount}${
    staleCount > 0 ? ` · 过期 ${staleCount}` : ""
  }${errorCount > 0 ? ` · 失败 ${errorCount}` : ""}`;
}

function getGroupLeadRow(rows: IndexQuoteRow[]): IndexQuoteRow | undefined {
  return rows.find((row) => row.quote && !row.quote.error) ?? rows[0];
}

function getGroupSummary(group: IndexQuoteGroup): string {
  const leadRow = getGroupLeadRow(group.rows);
  if (!leadRow) {
    return getRowsSummary(group.rows);
  }

  return `${getRowsSummary(group.rows)} · ${leadRow.definition.name} ${formatNumber(
    leadRow.quote?.price,
    2,
  )} ${formatGrowth(leadRow.quote?.changePercent)}`;
}

function getIndexSectionSummary(): string {
  return getRowsSummary(indexRows.value);
}

function toggleIndexSection(): void {
  isIndexSectionExpanded.value = !isIndexSectionExpanded.value;
}

function toggleIndexGroup(key: IndexDefinition["market"]): void {
  expandedIndexGroups.value[key] = !expandedIndexGroups.value[key];
}

async function refreshEstimates(): Promise<void> {
  if (!hasEnabledFunds.value || fundStore.isRefreshingEstimates) {
    return;
  }

  await fundStore.refreshEnabledEstimates();
}

async function refreshIndexes(): Promise<void> {
  if (isRefreshingIndexes.value) {
    return;
  }

  isRefreshingIndexes.value = true;

  try {
    indexQuotes.value = await indexDataSource.getIndexQuotes(DEFAULT_INDEX_CODES);
  } catch (error) {
    console.error("[DashboardView] Failed to refresh index quotes.", error);
  } finally {
    indexLastRefreshAt.value = Date.now();
    isRefreshingIndexes.value = false;
  }
}

async function refreshDashboard(): Promise<void> {
  await Promise.allSettled([refreshIndexes(), refreshEstimates()]);
}

function clearRefreshTimer(): void {
  if (refreshTimer !== undefined) {
    window.clearInterval(refreshTimer);
    refreshTimer = undefined;
  }
}

function startRefreshTimer(): void {
  clearRefreshTimer();

  refreshTimer = window.setInterval(() => {
    void refreshDashboard();
  }, refreshIntervalMinutes.value * 60 * 1000);
}

function goToFunds(): void {
  void router.push("/funds");
}

onMounted(() => {
  fundStore.loadFromStorage();
  settingsStore.loadFromStorage();
  void refreshDashboard();
  startRefreshTimer();
});

onUnmounted(() => {
  clearRefreshTimer();
});

watch(
  () => refreshIntervalMinutes.value,
  () => {
    startRefreshTimer();
  },
);
</script>

<template>
  <section class="dashboard-view">
    <el-card shadow="never" class="summary-card">
      <template #header>
        <div class="dashboard-header">
          <div class="title-block">
            <h1>基金估值</h1>
            <span>最近刷新：{{ lastRefreshText }} · 自动刷新：{{ refreshIntervalText }}</span>
          </div>

          <el-button
            type="primary"
            :icon="Refresh"
            :loading="isRefreshingDashboard"
            @click="refreshDashboard"
          >
            刷新
          </el-button>
        </div>
      </template>

      <el-alert
        v-if="!isTradingTime"
        class="market-alert"
        type="warning"
        :closable="false"
        show-icon
        title="当前为非交易时间，估值数据可能为最近一次更新数据或上次收盘数据。"
      />
    </el-card>

    <el-card shadow="never" class="index-card">
      <template #header>
        <div class="section-header">
          <button class="collapse-title" type="button" @click="toggleIndexSection">
            <el-icon>
              <ArrowDown v-if="isIndexSectionExpanded" />
              <ArrowRight v-else />
            </el-icon>
            <span>
              <strong>指数行情</strong>
              <small>
                最近刷新：{{ indexLastRefreshText }}
                <template v-if="!isIndexSectionExpanded"> · {{ getIndexSectionSummary() }}</template>
              </small>
            </span>
          </button>

          <el-tag :type="isRefreshingIndexes ? 'primary' : 'info'" effect="light">
            {{ isRefreshingIndexes ? "刷新中" : "默认指数" }}
          </el-tag>
        </div>
      </template>

      <section v-if="isIndexSectionExpanded" class="index-groups">
        <section v-for="group in indexGroups" :key="group.key" class="index-group">
          <button class="group-header" type="button" @click="toggleIndexGroup(group.key)">
            <span class="group-title">
              <el-icon>
                <ArrowDown v-if="expandedIndexGroups[group.key]" />
                <ArrowRight v-else />
              </el-icon>
              <strong>{{ group.title }}</strong>
            </span>

            <span class="group-summary">{{ getGroupSummary(group) }}</span>
          </button>

          <div v-if="expandedIndexGroups[group.key]" class="index-list">
            <article
              v-for="row in group.rows"
              :key="row.definition.code"
              class="quote-card"
              :class="{ loading: row.status === 'loading' }"
            >
              <header class="quote-card-header">
                <div class="quote-identity">
                  <strong>{{ row.quote?.name || row.definition.name }}</strong>
                  <span>{{ row.definition.code }}</span>
                </div>

                <el-tag :type="getStatusType(row.status)" effect="light">
                  {{ getStatusText(row.status) }}
                </el-tag>
              </header>

              <div class="quote-price">
                <strong>{{ formatNumber(row.quote?.price, 2) }}</strong>
                <span :class="getGrowthClass(row.quote?.changePercent)">
                  {{ formatSignedNumber(row.quote?.change, 2) }}
                  / {{ formatGrowth(row.quote?.changePercent) }}
                </span>
              </div>

              <div class="field-grid quote-field-grid">
                <div class="field">
                  <span>昨收</span>
                  <strong>{{ formatNumber(row.quote?.previousClose, 2) }}</strong>
                </div>

                <div class="field">
                  <span>更新时间</span>
                  <strong>{{ row.quote?.updateTime || "--" }}</strong>
                </div>

                <div class="field">
                  <span>市场状态</span>
                  <strong>{{ formatMarketStatus(row.quote?.marketStatus) }}</strong>
                </div>

                <div class="field">
                  <span>数据源</span>
                  <strong>{{ row.quote?.source || "--" }}</strong>
                </div>
              </div>

              <footer v-if="row.quote?.error || row.status === 'stale'" class="estimate-message">
                <el-icon><Warning /></el-icon>
                <span>
                  {{
                    row.status === "stale"
                      ? `正在展示上次成功缓存。${row.quote?.error || ""}`
                      : row.quote?.error
                  }}
                </span>
              </footer>
            </article>
          </div>
        </section>
      </section>
    </el-card>

    <el-card shadow="never" class="summary-card">

      <el-empty v-if="!hasFunds" description="暂无自选基金，请先添加基金代码。">
        <el-button type="primary" :icon="Plus" @click="goToFunds">添加基金</el-button>
      </el-empty>

      <el-empty v-else-if="!hasEnabledFunds" description="当前没有启用监控的基金。">
        <el-button type="primary" :icon="Plus" @click="goToFunds">管理基金</el-button>
      </el-empty>

      <div v-else class="estimate-list">
        <article v-for="row in estimateRows" :key="row.fund.code" class="estimate-card">
          <header class="estimate-card-header">
            <div class="fund-identity">
              <strong>{{ getDisplayName(row) }}</strong>
              <span>{{ row.fund.code }}</span>
            </div>

            <el-tag :type="getStatusType(row.status)" effect="light">
              {{ getStatusText(row.status) }}
            </el-tag>
          </header>

          <div class="field-grid" :class="{ loading: row.status === 'loading' }">
            <div class="field">
              <span>别名</span>
              <strong>{{ getAlias(row.fund) }}</strong>
            </div>

            <div class="field">
              <span>估算净值</span>
              <strong>{{ formatNumber(row.estimate?.estimatedNav) }}</strong>
            </div>

            <div class="field">
              <span>估算涨跌幅</span>
              <strong :class="getGrowthClass(row.estimate?.estimatedGrowth)">
                {{ formatGrowth(row.estimate?.estimatedGrowth) }}
              </strong>
            </div>

            <div class="field">
              <span>上一正式净值</span>
              <strong>{{ formatNumber(row.estimate?.nav) }}</strong>
            </div>

            <div class="field">
              <span>净值日期</span>
              <strong>{{ row.estimate?.navDate || "--" }}</strong>
            </div>

            <div class="field">
              <span>估值更新时间</span>
              <strong>{{ row.estimate?.estimateTime || "--" }}</strong>
            </div>

            <div class="field">
              <span>数据源</span>
              <strong>{{ row.estimate?.source || "--" }}</strong>
            </div>
          </div>

          <footer v-if="row.estimate?.error || row.status === 'stale'" class="estimate-message">
            <el-icon><Warning /></el-icon>
            <span>
              {{
                row.status === "stale"
                  ? `正在展示上次成功缓存。${row.estimate?.error || ""}`
                  : row.estimate?.error
              }}
            </span>
          </footer>
        </article>
      </div>
    </el-card>
  </section>
</template>

<style scoped>
.dashboard-view {
  display: grid;
  gap: 16px;
  margin: 0 auto;
  max-width: 1120px;
}

.summary-card,
.index-card,
.estimate-card,
.quote-card {
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
}

.dashboard-header {
  align-items: center;
  display: flex;
  gap: 16px;
  justify-content: space-between;
}

.title-block {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.title-block h1 {
  color: var(--el-text-color-primary);
  font-size: 20px;
  line-height: 1.2;
  margin: 0;
}

.title-block span {
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.market-alert {
  margin: 0;
}

.section-header {
  align-items: center;
  display: flex;
  gap: 12px;
  justify-content: space-between;
}

.collapse-title {
  align-items: center;
  appearance: none;
  background: transparent;
  border: 0;
  color: inherit;
  cursor: pointer;
  display: inline-flex;
  gap: 8px;
  min-width: 0;
  padding: 0;
  text-align: left;
}

.collapse-title > span {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.collapse-title strong {
  color: var(--el-text-color-primary);
  font-size: 18px;
  line-height: 1.2;
}

.collapse-title small {
  color: var(--el-text-color-secondary);
  font-size: 13px;
  font-weight: 400;
  overflow-wrap: anywhere;
}

.index-list {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
}

.index-groups {
  display: grid;
  gap: 18px;
}

.index-group {
  display: grid;
  gap: 10px;
}

.index-group + .index-group {
  border-top: 1px solid var(--el-border-color-lighter);
  padding-top: 18px;
}

.group-header {
  align-items: center;
  appearance: none;
  background: var(--el-fill-color-lighter);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  color: inherit;
  cursor: pointer;
  display: grid;
  gap: 8px;
  grid-template-columns: auto minmax(0, 1fr);
  justify-content: space-between;
  min-width: 0;
  padding: 8px 10px;
  text-align: left;
}

.group-title {
  align-items: center;
  color: var(--el-text-color-primary);
  display: inline-flex;
  font-size: 15px;
  gap: 6px;
  min-width: 0;
}

.group-summary {
  color: var(--el-text-color-secondary);
  font-size: 12px;
  min-width: 0;
  overflow: hidden;
  text-align: right;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.estimate-list {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
}

.estimate-card,
.quote-card {
  background: var(--el-bg-color);
  display: grid;
  gap: 14px;
  padding: 16px;
}

.quote-card.loading {
  opacity: 0.72;
}

.estimate-card-header,
.quote-card-header {
  align-items: flex-start;
  display: flex;
  gap: 12px;
  justify-content: space-between;
}

.fund-identity,
.quote-identity {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.fund-identity strong,
.quote-identity strong {
  color: var(--el-text-color-primary);
  font-size: 18px;
  line-height: 1.25;
  overflow-wrap: anywhere;
}

.fund-identity span,
.quote-identity span {
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.quote-price {
  display: grid;
  gap: 4px;
}

.quote-price strong {
  color: var(--el-text-color-primary);
  font-size: 24px;
  line-height: 1.15;
}

.quote-price span {
  font-size: 14px;
  font-weight: 600;
}

.field-grid {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.quote-field-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.field-grid.loading {
  opacity: 0.72;
}

.field {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.field span {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.field strong {
  color: var(--el-text-color-primary);
  font-size: 15px;
  font-weight: 600;
  min-width: 0;
  overflow-wrap: anywhere;
}

.growth-up {
  color: #d93026 !important;
}

.growth-down {
  color: #188038 !important;
}

.growth-flat {
  color: var(--el-text-color-secondary) !important;
}

.estimate-message {
  align-items: flex-start;
  border-top: 1px solid var(--el-border-color-lighter);
  color: var(--el-color-warning);
  display: flex;
  font-size: 13px;
  gap: 6px;
  line-height: 1.5;
  padding-top: 12px;
}

.estimate-message span {
  min-width: 0;
  overflow-wrap: anywhere;
}

@media (max-width: 768px) {
  .dashboard-header {
    align-items: stretch;
    flex-direction: column;
  }

  .section-header {
    align-items: flex-start;
    flex-direction: column;
  }

  .dashboard-header .el-button {
    width: 100%;
  }

  .index-list,
  .estimate-list,
  .field-grid {
    grid-template-columns: 1fr;
  }

  .group-header {
    grid-template-columns: 1fr;
  }

  .group-summary {
    text-align: left;
  }
}
</style>
