<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import {
  ArrowDown,
  ArrowRight,
  Plus,
  Refresh,
  Warning,
} from "@element-plus/icons-vue";
import { checkFundAlerts } from "../services/alertService";
import { getFundNavDisplay } from "../services/fundValueService";
import { useAlertStore } from "../stores/alertStore";
import { useFundStore } from "../stores/fundStore";
import { useHoldingStore } from "../stores/holdingStore";
import { useSettingsStore } from "../stores/settingsStore";
import {
  DEFAULT_INDEX_CODES,
  DEFAULT_INDEXES,
  indexDataSource,
} from "../services/indexDataSource";
import { formatDateTime, isAStockTradingTime } from "../services/timeService";
import type { IndexDefinition } from "../services/indexDataSource";
import type { FundEstimate, FundItem, DataStatus } from "../types/fund";
import type { HoldingComputed } from "../types/holding";
import type { IndexQuote } from "../types/indexQuote";

interface FundEstimateRow {
  fund: FundItem;
  estimate: FundEstimate | undefined;
  status: DataStatus;
}

interface DashboardFundRow {
  code: string;
  displayName: string;
  changeAmount: number | null;
  changePercent: number | null;
  todayProfit: number | null;
  todayProfitPercent: number | null;
  holdingProfit: number | null;
  holdingProfitPercent: number | null;
  detail: FundEstimateRow;
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

type SortOrder = "asc" | "desc";
type DashboardSortField =
  | "changeAmount"
  | "changePercent"
  | "todayProfit"
  | "todayProfitPercent"
  | "holdingProfit"
  | "holdingProfitPercent";

const DEFAULT_REFRESH_INTERVAL_MINUTES = 30;

const router = useRouter();
const fundStore = useFundStore();
const holdingStore = useHoldingStore();
const alertStore = useAlertStore();
const settingsStore = useSettingsStore();

const indexQuotes = ref<IndexQuote[]>([]);
const isRefreshingIndexes = ref(false);
const indexLastRefreshAt = ref<number | null>(null);
const isIndexSectionExpanded = ref(true);
const selectedFundCode = ref<string | null>(null);
const fundSortBy = ref<DashboardSortField>("changePercent");
const fundSortOrder = ref<SortOrder>("desc");
const expandedIndexGroups = ref<Record<IndexDefinition["market"], boolean>>({
  "a-share": true,
  hk: true,
  us: true,
  commodity: true,
});

const fundSortOptions: Array<{ label: string; value: DashboardSortField }> = [
  { label: "涨跌额", value: "changeAmount" },
  { label: "涨跌幅", value: "changePercent" },
  { label: "当日收益额", value: "todayProfit" },
  { label: "当日收益率", value: "todayProfitPercent" },
  { label: "持有收益额", value: "holdingProfit" },
  { label: "持有收益率", value: "holdingProfitPercent" },
];

let refreshTimer: number | undefined;

const enabledFunds = computed(() =>
  [...fundStore.enabledFunds].sort(
    (left, right) => right.createdAt - left.createdAt,
  ),
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
    const quote = indexQuotes.value.find(
      (item) => item.code === definition.code,
    );

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
    commodity: "贵金属",
  };

  return (["a-share", "hk", "us", "commodity"] as IndexDefinition["market"][])
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
const holdingSummary = computed(() => holdingStore.summary);
const holdingRowMap = computed<Record<string, HoldingComputed>>(() =>
  holdingStore.computedHoldings.reduce<Record<string, HoldingComputed>>(
    (result, row) => {
      result[row.fundCode] = row;
      return result;
    },
    {},
  ),
);

const fundListRows = computed<DashboardFundRow[]>(() =>
  estimateRows.value.map((row) => {
    const holding = holdingRowMap.value[row.fund.code];
    const changeAmount = getFundChangeAmount(row.estimate);
    const changePercent = getFundChangePercent(row.estimate);
    const todayProfit = holding?.todayProfit ?? null;
    const todayProfitPercent = getTodayProfitPercent(holding);
    const holdingProfit = holding?.estimatedProfit ?? null;
    const holdingProfitPercent = holding?.estimatedProfitPercent ?? null;

    return {
      code: row.fund.code,
      displayName: getDisplayName(row),
      changeAmount,
      changePercent,
      todayProfit,
      todayProfitPercent,
      holdingProfit,
      holdingProfitPercent,
      detail: row,
    };
  }),
);

const sortedFundListRows = computed<DashboardFundRow[]>(() => {
  const rows = [...fundListRows.value];
  const factor = fundSortOrder.value === "asc" ? 1 : -1;

  rows.sort((left, right) => {
    const result = compareNullableNumber(
      left[fundSortBy.value],
      right[fundSortBy.value],
    );
    if (result !== 0) {
      return result * factor;
    }

    return left.displayName.localeCompare(right.displayName, "zh-CN");
  });

  return rows;
});

const selectedFundRow = computed<DashboardFundRow | null>(
  () =>
    sortedFundListRows.value.find(
      (row) => row.code === selectedFundCode.value,
    ) ?? null,
);

const refreshIntervalMinutes = computed(() => {
  const value = Number(settingsStore.refreshIntervalMinutes);
  return Number.isFinite(value) && value > 0
    ? value
    : DEFAULT_REFRESH_INTERVAL_MINUTES;
});

const refreshIntervalText = computed(
  () => `${refreshIntervalMinutes.value} 分钟`,
);
const lastRefreshText = computed(() => formatDateTime(fundStore.lastRefreshAt));
const indexLastRefreshText = computed(() =>
  formatDateTime(indexLastRefreshAt.value),
);
const isRefreshingDashboard = computed(
  () => fundStore.isRefreshingEstimates || isRefreshingIndexes.value,
);

watch(
  sortedFundListRows,
  (rows) => {
    if (rows.length === 0) {
      selectedFundCode.value = null;
      return;
    }

    if (
      !selectedFundCode.value ||
      !rows.some((row) => row.code === selectedFundCode.value)
    ) {
      selectedFundCode.value = rows[0].code;
    }
  },
  { immediate: true },
);

function compareNullableNumber(
  left: number | null,
  right: number | null,
): number {
  if (left === null && right === null) {
    return 0;
  }

  if (left === null) {
    return 1;
  }

  if (right === null) {
    return -1;
  }

  return left - right;
}

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

function formatSignedPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "--";
  }

  return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function formatSignedNumber(
  value: number | null | undefined,
  digits = 2,
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "--";
  }

  return `${value > 0 ? "+" : ""}${value.toFixed(digits)}`;
}

function formatMoney(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "--";
  }

  return value.toFixed(2);
}

function formatSignedMoney(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "--";
  }

  return `${value > 0 ? "+" : ""}${value.toFixed(2)}`;
}

function formatMarketStatus(
  status: IndexQuote["marketStatus"] | undefined,
): string {
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

function getStatusType(
  status: DataStatus,
): "info" | "primary" | "success" | "warning" | "danger" {
  const statusTypes: Record<
    DataStatus,
    "info" | "primary" | "success" | "warning" | "danger"
  > = {
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
    stale: "缓存过期",
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

function getHoldingProfit(code: string): number | null | undefined {
  return holdingRowMap.value[code]?.estimatedProfit;
}

function getHoldingProfitPercent(code: string): number | null | undefined {
  return holdingRowMap.value[code]?.estimatedProfitPercent;
}

function getTodayProfit(code: string): number | null | undefined {
  return holdingRowMap.value[code]?.todayProfit;
}

function getTodayProfitPercent(
  holding: HoldingComputed | undefined,
): number | null {
  if (
    !holding ||
    !Number.isFinite(holding.amount) ||
    holding.amount <= 0 ||
    holding.todayProfit === null
  ) {
    return null;
  }

  return (holding.todayProfit / holding.amount) * 100;
}

function getFundChangeAmount(
  estimate: FundEstimate | undefined,
): number | null {
  if (!estimate || estimate.nav === null) {
    return null;
  }

  if (estimate.estimatedNav !== null) {
    return estimate.estimatedNav - estimate.nav;
  }

  return 0;
}

function getFundChangePercent(
  estimate: FundEstimate | undefined,
): number | null {
  if (!estimate || estimate.nav === null || estimate.nav <= 0) {
    return null;
  }

  if (estimate.estimatedGrowth !== null) {
    return estimate.estimatedGrowth;
  }

  if (estimate.estimatedNav !== null) {
    return ((estimate.estimatedNav - estimate.nav) / estimate.nav) * 100;
  }

  return 0;
}

function getNavLabel(estimate: FundEstimate | undefined): string {
  return getFundNavDisplay(estimate).label;
}

function getNavValue(estimate: FundEstimate | undefined): number | null {
  return getFundNavDisplay(estimate).value;
}

function getSecondaryNavLabel(estimate: FundEstimate | undefined): string {
  return getFundNavDisplay(estimate).usingOfficialNav ? "盘中估值" : "最新净值";
}

function getSecondaryNavValue(
  estimate: FundEstimate | undefined,
): number | null {
  if (getFundNavDisplay(estimate).usingOfficialNav) {
    return estimate?.estimatedNav ?? null;
  }

  return estimate?.nav ?? null;
}

function getFundRowClass({ row }: { row: DashboardFundRow }): string {
  return row.code === selectedFundCode.value ? "is-selected-row" : "";
}

function toggleIndexSection(): void {
  isIndexSectionExpanded.value = !isIndexSectionExpanded.value;
}

function toggleIndexGroup(key: IndexDefinition["market"]): void {
  expandedIndexGroups.value[key] = !expandedIndexGroups.value[key];
}

function handleFundRowClick(row: DashboardFundRow): void {
  selectedFundCode.value = row.code;
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
    indexQuotes.value =
      await indexDataSource.getIndexQuotes(DEFAULT_INDEX_CODES);
  } catch (error) {
    console.error("[DashboardView] Failed to refresh index quotes.", error);
  } finally {
    indexLastRefreshAt.value = Date.now();
    isRefreshingIndexes.value = false;
  }
}

async function refreshDashboard(): Promise<void> {
  await Promise.allSettled([refreshIndexes(), refreshEstimates()]);

  checkFundAlerts({
    funds: fundStore.enabledFunds,
    estimates: fundStore.estimates,
    alertStore,
    settingsStore,
  });
}

function clearRefreshTimer(): void {
  if (refreshTimer !== undefined) {
    window.clearInterval(refreshTimer);
    refreshTimer = undefined;
  }
}

function startRefreshTimer(): void {
  clearRefreshTimer();

  refreshTimer = window.setInterval(
    () => {
      void refreshDashboard();
    },
    refreshIntervalMinutes.value * 60 * 1000,
  );
}

function goToFunds(): void {
  void router.push("/funds");
}

onMounted(() => {
  fundStore.loadFromStorage();
  holdingStore.loadFromStorage();
  alertStore.loadFromStorage();
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
            <span
              >最近刷新：{{ lastRefreshText }} · 自动刷新：{{
                refreshIntervalText
              }}</span
            >
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
        title="当前为非交易时段，估值数据可能显示为最近一次成功获取的数据或上次收盘数据。"
      />

      <div class="portfolio-summary">
        <div class="summary-item">
          <span>总估算市值</span>
          <strong>{{
            formatMoney(holdingSummary.totalEstimatedMarketValue)
          }}</strong>
        </div>

        <div class="summary-item">
          <span>总持有金额</span>
          <strong>{{ formatMoney(holdingSummary.totalAmount) }}</strong>
        </div>

        <div class="summary-item">
          <span>总估算收益</span>
          <strong :class="getGrowthClass(holdingSummary.totalEstimatedProfit)">
            {{ formatMoney(holdingSummary.totalEstimatedProfit) }}
          </strong>
        </div>

        <div class="summary-item">
          <span>总估算收益率</span>
          <strong
            :class="getGrowthClass(holdingSummary.totalEstimatedProfitPercent)"
          >
            {{ formatGrowth(holdingSummary.totalEstimatedProfitPercent) }}
          </strong>
        </div>

        <div class="summary-item">
          <span>今日估算盈亏</span>
          <strong :class="getGrowthClass(holdingSummary.totalTodayProfit)">
            {{ formatMoney(holdingSummary.totalTodayProfit) }}
          </strong>
        </div>
      </div>
    </el-card>

    <el-card
      shadow="never"
      class="index-card"
      :body-style="
        isIndexSectionExpanded ? undefined : { padding: 0, display: 'none' }
      "
    >
      <template #header>
        <div class="section-header">
          <button
            class="collapse-title"
            type="button"
            @click="toggleIndexSection"
          >
            <el-icon>
              <ArrowDown v-if="isIndexSectionExpanded" />
              <ArrowRight v-else />
            </el-icon>
            <span>
              <strong>指数行情</strong>
              <small>最近刷新：{{ indexLastRefreshText }}</small>
              <span
                v-if="!isIndexSectionExpanded"
                class="index-collapse-summary"
              >
                <template
                  v-for="(row, idx) in indexRows"
                  :key="row.definition.code"
                >
                  <template v-if="idx > 0"> · </template>
                  {{ row.quote?.name || row.definition.name }}
                  <span :class="getGrowthClass(row.quote?.changePercent)">
                    {{ formatSignedPercent(row.quote?.changePercent) }}
                  </span>
                </template>
              </span>
            </span>
          </button>

          <el-tag
            :type="isRefreshingIndexes ? 'primary' : 'info'"
            effect="light"
          >
            {{ isRefreshingIndexes ? "刷新中" : "默认指数" }}
          </el-tag>
        </div>
      </template>

      <div v-if="isIndexSectionExpanded" class="index-groups">
        <section
          v-for="group in indexGroups"
          :key="group.key"
          class="index-group"
        >
          <button
            class="group-header"
            type="button"
            @click="toggleIndexGroup(group.key)"
          >
            <span class="group-title">
              <el-icon>
                <ArrowDown v-if="expandedIndexGroups[group.key]" />
                <ArrowRight v-else />
              </el-icon>
              <strong>{{ group.title }}</strong>
            </span>

            <span
              v-if="!expandedIndexGroups[group.key]"
              class="group-collapse-summary"
            >
              <template
                v-for="(row, idx) in group.rows"
                :key="row.definition.code"
              >
                <template v-if="idx > 0"> · </template>
                {{ row.quote?.name || row.definition.name }}
                <span :class="getGrowthClass(row.quote?.changePercent)">
                  {{ formatSignedPercent(row.quote?.changePercent) }}
                </span>
              </template>
            </span>
          </button>

          <div v-if="expandedIndexGroups[group.key]" class="index-compact-bar">
            <article
              v-for="row in group.rows"
              :key="row.definition.code"
              class="index-compact-item"
              :class="{ loading: row.status === 'loading' }"
            >
              <div class="compact-identity">
                <strong>{{ row.quote?.name || row.definition.name }}</strong>
                <span>{{ row.definition.code }}</span>
              </div>

              <div class="compact-price">
                <strong>{{ formatNumber(row.quote?.price, 2) }}</strong>
                <span :class="getGrowthClass(row.quote?.changePercent)">
                  {{ formatSignedNumber(row.quote?.change, 2) }}
                  / {{ formatSignedPercent(row.quote?.changePercent) }}
                </span>
              </div>

              <el-tag
                class="market-status-tag"
                :type="row.quote?.marketStatus === 'open' ? 'success' : 'info'"
                size="small"
                effect="plain"
              >
                {{ formatMarketStatus(row.quote?.marketStatus) }}
              </el-tag>
            </article>
          </div>
        </section>
      </div>
    </el-card>

    <el-card shadow="never" class="summary-card">
      <template #header>
        <div class="section-header">
          <div class="title-block">
            <h2>自选基金</h2>
            <span>点击列表中的基金后，在下方查看详细卡片。</span>
          </div>

          <div v-if="hasEnabledFunds" class="table-toolbar">
            <el-select v-model="fundSortBy" size="small" class="sort-select">
              <el-option
                v-for="option in fundSortOptions"
                :key="option.value"
                :label="`按${option.label}排序`"
                :value="option.value"
              />
            </el-select>

            <el-segmented
              v-model="fundSortOrder"
              size="small"
              :options="[
                { label: '降序', value: 'desc' },
                { label: '升序', value: 'asc' },
              ]"
            />
          </div>
        </div>
      </template>

      <el-empty v-if="!hasFunds" description="暂无自选基金，请先添加基金代码。">
        <el-button type="primary" :icon="Plus" @click="goToFunds"
          >添加基金</el-button
        >
      </el-empty>

      <el-empty
        v-else-if="!hasEnabledFunds"
        description="当前没有启用监控的基金。"
      >
        <el-button type="primary" :icon="Plus" @click="goToFunds"
          >管理基金</el-button
        >
      </el-empty>

      <div v-else class="fund-section">
        <div class="table-wrap">
          <el-table
            :data="sortedFundListRows"
            stripe
            class="fund-table"
            :row-class-name="getFundRowClass"
            @row-click="handleFundRowClick"
          >
            <el-table-column label="基金" min-width="220">
              <template #default="{ row }">
                <div class="name-cell">
                  <strong>{{ row.displayName }}</strong>
                  <span>{{ row.code }}</span>
                </div>
              </template>
            </el-table-column>

            <el-table-column label="涨跌" min-width="180" align="right">
              <template #default="{ row }">
                <div class="metric-cell">
                  <strong :class="getGrowthClass(row.changePercent)">
                    {{ formatSignedPercent(row.changePercent) }}
                  </strong>
                  <span :class="getGrowthClass(row.changeAmount)">
                    {{ formatSignedNumber(row.changeAmount, 4) }}
                  </span>
                </div>
              </template>
            </el-table-column>

            <el-table-column label="当日收益" min-width="180" align="right">
              <template #default="{ row }">
                <div class="metric-cell">
                  <strong :class="getGrowthClass(row.todayProfit)">
                    {{ formatSignedMoney(row.todayProfit) }}
                  </strong>
                  <span :class="getGrowthClass(row.todayProfitPercent)">
                    {{ formatSignedPercent(row.todayProfitPercent) }}
                  </span>
                </div>
              </template>
            </el-table-column>

            <el-table-column label="持有收益" min-width="180" align="right">
              <template #default="{ row }">
                <div class="metric-cell">
                  <strong :class="getGrowthClass(row.holdingProfit)">
                    {{ formatSignedMoney(row.holdingProfit) }}
                  </strong>
                  <span :class="getGrowthClass(row.holdingProfitPercent)">
                    {{ formatSignedPercent(row.holdingProfitPercent) }}
                  </span>
                </div>
              </template>
            </el-table-column>
          </el-table>
        </div>

        <article
          v-if="selectedFundRow"
          class="estimate-detail-card"
          :class="{ loading: selectedFundRow.detail.status === 'loading' }"
        >
          <header class="estimate-card-header">
            <div class="fund-identity">
              <strong>{{ selectedFundRow.displayName }}</strong>
              <span>{{ selectedFundRow.code }}</span>
            </div>

            <el-tag
              :type="getStatusType(selectedFundRow.detail.status)"
              effect="light"
            >
              {{ getStatusText(selectedFundRow.detail.status) }}
            </el-tag>
          </header>

          <div class="field-grid">
            <div class="field">
              <span>{{ getNavLabel(selectedFundRow.detail.estimate) }}</span>
              <strong>{{
                formatNumber(getNavValue(selectedFundRow.detail.estimate))
              }}</strong>
            </div>

            <div class="field">
              <span>涨跌幅 / 涨跌额</span>
              <strong :class="getGrowthClass(selectedFundRow.changePercent)">
                {{ formatSignedPercent(selectedFundRow.changePercent) }}
                / {{ formatSignedNumber(selectedFundRow.changeAmount, 4) }}
              </strong>
            </div>

            <div class="field">
              <span>{{
                getSecondaryNavLabel(selectedFundRow.detail.estimate)
              }}</span>
              <strong>{{
                formatNumber(
                  getSecondaryNavValue(selectedFundRow.detail.estimate),
                )
              }}</strong>
            </div>

            <div class="field">
              <span>净值日期</span>
              <strong>{{
                selectedFundRow.detail.estimate?.navDate || "--"
              }}</strong>
            </div>

            <div class="field">
              <span>估值更新时间</span>
              <strong>{{
                selectedFundRow.detail.estimate?.estimateTime || "--"
              }}</strong>
            </div>

            <div class="field">
              <span>当日收益 / 收益率</span>
              <strong
                :class="getGrowthClass(getTodayProfit(selectedFundRow.code))"
              >
                {{ formatSignedMoney(getTodayProfit(selectedFundRow.code)) }}
                /
                {{
                  formatSignedPercent(
                    getTodayProfitPercent(holdingRowMap[selectedFundRow.code]),
                  )
                }}
              </strong>
            </div>

            <div class="field">
              <span>持有收益 / 收益率</span>
              <strong
                :class="getGrowthClass(getHoldingProfit(selectedFundRow.code))"
              >
                {{ formatSignedMoney(getHoldingProfit(selectedFundRow.code)) }}
                /
                {{
                  formatSignedPercent(
                    getHoldingProfitPercent(selectedFundRow.code),
                  )
                }}
              </strong>
            </div>

            <div class="field">
              <span>数据源</span>
              <strong>{{
                selectedFundRow.detail.estimate?.source || "--"
              }}</strong>
            </div>
          </div>

          <footer
            v-if="
              selectedFundRow.detail.estimate?.error ||
              selectedFundRow.detail.status === 'stale'
            "
            class="estimate-message"
          >
            <el-icon><Warning /></el-icon>
            <span>
              {{
                selectedFundRow.detail.status === "stale"
                  ? `当前展示的是上次成功获取的缓存数据。${selectedFundRow.detail.estimate?.error || ""}`
                  : selectedFundRow.detail.estimate?.error
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
.estimate-detail-card {
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

.title-block h1,
.title-block h2 {
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

.portfolio-summary {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  margin-top: 16px;
}

.summary-item {
  background: var(--el-fill-color-lighter);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  display: grid;
  gap: 6px;
  min-width: 0;
  padding: 12px;
}

.summary-item span {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.summary-item strong {
  color: var(--el-text-color-primary);
  font-size: 18px;
  line-height: 1.2;
  min-width: 0;
  overflow-wrap: anywhere;
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
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0 8px;
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
}

.index-collapse-summary {
  flex-basis: 100%;
  line-height: 1.6;
  margin-top: 2px;
  min-width: 0;
}

.table-toolbar {
  align-items: center;
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.sort-select {
  width: 140px;
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

.group-collapse-summary {
  color: var(--el-text-color-secondary);
  font-size: 12px;
  min-width: 0;
  overflow: hidden;
  text-align: right;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.index-compact-bar {
  display: grid;
  gap: 10px;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
}

.index-compact-item {
  align-items: flex-start;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  display: grid;
  gap: 8px;
  padding: 12px;
  position: relative;
}

.index-compact-item.loading {
  opacity: 0.72;
}

.market-status-tag {
  position: absolute;
  right: 12px;
  top: 12px;
}

.compact-identity {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.compact-identity strong {
  color: var(--el-text-color-primary);
  font-size: 14px;
  line-height: 1.25;
  overflow-wrap: anywhere;
}

.compact-identity span {
  color: var(--el-text-color-secondary);
  font-size: 11px;
}

.compact-price {
  display: grid;
  gap: 2px;
}

.compact-price strong {
  color: var(--el-text-color-primary);
  font-size: 18px;
  line-height: 1.15;
}

.compact-price span {
  font-size: 12px;
  font-weight: 600;
}

.fund-section {
  display: grid;
  gap: 16px;
}

.table-wrap {
  overflow-x: auto;
}

.fund-table {
  min-width: 760px;
}

.name-cell,
.fund-identity {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.name-cell strong,
.fund-identity strong {
  color: var(--el-text-color-primary);
  font-size: 16px;
  line-height: 1.25;
  overflow-wrap: anywhere;
}

.name-cell span,
.fund-identity span {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.metric-cell {
  display: grid;
  gap: 4px;
  justify-items: end;
}

.metric-cell strong {
  font-size: 15px;
  line-height: 1.2;
}

.metric-cell span {
  font-size: 12px;
}

.estimate-detail-card {
  background: var(--el-bg-color);
  display: grid;
  gap: 14px;
  padding: 16px;
}

.estimate-detail-card.loading {
  opacity: 0.72;
}

.estimate-card-header {
  align-items: flex-start;
  display: flex;
  gap: 12px;
  justify-content: space-between;
}

.field-grid {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
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

:deep(.fund-table .is-selected-row td) {
  background: var(--el-color-primary-light-9) !important;
}

@media (max-width: 768px) {
  .dashboard-view {
    gap: 12px;
  }

  .dashboard-header,
  .section-header {
    align-items: stretch;
    flex-direction: column;
  }

  .dashboard-header .el-button,
  .table-toolbar,
  .sort-select {
    width: 100%;
  }

  .table-toolbar {
    flex-direction: column;
  }

  .portfolio-summary {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .field-grid {
    grid-template-columns: 1fr;
  }

  .group-header {
    grid-template-columns: 1fr;
    gap: 6px;
  }

  .group-collapse-summary {
    text-align: left;
    white-space: normal;
  }

  .summary-item strong {
    font-size: 14px;
  }

  .collapse-title strong {
    font-size: 15px;
  }

  .collapse-title small {
    font-size: 11px;
  }

  .index-collapse-summary {
    font-size: 11px;
  }

  .group-title {
    font-size: 13px;
  }

  .group-collapse-summary {
    font-size: 11px;
  }

  .compact-identity strong {
    font-size: 13px;
  }

  .compact-identity span {
    font-size: 10px;
  }

  .compact-price strong {
    font-size: 16px;
  }

  .compact-price span {
    font-size: 11px;
  }

  .index-compact-item {
    padding: 10px;
  }

  .name-cell strong,
  .fund-identity strong {
    font-size: 14px;
  }

  .metric-cell strong {
    font-size: 13px;
  }

  .field strong {
    font-size: 13px;
  }

  .estimate-message {
    font-size: 11px;
  }
}

/* ── Small phones: ≤480px ── */
@media (max-width: 480px) {
  .portfolio-summary {
    grid-template-columns: 1fr;
  }

  .summary-item {
    padding: 8px;
  }

  .summary-item strong {
    font-size: 14px;
  }

  .estimate-detail-card {
    padding: 10px;
    gap: 8px;
  }

  .title-block h1,
  .title-block h2 {
    font-size: 16px;
  }

  .collapse-title strong {
    font-size: 14px;
  }

  .compact-price strong {
    font-size: 15px;
  }

  .index-compact-item {
    padding: 8px;
    gap: 6px;
  }

  .name-cell strong,
  .fund-identity strong {
    font-size: 13px;
  }
}
</style>
