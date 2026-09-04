import Bill from "../models/Bill.js";
import Order from "../models/Order.js";
import mongoose from "mongoose";

/**
 * Returns order ids that are valid report sources.
 *
 * An order is valid only when:
 * - its bill belongs to the organization and is not soft-deleted;
 * - the bill still contains the order id; and
 * - the order points back to that same bill.
 */
export const getReportEligibleOrderIds = async (organization) => {
    const organizationId = organization?._id || organization;
    if (!mongoose.Types.ObjectId.isValid(organizationId)) {
        throw new Error("Invalid organization id for report order filtering");
    }
    const organizationObjectId = new mongoose.Types.ObjectId(organizationId);

    const eligibleOrders = await Bill.aggregate([
        {
            $match: {
                organization: organizationObjectId,
                isDeleted: { $ne: true },
                orders: { $type: "array", $ne: [] },
            },
        },
        { $unwind: "$orders" },
        {
            $lookup: {
                from: "orders",
                let: { orderId: "$orders", billId: "$_id" },
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $and: [
                                    { $eq: ["$_id", "$$orderId"] },
                                    { $eq: ["$bill", "$$billId"] },
                                    { $eq: ["$organization", organizationObjectId] },
                                    { $eq: ["$isDeleted", false] },
                                ],
                            },
                        },
                    },
                    { $project: { _id: 1 } },
                ],
                as: "order",
            },
        },
        { $unwind: "$order" },
        { $group: { _id: "$order._id" } },
    ]);

    return eligibleOrders.map(({ _id }) => _id);
};

export const findReportEligibleOrders = async (organization, filter = {}) => {
    const organizationId = organization?._id || organization;
    const orderIds = await getReportEligibleOrderIds(organizationId);
    if (orderIds.length === 0) return [];

    return Order.find({
        ...filter,
        organization: organizationId,
        isDeleted: false,
        _id: { $in: orderIds },
    }).lean();
};
