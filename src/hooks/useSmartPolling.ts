import { useEffect, useRef, useCallback } from 'react';

interface UseSmartPollingOptions {
  fetchFunction: () => Promise<void>;
  hasActivity: boolean;
  interval?: number;
  enabled?: boolean;
}

/**
 * Custom hook for smart polling that adjusts based on activity
 * - Polls at specified interval (default 10 seconds) when there's activity
 * - Stops polling when there's no activity
 * - Ensures proper cleanup on unmount
 */
export const useSmartPolling = ({
  fetchFunction,
  hasActivity,
  interval = 10000, // Default 10 seconds
  enabled = true
}: UseSmartPollingOptions) => {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isMountedRef = useRef(true);

  // Memoize the fetch function to prevent unnecessary re-renders
  const stableFetchFunction = useCallback(async () => {
    if (!isMountedRef.current) return;
    
    try {
      await fetchFunction();
    } catch (error) {
      // Silently handle errors to prevent polling from stopping
      }
  }, [fetchFunction]);

  useEffect(() => {
    isMountedRef.current = true;

    // Clear any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // Only start polling if enabled and there's activity
    if (enabled && hasActivity) {
      // Initial fetch
      stableFetchFunction();

      // Set up interval for subsequent fetches
      intervalRef.current = setInterval(stableFetchFunction, interval);
    }

    // Cleanup function
    return () => {
      isMountedRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, hasActivity, interval, stableFetchFunction]);

  // Return a manual trigger function if needed
  const trigger = useCallback(() => {
    if (isMountedRef.current) {
      stableFetchFunction();
    }
  }, [stableFetchFunction]);

  return { trigger };
};
