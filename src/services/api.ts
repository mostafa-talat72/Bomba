// Facade: preserves the original '../services/api' import path and exports.
export * from './api/types';
export { HEALTH_CHECK_URL, apiClient } from './api/client';
import { authApi } from './api/auth';
import { sessionsApi } from './api/sessions';
import { ordersApi } from './api/orders';
import { inventoryApi } from './api/inventory';
import { warehouseApi } from './api/warehouse';
import { billingApi } from './api/billing';
import { costsApi } from './api/costs';
import { reportsApi } from './api/reports';
import { usersApi } from './api/users';
import { settingsApi } from './api/settings';
import { devicesApi } from './api/devices';
import { menuApi } from './api/menu';
import { tablesApi } from './api/tables';
import { notificationsApi } from './api/notifications';
import { invitesApi } from './api/invites';
import { organizationApi } from './api/organization';
import { printApi } from './api/print';

// Single composed client: one ApiClient instance plus domain APIs.
import { apiClient } from './api/client';
export const api = Object.assign(apiClient,
  authApi,
  sessionsApi,
  ordersApi,
  inventoryApi,
  warehouseApi,
  billingApi,
  costsApi,
  reportsApi,
  usersApi,
  settingsApi,
  devicesApi,
  menuApi,
  tablesApi,
  notificationsApi,
  invitesApi,
  organizationApi,
  printApi,
);

export default api;
