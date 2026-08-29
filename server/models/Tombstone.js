import mongoose from "mongoose";

const tombstoneSchema = new mongoose.Schema(
  {
    collectionName: {
      type: String,
      required: true,
      index: true,
    },
    documentId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    deletedAt: {
      type: Date,
      required: true,
      default: () => new Date(),
    },
    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: false,
  }
);

// المركب: نفس المستند لا يُسجل مرتين لنفس المؤسسة
tombstoneSchema.index({ collectionName: 1, documentId: 1, organization: 1 }, { unique: true });
// TTL: حذف تلقائي بعد سنة (365 يوم)
tombstoneSchema.index({ deletedAt: 1 }, { expireAfterSeconds: 365 * 24 * 60 * 60 });

export default mongoose.model("Tombstone", tombstoneSchema);
