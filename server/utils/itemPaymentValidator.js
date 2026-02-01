/**
 * Item Payment Validation Utilities
 * Validates and fixes item payment redistribution issues
 */

import mongoose from 'mongoose';
import Logger from '../middleware/logger.js';

/**
 * Validate item payments consistency
 * @param {Object} bill - Bill document
 * @returns {Object} - Validation result
 */
export function validateItemPayments(bill) {
    const errors = [];
    const warnings = [];
    const fixes = [];

    if (!bill.itemPayments || bill.itemPayments.length === 0) {
        return { isValid: true, errors, warnings, fixes };
    }

    // Check for orphaned item payments (items that don't exist in orders)
    const validItemIds = new Set();
    if (bill.orders && bill.orders.length > 0) {
        bill.orders.forEach(order => {
            if (order.items && order.items.length > 0) {
                order.items.forEach((item, index) => {
                    validItemIds.add(`${order._id}-${index}`);
                });
            }
        });
    }

    // Find orphaned payments
    const orphanedPayments = bill.itemPayments.filter(ip => 
        !validItemIds.has(ip.itemId)
    );

    if (orphanedPayments.length > 0) {
        warnings.push(`Found ${orphanedPayments.length} orphaned item payments`);
        
        // Calculate total orphaned amount
        const totalOrphanedAmount = orphanedPayments.reduce((sum, ip) => 
            sum + (ip.paidAmount || 0), 0
        );

        if (totalOrphanedAmount > 0) {
            errors.push(`Orphaned payments total: ${totalOrphanedAmount} EGP`);
            fixes.push('Consider redistributing orphaned payments to similar items');
        }
    }

    // Check for duplicate item IDs
    const itemIdCounts = new Map();
    bill.itemPayments.forEach(ip => {
        const count = itemIdCounts.get(ip.itemId) || 0;
        itemIdCounts.set(ip.itemId, count + 1);
    });

    const duplicates = Array.from(itemIdCounts.entries())
        .filter(([itemId, count]) => count > 1);

    if (duplicates.length > 0) {
        errors.push(`Found duplicate item payments: ${duplicates.map(([id, count]) => `${id} (${count}x)`).join(', ')}`);
        fixes.push('Remove duplicate item payment entries');
    }

    // Check for negative amounts
    const negativePayments = bill.itemPayments.filter(ip => 
        (ip.paidAmount || 0) < 0 || (ip.paidQuantity || 0) < 0
    );

    if (negativePayments.length > 0) {
        errors.push(`Found ${negativePayments.length} payments with negative amounts`);
        fixes.push('Fix negative payment amounts');
    }

    // Check for overpayments
    const overpayments = bill.itemPayments.filter(ip => {
        const paidQuantity = ip.paidQuantity || 0;
        const totalQuantity = ip.quantity || 0;
        return paidQuantity > totalQuantity;
    });

    if (overpayments.length > 0) {
        warnings.push(`Found ${overpayments.length} overpaid items`);
        fixes.push('Adjust overpaid quantities');
    }

    return {
        isValid: errors.length === 0,
        errors,
        warnings,
        fixes,
        orphanedPayments,
        duplicates,
        negativePayments,
        overpayments
    };
}

/**
 * Fix item payment issues automatically
 * @param {Object} bill - Bill document
 * @returns {Object} - Fix result
 */
export function fixItemPayments(bill) {
    const fixes = [];
    let totalFixed = 0;

    // Remove duplicate payments (keep the one with highest paid amount)
    const itemPaymentMap = new Map();
    bill.itemPayments.forEach(ip => {
        const existing = itemPaymentMap.get(ip.itemId);
        if (!existing || (ip.paidAmount || 0) > (existing.paidAmount || 0)) {
            itemPaymentMap.set(ip.itemId, ip);
        }
    });

    const originalCount = bill.itemPayments.length;
    bill.itemPayments = Array.from(itemPaymentMap.values());
    
    if (bill.itemPayments.length < originalCount) {
        const removedCount = originalCount - bill.itemPayments.length;
        fixes.push(`Removed ${removedCount} duplicate item payments`);
        totalFixed += removedCount;
    }

    // Fix negative amounts
    bill.itemPayments.forEach(ip => {
        if ((ip.paidAmount || 0) < 0) {
            ip.paidAmount = 0;
            fixes.push(`Fixed negative paid amount for item: ${ip.itemName}`);
            totalFixed++;
        }
        
        if ((ip.paidQuantity || 0) < 0) {
            ip.paidQuantity = 0;
            fixes.push(`Fixed negative paid quantity for item: ${ip.itemName}`);
            totalFixed++;
        }
    });

    // Fix overpayments
    bill.itemPayments.forEach(ip => {
        const paidQuantity = ip.paidQuantity || 0;
        const totalQuantity = ip.quantity || 0;
        
        if (paidQuantity > totalQuantity && totalQuantity > 0) {
            ip.paidQuantity = totalQuantity;
            ip.paidAmount = totalQuantity * (ip.pricePerUnit || 0);
            ip.isPaid = true;
            fixes.push(`Fixed overpayment for item: ${ip.itemName}`);
            totalFixed++;
        }
    });

    return {
        totalFixed,
        fixes
    };
}

/**
 * Get redistribution suggestions for orphaned payments
 * @param {Object} bill - Bill document
 * @param {Array} orphanedPayments - List of orphaned payments
 * @returns {Array} - Redistribution suggestions
 */
export function getRedistributionSuggestions(bill, orphanedPayments) {
    const suggestions = [];

    orphanedPayments.forEach(orphaned => {
        // Find similar items that can receive the payment
        const candidates = bill.itemPayments.filter(ip => {
            // Skip if same item
            if (ip.itemId === orphaned.itemId) return false;
            
            // Check if can share payments
            if (orphaned.menuItemId && ip.menuItemId) {
                return orphaned.menuItemId.toString() === ip.menuItemId.toString();
            }
            
            // Fallback: same name and price
            return ip.itemName === orphaned.itemName && 
                   Math.abs((ip.pricePerUnit || 0) - (orphaned.pricePerUnit || 0)) < 0.01;
        });

        if (candidates.length > 0) {
            suggestions.push({
                orphanedPayment: {
                    itemId: orphaned.itemId,
                    itemName: orphaned.itemName,
                    paidAmount: orphaned.paidAmount || 0
                },
                candidates: candidates.map(c => ({
                    itemId: c.itemId,
                    itemName: c.itemName,
                    availableQuantity: (c.quantity || 0) - (c.paidQuantity || 0),
                    canReceiveAmount: ((c.quantity || 0) - (c.paidQuantity || 0)) * (c.pricePerUnit || 0)
                }))
            });
        } else {
            suggestions.push({
                orphanedPayment: {
                    itemId: orphaned.itemId,
                    itemName: orphaned.itemName,
                    paidAmount: orphaned.paidAmount || 0
                },
                recommendation: 'Consider refunding to customer or adding to bill credit'
            });
        }
    });

    return suggestions;
}

/**
 * Log item payment validation results
 * @param {string} billId - Bill ID
 * @param {Object} validation - Validation result
 */
export function logValidationResults(billId, validation) {
    if (!validation.isValid) {
        Logger.warn(`[ItemPaymentValidator] Bill ${billId} has payment issues:`, {
            errors: validation.errors,
            warnings: validation.warnings,
            fixes: validation.fixes
        });
    } else if (validation.warnings.length > 0) {
        Logger.info(`[ItemPaymentValidator] Bill ${billId} has payment warnings:`, {
            warnings: validation.warnings
        });
    } else {
        Logger.debug(`[ItemPaymentValidator] Bill ${billId} item payments are valid`);
    }
}