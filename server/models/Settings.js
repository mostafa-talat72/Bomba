import mongoose from "mongoose";

const settingsSchema = new mongoose.Schema(
    {
        category: {
            type: String,
            required: true,
            unique: true,
        },
        settings: {
            type: mongoose.Schema.Types.Mixed,
            required: true,
        },
        organization: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Organization",
            required: true,
        },
        updatedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
    },
    {
        timestamps: true,
    }
);

export default mongoose.model("Settings", settingsSchema);
