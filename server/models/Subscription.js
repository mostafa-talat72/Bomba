import mongoose from "mongoose";

const SubscriptionSchema = new mongoose.Schema({
    organization: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Organization",
        required: true,
    },
    plan: {
        type: String,
        enum: ["trial", "monthly", "yearly"],
        required: true,
    },
    status: {
        type: String,
        enum: ["active", "expired", "pending"],
        default: "pending",
    },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    paymentMethod: { type: String, enum: ["fawry", "manual"], required: true },
    paymentRef: { type: String },
    createdAt: { type: Date, default: Date.now },
});

export default mongoose.model("Subscription", SubscriptionSchema);
