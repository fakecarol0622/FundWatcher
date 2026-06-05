<script setup lang="ts">
import { computed, onMounted } from "vue";
import { Bell, Delete } from "@element-plus/icons-vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { formatDateTime } from "../services/timeService";
import { useAlertStore } from "../stores/alertStore";
import type { AlertRecord, AlertType } from "../types/alert";

const alertStore = useAlertStore();

const sortedAlerts = computed(() =>
  [...alertStore.alertRecords].sort((left, right) => right.triggeredAt - left.triggeredAt),
);

function getTypeLabel(type: AlertType): string {
  return type === "up" ? "上涨提醒" : "下跌提醒";
}

function getTypeTagType(type: AlertType): "danger" | "success" {
  return type === "up" ? "danger" : "success";
}

function formatPercent(value: number): string {
  return `${value.toFixed(2)}%`;
}

function getRecordKey(record: AlertRecord): string {
  return record.id;
}

async function handleClearAlerts(): Promise<void> {
  if (alertStore.alertRecords.length === 0) {
    return;
  }

  try {
    await ElMessageBox.confirm("确认清空全部提醒记录吗？此操作不可撤销。", "清空提醒记录", {
      confirmButtonText: "清空",
      cancelButtonText: "取消",
      type: "warning",
    });

    alertStore.clearAlerts();
    ElMessage.success("已清空提醒记录");
  } catch {
    // User canceled.
  }
}

onMounted(() => {
  alertStore.loadFromStorage();
});
</script>

<template>
  <section class="alerts-view">
    <el-card shadow="never" class="page-card">
      <template #header>
        <div class="card-header">
          <div>
            <h1>提醒记录</h1>
            <span>按触发时间倒序展示，保存在当前浏览器本地</span>
          </div>

          <el-button
            :icon="Delete"
            :disabled="sortedAlerts.length === 0"
            @click="handleClearAlerts"
          >
            清空记录
          </el-button>
        </div>
      </template>

      <el-empty
        v-if="sortedAlerts.length === 0"
        description="暂无提醒记录，达到阈值后会在这里保留历史。"
      />

      <div v-else class="alert-list">
        <article v-for="record in sortedAlerts" :key="getRecordKey(record)" class="alert-card">
          <header class="alert-card-header">
            <div class="alert-identity">
              <strong>{{ record.fundName }}</strong>
              <span>{{ record.fundCode }}</span>
            </div>

            <el-tag :type="getTypeTagType(record.type)" effect="light">
              {{ getTypeLabel(record.type) }}
            </el-tag>
          </header>

          <div class="alert-message">
            <el-icon><Bell /></el-icon>
            <span>{{ record.message }}</span>
          </div>

          <div class="field-grid">
            <div class="field">
              <span>阈值</span>
              <strong>{{ formatPercent(record.threshold) }}</strong>
            </div>

            <div class="field">
              <span>实际涨跌幅</span>
              <strong :class="record.type === 'up' ? 'growth-up' : 'growth-down'">
                {{ formatPercent(record.actualGrowth) }}
              </strong>
            </div>

            <div class="field">
              <span>交易日</span>
              <strong>{{ record.date }}</strong>
            </div>

            <div class="field">
              <span>触发时间</span>
              <strong>{{ formatDateTime(record.triggeredAt) }}</strong>
            </div>
          </div>
        </article>
      </div>
    </el-card>
  </section>
</template>

<style scoped>
.alerts-view {
  margin: 0 auto;
  max-width: 1040px;
}

.page-card,
.alert-card {
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
}

.card-header,
.alert-card-header {
  align-items: flex-start;
  display: flex;
  gap: 12px;
  justify-content: space-between;
}

.card-header h1 {
  color: var(--el-text-color-primary);
  font-size: 20px;
  line-height: 1.2;
  margin: 0 0 4px;
}

.card-header span,
.alert-identity span {
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.alert-list {
  display: grid;
  gap: 12px;
}

.alert-card {
  background: var(--el-bg-color);
  display: grid;
  gap: 14px;
  padding: 16px;
}

.alert-identity {
  display: grid;
  gap: 4px;
}

.alert-identity strong {
  color: var(--el-text-color-primary);
  font-size: 18px;
  line-height: 1.25;
  overflow-wrap: anywhere;
}

.alert-message {
  align-items: flex-start;
  background: var(--el-fill-color-lighter);
  border-radius: 8px;
  color: var(--el-text-color-regular);
  display: flex;
  gap: 8px;
  line-height: 1.5;
  padding: 12px;
}

.alert-message span {
  overflow-wrap: anywhere;
}

.field-grid {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.field {
  display: grid;
  gap: 4px;
}

.field span {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.field strong {
  color: var(--el-text-color-primary);
  font-size: 15px;
  font-weight: 600;
  overflow-wrap: anywhere;
}

.growth-up {
  color: #d93026 !important;
}

.growth-down {
  color: #188038 !important;
}

@media (max-width: 768px) {
  .alerts-view {
    gap: 12px;
  }

  .card-header,
  .alert-card-header {
    align-items: stretch;
    flex-direction: column;
  }

  .card-header .el-button {
    width: 100%;
  }

  .field-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .page-card,
  .alert-card {
    border-radius: 10px;
  }

  .alert-identity strong {
    font-size: 16px;
  }

  .card-header h1 {
    font-size: 18px;
  }
}

/* ── Small phones: ≤480px ── */
@media (max-width: 480px) {
  .field-grid {
    grid-template-columns: 1fr;
  }

  .alert-card {
    padding: 12px;
    gap: 10px;
  }

  .alert-message {
    padding: 10px;
    font-size: 13px;
  }

  .field strong {
    font-size: 14px;
  }
}
</style>
