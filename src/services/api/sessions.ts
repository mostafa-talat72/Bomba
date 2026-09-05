import { apiClient } from './client';
import type { ApiResponse, Bill, Session } from './types';

async function getSessions(params?: { status?: string; device?: string; page?: number; limit?: number; startDate?: string; endDate?: string }): Promise<ApiResponse<Session[]>> {
  const searchParams = new URLSearchParams();
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        searchParams.append(key, value.toString());
      }
    });
  }

  const response = await apiClient.request<Session[]>(`/sessions?${searchParams.toString()}`);
  if (response.success && response.data) {
    response.data = apiClient.normalizeArray(response.data);
  }
  return response;
}


async function getSession(id: string): Promise<ApiResponse<Session>> {
  const response = await apiClient.request<Session>(`/sessions/${id}`);
  if (response.success && response.data) {
    response.data = apiClient.normalizeData(response.data);
  }
  return response;
}


async function createSession(sessionData: {
  deviceType: string;
  deviceNumber: number;
  deviceName: string;
  customerName?: string;
  controllers?: number;
}): Promise<ApiResponse<{ session: Session; bill?: Bill }>> {
  const response = await apiClient.request<{ session: Session; bill?: Bill }>('/sessions', {
    method: 'POST',
    body: JSON.stringify(sessionData),
  });
  if (response.success && response.data) {
    response.data.session = apiClient.normalizeData(response.data.session);
    if (response.data.bill) {
      response.data.bill = apiClient.normalizeData(response.data.bill);
    }
  }
  return response;
}


async function createSessionWithExistingBill(sessionData: {
  deviceType: string;
  deviceNumber: number;
  deviceName: string;
  customerName?: string;
  controllers?: number;
  billId: string;
}): Promise<ApiResponse<{ session: Session; bill?: Bill }>> {
  const response = await apiClient.request<{ session: Session; bill?: Bill }>('/sessions/with-existing-bill', {
    method: 'POST',
    body: JSON.stringify(sessionData),
  });
  if (response.success && response.data) {
    response.data.session = apiClient.normalizeData(response.data.session);
    if (response.data.bill) {
      response.data.bill = apiClient.normalizeData(response.data.bill);
    }
  }
  return response;
}


async function updateSession(id: string, updates: Partial<Session>): Promise<ApiResponse<Session>> {
  const response = await apiClient.request<Session>(`/sessions/${id}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  });
  if (response.success && response.data) {
    response.data = apiClient.normalizeData(response.data);
  }
  return response;
}


async function endSession(id: string, customerName?: string): Promise<ApiResponse<{ session: Session; bill?: any }>> {
  const response = await apiClient.request<{ session: Session; bill?: any }>(`/sessions/${id}/end`, {
    method: 'PUT',
    body: customerName ? JSON.stringify({ customerName }) : undefined,
  });
  if (response.success && response.data) {
    response.data.session = apiClient.normalizeData(response.data.session);
    if (response.data.bill) {
      response.data.bill = apiClient.normalizeData(response.data.bill);
    }
  }
  return response;
}


async function unlinkTableFromSession(sessionId: string, customerName?: string): Promise<ApiResponse<{ session: Session; bill: any; unlinkedFromTable: number }>> {
  const response = await apiClient.request<{ session: Session; bill: any; unlinkedFromTable: number }>(`/sessions/${sessionId}/unlink-table`, {
    method: 'PUT',
    body: customerName ? JSON.stringify({ customerName }) : undefined,
  });
  if (response.success && response.data) {
    response.data.session = apiClient.normalizeData(response.data.session);
    if (response.data.bill) {
      response.data.bill = apiClient.normalizeData(response.data.bill);
    }
  }
  return response;
}


async function linkSessionToTable(sessionId: string, tableId: string): Promise<ApiResponse<{ session: any; bill: any }>> {
  const response = await apiClient.request<{ session: any; bill: any }>(`/sessions/${sessionId}/link-table`, {
    method: 'PUT',
    body: JSON.stringify({ tableId }),
  });
  if (response.success && response.data) {
    if (response.data.session) {
      response.data.session = apiClient.normalizeData(response.data.session);
    }
    if (response.data.bill) {
      response.data.bill = apiClient.normalizeData(response.data.bill);
    }
  }
  return response;
}


async function changeSessionTable(sessionId: string, newTableId: string): Promise<ApiResponse<{ session: any; bill: any; oldTable: string; newTable: string }>> {
  const response = await apiClient.request<{ session: any; bill: any; oldTable: string; newTable: string }>(`/sessions/${sessionId}/change-table`, {
    method: 'PUT',
    body: JSON.stringify({ newTableId }),
  });
  if (response.success && response.data) {
    if (response.data.session) {
      response.data.session = apiClient.normalizeData(response.data.session);
    }
    if (response.data.bill) {
      response.data.bill = apiClient.normalizeData(response.data.bill);
    }
  }
  return response;
}


async function cleanupDuplicateSessionReferences(): Promise<ApiResponse<{ cleanedCount: number }>> {
  return apiClient.request<{ cleanedCount: number }>('/sessions/cleanup-duplicates', {
    method: 'POST',
  });
}


async function getActiveSessions(): Promise<ApiResponse<Session[]>> {
  const response = await apiClient.request<Session[]>('/sessions/status/active');
  if (response.success && response.data) {
    response.data = apiClient.normalizeArray(response.data);
  }
  return response;
}


async function updateSessionControllers(sessionId: string, controllers: number): Promise<ApiResponse<Session>> {
  return apiClient.request<Session>(`/sessions/${sessionId}/controllers`, {
    method: 'PUT',
    body: JSON.stringify({ controllers }),
  });
}


async function updateControllersPeriodTime(sessionId: string, periodIndex: number, newStartTime: string, newEndTime?: string, forceUpdate?: boolean): Promise<ApiResponse<Session>> {
  const body: any = { periodIndex, newStartTime };
  if (newEndTime) {
    body.newEndTime = newEndTime;
  }
  if (forceUpdate) {
    body.forceUpdate = forceUpdate;
  }
  
  return apiClient.request<Session>(`/sessions/${sessionId}/controllers-period-time`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}


async function resolveControllersPeriodConflict(sessionId: string, conflictResolution: {
  periodIndex: number;
  newStartTime: string;
  newEndTime?: string;
  resolutionAction: string;
  actionDetails: any;
}): Promise<ApiResponse<Session>> {
  return apiClient.request<Session>(`/sessions/${sessionId}/resolve-period-conflict`, {
    method: 'PUT',
    body: JSON.stringify(conflictResolution),
  });
}


async function updateSessionCost(sessionId: string): Promise<ApiResponse<{
  sessionId: string;
  currentCost: number;
  totalCost: number;
  billUpdated: boolean;
  duration: number;
}>> {
  return apiClient.request(`/sessions/${sessionId}/update-cost`, {
    method: 'PUT'
  });
}


async function updateSessionCostsBatch(ids: string[]): Promise<ApiResponse<{ requested: number; updated: number; billsRecalculated: number }>> {
  return apiClient.request(`/sessions/update-costs-batch`, {
    method: 'PUT',
    body: JSON.stringify({ ids })
  });
}


async function updateSessionStartTime(sessionId: string, data: { startTime: string }): Promise<ApiResponse<Session>> {
  return apiClient.request<Session>(`/sessions/${sessionId}/start-time`, {
    method: 'PUT',
    body: JSON.stringify(data)
  });
}


async function updateSessionTimes(sessionId: string, data: { startTime: string; endTime: string }): Promise<ApiResponse<Session>> {
  return apiClient.request<Session>(`/sessions/${sessionId}/times`, {
    method: 'PUT',
    body: JSON.stringify(data)
  });
}


export const sessionsApi = {
  getSessions,
  getSession,
  createSession,
  createSessionWithExistingBill,
  updateSession,
  endSession,
  unlinkTableFromSession,
  linkSessionToTable,
  changeSessionTable,
  cleanupDuplicateSessionReferences,
  getActiveSessions,
  updateSessionControllers,
  updateControllersPeriodTime,
  resolveControllersPeriodConflict,
  updateSessionCost,
  updateSessionCostsBatch,
  updateSessionStartTime,
  updateSessionTimes,
};
