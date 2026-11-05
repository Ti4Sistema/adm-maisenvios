import { createApp } from 'vue';
import { onUnauthorized } from './api/client';
import App from './App.vue';
import { clearSession } from './auth/session';
import { router } from './router';
import './style.css';

onUnauthorized(() => {
  clearSession();
  router.push({
    path: '/login',
    query: { redirect: router.currentRoute.value.fullPath },
  });
});

createApp(App).use(router).mount('#app');
