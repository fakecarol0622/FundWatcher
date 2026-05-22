<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

interface NavItem {
  label: string
  path: string
}

const navItems: NavItem[] = [
  { label: 'Dashboard', path: '/' },
  { label: 'Funds', path: '/funds' },
  { label: 'Holdings', path: '/holdings' },
  { label: 'Alerts', path: '/alerts' },
  { label: 'Settings', path: '/settings' }
]

const route = useRoute()
const router = useRouter()

const activeMenu = computed(() => route.path)

const handleMenuSelect = (index: string) => {
  if (index !== route.path) {
    router.push(index)
  }
}
</script>

<template>
  <el-container class="app-layout">
    <el-header class="app-header">
      <div class="brand">Fund Watcher</div>
      <el-menu
        mode="horizontal"
        :default-active="activeMenu"
        :ellipsis="false"
        @select="handleMenuSelect"
      >
        <el-menu-item v-for="item in navItems" :key="item.path" :index="item.path">
          {{ item.label }}
        </el-menu-item>
      </el-menu>
    </el-header>

    <el-main class="app-main">
      <router-view />
    </el-main>
  </el-container>
</template>

<style scoped>
.app-layout {
  min-height: 100vh;
}

.app-header {
  align-items: center;
  border-bottom: 1px solid var(--el-border-color);
  display: flex;
  gap: 24px;
  padding: 0 24px;
}

.brand {
  color: var(--el-text-color-primary);
  font-size: 18px;
  font-weight: 700;
  white-space: nowrap;
}

.app-main {
  background: var(--el-fill-color-light);
  padding: 24px;
}

@media (max-width: 768px) {
  .app-header {
    gap: 12px;
    padding: 0 12px;
  }

  .brand {
    font-size: 16px;
  }

  .app-main {
    padding: 12px;
  }
}
</style>
