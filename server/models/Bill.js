import mongoose from "mongoose";
import QRCode from "qrcode";

// Helper function to get item redistribution key
// Uses menuItem ID if available, falls back to name|price for backward compatibility
function getItemRedistributionKey(item) {
    if (item.menuItemId && mongoose.Types.ObjectId.isValid(item.menuItemId)) {
        return item.menuItemId.toString();
    }
    // Fallback for backward compatibility
    return `${item.name || item.itemName}|${item.price || item.pricePerUnit}`;
}

// Helper function to check if two items can share payments (same menuItem)
function canSharePayments(item1, item2) {
    // If both have menuItemId, compare them
    if (item1.menuItemId && item2.menuItemId) {
        return item1.menuItemId.toString() === item2.menuItemId.toString();
    }
    
    // If one has menuItemId and other doesn't, try to match by name and price
    if ((item1.menuItemId && !item2.menuItemId) || (!item1.menuItemId && item2.menuItemId)) {
        const name1 = item1.name || item1.itemName;
        const name2 = item2.name || item2.itemName;
        const price1 = item1.price || item1.pricePerUnit;
        const price2 = item2.price || item2.pricePerUnit;
        
        // Match by name and price (with small tolerance for price differences)
        return name1 === name2 && Math.abs(price1 - price2) < 0.01;
    }
    
    // If both have menuItem reference, compare them
    if (item1.menuItem && item2.menuItem) {
        const id1 = item1.menuItem._id || item1.menuItem;
        const id2 = item2.menuItem._id || item2.menuItem;
        return id1.toString() === id2.toString();
    }
    
    // Fallback: compare name and price (less reliable)
    const name1 = item1.name || item1.itemName;
    const name2 = item2.name || item2.itemName;
    const price1 = item1.price || item1.pricePerUnit;
    const price2 = item2.price || item2.pricePerUnit;
    
    return name1 === name2 && Math.abs(price1 - price2) < 0.01;
}

const billSchema = new mongoose.Schema(
    {
        billNumber: {
            type: String,
            required: false,
        },
        customerName: {
            type: String,
            default: null,
        },
        customerPhone: {
            type: String,
            default: null,
        },
        table: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Table",
            required: false,
            default: null,
        },
        orders: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Order",
            },
        ],
        sessions: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Session",
            },
        ],
        subtotal: {
            type: Number,
            required: true,
            min: 0,
            default: 0,
        },
        discount: {
            type: Number,
            default: 0,
            min: 0,
        },
        discountPercentage: {
            type: Number,
            default: 0,
            min: 0,
            max: 100,
        },
        tax: {
            type: Number,
            default: 0,
            min: 0,
        },
        total: {
            type: Number,
            required: true,
            min: 0,
            default: 0,
        },
        paid: {
            type: Number,
            default: 0,
            min: 0,
        },
        remaining: {
            type: Number,
            default: 0,
            min: 0,
            set: function(value) {
                // Ensure remaining is never negative
                return Math.max(0, value || 0);
            }
        },
        status: {
            type: String,
            enum: ["draft", "partial", "paid", "cancelled", "overdue"],
            default: "draft",
        },
        paymentMethod: {
            type: String,
            enum: ["cash", "card", "transfer", "mixed"],
            default: "cash",
        },
        payments: [
            {
                amount: {
                    type: Number,
                    required: true,
                    min: 0,
                },
                method: {
                    type: String,
                    enum: ["cash", "card", "transfer"],
                    required: true,
                },
                reference: {
                    type: String,
                    default: null,
                },
                timestamp: {
                    type: Date,
                    default: Date.now,
                },
                user: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "User",
                    required: true,
                },
            },
        ],
        // تتبع المدفوعات الجزئية للمشروبات
        partialPayments: [
            {
                orderId: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "Order",
                    required: true,
                },
                orderNumber: {
                    type: String,
                    required: true,
                },
                items: [
                    {
                        itemName: {
                            type: String,
                            required: true,
                        },
                        price: {
                            type: Number,
                            required: true,
                        },
                        quantity: {
                            type: Number,
                            required: true,
                            default: 1,
                        },
                        paidAt: {
                            type: Date,
                            default: Date.now,
                        },
                        paidBy: {
                            type: mongoose.Schema.Types.ObjectId,
                            ref: "User",
                            required: true,
                        },
                        paymentMethod: {
                            type: String,
                            enum: ["cash", "card", "transfer"],
                            required: true,
                        },
                    },
                ],
                totalPaid: {
                    type: Number,
                    required: true,
                    default: 0,
                },
            },
        ],
        // تتبع الدفع على مستوى الأصناف - نظام محسّن
        itemPayments: [
            {
                orderId: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "Order",
                    required: true,
                },
                itemId: {
                    type: String,
                    required: true,
                },
                menuItemId: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "MenuItem",
                    required: false, // Optional for backward compatibility
                },
                itemName: {
                    type: String,
                    required: true,
                },
                quantity: {
                    type: Number,
                    required: true,
                    min: 1,
                },
                paidQuantity: {
                    type: Number,
                    default: 0,
                    min: 0,
                },
                pricePerUnit: {
                    type: Number,
                    required: true,
                    min: 0,
                },
                totalPrice: {
                    type: Number,
                    required: true,
                    min: 0,
                },
                paidAmount: {
                    type: Number,
                    default: 0,
                    min: 0,
                },
                isPaid: {
                    type: Boolean,
                    default: false,
                },
                paidAt: {
                    type: Date,
                },
                paidBy: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "User",
                },
                paymentHistory: [
                    {
                        quantity: {
                            type: Number,
                            required: true,
                            min: 0,
                        },
                        amount: {
                            type: Number,
                            required: true,
                            min: 0,
                        },
                        paidAt: {
                            type: Date,
                            default: Date.now,
                        },
                        paidBy: {
                            type: mongoose.Schema.Types.ObjectId,
                            ref: "User",
                            required: true,
                        },
                        method: {
                            type: String,
                            enum: ["cash", "card", "transfer"],
                            required: true,
                        },
                    },
                ],
            },
        ],
        // تتبع الدفع الجزئي للجلسات
        sessionPayments: [
            {
                sessionId: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "Session",
                    required: true,
                },
                sessionCost: {
                    type: Number,
                    required: true,
                    min: 0,
                },
                paidAmount: {
                    type: Number,
                    default: 0,
                    min: 0,
                },
                remainingAmount: {
                    type: Number,
                    required: true,
                    min: 0,
                    set: function(value) {
                        // Ensure remaining amount is never negative
                        return Math.max(0, value || 0);
                    }
                },
                payments: [
                    {
                        amount: {
                            type: Number,
                            required: true,
                            min: 0,
                        },
                        paidAt: {
                            type: Date,
                            default: Date.now,
                        },
                        paidBy: {
                            type: mongoose.Schema.Types.ObjectId,
                            ref: "User",
                            required: true,
                        },
                        method: {
                            type: String,
                            enum: ["cash", "card", "transfer"],
                            required: true,
                        },
                    },
                ],
            },
        ],
        // سجل الدفعات المحسّن
        paymentHistory: [
            {
                timestamp: {
                    type: Date,
                    default: Date.now,
                },
                amount: {
                    type: Number,
                    required: true,
                    min: 0,
                },
                method: {
                    type: String,
                    enum: ["cash", "card", "transfer", "mixed"],
                    required: true,
                },
                paidBy: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "User",
                    required: true,
                },
                type: {
                    type: String,
                    enum: ["full", "partial-items", "partial-session", "mixed"],
                    required: true,
                },
                details: {
                    paidItems: [
                        {
                            itemName: String,
                            quantity: Number,
                            amount: Number,
                        },
                    ],
                    paidSessions: [
                        {
                            sessionId: mongoose.Schema.Types.ObjectId,
                            amount: Number,
                            remainingAfter: Number,
                        },
                    ],
                },
            },
        ],
        qrCode: {
            type: String,
            default: null,
        },
        qrCodeUrl: {
            type: String,
            default: null,
        },
        notes: {
            type: String,
            default: null,
        },
        billType: {
            type: String,
            enum: ["cafe", "playstation", "computer"],
            default: "cafe",
            required: true,
        },
        dueDate: {
            type: Date,
            default: null,
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        updatedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },
        organization: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Organization",
            required: true,
        },
        // تتبع ترقيات النظام التلقائية
        upgradeHistory: [
            {
                type: {
                    type: String,
                    required: true,
                },
                upgradedAt: {
                    type: Date,
                    default: Date.now,
                },
                upgradedCount: {
                    type: Number,
                    default: 0,
                },
                failedCount: {
                    type: Number,
                    default: 0,
                },
                upgradeLog: [String],
            },
        ],
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true },
    }
);

// Virtual field for remainingQuantity in itemPayments
billSchema.virtual('itemPayments.remainingQuantity').get(function() {
    if (this.itemPayments && Array.isArray(this.itemPayments)) {
        return this.itemPayments.map(item => ({
            ...item.toObject ? item.toObject() : item,
            remainingQuantity: (item.quantity || 0) - (item.paidQuantity || 0)
        }));
    }
    return [];
});

// Generate bill number with full timestamp
billSchema.pre("save", async function (next) {
    if (this.isNew && !this.billNumber) {
        try {
            const now = new Date();

            // Format date and time components
            const year = now.getFullYear().toString().slice(-2);
            const month = String(now.getMonth() + 1).padStart(2, "0");
            const day = String(now.getDate()).padStart(2, "0");
            const hours = String(now.getHours()).padStart(2, "0");
            const minutes = String(now.getMinutes()).padStart(2, "0");
            const seconds = String(now.getSeconds()).padStart(2, "0");
            const milliseconds = String(now.getMilliseconds()).padStart(3, "0");

            // Create a unique identifier using the full timestamp
            const timestamp = `${year}${month}${day}${hours}${minutes}${seconds}${milliseconds}`;

            // Create bill number using the timestamp
            this.billNumber = `BILL-${timestamp}`;
        } catch (error) {
            // Fallback bill number
            this.billNumber = `INV-${Date.now()}`;
        }
    }
    next();
});

// Initialize itemPayments and sessionPayments for new bills or when orders/sessions change
billSchema.pre("save", async function (next) {
    // تهيئة itemPayments و sessionPayments فقط للفواتير الجديدة أو عند تغيير الطلبات/الجلسات
    if (
        this.isNew ||
        this.isModified("orders") ||
        this.isModified("sessions")
    ) {
        // تنظيف itemPayments من الأصناف المحذوفة وإعادة توزيع المدفوعات
        if (this.itemPayments && this.itemPayments.length > 0 && this.orders && this.orders.length > 0) {
            try {
                // Populate orders if not already populated
                if (!this.populated('orders')) {
                    await this.populate("orders");
                }

                // جمع جميع itemIds الموجودة فعلياً في الطلبات مع تفاصيل الأصناف
                const validItemIds = new Set();
                const currentOrderItems = new Map(); // Map itemId -> item details
                const itemsByType = new Map(); // Map itemKey -> array of itemIds
                
                this.orders.forEach((order) => {
                    if (order.items && order.items.length > 0) {
                        order.items.forEach((item, index) => {
                            const itemId = `${order._id}-${index}`;
                            validItemIds.add(itemId);
                            
                            const itemDetails = {
                                name: item.name,
                                price: item.price,
                                quantity: item.quantity,
                                orderId: order._id
                            };
                            currentOrderItems.set(itemId, itemDetails);
                            
                            // Group items by menuItem ID (the correct way)
                            const itemKey = getItemRedistributionKey(item);
                            if (!itemsByType.has(itemKey)) {
                                itemsByType.set(itemKey, []);
                            }
                            itemsByType.get(itemKey).push(itemId);
                        });
                    }
                });

                // Track payments to redistribute
                const paymentsToRedistribute = new Map(); // Map itemKey -> total paid amount
                const removedPayments = [];
                let totalRemovedAmount = 0;
                let totalAdjustedAmount = 0;
                
                // First pass: collect payments from deleted items and track adjustments
                this.itemPayments = this.itemPayments.filter(ip => {
                    const isValid = validItemIds.has(ip.itemId);
                    
                    if (!isValid) {
                        // Item was deleted - collect payment for redistribution
                        // Use menuItem ID if available, fallback to name|price for backward compatibility
                        const itemKey = getItemRedistributionKey(ip);
                        const paidAmount = ip.paidAmount || 0;
                        
                        if (paidAmount > 0) {
                            if (!paymentsToRedistribute.has(itemKey)) {
                                paymentsToRedistribute.set(itemKey, 0);
                            }
                            paymentsToRedistribute.set(itemKey, paymentsToRedistribute.get(itemKey) + paidAmount);
                        }
                        
                        removedPayments.push({
                            itemName: ip.itemName,
                            itemId: ip.itemId,
                            paidAmount: paidAmount,
                            paidQuantity: ip.paidQuantity || 0
                        });
                        totalRemovedAmount += paidAmount;
                        
                        return false;
                    }
                    
                    // Item still exists - check if quantity changed
                    const currentItem = currentOrderItems.get(ip.itemId);
                    if (currentItem && currentItem.quantity !== ip.quantity) {
                        const oldPaidAmount = ip.paidAmount || 0;
                        
                        // Update item details
                        ip.itemName = currentItem.name;
                        ip.pricePerUnit = currentItem.price;
                        ip.quantity = currentItem.quantity;
                        ip.totalPrice = currentItem.price * currentItem.quantity;
                        
                        // Adjust paid quantity if it exceeds new total quantity
                        if (ip.paidQuantity > currentItem.quantity) {
                            ip.paidQuantity = currentItem.quantity;
                            ip.paidAmount = currentItem.price * currentItem.quantity;
                            ip.isPaid = true;
                            
                            const adjustedAmount = oldPaidAmount - ip.paidAmount;
                            totalAdjustedAmount += adjustedAmount;
                            
                           
                        } else {
                            // Recalculate paid amount based on current price
                            ip.paidAmount = ip.paidQuantity * currentItem.price;
                            ip.isPaid = ip.paidQuantity >= ip.quantity;
                        }
                    }
                    
                    return true;
                });

                // Second pass: redistribute payments using smart matching
                for (const [itemKey, totalPaidAmount] of paymentsToRedistribute) {
                    if (totalPaidAmount <= 0) continue;
                    
                    // Find all items that can receive this payment (using smart matching)
                    const eligibleItems = [];
                    
                    // Get a sample of the deleted item for comparison
                    const deletedItemSample = removedPayments.find(rp => 
                        getItemRedistributionKey(rp) === itemKey
                    );
                    
                    if (!deletedItemSample) continue;
                    
                    // Find all current items that can share payments with the deleted item
                    this.itemPayments.forEach(ip => {
                        if (canSharePayments(deletedItemSample, ip)) {
                            const availableQuantity = (ip.quantity || 0) - (ip.paidQuantity || 0);
                            if (availableQuantity > 0) {
                                eligibleItems.push({
                                    itemPayment: ip,
                                    availableQuantity: availableQuantity
                                });
                            }
                        }
                    });
                    
                    if (eligibleItems.length === 0) {
                        console.warn(`⚠️ [Pre-save] No eligible items found for redistribution: ${itemKey}`);
                        continue;
                    }
                    
                    // Calculate unit price from deleted item or eligible items
                    let unitPrice = deletedItemSample.pricePerUnit || 0;
                    if (unitPrice <= 0 && eligibleItems.length > 0) {
                        unitPrice = eligibleItems[0].itemPayment.pricePerUnit || 0;
                    }
                    
                    if (unitPrice <= 0) {
                        console.warn(`⚠️ [Pre-save] Could not determine unit price for: ${itemKey}`);
                        continue;
                    }
                    
                    const totalQuantityToDistribute = Math.round(totalPaidAmount / unitPrice);
                    let remainingQuantityToDistribute = totalQuantityToDistribute;
                    
                    // Distribute payments across eligible items
                    for (const eligible of eligibleItems) {
                        if (remainingQuantityToDistribute <= 0) break;
                        
                        const quantityToAdd = Math.min(remainingQuantityToDistribute, eligible.availableQuantity);
                        const amountToAdd = quantityToAdd * unitPrice;
                        
                        const ip = eligible.itemPayment;
                        ip.paidQuantity = (ip.paidQuantity || 0) + quantityToAdd;
                        ip.paidAmount = (ip.paidAmount || 0) + amountToAdd;
                        ip.isPaid = ip.paidQuantity >= ip.quantity;
                        ip.paidAt = new Date();
                        
                        // Add to payment history with more details
                        if (!ip.paymentHistory) {
                            ip.paymentHistory = [];
                        }
                        ip.paymentHistory.push({
                            quantity: quantityToAdd,
                            amount: amountToAdd,
                            paidAt: new Date(),
                            method: 'smart_redistribution',
                            note: `Smart redistribution from deleted item: ${deletedItemSample.itemName}`,
                            originalItemKey: itemKey,
                            redistributionMethod: deletedItemSample.menuItemId ? 'menuItemId' : 'name_price'
                        });
                        
                        remainingQuantityToDistribute -= quantityToAdd;
                        
                    }
                    
                    if (remainingQuantityToDistribute > 0) {
                        console.warn(`⚠️ [Pre-save] Could not redistribute ${remainingQuantityToDistribute} units for: ${itemKey}`);
                    }
                }

               
            } catch (error) {
                console.error("Error cleaning itemPayments:", error);
            }
        }

        // تهيئة itemPayments من الطلبات
        if (this.orders && this.orders.length > 0) {
            try {
                // Populate orders if not already populated
                if (!this.populated('orders')) {
                    await this.populate("orders");
                }
                
                // إذا لم يكن هناك itemPayments، نبدأ من الصفر
                if (!this.itemPayments) {
                    this.itemPayments = [];
                }
                
                // نجمع الـ itemIds الموجودة في itemPayments
                const existingItemIds = new Set(
                    this.itemPayments.map(ip => ip.itemId).filter(Boolean)
                );

                // نضيف فقط الأصناف الجديدة (اللي مش موجودة في itemPayments)
                this.orders.forEach((order) => {
                    const orderIdStr = order._id?.toString();
                    
                    if (order.items && order.items.length > 0) {
                        order.items.forEach((item, index) => {
                            const itemId = `${orderIdStr}-${index}`;
                            
                            // إذا كان العنصر موجود بالفعل في itemPayments، نتخطاه
                            if (existingItemIds.has(itemId)) {
                                return;
                            }
                            
                            // استخدام item.name مباشرة لأنه الاسم الصحيح المحفوظ في الطلب
                            const itemName = item.name || item.menuItem?.name || item.menuItem?.arabicName || "Unknown";
                            const price = item.price || 0;
                            const quantity = item.quantity || 1;
                            const addons = item.addons || [];
                            const menuItemId = item.menuItem?._id || item.menuItem || null;

                            // إضافة itemPayments لجميع الفواتير (حتى الجديدة) لضمان ظهور جميع الأصناف
                            
                            this.itemPayments.push({
                                orderId: order._id,
                                itemId: itemId,
                                menuItemId: menuItemId,
                                itemName,
                                quantity,
                                paidQuantity: 0,
                                pricePerUnit: price,
                                totalPrice: price * quantity,
                                paidAmount: 0,
                                isPaid: false,
                                addons: addons,
                                paymentHistory: [],
                            });
                        });
                    }
                });
            } catch (error) {
                // إذا فشل populate، نستمر بدون تهيئة itemPayments
                console.error("Error initializing itemPayments:", error);
            }
        }

        // تهيئة sessionPayments من الجلسات
        if (this.sessions && this.sessions.length > 0) {
            try {
                await this.populate("sessions");
                
                // إذا لم يكن هناك sessionPayments، نبدأ من الصفر
                if (!this.sessionPayments) {
                    this.sessionPayments = [];
                }
                
                // نجمع الـ sessionIds الموجودة في sessionPayments
                const existingSessionIds = new Set(
                    this.sessionPayments.map(sp => sp.sessionId?.toString()).filter(Boolean)
                );

                // نضيف فقط الجلسات الجديدة (اللي مش موجودة في sessionPayments)
                for (const session of this.sessions) {
                    const sessionIdStr = session._id?.toString();
                    
                    // إذا كانت الجلسة موجودة بالفعل في sessionPayments، نحدث بياناتها
                    if (existingSessionIds.has(sessionIdStr)) {
                        const existingPayment = this.sessionPayments.find(
                            sp => sp.sessionId?.toString() === sessionIdStr
                        );
                        
                        if (existingPayment) {
                            const sessionCost = session.finalCost || session.totalCost || 0;
                            
                            // تحديث sessionCost إذا تغير
                            if (existingPayment.sessionCost !== sessionCost) {
                                existingPayment.sessionCost = sessionCost;
                                // تحديث remainingAmount بناءً على المدفوع
                                existingPayment.remainingAmount = sessionCost - (existingPayment.paidAmount || 0);
                            }
                        }
                        continue;
                    }
                    
                    const sessionCost = session.finalCost || session.totalCost || 0;
                    this.sessionPayments.push({
                        sessionId: session._id,
                        sessionCost,
                        paidAmount: 0,
                        remainingAmount: sessionCost,
                        payments: [],
                    });
                }
            } catch (error) {
                // إذا فشل populate، نستمر بدون تهيئة sessionPayments
                console.error("Error initializing sessionPayments:", error);
            }
        }
    }
    next();
});

// Update isPaid and paidAmount based on paidQuantity
billSchema.pre("save", function (next) {
    // تحديث isPaid و paidAmount لكل صنف بناءً على paidQuantity
    if (this.itemPayments && this.itemPayments.length > 0) {
        this.itemPayments.forEach((item) => {
            // التحقق من صحة البيانات أولاً
            const paidQuantity = Math.max(0, item.paidQuantity || 0);
            const totalQuantity = Math.max(0, item.quantity || 0);
            const pricePerUnit = Math.max(0, item.pricePerUnit || 0);

            // تصحيح paidQuantity إذا كانت تتجاوز الكمية الإجمالية
            if (paidQuantity > totalQuantity) {
                console.warn(`⚠️ [Pre-save] Correcting paidQuantity for item ${item.itemName}: ${paidQuantity} -> ${totalQuantity}`);
                item.paidQuantity = totalQuantity;
                // إعادة حساب paidAmount بناءً على الكمية المصححة
                item.paidAmount = totalQuantity * pricePerUnit;
            } else {
                // تحديث paidAmount بناءً على paidQuantity المصححة
                item.paidAmount = (item.paidQuantity || 0) * pricePerUnit;
            }

            // تحديث isPaid بناءً على المقارنة بين paidQuantity و quantity
            item.isPaid = (item.paidQuantity || 0) >= (item.quantity || 0);

        });
    }
    next();
});

// Calculate totals and status
billSchema.pre("save", function (next) {
    // حساب المبلغ المتبقي باستخدام calculateRemainingAmount
    this.calculateRemainingAmount();

    if (this.status !== "cancelled" && !this._skipStatusRecalculation) {
        // Check if we have itemPayments to determine status based on quantities
        // Only use itemPayments logic if the bill actually has payments
        if (this.itemPayments && this.itemPayments.length > 0 && this.paid > 0) {
            // First, we need to know the total number of items in all orders
            let totalItemsCount = 0;
            let totalOrderItemsValue = 0;
            
            if (this.orders && this.orders.length > 0) {
                this.orders.forEach(order => {
                    if (order.items && Array.isArray(order.items)) {
                        order.items.forEach(item => {
                            totalItemsCount++;
                            totalOrderItemsValue += (item.price * item.quantity);
                        });
                    }
                });
            }
            
            // Count fully paid items and calculate total paid value from itemPayments
            let fullyPaidItemsCount = 0;
            let partiallyPaidItemsCount = 0;
            let totalPaidFromItems = 0;
            
            for (const item of this.itemPayments) {
                const paidQty = item.paidQuantity || 0;
                const totalQty = item.quantity || 0;
                const paidAmount = item.paidAmount || 0;
                
                totalPaidFromItems += paidAmount;
                
                if (paidQty >= totalQty && totalQty > 0) {
                    // Item is fully paid
                    fullyPaidItemsCount++;
                } else if (paidQty > 0 && paidQty < totalQty) {
                    // Item is partially paid
                    partiallyPaidItemsCount++;
                }
            }
            
            // Check if all items are covered by itemPayments and fully paid
            // Alternative approach: check if total paid amount equals total order value
            const allItemsFullyPaid = (fullyPaidItemsCount === totalItemsCount) && (totalItemsCount > 0);
            const allItemsValuePaid = Math.abs(totalPaidFromItems - totalOrderItemsValue) < 0.01;
            const someItemsPartiallyPaid = partiallyPaidItemsCount > 0 || (fullyPaidItemsCount > 0 && fullyPaidItemsCount < totalItemsCount);
                       
            // Also check sessionPayments if they exist
            let allSessionsFullyPaid = true;
            let someSessionsPartiallyPaid = false;
            let totalSessionsCount = 0;
            let fullyPaidSessionsCount = 0;
            
            // Count total sessions in the bill
            if (this.sessions && this.sessions.length > 0) {
                totalSessionsCount = this.sessions.length;
            }
            
            if (this.sessionPayments && this.sessionPayments.length > 0) {
                for (const session of this.sessionPayments) {
                    const remaining = session.remainingAmount || 0;
                    const paid = session.paidAmount || 0;
                    
                    if (remaining <= 0.01) {
                        // Session is fully paid
                        fullyPaidSessionsCount++;
                    } else {
                        allSessionsFullyPaid = false;
                        
                        if (paid > 0) {
                            someSessionsPartiallyPaid = true;
                        }
                    }
                }
            } else if (totalSessionsCount > 0) {
                // If there are sessions but no sessionPayments, sessions are not paid
                allSessionsFullyPaid = false;
            }
            
            // If there are no sessions at all, consider sessions as fully paid
            if (totalSessionsCount === 0) {
                allSessionsFullyPaid = true;
            }
            
          
            
            // Set status based on item and session payment status
            // Use both count-based and value-based checks
            const itemsFullyPaid = allItemsFullyPaid || allItemsValuePaid;
          
            
            // تحديد الحالة بناءً على الدفعات والجلسات
            if (itemsFullyPaid && allSessionsFullyPaid && this.remaining <= 0.01) {
                // جميع الأصناف والجلسات مدفوعة بالكامل
                this.status = "paid";
            } else if (someItemsPartiallyPaid || someSessionsPartiallyPaid || (this.paid > 0 && this.remaining > 0.01)) {
                // بعض الأصناف/الجلسات مدفوعة جزئياً
                this.status = "partial";
            } else if (this.paid === 0) {
                // لا توجد دفعات
                this.status = "draft";
            } 
        } else {
            // Fallback to old logic if no itemPayments (backward compatibility)
            if (this.remaining <= 0.01 && this.paid > 0) {
                // إذا كان المبلغ المتبقي = صفر وتم دفع شيء، تصبح مدفوعة بالكامل
                this.status = "paid";
            } else if (this.paid > 0 && this.paid < this.total) {
                // إذا تم دفع جزء من المبلغ، تصبح مدفوعة جزئياً
                this.status = "partial";
            } else if (this.paid === 0) {
                // إذا لم يتم دفع أي شيء، تبقى مسودة
                this.status = "draft";
            }
        }

        // التحقق من التأخير (إذا كان هناك تاريخ استحقاق)
        if (
            this.dueDate &&
            this.dueDate < new Date() &&
            this.status !== "paid"
        ) {
            this.status = "overdue";
        }
    }

    next();
});

// Additional pre-save middleware to ensure remaining is never negative
billSchema.pre("save", function (next) {
    // Force remaining to be non-negative
    if (this.remaining < 0) {
        console.warn(`⚠️ [Pre-save] Bill ${this.billNumber || this._id}: Forcing remaining from ${this.remaining} to 0`);
        this.remaining = 0;
    }
    
    // Also ensure paid doesn't exceed total
    if (this.paid > this.total) {
        console.warn(`⚠️ [Pre-save] Bill ${this.billNumber || this._id}: Paid (${this.paid}) exceeds total (${this.total})`);
        this.paid = this.total;
        this.remaining = 0;
    }
    
    next();
});

// Method to generate QR code
billSchema.methods.generateQRCode = async function (baseUrl = null, forceRegenerate = false) {
    if ((!this.qrCode || forceRegenerate) && this._id) {
        try {
            // استخدام الـ baseUrl المرسل أو الافتراضي من البيئة
            const frontendUrl = baseUrl || process.env.FRONTEND_URL || "http://localhost:3000";
            // إزالة الـ slash الزائد إذا كان موجود
            const cleanUrl = frontendUrl.endsWith('/') ? frontendUrl.slice(0, -1) : frontendUrl;
            const billUrl = `${cleanUrl}/bill/${this._id}`;

            // إنشاء QR code يحتوي على الرابط المباشر فقط
            const qrCodeDataURL = await QRCode.toDataURL(billUrl);

            this.qrCode = qrCodeDataURL;
            this.qrCodeUrl = billUrl;
        } catch (error) {}
    }
    return this;
};

// Generate QR Code after save
billSchema.post("save", async function (doc) {
    // Only generate QR code if it doesn't exist
    if (!doc.qrCode && doc._id) {
        try {
            await doc.generateQRCode();

            // Use updateOne to save without triggering hooks again
            await this.constructor.updateOne(
                { _id: doc._id },
                {
                    $set: {
                        qrCode: doc.qrCode,
                        qrCodeUrl: doc.qrCodeUrl,
                    },
                },
                { timestamps: false } // Don't update timestamps
            );
        } catch (error) {}
    }
});

// Add payment
billSchema.methods.addPayment = function (
    amount,
    method,
    user,
    reference = null,
    isPartial = false,
    discountPercentage = undefined
) {
    // Update discount percentage if provided
    if (discountPercentage !== undefined) {
        this.discountPercentage = parseFloat(discountPercentage);
        // Recalculate total with new discount (synchronous)
        const subtotal = this.subtotal || 0;
        const discount = (subtotal * this.discountPercentage) / 100;
        this.discount = discount;
        this.total = subtotal - discount + (this.tax || 0);
    }

    // If this is not a partial payment, update the paid amount
    if (!isPartial) {
        // Add the payment to the payments array
        this.payments.push({
            amount,
            method,
            reference,
            user,
            timestamp: new Date(),
            type: 'full', // تحديد نوع الدفع كامل
        });

        // Don't update this.paid here - let calculateRemainingAmount handle it
        // to avoid double counting with itemPayments/sessionPayments
    }

    // Recalculate paid and remaining using the unified calculation method
    this.calculateRemainingAmount();

    // Update status based on payment
    if (this.paid >= this.total) {
        this.status = "paid";
        this.remaining = 0; // Ensure remaining is 0 if fully paid
        this.paid = this.total; // Ensure we don't overpay
    } else if (this.paid > 0) {
        this.status = "partial";
    } else {
        this.status = "draft";
    }

    // Note: Don't save here, let the controller handle saving
    // to avoid double saves
    return this;
};

// Add partial payment for specific items
billSchema.methods.addPartialPayment = function (
    orderId,
    orderNumber,
    items,
    user,
    paymentMethod
) {
    // حساب المبلغ المدفوع: سعر الصنف + مجموع أسعار الإضافات لكل قطعة
    const totalPaid = items.reduce((sum, item) => {
        // حساب سعر العنصر الأساسي
        const itemTotal = item.price * item.quantity;

        return sum + itemTotal;
    }, 0);

    // Add to old partialPayments system (for backward compatibility)
    this.partialPayments.push({
        orderId,
        orderNumber,
        items: items.map((item) => ({
            itemName: item.itemName,
            price: item.price,
            quantity: item.quantity,
            paidAt: item.paidAt,
            paidBy: user._id,
            paymentMethod,
        })),
        totalPaid,
    });

    // Add to new itemPayments system (this is what the frontend expects)
    items.forEach((item) => {
        // Find existing itemPayment using itemId (new system)
        let existingPayment = this.itemPayments.find(
            (payment) => payment.itemId === item.itemId
        );

        if (existingPayment) {
            // Update existing payment
            existingPayment.paidQuantity = (existingPayment.paidQuantity || 0) + item.quantity;
            existingPayment.paidAmount = (existingPayment.paidAmount || 0) + (existingPayment.pricePerUnit * item.quantity);
            existingPayment.isPaid = existingPayment.paidQuantity >= existingPayment.quantity;
            existingPayment.paidAt = new Date();
            existingPayment.paidBy = user._id;
        } else {
            // Find the corresponding order item using itemId format: orderId-itemIndex
            const [orderIdFromItem, itemIndexStr] = item.itemId.split('-');
            const itemIndex = parseInt(itemIndexStr);
            
            const order = this.orders.find(o => o._id.toString() === orderIdFromItem);
            if (!order || !order.items[itemIndex]) {
                console.error(`Order item not found for itemId: ${item.itemId}`);
                return;
            }
            
            const orderItem = order.items[itemIndex];
            
            // Create new payment record using itemId
            this.itemPayments.push({
                orderId: orderIdFromItem,
                itemId: item.itemId, // Use the provided itemId directly
                menuItemId: orderItem.menuItem?._id || orderItem.menuItem || null,
                itemName: orderItem.name,
                quantity: orderItem.quantity, // Total quantity of this item in the order
                paidQuantity: item.quantity, // Quantity being paid for now
                pricePerUnit: orderItem.price,
                totalPrice: orderItem.price * orderItem.quantity, // Total price for all quantity
                paidAmount: orderItem.price * item.quantity, // Amount being paid now
                isPaid: item.quantity >= orderItem.quantity, // True if paying for full quantity
                paidAt: new Date(),
                paidBy: user._id,
                addons: orderItem.addons || []
            });
        }
    });

    this.paid += totalPaid;

    // Update status based on payment
    if (this.paid >= this.total) {
        this.status = "paid";
        this.remaining = 0;
        this.paid = this.total;
    } else if (this.paid > 0) {
        this.status = "partial";
        this.remaining = this.total - this.paid;
    }

    return this;
};

// Get partial payments summary
billSchema.methods.getPartialPaymentsSummary = function () {
    const summary = {
        totalPaid: 0,
        orders: {},
    };

    this.partialPayments.forEach((payment) => {
        summary.totalPaid += payment.totalPaid;
        if (!summary.orders[payment.orderId]) {
            summary.orders[payment.orderId] = {
                orderNumber: payment.orderNumber,
                items: [],
                totalPaid: 0,
            };
        }
        summary.orders[payment.orderId].items.push(...payment.items);
        summary.orders[payment.orderId].totalPaid += payment.totalPaid;
    });

    return summary;
};

// Method to automatically upgrade old itemPayments to new format
billSchema.methods.upgradeItemPaymentsToNewFormat = async function() {
    // Import config
    const autoUpgradeConfig = (await import('../config/autoUpgradeConfig.js')).default;
    
    // Check if auto-upgrade is enabled
    if (!autoUpgradeConfig.enabled || !autoUpgradeConfig.types.itemPayments.enabled) {
        return { upgraded: false, reason: 'Auto-upgrade disabled' };
    }

    if (!this.itemPayments || this.itemPayments.length === 0) {
        return { upgraded: false, reason: 'No itemPayments to upgrade' };
    }

    // Check if already upgraded (has menuItemId)
    const needsUpgrade = this.itemPayments.some(ip => !ip.menuItemId);
    if (!needsUpgrade) {
        return { upgraded: false, reason: 'Already using new format' };
    }

    // Check if recently upgraded (performance optimization)
    // BUT only skip if ALL items are already upgraded
    if (autoUpgradeConfig.performance.skipIfRecentlyUpgraded && this.upgradeHistory) {
        const recentUpgrade = this.upgradeHistory.find(uh => 
            uh.type === 'itemPayments_menuItemId' && 
            uh.upgradedAt > new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
        );
        
        // Only skip if recently upgraded AND all items are already upgraded
        if (recentUpgrade && !needsUpgrade) {
            return { upgraded: false, reason: 'Recently upgraded (within 24 hours) and all items are upgraded' };
        }
        
        // If there are still items needing upgrade, continue with upgrade regardless of recent upgrade
        if (recentUpgrade && needsUpgrade) {
            console.log(`🔄 [Auto-Upgrade] Bill ${this.billNumber} was recently upgraded but still has ${this.itemPayments.filter(ip => !ip.menuItemId).length} items needing upgrade`);
        }
    }

    console.log(`🔄 [Auto-Upgrade] Upgrading bill ${this.billNumber} to new format...`);
    console.log(`📊 [Auto-Upgrade] Total itemPayments: ${this.itemPayments.length}, Need upgrade: ${this.itemPayments.filter(ip => !ip.menuItemId).length}`);

    let upgradedCount = 0;
    let failedCount = 0;
    const upgradeLog = [];
    const startTime = Date.now();

    try {
        // Populate orders if needed
        if (!this.populated('orders')) {
            await this.populate('orders');
        }

        // Process each itemPayment (with batch size limit)
        const batchSize = autoUpgradeConfig.options.batchSize;
        const itemsNeedingUpgrade = this.itemPayments.filter(ip => !ip.menuItemId);
        
        // If batchSize is -1, process all items. Otherwise, limit to batchSize
        const itemsToProcess = batchSize === -1 ? itemsNeedingUpgrade : itemsNeedingUpgrade.slice(0, batchSize);

        for (const itemPayment of itemsToProcess) {
            try {
                // Find the corresponding order and item
                const [orderIdStr, itemIndexStr] = itemPayment.itemId.split('-');
                const itemIndex = parseInt(itemIndexStr);

                const order = this.orders.find(o => o._id.toString() === orderIdStr);
                if (!order || !order.items[itemIndex]) {
                    upgradeLog.push(`⚠️ Could not find order item for ${itemPayment.itemId}`);
                    failedCount++;
                    continue;
                }

                const orderItem = order.items[itemIndex];
                
                // Try to get menuItemId from order item
                if (orderItem.menuItem) {
                    // Already has menuItem reference
                    itemPayment.menuItemId = orderItem.menuItem._id || orderItem.menuItem;
                    upgradedCount++;
                    upgradeLog.push(`✅ Linked ${itemPayment.itemName} to existing menuItem`);
                } else {
                    // Try to find menuItem by name (with timeout)
                    const MenuItem = this.constructor.db.model('MenuItem');
                    
                    const findPromise = MenuItem.findOne({
                        $or: [
                            { name: itemPayment.itemName },
                            { arabicName: itemPayment.itemName }
                        ],
                        organization: this.organization
                    });

                    // Add timeout to prevent hanging
                    const timeoutPromise = new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('Timeout')), autoUpgradeConfig.options.timeout)
                    );

                    const menuItem = await Promise.race([findPromise, timeoutPromise]);

                    if (menuItem) {
                        itemPayment.menuItemId = menuItem._id;
                        upgradedCount++;
                        upgradeLog.push(`✅ Found and linked ${itemPayment.itemName} to menuItem ${menuItem._id}`);
                    } else {
                        upgradeLog.push(`⚠️ Could not find menuItem for: ${itemPayment.itemName}`);
                        failedCount++;
                    }
                }

            } catch (error) {
                failedCount++;
                upgradeLog.push(`❌ Error upgrading ${itemPayment.itemName}: ${error.message}`);
            }
        }

        // Save if any upgrades were made
        if (upgradedCount > 0) {
            // Add upgrade metadata
            if (!this.upgradeHistory) {
                this.upgradeHistory = [];
            }
            
            this.upgradeHistory.push({
                type: 'itemPayments_menuItemId',
                upgradedAt: new Date(),
                upgradedCount: upgradedCount,
                failedCount: failedCount,
                upgradeLog: upgradeLog,
                executionTime: Date.now() - startTime,
                batchSize: itemsToProcess.length
            });

            await this.save();
            
            const totalItems = this.itemPayments.length;
            const remainingItems = this.itemPayments.filter(ip => !ip.menuItemId).length;
            const isFullyUpgraded = remainingItems === 0;
            
            console.log(`✅ [Auto-Upgrade] Successfully upgraded ${upgradedCount} itemPayments in bill ${this.billNumber} (${Date.now() - startTime}ms)`);
            console.log(`📊 [Auto-Upgrade] Status: ${totalItems - remainingItems}/${totalItems} items upgraded${isFullyUpgraded ? ' - FULLY UPGRADED! 🎉' : `, ${remainingItems} remaining`}`);
        } else {
            const totalItems = this.itemPayments.length;
            const remainingItems = this.itemPayments.filter(ip => !ip.menuItemId).length;
            console.log(`⚠️ [Auto-Upgrade] No items were upgraded in bill ${this.billNumber}. Status: ${totalItems - remainingItems}/${totalItems} items upgraded, ${remainingItems} remaining`);
            if (failedCount > 0) {
                console.log(`❌ [Auto-Upgrade] ${failedCount} items failed to upgrade. Check logs for details.`);
            }
        }

        return {
            upgraded: upgradedCount > 0,
            upgradedCount,
            failedCount,
            upgradeLog,
            executionTime: Date.now() - startTime
        };

    } catch (error) {
        console.error(`❌ [Auto-Upgrade] Error upgrading bill ${this.billNumber}:`, error);
        return {
            upgraded: false,
            error: error.message,
            upgradedCount: 0,
            failedCount: this.itemPayments.length,
            executionTime: Date.now() - startTime
        };
    }
};
billSchema.methods.cleanupItemPayments = async function() {
    if (!this.itemPayments || this.itemPayments.length === 0) {
        return { cleaned: 0, remaining: 0 };
    }

    // Import validator
    const { validateItemPayments, fixItemPayments, logValidationResults } = await import('../utils/itemPaymentValidator.js');

    // Validate current state
    const validation = validateItemPayments(this);
    logValidationResults(this._id, validation);

    // Populate orders if needed
    if (!this.populated('orders')) {
        await this.populate('orders');
    }

    // جمع جميع itemIds الموجودة فعلياً في الطلبات
    const validItemIds = new Set();
    if (this.orders && this.orders.length > 0) {
        this.orders.forEach((order) => {
            if (order.items && order.items.length > 0) {
                order.items.forEach((item, index) => {
                    validItemIds.add(`${order._id}-${index}`);
                });
            }
        });
    }

    const originalCount = this.itemPayments.length;
    const cleanedItems = [];

    // إزالة itemPayments للأصناف المحذوفة وحفظ المحذوفة للـ logging
    this.itemPayments = this.itemPayments.filter(ip => {
        const isValid = validItemIds.has(ip.itemId);
        if (!isValid) {
            cleanedItems.push({
                itemName: ip.itemName,
                itemId: ip.itemId,
                paidAmount: ip.paidAmount || 0,
                menuItemId: ip.menuItemId
            });
        }
        return isValid;
    });

    // Apply automatic fixes
    const fixResult = fixItemPayments(this);

    const cleanedCount = originalCount - this.itemPayments.length;

    return {
        cleaned: cleanedCount,
        remaining: this.itemPayments.length,
        cleanedItems: cleanedItems,
        fixes: fixResult.fixes,
        totalFixed: fixResult.totalFixed
    };
};

// Calculate remaining amount based on all payment types
billSchema.methods.calculateRemainingAmount = function () {
    let totalPaidFromItems = 0;
    let totalPaidFromSessions = 0;
    let totalPaidFromFullPayments = 0;

    // Check if we're using the new itemPayments/sessionPayments system
    const hasItemPayments = this.itemPayments && this.itemPayments.length > 0;
    const hasSessionPayments = this.sessionPayments && this.sessionPayments.length > 0;
    const usingNewSystem = hasItemPayments || hasSessionPayments;

    if (usingNewSystem) {
        // Use new system: itemPayments + sessionPayments
        
        // 1. حساب المدفوع من الأصناف (itemPayments)
        if (hasItemPayments) {
            this.itemPayments.forEach((item) => {
                const paidAmount = item.paidAmount || 0;
                totalPaidFromItems += paidAmount;
            });
        }

        // 2. حساب المدفوع من الجلسات (sessionPayments)
        if (hasSessionPayments) {
            this.sessionPayments.forEach((session) => {
                const paidAmount = session.paidAmount || 0;
                totalPaidFromSessions += paidAmount;
            });
        }
        
        // Don't count payments array when using new system to avoid double counting
        
    } else {
        // Use old system: payments array only
        
        // 3. حساب المدفوع من الدفعات الكاملة (payments array)
        if (this.payments && this.payments.length > 0) {
            this.payments.forEach((payment) => {
                const amount = payment.amount || 0;
                totalPaidFromFullPayments += amount;
            });
        }
    }

    // 4. جمع جميع المدفوعات
    const totalPaid = totalPaidFromItems + totalPaidFromSessions + totalPaidFromFullPayments;

    // 5. تحديث المبلغ المدفوع والمتبقي
    this.paid = totalPaid;
    this.remaining = Math.max(0, this.total - totalPaid);
    return this.remaining;
};

// Pay for specific items with quantities
billSchema.methods.payForItems = function (items, paymentMethod, userId) {
    // Validate input: items should be array of {itemId, quantity}
    if (!items || !Array.isArray(items) || items.length === 0) {
        throw new Error("يجب تحديد الأصناف والكميات المراد دفعها");
    }

    const paidItems = [];
    let totalAmount = 0;

    items.forEach((paymentItem) => {
        // Handle both {itemId, quantity} objects and plain itemId for backward compatibility
        let itemId, quantity;
        
        if (typeof paymentItem === 'object' && paymentItem !== null && !paymentItem._bsontype) {
            // It's an object with itemId and quantity
            itemId = paymentItem.itemId;
            quantity = paymentItem.quantity;
        } else {
            // It's a plain itemId (backward compatibility - pay full remaining quantity)
            itemId = paymentItem;
            quantity = null; // Will be set to remaining quantity
        }

        // Find the item in itemPayments
        const item = this.itemPayments.find(
            (i) => i._id.toString() === itemId.toString()
        );

        if (!item) {
            throw new Error(`الصنف ${itemId} غير موجود في الفاتورة`);
        }

        // Calculate remaining quantity
        const remainingQuantity = (item.quantity || 0) - (item.paidQuantity || 0);

        // Check if item is already fully paid
        if (remainingQuantity === 0) {
            throw new Error(`الصنف "${item.itemName}" مدفوع بالكامل`);
        }

        // If quantity not specified, pay for all remaining quantity
        if (quantity === null || quantity === undefined) {
            quantity = remainingQuantity;
        }

        // Validate quantity
        if (!quantity || quantity <= 0) {
            throw new Error(`يجب إدخال كمية صحيحة أكبر من صفر للصنف "${item.itemName}"`);
        }

        // Check if quantity exceeds remaining
        if (quantity > remainingQuantity) {
            throw new Error(
                `الكمية المطلوبة (${quantity}) أكبر من الكمية المتبقية (${remainingQuantity}) للصنف "${item.itemName}"`
            );
        }

        // Calculate payment amount for this quantity
        const paymentAmount = quantity * (item.pricePerUnit || 0);

        // Update paid quantity
        item.paidQuantity = (item.paidQuantity || 0) + quantity;
        
        // Update paid amount (will also be updated by pre-save hook, but we do it here for immediate use)
        item.paidAmount = item.paidQuantity * (item.pricePerUnit || 0);
        
        // Update isPaid status
        item.isPaid = item.paidQuantity >= (item.quantity || 0);
        
        // Update timestamps and user
        item.paidAt = new Date();
        item.paidBy = userId;

        // Add to payment history for this item
        if (!item.paymentHistory) {
            item.paymentHistory = [];
        }
        item.paymentHistory.push({
            quantity: quantity,
            amount: paymentAmount,
            paidAt: new Date(),
            paidBy: userId,
            method: paymentMethod,
        });

        // Add to paid items list for response
        paidItems.push({
            itemName: item.itemName,
            quantity: quantity,
            amount: paymentAmount,
            remainingQuantity: (item.quantity || 0) - item.paidQuantity,
        });

        totalAmount += paymentAmount;
    });

    // إضافة إلى سجل الدفعات العام للفاتورة
    this.paymentHistory.push({
        amount: totalAmount,
        method: paymentMethod,
        paidBy: userId,
        type: "partial-items",
        details: { paidItems, paidSessions: [] },
    });

    // إعادة حساب المبلغ المتبقي
    this.calculateRemainingAmount();

    return { paidItems, totalAmount };
};

// Pay partial amount for a session
billSchema.methods.paySessionPartial = function (
    sessionId,
    amount,
    paymentMethod,
    userId
) {
    if (!sessionId) {
        throw new Error("يجب تحديد الجلسة");
    }

    if (!amount || amount <= 0) {
        throw new Error("يجب إدخال مبلغ صحيح");
    }

    const sessionPayment = this.sessionPayments.find(
        (s) => s.sessionId.toString() === sessionId.toString()
    );

    if (!sessionPayment) {
        throw new Error("الجلسة غير موجودة في الفاتورة");
    }

    if (amount > sessionPayment.remainingAmount) {
        throw new Error(
            `المبلغ (${amount}) أكبر من المبلغ المتبقي (${sessionPayment.remainingAmount})`
        );
    }

    // إضافة الدفعة للجلسة
    sessionPayment.payments.push({
        amount,
        paidBy: userId,
        method: paymentMethod,
        paidAt: new Date(),
    });

    sessionPayment.paidAmount += amount;
    sessionPayment.remainingAmount -= amount;

    // إضافة إلى سجل الدفعات
    this.paymentHistory.push({
        amount,
        method: paymentMethod,
        paidBy: userId,
        type: "partial-session",
        details: {
            paidItems: [],
            paidSessions: [
                {
                    sessionId,
                    amount,
                    remainingAfter: sessionPayment.remainingAmount,
                },
            ],
        },
    });

    // إعادة حساب المبلغ المتبقي
    this.calculateRemainingAmount();

    return {
        sessionId,
        paidAmount: amount,
        remaining: sessionPayment.remainingAmount,
    };
};

// Calculate subtotal from orders and sessions
billSchema.methods.calculateSubtotal = async function () {
    try {
        // Try to populate, but don't fail if models aren't available
        try {
            await this.populate(["orders", "sessions"]);
        } catch (populateError) {}

        let subtotal = 0;

        // Add orders total
        if (this.orders && this.orders.length > 0) {
            subtotal += this.orders
                .filter((order) => order.status !== "cancelled")
                .reduce((sum, order) => {
                    const orderAmount =
                        order.finalAmount || order.totalAmount || 0;
                    return sum + orderAmount;
                }, 0);
        }

        // Add sessions total (استخدم breakdown الفعلي)
        if (this.sessions && this.sessions.length > 0) {
            for (const session of this.sessions) {
                if (typeof session.getCostBreakdownAsync === "function") {
                    const { totalCost } = await session.getCostBreakdownAsync();
                    subtotal += totalCost;
                } else {
                    const sessionAmount =
                        session.finalCost || session.totalCost || 0;
                    subtotal += sessionAmount;
                }
            }
        }

        this.subtotal = subtotal;

        // Calculate discount amount based on percentage if provided
        let discountAmount = 0;
        if (this.discountPercentage && this.discountPercentage > 0) {
            // Only calculate discount if percentage is provided and greater than 0
            discountAmount = Math.round(
                (this.subtotal * this.discountPercentage) / 100
            );
            this.discount = discountAmount; // Store the calculated discount amount
        } else {
            // If no discount percentage, use the direct discount amount if provided
            discountAmount = this.discount || 0;
        }

        // Calculate total after discount and tax (ensure it doesn't go below 0)
        this.total = Math.max(
            0,
            this.subtotal + (this.tax || 0) - discountAmount
        );

        // If this is a new bill or being recalculated, set paid to 0 if not set
        if (this.isNew && this.paid === undefined) {
            this.paid = 0;
        }

        // إعادة حساب المبلغ المدفوع من itemPayments و sessionPayments
        if (!this.isNew && (this.itemPayments?.length > 0 || this.sessionPayments?.length > 0)) {
            let calculatedPaid = 0;
            
            // حساب المدفوع من itemPayments
            if (this.itemPayments && this.itemPayments.length > 0) {
                calculatedPaid += this.itemPayments.reduce((sum, payment) => {
                    return sum + (payment.paidAmount || 0);
                }, 0);
            }
            
            // حساب المدفوع من sessionPayments
            if (this.sessionPayments && this.sessionPayments.length > 0) {
                calculatedPaid += this.sessionPayments.reduce((sum, payment) => {
                    return sum + (payment.paidAmount || 0);
                }, 0);
            }
            
            // تحديث المبلغ المدفوع المحسوب
            this.paid = calculatedPaid;
        }

        // Calculate remaining amount (can't be negative)
        this.remaining = Math.max(0, this.total - (this.paid || 0));

        // Update status based on payment, but only if this is not a new bill
        if (!this.isNew) {
            // Check if all items are paid (for partial payment system)
            const allItemsPaid = this.itemPayments && this.itemPayments.length > 0
                ? this.itemPayments.every(item => item.isPaid)
                : true; // If no itemPayments, consider items as paid
            
            // Check if all sessions are paid (for partial payment system)
            const allSessionsPaid = this.sessionPayments && this.sessionPayments.length > 0
                ? this.sessionPayments.every(session => session.remainingAmount === 0)
                : true; // If no sessionPayments, consider sessions as paid
            
            if (this.paid >= this.total && allItemsPaid && allSessionsPaid) {
                this.status = "paid";
                this.remaining = 0; // Ensure remaining is 0 if fully paid
            } else if (this.paid > 0) {
                this.status = "partial";
            } else {
                this.status = this.status || "draft";
            }
        }

        return this.save();
    } catch (error) {
        // Set default values if calculation fails
        this.subtotal = this.subtotal || 0;
        this.total = this.total || 0;
    }
};

// Indexes for better query performance
billSchema.index({ billNumber: 1 }, { unique: true });
billSchema.index({ table: 1 }); // Index for table field query performance
billSchema.index({ table: 1, status: 1 }); // Index for table-status queries

// Compound indexes for common query patterns (optimized for performance)
billSchema.index({ organization: 1, status: 1, createdAt: -1 });
billSchema.index({ organization: 1, table: 1, createdAt: -1 });
billSchema.index({ organization: 1, createdAt: -1 });
billSchema.index({ billType: 1, organization: 1 });
billSchema.index({ status: 1, createdAt: -1 }); // Index for status-based queries

// Text index for customer name search
billSchema.index({ customerName: "text" });

// Pre-remove hook to delete associated orders when bill is deleted
billSchema.pre("remove", async function (next) {
    try {
        // Import Order model dynamically to avoid circular dependency
        const Order = mongoose.model("Order");

        // Delete all orders associated with this bill
        await Order.deleteMany({ bill: this._id });

        next();
    } catch (error) {
        next(error);
    }
});

// Pre-deleteOne hook
billSchema.pre(
    "deleteOne",
    { document: true, query: false },
    async function (next) {
        try {
            const Order = mongoose.model("Order");
            await Order.deleteMany({ bill: this._id });
            next();
        } catch (error) {
            next(error);
        }
    }
);

// Pre-findOneAndDelete hook
billSchema.pre("findOneAndDelete", async function (next) {
    try {
        const Order = mongoose.model("Order");
        const bill = await this.model.findOne(this.getQuery());
        if (bill) {
            await Order.deleteMany({ bill: bill._id });
        }
        next();
    } catch (error) {
        next(error);
    }
});

/**
 * Helper function to update table status based on unpaid bills
 * @param {ObjectId} tableId - The table ID to update
 * @returns {Promise<string>} The new table status
 */
async function updateTableStatus(tableId) {
    if (!tableId) {
        return null;
    }

    // Check if mongoose is connected before attempting database operations
    if (mongoose.connection.readyState !== 1) {
        return null;
    }

    try {
        const Table = mongoose.model("Table");
        const Bill = mongoose.model("Bill");

        // Find all unpaid bills for this table (draft, partial, or overdue status)
        const unpaidBills = await Bill.find({
            table: tableId,
            status: { $in: ["draft", "partial", "overdue"] },
        });

        // Determine new status: occupied if there are unpaid bills, empty otherwise
        const newStatus = unpaidBills.length > 0 ? "occupied" : "empty";

        // Update table status
        await Table.findByIdAndUpdate(tableId, { status: newStatus });

        return newStatus;
    } catch (error) {
        // Don't throw error - table status update failure shouldn't break bill operations
        return null;
    }
}

// Post-save hook to update table status when bill is created or updated
billSchema.post("save", async function (doc) {
    if (doc.table) {
        await updateTableStatus(doc.table);
    }
});

// Post-findOneAndUpdate hook to update table status when bill is updated via findOneAndUpdate
billSchema.post("findOneAndUpdate", async function (doc) {
    if (doc && doc.table) {
        await updateTableStatus(doc.table);
    }
});

// Post-findOneAndDelete hook to update table status when bill is deleted (Requirement 2.5)
billSchema.post("findOneAndDelete", async function (doc) {
    if (doc && doc.table) {
        await updateTableStatus(doc.table);
    }
});

// Post-deleteOne hook to update table status when bill is deleted (Requirement 2.5)
billSchema.post("deleteOne", { document: true, query: false }, async function (doc) {
    if (doc && doc.table) {
        await updateTableStatus(doc.table);
    }
});

// Apply sync middleware
import { applySyncMiddleware } from "../middleware/sync/syncMiddleware.js";
applySyncMiddleware(billSchema);

export default mongoose.model("Bill", billSchema);
