import { createRouter, createWebHistory } from 'vue-router';
import { PERMISSIONS } from './auth/permissions';
import { can, currentAdministrator, restoreSession } from './auth/session';

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
        { path: 'pre-cadastros', redirect: '/pre-cadastros/clientes' },
        {
          path: 'pre-cadastros/clientes',
          component: () => import('./pages/RegistrationsPage.vue'),
          props: { type: 'client' },
          meta: { permission: PERMISSIONS.REGISTRATIONS_READ },
        },
        {
          path: 'pre-cadastros/smart',
          component: () => import('./pages/RegistrationsPage.vue'),
          props: { type: 'smart' },
          meta: { permission: PERMISSIONS.REGISTRATIONS_READ },
        },
        {
          path: 'administradores',
          component: () => import('./pages/AdministratorsPage.vue'),
          meta: { permission: PERMISSIONS.ADMINISTRATORS_READ },
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
  if (to.meta.public) return currentAdministrator.value ? '/' : true;
  if (!currentAdministrator.value) return { path: '/login', query: { redirect: to.fullPath } };
  if (to.meta.permission && !can(to.meta.permission)) return '/';
  return true;
});
