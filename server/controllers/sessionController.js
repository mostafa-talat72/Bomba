import mongoose from "mongoose";
import Session from "../models/Session.js";
import Device from "../models/Device.js";
import Bill from "../models/Bill.js";
import Table from "../models/Table.js";
import Organization from "../models/Organization.js";
import Logger from "../middleware/logger.js";
import NotificationService from "../services/notificationService.js";
import dualDatabaseManager from "../config/dualDatabaseManager.js";
import { getUserLocale, getUserLanguage } from "../utils/localeHelper.js";
import { getCustomerNameForDevice, getTableName, getSessionBillNote, getNewSessionBillNote, t } from "../utils/translations.js";

/**
 * Helper function to translate text based on user language
 * @param {string} key - Translation key
 * @param {Object} user - User object with language preference
 * @returns {string} Translated text
 */
const translate = (key, user) => {
    const language = getUserLanguage(user);
    return t(key, language);
};

/**
 * حذف فاتورة من كلا القاعدتين (Local + Atlas)
 * يمنع المزامنة من إعادة إدراج الفاتورة المحذوفة
 */
const deleteBillFromBothDatabases = async (billId) => {
    try {
        Logger.info(`🗑️ Deleting bill from both databases: ${billId}`);
        
        const atlasConnection = dualDatabaseManager.getAtlasConnection();
        
        // حذف من Local
        const localResult = await Bill.deleteOne({ _id: billId });
        Logger.info(`✓ Deleted from Local: ${localResult.deletedCount} bill(s)`);
        
        // حذف من Atlas مباشرة
        if (atlasConnection) {
            try {
                const atlasBillsCollection = atlasConnection.collection('bills');
                const atlasResult = await atlasBillsCollection.deleteOne({ 
                    _id: new mongoose.Types.ObjectId(billId)
                });
                Logger.info(`✓ Deleted from Atlas: ${atlasResult.deletedCount} bill(s)`);
            } catch (atlasError) {
                Logger.error(`❌ Failed to delete bill from Atlas:`, atlasError);
            }
        } else {
            Logger.warn(`⚠️ Atlas connection not available - bill will be synced for deletion later`);
        }
        
        return { success: true };
    } catch (error) {
        Logger.error(`❌ Error deleting bill from both databases:`, error);
        return { success: false, error };
    }
};

// Helper function to fix sessionPayment data before transfer to avoid validation errors
const fixSessionPaymentData = (sessionPayment) => {
    const fixed = {
        ...sessionPayment.toObject ? sessionPayment.toObject() : sessionPayment
    };
    
    // التأكد من أن remainingAmount لا يكون سالباً
    if (fixed.remainingAmount < 0) {
        Logger.warn(`⚠️ Fixing negative remainingAmount for session ${fixed.sessionId}: ${fixed.remainingAmount} -> 0`);
        fixed.remainingAmount = 0;
    }
    
    // التأكد من أن paidAmount لا يتجاوز sessionCost
    if (fixed.paidAmount > fixed.sessionCost) {
        Logger.warn(`⚠️ Fixing paidAmount exceeding sessionCost for session ${fixed.sessionId}: ${fixed.paidAmount} -> ${fixed.sessionCost}`);
        fixed.paidAmount = fixed.sessionCost;
        fixed.remainingAmount = 0;
    }
    
    // إعادة حساب remainingAmount للتأكد من الصحة
    fixed.remainingAmount = Math.max(0, fixed.sessionCost - fixed.paidAmount);
    
    return fixed;
};

// Helper function to perform cleanup - defined outside the controller object
const performCleanupHelper = async (organizationId) => {
    // Ensure organizationId is a string/ObjectId, not a populated object
    const orgId = organizationId?._id ? organizationId._id : organizationId;
    
    Logger.info("🧹 Starting automatic cleanup of duplicate session references...");
    
    // Get all sessions for this organization, sorted from newest to oldest
    const sessions = await Session.find({ organization: orgId }).sort({ createdAt: -1 });
    let cleanedCount = 0;
    let deletedBillsCount = 0;
    
    Logger.info(`📊 Found ${sessions.length} sessions to check (processing from newest to oldest)`);
    
    for (const session of sessions) {
        if (!session.bill) {
            Logger.info(`⚠️ Session ${session._id} (${session.status}) has no bill reference, skipping`);
            continue;
        }
        
        // Handle both populated bill object and ObjectId reference
        const correctBillId = session.bill?._id ? session.bill._id.toString() : session.bill.toString();
        Logger.info(`🔍 Checking session ${session._id} (${session.status}) - should be in bill ${correctBillId}`);
        
        // Find ALL bills that contain this session in their sessions array
        // Use $in to match ObjectId properly
        const billsWithSession = await Bill.find({
            sessions: { $in: [session._id] },
            organization: orgId
        });
        
        Logger.info(`📋 Session ${session._id} found in ${billsWithSession.length} bills: ${billsWithSession.map(b => b.billNumber).join(', ')}`);
        
        // Remove session from any bill that is NOT the correct bill
        for (const bill of billsWithSession) {
            Logger.info(`🔎 Checking bill ${bill.billNumber} (${bill._id}) - ${bill._id.toString() === correctBillId ? 'CORRECT' : 'INCORRECT'}`);
            
            if (bill._id.toString() !== correctBillId) {
                Logger.info(`❌ REMOVING: Session ${session._id} from incorrect bill ${bill.billNumber}`);
                
                // Remove session from this incorrect bill
                const originalLength = bill.sessions.length;
                const sessionIdStr = session._id.toString();
                
                bill.sessions = bill.sessions.filter(s => {
                    const sIdStr = s._id ? s._id.toString() : s.toString();
                    const shouldKeep = sIdStr !== sessionIdStr;
                    if (!shouldKeep) {
                        Logger.info(`🗑️ Removing session ${sIdStr} from bill ${bill.billNumber}`);
                    }
                    return shouldKeep;
                });
                
                Logger.info(`📝 Bill ${bill.billNumber}: sessions reduced from ${originalLength} to ${bill.sessions.length}`);
                
                if (originalLength !== bill.sessions.length) {
                    await bill.calculateSubtotal();
                    await bill.save();
                    cleanedCount++;
                    Logger.info(`✅ Successfully cleaned bill ${bill.billNumber}`);
                    
                    // If bill is now empty (no sessions and no orders), try to merge it
                    if (bill.sessions.length === 0 && bill.orders.length === 0) {
                        Logger.info(`🔄 Bill ${bill.billNumber} is now empty, attempting to merge...`);
                        
                        // Look for another unpaid bill to merge with
                        let targetBillForMerge = null;
                        
                        // First, try to find a bill on the same table (if empty bill had a table)
                        if (bill.table) {
                            targetBillForMerge = await Bill.findOne({
                                _id: { $ne: bill._id }, // Not the same bill
                                table: bill.table,
                                organization: organizationId,
                                status: { $in: ['draft', 'partial', 'overdue'] }
                            }).sort({ createdAt: -1 });
                        }
                        
                        // If no bill on same table, find any unpaid bill
                        if (!targetBillForMerge) {
                            targetBillForMerge = await Bill.findOne({
                                _id: { $ne: bill._id }, // Not the same bill
                                organization: organizationId,
                                status: { $in: ['draft', 'partial', 'overdue'] }
                            }).sort({ createdAt: -1 });
                        }
                        
                        try {
                            if (targetBillForMerge) {
                                // Merge the empty bill with the target bill
                                Logger.info(`🔗 Merging empty bill ${bill.billNumber} with ${targetBillForMerge.billNumber}`);
                                
                                // Add merge information to target bill notes
                                const currentNotes = targetBillForMerge.notes || '';
                                const userLanguage = getUserLanguage(req.user);
                                targetBillForMerge.notes = currentNotes + `\n[${t('mergedEmptyBill', userLanguage)} ${bill.billNumber}]`;
                                
                                // Update target bill
                                await targetBillForMerge.calculateSubtotal();
                                await targetBillForMerge.save();
                                
                                Logger.info(`✅ Successfully merged empty bill ${bill.billNumber} with ${targetBillForMerge.billNumber}`);
                            } else {
                                Logger.info(`ℹ️ No suitable bill found for merge, deleting empty bill ${bill.billNumber}`);
                            }
                            
                            // Delete the empty bill
                            await bill.deleteOne();
                            deletedBillsCount++;
                            Logger.info(`✅ Successfully processed empty bill ${bill.billNumber}`);
                            
                        } catch (mergeError) {
                            Logger.error(`❌ Failed to merge/delete empty bill ${bill.billNumber}:`, mergeError);
                        }
                    }
                } else {
                    Logger.warn(`⚠️ No changes made to bill ${bill.billNumber} - session might not have been found`);
                }
            } else {
                Logger.info(`✅ CORRECT: Session ${session._id} belongs in bill ${bill.billNumber}`);
            }
        }
        
        // Double check: make sure session is in the correct bill
        const correctBill = await Bill.findById(correctBillId);
        if (correctBill) {
            const sessionInCorrectBill = correctBill.sessions.some(s => {
                const sIdStr = s._id ? s._id.toString() : s.toString();
                return sIdStr === session._id.toString();
            });
            
            if (!sessionInCorrectBill) {
                Logger.info(`🔧 Adding session ${session._id} to correct bill ${correctBill.billNumber}`);
                correctBill.sessions.push(session._id);
                await correctBill.calculateSubtotal();
                await correctBill.save();
                cleanedCount++;
            }
        }
    }
    
    Logger.info(`🧹 Automatic cleanup completed. Fixed ${cleanedCount} duplicates, deleted ${deletedBillsCount} empty bills.`);
    
    return { cleanedCount, deletedBillsCount };
};

/**
 * Selective cleanup - only cleans up specific sessions and their related bills
 * Much faster than full cleanup for single operations
 * @param {Array<String>} sessionIds - Array of session IDs to clean up
 * @param {String} organizationId - Organization ID
 * @returns {Object} - Cleanup results
 */
const performSelectiveCleanup = async (sessionIds, organizationId) => {
    // Ensure organizationId is a string/ObjectId, not a populated object
    const orgId = organizationId?._id ? organizationId._id : organizationId;
    
    // Ensure sessionIds is an array
    const sessionIdsArray = Array.isArray(sessionIds) ? sessionIds : [sessionIds];
    
    Logger.info(`🎯 Starting selective cleanup for ${sessionIdsArray.length} session(s)...`);
    
    let cleanedCount = 0;
    let deletedBillsCount = 0;
    const affectedBillIds = new Set();
    
    for (const sessionId of sessionIdsArray) {
        try {
            // Get the session
            const session = await Session.findById(sessionId);
            
            if (!session) {
                Logger.warn(`⚠️ Session ${sessionId} not found, skipping`);
                continue;
            }
            
            if (!session.bill) {
                Logger.info(`⚠️ Session ${sessionId} has no bill reference, skipping`);
                continue;
            }
            
            // Handle both populated bill object and ObjectId reference
            const correctBillId = session.bill?._id ? session.bill._id.toString() : session.bill.toString();
            Logger.info(`🔍 Cleaning session ${session._id} - should be in bill ${correctBillId}`);
            
            // Find ALL bills that contain this session
            const billsWithSession = await Bill.find({
                sessions: { $in: [session._id] },
                organization: orgId
            });
            
            Logger.info(`📋 Session ${session._id} found in ${billsWithSession.length} bill(s)`);
            
            // Track affected bills
            billsWithSession.forEach(bill => affectedBillIds.add(bill._id.toString()));
            
            // Remove session from any bill that is NOT the correct bill
            for (const bill of billsWithSession) {
                if (bill._id.toString() !== correctBillId) {
                    Logger.info(`❌ Removing session from incorrect bill ${bill.billNumber}`);
                    
                    const originalLength = bill.sessions.length;
                    const sessionIdStr = session._id.toString();
                    
                    bill.sessions = bill.sessions.filter(s => {
                        const sIdStr = s._id ? s._id.toString() : s.toString();
                        return sIdStr !== sessionIdStr;
                    });
                    
                    if (originalLength !== bill.sessions.length) {
                        await bill.calculateSubtotal();
                        await bill.save();
                        cleanedCount++;
                        
                        // Check if bill is now empty
                        if (bill.sessions.length === 0 && bill.orders.length === 0) {
                            Logger.info(`🔄 Bill ${bill.billNumber} is now empty, deleting...`);
                            
                            try {
                                await bill.deleteOne();
                                deletedBillsCount++;
                                affectedBillIds.delete(bill._id.toString());
                                Logger.info(`✅ Deleted empty bill ${bill.billNumber}`);
                            } catch (deleteError) {
                                Logger.error(`❌ Failed to delete empty bill ${bill.billNumber}:`, deleteError);
                            }
                        }
                    }
                }
            }
            
            // Ensure session is in the correct bill
            const correctBill = await Bill.findById(correctBillId);
            if (correctBill) {
                const sessionInCorrectBill = correctBill.sessions.some(s => {
                    const sIdStr = s._id ? s._id.toString() : s.toString();
                    return sIdStr === session._id.toString();
                });
                
                if (!sessionInCorrectBill) {
                    Logger.info(`🔧 Adding session to correct bill ${correctBill.billNumber}`);
                    correctBill.sessions.push(session._id);
                    await correctBill.calculateSubtotal();
                    await correctBill.save();
                    cleanedCount++;
                }
                
                affectedBillIds.add(correctBill._id.toString());
            }
            
        } catch (error) {
            Logger.error(`❌ Error cleaning session ${sessionId}:`, error);
        }
    }
    
    Logger.info(`🎯 Selective cleanup completed. Fixed ${cleanedCount} issues, deleted ${deletedBillsCount} empty bills, affected ${affectedBillIds.size} bill(s).`);
    
    return { 
        cleanedCount, 
        deletedBillsCount,
        affectedBillsCount: affectedBillIds.size
    };
};

// دالة تحليل التداخلات وإعطاء خيارات للمستخدم
const analyzeTimeConflicts = (controllersHistory, editingIndex, newStartTime, newEndTime) => {
    const conflicts = {
        hasConflicts: false,
        conflictType: null,
        affectedPeriods: [],
        suggestedActions: [],
        warningMessage: "",
        detailedAnalysis: {}
    };

    const editingPeriod = controllersHistory[editingIndex];
    const isActivePeriod = !editingPeriod.to;

    // تحليل التداخل مع الفترات السابقة
    for (let i = 0; i < editingIndex; i++) {
        const previousPeriod = controllersHistory[i];
        const prevStart = new Date(previousPeriod.from);
        const prevEnd = previousPeriod.to ? new Date(previousPeriod.to) : null;

        // إذا كان وقت البداية الجديد قبل نهاية فترة سابقة
        if (prevEnd && newStartTime < prevEnd) {
            conflicts.hasConflicts = true;
            conflicts.conflictType = 'OVERLAPS_PREVIOUS';
            
            const overlapDuration = Math.round((prevEnd - newStartTime) / (1000 * 60)); // بالدقائق
            
            conflicts.affectedPeriods.push({
                index: i,
                controllers: previousPeriod.controllers,
                originalStart: prevStart,
                originalEnd: prevEnd,
                overlapMinutes: overlapDuration
            });

            // اقتراح خيارات للحل
            conflicts.suggestedActions.push({
                action: 'TRUNCATE_PREVIOUS',
                description: `قص الفترة ${i + 1} (${previousPeriod.controllers} أذرع) لتنتهي عند ${newStartTime.toLocaleTimeString()}`,
                lostTime: overlapDuration,
                affectedPeriodIndex: i
            });

            conflicts.suggestedActions.push({
                action: 'MERGE_PERIODS',
                description: `دمج الفترة ${i + 1} مع الفترة ${editingIndex + 1} باستخدام عدد الأذرع الأكبر`,
                mergeDetails: {
                    fromIndex: i,
                    toIndex: editingIndex,
                    suggestedControllers: Math.max(previousPeriod.controllers, editingPeriod.controllers)
                }
            });
        }
    }

    // تحليل التداخل مع الفترات التالية (للفترات المنتهية فقط)
    if (!isActivePeriod && newEndTime) {
        for (let i = editingIndex + 1; i < controllersHistory.length; i++) {
            const nextPeriod = controllersHistory[i];
            const nextStart = new Date(nextPeriod.from);
            const nextEnd = nextPeriod.to ? new Date(nextPeriod.to) : null;

            // إذا كان وقت النهاية الجديد بعد بداية فترة تالية
            if (newEndTime > nextStart) {
                conflicts.hasConflicts = true;
                conflicts.conflictType = conflicts.conflictType ? 'MULTIPLE_OVERLAPS' : 'OVERLAPS_NEXT';
                
                const overlapDuration = nextEnd ? 
                    Math.round((Math.min(newEndTime, nextEnd) - nextStart) / (1000 * 60)) :
                    Math.round((newEndTime - nextStart) / (1000 * 60));
                
                conflicts.affectedPeriods.push({
                    index: i,
                    controllers: nextPeriod.controllers,
                    originalStart: nextStart,
                    originalEnd: nextEnd,
                    overlapMinutes: overlapDuration
                });

                // اقتراح خيارات للحل
                conflicts.suggestedActions.push({
                    action: 'TRUNCATE_NEXT',
                    description: `قص الفترة ${i + 1} (${nextPeriod.controllers} أذرع) لتبدأ من ${newEndTime.toLocaleTimeString()}`,
                    lostTime: overlapDuration,
                    affectedPeriodIndex: i
                });

                conflicts.suggestedActions.push({
                    action: 'EXTEND_CURRENT',
                    description: `تمديد الفترة الحالية وحذف الفترة ${i + 1}`,
                    deletedPeriodIndex: i
                });
            }
        }
    }

    // إنشاء رسالة تحذيرية مفصلة
    if (conflicts.hasConflicts) {
        const totalLostMinutes = conflicts.affectedPeriods.reduce((sum, period) => sum + period.overlapMinutes, 0);
        conflicts.warningMessage = `⚠️ التعديل المطلوب سيؤثر على ${conflicts.affectedPeriods.length} فترة أخرى وقد يؤدي لفقدان ${totalLostMinutes} دقيقة من الوقت المحسوب.`;
        
        conflicts.detailedAnalysis = {
            totalAffectedPeriods: conflicts.affectedPeriods.length,
            totalLostMinutes: totalLostMinutes,
            estimatedRevenueLoss: calculateRevenueLoss(conflicts.affectedPeriods),
            recommendedAction: getRecommendedAction(conflicts.suggestedActions)
        };
    }

    return conflicts;
};

// حساب الخسارة المتوقعة في الإيرادات
const calculateRevenueLoss = (affectedPeriods) => {
    // أسعار افتراضية - يمكن تحسينها لاحقاً لتأتي من إعدادات النظام
    const rates = { 1: 20, 2: 20, 3: 25, 4: 30 };
    
    return affectedPeriods.reduce((total, period) => {
        const hourlyRate = rates[period.controllers] || 20;
        const lostRevenue = (period.overlapMinutes / 60) * hourlyRate;
        return total + lostRevenue;
    }, 0);
};

// اقتراح أفضل إجراء
const getRecommendedAction = (actions) => {
    if (actions.length === 0) return null;
    
    // ترتيب الأولوية: قص الفترات > الدمج > الحذف
    const priority = ['TRUNCATE_PREVIOUS', 'TRUNCATE_NEXT', 'MERGE_PERIODS', 'EXTEND_CURRENT'];
    
    for (const actionType of priority) {
        const action = actions.find(a => a.action === actionType);
        if (action) return action;
    }
    
    return actions[0];
};

const sessionController = {
    // Get all sessions
    getSessions: async (req, res) => {
        try {
            const { status, deviceType, page = 1, limit = 10, startDate, endDate } = req.query;

            const query = {};
            if (status) query.status = status;
            if (deviceType) query.deviceType = deviceType;
            query.organization = req.user.organization;
            
            // Add date filtering if provided
            if (startDate || endDate) {
                query.endTime = {};
                if (startDate) {
                    const startDateTime = new Date(startDate);
                    query.endTime.$gte = startDateTime;
                    Logger.info('📅 Session date filter - start:', {
                        received: startDate,
                        parsed: startDateTime.toISOString(),
                        local: startDateTime.toLocaleString(getUserLocale(req.user), { timeZone: 'Africa/Cairo' })
                    });
                }
                if (endDate) {
                    const endDateTime = new Date(endDate);
                    query.endTime.$lte = endDateTime;
                    Logger.info('📅 Session date filter - end:', {
                        received: endDate,
                        parsed: endDateTime.toISOString(),
                        local: endDateTime.toLocaleString(getUserLocale(req.user), { timeZone: 'Africa/Cairo' })
                    });
                }
            }

            const sessions = await Session.find(query)
                .populate("createdBy", "name")
                .populate("updatedBy", "name")
                .populate({
                    path: "bill",
                    populate: {
                        path: "table",
                        select: "number name"
                    }
                })
                .sort({ startTime: -1 })
                .limit(limit * 1)
                .skip((page - 1) * limit);

            const total = await Session.countDocuments(query);

            res.json({
                success: true,
                count: sessions.length,
                total,
                data: sessions,
            });
        } catch (err) {
            Logger.error("getSessions error:", err);
            res.status(500).json({
                success: false,
                message: "خطأ في جلب الجلسات",
                error: err.message,
            });
        }
    },

    // Get single session
    getSession: async (req, res) => {
        try {
            const session = await Session.findOne({
                _id: req.params.id,
                organization: req.user.organization,
            })
                .populate("createdBy", "name")
                .populate("updatedBy", "name");

            if (!session) {
                return res.status(404).json({
                    success: false,
                    message: "الجلسة غير موجودة",
                    error: "Session not found",
                });
            }

            res.json({
                success: true,
                data: session,
            });
        } catch (err) {
            Logger.error("getSession error:", err);
            res.status(500).json({
                success: false,
                message: "خطأ في جلب الجلسة",
                error: err.message,
            });
        }
    },

    // Create new session
    createSession: async (req, res) => {
        try {
            const {
                deviceNumber,
                deviceName,
                deviceType,
                deviceId,
                customerName,
                controllers,
                table,
            } = req.body;

            // Validate required fields
            if (!deviceNumber || !deviceName || !deviceType || !deviceId) {
                return res.status(400).json({
                    success: false,
                    message: "رقم الجهاز واسمه ونوعه ومعرف الجهاز مطلوبان",
                    error: "الحقول المطلوبة ناقصة",
                });
            }

            // Check if device is already in use
            const existingSession = await Session.findOne({
                deviceId: deviceId,
                status: "active",
            });

            if (existingSession) {
                return res.status(400).json({
                    success: false,
                    message: "الجهاز مستخدم حالياً",
                    error: "Device is already in use",
                });
            }

            // Create new session
            // اسم العميل دائماً "عميل (اسم الجهاز)"
            const userLanguage = getUserLanguage(req.user);
            const session = new Session({
                deviceNumber,
                deviceName,
                deviceId,
                deviceType,
                table: table || null,
                customerName: `${t('customer', userLanguage)} (${deviceName})`,
                controllers: controllers || 1,
                createdBy: req.user._id,
                organization: req.user.organization,
            });

            // البحث عن فاتورة موجودة للطاولة أو إنشاء فاتورة جديدة
            let bill = null;
            try {
                // تحديد نوع الفاتورة واسم العميل
                let billType = "cafe";
                let customerNameForBill;
                let tableName = deviceName;

                if (deviceType === "playstation") {
                    billType = "playstation";
                } else if (deviceType === "computer") {
                    billType = "computer";
                }

                // إذا كان هناك table، ابحث عن فاتورة موجودة غير مدفوعة
                let tableNumber = null;
                if (table) {
                    // Get table info for logging and customer name
                    const tableDoc = await Table.findById(table);
                    tableNumber = tableDoc ? tableDoc.number : table;
                    
                    // إذا كانت الجلسة مرتبطة بطاولة، اسم العميل يكون اسم الطاولة
                    customerNameForBill = getTableName(tableNumber, userLanguage);
                    tableName = getTableName(tableNumber, userLanguage);
                    
                    // البحث عن فاتورة موجودة للطاولة (غير مدفوعة بالكامل)
                    const existingBill = await Bill.findOne({
                        table: table,
                        organization: req.user.organization,
                        status: { $in: ['draft', 'partial', 'overdue'] }
                    }).sort({ createdAt: -1 }); // أحدث فاتورة

                    if (existingBill) {
                        bill = existingBill;
                        Logger.info(`✓ تم العثور على فاتورة موجودة للطاولة ${tableNumber} - سيتم ربط الجلسة بها:`, {
                            billId: bill._id,
                            billNumber: bill.billNumber,
                            billType: bill.billType,
                            status: bill.status,
                            existingOrders: bill.orders?.length || 0,
                            existingSessions: bill.sessions?.length || 0
                        });
                    } else {
                        Logger.info(`ℹ️ لم يتم العثور على فاتورة موجودة للطاولة ${tableNumber} - سيتم إنشاء فاتورة جديدة`);
                    }
                } else {
                    // إذا لم تكن مرتبطة بطاولة، اسم العميل يكون عميل + نوع الجهاز
                    customerNameForBill = getCustomerNameForDevice(deviceType, deviceName, userLanguage);
                }

                // إذا لم يتم العثور على فاتورة، أنشئ فاتورة جديدة
                if (!bill) {
                    const billData = {
                        customerName: customerNameForBill,
                        sessions: [], // سنضيف الجلسة بعد حفظها
                        subtotal: 0, // سيتم تحديثه عند إنهاء الجلسة
                        total: 0, // سيتم تحديثه عند إنهاء الجلسة
                        discount: 0,
                        tax: 0,
                        notes: getNewSessionBillNote(tableName, deviceType, tableNumber, userLanguage),
                        billType: billType,
                        status: "draft", // فاتورة مسودة حتى تنتهي الجلسة
                        createdBy: req.user._id,
                        organization: req.user.organization,
                    };

                    // إضافة table فقط إذا تم تحديده صراحة
                    if (table) {
                        billData.table = table;
                    }

                    bill = await Bill.create(billData);
                    Logger.info(`✓ تم إنشاء فاتورة جديدة للجلسة:`, {
                        billId: bill._id,
                        billNumber: bill.billNumber,
                        billType: bill.billType,
                        tableNumber: tableNumber
                    });
                }

                // Link session to bill
                session.bill = bill._id;
                Logger.info(`🔗 ربط الجلسة بالفاتورة:`, {
                    sessionId: session._id,
                    billId: bill._id,
                    billNumber: bill.billNumber
                });

                // Save session with bill reference
                await session.save();
                await session.populate(["createdBy", "bill"], "name");

                // Add session to bill (تأكد من عدم التكرار)
                if (!bill.sessions.includes(session._id)) {
                    bill.sessions.push(session._id);
                    Logger.info(`✓ تمت إضافة الجلسة إلى الفاتورة ${bill.billNumber}`);
                } else {
                    Logger.info(`ℹ️ الجلسة موجودة بالفعل في الفاتورة ${bill.billNumber}`);
                }
                await bill.save();
                await bill.populate(["sessions", "createdBy"], "name");

                // Create notification for session start
                try {
                    // Get user language and organization currency
                    const userLanguage = req.user.preferences?.language || 'ar';
                    const organization = await Organization.findById(req.user.organization).select('currency');
                    const currency = organization?.currency || 'EGP';
                    
                    await NotificationService.createSessionNotification(
                        "started",
                        session,
                        req.user._id,
                        userLanguage,
                        currency
                    );
                } catch (notificationError) {
                    Logger.error(
                        "Failed to create session start notification:",
                        notificationError
                    );
                }

                // Verify the link was created successfully
                if (!session.bill) {
                    Logger.error("❌ Session bill reference not set properly");
                }
            } catch (billError) {
                Logger.error("❌ خطأ في إنشاء الفاتورة التلقائية:", billError);
                // Save session without bill if bill creation fails
                await session.save();
                await session.populate("createdBy", "name");
            }

            // Update device status to active
            await Device.findOneAndUpdate(
                { _id: deviceId },
                { status: "active" }
            );

            res.status(201).json({
                success: true,
                message: "تم بدء الجلسة وإنشاء الفاتورة بنجاح",
                data: {
                    session,
                    bill: bill
                        ? {
                              id: bill._id,
                              billNumber: bill.billNumber,
                              customerName: bill.customerName,
                              status: bill.status,
                              billType: bill.billType,
                          }
                        : null,
                },
            });
        } catch (err) {
            Logger.error("createSession error:", err);
            res.status(400).json({
                success: false,
                message: "خطأ في إنشاء الجلسة",
                error: err.message,
            });
        }
    },

    // Update controllers during session
    updateControllers: async (req, res) => {
        try {
            const { sessionId } = req.params;
            const { controllers } = req.body;

            if (!controllers || controllers < 1 || controllers > 4) {
                return res.status(400).json({
                    success: false,
                    message: "عدد الدراعات يجب أن يكون بين 1 و 4",
                    error: "Invalid controllers count",
                });
            }

            const session = await Session.findOne({
                _id: sessionId,
                organization: req.user.organization,
            });

            if (!session) {
                return res.status(404).json({
                    success: false,
                    message: "الجلسة غير موجودة",
                    error: "Session not found",
                });
            }

            if (session.status !== "active") {
                return res.status(400).json({
                    success: false,
                    message: "لا يمكن تعديل عدد الدراعات في جلسة غير نشطة",
                    error: "Session is not active",
                });
            }

            // Update controllers using the method (this updates controllersHistory)
            session.updateControllers(controllers);
            session.updatedBy = req.user._id;

            // Save the session with updated controllersHistory
            await session.save();
            await session.populate(["createdBy", "updatedBy"], "name");

            // Log the controllersHistory for debugging
            Logger.info(`Controllers updated for session ${sessionId}:`, {
                newControllers: controllers,
                historyLength: session.controllersHistory.length,
                latestPeriod: session.controllersHistory[session.controllersHistory.length - 1]
            });

            res.json({
                success: true,
                message: "تم تحديث عدد الدراعات بنجاح",
                data: session,
            });
        } catch (err) {
            Logger.error("updateControllers error:", err);
            res.status(400).json({
                success: false,
                message: "خطأ في تحديث عدد الدراعات",
                error: err.message,
            });
        }
    },

    // Update controllers period start time
    updateControllersPeriodTime: async (req, res) => {
        try {
            const { sessionId } = req.params;
            const { periodIndex, newStartTime, newEndTime, forceUpdate } = req.body;

            if (periodIndex === undefined || periodIndex < 0) {
                return res.status(400).json({
                    success: false,
                    message: "فهرس الفترة غير صحيح",
                    error: "Invalid period index",
                });
            }

            if (!newStartTime) {
                return res.status(400).json({
                    success: false,
                    message: "وقت البداية الجديد مطلوب",
                    error: "New start time is required",
                });
            }

            const session = await Session.findOne({
                _id: sessionId,
                organization: req.user.organization,
            });

            if (!session) {
                return res.status(404).json({
                    success: false,
                    message: "الجلسة غير موجودة",
                    error: "Session not found",
                });
            }

            if (!session.controllersHistory || session.controllersHistory.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: "لا يوجد تاريخ للدراعات في هذه الجلسة",
                    error: "No controllers history found",
                });
            }

            if (periodIndex >= session.controllersHistory.length) {
                return res.status(400).json({
                    success: false,
                    message: "فهرس الفترة غير موجود",
                    error: "Period index out of range",
                });
            }

            const newStartDate = new Date(newStartTime);
            const sessionStartTime = new Date(session.startTime);
            const currentTime = new Date();

            // التحقق من أن الوقت الجديد ليس في المستقبل
            if (newStartDate > currentTime) {
                return res.status(400).json({
                    success: false,
                    message: "لا يمكن تعديل الوقت إلى المستقبل",
                    error: "Cannot set time in the future",
                });
            }

            // التحقق من أن الوقت الجديد ليس قبل بداية الجلسة
            if (newStartDate < sessionStartTime) {
                return res.status(400).json({
                    success: false,
                    message: "لا يمكن تعديل الوقت إلى ما قبل بداية الجلسة",
                    error: "Cannot set time before session start",
                });
            }

            const targetPeriod = session.controllersHistory[periodIndex];
            const isActivePeriod = !targetPeriod.to; // الفترة النشطة ليس لها وقت نهاية

            // إذا لم يكن forceUpdate، تحليل التداخلات المحتملة وإعطاء خيارات للمستخدم
            if (!forceUpdate) {
                const conflictAnalysis = analyzeTimeConflicts(session.controllersHistory, periodIndex, newStartDate, newEndTime ? new Date(newEndTime) : null);
                
                if (conflictAnalysis.hasConflicts) {
                    return res.status(409).json({
                        success: false,
                        message: "يوجد تداخل مع فترات أخرى",
                        error: "Time conflicts detected",
                        conflictDetails: conflictAnalysis,
                        requiresUserChoice: true
                    });
                }
            } else {
                Logger.info(`Force update enabled - skipping conflict analysis for session ${sessionId}, period ${periodIndex}`);
            }

            // تحديث وقت بداية الفترة المحددة
            session.controllersHistory[periodIndex].from = newStartDate;

            // تحديث وقت نهاية الفترة السابقة تلقائياً (إن وجدت)
            if (periodIndex > 0) {
                session.controllersHistory[periodIndex - 1].to = newStartDate;
                Logger.info(`Auto-updated previous period end time to: ${newStartDate}`);
            }

            // إذا كانت فترة منتهية (غير نشطة) ووقت النهاية مُعطى
            if (!isActivePeriod && newEndTime) {
                const newEndDate = new Date(newEndTime);

                // التحقق من أن وقت النهاية بعد وقت البداية
                if (newEndDate <= newStartDate) {
                    return res.status(400).json({
                        success: false,
                        message: "وقت النهاية يجب أن يكون بعد وقت البداية",
                        error: "End time must be after start time",
                    });
                }

                // التحقق من أن وقت النهاية ليس في المستقبل
                if (newEndDate > currentTime) {
                    return res.status(400).json({
                        success: false,
                        message: "لا يمكن تعديل وقت النهاية إلى المستقبل",
                        error: "Cannot set end time in the future",
                    });
                }

                // تحديث وقت نهاية الفترة
                session.controllersHistory[periodIndex].to = newEndDate;

                // تحديث وقت بداية الفترة التالية تلقائياً (إن وجدت)
                if (periodIndex < session.controllersHistory.length - 1) {
                    session.controllersHistory[periodIndex + 1].from = newEndDate;
                    Logger.info(`Auto-updated next period start time to: ${newEndDate}`);
                }
            }

            // إذا كانت هذه الفترة الأولى، تحديث وقت بداية الجلسة أيضاً
            if (periodIndex === 0) {
                session.startTime = newStartDate;
                Logger.info(`Updated session start time to: ${newStartDate}`);
            }

            session.updatedBy = req.user._id;
            await session.save();
            await session.populate(["createdBy", "updatedBy"], "name");

            Logger.info(`Controllers period time updated for session ${sessionId}:`, {
                periodIndex,
                newStartTime: newStartDate,
                newEndTime: newEndTime ? new Date(newEndTime) : null,
                isActivePeriod,
                forceUpdate,
                updatedPeriod: session.controllersHistory[periodIndex]
            });

            res.json({
                success: true,
                message: "تم تحديث وقت فترة الدراعات بنجاح",
                data: session,
            });
        } catch (err) {
            Logger.error("updateControllersPeriodTime error:", err);
            res.status(400).json({
                success: false,
                message: "خطأ في تحديث وقت فترة الدراعات",
                error: err.message,
            });
        }
    },

    // حل التداخلات مع اختيار المستخدم
    resolveControllersPeriodConflict: async (req, res) => {
        try {
            const { sessionId } = req.params;
            const { periodIndex, newStartTime, newEndTime, resolutionAction, actionDetails } = req.body;

            const session = await Session.findOne({
                _id: sessionId,
                organization: req.user.organization,
            });

            if (!session) {
                return res.status(404).json({
                    success: false,
                    message: "الجلسة غير موجودة",
                    error: "Session not found",
                });
            }

            const newStartDate = new Date(newStartTime);
            const newEndDate = newEndTime ? new Date(newEndTime) : null;

            // تطبيق الحل المختار
            switch (resolutionAction) {
                case 'TRUNCATE_PREVIOUS':
                    // قص الفترة السابقة
                    const prevIndex = actionDetails.affectedPeriodIndex;
                    session.controllersHistory[prevIndex].to = newStartDate;
                    Logger.info(`Truncated previous period ${prevIndex} to end at: ${newStartDate}`);
                    break;

                case 'TRUNCATE_NEXT':
                    // قص الفترة التالية
                    const nextIndex = actionDetails.affectedPeriodIndex;
                    session.controllersHistory[nextIndex].from = newEndDate;
                    Logger.info(`Truncated next period ${nextIndex} to start at: ${newEndDate}`);
                    break;

                case 'MERGE_PERIODS':
                    // دمج الفترات
                    const mergeFrom = actionDetails.mergeDetails.fromIndex;
                    const mergeTo = actionDetails.mergeDetails.toIndex;
                    const mergedControllers = actionDetails.mergeDetails.suggestedControllers;
                    
                    // تحديث الفترة الأولى لتشمل النطاق الكامل
                    session.controllersHistory[mergeFrom].to = newEndDate || session.controllersHistory[mergeTo].to;
                    session.controllersHistory[mergeFrom].controllers = mergedControllers;
                    
                    // حذف الفترات المدموجة
                    session.controllersHistory.splice(mergeFrom + 1, mergeTo - mergeFrom);
                    Logger.info(`Merged periods ${mergeFrom} to ${mergeTo} with ${mergedControllers} controllers`);
                    break;

                case 'EXTEND_CURRENT':
                    // تمديد الفترة الحالية وحذف التالية
                    const deleteIndex = actionDetails.deletedPeriodIndex;
                    const deletedPeriod = session.controllersHistory[deleteIndex];
                    
                    // تمديد الفترة الحالية لتشمل الفترة المحذوفة
                    session.controllersHistory[periodIndex].to = deletedPeriod.to;
                    
                    // حذف الفترة التالية
                    session.controllersHistory.splice(deleteIndex, 1);
                    Logger.info(`Extended current period and deleted period ${deleteIndex}`);
                    break;

                case 'FORCE_UPDATE':
                    // تحديث قسري مع تجاهل التداخلات (خيار متقدم)
                    Logger.warn(`Force update applied - potential data loss accepted by user`);
                    break;

                default:
                    return res.status(400).json({
                        success: false,
                        message: "نوع الحل غير مدعوم",
                        error: "Unsupported resolution action",
                    });
            }

            // تطبيق التعديل الأساسي
            session.controllersHistory[periodIndex].from = newStartDate;
            if (newEndDate) {
                session.controllersHistory[periodIndex].to = newEndDate;
            }

            // تحديث وقت بداية الجلسة إذا كانت الفترة الأولى
            if (periodIndex === 0) {
                session.startTime = newStartDate;
            }

            session.updatedBy = req.user._id;
            await session.save();
            await session.populate(["createdBy", "updatedBy"], "name");

            Logger.info(`Controllers period conflict resolved for session ${sessionId}:`, {
                periodIndex,
                resolutionAction,
                newStartTime: newStartDate,
                newEndTime: newEndDate
            });

            res.json({
                success: true,
                message: "تم حل التداخل وتحديث أوقات الفترات بنجاح",
                data: session,
                appliedResolution: resolutionAction
            });

        } catch (err) {
            Logger.error("resolveControllersPeriodConflict error:", err);
            res.status(400).json({
                success: false,
                message: "خطأ في حل تداخل أوقات الفترات",
                error: err.message,
            });
        }
    },

    // Update session cost in real-time
    updateSessionCost: async (req, res) => {
        try {
            const { id } = req.params;

            const session = await Session.findOne({
                _id: id,
                organization: req.user.organization,
            }).populate("bill");

            if (!session) {
                return res.status(404).json({
                    success: false,
                    message: "الجلسة غير موجودة",
                    error: "Session not found",
                });
            }

            if (session.status !== "active") {
                return res.status(400).json({
                    success: false,
                    message: "لا يمكن تحديث تكلفة جلسة غير نشطة",
                    error: "Session is not active",
                });
            }

            // حساب التكلفة الحالية باستخدام calculateCurrentCost
            const currentCost = await session.calculateCurrentCost();
            
            // تحديث totalCost و finalCost بدون حفظ (للعرض فقط)
            session.totalCost = currentCost;
            session.finalCost = currentCost - (session.discount || 0);

            // تحديث الفاتورة المرتبطة إذا وجدت
            let billUpdated = false;
            if (session.bill) {
                try {
                    const bill = await Bill.findById(session.bill);
                    if (bill) {
                        await bill.calculateSubtotal();
                        await bill.save();
                        billUpdated = true;
                    }
                } catch (billError) {
                    Logger.error("❌ Error updating bill:", billError);
                }
            }

            res.json({
                success: true,
                message: "تم تحديث تكلفة الجلسة بنجاح",
                data: {
                    sessionId: session._id,
                    currentCost: session.finalCost,
                    totalCost: session.totalCost,
                    billUpdated: billUpdated,
                    duration: session.startTime
                        ? Math.floor(
                              (new Date() - new Date(session.startTime)) /
                                  (1000 * 60)
                          )
                        : 0,
                    controllersHistory: session.controllersHistory,
                },
            });
        } catch (err) {
            Logger.error("❌ updateSessionCost error:", err);
            res.status(500).json({
                success: false,
                message: "خطأ في تحديث تكلفة الجلسة",
                error: err.message,
            });
        }
    },

    // End session
    endSession: async (req, res) => {
        try {
            const { id } = req.params;
            const { customerName } = req.body;

            const session = await Session.findOne({
                _id: id,
                organization: req.user.organization,
            }).populate("bill");

            if (!session) {
                Logger.error("❌ Session not found:", id);
                return res.status(404).json({
                    success: false,
                    message: "الجلسة غير موجودة",
                    error: "Session not found",
                });
            }

            if (session.status !== "active") {
                return res.status(400).json({
                    success: false,
                    message: "الجلسة غير نشطة",
                    error: "Session is not active",
                });
            }

            // Check if session is linked to a table
            const bill = session.bill;
            const isLinkedToTable = bill && bill.table;

            // If not linked to table and no customer name provided, require it
            if (!isLinkedToTable && (!customerName || customerName.trim() === '')) {
                return res.status(400).json({
                    success: false,
                    message: t('customerNameRequiredForNonTable', getUserLanguage(req.user)),
                    error: 'Customer name required'
                });
            }

            // Update customer name if provided
            if (customerName && customerName.trim() !== "") {
                session.customerName = customerName.trim();
            }

            // End session using the method
            Logger.info('🔍 Before endSession:', {
                sessionId: session._id,
                totalCost: session.totalCost,
                finalCost: session.finalCost
            });
            
            await session.endSession();
            
            Logger.info('🔍 After endSession:', {
                sessionId: session._id,
                totalCost: session.totalCost,
                finalCost: session.finalCost
            });
            
            session.updatedBy = req.user._id;

            await session.save();
            
            Logger.info('🔍 After save:', {
                sessionId: session._id,
                totalCost: session.totalCost,
                finalCost: session.finalCost
            });
            
            // Reload session to get updated data
            const updatedSession = await Session.findById(session._id).populate(["createdBy", "updatedBy", "bill"], "name");
            if (!updatedSession) {
                Logger.error("❌ Failed to reload session after save");
                return res.status(500).json({
                    success: false,
                    message: "خطأ في تحديث الجلسة",
                    error: "Failed to reload session",
                });
            }

            // Create notification for session end
            try {
                // Get user language and organization currency
                const userLanguage = req.user.preferences?.language || 'ar';
                const organization = await Organization.findById(req.user.organization).select('currency');
                const currency = organization?.currency || 'EGP';
                
                await NotificationService.createSessionNotification(
                    "ended",
                    session,
                    req.user._id,
                    userLanguage,
                    currency
                );
            } catch (notificationError) {
                Logger.error(
                    "Failed to create session end notification:",
                    notificationError
                );
            }

            // Update device status to available
            await Device.findOneAndUpdate(
                { _id: session.deviceId },
                { status: "available" }
            );

            // Update existing bill with final cost OR create new bill if missing
            let updatedBill = null;
            if (updatedSession.bill) {
                try {
                    updatedBill = await Bill.findById(updatedSession.bill);
                    if (updatedBill) {
                        // تحديد اسم العميل فقط إذا لم تكن الفاتورة مرتبطة بطاولة
                        if (!updatedBill.table) {
                            const userLanguage = getUserLanguage(req.user);
                            const deviceType = updatedSession.deviceType;
                            const deviceNumber = updatedSession.deviceNumber;
                            const custName = updatedSession.customerName;
                            let customerNameForBill = "";
                            
                            if (deviceType === "playstation") {
                                if (!custName || custName.trim() === "") {
                                    customerNameForBill = `${t('playstationCustomer', userLanguage)} PS${deviceNumber}`;
                                } else {
                                    customerNameForBill = `${custName.trim()} PS${deviceNumber}`;
                                }
                            } else if (deviceType === "computer") {
                                if (!custName || custName.trim() === "") {
                                    customerNameForBill = `${t('computerCustomer', userLanguage)} PC${deviceNumber}`;
                                } else {
                                    customerNameForBill = `${custName.trim()} PC${deviceNumber}`;
                                }
                            } else {
                                if (!custName || custName.trim() === "") {
                                    customerNameForBill = t('customer', userLanguage);
                                } else {
                                    customerNameForBill = custName.trim();
                                }
                            }
                            
                            Logger.info(`✓ Updating bill customer name (not linked to table): ${customerNameForBill}`);
                            updatedBill.customerName = customerNameForBill;
                        } else {
                            Logger.info(`✓ Bill is linked to table ${updatedBill.table}, keeping existing customer name: ${updatedBill.customerName}`);
                        }
                        updatedBill.subtotal = updatedSession.finalCost || 0;
                        updatedBill.total = updatedSession.finalCost || 0;
                        updatedBill.discount = updatedSession.discount || 0;
                        updatedBill.status = "partial"; // تغيير الحالة من draft إلى partial
                        updatedBill.updatedBy = req.user._id;

                        await updatedBill.save();
                        await updatedBill.calculateSubtotal();
                        await updatedBill.populate(["sessions", "createdBy"], "name");

                        Logger.info(`✓ Bill updated successfully: ${updatedBill.billNumber}, Customer: ${updatedBill.customerName}`);
                    } else {
                        Logger.error(
                            "❌ Bill not found for session:",
                            updatedSession.bill
                        );
                    }
                } catch (billError) {
                    Logger.error("❌ خطأ في تحديث الفاتورة:", billError);
                    // Continue with session ending even if bill update fails
                }
            } else {
                // إنشاء فاتورة جديدة للجلسة إذا لم تكن موجودة
                Logger.warn(
                    "⚠️ No bill reference found in session, creating new bill:",
                    updatedSession._id
                );
                
                try {
                    // تحديد اسم العميل (هذا الجزء للفواتير الجديدة فقط - غير مرتبطة بطاولة)
                    const userLanguage = getUserLanguage(req.user);
                    const deviceType = updatedSession.deviceType;
                    const deviceNumber = updatedSession.deviceNumber;
                    const custName = updatedSession.customerName;
                    let customerNameForBill = "";
                    
                    if (deviceType === "playstation") {
                        if (!custName || custName.trim() === "") {
                            customerNameForBill = `${t('playstationCustomer', userLanguage)} PS${deviceNumber}`;
                        } else {
                            customerNameForBill = `${custName.trim()} PS${deviceNumber}`;
                        }
                    } else if (deviceType === "computer") {
                        if (!custName || custName.trim() === "") {
                            customerNameForBill = `${t('computerCustomer', userLanguage)} PC${deviceNumber}`;
                        } else {
                            customerNameForBill = `${custName.trim()} PC${deviceNumber}`;
                        }
                    } else {
                        if (!custName || custName.trim() === "") {
                            customerNameForBill = t('customer', userLanguage);
                        } else {
                            customerNameForBill = custName.trim();
                        }
                    }

                    Logger.info(`✓ Creating new bill (not linked to table) with customer name: ${customerNameForBill}`);

                    // إنشاء الفاتورة
                    const billData = {
                        customerName: customerNameForBill,
                        sessions: [updatedSession._id],
                        subtotal: updatedSession.finalCost || 0,
                        total: updatedSession.finalCost || 0,
                        discount: updatedSession.discount || 0,
                        tax: 0,
                        notes: getNewSessionBillNote(updatedSession.deviceName, deviceType, null, userLanguage),
                        billType: deviceType === "playstation" ? "playstation" : deviceType === "computer" ? "computer" : "cafe",
                        status: "partial",
                        createdBy: req.user._id,
                        organization: req.user.organization,
                    };

                    updatedBill = await Bill.create(billData);
                    
                    // ربط الفاتورة بالجلسة
                    updatedSession.bill = updatedBill._id;
                    await updatedSession.save();
                    
                    await updatedBill.populate(["sessions", "createdBy"], "name");
                    
                    Logger.info("✅ Created new bill for session:", {
                        sessionId: updatedSession._id,
                        billId: updatedBill._id,
                        billNumber: updatedBill.billNumber,
                        customerName: updatedBill.customerName,
                    });
                } catch (createBillError) {
                    Logger.error("❌ خطأ في إنشاء الفاتورة:", createBillError);
                    // Continue with session ending even if bill creation fails
                }
            }

            res.json({
                success: true,
                message: "تم إنهاء الجلسة وتحديث الفاتورة بنجاح",
                data: {
                    session: updatedSession,
                    bill: updatedBill
                        ? {
                              id: updatedBill._id,
                              billNumber: updatedBill.billNumber,
                              customerName: updatedBill.customerName,
                              total: updatedBill.total,
                              status: updatedBill.status,
                          }
                        : null,
                },
            });
        } catch (err) {
            Logger.error("❌ endSession error:", err);
            res.status(400).json({
                success: false,
                message: "خطأ في إنهاء الجلسة",
                error: err.message,
            });
        }
    },

    // Create new session with existing bill
    createSessionWithExistingBill: async (req, res) => {
        try {
            const {
                deviceNumber,
                deviceName,
                deviceType,
                deviceId,
                customerName,
                controllers,
                billId,
                table,
            } = req.body;

            // Validate required fields
            if (
                !deviceNumber ||
                !deviceName ||
                !deviceType ||
                !deviceId ||
                !billId
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "رقم الجهاز واسمه ونوعه ومعرف الجهاز ومعرف الفاتورة مطلوبان",
                    error: "الحقول المطلوبة ناقصة",
                });
            }

            // Check if device is already in use
            const existingSession = await Session.findOne({
                deviceId: deviceId,
                status: "active",
            });

            if (existingSession) {
                return res.status(400).json({
                    success: false,
                    message: "الجهاز مستخدم حالياً",
                    error: "Device is already in use",
                });
            }

            // Check if bill exists and is not paid/cancelled
            const bill = await Bill.findById(billId);
            if (!bill) {
                return res.status(404).json({
                    success: false,
                    message: "الفاتورة غير موجودة",
                    error: "Bill not found",
                });
            }

            if (bill.status === "paid" || bill.status === "cancelled") {
                return res.status(400).json({
                    success: false,
                    message: "لا يمكن ربط جلسة بفاتورة مدفوعة أو ملغية",
                    error: "Cannot link session to paid or cancelled bill",
                });
            }

            // السماح بإضافة جلسات متعددة على نفس الفاتورة
            // (عدة أجهزة بلايستيشن على نفس الطاولة يمكن أن تكون لها نفس الفاتورة)

            // Create new session
            const session = new Session({
                deviceNumber,
                deviceName,
                deviceId,
                deviceType,
                table: table || null,
                customerName: customerName ? customerName.trim() : "",
                controllers: controllers || 1,
                createdBy: req.user._id,
                bill: billId, // Link to existing bill
                organization: req.user.organization,
            });

            // Save session
            await session.save();
            await session.populate(["createdBy", "bill"], "name");

            // Add session to bill without updating customer name
            bill.sessions.push(session._id);

            // تحديث table في الفاتورة إذا تم توفيره
            const updateData = {
                $addToSet: { sessions: session._id },
            };

            // إذا تم توفير table ولم تكن الفاتورة مرتبطة بطاولة، قم بتحديثها
            if (table && !bill.table) {
                updateData.table = table;
            }

            // Save bill without modifying customer name
            await Bill.findByIdAndUpdate(bill._id, updateData, { new: true });
            await bill.populate(["sessions", "createdBy"], "name");

            // إرسال إشعار بدء الجلسة
            try {
                // Get user language and organization currency
                const userLanguage = req.user.preferences?.language || 'ar';
                const organization = await Organization.findById(req.user.organization).select('currency');
                const currency = organization?.currency || 'EGP';
                
                await NotificationService.createSessionNotification(
                    "started",
                    session,
                    req.user._id,
                    userLanguage,
                    currency
                );
            } catch (notificationError) {
                Logger.error(
                    "Failed to create session start notification:",
                    notificationError
                );
            }

            // Update device status to active
            await Device.findOneAndUpdate(
                { _id: deviceId },
                { status: "active" }
            );

            res.status(201).json({
                success: true,
                message: "تم بدء الجلسة وربطها بالفاتورة بنجاح",
                data: {
                    session,
                    bill: {
                        id: bill._id,
                        billNumber: bill.billNumber,
                        customerName: bill.customerName,
                        status: bill.status,
                        billType: bill.billType,
                    },
                },
            });
        } catch (err) {
            Logger.error("createSessionWithExistingBill error:", err);
            res.status(400).json({
                success: false,
                message: "خطأ في إنشاء الجلسة",
                error: err.message,
            });
        }
    },

    // Get active sessions
    getActiveSessions: async (req, res) => {
        try {
            const sessions = await Session.find({
                status: "active",
                organization: req.user.organization,
            })
                .populate("createdBy", "name")
                .populate({
                    path: "bill",
                    select: "billNumber customerName total status billType table",
                    populate: {
                        path: "table",
                        select: "number name"
                    }
                })
                .sort({ startTime: -1 });

            res.json({
                success: true,
                count: sessions.length,
                data: sessions,
            });
        } catch (err) {
            Logger.error("getActiveSessions error:", err);
            res.status(500).json({
                success: false,
                message: "خطأ في جلب الجلسات النشطة",
                error: err.message,
            });
        }
    },

    // Unlink session from table
    unlinkTableFromSession: async (req, res) => {
        try {
            const { sessionId } = req.params;
            const { customerName } = req.body;

            // Find the session
            const session = await Session.findOne({
                _id: sessionId,
                organization: req.user.organization,
            }).populate("bill");

            if (!session) {
                return res.status(404).json({
                    success: false,
                    message: "الجلسة غير موجودة",
                    error: "Session not found",
                });
            }

            if (session.status !== "active") {
                return res.status(400).json({
                    success: false,
                    message: "لا يمكن فك ربط جلسة غير نشطة",
                    error: "Session is not active",
                });
            }

            // Check if session is linked to a bill with table
            if (!session.bill) {
                return res.status(400).json({
                    success: false,
                    message: "الجلسة غير مرتبطة بفاتورة",
                    error: "Session is not linked to a bill",
                });
            }

            const bill = await Bill.findById(session.bill).populate("sessions orders");
            
            if (!bill) {
                return res.status(404).json({
                    success: false,
                    message: "الفاتورة غير موجودة",
                    error: "Bill not found",
                });
            }

            const table = bill.table;
            
            if (!table) {
                return res.status(400).json({
                    success: false,
                    message: "الجلسة غير مرتبطة بطاولة",
                    error: "Session is not linked to a table",
                });
            }
            
            // Get table number for logging
            const tableDoc = await Table.findById(table);
            const tableNumber = tableDoc ? tableDoc.number : table;

            // Update customer name if provided
            const userLanguage = getUserLanguage(req.user);
            if (customerName && customerName.trim() !== "") {
                session.customerName = customerName.trim();
            } else if (!session.customerName || session.customerName.includes(t('customer', userLanguage))) {
                // If no customer name provided and current name is default, require it
                return res.status(400).json({
                    success: false,
                    message: t('customerNameRequired', userLanguage),
                    error: "Customer name required",
                });
            }

            // Check if bill has cafe orders in addition to the session
            const hasOrders = bill.orders && bill.orders.length > 0;
            const hasMultipleSessions = bill.sessions && bill.sessions.length > 1;

            let newBill = null;

            if (hasOrders || hasMultipleSessions) {
                // Case 1: Bill has cafe orders or multiple sessions
                // Create a new bill for this session only
                
                // Calculate current session cost
                const currentCost = await session.calculateCurrentCost();
                
                // تحديد اسم العميل للفاتورة الجديدة (بدون طاولة)
                const deviceType = session.deviceType;
                const deviceName = session.deviceName;
                const customerNameForBill = getCustomerNameForDevice(deviceType, deviceName, userLanguage);

                // Create new bill for the session
                newBill = await Bill.create({
                    customerName: customerNameForBill,
                    sessions: [session._id],
                    subtotal: currentCost,
                    total: currentCost,
                    discount: session.discount || 0,
                    tax: 0,
                    notes: getSessionBillNote(session.deviceName, deviceType, tableNumber, userLanguage),
                    billType: deviceType === "playstation" ? "playstation" : deviceType === "computer" ? "computer" : "cafe",
                    status: "draft",
                    createdBy: req.user._id,
                    organization: req.user.organization,
                });

                // نقل الدفعات الجزئية المرتبطة بهذه الجلسة إلى الفاتورة الجديدة
                const sessionIdStr = session._id.toString();
                
                // نقل sessionPayments المرتبطة بهذه الجلسة
                if (bill.sessionPayments && bill.sessionPayments.length > 0) {
                    const sessionPaymentsToTransfer = bill.sessionPayments.filter(sp => 
                        sp.sessionId.toString() === sessionIdStr
                    );
                    
                    if (sessionPaymentsToTransfer.length > 0) {
                        Logger.info(`🎮 Transferring ${sessionPaymentsToTransfer.length} session payments to new bill`);
                        
                        // حساب المبلغ المدفوع من دفعات الجلسة
                        const sessionPaidAmount = sessionPaymentsToTransfer.reduce((sum, sp) => 
                            sum + (sp.paidAmount || 0), 0
                        );
                        
                        // إضافة الدفعات إلى الفاتورة الجديدة
                        newBill.sessionPayments = sessionPaymentsToTransfer.map(sp => fixSessionPaymentData(sp));
                        
                        if (sessionPaidAmount > 0) {
                            newBill.paid = sessionPaidAmount;
                            newBill.remaining = Math.max(0, newBill.total - sessionPaidAmount);
                            
                            // تحديث حالة الفاتورة الجديدة
                            if (sessionPaidAmount >= newBill.total) {
                                newBill.status = "paid";
                            } else if (sessionPaidAmount > 0) {
                                newBill.status = "partial";
                            }
                            
                            Logger.info(`💰 Transferred session payments to new bill: ${sessionPaidAmount} EGP`);
                        }
                        
                        // حفظ الفاتورة الجديدة مع الدفعات
                        await newBill.save();
                        
                        // إزالة الدفعات من الفاتورة القديمة
                        bill.sessionPayments = bill.sessionPayments.filter(sp => 
                            sp.sessionId.toString() !== sessionIdStr
                        );
                        
                        // طرح المبلغ المدفوع من الفاتورة القديمة
                        if (sessionPaidAmount > 0) {
                            bill.paid = Math.max(0, (bill.paid || 0) - sessionPaidAmount);
                            bill.remaining = Math.max(0, bill.total - bill.paid);
                            
                            // تحديث حالة الفاتورة القديمة
                            if (bill.paid === 0 && bill.total > 0) {
                                bill.status = "draft";
                            } else if (bill.paid > 0 && bill.paid < bill.total) {
                                bill.status = "partial";
                            } else if (bill.paid >= bill.total && bill.total > 0) {
                                bill.status = "paid";
                            }
                            
                            Logger.info(`💰 Deducted session payments from old bill: ${sessionPaidAmount} EGP (remaining paid: ${bill.paid} EGP)`);
                        }
                    }
                }

                // STEP 1: Remove session from old bill
                bill.sessions = bill.sessions.filter(
                    (s) => s._id.toString() !== session._id.toString()
                );
                
                Logger.info(`✅ STEP 1: Removed session from old bill`, {
                    oldBillId: bill._id,
                    oldBillNumber: bill.billNumber,
                    remainingSessions: bill.sessions.length,
                    remainingOrders: bill.orders.length,
                });
                
                // منع إعادة حساب المبلغ المدفوع تلقائياً (لأننا عدلناه يدوياً)
                bill._skipPaidRecalculation = true;
                await bill.calculateSubtotal();
                delete bill._skipPaidRecalculation;
                await bill.save();
                
                // Verify the session was actually removed from database (unlinkTableFromSession)
                const verifyBill = await Bill.findById(bill._id).select('sessions billNumber');
                const sessionStillInBill = verifyBill.sessions.some(s => s.toString() === session._id.toString());
                if (sessionStillInBill) {
                    Logger.error(`❌ CRITICAL (unlinkTableFromSession): Session ${session._id} still in bill ${verifyBill.billNumber} after removal!`);
                } else {
                    Logger.info(`✅ VERIFIED (unlinkTableFromSession): Session successfully removed from bill ${verifyBill.billNumber}`, {
                        remainingSessions: verifyBill.sessions.length
                    });
                }

                // STEP 2: Update session to point to new bill BEFORE checking for deletion
                session.bill = newBill._id;
                session.updatedBy = req.user._id;
                await session.save();
                Logger.info(`✅ STEP 2: Updated session.bill reference to new bill`);

                // STEP 3: Check if old bill is now empty and DELETE it
                // Re-fetch to get latest state
                const updatedOldBill = await Bill.findById(bill._id);
                
                if (!updatedOldBill) {
                    Logger.warn(`⚠️ Old bill ${bill.billNumber} was already deleted`);
                } else if (updatedOldBill.sessions.length === 0 && updatedOldBill.orders.length === 0) {
                    Logger.info(`🗑️ STEP 3: Old bill ${updatedOldBill.billNumber} is now empty - DELETING FROM BOTH DATABASES`, {
                        billId: updatedOldBill._id,
                        billNumber: updatedOldBill.billNumber,
                    });
                    
                    try {
                        await deleteBillFromBothDatabases(updatedOldBill._id);
                        Logger.info(`✅ Successfully DELETED empty bill ${updatedOldBill.billNumber} from both databases`);
                    } catch (deleteError) {
                        Logger.error(`❌ Failed to delete empty bill ${updatedOldBill.billNumber}:`, deleteError);
                    }
                } else {
                    Logger.info(`ℹ️ Old bill ${updatedOldBill.billNumber} still has content, keeping it`, {
                        sessionsCount: updatedOldBill.sessions.length,
                        ordersCount: updatedOldBill.orders.length,
                    });
                }

                Logger.info(`✓ Created new bill for unlinked session:`, {
                    sessionId: session._id,
                    oldBillId: bill._id,
                    newBillId: newBill._id,
                    tableNumber: tableNumber,
                });

            } else {
                // Case 2: Bill has only this session
                // Just remove table from the bill and change type
                
                bill.table = null;
                bill.billType = session.deviceType === "playstation" ? "playstation" : session.deviceType === "computer" ? "computer" : "cafe";
                
                // Update customer name
                const userLanguage = getUserLanguage(req.user);
                const deviceType = session.deviceType;
                const deviceNumber = session.deviceNumber;
                const custName = session.customerName;
                let customerNameForBill = "";
                
                if (deviceType === "playstation") {
                    if (!custName || custName.trim() === "") {
                        customerNameForBill = `${t('playstationCustomer', userLanguage)} PS${deviceNumber}`;
                    } else {
                        customerNameForBill = `${custName.trim()} PS${deviceNumber}`;
                    }
                } else if (deviceType === "computer") {
                    if (!custName || custName.trim() === "") {
                        customerNameForBill = `${t('computerCustomer', userLanguage)} PC${deviceNumber}`;
                    } else {
                        customerNameForBill = `${custName.trim()} PC${deviceNumber}`;
                    }
                } else {
                    customerNameForBill = custName || t('customer', userLanguage);
                }
                
                bill.customerName = customerNameForBill;
                bill.notes = getSessionBillNote(session.deviceName, deviceType, tableNumber, userLanguage);
                bill.updatedBy = req.user._id;
                
                await bill.save();
                
                session.updatedBy = req.user._id;
                await session.save();

                newBill = bill;

                Logger.info(`✓ Removed table from bill:`, {
                    sessionId: session._id,
                    billId: bill._id,
                    tableNumber: tableNumber,
                });
            }

            // Populate session data
            await session.populate(["createdBy", "updatedBy", "bill"], "name");
            await newBill.populate(["sessions", "createdBy"], "name");

            // Create notification
            try {
                if (req.user && req.user.organization) {
                    await NotificationService.createNotification({
                        type: "session",
                        category: "session",
                        title: "فك ربط جلسة من طاولة",
                        message: `تم فك ربط جلسة ${session.deviceName} من الطاولة ${tableNumber}`,
                        createdBy: req.user._id,
                    }, req.user);
                }
            } catch (notificationError) {
                Logger.error(
                    "Failed to create unlink notification:",
                    notificationError
                );
            }

            // Automatic cleanup after unlinking (run in background)
            // Don't wait for cleanup to complete - let it run asynchronously
            Logger.info("🧹 Scheduling automatic cleanup in background after unlinking...");
            
            // Run cleanup in background without blocking the response
            performCleanupHelper(req.user.organization)
                .then(cleanupResult => {
                    Logger.info(`✅ Background cleanup completed: ${cleanupResult.cleanedCount} references cleaned, ${cleanupResult.deletedBillsCount} bills deleted`);
                })
                .catch(cleanupError => {
                    Logger.error("❌ Background cleanup failed:", cleanupError);
                });

            // FINAL VERIFICATION: Ensure session is not in multiple bills
            // Wait a moment for all async operations to complete
            await new Promise(resolve => setTimeout(resolve, 100));
            
            const allBillsWithSession = await Bill.find({
                sessions: session._id,
                organization: req.user.organization
            }).select('_id billNumber sessions orders');
            
            if (allBillsWithSession.length > 1) {
                Logger.error(`❌ CRITICAL: Session ${session._id} found in ${allBillsWithSession.length} bills after unlinking!`, {
                    sessionId: session._id,
                    bills: allBillsWithSession.map(b => ({ id: b._id, number: b.billNumber }))
                });
                
                // Emergency cleanup: remove session from all bills except the correct one
                for (const wrongBill of allBillsWithSession) {
                    if (wrongBill._id.toString() !== newBill._id.toString()) {
                        Logger.warn(`🔧 Emergency cleanup: Removing session from bill ${wrongBill.billNumber}`);
                        
                        // Use direct MongoDB update to bypass middleware
                        await Bill.updateOne(
                            { _id: wrongBill._id },
                            { $pull: { sessions: session._id } }
                        );
                        
                        Logger.info(`✅ Forcefully removed session from bill ${wrongBill.billNumber}`);
                        
                        // Re-fetch and check if bill is now empty
                        const updatedWrongBill = await Bill.findById(wrongBill._id);
                        if (updatedWrongBill) {
                            const ordersCount = updatedWrongBill.orders ? updatedWrongBill.orders.length : 0;
                            if (updatedWrongBill.sessions.length === 0 && ordersCount === 0) {
                                await updatedWrongBill.deleteOne();
                                Logger.info(`🗑️ Deleted empty bill ${wrongBill.billNumber} during emergency cleanup`);
                            }
                        }
                    }
                }
                
                // Verify again after cleanup
                const finalCheck = await Bill.find({
                    sessions: session._id,
                    organization: req.user.organization
                }).select('_id billNumber');
                
                if (finalCheck.length > 1) {
                    Logger.error(`❌ STILL DUPLICATED: Session ${session._id} still in ${finalCheck.length} bills after emergency cleanup!`);
                } else {
                    Logger.info(`✅ Emergency cleanup successful - session now in exactly 1 bill`);
                }
            } else {
                Logger.info(`✅ VERIFIED: Session is in exactly 1 bill (${newBill.billNumber})`);
            }

            res.json({
                success: true,
                message: "تم فك ربط الجلسة من الطاولة بنجاح",
                data: {
                    session,
                    bill: {
                        id: newBill._id,
                        billNumber: newBill.billNumber,
                        customerName: newBill.customerName,
                        total: newBill.total,
                        status: newBill.status,
                        billType: newBill.billType,
                        tableNumber: newBill.tableNumber,
                    },
                    unlinkedFromTable: tableNumber,
                },
            });
        } catch (err) {
            Logger.error("unlinkTableFromSession error:", err);
            res.status(500).json({
                success: false,
                message: "خطأ في فك ربط الجلسة من الطاولة",
                error: err.message,
            });
        }
    },

    // Link session to table with smart bill merging
    linkSessionToTable: async (req, res) => {
        try {
            const { sessionId } = req.params;
            const { tableId } = req.body;

            // Validate inputs
            if (!tableId) {
                return res.status(400).json({
                    success: false,
                    message: "معرف الطاولة مطلوب",
                    error: "Table ID is required",
                });
            }

            // Find the session
            const session = await Session.findOne({
                _id: sessionId,
                organization: req.user.organization,
            }).populate("bill");

            if (!session) {
                return res.status(404).json({
                    success: false,
                    message: "الجلسة غير موجودة",
                    error: "Session not found",
                });
            }

            if (session.status !== "active") {
                return res.status(400).json({
                    success: false,
                    message: "لا يمكن ربط جلسة غير نشطة بطاولة",
                    error: "Session is not active",
                });
            }

            // Verify table exists
            const table = await Table.findOne({
                _id: tableId,
                organization: req.user.organization,
            });

            if (!table) {
                return res.status(404).json({
                    success: false,
                    message: "الطاولة غير موجودة",
                    error: "Table not found",
                });
            }

            // Get session's bill
            const sessionBill = await Bill.findById(session.bill);
            
            if (!sessionBill) {
                return res.status(404).json({
                    success: false,
                    message: "فاتورة الجلسة غير موجودة",
                    error: "Session bill not found",
                });
            }

            // Check if session bill is already linked to this table
            if (sessionBill.table && sessionBill.table.toString() === tableId.toString()) {
                return res.status(400).json({
                    success: false,
                    message: "الجلسة مرتبطة بالفعل بهذه الطاولة",
                    error: "Session is already linked to this table",
                });
            }

            // Search for existing unpaid bill on the table
            const existingTableBill = await Bill.findOne({
                table: tableId,
                organization: req.user.organization,
                status: { $in: ['draft', 'partial', 'overdue'] }
            }).sort({ createdAt: -1 });

            let finalBill = null;

            if (existingTableBill && existingTableBill._id.toString() !== sessionBill._id.toString()) {
                // Case 1: الطاولة تحتوي على فاتورة غير مدفوعة بالكامل
                Logger.info(`🔗 CASE 1: Table ${table.number} has existing unpaid bill - following same process as changeSessionTable`, {
                    sessionBillId: sessionBill._id,
                    sessionBillNumber: sessionBill.billNumber,
                    tableBillId: existingTableBill._id,
                    tableBillNumber: existingTableBill.billNumber,
                });

                const sessionIdStr = session._id.toString();

                // STEP 1: Add session to table bill first (same as changeSessionTable)
                const sessionAlreadyInTableBill = existingTableBill.sessions.some(s => {
                    const sIdStr = s._id ? s._id.toString() : s.toString();
                    return sIdStr === sessionIdStr;
                });
                
                if (!sessionAlreadyInTableBill) {
                    existingTableBill.sessions.push(session._id);
                    Logger.info(`✅ STEP 1: Added session to table bill`, {
                        sessionId: sessionIdStr,
                        tableBillId: existingTableBill._id.toString(),
                        totalSessions: existingTableBill.sessions.length,
                    });
                }
                
                // نقل الدفعات الجزئية المرتبطة بهذه الجلسة إلى فاتورة الطاولة
                if (sessionBill.sessionPayments && sessionBill.sessionPayments.length > 0) {
                    const sessionPaymentsToTransfer = sessionBill.sessionPayments.filter(sp => 
                        sp.sessionId.toString() === sessionIdStr
                    );
                    
                    if (sessionPaymentsToTransfer.length > 0) {
                        Logger.info(`🎮 Transferring ${sessionPaymentsToTransfer.length} session payments to table bill`);
                        
                        existingTableBill.sessionPayments = existingTableBill.sessionPayments || [];
                        
                        for (const sessionPayment of sessionPaymentsToTransfer) {
                            const existingPayment = existingTableBill.sessionPayments.find(sp => 
                                sp.sessionId.toString() === sessionPayment.sessionId.toString()
                            );
                            
                            if (!existingPayment) {
                                existingTableBill.sessionPayments.push(sessionPayment);
                            }
                        }
                        
                        const sessionPaidAmount = sessionPaymentsToTransfer.reduce((sum, sp) => 
                            sum + (sp.paidAmount || 0), 0
                        );
                        
                        if (sessionPaidAmount > 0) {
                            existingTableBill.paid = (existingTableBill.paid || 0) + sessionPaidAmount;
                            Logger.info(`💰 Added session payments to table bill: ${sessionPaidAmount} EGP`);
                        }
                    }
                }
                
                await existingTableBill.calculateSubtotal();
                await existingTableBill.save();

                // STEP 2: Remove session from old bill BEFORE updating session.bill
                sessionBill.sessions = sessionBill.sessions.filter(s => {
                    const sIdStr = s._id ? s._id.toString() : s.toString();
                    return sIdStr !== sessionIdStr;
                });
                
                // إزالة الدفعات الجزئية المرتبطة بهذه الجلسة من الفاتورة القديمة
                if (sessionBill.sessionPayments && sessionBill.sessionPayments.length > 0) {
                    const removedSessionPayments = sessionBill.sessionPayments.filter(sp => 
                        sp.sessionId.toString() === sessionIdStr
                    );
                    
                    if (removedSessionPayments.length > 0) {
                        Logger.info(`🎮 Removing ${removedSessionPayments.length} session payments from old bill`);
                        
                        sessionBill.sessionPayments = sessionBill.sessionPayments.filter(sp => 
                            sp.sessionId.toString() !== sessionIdStr
                        );
                        
                        const removedPaidAmount = removedSessionPayments.reduce((sum, sp) => 
                            sum + (sp.paidAmount || 0), 0
                        );
                        
                        if (removedPaidAmount > 0) {
                            sessionBill.paid = Math.max(0, (sessionBill.paid || 0) - removedPaidAmount);
                            Logger.info(`💰 Reduced old bill paid amount by: ${removedPaidAmount} EGP`);
                        }
                    }
                }
                
                Logger.info(`✅ STEP 2: Removed session from old bill`, {
                    sessionId: sessionIdStr,
                    sessionBillId: sessionBill._id.toString(),
                    sessionBillNumber: sessionBill.billNumber,
                    remainingSessions: sessionBill.sessions.length,
                    remainingOrders: sessionBill.orders.length,
                });
                
                // منع إعادة حساب المبلغ المدفوع تلقائياً (لأننا عدلناه يدوياً)
                sessionBill._skipPaidRecalculation = true;
                await sessionBill.calculateSubtotal();
                delete sessionBill._skipPaidRecalculation;
                await sessionBill.save();
                
                // Verify the session was actually removed from database (linkSessionToTable)
                const verifyBill = await Bill.findById(sessionBill._id).select('sessions billNumber');
                const sessionStillInBill = verifyBill.sessions.some(s => s.toString() === sessionIdStr);
                if (sessionStillInBill) {
                    Logger.error(`❌ CRITICAL (linkSessionToTable): Session ${sessionIdStr} still in bill ${verifyBill.billNumber} after removal!`);
                } else {
                    Logger.info(`✅ VERIFIED (linkSessionToTable): Session successfully removed from bill ${verifyBill.billNumber}`, {
                        remainingSessions: verifyBill.sessions.length
                    });
                }

                // STEP 3: Check if old bill is now empty and DELETE it immediately
                // Re-fetch to get latest state
                const updatedSessionBill = await Bill.findById(sessionBill._id);
                
                if (!updatedSessionBill) {
                    Logger.warn(`⚠️ Old bill ${sessionBill.billNumber} was already deleted`);
                } else if (updatedSessionBill.sessions.length === 0 && updatedSessionBill.orders.length === 0) {
                    Logger.info(`🗑️ STEP 3: Old bill ${updatedSessionBill.billNumber} is now empty - DELETING immediately`, {
                        billId: updatedSessionBill._id,
                        billNumber: updatedSessionBill.billNumber,
                        sessionsCount: updatedSessionBill.sessions.length,
                        ordersCount: updatedSessionBill.orders.length,
                    });
                    
                    // Copy any useful information from empty bill to table bill BEFORE deleting
                    let mergeNotes = '';
                    if (updatedSessionBill.notes && updatedSessionBill.notes.trim()) {
                        mergeNotes = `\n[مدمج من ${updatedSessionBill.billNumber}]: ${updatedSessionBill.notes}`;
                    }
                    
                    // Copy any payments from empty bill to table bill
                    if (updatedSessionBill.payments && updatedSessionBill.payments.length > 0) {
                        Logger.info(`💰 Transferring ${updatedSessionBill.payments.length} payments from empty bill to table bill`);
                        existingTableBill.payments = existingTableBill.payments || [];
                        existingTableBill.payments.push(...updatedSessionBill.payments);
                        
                        // Update paid amount
                        const transferredAmount = updatedSessionBill.payments.reduce((sum, payment) => sum + (payment.amount || 0), 0);
                        existingTableBill.paid = (existingTableBill.paid || 0) + transferredAmount;
                        
                        mergeNotes += `\n[تم نقل مدفوعات بقيمة ${transferredAmount} ج.م]`;
                    }
                    
                    // Copy any partial payments
                    if (updatedSessionBill.partialPayments && updatedSessionBill.partialPayments.length > 0) {
                        Logger.info(`💳 Transferring ${updatedSessionBill.partialPayments.length} partial payments from empty bill`);
                        existingTableBill.partialPayments = existingTableBill.partialPayments || [];
                        existingTableBill.partialPayments.push(...updatedSessionBill.partialPayments);
                    }
                    
                    // Add merge information to table bill notes
                    if (mergeNotes) {
                        const currentNotes = existingTableBill.notes || '';
                        existingTableBill.notes = currentNotes + `\n[تم دمج فاتورة فارغة ${updatedSessionBill.billNumber}]` + mergeNotes;
                        
                        // Update table bill totals
                        await existingTableBill.calculateSubtotal();
                        existingTableBill.remaining = existingTableBill.total - (existingTableBill.paid || 0);
                        await existingTableBill.save();
                    }
                    
                    // DELETE the empty bill FROM BOTH DATABASES
                    try {
                        await deleteBillFromBothDatabases(updatedSessionBill._id);
                        Logger.info(`✅ STEP 3: Successfully DELETED empty bill ${updatedSessionBill.billNumber} from both databases`);
                    } catch (deleteError) {
                        Logger.error(`❌ Failed to delete empty bill ${updatedSessionBill.billNumber}:`, deleteError);
                    }
                    
                } else {
                    Logger.info(`ℹ️ Old bill ${updatedSessionBill.billNumber} still has content, keeping it`, {
                        sessionsCount: updatedSessionBill.sessions.length,
                        ordersCount: updatedSessionBill.orders.length,
                    });
                }
                
                // STEP 4: Update session's bill reference LAST to avoid race conditions
                session.bill = existingTableBill._id;
                await session.save();
                Logger.info(`✅ STEP 4: Updated session.bill reference to new bill`);
                
                finalBill = existingTableBill;

            } else {
                // Case 2: الطاولة لا تحتوي على فاتورة غير مدفوعة - ربط الطاولة بفاتورة الجلسة الحالية
                Logger.info(`📌 CASE 2: Table ${table.number} has no unpaid bill - linking table to session bill`, {
                    sessionBillId: sessionBill._id,
                    sessionBillNumber: sessionBill.billNumber,
                });

                // Get user language for translations
                const userLanguage = getUserLanguage(req.user);

                // إضافة الطاولة إلى فاتورة الجلسة الحالية
                sessionBill.table = tableId;
                sessionBill.billType = "cafe"; // تغيير نوع الفاتورة إلى كافيه عند الربط بطاولة
                sessionBill.customerName = getTableName(table.number, userLanguage); // تحديث اسم العميل
                sessionBill.updatedBy = req.user._id;
                
                // إضافة ملاحظة عن الربط
                const linkNote = `\n[${t('linkedToTable', userLanguage)} ${table.number}]`;
                sessionBill.notes = (sessionBill.notes || '') + linkNote;
                
                await sessionBill.save();
                Logger.info(`✅ Linked table ${table.number} to session bill ${sessionBill.billNumber}`);
                
                finalBill = sessionBill;
            }

            // Populate final bill data including table
            await finalBill.populate([
                { path: "sessions", select: "deviceName deviceNumber" },
                { path: "orders", select: "orderNumber" },
                { path: "createdBy", select: "name" },
                { path: "table", select: "number name" }
            ]);

            // Reload session with populated bill and table
            const updatedSession = await Session.findById(session._id)
                .populate({
                    path: "bill",
                    populate: {
                        path: "table",
                        select: "number name"
                    }
                });

            // Create notification
            try {
                if (req.user && req.user.organization) {
                    await NotificationService.createNotification({
                        type: "session",
                        category: "session",
                        title: "ربط جلسة بطاولة",
                        message: `تم ربط جلسة ${session.deviceName} بالطاولة ${table.number}`,
                        createdBy: req.user._id,
                    }, req.user);
                }
            } catch (notificationError) {
                Logger.error(
                    "Failed to create link notification:",
                    notificationError
                );
            }

            // Automatic cleanup after linking (run in background)
            // Don't wait for cleanup to complete - let it run asynchronously
            Logger.info("🧹 Scheduling automatic cleanup in background after linking...");
            
            // Run cleanup in background without blocking the response
            performCleanupHelper(req.user.organization)
                .then(cleanupResult => {
                    Logger.info(`✅ Background cleanup completed: ${cleanupResult.cleanedCount} references cleaned, ${cleanupResult.deletedBillsCount} bills deleted`);
                })
                .catch(cleanupError => {
                    Logger.error("❌ Background cleanup failed:", cleanupError);
                });

            // FINAL VERIFICATION: Ensure session is not in multiple bills
            // Wait a moment for all async operations to complete
            await new Promise(resolve => setTimeout(resolve, 100));
            
            const allBillsWithSession = await Bill.find({
                sessions: session._id,
                organization: req.user.organization
            }).select('_id billNumber sessions orders');
            
            if (allBillsWithSession.length > 1) {
                Logger.error(`❌ CRITICAL: Session ${session._id} found in ${allBillsWithSession.length} bills after linking!`, {
                    sessionId: session._id,
                    bills: allBillsWithSession.map(b => ({ id: b._id, number: b.billNumber }))
                });
                
                // Emergency cleanup: remove session from all bills except the correct one
                for (const wrongBill of allBillsWithSession) {
                    if (wrongBill._id.toString() !== finalBill._id.toString()) {
                        Logger.warn(`🔧 Emergency cleanup: Removing session from bill ${wrongBill.billNumber}`);
                        
                        // Use direct MongoDB update to bypass middleware
                        await Bill.updateOne(
                            { _id: wrongBill._id },
                            { $pull: { sessions: session._id } }
                        );
                        
                        Logger.info(`✅ Forcefully removed session from bill ${wrongBill.billNumber}`);
                        
                        // Re-fetch and check if bill is now empty
                        const updatedWrongBill = await Bill.findById(wrongBill._id);
                        if (updatedWrongBill) {
                            const ordersCount = updatedWrongBill.orders ? updatedWrongBill.orders.length : 0;
                            if (updatedWrongBill.sessions.length === 0 && ordersCount === 0) {
                                await updatedWrongBill.deleteOne();
                                Logger.info(`🗑️ Deleted empty bill ${wrongBill.billNumber} during emergency cleanup`);
                            }
                        }
                    }
                }
                
                // Verify again after cleanup
                const finalCheck = await Bill.find({
                    sessions: session._id,
                    organization: req.user.organization
                }).select('_id billNumber');
                
                if (finalCheck.length > 1) {
                    Logger.error(`❌ STILL DUPLICATED: Session ${session._id} still in ${finalCheck.length} bills after emergency cleanup!`);
                } else {
                    Logger.info(`✅ Emergency cleanup successful - session now in exactly 1 bill`);
                }
            } else {
                Logger.info(`✅ VERIFIED: Session is in exactly 1 bill (${finalBill.billNumber})`);
            }

            res.json({
                success: true,
                message: "تم ربط الجلسة بالطاولة بنجاح",
                data: {
                    session: updatedSession, // Return full session with populated data
                    bill: {
                        id: finalBill._id,
                        billNumber: finalBill.billNumber,
                        customerName: finalBill.customerName,
                        total: finalBill.total,
                        status: finalBill.status,
                        billType: finalBill.billType,
                        table: table.number,
                        sessionsCount: finalBill.sessions.length,
                        ordersCount: finalBill.orders.length,
                    },
                },
            });

        } catch (err) {
            Logger.error("linkSessionToTable error:", err);
            res.status(500).json({
                success: false,
                message: "خطأ في ربط الجلسة بالطاولة",
                error: err.message,
            });
        }
    },

    // Change session table - moves only the specific session to a new table
    // Process order: 1) Add session to new bill, 2) Remove from old bill, 3) Delete old bill if empty
    changeSessionTable: async (req, res) => {
        try {
            const { sessionId } = req.params;
            const { newTableId } = req.body;

            // Validate inputs
            if (!newTableId) {
                return res.status(400).json({
                    success: false,
                    message: "معرف الطاولة الجديدة مطلوب",
                    error: "New table ID is required",
                });
            }

            // Find the session
            const session = await Session.findOne({
                _id: sessionId,
                organization: req.user.organization,
            }).populate("bill");

            if (!session) {
                return res.status(404).json({
                    success: false,
                    message: "الجلسة غير موجودة",
                    error: "Session not found",
                });
            }

            if (session.status !== "active") {
                return res.status(400).json({
                    success: false,
                    message: "لا يمكن تغيير طاولة جلسة غير نشطة",
                    error: "Cannot change table for inactive session",
                });
            }

            // Verify new table exists
            const newTable = await Table.findOne({
                _id: newTableId,
                organization: req.user.organization,
            });

            if (!newTable) {
                return res.status(404).json({
                    success: false,
                    message: "الطاولة الجديدة غير موجودة",
                    error: "New table not found",
                });
            }

            // Get session's current bill
            const currentBill = await Bill.findById(session.bill);
            
            if (!currentBill) {
                return res.status(404).json({
                    success: false,
                    message: "فاتورة الجلسة غير موجودة",
                    error: "Session bill not found",
                });
            }

            // Check if session is already on this table
            if (currentBill.table && currentBill.table.toString() === newTableId.toString()) {
                return res.status(400).json({
                    success: false,
                    message: "الجلسة موجودة بالفعل على هذه الطاولة",
                    error: "Session is already on this table",
                });
            }

            const oldTable = await Table.findById(currentBill.table);
            const oldTableNumber = oldTable ? oldTable.number : 'غير محدد';

            // Search for existing unpaid bill on the new table
            const existingNewTableBill = await Bill.findOne({
                table: newTableId,
                organization: req.user.organization,
                status: { $in: ['draft', 'partial', 'overdue'] }
            }).sort({ createdAt: -1 });

            let finalBill = null;

            if (existingNewTableBill) {
                // Case 1: New table has an existing unpaid bill - move session to it
                Logger.info(`🔄 Moving session to existing bill on table ${newTable.number}`, {
                    sessionId: session._id,
                    fromBill: currentBill.billNumber,
                    toBill: existingNewTableBill.billNumber,
                });

                const sessionIdStr = session._id.toString();

                // STEP 1: Add session to new table bill first
                const sessionAlreadyInNewBill = existingNewTableBill.sessions.some(s => {
                    const sIdStr = s._id ? s._id.toString() : s.toString();
                    return sIdStr === sessionIdStr;
                });
                
                if (!sessionAlreadyInNewBill) {
                    existingNewTableBill.sessions.push(session._id);
                    Logger.info(`✅ STEP 1: Added session to new bill`, {
                        sessionId: sessionIdStr,
                        newBillId: existingNewTableBill._id.toString(),
                        totalSessions: existingNewTableBill.sessions.length,
                    });
                }
                
                // نقل الدفعات الجزئية المرتبطة بهذه الجلسة إلى الفاتورة الجديدة
                if (currentBill.sessionPayments && currentBill.sessionPayments.length > 0) {
                    const sessionPaymentsToTransfer = currentBill.sessionPayments.filter(sp => 
                        sp.sessionId.toString() === sessionIdStr
                    );
                    
                    if (sessionPaymentsToTransfer.length > 0) {
                        Logger.info(`🎮 Transferring ${sessionPaymentsToTransfer.length} session payments to existing bill`);
                        
                        // إضافة الدفعات إلى الفاتورة الموجودة
                        existingNewTableBill.sessionPayments = existingNewTableBill.sessionPayments || [];
                        
                        for (const sessionPayment of sessionPaymentsToTransfer) {
                            // التحقق من عدم وجود دفعة مكررة لنفس الجلسة
                            const existingPayment = existingNewTableBill.sessionPayments.find(sp => 
                                sp.sessionId.toString() === sessionPayment.sessionId.toString()
                            );
                            
                            if (!existingPayment) {
                                // إصلاح البيانات قبل النقل
                                const transferredPayment = fixSessionPaymentData(sessionPayment);
                                existingNewTableBill.sessionPayments.push(transferredPayment);
                            } else {
                                Logger.warn(`⚠️ Session payment already exists for session: ${sessionPayment.sessionId}`);
                            }
                        }
                        
                        // حساب المبلغ المدفوع من دفعات الجلسة
                        const sessionPaidAmount = sessionPaymentsToTransfer.reduce((sum, sp) => 
                            sum + (sp.paidAmount || 0), 0
                        );
                        
                        if (sessionPaidAmount > 0) {
                            existingNewTableBill.paid = (existingNewTableBill.paid || 0) + sessionPaidAmount;
                            Logger.info(`💰 Added session payments to existing bill: ${sessionPaidAmount} EGP`);
                        }
                    }
                }
                
                await existingNewTableBill.calculateSubtotal();
                await existingNewTableBill.save();

                // STEP 2: Remove session from old bill BEFORE updating session.bill
                currentBill.sessions = currentBill.sessions.filter(s => {
                    const sIdStr = s._id ? s._id.toString() : s.toString();
                    return sIdStr !== sessionIdStr;
                });
                
                // إزالة الدفعات الجزئية المرتبطة بهذه الجلسة من الفاتورة القديمة
                if (currentBill.sessionPayments && currentBill.sessionPayments.length > 0) {
                    const removedSessionPayments = currentBill.sessionPayments.filter(sp => 
                        sp.sessionId.toString() === sessionIdStr
                    );
                    
                    if (removedSessionPayments.length > 0) {
                        Logger.info(`🎮 Removing ${removedSessionPayments.length} session payments from old bill`);
                        
                        // إزالة الدفعات من الفاتورة القديمة
                        currentBill.sessionPayments = currentBill.sessionPayments.filter(sp => 
                            sp.sessionId.toString() !== sessionIdStr
                        );
                        
                        // تقليل المبلغ المدفوع من الفاتورة القديمة
                        const removedPaidAmount = removedSessionPayments.reduce((sum, sp) => 
                            sum + (sp.paidAmount || 0), 0
                        );
                        
                        if (removedPaidAmount > 0) {
                            currentBill.paid = Math.max(0, (currentBill.paid || 0) - removedPaidAmount);
                            Logger.info(`💰 Reduced old bill paid amount by: ${removedPaidAmount} EGP`);
                        }
                    }
                }
                
                Logger.info(`✅ STEP 2: Removed session from old bill`, {
                    sessionId: sessionIdStr,
                    currentBillId: currentBill._id.toString(),
                    currentBillNumber: currentBill.billNumber,
                    remainingSessions: currentBill.sessions.length,
                    remainingOrders: currentBill.orders.length,
                });
                
                // منع إعادة حساب المبلغ المدفوع تلقائياً (لأننا عدلناه يدوياً)
                currentBill._skipPaidRecalculation = true;
                await currentBill.calculateSubtotal();
                delete currentBill._skipPaidRecalculation;
                await currentBill.save();
                
                // Verify the session was actually removed from database (Case 1)
                const verifyBill = await Bill.findById(currentBill._id).select('sessions billNumber');
                const sessionStillInBill = verifyBill.sessions.some(s => s.toString() === sessionIdStr);
                if (sessionStillInBill) {
                    Logger.error(`❌ CRITICAL (Case 1): Session ${sessionIdStr} still in bill ${verifyBill.billNumber} after removal!`);
                } else {
                    Logger.info(`✅ VERIFIED (Case 1): Session successfully removed from bill ${verifyBill.billNumber}`, {
                        remainingSessions: verifyBill.sessions.length
                    });
                }

                // STEP 3: Update session's bill reference LAST
                session.bill = existingNewTableBill._id;
                await session.save();
                Logger.info(`✅ STEP 3: Updated session.bill reference`);

                finalBill = existingNewTableBill;

            } else {
                // Case 2: New table has no unpaid bill - create new bill for it
                Logger.info(`🆕 Creating new bill for table ${newTable.number}`, {
                    sessionId: session._id,
                    fromBill: currentBill.billNumber,
                });

                const sessionIdStr = session._id.toString();

                // STEP 1: Create new bill for the new table with session
                const newBill = new Bill({
                    table: newTableId,
                    customerName: `طاولة ${newTable.number}`,
                    sessions: [session._id],
                    orders: [],
                    billType: "cafe",
                    status: "draft",
                    organization: req.user.organization,
                    createdBy: req.user._id,
                    updatedBy: req.user._id,
                });

                await newBill.calculateSubtotal();
                await newBill.save();
                
                // نقل الدفعات الجزئية المرتبطة بهذه الجلسة إلى الفاتورة الجديدة
                if (currentBill.sessionPayments && currentBill.sessionPayments.length > 0) {
                    const sessionPaymentsToTransfer = currentBill.sessionPayments.filter(sp => 
                        sp.sessionId.toString() === sessionIdStr
                    );
                    
                    if (sessionPaymentsToTransfer.length > 0) {
                        Logger.info(`🎮 Transferring ${sessionPaymentsToTransfer.length} session payments to new bill`);
                        
                        // إضافة الدفعات إلى الفاتورة الجديدة
                        newBill.sessionPayments = sessionPaymentsToTransfer.map(sp => fixSessionPaymentData(sp));
                        
                        // حساب المبلغ المدفوع من دفعات الجلسة
                        const sessionPaidAmount = sessionPaymentsToTransfer.reduce((sum, sp) => 
                            sum + (sp.paidAmount || 0), 0
                        );
                        
                        if (sessionPaidAmount > 0) {
                            newBill.paid = sessionPaidAmount;
                            newBill.remaining = Math.max(0, newBill.total - sessionPaidAmount);
                            
                            // تحديث حالة الفاتورة الجديدة
                            if (sessionPaidAmount >= newBill.total) {
                                newBill.status = "paid";
                            } else if (sessionPaidAmount > 0) {
                                newBill.status = "partial";
                            }
                            
                            Logger.info(`💰 Transferred session payments to new bill: ${sessionPaidAmount} EGP`);
                        }
                        
                        // حفظ الفاتورة الجديدة مع الدفعات
                        await newBill.save();
                    }
                }
                
                Logger.info(`✅ STEP 1: Created new bill with session`, {
                    sessionId: sessionIdStr,
                    newBillId: newBill._id.toString(),
                    billNumber: newBill.billNumber,
                });

                // STEP 2: Remove session from old bill BEFORE updating session.bill
                currentBill.sessions = currentBill.sessions.filter(s => {
                    const sIdStr = s._id ? s._id.toString() : s.toString();
                    return sIdStr !== sessionIdStr;
                });
                
                // إزالة الدفعات الجزئية المرتبطة بهذه الجلسة من الفاتورة القديمة
                if (currentBill.sessionPayments && currentBill.sessionPayments.length > 0) {
                    const removedSessionPayments = currentBill.sessionPayments.filter(sp => 
                        sp.sessionId.toString() === sessionIdStr
                    );
                    
                    if (removedSessionPayments.length > 0) {
                        Logger.info(`🎮 Removing ${removedSessionPayments.length} session payments from old bill`);
                        
                        // إزالة الدفعات من الفاتورة القديمة
                        currentBill.sessionPayments = currentBill.sessionPayments.filter(sp => 
                            sp.sessionId.toString() !== sessionIdStr
                        );
                        
                        // تقليل المبلغ المدفوع من الفاتورة القديمة
                        const removedPaidAmount = removedSessionPayments.reduce((sum, sp) => 
                            sum + (sp.paidAmount || 0), 0
                        );
                        
                        if (removedPaidAmount > 0) {
                            currentBill.paid = Math.max(0, (currentBill.paid || 0) - removedPaidAmount);
                            Logger.info(`💰 Reduced old bill paid amount by: ${removedPaidAmount} EGP`);
                        }
                    }
                }
                
                Logger.info(`✅ STEP 2: Removed session from old bill`, {
                    sessionId: sessionIdStr,
                    currentBillId: currentBill._id.toString(),
                    currentBillNumber: currentBill.billNumber,
                    remainingSessions: currentBill.sessions.length,
                    remainingOrders: currentBill.orders.length,
                });
                
                // منع إعادة حساب المبلغ المدفوع تلقائياً (لأننا عدلناه يدوياً)
                currentBill._skipPaidRecalculation = true;
                await currentBill.calculateSubtotal();
                delete currentBill._skipPaidRecalculation;
                await currentBill.save();
                
                // Verify the session was actually removed from database (Case 2)
                const verifyBill = await Bill.findById(currentBill._id).select('sessions billNumber');
                const sessionStillInBill = verifyBill.sessions.some(s => s.toString() === sessionIdStr);
                if (sessionStillInBill) {
                    Logger.error(`❌ CRITICAL (Case 2): Session ${sessionIdStr} still in bill ${verifyBill.billNumber} after removal!`);
                } else {
                    Logger.info(`✅ VERIFIED (Case 2): Session successfully removed from bill ${verifyBill.billNumber}`, {
                        remainingSessions: verifyBill.sessions.length
                    });
                }

                // STEP 3: Update session's bill reference LAST
                session.bill = newBill._id;
                await session.save();
                Logger.info(`✅ STEP 3: Updated session.bill reference`);

                // STEP 4: Check if old bill is now empty and DELETE it
                // Re-fetch to get latest state
                const updatedCurrentBill = await Bill.findById(currentBill._id);
                
                if (!updatedCurrentBill) {
                    Logger.warn(`⚠️ Old bill ${currentBill.billNumber} was already deleted`);
                } else if (updatedCurrentBill.sessions.length === 0 && updatedCurrentBill.orders.length === 0) {
                    Logger.info(`🗑️ STEP 4 (Case 2): Old bill ${updatedCurrentBill.billNumber} is now empty - DELETING FROM BOTH DATABASES`, {
                        billId: updatedCurrentBill._id,
                        billNumber: updatedCurrentBill.billNumber,
                        sessionsCount: updatedCurrentBill.sessions.length,
                        ordersCount: updatedCurrentBill.orders.length,
                    });
                    
                    try {
                        await deleteBillFromBothDatabases(updatedCurrentBill._id);
                        Logger.info(`✅ Successfully DELETED empty bill ${updatedCurrentBill.billNumber} from both databases`);
                    } catch (deleteError) {
                        Logger.error(`❌ Failed to delete empty bill ${updatedCurrentBill.billNumber}:`, deleteError);
                    }
                } else {
                    Logger.info(`ℹ️ Old bill ${updatedCurrentBill.billNumber} still has content, keeping it`, {
                        sessionsCount: updatedCurrentBill.sessions.length,
                        ordersCount: updatedCurrentBill.orders.length,
                    });
                }

                finalBill = newBill;
            }

            // STEP 3/4: Check if old bill is now empty and delete it properly (for Case 1 only)
            // This uses the same deletion mechanism as the delete button in billing management page
            // For Case 2, we already handled deletion above
            if (existingNewTableBill) {
                // Only run this for Case 1 (when we merged with existing table bill)
                const updatedCurrentBill = await Bill.findById(currentBill._id);
                if (updatedCurrentBill && 
                    updatedCurrentBill.sessions.length === 0 && 
                    updatedCurrentBill.orders.length === 0) {
                    
                    Logger.info(`🔄 STEP 3 (Case 1): Old bill ${updatedCurrentBill.billNumber} is now empty, merging with destination bill...`, {
                        billId: updatedCurrentBill._id,
                        destinationBill: finalBill.billNumber,
                    });
                    
                    // Merge the empty bill with the final bill (where the session moved to)
                    Logger.info(`🔗 Merging empty bill ${updatedCurrentBill.billNumber} with destination bill ${finalBill.billNumber}`);
                    
                    // Copy any useful information from empty bill to final bill
                    let mergeNotes = '';
                    if (updatedCurrentBill.notes && updatedCurrentBill.notes.trim()) {
                        mergeNotes = `\n[مدمج من ${updatedCurrentBill.billNumber}]: ${updatedCurrentBill.notes}`;
                    }
                    
                    // Copy any payments from empty bill to final bill
                    if (updatedCurrentBill.payments && updatedCurrentBill.payments.length > 0) {
                        Logger.info(`💰 Transferring ${updatedCurrentBill.payments.length} payments from empty bill to destination bill`);
                        finalBill.payments = finalBill.payments || [];
                        finalBill.payments.push(...updatedCurrentBill.payments);
                        
                        // Update paid amount
                        const transferredAmount = updatedCurrentBill.payments.reduce((sum, payment) => sum + (payment.amount || 0), 0);
                        finalBill.paid = (finalBill.paid || 0) + transferredAmount;
                        
                        mergeNotes += `\n[تم نقل مدفوعات بقيمة ${transferredAmount} ج.م]`;
                    }
                    
                    // Copy any partial payments
                    if (updatedCurrentBill.partialPayments && updatedCurrentBill.partialPayments.length > 0) {
                        Logger.info(`💳 Transferring ${updatedCurrentBill.partialPayments.length} partial payments from empty bill`);
                        finalBill.partialPayments = finalBill.partialPayments || [];
                        finalBill.partialPayments.push(...updatedCurrentBill.partialPayments);
                    }
                    
                    // Copy itemPayments (الدفعات الجزئية للأصناف)
                    if (updatedCurrentBill.itemPayments && updatedCurrentBill.itemPayments.length > 0) {
                        Logger.info(`📦 Transferring ${updatedCurrentBill.itemPayments.length} item payments from empty bill`);
                        finalBill.itemPayments = finalBill.itemPayments || [];
                        
                        for (const oldItemPayment of updatedCurrentBill.itemPayments) {
                            // البحث عن دفعة مماثلة في الفاتورة المستهدفة
                            const existingItemPayment = finalBill.itemPayments.find(ip => 
                                ip.itemName === oldItemPayment.itemName && 
                                ip.pricePerUnit === oldItemPayment.pricePerUnit &&
                                ip.orderId.toString() === oldItemPayment.orderId.toString()
                            );
                            
                            if (existingItemPayment) {
                                // دمج مع الدفعة الموجودة
                                Logger.info(`🔗 Merging item payment: ${oldItemPayment.itemName}`);
                                
                                existingItemPayment.quantity += oldItemPayment.quantity;
                                existingItemPayment.totalPrice += oldItemPayment.totalPrice;
                                existingItemPayment.paidQuantity += (oldItemPayment.paidQuantity || 0);
                                existingItemPayment.paidAmount += (oldItemPayment.paidAmount || 0);
                                existingItemPayment.isPaid = existingItemPayment.paidQuantity >= existingItemPayment.quantity;
                                
                                // دمج تاريخ الدفعات
                                if (oldItemPayment.paymentHistory && oldItemPayment.paymentHistory.length > 0) {
                                    existingItemPayment.paymentHistory = existingItemPayment.paymentHistory || [];
                                    existingItemPayment.paymentHistory.push(...oldItemPayment.paymentHistory);
                                }
                                
                                // تحديث تاريخ آخر دفعة
                                if (oldItemPayment.paidAt && (!existingItemPayment.paidAt || oldItemPayment.paidAt > existingItemPayment.paidAt)) {
                                    existingItemPayment.paidAt = oldItemPayment.paidAt;
                                    existingItemPayment.paidBy = oldItemPayment.paidBy;
                                }
                            } else {
                                // إضافة دفعة جديدة
                                Logger.info(`➕ Adding new item payment: ${oldItemPayment.itemName}`);
                                finalBill.itemPayments.push({
                                    ...oldItemPayment.toObject ? oldItemPayment.toObject() : oldItemPayment
                                });
                            }
                        }
                        
                        const totalItemPayments = updatedCurrentBill.itemPayments.reduce((sum, ip) => sum + (ip.paidAmount || 0), 0);
                        if (totalItemPayments > 0) {
                            mergeNotes += `\n[تم نقل دفعات أصناف بقيمة ${totalItemPayments} ج.م]`;
                        }
                    }
                    
                    // Copy sessionPayments (الدفعات الجزئية للجلسات)
                    if (updatedCurrentBill.sessionPayments && updatedCurrentBill.sessionPayments.length > 0) {
                        Logger.info(`🎮 Transferring ${updatedCurrentBill.sessionPayments.length} session payments from empty bill`);
                        finalBill.sessionPayments = finalBill.sessionPayments || [];
                        
                        for (const oldSessionPayment of updatedCurrentBill.sessionPayments) {
                            // البحث عن دفعة مماثلة في الفاتورة المستهدفة (نفس الجلسة)
                            const existingSessionPayment = finalBill.sessionPayments.find(sp => 
                                sp.sessionId.toString() === oldSessionPayment.sessionId.toString()
                            );
                            
                            if (existingSessionPayment) {
                                // دمج مع الدفعة الموجودة (نادر الحدوث)
                                Logger.warn(`⚠️ Found duplicate session payment for session: ${oldSessionPayment.sessionId}`);
                                
                                existingSessionPayment.paidAmount += (oldSessionPayment.paidAmount || 0);
                                existingSessionPayment.remainingAmount = existingSessionPayment.sessionCost - existingSessionPayment.paidAmount;
                                
                                // دمج تاريخ الدفعات
                                if (oldSessionPayment.payments && oldSessionPayment.payments.length > 0) {
                                    existingSessionPayment.payments = existingSessionPayment.payments || [];
                                    existingSessionPayment.payments.push(...oldSessionPayment.payments);
                                }
                            } else {
                                // إضافة دفعة جديدة
                                Logger.info(`➕ Adding new session payment for session: ${oldSessionPayment.sessionId}`);
                                finalBill.sessionPayments.push({
                                    ...oldSessionPayment.toObject ? oldSessionPayment.toObject() : oldSessionPayment
                                });
                            }
                        }
                        
                        const totalSessionPayments = updatedCurrentBill.sessionPayments.reduce((sum, sp) => sum + (sp.paidAmount || 0), 0);
                        if (totalSessionPayments > 0) {
                            mergeNotes += `\n[تم نقل دفعات جلسات بقيمة ${totalSessionPayments} ج.م]`;
                        }
                    }
                    
                    // Copy paymentHistory (تاريخ الدفعات)
                    if (updatedCurrentBill.paymentHistory && updatedCurrentBill.paymentHistory.length > 0) {
                        Logger.info(`📜 Transferring ${updatedCurrentBill.paymentHistory.length} payment history records`);
                        finalBill.paymentHistory = finalBill.paymentHistory || [];
                        finalBill.paymentHistory.push(...updatedCurrentBill.paymentHistory);
                    }
                    
                    // Add merge information to final bill notes
                    const currentNotes = finalBill.notes || '';
                    finalBill.notes = currentNotes + `\n[تم دمج فاتورة فارغة ${updatedCurrentBill.billNumber}]` + mergeNotes;
                    
                    // Update final bill totals
                    await finalBill.calculateSubtotal();
                    finalBill.remaining = finalBill.total - (finalBill.paid || 0);
                    await finalBill.save();
                    
                    // Delete the empty bill FROM BOTH DATABASES
                    await deleteBillFromBothDatabases(updatedCurrentBill._id);
                    
                    Logger.info(`✅ STEP 3 (Case 1): Successfully merged and deleted empty bill ${updatedCurrentBill.billNumber} from both databases`, {
                        finalBillTotal: finalBill.total,
                        finalBillPaid: finalBill.paid,
                        finalBillRemaining: finalBill.remaining
                    });
                    
                    // Update table status if needed
                    if (updatedCurrentBill.table) {
                        const unpaidBills = await Bill.find({
                            table: updatedCurrentBill.table,
                            status: { $in: ['draft', 'partial', 'overdue'] }
                        });
                        
                        const newTableStatus = unpaidBills.length > 0 ? 'occupied' : 'empty';
                        await Table.findByIdAndUpdate(updatedCurrentBill.table, { status: newTableStatus });
                        Logger.info(`✅ Updated table status to: ${newTableStatus}`);
                    }
                } else if (updatedCurrentBill) {
                    Logger.info(`ℹ️ Old bill ${updatedCurrentBill.billNumber} still has content, keeping it`, {
                        sessionsCount: updatedCurrentBill.sessions.length,
                        ordersCount: updatedCurrentBill.orders.length,
                    });
                }
            }

            // Wait a moment for all database operations to complete
            await new Promise(resolve => setTimeout(resolve, 200));
            
            // Populate final bill data
            await finalBill.populate([
                { path: "sessions", select: "deviceName deviceNumber" },
                { path: "orders", select: "orderNumber" },
                { path: "table", select: "number name" }
            ]);

            // Reload session with populated bill and table
            const updatedSession = await Session.findById(session._id)
                .populate({
                    path: "bill",
                    populate: {
                        path: "table",
                        select: "number name"
                    }
                });

            // Create notification
            try {
                if (req.user && req.user.organization) {
                    await NotificationService.createNotification({
                        type: "session",
                        category: "session",
                        title: "تغيير طاولة الجلسة",
                        message: `تم نقل جلسة ${session.deviceName} من طاولة ${oldTableNumber} إلى طاولة ${newTable.number}`,
                        createdBy: req.user._id,
                    }, req.user);
                }
            } catch (notificationError) {
                Logger.error("Failed to create table change notification:", notificationError);
            }

            Logger.info(`✓ Session table changed successfully:`, {
                sessionId: session._id,
                deviceName: session.deviceName,
                fromTable: oldTableNumber,
                toTable: newTable.number,
                finalBillId: finalBill._id,
                updatedBy: req.user.name,
            });

            // Automatic cleanup after changing table (run in background)
            // Don't wait for cleanup to complete - let it run asynchronously
            Logger.info("🧹 Scheduling automatic cleanup in background after table change...");
            
            // Run cleanup in background without blocking the response
            performCleanupHelper(req.user.organization)
                .then(cleanupResult => {
                    Logger.info(`✅ Background cleanup completed: ${cleanupResult.cleanedCount} references cleaned, ${cleanupResult.deletedBillsCount} bills deleted`);
                })
                .catch(cleanupError => {
                    Logger.error("❌ Background cleanup failed:", cleanupError);
                });
            
            // FINAL VERIFICATION: Ensure session is not in multiple bills
            // Wait a moment for all async operations to complete
            await new Promise(resolve => setTimeout(resolve, 100));
            
            const allBillsWithSession = await Bill.find({
                sessions: session._id,
                organization: req.user.organization
            }).select('_id billNumber sessions orders');
            
            if (allBillsWithSession.length > 1) {
                Logger.error(`❌ CRITICAL: Session ${session._id} found in ${allBillsWithSession.length} bills after table change!`, {
                    sessionId: session._id,
                    bills: allBillsWithSession.map(b => ({ id: b._id, number: b.billNumber, sessionsCount: b.sessions.length }))
                });
                
                // Emergency cleanup: remove session from all bills except the correct one
                for (const wrongBill of allBillsWithSession) {
                    if (wrongBill._id.toString() !== finalBill._id.toString()) {
                        Logger.warn(`🔧 Emergency cleanup: Removing session from bill ${wrongBill.billNumber}`);
                        
                        // Use direct MongoDB update to bypass middleware
                        await Bill.updateOne(
                            { _id: wrongBill._id },
                            { $pull: { sessions: session._id } }
                        );
                        
                        Logger.info(`✅ Forcefully removed session from bill ${wrongBill.billNumber}`);
                        
                        // Re-fetch and check if bill is now empty
                        const updatedWrongBill = await Bill.findById(wrongBill._id);
                        if (updatedWrongBill) {
                            const ordersCount = updatedWrongBill.orders ? updatedWrongBill.orders.length : 0;
                            if (updatedWrongBill.sessions.length === 0 && ordersCount === 0) {
                                await updatedWrongBill.deleteOne();
                                Logger.info(`🗑️ Deleted empty bill ${wrongBill.billNumber} during emergency cleanup`);
                            }
                        }
                    }
                }
                
                // Verify again after cleanup
                const finalCheck = await Bill.find({
                    sessions: session._id,
                    organization: req.user.organization
                }).select('_id billNumber');
                
                if (finalCheck.length > 1) {
                    Logger.error(`❌ STILL DUPLICATED: Session ${session._id} still in ${finalCheck.length} bills after emergency cleanup!`);
                } else {
                    Logger.info(`✅ Emergency cleanup successful - session now in exactly 1 bill`);
                }
            } else if (allBillsWithSession.length === 1) {
                Logger.info(`✅ VERIFIED: Session is in exactly 1 bill (${finalBill.billNumber})`);
            } else {
                Logger.error(`❌ CRITICAL: Session ${session._id} not found in any bill!`);
            }
            
            // Also verify old bill is gone if it should be
            const finalBillCheck = await Bill.findById(currentBill._id);
            if (finalBillCheck) {
                Logger.warn(`⚠️ WARNING: Old bill ${currentBill.billNumber} still exists after table change!`, {
                    billId: finalBillCheck._id,
                    sessionsCount: finalBillCheck.sessions?.length || 0,
                    ordersCount: finalBillCheck.orders?.length || 0
                });
            } else {
                Logger.info(`✅ CONFIRMED: Old bill was successfully removed`);
            }

            res.json({
                success: true,
                message: `تم نقل الجلسة من طاولة ${oldTableNumber} إلى طاولة ${newTable.number} بنجاح`,
                data: {
                    session: updatedSession,
                    bill: {
                        id: finalBill._id,
                        billNumber: finalBill.billNumber,
                        customerName: finalBill.customerName,
                        total: finalBill.total,
                        status: finalBill.status,
                        table: newTable.number,
                        sessionsCount: finalBill.sessions.length,
                        ordersCount: finalBill.orders.length,
                    },
                    oldTable: oldTableNumber,
                    newTable: newTable.number,
                },
            });

        } catch (err) {
            Logger.error("changeSessionTable error:", err);
            res.status(500).json({
                success: false,
                message: "خطأ في تغيير طاولة الجلسة",
                error: err.message,
            });
        }
    },

    // Clean up duplicate session references in bills - can be called automatically
    cleanupDuplicateSessionReferences: async (req, res) => {
        try {
            const result = await performCleanupHelper(req.user.organization);
            
            res.json({
                success: true,
                message: `تم تنظيف ${result.cleanedCount} مرجع مكرر بنجاح`,
                data: result
            });
            
        } catch (err) {
            Logger.error("cleanupDuplicateSessionReferences error:", err);
            res.status(500).json({
                success: false,
                message: "خطأ في تنظيف المراجع المكررة",
                error: err.message,
            });
        }
    },

    // Helper function to perform cleanup - can be called internally
    performCleanup: async (organizationId) => {
        return await performCleanupHelper(organizationId);
    },
    
    // Helper function to perform selective cleanup - faster for single operations
    performSelectiveCleanup: async (sessionIds, organizationId) => {
        return await performSelectiveCleanup(sessionIds, organizationId);
    },

    // Update session start time
    updateSessionStartTime: async (req, res) => {
        try {
            const { id } = req.params;
            const { startTime } = req.body;

            // Validate input
            if (!startTime) {
                return res.status(400).json({
                    success: false,
                    message: "وقت البدء الجديد مطلوب",
                    error: "Start time is required",
                });
            }

            // Find the session
            const session = await Session.findOne({
                _id: id,
                organization: req.user.organization,
            }).populate("bill");

            if (!session) {
                return res.status(404).json({
                    success: false,
                    message: "الجلسة غير موجودة",
                    error: "Session not found",
                });
            }

            if (session.status !== "active") {
                return res.status(400).json({
                    success: false,
                    message: "لا يمكن تعديل وقت بدء جلسة غير نشطة",
                    error: "Cannot edit start time of inactive session",
                });
            }

            // Parse and validate the new start time
            const newStartTime = new Date(startTime);
            const currentTime = new Date();

            // Check if the new start time is valid
            if (isNaN(newStartTime.getTime())) {
                return res.status(400).json({
                    success: false,
                    message: "وقت البدء غير صحيح",
                    error: "Invalid start time format",
                });
            }

            // Check if the new start time is not in the future
            if (newStartTime > currentTime) {
                return res.status(400).json({
                    success: false,
                    message: "لا يمكن تعديل وقت البدء إلى وقت في المستقبل",
                    error: "Start time cannot be in the future",
                });
            }

            // Check if the new start time is not more than 24 hours ago
            const twentyFourHoursAgo = new Date(currentTime.getTime() - (24 * 60 * 60 * 1000));
            if (newStartTime < twentyFourHoursAgo) {
                return res.status(400).json({
                    success: false,
                    message: "لا يمكن تعديل وقت البدء إلى أكثر من 24 ساعة في الماضي",
                    error: "Start time cannot be more than 24 hours ago",
                });
            }

            // Store old start time for logging
            const oldStartTime = session.startTime;

            // Update session start time
            session.startTime = newStartTime;
            session.updatedBy = req.user._id;

            // Update controllers history if it exists
            if (session.controllersHistory && session.controllersHistory.length > 0) {
                // Update the first period's start time
                session.controllersHistory[0].from = newStartTime;
            }

            // Save the session
            await session.save();

            // Recalculate current cost with new start time
            const currentCost = await session.calculateCurrentCost();
            session.totalCost = currentCost;
            session.finalCost = currentCost - (session.discount || 0);

            // Update the associated bill if it exists
            if (session.bill) {
                try {
                    const bill = await Bill.findById(session.bill);
                    if (bill) {
                        await bill.calculateSubtotal();
                        await bill.save();
                    }
                } catch (billError) {
                    Logger.error("❌ Error updating bill after start time change:", billError);
                }
            }

            // Populate session data
            await session.populate(["createdBy", "updatedBy", "bill"], "name");

            // Create notification
            try {
                if (req.user && req.user.organization) {
                    const userLocale = getUserLocale(req.user);
                    await NotificationService.createNotification({
                        type: "session",
                        category: "session",
                        title: "تعديل وقت بدء الجلسة",
                        message: `تم تعديل وقت بدء جلسة ${session.deviceName} من ${oldStartTime.toLocaleString(userLocale)} إلى ${newStartTime.toLocaleString(userLocale)}`,
                        createdBy: req.user._id,
                    }, req.user);
                }
            } catch (notificationError) {
                Logger.error(
                    "Failed to create start time update notification:",
                    notificationError
                );
            }

            Logger.info(`✓ Session start time updated:`, {
                sessionId: session._id,
                deviceName: session.deviceName,
                oldStartTime: oldStartTime.toISOString(),
                newStartTime: newStartTime.toISOString(),
                updatedBy: req.user.name,
            });

            res.json({
                success: true,
                message: "تم تعديل وقت بدء الجلسة بنجاح",
                data: session,
            });

        } catch (err) {
            Logger.error("updateSessionStartTime error:", err);
            res.status(500).json({
                success: false,
                message: "خطأ في تعديل وقت بدء الجلسة",
                error: err.message,
            });
        }
    },
};

// Helper function to merge two bills
async function mergeBills(sourceBill, targetBill, session, userId) {
    try {
        Logger.info(`🔄 Starting bill merge:`, {
            sourceBillId: sourceBill._id,
            sourceBillNumber: sourceBill.billNumber,
            targetBillId: targetBill._id,
            targetBillNumber: targetBill.billNumber,
        });

        // Transfer session to target bill (avoid duplicates)
        if (!targetBill.sessions.includes(session._id)) {
            targetBill.sessions.push(session._id);
        }

        // Transfer all other sessions from source bill (avoid duplicates)
        for (const sessionId of sourceBill.sessions) {
            if (!targetBill.sessions.some(s => s.toString() === sessionId.toString())) {
                targetBill.sessions.push(sessionId);
            }
        }

        // Transfer all orders from source bill (avoid duplicates)
        if (sourceBill.orders && sourceBill.orders.length > 0) {
            for (const orderId of sourceBill.orders) {
                if (!targetBill.orders.some(o => o.toString() === orderId.toString())) {
                    targetBill.orders.push(orderId);
                }
            }
        }

        // Transfer all payments from source bill
        if (sourceBill.payments && sourceBill.payments.length > 0) {
            targetBill.payments.push(...sourceBill.payments);
        }

        // Aggregate paid amounts
        targetBill.paid = (targetBill.paid || 0) + (sourceBill.paid || 0);

        // Update bill metadata
        targetBill.updatedBy = userId;

        // Recalculate subtotal and total
        await targetBill.calculateSubtotal();
        await targetBill.save();

        // Update session reference to point to target bill
        session.bill = targetBill._id;
        await session.save();

        // Update all other sessions from source bill to point to target bill
        await Session.updateMany(
            { bill: sourceBill._id },
            { $set: { bill: targetBill._id } }
        );

        // Delete source bill
        await Bill.findByIdAndDelete(sourceBill._id);

        Logger.info(`✅ Bill merge completed successfully:`, {
            deletedBillId: sourceBill._id,
            deletedBillNumber: sourceBill.billNumber,
            finalBillId: targetBill._id,
            finalBillNumber: targetBill.billNumber,
            finalTotal: targetBill.total,
            finalPaid: targetBill.paid,
            sessionsCount: targetBill.sessions.length,
            ordersCount: targetBill.orders.length,
        });

        return targetBill;

    } catch (error) {
        Logger.error("❌ Bill merge failed:", error);
        throw error;
    }
    // Helper function to properly delete a bill (similar to billingController.deleteBill)
    deleteBillProperly: async (bill) => {
        try {
            Logger.info(`🗑️ Starting proper deletion of bill: ${bill.billNumber}`, {
                billId: bill._id,
                ordersCount: bill.orders?.length || 0,
                sessionsCount: bill.sessions?.length || 0
            });

            // Store table reference before deletion
            const tableId = bill.table?._id || bill.table;
            const organizationId = bill.organization;
            
            // Store order and session IDs before deletion
            let orderIds = bill.orders || [];
            let sessionIds = bill.sessions || [];

            // Import required modules
            const { default: Order } = await import('../models/Order.js');
            const { default: dualDatabaseManager } = await import('../config/dualDatabaseManager.js');
            const { default: syncConfig } = await import('../config/syncConfig.js');
            const { updateTableStatusIfNeeded } = await import('../utils/tableUtils.js');

            // Fallback: البحث عن الطلبات والجلسات المرتبطة بالفاتورة مباشرة من قاعدة البيانات
            if (orderIds.length === 0) {
                const relatedOrders = await Order.find({ bill: bill._id }).select('_id');
                orderIds = relatedOrders.map(o => o._id);
                Logger.info(`📋 Found ${orderIds.length} orders by searching with bill reference`);
            }
            
            if (sessionIds.length === 0) {
                const relatedSessions = await Session.find({ bill: bill._id }).select('_id');
                sessionIds = relatedSessions.map(s => s._id);
                Logger.info(`🎮 Found ${sessionIds.length} sessions by searching with bill reference`);
            }

            // تعطيل Sync Middleware مؤقتاً لتجنب إعادة المزامنة
            const originalSyncEnabled = syncConfig.enabled;
            
            try {
                // تعطيل المزامنة التلقائية
                syncConfig.enabled = false;
                Logger.info(`🔒 Sync middleware disabled for direct delete operation`);
                
                // الحذف المباشر من Local و Atlas في نفس الوقت
                const localConnection = dualDatabaseManager.getLocalConnection();
                const atlasConnection = dualDatabaseManager.getAtlasConnection();
                
                // Delete all orders associated with this bill (cascade delete)
                if (orderIds.length > 0) {
                    Logger.info(`🗑️ Deleting ${orderIds.length} orders associated with bill ${bill.billNumber}`);
                    
                    // حذف من Local
                    const deleteResult = await Order.deleteMany({ _id: { $in: orderIds } });
                    Logger.info(`✓ Deleted ${deleteResult.deletedCount} orders from Local MongoDB`);
                    
                    // حذف من Atlas مباشرة
                    if (atlasConnection) {
                        try {
                            const atlasOrdersCollection = atlasConnection.collection('orders');
                            const atlasDeleteResult = await atlasOrdersCollection.deleteMany({ 
                                _id: { $in: orderIds } 
                            });
                            Logger.info(`✓ Deleted ${atlasDeleteResult.deletedCount} orders from Atlas MongoDB`);
                        } catch (atlasError) {
                            Logger.error(`❌ Failed to delete orders from Atlas: ${atlasError.message}`);
                        }
                    }
                }

                // Delete all sessions associated with this bill (cascade delete)
                if (sessionIds.length > 0) {
                    Logger.info(`🗑️ Deleting ${sessionIds.length} sessions associated with bill ${bill.billNumber}`);
                    
                    // حذف من Local
                    const sessionDeleteResult = await Session.deleteMany({ _id: { $in: sessionIds } });
                    Logger.info(`✓ Deleted ${sessionDeleteResult.deletedCount} sessions from Local MongoDB`);
                    
                    // حذف من Atlas مباشرة
                    if (atlasConnection) {
                        try {
                            const atlasSessionsCollection = atlasConnection.collection('sessions');
                            const atlasDeleteResult = await atlasSessionsCollection.deleteMany({ 
                                _id: { $in: sessionIds } 
                            });
                            Logger.info(`✓ Deleted ${atlasDeleteResult.deletedCount} sessions from Atlas MongoDB`);
                        } catch (atlasError) {
                            Logger.error(`❌ Failed to delete sessions from Atlas: ${atlasError.message}`);
                        }
                    }
                }

                // Delete the bill from Local MongoDB
                await bill.deleteOne();
                Logger.info(`✓ Deleted bill ${bill.billNumber} from Local`);
                
                // Delete the bill from Atlas MongoDB مباشرة
                if (atlasConnection) {
                    try {
                        const atlasBillsCollection = atlasConnection.collection('bills');
                        const atlasDeleteResult = await atlasBillsCollection.deleteOne({ _id: bill._id });
                        Logger.info(`✓ Deleted bill ${bill.billNumber} from Atlas (deletedCount: ${atlasDeleteResult.deletedCount})`);
                    } catch (atlasError) {
                        Logger.warn(`⚠️ Failed to delete bill from Atlas: ${atlasError.message}`);
                    }
                }
            } finally {
                // إعادة تفعيل المزامنة
                syncConfig.enabled = originalSyncEnabled;
                Logger.info(`🔓 Sync middleware re-enabled`);
            }

            // Update table status based on remaining unpaid bills
            if (tableId) {
                await updateTableStatusIfNeeded(tableId, organizationId);
            }

            Logger.info(`✅ Successfully deleted bill ${bill.billNumber} properly`);
            
        } catch (error) {
            Logger.error(`❌ Error in deleteBillProperly for bill ${bill.billNumber}:`, error);
            throw error;
        }
    }

}

export default sessionController;
