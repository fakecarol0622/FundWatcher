import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

// https://vitejs.dev/config/
export default defineConfig({
  // GitHub Pages 子路径：仓库名为 FundWatcher
  // 部署后访问：https://<username>.github.io/FundWatcher/
  base: "/FundWatcher/",
  plugins: [vue()],
});

