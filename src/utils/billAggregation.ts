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
  name: string;
  price: number;
  totalQuantity: number;
  paidQuantity: number;
  remainingQuantity: number;
  addons?: {
    name: string;
    price: number;
  }[];
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
 * Calculates the paid quantity for a specific item based on itemPayments
 * Uses paidQuantity field (new system) with backward compatibility for isPaid (old system)
 * If the bill is fully paid, returns the total quantity
 */
function calculatePaidQuantity(
  itemName: string,
  itemPrice: number,
  addons: { name: string; price: number }[] | undefined,
  orders: Order[],
  itemPayments?: ItemPayment[],
  billStatus?: string,
  billPaid?: number,
  billTotal?: number
): number {
  // If bill is fully paid, all items are paid
  if (billStatus === 'paid' && billPaid && billTotal && billPaid >= billTotal) {
    let totalQty = 0;
    orders.forEach(order => {
      order.items.forEach(item => {
        const itemKey = createItemKey(item.name, item.price, item.addons);
        const targetKey = createItemKey(itemName, itemPrice, addons);
        if (itemKey === targetKey) {
          totalQty += item.quantity;
        }
      });
    });
    return totalQty;
  }

  // Calculate paid quantity from itemPayments
  if (!itemPayments || itemPayments.length === 0) {
    return 0;
  }

  let paidQty = 0;
  itemPayments.forEach(payment => {
    // تنظيف الأسماء من المسافات الزائدة للمقارنة
    const itemNameTrimmed = itemName.trim();
    const paymentNameTrimmed = payment.itemName.trim();
    
    const nameMatch = paymentNameTrimmed === itemNameTrimmed;
    const priceMatch = payment.pricePerUnit === itemPrice;
    
    // TODO: يجب إضافة مقارنة addons هنا أيضاً في المستقبل
    // لكن حالياً itemPayments لا تحتوي على معلومات addons
    
    if (nameMatch && priceMatch) {
      // Use paidQuantity if available (new system)
      if (payment.paidQuantity !== undefined && payment.paidQuantity !== null) {
        paidQty += payment.paidQuantity;
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
 * 
 * Requirements validated:
 * - 6.1: Combines same items from different orders
 * - 6.2: Treats items with different prices as separate
 * - 6.3: Combines items with same addons
 * - 6.4: Distributes payment across orders (via itemPayments)
 * - 6.5: Consistent aggregation across views
 * 
 * @param orders - Array of orders containing items
 * @param itemPayments - Array of item payment records (new system)
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
): AggregatedItem[] {
  if (!orders || !Array.isArray(orders)) {
    return [];
  }

  const itemMap = new Map<string, AggregatedItem>();

  // First pass: aggregate all items by their unique key
  orders.forEach(order => {
    if (!order.items || !Array.isArray(order.items)) {
      return;
    }

    order.items.forEach((item: OrderItem) => {
      const key = createItemKey(item.name, item.price, item.addons);

      if (!itemMap.has(key)) {
        // Create new aggregated item
        itemMap.set(key, {
          name: item.name,
          price: item.price,
          totalQuantity: item.quantity,
          paidQuantity: 0,
          remainingQuantity: item.quantity,
          addons: item.addons ? [...item.addons] : undefined,
        });
      } else {
        // Add to existing aggregated item
        const aggregated = itemMap.get(key)!;
        aggregated.totalQuantity += item.quantity;
        aggregated.remainingQuantity += item.quantity;
      }
    });
  });

  // Second pass: calculate paid quantities for each aggregated item
  itemMap.forEach((aggregated) => {
    const paidQty = calculatePaidQuantity(
      aggregated.name,
      aggregated.price,
      aggregated.addons,
      orders,
      itemPayments,
      billStatus,
      billPaid,
      billTotal
    );

    aggregated.paidQuantity = paidQty;
    aggregated.remainingQuantity = aggregated.totalQuantity - paidQty;
  });

  const result = Array.from(itemMap.values());
  return result;
}
