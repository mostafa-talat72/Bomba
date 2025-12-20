import { useEffect, useRef } from 'react';
import api from '../services/api';

/**
 * Custom hook to update session costs in real-time
 * Updates costs every minute for active sessions
 */
export const useSessionCostUpdater = (
  activeSessions: Array<{ id: string; status: string }>,
  onCostUpdate?: (sessionId: string, cost: number) => void
) => {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Clear any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    // Only set up interval if there are active sessions
    if (activeSessions.length === 0) {
      return;
    }

    // Function to update all active session costs
    const updateAllCosts = async () => {
      for (const session of activeSessions) {
        if (session.status === 'active') {
          try {
            const response = await api.updateSessionCost(session.id);
            if (response.success && response.data && onCostUpdate) {
              onCostUpdate(session.id, response.data.currentCost);
            }
          } catch (error) {
            }
        }
      }
    };

    // Update immediately on mount
    updateAllCosts();

    // Set up interval to update every minute (60000ms)
    intervalRef.current = setInterval(updateAllCosts, 60000);

    // Cleanup on unmount or when dependencies change
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [activeSessions.length]); // Only re-run when number of active sessions changes

  return null;
};
