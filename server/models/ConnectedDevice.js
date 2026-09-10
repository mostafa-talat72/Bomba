import mongoose from "mongoose";

// Registry of client apps (phones/tablets/browsers/desktop) seen by the
// server. Used for the "connected devices" admin list + per-device print
// permission (allowlist: new devices are blocked until an admin allows them,
// except desktops which are auto-allowed so nobody locks themselves out).
//
// NOTE: intentionally NOT wired to Atlas sync (local-ephemeral data).
const connectedDeviceSchema = new mongoose.Schema(
    {
        instanceId: {
            type: String,
            required: true,
            unique: true,
            trim: true,
        },
        label: { type: String, default: "", trim: true },
        deviceType: {
            type: String,
            enum: ["desktop", "mobile", "browser"],
            default: "browser",
        },
        platform: { type: String, default: "" }, // Android / iOS / Windows ...
        browser: { type: String, default: "" }, // Chrome / Safari / Electron ...
        ip: { type: String, default: "" },
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
        organization: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", default: null },
        canPrint: { type: Boolean, default: false },
        lastSeen: { type: Date, default: Date.now },
    },
    { timestamps: true }
);

connectedDeviceSchema.index({ lastSeen: -1 });
connectedDeviceSchema.index({ organization: 1, lastSeen: -1 });

const ConnectedDevice =
    mongoose.models.ConnectedDevice ||
    mongoose.model("ConnectedDevice", connectedDeviceSchema);

export default ConnectedDevice;
