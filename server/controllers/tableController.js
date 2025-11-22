import Table from "../models/Table.js";
import Order from "../models/Order.js";
import Bill from "../models/Bill.js";

// Get all tables
export const getAllTables = async (req, res) => {
    try {
        if (!req.user || !req.user.organization) {
            return res.status(401).json({
                success: false,
                message: "يجب تسجيل الدخول للوصول إلى الطاولات",
            });
        }

        const { section } = req.query;
        const query = {
            organization: req.user.organization,
        };

        if (section) {
            query.section = section;
        }

        const tables = await Table.find(query)
            .populate("section", "name")
            .populate("createdBy", "name")
            .populate("updatedBy", "name")
            .sort({ section: 1, number: 1 });

        res.json({
            success: true,
            count: tables.length,
            data: tables,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "خطأ في جلب الطاولات",
            error: error.message,
        });
    }
};

// Get table by ID
export const getTableById = async (req, res) => {
    try {
        const { id } = req.params;
        const table = await Table.findOne({
            _id: id,
            organization: req.user.organization,
        })
            .populate("section", "name")
            .populate("createdBy", "name")
            .populate("updatedBy", "name");

        if (!table) {
            return res.status(404).json({
                success: false,
                message: "الطاولة غير موجودة",
            });
        }

        res.json({
            success: true,
            data: table,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "خطأ في جلب الطاولة",
            error: error.message,
        });
    }
};

// Get table status (whether it has unpaid orders)
export const getTableStatus = async (req, res) => {
    try {
        const { id } = req.params;

        const table = await Table.findOne({
            _id: id,
            organization: req.user.organization,
        });

        if (!table) {
            return res.status(404).json({
                success: false,
                message: "الطاولة غير موجودة",
            });
        }

        // Find all orders for this table that are not cancelled
        const orders = await Order.find({
            table: table._id,
            organization: req.user.organization,
            status: { $ne: "cancelled" },
        })
        .populate({
            path: "bill",
            select: "status billNumber total paid remaining"
        })
        .populate("table", "number name");
        
        // Also check for orders with tableNumber (old format) - for backward compatibility
        const oldFormatOrders = await Order.find({
            tableNumber: table.number,
            organization: req.user.organization,
            status: { $ne: "cancelled" },
        })
        .populate({
            path: "bill",
            select: "status billNumber total paid remaining"
        });
        
        // Combine both old and new format orders
        const allOrders = [...orders, ...oldFormatOrders];

        // Find all bills (including playstation bills) linked to this table
        const bills = await Bill.find({
            table: table._id,
            organization: req.user.organization,
            status: { $nin: ["paid", "cancelled"] },
        }).populate({
            path: "sessions",
            select: "status deviceType"
        });

        // Also check for bills with tableNumber (old format)
        const oldFormatBills = await Bill.find({
            tableNumber: table.number,
            organization: req.user.organization,
            status: { $nin: ["paid", "cancelled"] },
        }).populate({
            path: "sessions",
            select: "status deviceType"
        });

        const allBills = [...bills, ...oldFormatBills];

        // Check if any order has an unpaid bill
        let hasUnpaidOrders = false;
        const tableOrders = [];

        for (const order of allOrders) {
            if (order.bill) {
                // Bill is populated, check status directly
                const bill = order.bill;
                if (bill && bill.status && bill.status !== "paid") {
                    hasUnpaidOrders = true;
                    // Only include order if bill is not paid
                    tableOrders.push(order);
                }
                // If bill is paid, don't include the order
            } else {
                // If order has no bill, consider it unpaid and include it
                hasUnpaidOrders = true;
                tableOrders.push(order);
            }
        }

        // Check if any bill (including playstation) linked to this table is unpaid
        for (const bill of allBills) {
            if (bill.status !== "paid" && bill.status !== "cancelled") {
                hasUnpaidOrders = true;
            }
        }

        res.json({
            success: true,
            data: {
                table,
                hasUnpaidOrders,
                orders: tableOrders,
            },
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "خطأ في جلب حالة الطاولة",
            error: error.message,
        });
    }
};

// Create new table
export const createTable = async (req, res) => {
    try {
        const { number, section } = req.body;

        // Validate that number/name is provided
        if (!number || (typeof number === 'string' && number.trim() === '')) {
            return res.status(400).json({
                success: false,
                message: "رقم/اسم الطاولة مطلوب",
            });
        }

        if (!section) {
            return res.status(400).json({
                success: false,
                message: "القسم مطلوب",
            });
        }

        // Check if table number already exists in this section
        const existingTable = await Table.findOne({
            number,
            section,
            organization: req.user.organization,
        });

        if (existingTable) {
            return res.status(400).json({
                success: false,
                message: "رقم/اسم الطاولة موجود بالفعل في هذا القسم",
            });
        }

        // Keep the number as is (text or number)
        const tableData = {
            number: typeof number === 'string' ? number.trim() : number,
            section,
            organization: req.user.organization,
            createdBy: req.user.id,
        };

        console.log('🔍 Creating table with data:', tableData);

        const table = new Table(tableData);
        await table.save();
        
        console.log('✅ Table saved successfully:', table);

        await table.populate("section", "name");
        await table.populate("createdBy", "name");

        res.status(201).json({
            success: true,
            message: "تم إنشاء الطاولة بنجاح",
            data: table,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "خطأ في إنشاء الطاولة",
            error: error.message,
        });
    }
};

// Update table
export const updateTable = async (req, res) => {
    try {
        const { id } = req.params;
        const { number, section, isActive } = req.body;

        const updateData = {
            updatedBy: req.user.id,
        };

        if (number !== undefined) {
            // Keep the number as is (text or number)
            updateData.number = typeof number === 'string' ? number.trim() : number;
        }
        if (section !== undefined) {
            updateData.section = section;
        }
        if (isActive !== undefined) {
            updateData.isActive = isActive;
        }

        // If number or section is being updated, check for duplicates
        if (number !== undefined || section !== undefined) {
            const table = await Table.findById(id);
            if (!table) {
                return res.status(404).json({
                    success: false,
                    message: "الطاولة غير موجودة",
                });
            }

            const finalNumber = number !== undefined ? (typeof number === 'string' ? number.trim() : number) : table.number;
            const finalSection = section !== undefined ? section : table.section;

            const existingTable = await Table.findOne({
                _id: { $ne: id },
                number: finalNumber,
                section: finalSection,
                organization: req.user.organization,
            });

            if (existingTable) {
                return res.status(400).json({
                    success: false,
                    message: "رقم/اسم الطاولة موجود بالفعل في هذا القسم",
                });
            }
        }

        const table = await Table.findOneAndUpdate(
            { _id: id, organization: req.user.organization },
            updateData,
            { new: true, runValidators: true }
        )
            .populate("section", "name")
            .populate("createdBy", "name")
            .populate("updatedBy", "name");

        if (!table) {
            return res.status(404).json({
                success: false,
                message: "الطاولة غير موجودة",
            });
        }

        res.json({
            success: true,
            message: "تم تحديث الطاولة بنجاح",
            data: table,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "خطأ في تحديث الطاولة",
            error: error.message,
        });
    }
};

// Delete table
export const deleteTable = async (req, res) => {
    try {
        const { id } = req.params;

        // Check if table has active orders
        const table = await Table.findById(id);
        if (!table) {
            return res.status(404).json({
                success: false,
                message: "الطاولة غير موجودة",
            });
        }

        const activeOrders = await Order.countDocuments({
            table: table._id,
            organization: req.user.organization,
            status: { $ne: "cancelled" },
        });

        if (activeOrders > 0) {
            return res.status(400).json({
                success: false,
                message: "لا يمكن حذف الطاولة لأنها تحتوي على طلبات نشطة",
            });
        }

        const deletedTable = await Table.findOneAndDelete({
            _id: id,
            organization: req.user.organization,
        });

        if (!deletedTable) {
            return res.status(404).json({
                success: false,
                message: "الطاولة غير موجودة",
            });
        }

        res.json({
            success: true,
            message: "تم حذف الطاولة بنجاح",
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "خطأ في حذف الطاولة",
            error: error.message,
        });
    }
};



