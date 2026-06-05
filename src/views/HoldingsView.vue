<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from "vue";
import { Delete, Edit, Plus, RefreshLeft } from "@element-plus/icons-vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { useFundStore } from "../stores/fundStore";
import { useHoldingStore } from "../stores/holdingStore";
import type { FundItem } from "../types/fund";
import type { HoldingComputed } from "../types/holding";

interface HoldingForm {
  fundCode: string;
  amount: number | undefined;
  currentProfit: number | undefined;
  note: string;
}

interface HoldingListRow {
  fundCode: string;
  fundName: string;
  changeAmount: number | null;
  changePercent: number | null;
  todayProfit: number | null;
  todayProfitPercent: number | null;
  holdingProfit: number | null;
  holdingProfitPercent: number | null;
  detail: HoldingComputed;
}

type SortOrder = "asc" | "desc";
type HoldingSortField =
  | "changeAmount"
  | "changePercent"
  | "todayProfit"
  | "todayProfitPercent"
  | "holdingProfit"
  | "holdingProfitPercent";

const fundStore = useFundStore();
const holdingStore = useHoldingStore();

const editingFundCode = ref<string | null>(null);
const selectedHoldingCode = ref<string | null>(null);
const holdingSortBy = ref<HoldingSortField>("holdingProfit");
const holdingSortOrder = ref<SortOrder>("desc");
const form = reactive<HoldingForm>({
  fundCode: "",
  amount: undefined,
  currentProfit: undefined,
  note: "",
});

const sortOptions: Array<{ label: string; value: HoldingSortField }> = [
  { label: "涨跌额", value: "changeAmount" },
  { label: "涨跌幅", value: "changePercent" },
  { label: "当日收益额", value: "todayProfit" },
  { label: "当日收益率", value: "todayProfitPercent" },
  { label: "持有收益额", value: "holdingProfit" },
  { label: "持有收益率", value: "holdingProfitPercent" },
];

const sortedFunds = computed(() =>
  [...fundStore.funds].sort((left, right) => right.createdAt - left.createdAt),
);

const holdingRows = computed<HoldingComputed[]>(() => [...holdingStore.computedHoldings]);

const holdingListRows = computed<HoldingListRow[]>(() =>
  holdingRows.value.map((row) => ({
    fundCode: row.fundCode,
    fundName: row.fundName,
    changeAmount: getChangeAmount(row),
    changePercent: getChangePercent(row),
    todayProfit: row.todayProfit,
    todayProfitPercent: getTodayProfitPercent(row),
    holdingProfit: row.estimatedProfit,
    holdingProfitPercent: row.estimatedProfitPercent,
    detail: row,
  })),
);

const sortedHoldingRows = computed<HoldingListRow[]>(() => {
  const rows = [...holdingListRows.value];
  const factor = holdingSortOrder.value === "asc" ? 1 : -1;

  rows.sort((left, right) => {
    const result = compareNullableNumber(left[holdingSortBy.value], right[holdingSortBy.value]);
    if (result !== 0) {
      return result * factor;
    }

    return left.fundName.localeCompare(right.fundName, "zh-CN");
  });

  return rows;
});

const selectedHoldingRow = computed<HoldingListRow | null>(
  () => sortedHoldingRows.value.find((row) => row.fundCode === selectedHoldingCode.value) ?? null,
);

const holdingNoteMap = computed<Record<string, string>>(() =>
  holdingStore.holdings.reduce<Record<string, string>>((result, holding) => {
    result[holding.fundCode] = holding.note ?? "";
    return result;
  }, {}),
);

const heldFundCodes = computed(() => new Set(holdingStore.holdings.map((holding) => holding.fundCode)));
const canCreateHolding = computed(() =>
  sortedFunds.value.some((fund) => !heldFundCodes.value.has(fund.code)),
);
const formTitle = computed(() => (editingFundCode.value ? "编辑持仓" : "添加持仓"));

watch(
  sortedHoldingRows,
  (rows) => {
    if (rows.length === 0) {
      selectedHoldingCode.value = null;
      return;
    }

    if (!selectedHoldingCode.value || !rows.some((row) => row.fundCode === selectedHoldingCode.value)) {
      selectedHoldingCode.value = rows[0].fundCode;
    }
  },
  { immediate: true },
);

function compareNullableNumber(left: number | null, right: number | null): number {
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

function isFiniteNumber(value: number | undefined): value is number {
  return value !== undefined && Number.isFinite(value);
}

function isPositiveFiniteNumber(value: number | undefined): value is number {
  return isFiniteNumber(value) && value > 0;
}

function getFundLabel(fund: FundItem): string {
  return `${fund.alias || fund.name || fund.code} (${fund.code})`;
}

function isFundOptionDisabled(code: string): boolean {
  return editingFundCode.value !== code && heldFundCodes.value.has(code);
}

function formatNumber(value: number | null | undefined, digits = 4): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "--";
  }

  return value.toFixed(digits);
}

function formatSignedNumber(value: number | null | undefined, digits = 4): string {
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

function formatSignedPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "--";
  }

  return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function getProfitClass(value: number | null | undefined): string {
  if (value === null || value === undefined || value === 0) {
    return "profit-flat";
  }

  return value > 0 ? "profit-up" : "profit-down";
}

function getChangeAmount(row: HoldingComputed): number | null {
  if (row.currentEstimatedNav === null || row.latestNav === null) {
    return null;
  }

  return row.currentEstimatedNav - row.latestNav;
}

function getChangePercent(row: HoldingComputed): number | null {
  if (row.currentEstimatedNav === null || row.latestNav === null || row.latestNav <= 0) {
    return null;
  }

  return ((row.currentEstimatedNav - row.latestNav) / row.latestNav) * 100;
}

function getTodayProfitPercent(row: HoldingComputed): number | null {
  if (row.todayProfit === null || row.amount <= 0) {
    return null;
  }

  return (row.todayProfit / row.amount) * 100;
}

function resetForm(): void {
  editingFundCode.value = null;
  form.fundCode = "";
  form.amount = undefined;
  form.currentProfit = undefined;
  form.note = "";
}

function validateForm(): boolean {
  const validation = holdingStore.validateHoldingInput({
    fundCode: form.fundCode,
    amount: form.amount ?? 0,
    currentProfit: form.currentProfit ?? Number.NaN,
    note: form.note,
  });

  if (!validation.valid) {
    ElMessage.warning(validation.message);
    return false;
  }

  return true;
}

function handleSubmit(): void {
  if (!validateForm() || !isPositiveFiniteNumber(form.amount) || !isFiniteNumber(form.currentProfit)) {
    return;
  }

  const result = holdingStore.addOrUpdateHolding({
    fundCode: form.fundCode,
    amount: form.amount,
    currentProfit: form.currentProfit,
    note: form.note,
  });

  if (!result) {
    const validation = holdingStore.validateHoldingInput({
      fundCode: form.fundCode,
      amount: form.amount,
      currentProfit: form.currentProfit,
      note: form.note,
    });
    ElMessage.error(validation.valid ? "持仓保存失败，请刷新页面后重试" : validation.message);
    return;
  }

  selectedHoldingCode.value = result.fundCode;
  ElMessage.success(editingFundCode.value ? "持仓已更新" : "持仓已添加");
  resetForm();
}

function startEdit(row: HoldingComputed): void {
  const holding = holdingStore.holdings.find((item) => item.fundCode === row.fundCode);
  if (!holding) {
    return;
  }

  editingFundCode.value = holding.fundCode;
  selectedHoldingCode.value = holding.fundCode;
  form.fundCode = holding.fundCode;
  form.amount = holding.amount;
  form.currentProfit = holding.currentProfit;
  form.note = holding.note ?? "";
}

function handleRowClick(row: HoldingListRow): void {
  selectedHoldingCode.value = row.fundCode;
}

function getHoldingRowClass({ row }: { row: HoldingListRow }): string {
  return row.fundCode === selectedHoldingCode.value ? "is-selected-row" : "";
}

async function handleRemove(row: HoldingComputed): Promise<void> {
  try {
    await ElMessageBox.confirm(`确认删除 ${row.fundName} 的持仓吗？`, "删除持仓", {
      confirmButtonText: "删除",
      cancelButtonText: "取消",
      type: "warning",
    });

    holdingStore.removeHolding(row.fundCode);
    if (editingFundCode.value === row.fundCode) {
      resetForm();
    }
    ElMessage.success("持仓已删除");
  } catch {
    // User canceled.
  }
}

onMounted(() => {
  fundStore.loadFromStorage();
  holdingStore.loadFromStorage();
});
</script>

<template>
  <section class="holdings-view">
    <el-card shadow="never" class="panel-card">
      <template #header>
        <div class="card-header">
          <div>
            <h1>持仓管理</h1>
            <span>为已添加基金维护持有金额、当前已有收益和备注。</span>
          </div>

          <el-button v-if="editingFundCode" :icon="RefreshLeft" @click="resetForm">
            取消编辑
          </el-button>
        </div>
      </template>

      <el-empty v-if="sortedFunds.length === 0" description="暂无自选基金，请先添加基金代码。" />

      <el-form v-else class="holding-form" :model="form" label-position="top" @submit.prevent>
        <h2>{{ formTitle }}</h2>

        <p class="form-tip">持有金额填写当前持仓金额，已包含目前已有收益。</p>

        <el-form-item label="基金">
          <el-select
            v-model="form.fundCode"
            :disabled="Boolean(editingFundCode)"
            filterable
            placeholder="选择已添加的基金"
          >
            <el-option
              v-for="fund in sortedFunds"
              :key="fund.code"
              :disabled="isFundOptionDisabled(fund.code)"
              :label="getFundLabel(fund)"
              :value="fund.code"
            />
          </el-select>
        </el-form-item>

        <el-form-item label="持有金额">
          <el-input-number
            v-model="form.amount"
            :min="0.01"
            :precision="2"
            :step="1000"
            controls-position="right"
            placeholder="已包含已有收益"
          />
        </el-form-item>

        <el-form-item label="目前已有收益">
          <el-input-number
            v-model="form.currentProfit"
            :precision="2"
            :step="100"
            controls-position="right"
            placeholder="可为负数"
          />
        </el-form-item>

        <el-form-item label="备注">
          <el-input v-model="form.note" maxlength="80" placeholder="可选" show-word-limit />
        </el-form-item>

        <el-button
          class="submit-button"
          type="primary"
          :disabled="!editingFundCode && !canCreateHolding"
          :icon="editingFundCode ? Edit : Plus"
          @click="handleSubmit"
        >
          {{ editingFundCode ? "保存修改" : "添加持仓" }}
        </el-button>
      </el-form>
    </el-card>

    <el-empty
      v-if="sortedFunds.length > 0 && sortedHoldingRows.length === 0"
      description="暂无持仓，请先填写当前持仓金额和目前已有收益。"
    />

    <el-card v-else shadow="never" class="panel-card">
      <template #header>
        <div class="card-header">
          <div>
            <h2>持仓列表</h2>
            <span>点击列表中的基金后，在下方查看详细卡片。</span>
          </div>

          <div class="table-toolbar">
            <el-select v-model="holdingSortBy" size="small" class="sort-select">
              <el-option
                v-for="option in sortOptions"
                :key="option.value"
                :label="`按${option.label}排序`"
                :value="option.value"
              />
            </el-select>

            <el-segmented
              v-model="holdingSortOrder"
              size="small"
              :options="[
                { label: '降序', value: 'desc' },
                { label: '升序', value: 'asc' },
              ]"
            />
          </div>
        </div>
      </template>

      <div class="holding-section">
        <div class="table-wrap">
          <el-table
            :data="sortedHoldingRows"
            stripe
            class="holding-table"
            :row-class-name="getHoldingRowClass"
            @row-click="handleRowClick"
          >
            <el-table-column label="基金" min-width="220">
              <template #default="{ row }">
                <div class="name-cell">
                  <strong>{{ row.fundName }}</strong>
                  <span>{{ row.fundCode }}</span>
                </div>
              </template>
            </el-table-column>

            <el-table-column label="涨跌" min-width="180" align="right">
              <template #default="{ row }">
                <div class="metric-cell">
                  <strong :class="getProfitClass(row.changeAmount)">
                    {{ formatSignedNumber(row.changeAmount, 4) }}
                  </strong>
                  <span :class="getProfitClass(row.changePercent)">
                    {{ formatSignedPercent(row.changePercent) }}
                  </span>
                </div>
              </template>
            </el-table-column>

            <el-table-column label="当日收益" min-width="180" align="right">
              <template #default="{ row }">
                <div class="metric-cell">
                  <strong :class="getProfitClass(row.todayProfit)">
                    {{ formatSignedMoney(row.todayProfit) }}
                  </strong>
                  <span :class="getProfitClass(row.todayProfitPercent)">
                    {{ formatSignedPercent(row.todayProfitPercent) }}
                  </span>
                </div>
              </template>
            </el-table-column>

            <el-table-column label="持有收益" min-width="180" align="right">
              <template #default="{ row }">
                <div class="metric-cell">
                  <strong :class="getProfitClass(row.holdingProfit)">
                    {{ formatSignedMoney(row.holdingProfit) }}
                  </strong>
                  <span :class="getProfitClass(row.holdingProfitPercent)">
                    {{ formatSignedPercent(row.holdingProfitPercent) }}
                  </span>
                </div>
              </template>
            </el-table-column>
          </el-table>
        </div>

        <article v-if="selectedHoldingRow" class="holding-detail-card">
          <header class="holding-card-header">
            <div class="fund-identity">
              <strong>{{ selectedHoldingRow.fundName }}</strong>
              <span>{{ selectedHoldingRow.fundCode }}</span>
            </div>

            <div class="action-group">
              <el-button
                circle
                plain
                :icon="Edit"
                aria-label="编辑持仓"
                @click="startEdit(selectedHoldingRow.detail)"
              />
              <el-button
                circle
                plain
                type="danger"
                :icon="Delete"
                aria-label="删除持仓"
                @click="handleRemove(selectedHoldingRow.detail)"
              />
            </div>
          </header>

          <div class="field-grid">
            <div class="field">
              <span>持有金额</span>
              <strong>{{ formatMoney(selectedHoldingRow.detail.amount) }}</strong>
            </div>

            <div class="field">
              <span>目前已有收益</span>
              <strong :class="getProfitClass(selectedHoldingRow.detail.currentProfit)">
                {{ formatSignedMoney(selectedHoldingRow.detail.currentProfit) }}
              </strong>
            </div>

            <div class="field">
              <span>推算本金</span>
              <strong>{{ formatMoney(selectedHoldingRow.detail.principalAmount) }}</strong>
            </div>

            <div class="field">
              <span>上一净值对应持仓金额</span>
              <strong>{{ formatMoney(selectedHoldingRow.detail.latestMarketValue) }}</strong>
            </div>

            <div class="field">
              <span>当前估算净值</span>
              <strong>{{ formatNumber(selectedHoldingRow.detail.currentEstimatedNav) }}</strong>
            </div>

            <div class="field">
              <span>最新净值</span>
              <strong>{{ formatNumber(selectedHoldingRow.detail.latestNav) }}</strong>
            </div>

            <div class="field">
              <span>涨跌额 / 涨跌幅</span>
              <strong :class="getProfitClass(selectedHoldingRow.changeAmount)">
                {{ formatSignedNumber(selectedHoldingRow.changeAmount, 4) }}
                / {{ formatSignedPercent(selectedHoldingRow.changePercent) }}
              </strong>
            </div>

            <div class="field">
              <span>估算市值</span>
              <strong>{{ formatMoney(selectedHoldingRow.detail.estimatedMarketValue) }}</strong>
            </div>

            <div class="field">
              <span>当日收益 / 收益率</span>
              <strong :class="getProfitClass(selectedHoldingRow.todayProfit)">
                {{ formatSignedMoney(selectedHoldingRow.todayProfit) }}
                / {{ formatSignedPercent(selectedHoldingRow.todayProfitPercent) }}
              </strong>
            </div>

            <div class="field">
              <span>持有收益 / 收益率</span>
              <strong :class="getProfitClass(selectedHoldingRow.holdingProfit)">
                {{ formatSignedMoney(selectedHoldingRow.holdingProfit) }}
                / {{ formatSignedPercent(selectedHoldingRow.holdingProfitPercent) }}
              </strong>
            </div>
          </div>

          <footer class="holding-note">备注：{{ holdingNoteMap[selectedHoldingRow.fundCode] || "--" }}</footer>
        </article>
      </div>
    </el-card>
  </section>
</template>

<style scoped>
.holdings-view {
  display: grid;
  gap: 16px;
  margin: 0 auto;
  max-width: 1040px;
}

.panel-card,
.holding-detail-card {
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
}

.card-header {
  align-items: center;
  display: flex;
  gap: 12px;
  justify-content: space-between;
}

.card-header h1,
.card-header h2,
.holding-form h2 {
  color: var(--el-text-color-primary);
  font-size: 20px;
  line-height: 1.2;
  margin: 0 0 4px;
}

.card-header span {
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.holding-form {
  align-items: flex-end;
  display: grid;
  gap: 12px;
  grid-template-columns: minmax(180px, 1.2fr) minmax(150px, 0.8fr) minmax(150px, 0.8fr);
}

.holding-form h2,
.form-tip,
.holding-form :deep(.el-form-item:nth-of-type(4)) {
  grid-column: 1 / -1;
}

.form-tip {
  color: var(--el-text-color-secondary);
  font-size: 13px;
  margin: -4px 0 0;
}

.holding-form :deep(.el-form-item) {
  margin-bottom: 0;
}

.holding-form :deep(.el-input-number),
.holding-form :deep(.el-select) {
  width: 100%;
}

.submit-button {
  min-height: 32px;
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

.holding-section {
  display: grid;
  gap: 16px;
}

.table-wrap {
  overflow-x: auto;
}

.holding-table {
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
.fund-identity span,
.holding-note {
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

.holding-detail-card {
  background: var(--el-bg-color);
  display: grid;
  gap: 16px;
  padding: 16px;
}

.holding-card-header {
  align-items: flex-start;
  display: flex;
  gap: 12px;
  justify-content: space-between;
}

.action-group {
  display: flex;
  flex: 0 0 auto;
  gap: 8px;
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

.holding-note {
  border-top: 1px solid var(--el-border-color-lighter);
  overflow-wrap: anywhere;
  padding-top: 12px;
}

.profit-up {
  color: #d93026 !important;
}

.profit-down {
  color: #188038 !important;
}

.profit-flat {
  color: var(--el-text-color-secondary) !important;
}

:deep(.holding-table .is-selected-row td) {
  background: var(--el-color-primary-light-9) !important;
}

@media (max-width: 768px) {
  .card-header,
  .holding-card-header {
    align-items: stretch;
    flex-direction: column;
  }

  .holding-form,
  .field-grid,
  .table-toolbar {
    grid-template-columns: 1fr;
  }

  .table-toolbar,
  .sort-select,
  .submit-button,
  .card-header .el-button {
    width: 100%;
  }

  .table-toolbar {
    flex-direction: column;
  }
}
</style>
