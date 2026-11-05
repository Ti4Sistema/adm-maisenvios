import { createRouter, createWebHistory } from 'vue-router';
import { PERMISSIONS } from './auth/permissions';
import { can, currentUser, restoreSession } from './auth/session';

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      component: () => import('./pages/LoginPage.vue'),
      meta: { public: true },
    },
    {
      path: '/',
      component: () => import('./layouts/AppLayout.vue'),
      children: [
        { path: '', component: () => import('./pages/HomePage.vue') },
        {
          path: 'usuarios',
          component: () => import('./pages/UsersPage.vue'),
          meta: { permission: PERMISSIONS.USERS_READ },
        },
        {
          path: 'auditoria',
          component: () => import('./pages/AuditPage.vue'),
          meta: { permission: PERMISSIONS.AUDIT_READ },
        },
        { path: 'conta', component: () => import('./pages/AccountPage.vue') },
      ],
    },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
});

router.beforeEach(async (to) => {
  await restoreSession();
  if (to.meta.public) return currentUser.value ? '/' : true;
  if (!currentUser.value) return { path: '/login', query: { redirect: to.fullPath } };
  if (to.meta.permission && !can(to.meta.permission)) return '/';
  return true;
});
