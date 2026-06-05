<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import {
  Bell,
  Delete,
  Download,
  InfoFilled,
  Upload,
} from "@element-plus/icons-vue";
import { ElMessage, ElMessageBox } from "element-plus";
import {
  createBackupData,
  downloadBackupJson,
  readBackupFile,
} from "../services/backupService";
import {
  getBrowserNotificationPermission,
  isBrowserNotificationSupported,
  requestBrowserNotificationPermission,
  type BrowserNotificationPermissionState,
} from "../services/notificationService";
import { clearAppData } from "../services/storageService";
import { useAlertStore } from "../stores/alertStore";
import { useFundStore } from "../stores/fundStore";
import { useHoldingStore } from "../stores/holdingStore";
import { useSettingsStore } from "../stores/settingsStore";
import type { AppTheme } from "../types/settings";

const fundStore = useFundStore();
const holdingStore = useHoldingStore();
const alertStore = useAlertStore();
const settingsStore = useSettingsStore();

const importInputRef = ref<HTMLInputElement | null>(null);
const isImporting = ref(false);
const isRequestingPermission = ref(false);
const browserNotificationSupported = isBrowserNotificationSupported();
const permission = ref<BrowserNotificationPermissionState>(getBrowserNotificationPermission());

const themeOptions: Array<{ label: string; value: AppTheme }> = [
  { label: "跟随系统", value: "system" },
  { label: "浅色", value: "light" },
  { label: "深色", value: "dark" },
];

const refreshIntervalMinutes = computed({
  get: () => settingsStore.refreshIntervalMinutes,
  set: (value: number | null | undefined) => {
    settingsStore.setRefreshIntervalMinutes(Number(value));
  },
});

const defaultThresholdUp = computed({
  get: () => settingsStore.defaultThresholdUp,
  set: (value: number | null | undefined) => {
    settingsStore.setDefaultThresholdUp(Number(value));
  },
});

const defaultThresholdDown = computed({
  get: () => settingsStore.defaultThresholdDown,
  set: (value: number | null | undefined) => {
    settingsStore.setDefaultThresholdDown(Number(value));
  },
});

const theme = computed({
  get: () => settingsStore.theme,
  set: (value: AppTheme) => {
    settingsStore.setTheme(value);
  },
});

const permissionText = computed(() => {
  switch (permission.value) {
    case "granted":
      return "已授权";
    case "denied":
      return "已拒绝";
    case "default":
      return "未授权";
    default:
      return "当前浏览器不支持";
  }
});

const permissionTagType = computed<"success" | "warning" | "danger" | "info">(() => {
  switch (permission.value) {
    case "granted":
      return "success";
    case "denied":
      return "danger";
    case "default":
      return "warning";
    default:
      return "info";
  }
});

function refreshPermissionState(): void {
  permission.value = getBrowserNotificationPermission();
}

function syncNotificationToggle(): void {
  refreshPermissionState();

  if (!browserNotificationSupported || permission.value !== "granted") {
    settingsStore.setEnableBrowserNotification(false);
  }
}

async function handleRequestPermission(): Promise<void> {
  if (!browserNotificationSupported || isRequestingPermission.value) {
    return;
  }

  isRequestingPermission.value = true;

  try {
    const nextPermission = await requestBrowserNotificationPermission();
    permission.value = nextPermission;

    if (nextPermission === "granted") {
      settingsStore.setEnableBrowserNotification(true);
      ElMessage.success("浏览器通知已授权并启用。");
      return;
    }

    settingsStore.setEnableBrowserNotification(false);

    if (nextPermission === "denied") {
      ElMessage.warning("浏览器通知已被拒绝，页面内提醒和提醒记录仍可正常使用。");
      return;
    }

    if (nextPermission === "unsupported") {
      ElMessage.error("当前浏览器不支持 Notification API。");
      return;
    }

    ElMessage.info("通知权限仍未授权，页面内提醒和提醒记录仍可正常使用。");
  } finally {
    isRequestingPermission.value = false;
  }
}

function handleBrowserNotificationToggle(value: boolean): void {
  if (!value) {
    settingsStore.setEnableBrowserNotification(false);
    return;
  }

  if (!browserNotificationSupported) {
    settingsStore.setEnableBrowserNotification(false);
    ElMessage.error("当前浏览器不支持 Notification API。");
    return;
  }

  if (permission.value !== "granted") {
    settingsStore.setEnableBrowserNotification(false);
    ElMessage.warning("请先完成浏览器通知授权，页面内提醒不会受影响。");
    return;
  }

  settingsStore.setEnableBrowserNotification(true);
}

function handleExport(): void {
  const backup = createBackupData({
    funds: fundStore.funds,
    holdings: holdingStore.holdings,
    alerts: alertStore.alertRecords,
    settings: {
      refreshIntervalMinutes: settingsStore.refreshIntervalMinutes,
      enableBrowserNotification: settingsStore.enableBrowserNotification,
      defaultThresholdUp: settingsStore.defaultThresholdUp,
      defaultThresholdDown: settingsStore.defaultThresholdDown,
      theme: settingsStore.theme,
    },
  });

  downloadBackupJson(backup);
  ElMessage.success("配置已导出为 JSON 文件。");
}

function triggerImport(): void {
  importInputRef.value?.click();
}

function reloadAppState(): void {
  window.setTimeout(() => {
    window.location.reload();
  }, 250);
}

async function applyImportedBackup(): Promise<void> {
  await ElMessageBox.confirm(
    "导入会覆盖当前的基金、自选持仓、提醒记录和设置，是否继续？",
    "覆盖当前数据",
    {
      type: "warning",
      confirmButtonText: "覆盖导入",
      cancelButtonText: "取消",
    },
  );
}

async function handleImportChange(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];

  input.value = "";

  if (!file || isImporting.value) {
    return;
  }

  isImporting.value = true;

  try {
    const backup = await readBackupFile(file);
    await applyImportedBackup();

    clearAppData();
    fundStore.replaceFunds(backup.funds);
    holdingStore.replaceHoldings(backup.holdings);
    alertStore.replaceAlerts(backup.alerts);
    settingsStore.replaceSettings(backup.settings);
    syncNotificationToggle();

    ElMessage.success("导入成功，正在刷新应用状态。");
    reloadAppState();
  } catch (error) {
    if (error === "cancel" || error === "close") {
      return;
    }

    const message = error instanceof Error ? error.message : "导入失败，请检查备份文件。";
    ElMessage.error(message);
  } finally {
    isImporting.value = false;
  }
}

async function handleClearData(): Promise<void> {
  try {
    await ElMessageBox.confirm(
      "清空后将删除当前浏览器中的基金、持仓、提醒记录和缓存，并把设置恢复为默认值。",
      "清空本地数据",
      {
        type: "warning",
        confirmButtonText: "确认清空",
        cancelButtonText: "取消",
      },
    );

    clearAppData();
    fundStore.resetState();
    holdingStore.resetState();
    alertStore.resetState();
    settingsStore.resetState();
    syncNotificationToggle();

    ElMessage.success("本地数据已清空，正在刷新应用状态。");
    reloadAppState();
  } catch (error) {
    if (error !== "cancel" && error !== "close") {
      const message = error instanceof Error ? error.message : "清空本地数据失败。";
      ElMessage.error(message);
    }
  }
}

onMounted(() => {
  fundStore.loadFromStorage();
  holdingStore.loadFromStorage();
  alertStore.loadFromStorage();
  settingsStore.loadFromStorage();
  syncNotificationToggle();
});
</script>

<template>
  <section class="settings-view">
    <el-card shadow="never" class="page-card">
      <template #header>
        <div class="card-header">
          <div>
            <h1>设置</h1>
            <span>管理自动刷新、提醒阈值、主题、通知授权和本地数据导入导出。</span>
          </div>
        </div>
      </template>

      <div class="settings-group">
        <section class="settings-section">
          <div class="section-title">
            <strong>基础设置</strong>
            <span>这些配置会立即保存到当前浏览器本地。</span>
          </div>

          <div class="setting-row">
            <div>
              <strong>自动刷新间隔</strong>
              <p>页面保持打开时，Dashboard 会按这里的分钟数自动刷新。</p>
            </div>

            <el-input-number
              v-model="refreshIntervalMinutes"
              :min="1"
              :max="1440"
              :step="1"
              controls-position="right"
            />
          </div>

          <div class="setting-row">
            <div>
              <strong>默认上涨阈值</strong>
              <p>新增基金时使用的默认上涨提醒阈值，单位为百分比。</p>
            </div>

            <el-input-number
              v-model="defaultThresholdUp"
              :min="0"
              :step="0.5"
              :precision="2"
              controls-position="right"
            />
          </div>

          <div class="setting-row">
            <div>
              <strong>默认下跌阈值</strong>
              <p>新增基金时使用的默认下跌提醒阈值，建议填写负数。</p>
            </div>

            <el-input-number
              v-model="defaultThresholdDown"
              :max="0"
              :step="0.5"
              :precision="2"
              controls-position="right"
            />
          </div>

          <div class="setting-row">
            <div>
              <strong>主题模式</strong>
              <p>支持浅色、深色和跟随系统。</p>
            </div>

            <el-segmented v-model="theme" :options="themeOptions" />
          </div>
        </section>

        <section class="settings-section">
          <div class="section-title">
            <strong>通知权限</strong>
            <span>第一版只支持页面打开时的前台提醒。</span>
          </div>

          <div class="setting-row">
            <div>
              <strong>浏览器通知授权</strong>
              <p>系统通知依赖 Notification API；即使未授权，页面内提醒和提醒记录仍可用。</p>
            </div>

            <div class="setting-actions">
              <el-tag :type="permissionTagType" effect="light">{{ permissionText }}</el-tag>
              <el-button
                v-if="browserNotificationSupported && permission !== 'granted'"
                type="primary"
                :icon="Bell"
                :loading="isRequestingPermission"
                @click="handleRequestPermission"
              >
                请求授权
              </el-button>
            </div>
          </div>

          <div class="setting-row">
            <div>
              <strong>启用浏览器通知</strong>
              <p>只有在浏览器已授权后才会发送系统通知。</p>
            </div>

            <el-switch
              :model-value="settingsStore.enableBrowserNotification"
              @update:model-value="handleBrowserNotificationToggle"
            />
          </div>

          <el-alert
            class="setting-alert"
            type="info"
            :closable="false"
            show-icon
            title="当前版本为本地浏览器版本，页面关闭或设备休眠后无法继续监控提醒。"
          />

          <el-alert
            class="setting-alert"
            type="warning"
            :closable="false"
            show-icon
            title="如需页面关闭后仍能提醒，需要后续实现独立的后台定时任务版本。"
          />
        </section>

        <section class="settings-section">
          <div class="section-title">
            <strong>导入导出</strong>
            <span>导出 JSON 仅包含业务数据和设置，不包含运行时缓存。</span>
          </div>

          <div class="setting-row">
            <div>
              <strong>导出 JSON 配置</strong>
              <p>导出内容包含 version、exportedAt、funds、holdings、alerts、settings。</p>
            </div>

            <el-button type="primary" :icon="Download" @click="handleExport">导出</el-button>
          </div>

          <div class="setting-row">
            <div>
              <strong>导入 JSON 配置</strong>
              <p>导入前会校验关键字段，并在覆盖当前数据前再次确认。</p>
            </div>

            <el-button type="primary" plain :icon="Upload" :loading="isImporting" @click="triggerImport">
              导入
            </el-button>
          </div>

          <input
            ref="importInputRef"
            class="hidden-input"
            type="file"
            accept="application/json,.json"
            @change="handleImportChange"
          />
        </section>

        <section class="settings-section danger-section">
          <div class="section-title">
            <strong>危险操作</strong>
            <span>该操作不可撤销，请谨慎执行。</span>
          </div>

          <div class="setting-row">
            <div>
              <strong>清空本地数据</strong>
              <p>会删除当前浏览器中的基金、持仓、提醒记录和缓存，并恢复默认设置。</p>
            </div>

            <el-button type="danger" plain :icon="Delete" @click="handleClearData">清空数据</el-button>
          </div>
        </section>

        <section class="tips-card">
          <div class="tips-header">
            <el-icon><InfoFilled /></el-icon>
            <strong>免责声明</strong>
          </div>

          <ul class="tips-list">
            <li>本工具仅用于个人数据整理和估值观察。</li>
            <li>基金估值为第三方估算数据，不等于基金公司最终披露净值。</li>
            <li>所有分析内容不构成投资建议。</li>
            <li>投资有风险，决策需谨慎。</li>
          </ul>
        </section>
      </div>
    </el-card>
  </section>
</template>

<style scoped>
.settings-view {
  margin: 0 auto;
  max-width: 1040px;
}

.page-card {
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
}

.card-header h1 {
  color: var(--el-text-color-primary);
  font-size: 20px;
  line-height: 1.2;
  margin: 0 0 4px;
}

.card-header span,
.setting-row p,
.section-title span {
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.settings-group {
  display: grid;
  gap: 16px;
}

.settings-section,
.tips-card {
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  display: grid;
  gap: 16px;
  padding: 16px;
}

.danger-section {
  border-color: var(--el-color-danger-light-5);
}

.section-title {
  display: grid;
  gap: 6px;
}

.section-title strong,
.setting-row strong,
.tips-header strong {
  color: var(--el-text-color-primary);
  display: block;
  font-size: 16px;
}

.setting-row {
  align-items: center;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  display: flex;
  gap: 16px;
  justify-content: space-between;
  padding: 16px;
}

.setting-row p {
  margin: 6px 0 0;
}

.setting-actions {
  align-items: center;
  display: flex;
  flex: 0 0 auto;
  gap: 12px;
}

.setting-alert {
  margin: 0;
}

.tips-card {
  gap: 12px;
}

.tips-header {
  align-items: center;
  color: var(--el-text-color-primary);
  display: flex;
  gap: 8px;
}

.tips-list {
  color: var(--el-text-color-regular);
  margin: 0;
  padding-left: 18px;
}

.tips-list li + li {
  margin-top: 8px;
}

.hidden-input {
  display: none;
}

@media (max-width: 768px) {
  .setting-row {
    align-items: stretch;
    flex-direction: column;
  }

  .setting-actions {
    align-items: stretch;
    flex-direction: column;
    width: 100%;
  }

  .setting-actions :deep(.el-button),
  .setting-row :deep(.el-input-number),
  .setting-row :deep(.el-segmented),
  .setting-row :deep(.el-button) {
    width: 100%;
  }
}
</style>
