<script setup lang="ts">
import { computed, onMounted } from "vue";
import { Bell, InfoFilled } from "@element-plus/icons-vue";
import { ElMessage } from "element-plus";
import {
  getBrowserNotificationPermission,
  isBrowserNotificationSupported,
  requestBrowserNotificationPermission,
} from "../services/notificationService";
import { useSettingsStore } from "../stores/settingsStore";

const settingsStore = useSettingsStore();

const browserNotificationSupported = computed(() => isBrowserNotificationSupported());
const permission = computed(() => getBrowserNotificationPermission());
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

async function handleRequestPermission(): Promise<void> {
  const nextPermission = await requestBrowserNotificationPermission();

  if (nextPermission === "granted") {
    settingsStore.setEnableBrowserNotification(true);
    ElMessage.success("浏览器通知已授权并开启");
    return;
  }

  settingsStore.setEnableBrowserNotification(false);

  if (nextPermission === "denied") {
    ElMessage.warning("浏览器通知已被拒绝，页面内 toast 仍可正常使用");
    return;
  }

  if (nextPermission === "unsupported") {
    ElMessage.error("当前浏览器不支持 Notification API");
    return;
  }

  ElMessage.info("通知权限仍未授权，页面内 toast 仍可正常使用");
}

function handleBrowserNotificationToggle(value: boolean): void {
  if (!browserNotificationSupported.value) {
    settingsStore.setEnableBrowserNotification(false);
    ElMessage.error("当前浏览器不支持 Notification API");
    return;
  }

  if (permission.value !== "granted") {
    settingsStore.setEnableBrowserNotification(false);
    ElMessage.warning("请先授权浏览器通知，页面内 toast 不受影响");
    return;
  }

  settingsStore.setEnableBrowserNotification(value);
}

onMounted(() => {
  settingsStore.loadFromStorage();
});
</script>

<template>
  <section class="settings-view">
    <el-card shadow="never" class="page-card">
      <template #header>
        <div class="card-header">
          <div>
            <h1>通知设置</h1>
            <span>Step 9 仅实现阈值提醒相关配置，不包含导入导出和其他设置项</span>
          </div>
        </div>
      </template>

      <div class="settings-group">
        <div class="setting-row">
          <div>
            <strong>浏览器通知权限</strong>
            <p>用于系统级通知；如果用户拒绝，页面内 toast 仍然可用。</p>
          </div>

          <div class="setting-actions">
            <el-tag :type="permissionTagType" effect="light">{{ permissionText }}</el-tag>
            <el-button
              v-if="permission !== 'granted'"
              type="primary"
              :icon="Bell"
              @click="handleRequestPermission"
            >
              请求授权
            </el-button>
          </div>
        </div>

        <div class="setting-row">
          <div>
            <strong>启用浏览器通知</strong>
            <p>仅在已授权的情况下生效；关闭后只保留页面内 toast 和提醒记录。</p>
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
          title="如需后台提醒，需要后续启用 Serverless 定时任务版本。"
        />

        <div class="tips-card">
          <div class="tips-header">
            <el-icon><InfoFilled /></el-icon>
            <strong>说明</strong>
          </div>

          <ul class="tips-list">
            <li>阈值提醒会在页面刷新后按最新估值判断。</li>
            <li>同一基金、同一阈值、同一交易日只会提醒一次。</li>
            <li>浏览器通知拒绝后不会再主动弹系统通知，但 toast 和提醒记录不受影响。</li>
          </ul>
        </div>
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
.setting-row p {
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.settings-group {
  display: grid;
  gap: 16px;
}

.setting-row,
.tips-card {
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  display: flex;
  gap: 16px;
  justify-content: space-between;
  padding: 16px;
}

.setting-row strong,
.tips-header strong {
  color: var(--el-text-color-primary);
  display: block;
  font-size: 16px;
  margin-bottom: 6px;
}

.setting-row p {
  margin: 0;
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
  display: grid;
  gap: 12px;
  justify-content: stretch;
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

@media (max-width: 768px) {
  .setting-row {
    align-items: stretch;
    flex-direction: column;
  }

  .setting-actions {
    align-items: stretch;
    flex-direction: column;
  }
}
</style>
