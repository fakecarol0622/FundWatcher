<template>
  <el-card shadow="never" class="page-card">
    <template #header>
      <div class="card-header">Dashboard</div>
    </template>
    <p>Dashboard 页面骨架已就绪，后续在 Step 6 补充估值总览与指数行情。</p>
  </el-card>
</template>

<style scoped>
.page-card {
  min-height: 240px;
}

.card-header {
  font-weight: 600;
}
</style>
<script setup lang="ts">
import { onMounted, onUnmounted } from "vue";
import { debugGetFundEstimate } from "../services/fundDataSource";

declare global {
  interface Window {
    __debugFundEstimate?: typeof debugGetFundEstimate;
  }
}

onMounted(() => {
  if (import.meta.env.DEV) {
    window.__debugFundEstimate = debugGetFundEstimate;
    console.info("[fundDataSource] Run window.__debugFundEstimate('161725') to debug fund estimates.");
  }
});

onUnmounted(() => {
  if (window.__debugFundEstimate === debugGetFundEstimate) {
    delete window.__debugFundEstimate;
  }
});
</script>
