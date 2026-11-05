import 'vue-router';
import type { Permission } from './auth/permissions';

declare module 'vue-router' {
  interface RouteMeta {
    public?: boolean;
    permission?: Permission;
  }
}
