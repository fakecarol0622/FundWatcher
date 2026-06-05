import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'dashboard',
    component: () => import('../views/DashboardView.vue')
  },
  {
    path: '/funds',
    name: 'funds',
    component: () => import('../views/FundsView.vue')
  },
  {
    path: '/holdings',
    name: 'holdings',
    component: () => import('../views/HoldingsView.vue')
  },
  {
    path: '/alerts',
    name: 'alerts',
    component: () => import('../views/AlertsView.vue')
  },
  {
    path: '/settings',
    name: 'settings',
    component: () => import('../views/SettingsView.vue')
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/'
  }
]

const router = createRouter({
  history: createWebHistory("/FundWatcher/"),
  routes
})

export default router
