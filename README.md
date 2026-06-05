# Fund Watcher

Fund Watcher 是一个基于 Vue 3 + TypeScript 的基金工具前端项目。

## 技术栈

- Vite
- Vue 3
- TypeScript
- Pinia
- Vue Router
- Element Plus

## 开发环境

- Node.js 18+
- npm 9+

---

## 本地运行

### 1. 安装依赖

```bash
npm install
```

### 2. 启动开发服务器

```bash
npm run dev
```

默认启动后可在终端输出的本地地址访问（通常是 `http://localhost:5173`）。

### 3. 预览生产构建

```bash
npm run build
npm run preview
```

---

## 构建

```bash
npm run build
```

构建产物位于 `dist/` 目录，为纯静态文件，可部署到任意静态托管服务。

---

## 部署

### GitHub Pages（推荐）

本项目已配置 GitHub Actions 自动部署。

#### 首次设置

1. 在 GitHub 仓库页面，进入 **Settings → Pages**。
2. 在 **Build and deployment** 部分：
   - **Source** 选择 `GitHub Actions`。
3. 将代码推送到 `main` 分支即可触发自动部署：
   ```bash
   git push origin main
   ```
4. 在 **Actions** 标签页可查看部署进度。

#### 部署后访问

部署成功后，访问：

```
https://<你的GitHub用户名>.github.io/FundWatcher/
```

例如：`https://fakecarol0622.github.io/FundWatcher/`

#### 手动触发部署

1. 进入 GitHub 仓库的 **Actions** 标签页。
2. 选择左侧 `Deploy to GitHub Pages` workflow。
3. 点击 **Run workflow** 按钮，选择 `main` 分支，点击确认。

### 其他部署方式

`dist/` 目录下的静态文件也可部署到：

- Vercel
- Cloudflare Pages
- Netlify

---

## 当前实现范围

已完成 Phase 1 MVP 全部步骤，包括项目初始化、自选基金管理、基金估值、指数行情、持仓盈亏、阈值提醒、设置导入导出、GitHub Pages 部署配置。

