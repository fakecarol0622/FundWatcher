<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { applyTheme, listenToSystemThemeChange } from "./services/themeService";
import { useSettingsStore } from "./stores/settingsStore";

interface NavItem {
  label: string;
  path: string;
}

const navItems: NavItem[] = [
  { label: "看板", path: "/" },
  { label: "基金", path: "/funds" },
  { label: "持仓", path: "/holdings" },
  { label: "提醒", path: "/alerts" },
  { label: "设置", path: "/settings" },
];

const route = useRoute();
const router = useRouter();
const settingsStore = useSettingsStore();

const activeMenu = computed(() => route.path);
const mobileDrawerOpen = ref(false);
let stopThemeListener: (() => void) | undefined;

const handleMenuSelect = (index: string) => {
  mobileDrawerOpen.value = false;
  if (index !== route.path) {
    router.push(index);
  }
};

watch(
  () => settingsStore.theme,
  (theme) => {
    applyTheme(theme);
  },
  { immediate: true },
);

onMounted(() => {
  settingsStore.loadFromStorage();
  applyTheme(settingsStore.theme);
  stopThemeListener = listenToSystemThemeChange(() => {
    applyTheme(settingsStore.theme);
  });
});

onUnmounted(() => {
  stopThemeListener?.();
});
</script>

<template>
  <el-container class="app-layout">
    <el-header class="app-header">
      <div class="brand">Fund Watcher</div>

      <!-- Desktop nav -->
      <el-menu
        class="desktop-nav"
        mode="horizontal"
        :default-active="activeMenu"
        :ellipsis="false"
        @select="handleMenuSelect"
      >
        <el-menu-item
          v-for="item in navItems"
          :key="item.path"
          :index="item.path"
        >
          {{ item.label }}
        </el-menu-item>
      </el-menu>

      <!-- Mobile hamburger -->
      <button
        class="mobile-menu-btn"
        type="button"
        @click="mobileDrawerOpen = true"
      >
        <span class="hamburger-icon">
          <span></span>
          <span></span>
          <span></span>
        </span>
      </button>
    </el-header>

    <el-main class="app-main">
      <router-view />
    </el-main>

    <!-- Mobile drawer -->
    <el-drawer
      v-model="mobileDrawerOpen"
      direction="ltr"
      size="280px"
      :with-header="false"
      class="mobile-drawer"
    >
      <nav class="mobile-nav">
        <div class="mobile-nav-brand">Fund Watcher</div>
        <a
          v-for="item in navItems"
          :key="item.path"
          class="mobile-nav-item"
          :class="{ active: activeMenu === item.path }"
          @click="handleMenuSelect(item.path)"
        >
          {{ item.label }}
        </a>
      </nav>
    </el-drawer>
  </el-container>
</template>

<style scoped>
.app-layout {
  background: var(--app-page-bg);
  min-height: 100vh;
  min-height: 100dvh;
}

.app-header {
  align-items: center;
  background: var(--app-surface-bg);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--el-border-color);
  display: flex;
  gap: 24px;
  padding: 0 24px;
  position: sticky;
  top: 0;
  z-index: 100;
}

.brand {
  color: var(--el-text-color-primary);
  font-size: 18px;
  font-weight: 700;
  white-space: nowrap;
  flex-shrink: 0;
}

.desktop-nav {
  flex: 1;
  border-bottom: none !important;
}

.desktop-nav :deep(.el-menu-item) {
  height: 60px;
  line-height: 60px;
}

.mobile-menu-btn {
  display: none !important;
  margin-left: auto;
  background: none;
  border: none;
  cursor: pointer;
  padding: 8px;
  border-radius: 6px;
  color: var(--el-text-color-primary);
}

.mobile-menu-btn:active {
  background: var(--el-fill-color-light);
}

.app-main {
  background:
    radial-gradient(
      circle at top left,
      var(--app-surface-accent),
      transparent 32%
    ),
    var(--app-page-bg);
  padding: 24px;
}

/* Hamburger icon */
.hamburger-icon {
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 20px;
}

.hamburger-icon span {
  display: block;
  height: 2px;
  background: var(--el-text-color-primary);
  border-radius: 1px;
  transition: all 0.2s ease;
}

/* Mobile nav drawer */
.mobile-nav {
  display: flex;
  flex-direction: column;
  padding: 8px 0;
}

.mobile-nav-brand {
  font-size: 20px;
  font-weight: 700;
  color: var(--el-text-color-primary);
  padding: 16px 24px 24px;
  border-bottom: 1px solid var(--el-border-color-lighter);
  margin-bottom: 8px;
}

.mobile-nav-item {
  display: block;
  padding: 14px 24px;
  font-size: 16px;
  color: var(--el-text-color-regular);
  text-decoration: none;
  border-radius: 0;
  transition:
    background 0.15s,
    color 0.15s;
  cursor: pointer;
  user-select: none;
}

.mobile-nav-item:active {
  background: var(--el-fill-color-light);
}

.mobile-nav-item.active {
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
  font-weight: 600;
}

/* ── Mobile: ≤768px ── */
@media (max-width: 768px) {
  .app-header {
    gap: 12px;
    padding: 0 12px;
  }

  .brand {
    font-size: 16px;
  }

  .desktop-nav {
    display: none !important;
  }

  .mobile-menu-btn {
    display: inline-flex !important;
  }

  .app-main {
    padding: 12px;
  }
}

/* ── Small phones: ≤480px ── */
@media (max-width: 480px) {
  .app-header {
    padding: 0 8px;
    gap: 8px;
  }

  .brand {
    font-size: 15px;
  }

  .app-main {
    padding: 8px;
  }
}
</style>

