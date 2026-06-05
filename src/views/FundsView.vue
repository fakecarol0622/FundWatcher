<script setup lang="ts">
import { computed, reactive } from "vue";
import { Delete, Plus, Setting, SwitchButton } from "@element-plus/icons-vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { useFundStore } from "../stores/fundStore";
import { useHoldingStore } from "../stores/holdingStore";
import { useSettingsStore } from "../stores/settingsStore";
import type { FundItem } from "../types/fund";

const fundStore = useFundStore();
const holdingStore = useHoldingStore();
const settingsStore = useSettingsStore();

const addForm = reactive({
  code: "",
});

const sortedFunds = computed(() =>
  [...fundStore.funds].sort((left, right) => right.createdAt - left.createdAt),
);

const fundCountText = computed(() => `${fundStore.funds.length} 只`);

function normalizeCode(code: string): string {
  return code.trim();
}

function isValidFundCode(code: string): boolean {
  return /^\d{6}$/.test(code);
}

function formatTime(timestamp: number): string {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(timestamp);
}

async function handleAddFund(): Promise<void> {
  const code = normalizeCode(addForm.code);

  if (!isValidFundCode(code)) {
    ElMessage.warning("基金代码必须是 6 位数字");
    return;
  }

  if (fundStore.funds.some((fund) => fund.code === code)) {
    ElMessage.warning("该基金已在自选列表中");
    return;
  }

  const addedFund = fundStore.addFund({
    code,
    enabled: true,
    thresholdUp: settingsStore.defaultThresholdUp,
    thresholdDown: settingsStore.defaultThresholdDown,
  });

  if (!addedFund) {
    ElMessage.error("添加基金失败，请重试");
    return;
  }

  addForm.code = "";
  ElMessage.success("已添加自选基金");

  if (!addedFund.name) {
    void fundStore.refreshFundEstimate(addedFund.code);
  }
}

function updateFund(
  code: string,
  patch: Partial<Omit<FundItem, "code" | "createdAt">>,
): void {
  fundStore.updateFund(code, patch);
}

function handleEnabledChange(code: string, enabled: boolean): void {
  updateFund(code, { enabled });
}

function handleThresholdUpChange(
  code: string,
  value: number | undefined,
): void {
  updateFund(code, {
    thresholdUp: value ?? settingsStore.defaultThresholdUp,
  });
}

function handleThresholdDownChange(
  code: string,
  value: number | undefined,
): void {
  updateFund(code, {
    thresholdDown: value ?? settingsStore.defaultThresholdDown,
  });
}

async function handleRemoveFund(fund: FundItem): Promise<void> {
  try {
    await ElMessageBox.confirm(
      `确认删除基金 ${fund.code} 吗？`,
      "删除自选基金",
      {
        confirmButtonText: "删除",
        cancelButtonText: "取消",
        type: "warning",
      },
    );

    fundStore.removeFund(fund.code);
    holdingStore.removeHolding(fund.code);
    ElMessage.success("已删除自选基金");
  } catch {
    // User canceled.
  }
}
</script>

<template>
  <section class="funds-view">
    <el-card shadow="never" class="add-card">
      <template #header>
        <div class="card-header">
          <div>
            <h1>自选基金</h1>
            <span>{{ fundCountText }}</span>
          </div>
        </div>
      </template>

      <el-form
        class="add-form"
        :model="addForm"
        label-position="top"
        @submit.prevent
      >
        <el-form-item label="基金代码">
          <el-input
            v-model="addForm.code"
            clearable
            inputmode="numeric"
            maxlength="6"
            placeholder="例如 161725"
            @keyup.enter="handleAddFund"
          />
        </el-form-item>

        <el-button
          class="add-button"
          type="primary"
          :icon="Plus"
          @click="handleAddFund"
        >
          添加
        </el-button>
      </el-form>
    </el-card>

    <el-empty v-if="sortedFunds.length === 0" description="暂无自选基金" />

    <div v-else class="fund-list">
      <article v-for="fund in sortedFunds" :key="fund.code" class="fund-card">
        <header class="fund-card-header">
          <div class="fund-identity">
            <strong>{{ fund.name || "未命名基金" }}</strong>
            <span>{{ fund.code }}</span>
          </div>

          <el-button
            circle
            plain
            type="danger"
            :icon="Delete"
            aria-label="删除基金"
            @click="handleRemoveFund(fund)"
          />
        </header>

        <div class="field-grid">
          <label class="field switch-field">
            <span>
              <el-icon><SwitchButton /></el-icon>
              监控
            </span>
            <el-switch
              :model-value="fund.enabled"
              active-text="启用"
              inactive-text="停用"
              @update:model-value="
                (value: boolean) => handleEnabledChange(fund.code, value)
              "
            />
          </label>

          <label class="field">
            <span>
              <el-icon><Setting /></el-icon>
              上涨阈值
            </span>
            <el-input-number
              :model-value="
                fund.thresholdUp ?? settingsStore.defaultThresholdUp
              "
              :step="0.1"
              :precision="2"
              controls-position="right"
              @update:model-value="
                (value: number | undefined) =>
                  handleThresholdUpChange(fund.code, value)
              "
            />
          </label>

          <label class="field">
            <span>
              <el-icon><Setting /></el-icon>
              下跌阈值
            </span>
            <el-input-number
              :model-value="
                fund.thresholdDown ?? settingsStore.defaultThresholdDown
              "
              :step="0.1"
              :precision="2"
              controls-position="right"
              @update:model-value="
                (value: number | undefined) =>
                  handleThresholdDownChange(fund.code, value)
              "
            />
          </label>
        </div>

        <footer class="fund-meta">
          更新于 {{ formatTime(fund.updatedAt) }}
        </footer>
      </article>
    </div>
  </section>
</template>

<style scoped>
.funds-view {
  display: grid;
  gap: 16px;
  margin: 0 auto;
  max-width: 1040px;
}

.add-card,
.fund-card {
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
}

.card-header {
  align-items: center;
  display: flex;
  justify-content: space-between;
}

.card-header h1 {
  color: var(--el-text-color-primary);
  font-size: 20px;
  line-height: 1.2;
  margin: 0 0 4px;
}

.card-header span {
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.add-form {
  align-items: flex-end;
  display: grid;
  gap: 12px;
  grid-template-columns: 1fr auto;
}

.add-form :deep(.el-form-item) {
  margin-bottom: 0;
}

.add-button {
  min-height: 32px;
}

.fund-list {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
}

.fund-card {
  background: var(--el-bg-color);
  display: grid;
  gap: 16px;
  padding: 16px;
}

.fund-card-header {
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
.fund-meta {
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.field-grid {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.field {
  display: grid;
  gap: 6px;
  min-width: 0;
}

.field > span {
  align-items: center;
  color: var(--el-text-color-regular);
  display: inline-flex;
  font-size: 13px;
  gap: 4px;
}

.field :deep(.el-input-number) {
  width: 100%;
}

.switch-field {
  align-content: start;
  grid-column: 1 / -1;
}

.fund-meta {
  border-top: 1px solid var(--el-border-color-lighter);
  padding-top: 12px;
}

@media (max-width: 768px) {
  .funds-view {
    gap: 12px;
  }

  .add-form,
  .field-grid {
    grid-template-columns: 1fr;
  }

  .add-button {
    width: 100%;
  }

  .fund-list {
    grid-template-columns: 1fr;
  }

  .fund-card {
    padding: 14px;
    gap: 12px;
    position: relative;
  }

  .fund-card-header {
    padding-right: 36px;
  }

  .fund-card-header .el-button {
    position: absolute;
    right: 14px;
    top: 14px;
  }

  .fund-identity strong {
    font-size: 16px;
  }

  .card-header h1 {
    font-size: 18px;
  }

  .add-card,
  .fund-card {
    border-radius: 10px;
  }
}

/* ── Small phones: ≤480px ── */
@media (max-width: 480px) {
  .fund-card {
    padding: 12px;
  }

  .fund-card-header {
    align-items: stretch;
    flex-direction: column;
  }

  .fund-card-header .el-button {
    align-self: flex-end;
  }

  .field > span {
    font-size: 12px;
  }
}
</style>

