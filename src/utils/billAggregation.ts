/**
 * Utility functions for aggregating bill items with payment information
 */

interface OrderItem {
  name: string;
  price: number;
  quantity: number;
  addons?: {
    _id?: string;
    name: string;
    price: number;
  }[];
  addonsTotal?: number;
  additionalPrice?: number;
}

interface Order {
  _id: string;
  orderNumber: string;
  items: OrderItem[];
}

interface ItemPayment {
  orderId: string;
  itemId: string;
  itemName: string;
  quantity: number;
  paidQuantity?: number; // New field for tracking paid quantity
  pricePerUnit: number;
  totalPrice: number;
  paidAmount: number;
  isPaid: boolean; // Kept for backward compatibility
  paidAt?: Date | string;
  paidBy?: string;
  addons?: {
    name: string;
    price: number;
  }[];
}

export interface AggregatedItem {
  id: string; // Unique identifier for the item
  name: string;
  price: number;
  totalQuantity: number;
  paidQuantity: number;
  remainingQuantity: number;
  addons?: {
    name: string;
    price: number;
  }[];
  hasAddons?: boolean; // Helper property for UI
}

/**
 * Creates a unique key for an item based on name, price, and addons
 * Items with the same name and price but different addons are treated as separate items
 * Items with the same addons (regardless of order) are combined
 */
function createItemKey(itemName: string, itemPrice: number, addons?: { name: string; price: number }[]): string {
  // Sort addons by name and price to ensure consistent keys regardless of order
  const addonsKey = (addons || [])
    .map(addon => `${addon.name}:${addon.price}`)
    .sort()
    .join('|');
  
  return `${itemName}|${itemPrice}|${addonsKey}`;
}

/**
 * Calculates the paid quantity for aggregated items using all matching itemIds
 * Sums up payments from all items that match the same name+price+addons
 */
function calculateAggregatedPaidQuantity(
  itemName: string,
  itemPrice: number,
  addons: { name: string; price: number }[] | undefined,
  allItemIds: string[],
  orders: Order[],
  itemPayments?: ItemPayment[],
  billStatus?: string,
  billPaid?: number,
  billTotal?: number
): number {

  // Only consider bill fully paid if the remaining amount is actually 0
  if (billStatus === 'paid' && billPaid && billTotal && billPaid >= billTotal && (billTotal - billPaid) === 0) {
    // Sum quantities from all matching items
    let totalQty = 0;
    for (const itemId of allItemIds) {
      for (const order of orders) {
        for (let i = 0; i < order.items.length; i++) {
          const currentItemId = `${order._id}-${i}`;
          if (currentItemId === itemId) {
            totalQty += order.items[i].quantity;
          }
        }
      }
    }
    return totalQty;
  }

  // Calculate paid quantity from itemPayments using all matching itemIds
  if (!itemPayments || itemPayments.length === 0) {
    return 0;
  }

  let paidQty = 0;
  
  itemPayments.forEach(payment => {
    // Check if this payment belongs to any of our matching items
    if (allItemIds.includes(payment.itemId)) {
      // Use paidQuantity if available (new system)
      if (payment.paidQuantity !== undefined && payment.paidQuantity !== null) {
        paidQty += payment.paidQuantity;
      } 
      // Smart fallback: calculate from paidAmount and pricePerUnit if paidQuantity is not available
      else if (payment.paidAmount !== undefined && payment.pricePerUnit && payment.pricePerUnit > 0) {
        const calculatedQuantity = Math.round(payment.paidAmount / payment.pricePerUnit);
        paidQty += calculatedQuantity;
      }
      // Fallback to isPaid for backward compatibility (old system)
      else if (payment.isPaid) {
        paidQty += payment.quantity;
      }
    }
  });

  return paidQty;
}


/**
 * Aggregates items from multiple orders with payment information
 * Combines items with same name+price+addons while maintaining ID-based payment tracking
 * 
 * @param orders - Array of orders containing items
 * @param itemPayments - Array of item payment records (ID-based system)
 * @param billStatus - Current bill status
 * @param billPaid - Amount paid on bill
 * @param billTotal - Total bill amount
 * @returns Array of aggregated items with payment information
 */
export function aggregateItemsWithPayments(
  orders: Order[],
  itemPayments?: ItemPayment[],
  billStatus?: string,
  billPaid?: number,
  billTotal?: number
): (AggregatedItem & { orderId?: string })[] {
  
  if (!orders || !Array.isArray(orders)) {
    return [];
  }

  const itemMap = new Map<string, AggregatedItem & { orderId?: string; itemIds: string[] }>();

  // First pass: aggregate all items by their unique key (name+price+addons)
  orders.forEach((order) => {
    if (!order.items || !Array.isArray(order.items)) {
      return;
    }

    order.items.forEach((item: OrderItem, itemIndex) => {
      const itemId = `${order._id}-${itemIndex}`; // Backend expected format
      const key = createItemKey(item.name, item.price, item.addons);

      if (!itemMap.has(key)) {
        // Create new aggregated item
        const newItem = {
          id: itemId, // Use first itemId as representative
          name: item.name,
          price: item.price,
          totalQuantity: item.quantity,
          paidQuantity: 0, // Will be calculated later
          remainingQuantity: item.quantity,
          addons: item.addons ? [...item.addons] : undefined,
          hasAddons: !!(item.addons && item.addons.length > 0),
          orderId: order._id,
          itemIds: [itemId], // Track all itemIds for this aggregated item
        };
        itemMap.set(key, newItem);
      } else {
        // Add to existing aggregated item
        const aggregated = itemMap.get(key)!;
        aggregated.totalQuantity += item.quantity;
        aggregated.remainingQuantity += item.quantity;
        aggregated.itemIds.push(itemId); // Add this itemId to the list
        // Keep the first orderId for backend compatibility
      }
    });
  });

  // Second pass: calculate paid quantities for each aggregated item using all its itemIds
  itemMap.forEach((aggregated) => {
    const paidQty = calculateAggregatedPaidQuantity(
      aggregated.name,
      aggregated.price,
      aggregated.addons,
      aggregated.itemIds,
      orders,
      itemPayments,
      billStatus,
      billPaid,
      billTotal
    );

    aggregated.paidQuantity = paidQty;
    aggregated.remainingQuantity = Math.max(0, aggregated.totalQuantity - paidQty);
  });

  // Convert to final result format (remove itemIds from output)
  const result = Array.from(itemMap.values()).map(item => {
    const { itemIds, ...finalItem } = item;
    return finalItem;
  });

  return result;
}

/**
 * Gets all itemIds that belong to a specific aggregated item
 * Used by PartialPaymentModal to know which individual items to pay for
 */
export function getItemIdsForAggregatedItem(
  aggregatedItemId: string,
  orders: Order[]
): string[] {
  if (!orders || !Array.isArray(orders)) {
    return [aggregatedItemId]; // Fallback to single item
  }

  // Find the original item to get its details
  let targetItem: OrderItem | null = null;
  let targetOrderId = '';
  let targetItemIndex = -1;

  for (const order of orders) {
    if (!order.items || !Array.isArray(order.items)) continue;
    
    for (let i = 0; i < order.items.length; i++) {
      const currentItemId = `${order._id}-${i}`;
      if (currentItemId === aggregatedItemId) {
        targetItem = order.items[i];
        targetOrderId = order._id;
        targetItemIndex = i;
        break;
      }
    }
    if (targetItem) break;
  }

  if (!targetItem) {
    return [aggregatedItemId]; // Fallback
  }

  // Find all items with same name+price+addons
  const targetKey = createItemKey(targetItem.name, targetItem.price, targetItem.addons);
  const matchingItemIds: string[] = [];

  orders.forEach((order) => {
    if (!order.items || !Array.isArray(order.items)) return;

    order.items.forEach((item: OrderItem, itemIndex) => {
      const itemKey = createItemKey(item.name, item.price, item.addons);
      if (itemKey === targetKey) {
        const itemId = `${order._id}-${itemIndex}`;
        matchingItemIds.push(itemId);
      }
    });
  });

  return matchingItemIds;
}