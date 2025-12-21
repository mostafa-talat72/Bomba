/**
 * Backend utility for aggregating bill items with payment information
 * Handles all aggregation logic server-side for better performance and accuracy
 */

/**
 * Creates a unique key for an item based on name, price, and addons
 */
function createItemKey(itemName, itemPrice, addons = []) {
    // Sort addons by name and price to ensure consistent keys
    const addonsKey = addons
        .map(addon => `${addon.name}:${addon.price}`)
        .sort()
        .join('|');
    
    return `${itemName}|${itemPrice}|${addonsKey}`;
}

/**
 * Calculates the paid quantity for aggregated items using individual item tracking
 * Each item maintains its own payment status, then we sum for display
 * ENHANCED: Better handling of deleted/modified items
 */
function calculateAggregatedPaidQuantity(
    itemName,
    itemPrice,
    addons,
    allItemIds,
    orders,
    itemPayments = [],
    billStatus,
    billPaid,
    billTotal
) {
    // Only consider bill fully paid if the remaining amount is actually 0
    if (billStatus === 'paid' && billPaid && billTotal && billPaid >= billTotal && (billTotal - billPaid) === 0) {
        // Sum quantities from all matching items that actually exist
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

    // Calculate paid quantity from itemPayments using only valid itemIds
    if (!itemPayments || itemPayments.length === 0) {
        return 0;
    }

    // First, validate which itemIds actually exist in current orders
    const validItemIds = new Set();
    const currentOrderItems = new Map(); // Map itemId -> item details
    
    orders.forEach(order => {
        if (!order.items || !Array.isArray(order.items)) return;
        order.items.forEach((item, index) => {
            const itemId = `${order._id}-${index}`;
            validItemIds.add(itemId);
            currentOrderItems.set(itemId, {
                quantity: item.quantity,
                price: item.price
            });
        });
    });

    let totalPaidQty = 0;
    
    // Calculate paid quantity for each individual item, then sum
    for (const itemId of allItemIds) {
        if (!validItemIds.has(itemId)) continue; // Skip invalid items
        
        // Find payment for this specific item
        const payment = itemPayments.find(p => p.itemId === itemId);
        const currentItem = currentOrderItems.get(itemId);
        
        if (payment) {
            let itemPaidQty = 0;
            
            // Use paidQuantity if available (new system)
            if (payment.paidQuantity !== undefined && payment.paidQuantity !== null) {
                // Ensure paid quantity doesn't exceed current item quantity
                itemPaidQty = currentItem 
                    ? Math.min(payment.paidQuantity, currentItem.quantity)
                    : payment.paidQuantity;
            } 
            // Smart fallback: calculate from paidAmount and pricePerUnit
            else if (payment.paidAmount !== undefined && payment.pricePerUnit && payment.pricePerUnit > 0) {
                const calculatedQty = Math.round(payment.paidAmount / payment.pricePerUnit);
                itemPaidQty = currentItem 
                    ? Math.min(calculatedQty, currentItem.quantity)
                    : calculatedQty;
            }
            // Fallback to isPaid for backward compatibility
            else if (payment.isPaid) {
                itemPaidQty = currentItem 
                    ? Math.min(payment.quantity || 0, currentItem.quantity)
                    : (payment.quantity || 0);
            }
            
            console.log(`📊 Item ${itemId} (${itemName}): paid ${itemPaidQty} of ${currentItem?.quantity || payment.quantity || 0}`);
            totalPaidQty += itemPaidQty;
        } else {
            console.log(`📊 Item ${itemId} (${itemName}): no payment found (unpaid)`);
        }
        // If no payment found for this item, it's unpaid (0)
    }

    console.log(`📊 Total paid for ${itemName}: ${totalPaidQty} of ${allItemIds.length} items`);
    return totalPaidQty;
}

/**
 * Gets all itemIds that belong to a specific aggregated item
 * Only returns itemIds that actually exist in current orders
 */
function getItemIdsForAggregatedItem(aggregatedItemId, orders) {
    if (!orders || !Array.isArray(orders)) {
        return [aggregatedItemId];
    }

    // First, create a set of all valid itemIds in current orders
    const validItemIds = new Set();
    orders.forEach(order => {
        if (!order.items || !Array.isArray(order.items)) return;
        order.items.forEach((item, index) => {
            const itemId = `${order._id}-${index}`;
            validItemIds.add(itemId);
        });
    });

    // Check if the provided aggregatedItemId is valid
    if (!validItemIds.has(aggregatedItemId)) {
        return []; // Item doesn't exist in current orders
    }

    // Find the original item to get its details
    let targetItem = null;

    for (const order of orders) {
        if (!order.items || !Array.isArray(order.items)) continue;
        
        for (let i = 0; i < order.items.length; i++) {
            const currentItemId = `${order._id}-${i}`;
            if (currentItemId === aggregatedItemId) {
                targetItem = order.items[i];
                break;
            }
        }
        if (targetItem) break;
    }

    if (!targetItem) {
        return []; // Item not found
    }

    // Find all items with same name+price+addons that actually exist
    const targetKey = createItemKey(targetItem.name, targetItem.price, targetItem.addons);
    const matchingItemIds = [];

    orders.forEach((order) => {
        if (!order.items || !Array.isArray(order.items)) return;

        order.items.forEach((item, itemIndex) => {
            const itemKey = createItemKey(item.name, item.price, item.addons);
            if (itemKey === targetKey) {
                const itemId = `${order._id}-${itemIndex}`;
                // Only include if it's a valid itemId
                if (validItemIds.has(itemId)) {
                    matchingItemIds.push(itemId);
                }
            }
        });
    });

    return matchingItemIds;
}

/**
 * Main aggregation function - aggregates items from multiple orders with payment information
 * Combines items with same name+price+addons while maintaining ID-based payment tracking
 */
export function aggregateItemsWithPayments(
    orders,
    itemPayments = [],
    billStatus,
    billPaid,
    billTotal
) {
    if (!orders || !Array.isArray(orders)) {
        return [];
    }

    const itemMap = new Map();

    // First pass: aggregate all items by their unique key (name+price+addons)
    orders.forEach((order) => {
        if (!order.items || !Array.isArray(order.items)) {
            return;
        }

        order.items.forEach((item, itemIndex) => {
            const itemId = `${order._id}-${itemIndex}`;
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
                    orderId: order._id.toString(),
                    itemIds: [itemId], // Track all itemIds for this aggregated item
                };
                itemMap.set(key, newItem);
            } else {
                // Add to existing aggregated item
                const aggregated = itemMap.get(key);
                aggregated.totalQuantity += item.quantity;
                aggregated.remainingQuantity += item.quantity;
                aggregated.itemIds.push(itemId);
            }
        });
    });

    // Second pass: calculate paid quantities for each aggregated item
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
 * Expands aggregated items for partial payment
 * Converts user selection to individual itemIds with quantities
 */
export function expandAggregatedItemsForPayment(selectedItems, orders, itemPayments = []) {
    const allItemsToPayFor = [];
    
    selectedItems.forEach(item => {
        // Get all itemIds for this aggregated item
        const matchingItemIds = getItemIdsForAggregatedItem(item.itemId, orders);
        
        // Distribute the requested quantity across all matching items
        let remainingQuantity = item.quantity;
        
        for (const matchingItemId of matchingItemIds) {
            if (remainingQuantity <= 0) break;
            
            // Find the original item to get its available quantity
            let itemQuantityAvailable = 0;
            for (const order of orders) {
                const [orderIdFromItem, itemIndexStr] = matchingItemId.split('-');
                const itemIndex = parseInt(itemIndexStr);
                if (order._id.toString() === orderIdFromItem && order.items[itemIndex]) {
                    itemQuantityAvailable = order.items[itemIndex].quantity;
                    break;
                }
            }
            
            // Calculate already paid quantity for this specific item
            const existingPayment = itemPayments.find(ip => ip.itemId === matchingItemId);
            const alreadyPaid = existingPayment?.paidQuantity || 0;
            const availableForPayment = Math.max(0, itemQuantityAvailable - alreadyPaid);
            
            if (availableForPayment > 0) {
                const quantityToPay = Math.min(remainingQuantity, availableForPayment);
                allItemsToPayFor.push({
                    itemId: matchingItemId,
                    quantity: quantityToPay
                });
                remainingQuantity -= quantityToPay;
            }
        }
    });

    return allItemsToPayFor;
}

export default {
    aggregateItemsWithPayments,
    expandAggregatedItemsForPayment,
    getItemIdsForAggregatedItem
};