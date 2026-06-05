<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
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

const fundStore = useFundStore();
const holdingStore = useHoldingStore();

const editingFundCode = ref<string | null>(null);
const form = reactive<HoldingForm>({
  fundCode: "",
  amount: undefined,
  currentProfit: undefined,
  note: "",
});

const sortedFunds = computed(() =>
  [...fundStore.funds].sort((left, right) => right.createdAt - left.createdAt),
);

const holdingRows = computed(() =>
  [...holdingStore.computedHoldings].sort((left, right) =>
    left.fundCode.localeCompare(right.fundCode),
  ),
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

function formatMoney(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "--";
  }

  return value.toFixed(2);
}

function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "--";
  }

  return `${value.toFixed(2)}%`;
}

function getProfitClass(value: number | null | undefined): string {
  if (value === null || value === undefined || value === 0) {
    return "profit-flat";
  }

  return value > 0 ? "profit-up" : "profit-down";
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

  ElMessage.success(editingFundCode.value ? "已更新持仓" : "已添加持仓");
  resetForm();
}

function startEdit(row: HoldingComputed): void {
  const holding = holdingStore.holdings.find((item) => item.fundCode === row.fundCode);
  if (!holding) {
    return;
  }

  editingFundCode.value = holding.fundCode;
  form.fundCode = holding.fundCode;
  form.amount = holding.amount;
  form.currentProfit = holding.currentProfit;
  form.note = holding.note ?? "";
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
    ElMessage.success("已删除持仓");
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
            <span>为已添加基金维护持有金额、目前已有收益和备注</span>
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
            placeholder="选择已添加基金"
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
      v-if="sortedFunds.length > 0 && holdingRows.length === 0"
      description="暂无持仓，请先填写当前持仓金额和目前已有收益。"
    />

    <div v-else class="holding-list">
      <article v-for="row in holdingRows" :key="row.fundCode" class="holding-card">
        <header class="holding-card-header">
          <div class="fund-identity">
            <strong>{{ row.fundName }}</strong>
            <span>{{ row.fundCode }}</span>
          </div>

          <div class="action-group">
            <el-button circle plain :icon="Edit" aria-label="编辑持仓" @click="startEdit(row)" />
            <el-button
              circle
              plain
              type="danger"
              :icon="Delete"
              aria-label="删除持仓"
              @click="handleRemove(row)"
            />
          </div>
        </header>

        <div class="field-grid">
          <div class="field">
            <span>持有金额</span>
            <strong>{{ formatMoney(row.amount) }}</strong>
          </div>

          <div class="field">
            <span>目前已有收益</span>
            <strong :class="getProfitClass(row.currentProfit)">{{ formatMoney(row.currentProfit) }}</strong>
          </div>

          <div class="field">
            <span>推算本金</span>
            <strong>{{ formatMoney(row.principalAmount) }}</strong>
          </div>

          <div class="field">
            <span>上一净值对应持仓金额</span>
            <strong>{{ formatMoney(row.latestMarketValue) }}</strong>
          </div>

          <div class="field">
            <span>当前估算净值</span>
            <strong>{{ formatNumber(row.currentEstimatedNav) }}</strong>
          </div>

          <div class="field">
            <span>估算市值</span>
            <strong>{{ formatMoney(row.estimatedMarketValue) }}</strong>
          </div>

          <div class="field">
            <span>总估算盈亏</span>
            <strong :class="getProfitClass(row.estimatedProfit)">
              {{ formatMoney(row.estimatedProfit) }}
            </strong>
          </div>

          <div class="field">
            <span>总估算收益率</span>
            <strong :class="getProfitClass(row.estimatedProfitPercent)">
              {{ formatPercent(row.estimatedProfitPercent) }}
            </strong>
          </div>

          <div class="field">
            <span>今日估算盈亏</span>
            <strong :class="getProfitClass(row.todayProfit)">{{ formatMoney(row.todayProfit) }}</strong>
          </div>
        </div>

        <footer class="holding-note">备注：{{ holdingNoteMap[row.fundCode] || "--" }}</footer>
      </article>
    </div>
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
.holding-card {
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

.holding-list {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
}

.holding-card {
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

.fund-identity {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.fund-identity strong {
  color: var(--el-text-color-primary);
  font-size: 18px;
  line-height: 1.25;
  overflow-wrap: anywhere;
}

.fund-identity span,
.holding-note {
  color: var(--el-text-color-secondary);
  font-size: 13px;
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

@media (max-width: 768px) {
  .card-header,
  .holding-card-header {
    align-items: stretch;
    flex-direction: column;
  }

  .holding-form,
  .field-grid,
  .holding-list {
    grid-template-columns: 1fr;
  }

  .submit-button,
  .card-header .el-button {
    width: 100%;
  }
}
</style>
