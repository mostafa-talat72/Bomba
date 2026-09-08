import Order from "../models/Order.js";
import mongoose from "mongoose";

/**
 * Returns order ids that are valid report sources, optionally scoped to a date range.
 *
 * An order is valid only when:
 * - it belongs to the organization and is not soft-deleted;
 * - it points back to a bill of the same organization that is not soft-deleted; and
 * - that bill still contains the order id (embedded objects are normalized).
 *
 * Orders-first pipeline: the in-range orders are matched via index, then each one
 * is verified against its bill by _id (indexed). This is ~20-170x faster than
 * scanning every bill of the organization (35s -> ~0.2s for a day on large DBs).
 */
export const getReportEligibleOrderIds = async (organization, { startDate, endDate } = {}) => {
    const organizationId = organization?._id || organization;
    if (!mongoose.Types.ObjectId.isValid(organizationId)) {
        throw new Error("Invalid organization id for report order filtering");
    }
    const organizationObjectId = new mongoose.Types.ObjectId(organizationId);

    const orderMatch = {
        organization: organizationObjectId,
        isDeleted: false,
    };
    if (startDate || endDate) {
        orderMatch.createdAt = {};
        if (startDate) orderMatch.createdAt.$gte = new Date(startDate);
        if (endDate) orderMatch.createdAt.$lte = new Date(endDate);
    }

    const eligibleOrders = await Order.aggregate([
        { $match: orderMatch },
        {
            $lookup: {
                from: "bills",
                let: { orderId: "$_id", billId: "$bill" },
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $and: [
                                    { $eq: ["$_id", "$$billId"] },
                                    { $eq: ["$organization", organizationObjectId] },
                                    { $ne: ["$isDeleted", true] },
                                    {
                                        $gt: [
                                            {
                                                $size: {
                                                    // NOTE: strict ObjectId comparison. Sync payloads
                                                    // (JSON-crossed LAN/Atlas) may store bill.orders ids
                                                    // as strings — $convert normalizes them to ObjectId
                                                    // (invalid values become null and never match), so
                                                    // valid orders are never randomly excluded depending
                                                    // on which device copy arrived last.
                                                    $filter: {
                                                        input: {
                                                            $map: {
                                                                input: { $ifNull: ["$orders", []] },
                                                                as: "o",
                                                                in: {
                                                                    $convert: {
                                                                        input: {
                                                                            $cond: {
                                                                                if: { $eq: [{ $type: "$$o" }, "object"] },
                                                                                then: { $ifNull: ["$$o._id", null] },
                                                                                else: "$$o",
                                                                            },
                                                                        },
                                                                        to: "objectId",
                                                                        onError: null,
                                                                        onNull: null,
                                                                    },
                                                                },
                                                            },
                                                        },
                                                        as: "x",
                                                        cond: { $eq: ["$$x", "$$orderId"] },
                                                    },
                                                },
                                            },
                                            0,
                                        ],
                                    },
                                ],
                            },
                        },
                    },
                    { $project: { _id: 1 } },
                ],
                as: "billMatch",
            },
        },
        { $match: { billMatch: { $ne: [] } } },
        { $project: { _id: 1 } },
    ]);

    return eligibleOrders.map(({ _id }) => _id);
};

export const findReportEligibleOrders = async (organization, filter = {}) => {
    const organizationId = organization?._id || organization;
    const { createdAt, ...rest } = filter;
    const orderIds = await getReportEligibleOrderIds(organizationId, {
        startDate: createdAt?.$gte,
        endDate: createdAt?.$lte ?? createdAt?.$lt,
    });
    if (orderIds.length === 0) return [];

    return Order.find({
        ...rest,
        ...(createdAt ? { createdAt } : {}),
        organization: organizationId,
        isDeleted: false,
        _id: { $in: orderIds },
    }).lean();
};
