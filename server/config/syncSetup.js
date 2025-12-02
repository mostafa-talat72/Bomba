import { applySyncMiddleware } from "../middleware/sync/syncMiddleware.js";
import syncConfig from "./syncConfig.js";

/**
 * Setup function to be called in each model file
 * Applies sync middleware to a schema before creating the model
 * @param {mongoose.Schema} schema - The schema to apply middleware to
 * @returns {mongoose.Schema} - The same schema with middleware applied
 */
export function setupSync(schema) {
    if (syncConfig.enabled) {
        applySyncMiddleware(schema);
    }
    return schema;
}

export default setupSync;
