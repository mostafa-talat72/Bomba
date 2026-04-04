import InventoryItem from '../models/InventoryItem.js';
import Logger from '../middleware/logger.js';

/**
 * OPTIMIZED: تحديث المخزون باستخدام bulk operations
 * هذا أسرع بكثير من تحديث كل عنصر على حدة
 * التحسين المتوقع: 50-70% أسرع للطلبات الكبيرة
 */
export const bulkUpdateInventory = async (inventoryUpdates, organizationId) => {
    try {
        if (!inventoryUpdates || inventoryUpdates.length === 0) {
            return { success: true, updated: 0 };
        }

        // تجميع التحديثات حسب العنصر
        const updateMap = new Map();
        
        for (const update of inventoryUpdates) {
            const key = update.itemId.toString();
            if (updateMap.has(key)) {
                // جمع الكميات إذا كان هناك تحديثات متعددة لنفس العنصر
                updateMap.get(key).quantityChange += update.quantityChange;
            } else {
                updateMap.set(key, {
                    itemId: update.itemId,
                    quantityChange: update.quantityChange
                });
            }
        }

        // إنشاء bulk operations
        const bulkOps = Array.from(updateMap.values()).map(update => ({
            updateOne: {
                filter: { 
                    _id: update.itemId,
                    organization: organizationId
                },
                update: { 
                    $inc: { quantity: update.quantityChange }
                }
            }
        }));

        // تنفيذ جميع التحديثات دفعة واحدة
        const result = await InventoryItem.bulkWrite(bulkOps, { ordered: false });

        Logger.info(`✓ تم تحديث ${result.modifiedCount} عنصر من المخزون باستخدام bulk operations`);

        return {
            success: true,
            updated: result.modifiedCount,
            matched: result.matchedCount
        };
    } catch (error) {
        Logger.error('خطأ في bulk update للمخزون:', error);
        throw error;
    }
};

/**
 * OPTIMIZED: التحقق من توفر المخزون لعدة عناصر دفعة واحدة
 * بدلاً من استعلام منفصل لكل عنصر
 */
export const bulkCheckInventoryAvailability = async (itemsToCheck, organizationId) => {
    try {
        if (!itemsToCheck || itemsToCheck.length === 0) {
            return { available: true, insufficientItems: [] };
        }

        // جلب جميع عناصر المخزون المطلوبة دفعة واحدة
        const itemIds = itemsToCheck.map(item => item.itemId);
        
        const inventoryItems = await InventoryItem.find({
            _id: { $in: itemIds },
            organization: organizationId
        })
        .select('_id name quantity unit')
        .lean(); // استخدام lean() لتحسين الأداء

        // إنشاء map للوصول السريع
        const inventoryMap = new Map();
        inventoryItems.forEach(item => {
            inventoryMap.set(item._id.toString(), item);
        });

        // التحقق من التوفر
        const insufficientItems = [];
        
        for (const check of itemsToCheck) {
            const inventoryItem = inventoryMap.get(check.itemId.toString());
            
            if (!inventoryItem) {
                insufficientItems.push({
                    itemId: check.itemId,
                    name: check.name || 'Unknown',
                    required: check.quantityNeeded,
                    available: 0,
                    missing: check.quantityNeeded
                });
                continue;
            }

            if (inventoryItem.quantity < check.quantityNeeded) {
                insufficientItems.push({
                    itemId: check.itemId,
                    name: inventoryItem.name,
                    required: check.quantityNeeded,
                    available: inventoryItem.quantity,
                    missing: check.quantityNeeded - inventoryItem.quantity,
                    unit: inventoryItem.unit
                });
            }
        }

        return {
            available: insufficientItems.length === 0,
            insufficientItems
        };
    } catch (error) {
        Logger.error('خطأ في bulk check للمخزون:', error);
        throw error;
    }
};

/**
 * OPTIMIZED: استرجاع المخزون لعدة عناصر دفعة واحدة
 * يستخدم عند إلغاء الطلبات
 */
export const bulkRestoreInventory = async (inventoryUpdates, organizationId) => {
    try {
        if (!inventoryUpdates || inventoryUpdates.length === 0) {
            return { success: true, restored: 0 };
        }

        // عكس التغييرات (إضافة بدلاً من الخصم)
        const restoreOps = inventoryUpdates.map(update => ({
            updateOne: {
                filter: { 
                    _id: update.itemId,
                    organization: organizationId
                },
                update: { 
                    $inc: { quantity: Math.abs(update.quantityChange) } // التأكد من أنها موجبة
                }
            }
        }));

        const result = await InventoryItem.bulkWrite(restoreOps, { ordered: false });

        Logger.info(`✓ تم استرجاع ${result.modifiedCount} عنصر إلى المخزون باستخدام bulk operations`);

        return {
            success: true,
            restored: result.modifiedCount,
            matched: result.matchedCount
        };
    } catch (error) {
        Logger.error('خطأ في bulk restore للمخزون:', error);
        throw error;
    }
};

/**
 * SAFE VERSION: تحديث المخزون مع التحقق من الصحة أولاً
 * يضمن أن جميع العناصر موجودة والكميات كافية قبل التحديث
 */
export const bulkUpdateInventorySafe = async (inventoryUpdates, organizationId) => {
    try {
        if (!inventoryUpdates || inventoryUpdates.length === 0) {
            return { success: true, updated: 0 };
        }

        // 1. جلب جميع العناصر للتحقق
        const itemIds = inventoryUpdates.map(u => u.itemId);
        const items = await InventoryItem.find({
            _id: { $in: itemIds },
            organization: organizationId
        })
        .select('_id name quantity')
        .lean();

        // 2. التحقق من أن جميع العناصر موجودة
        if (items.length !== itemIds.length) {
            const foundIds = new Set(items.map(i => i._id.toString()));
            const missingIds = itemIds.filter(id => !foundIds.has(id.toString()));
            throw new Error(`عناصر غير موجودة: ${missingIds.join(', ')}`);
        }

        // 3. إنشاء map للوصول السريع
        const itemsMap = new Map(items.map(i => [i._id.toString(), i]));

        // 4. التحقق من الكميات
        const insufficientItems = [];
        for (const update of inventoryUpdates) {
            const item = itemsMap.get(update.itemId.toString());
            const newQuantity = item.quantity + update.quantityChange;
            
            if (newQuantity < 0) {
                insufficientItems.push({
                    itemId: update.itemId,
                    name: item.name,
                    currentQuantity: item.quantity,
                    requestedChange: update.quantityChange,
                    shortfall: Math.abs(newQuantity)
                });
            }
        }

        // 5. إذا كانت هناك كميات غير كافية، أرجع خطأ
        if (insufficientItems.length > 0) {
            return {
                success: false,
                error: 'كميات غير كافية',
                insufficientItems
            };
        }

        // 6. إذا كل شيء صحيح، نفذ التحديث
        return await bulkUpdateInventory(inventoryUpdates, organizationId);
    } catch (error) {
        Logger.error('خطأ في bulkUpdateInventorySafe:', error);
        throw error;
    }
};

/**
 * VERSION WITH TRANSACTIONS: تحديث المخزون مع ضمان atomicity
 * يضمن أن جميع التحديثات تنجح أو تفشل معاً
 */
export const bulkUpdateInventoryWithTransaction = async (inventoryUpdates, organizationId) => {
    const mongoose = (await import('mongoose')).default;
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
        if (!inventoryUpdates || inventoryUpdates.length === 0) {
            await session.abortTransaction();
            return { success: true, updated: 0 };
        }

        // تجميع التحديثات
        const updateMap = new Map();
        for (const update of inventoryUpdates) {
            const key = update.itemId.toString();
            if (updateMap.has(key)) {
                updateMap.get(key).quantityChange += update.quantityChange;
            } else {
                updateMap.set(key, {
                    itemId: update.itemId,
                    quantityChange: update.quantityChange
                });
            }
        }

        // إنشاء bulk operations
        const bulkOps = Array.from(updateMap.values()).map(update => ({
            updateOne: {
                filter: { 
                    _id: update.itemId,
                    organization: organizationId
                },
                update: { 
                    $inc: { quantity: update.quantityChange }
                }
            }
        }));

        // تنفيذ مع session
        const result = await InventoryItem.bulkWrite(bulkOps, { 
            session,
            ordered: false 
        });

        // إذا نجحت جميع العمليات، commit
        await session.commitTransaction();
        
        Logger.info(`✓ تم تحديث ${result.modifiedCount} عنصر من المخزون (مع transaction)`);

        return {
            success: true,
            updated: result.modifiedCount,
            matched: result.matchedCount
        };
    } catch (error) {
        // إذا فشلت أي عملية، rollback
        await session.abortTransaction();
        Logger.error('خطأ في transaction للمخزون:', error);
        throw error;
    } finally {
        session.endSession();
    }
};

export default {
    bulkUpdateInventory,
    bulkCheckInventoryAvailability,
    bulkRestoreInventory,
    bulkUpdateInventorySafe,
    bulkUpdateInventoryWithTransaction
};
