import { useState, useEffect } from 'react';
import { api } from '../services/api';

interface AggregatedItem {
  id: string;
  name: string;
  price: number;
  totalQuantity: number;
  paidQuantity: number;
  remainingQuantity: number;
  addons?: Array<{ name: string; price: number }>;
  hasAddons?: boolean;
  orderId: string;
}

interface UseBillAggregationResult {
  aggregatedItems: AggregatedItem[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Hook for getting aggregated bill items from backend
 * Replaces frontend aggregation logic with server-side processing
 */
export function useBillAggregation(billId: string | null): UseBillAggregationResult {
  const [aggregatedItems, setAggregatedItems] = useState<AggregatedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAggregatedItems = async () => {
    if (!billId) {
      setAggregatedItems([]);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const response = await api.getBillAggregatedItems(billId);
      
      if (response.success && response.data) {
        setAggregatedItems(response.data.aggregatedItems);
      } else {
        setError(response.message || 'فشل في جلب العناصر المجمعة');
        setAggregatedItems([]);
      }
    } catch (err) {
      setError('خطأ في الاتصال بالخادم');
      setAggregatedItems([]);
      console.error('Error fetching aggregated items:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAggregatedItems();
  }, [billId]);

  return {
    aggregatedItems,
    loading,
    error,
    refetch: fetchAggregatedItems
  };
}