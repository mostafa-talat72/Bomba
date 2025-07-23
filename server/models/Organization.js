import mongoose from "mongoose";

const OrganizationSchema = new mongoose.Schema({
    name: { type: String, required: true },
    type: {
        type: String,
        enum: ["cafe", "restaurant", "playstation"],
        required: true,
    },
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    createdAt: { type: Date, default: Date.now },
});

export default mongoose.model("Organization", OrganizationSchema);
