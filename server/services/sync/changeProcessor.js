import mongoose from 'mongoose';
import Logger from '../../middleware/logger.js';
import syncConfig from '../../config/syncConfig.js';
import DeviceValidator from '../validation/deviceValidator.js';
import BillValidator from '../validation/billValidator.js';

/**
 * Change Processor
 * Applies Atlas changes to Local MongoDB for bidirectional sync
 * Handles insert, update, delete, and replace operations
 */

class ChangeProcessor {
    constructor(originTracker, conflictResolver, databaseManager) {
        this.originTracker = originTracker;
        this.conflictResolver = conflictResolver;
        this.databaseManager = databaseManager;
        
        // Processing queue for batching
        this.processingQueue = [];
        this.isProcessing = false;
        this.batchSize = syncConfig.bidirectionalSync?.changeStream?.batchSize || 100;
        
        // Statistics
        this.stats = {
            totalProcessed: 0,
            successful: 0,
            failed: 0,
            skipped: 0,
            conflicts: 0
        };
    }

    /**
     * Process a change event from Atlas Change Stream
     * @param {Object} change - Atlas change event
     * @returns {Promise<Object>} - Processing result
     */
    async processChange(change) {
        try {
            // Validate the change
            if (!this.validateChange(change)) {
                this.stats.skipped++;
                return {
                    success: false,
                    reason: 'Invalid change event',
                    change
                };
            }

            // Check if we should apply this change
            if (!this.shouldApplyChange(change)) {
                this.stats.skipped++;
                return {
                    success: false,
                    reason: 'Change skipped (origin tracking)',
                    change
                };
            }

            // Mark this change as coming from Atlas
            const documentId = change.documentKey?._id;
            if (documentId) {
                this.originTracker.markAtlasChange(documentId);
            }

            // Apply the change based on operation type
            let result;
            switch (change.operationType) {
                case 'insert':
                    result = await this.applyInsert(change);
                    break;
                case 'update':
                    result = await this.applyUpdate(change);
                    break;
                case 'delete':
                    result = await this.applyDelete(change);
                    break;
                case 'replace':
                    result = await this.applyReplace(change);
                    break;
                default:
                    Logger.warn(`[ChangeProcessor] Unsupported operation type: ${change.operationType}`);
                    this.stats.skipped++;
                    return {
                        success: false,
                        reason: `Unsupported operation: ${change.operationType}`,
                        change
                    };
            }

            // Update statistics
            this.stats.totalProcessed++;
            if (result.success) {
                this.stats.successful++;
            } else {
                this.stats.failed++;
            }

            return result;

        } catch (error) {
            Logger.error('[ChangeProcessor] Error processing change:', error);
            this.stats.failed++;
            this.stats.totalProcessed++;
            
            return {
                success: false,
                error: error.message,
                change
            };
        }
    }

    /**
     * Validate a change event
     * @param {Object} change - Change event to validate
     * @returns {boolean} - True if valid
     */
    validateChange(change) {
        // Check required fields
        if (!change || !change.operationType) {
            Logger.warn('[ChangeProcessor] Invalid change: missing operationType');
            return false;
        }

        if (!change.ns || !change.ns.db || !change.ns.coll) {
            Logger.warn('[ChangeProcessor] Invalid change: missing namespace');
            return false;
        }

        if (!change.documentKey || !change.documentKey._id) {
            Logger.warn('[ChangeProcessor] Invalid change: missing documentKey');
            return false;
        }

        // Validate operation-specific requirements
        switch (change.operationType) {
            case 'insert':
                if (!change.fullDocument) {
                    Logger.warn('[ChangeProcessor] Invalid insert: missing fullDocument');
                    return false;
                }
                break;
            case 'update':
                if (!change.updateDescription) {
                    Logger.warn('[ChangeProcessor] Invalid update: missing updateDescription');
                    return false;
                }
                break;
            case 'replace':
                if (!change.fullDocument) {
                    Logger.warn('[ChangeProcessor] Invalid replace: missing fullDocument');
                    return false;
                }
                break;
            // delete doesn't need additional validation
        }

        return true;
    }

    /**
     * Validate document data before applying changes
     * Requirements: 9.1, 9.4, 9.5
     * 
     * @param {Object} document - Document to validate
     * @param {string} collectionName - Collection name
     * @param {string} operationType - Operation type (insert, update, replace)
     * @returns {Object} - Validation result with success flag and errors
     */
    validateDocumentData(document, collectionName, operationType) {
        const errors = [];

        try {
            // Get the model for validation
            const Model = this.getModel(collectionName);
            if (!Model) {
                return {
                    success: false,
                    errors: [`Model not found for collection: ${collectionName}`]
                };
            }

            // Get schema from model
            const schema = Model.schema;
            if (!schema) {
                return {
                    success: false,
                    errors: [`Schema not found for collection: ${collectionName}`]
                };
            }

            // Validate document structure
            const structureErrors = this.validateDocumentStructure(document, schema, collectionName);
            if (structureErrors.length > 0) {
                errors.push(...structureErrors);
            }

            // Validate field types
            const typeErrors = this.validateFieldTypes(document, schema, collectionName);
            if (typeErrors.length > 0) {
                errors.push(...typeErrors);
            }

            // Validate required fields (only for insert and replace operations)
            if (operationType === 'insert' || operationType === 'replace') {
                const requiredErrors = this.validateRequiredFields(document, schema, collectionName);
                if (requiredErrors.length > 0) {
                    errors.push(...requiredErrors);
                }
            }

            // Validate enum values
            const enumErrors = this.validateEnumFields(document, schema, collectionName);
            if (enumErrors.length > 0) {
                errors.push(...enumErrors);
            }

            // Validate numeric constraints (min, max)
            const numericErrors = this.validateNumericConstraints(document, schema, collectionName);
            if (numericErrors.length > 0) {
                errors.push(...numericErrors);
            }

            if (errors.length > 0) {
                Logger.warn(`[ChangeProcessor] Document validation failed for ${collectionName}:`, errors);
                return {
                    success: false,
                    errors
                };
            }

            return {
                success: true,
                errors: []
            };

        } catch (error) {
            Logger.error('[ChangeProcessor] Error during document validation:', error);
            return {
                success: false,
                errors: [`Validation error: ${error.message}`]
            };
        }
    }

    /**
     * Validate document structure against schema
     * @param {Object} document - Document to validate
     * @param {Object} schema - Mongoose schema
     * @param {string} collectionName - Collection name
     * @returns {Array} - Array of error messages
     */
    validateDocumentStructure(document, schema, collectionName) {
        const errors = [];

        if (!document || typeof document !== 'object') {
            errors.push(`Invalid document structure: document must be an object`);
            return errors;
        }

        // Check for invalid fields (fields not in schema)
        const schemaPaths = Object.keys(schema.paths);
        const documentFields = Object.keys(document);

        for (const field of documentFields) {
            // Skip internal MongoDB fields
            if (field === '_id' || field === '__v' || field.startsWith('_')) {
                continue;
            }

            // Check if field exists in schema
            if (!schemaPaths.includes(field) && !schema.nested[field]) {
                // Allow nested fields with dot notation
                const isNestedField = field.includes('.');
                if (!isNestedField) {
                    Logger.debug(`[ChangeProcessor] Unknown field in ${collectionName}: ${field}`);
                    // Don't reject, just log - MongoDB allows extra fields
                }
            }
        }

        return errors;
    }

    /**
     * Validate field types against schema
     * @param {Object} document - Document to validate
     * @param {Object} schema - Mongoose schema
     * @param {string} collectionName - Collection name
     * @returns {Array} - Array of error messages
     */
    validateFieldTypes(document, schema, collectionName) {
        const errors = [];

        for (const [fieldPath, value] of Object.entries(document)) {
            // Skip internal fields
            if (fieldPath === '_id' || fieldPath === '__v' || fieldPath.startsWith('_')) {
                continue;
            }

            // Skip null/undefined values
            if (value === null || value === undefined) {
                continue;
            }

            const schemaType = schema.path(fieldPath);
            if (!schemaType) {
                continue; // Field not in schema, skip
            }

            // Validate type
            const expectedType = schemaType.instance;
            const actualType = this.getFieldType(value);

            if (!this.isTypeCompatible(actualType, expectedType, value)) {
                errors.push(
                    `Type mismatch for field "${fieldPath}": expected ${expectedType}, got ${actualType}`
                );
            }
        }

        return errors;
    }

    /**
     * Validate required fields
     * @param {Object} document - Document to validate
     * @param {Object} schema - Mongoose schema
     * @param {string} collectionName - Collection name
     * @returns {Array} - Array of error messages
     */
    validateRequiredFields(document, schema, collectionName) {
        const errors = [];

        // Special handling for devices collection with conditional required fields
        if (collectionName === 'devices') {
            // For devices, hourlyRate is only required for computers
            // playstationRates is only required for playstation
            const deviceType = document.type || 'playstation';
            
            // Check required fields based on device type
            if (deviceType === 'computer') {
                if (!document.hourlyRate && document.hourlyRate !== 0) {
                    errors.push('Required field missing: "hourlyRate"');
                }
            } else if (deviceType === 'playstation') {
                if (!document.playstationRates) {
                    errors.push('Required field missing: "playstationRates"');
                }
            }
            
            // Check other required fields for devices
            const requiredDeviceFields = ['name', 'organization'];
            for (const field of requiredDeviceFields) {
                if (!document[field]) {
                    errors.push(`Required field missing: "${field}"`);
                }
            }
            
            return errors;
        }

        // Get all required paths from schema for other collections
        schema.eachPath((pathname, schematype) => {
            // Skip internal fields
            if (pathname === '_id' || pathname === '__v' || pathname.startsWith('_')) {
                return;
            }

            // Check if field is required
            if (schematype.isRequired) {
                const value = this.getNestedValue(document, pathname);
                
                if (value === undefined || value === null) {
                    errors.push(`Required field missing: "${pathname}"`);
                }
            }
        });

        return errors;
    }

    /**
     * Validate enum fields
     * @param {Object} document - Document to validate
     * @param {Object} schema - Mongoose schema
     * @param {string} collectionName - Collection name
     * @returns {Array} - Array of error messages
     */
    validateEnumFields(document, schema, collectionName) {
        const errors = [];

        for (const [fieldPath, value] of Object.entries(document)) {
            // Skip null/undefined values
            if (value === null || value === undefined) {
                continue;
            }

            const schemaType = schema.path(fieldPath);
            if (!schemaType) {
                continue;
            }

            // Check if field has enum constraint
            if (schemaType.enumValues && schemaType.enumValues.length > 0) {
                if (!schemaType.enumValues.includes(value)) {
                    errors.push(
                        `Invalid enum value for field "${fieldPath}": "${value}" not in [${schemaType.enumValues.join(', ')}]`
                    );
                }
            }
        }

        return errors;
    }

    /**
     * Validate numeric constraints (min, max)
     * @param {Object} document - Document to validate
     * @param {Object} schema - Mongoose schema
     * @param {string} collectionName - Collection name
     * @returns {Array} - Array of error messages
     */
    validateNumericConstraints(document, schema, collectionName) {
        const errors = [];

        for (const [fieldPath, value] of Object.entries(document)) {
            // Skip null/undefined values
            if (value === null || value === undefined) {
                continue;
            }

            const schemaType = schema.path(fieldPath);
            if (!schemaType) {
                continue;
            }

            // Only validate numeric fields
            if (schemaType.instance !== 'Number') {
                continue;
            }

            // Check min constraint
            if (schemaType.options.min !== undefined && value < schemaType.options.min) {
                errors.push(
                    `Value for field "${fieldPath}" (${value}) is below minimum (${schemaType.options.min})`
                );
            }

            // Check max constraint
            if (schemaType.options.max !== undefined && value > schemaType.options.max) {
                errors.push(
                    `Value for field "${fieldPath}" (${value}) exceeds maximum (${schemaType.options.max})`
                );
            }
        }

        return errors;
    }

    /**
     * Get field type from value
     * @param {*} value - Value to check
     * @returns {string} - Type name
     */
    getFieldType(value) {
        if (value === null) return 'null';
        if (value === undefined) return 'undefined';
        if (Array.isArray(value)) return 'Array';
        if (value instanceof Date) return 'Date';
        if (value instanceof mongoose.Types.ObjectId) return 'ObjectId';
        if (typeof value === 'object' && value._bsontype === 'ObjectId') return 'ObjectId';
        
        // Handle populated ObjectId fields (objects with _id)
        if (typeof value === 'object' && value !== null && value._id) {
            return 'ObjectId'; // Treat populated objects as ObjectId
        }
        
        const type = typeof value;
        return type.charAt(0).toUpperCase() + type.slice(1);
    }

    /**
     * Check if actual type is compatible with expected type
     * @param {string} actualType - Actual type
     * @param {string} expectedType - Expected type from schema
     * @param {*} value - The actual value
     * @returns {boolean} - True if compatible
     */
    isTypeCompatible(actualType, expectedType, value) {
        // Direct match
        if (actualType === expectedType) {
            return true;
        }

        // Mixed type accepts anything
        if (expectedType === 'Mixed') {
            return true;
        }

        // ObjectId compatibility
        if (expectedType === 'ObjectId') {
            // Direct ObjectId
            if (actualType === 'ObjectId') {
                return true;
            }
            
            // String that can be converted to ObjectId
            if (actualType === 'String' && mongoose.Types.ObjectId.isValid(value)) {
                return true;
            }
            
            // Populated object with _id field (common in sync operations)
            if (actualType === 'Object' && value && value._id) {
                return mongoose.Types.ObjectId.isValid(value._id);
            }
            
            return false;
        }

        // Date compatibility
        if (expectedType === 'Date') {
            return actualType === 'Date' || 
                   (actualType === 'String' && !isNaN(Date.parse(value)));
        }

        // Number compatibility
        if (expectedType === 'Number') {
            return actualType === 'Number' || 
                   (actualType === 'String' && !isNaN(parseFloat(value)));
        }

        // String compatibility (most types can be converted to string)
        if (expectedType === 'String') {
            return true;
        }

        // Boolean compatibility
        if (expectedType === 'Boolean') {
            return actualType === 'Boolean' || 
                   actualType === 'Number' || 
                   actualType === 'String';
        }

        return false;
    }

    /**
     * Sanitize document for sync operations
     * Converts populated objects back to ObjectIds
     * @param {Object} document - Document to sanitize
     * @returns {Object} - Sanitized document
     */
    sanitizeDocumentForSync(document) {
        if (!document || typeof document !== 'object') {
            return document;
        }

        const sanitized = { ...document };

        // Convert populated ObjectId fields back to ObjectIds
        const objectIdFields = ['createdBy', 'updatedBy', 'organization', 'table', 'user'];
        
        for (const field of objectIdFields) {
            if (sanitized[field] && typeof sanitized[field] === 'object' && sanitized[field]._id) {
                sanitized[field] = sanitized[field]._id;
            }
        }

        // Handle nested arrays with ObjectId references
        if (sanitized.orders && Array.isArray(sanitized.orders)) {
            sanitized.orders = sanitized.orders.map(order => {
                if (typeof order === 'object' && order._id) {
                    return order._id;
                }
                return order;
            });
        }

        if (sanitized.sessions && Array.isArray(sanitized.sessions)) {
            sanitized.sessions = sanitized.sessions.map(session => {
                if (typeof session === 'object' && session._id) {
                    return session._id;
                }
                return session;
            });
        }

        // Handle payments array
        if (sanitized.payments && Array.isArray(sanitized.payments)) {
            sanitized.payments = sanitized.payments.map(payment => {
                if (payment.user && typeof payment.user === 'object' && payment.user._id) {
                    payment.user = payment.user._id;
                }
                return payment;
            });
        }

        // Handle itemPayments array
        if (sanitized.itemPayments && Array.isArray(sanitized.itemPayments)) {
            sanitized.itemPayments = sanitized.itemPayments.map(item => {
                if (item.paidBy && typeof item.paidBy === 'object' && item.paidBy._id) {
                    item.paidBy = item.paidBy._id;
                }
                if (item.orderId && typeof item.orderId === 'object' && item.orderId._id) {
                    item.orderId = item.orderId._id;
                }
                if (item.menuItemId && typeof item.menuItemId === 'object' && item.menuItemId._id) {
                    item.menuItemId = item.menuItemId._id;
                }
                return item;
            });
        }

        return sanitized;
    }

    /**
     * Validate device document
     * @param {Object} document - Device document to validate
     * @returns {Object} - Validation result
     */
    validateDeviceDocument(document) {
        const errors = [];

        // Check required fields
        if (!document.name || (typeof document.name === 'string' && document.name.trim() === '')) {
            errors.push('Device name is required and cannot be empty');
        }

        if (!document.number || (typeof document.number === 'string' && document.number.trim() === '')) {
            errors.push('Device number is required and cannot be empty');
        }

        if (!document.status) {
            errors.push('Device status is required');
        }

        if (!document.organization) {
            errors.push('Device organization is required');
        }

        // Check type-specific requirements
        const deviceType = document.type || 'playstation';
        
        if (deviceType === 'computer') {
            if (!document.hourlyRate || document.hourlyRate <= 0) {
                errors.push('Computer devices require a valid hourlyRate > 0');
            }
        } else if (deviceType === 'playstation') {
            if (!document.playstationRates || typeof document.playstationRates !== 'object') {
                errors.push('PlayStation devices require playstationRates object');
            } else {
                // Check that all controller counts have valid rates
                for (let i = 1; i <= 4; i++) {
                    const rate = document.playstationRates[i];
                    if (!rate || rate <= 0) {
                        errors.push(`PlayStation devices require valid rate for ${i} controller(s)`);
                    }
                }
            }
        }

        // Validate status enum
        const validStatuses = ['available', 'active', 'maintenance'];
        if (document.status && !validStatuses.includes(document.status)) {
            errors.push(`Invalid device status: ${document.status}. Must be one of: ${validStatuses.join(', ')}`);
        }

        // Validate type enum
        const validTypes = ['playstation', 'computer'];
        if (document.type && !validTypes.includes(document.type)) {
            errors.push(`Invalid device type: ${document.type}. Must be one of: ${validTypes.join(', ')}`);
        }

        return {
            success: errors.length === 0,
            errors
        };
    }

    /**
     * Get nested value from object using dot notation
     * @param {Object} obj - Object to search
     * @param {string} path - Path with dot notation
     * @returns {*} - Value at path or undefined
     */
    getNestedValue(obj, path) {
        return path.split('.').reduce((current, key) => {
            return current?.[key];
        }, obj);
    }

    /**
     * Determine if a change should be applied
     * Checks origin tracking and collection exclusions
     * @param {Object} change - Change event
     * @returns {boolean} - True if should apply
     */
    shouldApplyChange(change) {
        const collectionName = change.ns.coll;
        const documentId = change.documentKey._id;

        // Check if collection is excluded from bidirectional sync
        const excludedCollections = syncConfig.bidirectionalSync?.excludedCollections || [];
        if (excludedCollections.includes(collectionName)) {
            Logger.debug(`[ChangeProcessor] Skipping excluded collection: ${collectionName}`);
            return false;
        }

        // Check if this change originated from this instance
        // If it did, we don't want to apply it back (would create a loop)
        if (this.originTracker.shouldSkipSync(documentId, 'local')) {
            Logger.debug(`[ChangeProcessor] Skipping change from same instance: ${documentId}`);
            return false;
        }

        return true;
    }

    /**
     * Apply an insert operation
     * @param {Object} change - Insert change event
     * @returns {Promise<Object>} - Result
     */
    async applyInsert(change) {
        const collectionName = change.ns.coll;
        const document = change.fullDocument;

        try {
            Logger.debug(`[ChangeProcessor] Applying insert to ${collectionName}`);

            // Get the model for this collection
            const Model = this.getModel(collectionName);
            if (!Model) {
                return {
                    success: false,
                    reason: `Model not found for collection: ${collectionName}`
                };
            }

            // Validate document data before applying
            // Requirements: 9.1, 9.4, 9.5
            const sanitizedDocument = this.sanitizeDocumentForSync(document);
            const validation = this.validateDocumentData(sanitizedDocument, collectionName, 'insert');
            if (!validation.success) {
                Logger.error(`[ChangeProcessor] Document validation failed for insert in ${collectionName}:`, {
                    documentId: document._id,
                    errors: validation.errors
                });
                
                // For devices collection, completely reject invalid documents
                if (collectionName === 'devices') {
                    Logger.error(`[ChangeProcessor] Rejecting invalid device document from Atlas:`, {
                        documentId: document._id,
                        document: sanitizedDocument,
                        errors: validation.errors
                    });
                    
                    return {
                        success: false,
                        reason: 'Device validation failed - document rejected',
                        validationErrors: validation.errors
                    };
                }
                
                return {
                    success: false,
                    reason: 'Document validation failed',
                    validationErrors: validation.errors
                };
            }

            // Additional validation for specific collections
            if (collectionName === 'devices') {
                const deviceValidation = DeviceValidator.validateDevice(sanitizedDocument, 'insert');
                if (!deviceValidation.success) {
                    Logger.error(`[ChangeProcessor] Device validation failed for insert:`, {
                        documentId: document._id,
                        document: sanitizedDocument,
                        errors: deviceValidation.errors,
                        warnings: deviceValidation.warnings
                    });
                    
                    return {
                        success: false,
                        reason: 'Device validation failed - document rejected',
                        validationErrors: deviceValidation.errors
                    };
                }

                // Log warnings if any
                if (deviceValidation.warnings.length > 0) {
                    Logger.warn(`[ChangeProcessor] Device validation warnings for insert:`, {
                        documentId: document._id,
                        warnings: deviceValidation.warnings
                    });
                }
            }

            // Additional validation for bills collection
            if (collectionName === 'bills') {
                // Check if this bill was recently deleted locally
                // If it was deleted within the last 5 minutes, don't re-insert it
                const existingBill = await Model.findById(document._id).lean();
                if (!existingBill) {
                    // Bill doesn't exist locally - check if it was recently deleted
                    // by checking if any of its sessions point to a different bill
                    if (sanitizedDocument.sessions && sanitizedDocument.sessions.length > 0) {
                        const Session = mongoose.model('Session');
                        let hasSessionsInOtherBills = false;
                        
                        for (const sessionId of sanitizedDocument.sessions) {
                            const session = await Session.findById(sessionId).lean();
                            if (session && session.bill) {
                                const sessionBillId = session.bill._id ? session.bill._id.toString() : session.bill.toString();
                                const targetBillId = document._id.toString();
                                
                                if (sessionBillId !== targetBillId) {
                                    hasSessionsInOtherBills = true;
                                    Logger.warn(`[ChangeProcessor] 🚫 BLOCKED insert - bill was deleted and sessions moved to other bills:`, {
                                        billId: document._id,
                                        sessionId: sessionId,
                                        currentBill: sessionBillId
                                    });
                                    break;
                                }
                            }
                        }
                        
                        if (hasSessionsInOtherBills) {
                            return {
                                success: false,
                                reason: 'Bill was deleted locally and sessions belong to other bills - preventing re-insertion'
                            };
                        }
                    }
                }
                
                const billValidation = BillValidator.validateBill(sanitizedDocument, 'insert');
                if (!billValidation.success) {
                    Logger.error(`[ChangeProcessor] Bill validation failed for insert:`, {
                        documentId: document._id,
                        document: sanitizedDocument,
                        errors: billValidation.errors,
                        warnings: billValidation.warnings
                    });
                    
                    return {
                        success: false,
                        reason: 'Bill validation failed - document rejected',
                        validationErrors: billValidation.errors
                    };
                }

                // Log warnings if any
                if (billValidation.warnings.length > 0) {
                    Logger.warn(`[ChangeProcessor] Bill validation warnings for insert:`, {
                        documentId: document._id,
                        warnings: billValidation.warnings
                    });
                }

                // Special validation for bills collection - prevent session duplication in insert operations
                if (sanitizedDocument.sessions && sanitizedDocument.sessions.length > 0) {
                    const sessionValidation = await this.validateBillSessions(
                        document._id,
                        sanitizedDocument.sessions
                    );
                    
                    if (!sessionValidation.success) {
                        Logger.warn(`[ChangeProcessor] 🚫 BLOCKED insert operation - sessions belong to different bills:`, {
                            billId: document._id,
                            errors: sessionValidation.errors
                        });
                        
                        return {
                            success: false,
                            reason: 'Session validation failed - sessions belong to different bills',
                            validationErrors: sessionValidation.errors
                        };
                    }
                }
            }

            // Bypass sync middleware when applying
            await this.bypassMiddleware(async () => {
                // Use insertMany with ordered:false to handle duplicates gracefully
                try {
                    await Model.collection.insertOne(sanitizedDocument);
                } catch (error) {
                    // If duplicate key error, it means document already exists
                    // This is okay - it might have been synced already
                    if (error.code === 11000) {
                        Logger.debug(`[ChangeProcessor] Document already exists: ${document._id}`);
                        return { success: true, reason: 'Document already exists' };
                    }
                    throw error;
                }
            });

            Logger.debug(`[ChangeProcessor] Insert applied successfully: ${document._id}`);
            return { success: true };

        } catch (error) {
            Logger.error(`[ChangeProcessor] Error applying insert:`, error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Apply an update operation
     * @param {Object} change - Update change event
     * @returns {Promise<Object>} - Result
     */
    async applyUpdate(change) {
        const collectionName = change.ns.coll;
        const documentId = change.documentKey._id;
        const updateDescription = change.updateDescription;

        try {
            Logger.debug(`[ChangeProcessor] Applying update to ${collectionName}:${documentId}`);

            // Get the model for this collection
            const Model = this.getModel(collectionName);
            if (!Model) {
                return {
                    success: false,
                    reason: `Model not found for collection: ${collectionName}`
                };
            }

            // Validate updated fields before applying
            // Requirements: 9.1, 9.4, 9.5
            if (updateDescription.updatedFields) {
                const validation = this.validateDocumentData(
                    updateDescription.updatedFields, 
                    collectionName, 
                    'update'
                );
                
                if (!validation.success) {
                    Logger.error(`[ChangeProcessor] Update validation failed for ${collectionName}:${documentId}:`, {
                        errors: validation.errors
                    });
                    
                    return {
                        success: false,
                        reason: 'Update validation failed',
                        validationErrors: validation.errors
                    };
                }
                
                // Special validation for bills collection - prevent session duplication
                if (collectionName === 'bills' && updateDescription.updatedFields.sessions) {
                    const sessionValidation = await this.validateBillSessions(
                        documentId,
                        updateDescription.updatedFields.sessions
                    );
                    
                    if (!sessionValidation.success) {
                        Logger.error(`[ChangeProcessor] Bill session validation failed for ${documentId}:`, {
                            errors: sessionValidation.errors,
                            sessions: updateDescription.updatedFields.sessions
                        });
                        
                        return {
                            success: false,
                            reason: 'Bill session validation failed - preventing duplication',
                            validationErrors: sessionValidation.errors
                        };
                    }
                }
            }

            // Check for conflicts
            const localDoc = await Model.findById(documentId).lean();
            if (localDoc) {
                const resolution = this.conflictResolver.resolveConflict(localDoc, change);
                
                if (!resolution.shouldApply) {
                    Logger.debug(`[ChangeProcessor] Conflict resolved: keeping local version`);
                    this.stats.conflicts++;
                    return {
                        success: true,
                        reason: 'Conflict resolved - local version kept',
                        conflict: true
                    };
                }
                
                this.stats.conflicts++;
            }

            // Build update object
            const updateObj = {};
            
            if (updateDescription.updatedFields) {
                updateObj.$set = updateDescription.updatedFields;
            }
            
            if (updateDescription.removedFields && updateDescription.removedFields.length > 0) {
                updateObj.$unset = {};
                updateDescription.removedFields.forEach(field => {
                    updateObj.$unset[field] = '';
                });
            }

            // Bypass sync middleware when applying
            await this.bypassMiddleware(async () => {
                await Model.collection.updateOne(
                    { _id: documentId },
                    updateObj
                );
            });

            Logger.debug(`[ChangeProcessor] Update applied successfully: ${documentId}`);
            return { success: true };

        } catch (error) {
            Logger.error(`[ChangeProcessor] Error applying update:`, error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Apply a delete operation
     * @param {Object} change - Delete change event
     * @returns {Promise<Object>} - Result
     */
    async applyDelete(change) {
        const collectionName = change.ns.coll;
        const documentId = change.documentKey._id;

        try {
            Logger.debug(`[ChangeProcessor] Applying delete to ${collectionName}:${documentId}`);

            // Get the model for this collection
            const Model = this.getModel(collectionName);
            if (!Model) {
                return {
                    success: false,
                    reason: `Model not found for collection: ${collectionName}`
                };
            }

            // Bypass sync middleware when applying
            await this.bypassMiddleware(async () => {
                await Model.collection.deleteOne({ _id: documentId });
            });

            Logger.debug(`[ChangeProcessor] Delete applied successfully: ${documentId}`);
            return { success: true };

        } catch (error) {
            Logger.error(`[ChangeProcessor] Error applying delete:`, error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Apply a replace operation
     * @param {Object} change - Replace change event
     * @returns {Promise<Object>} - Result
     */
    async applyReplace(change) {
        const collectionName = change.ns.coll;
        const documentId = change.documentKey._id;
        const document = change.fullDocument;

        try {
            Logger.debug(`[ChangeProcessor] Applying replace to ${collectionName}:${documentId}`);

            // Get the model for this collection
            const Model = this.getModel(collectionName);
            if (!Model) {
                return {
                    success: false,
                    reason: `Model not found for collection: ${collectionName}`
                };
            }

            // Sanitize document for sync operations (convert populated objects to ObjectIds)
            const sanitizedDocument = this.sanitizeDocumentForSync(document);

            // Validate document data before applying
            // Requirements: 9.1, 9.4, 9.5
            const validation = this.validateDocumentData(sanitizedDocument, collectionName, 'replace');
            if (!validation.success) {
                Logger.error(`[ChangeProcessor] Document validation failed for replace in ${collectionName}:${documentId}:`, {
                    errors: validation.errors
                });
                
                // For devices collection, completely reject invalid documents
                if (collectionName === 'devices') {
                    Logger.error(`[ChangeProcessor] Rejecting invalid device document replacement from Atlas:`, {
                        documentId: documentId,
                        document: sanitizedDocument,
                        errors: validation.errors
                    });
                    
                    return {
                        success: false,
                        reason: 'Device validation failed - replacement rejected',
                        validationErrors: validation.errors
                    };
                }
                
                return {
                    success: false,
                    reason: 'Document validation failed',
                    validationErrors: validation.errors
                };
            }

            // Additional validation for specific collections
            if (collectionName === 'devices') {
                const deviceValidation = DeviceValidator.validateDevice(sanitizedDocument, 'replace');
                if (!deviceValidation.success) {
                    Logger.error(`[ChangeProcessor] Device validation failed for replace:`, {
                        documentId: documentId,
                        document: sanitizedDocument,
                        errors: deviceValidation.errors,
                        warnings: deviceValidation.warnings
                    });
                    
                    return {
                        success: false,
                        reason: 'Device validation failed - replacement rejected',
                        validationErrors: deviceValidation.errors
                    };
                }

                // Log warnings if any
                if (deviceValidation.warnings.length > 0) {
                    Logger.warn(`[ChangeProcessor] Device validation warnings for replace:`, {
                        documentId: documentId,
                        warnings: deviceValidation.warnings
                    });
                }
            }

            // Additional validation for bills collection
            if (collectionName === 'bills') {
                const billValidation = BillValidator.validateBill(sanitizedDocument, 'replace');
                if (!billValidation.success) {
                    Logger.error(`[ChangeProcessor] Bill validation failed for replace:`, {
                        documentId: documentId,
                        document: sanitizedDocument,
                        errors: billValidation.errors,
                        warnings: billValidation.warnings
                    });
                    
                    return {
                        success: false,
                        reason: 'Bill validation failed - replacement rejected',
                        validationErrors: billValidation.errors
                    };
                }

                // Log warnings if any
                if (billValidation.warnings.length > 0) {
                    Logger.warn(`[ChangeProcessor] Bill validation warnings for replace:`, {
                        documentId: documentId,
                        warnings: billValidation.warnings
                    });
                }

                // Special validation for bills collection - prevent session duplication in replace operations
                if (sanitizedDocument.sessions && sanitizedDocument.sessions.length > 0) {
                    const sessionValidation = await this.validateBillSessions(
                        documentId,
                        sanitizedDocument.sessions
                    );
                    
                    if (!sessionValidation.success) {
                        Logger.warn(`[ChangeProcessor] 🚫 BLOCKED replace operation - sessions belong to different bills:`, {
                            billId: documentId,
                            errors: sessionValidation.errors
                        });
                        
                        return {
                            success: false,
                            reason: 'Session validation failed - sessions belong to different bills',
                            validationErrors: sessionValidation.errors
                        };
                    }
                }
            }

            // Check for conflicts
            const localDoc = await Model.findById(documentId).lean();
            if (localDoc) {
                const resolution = this.conflictResolver.resolveConflict(localDoc, change);
                
                if (!resolution.shouldApply) {
                    Logger.debug(`[ChangeProcessor] Conflict resolved: keeping local version`);
                    this.stats.conflicts++;
                    return {
                        success: true,
                        reason: 'Conflict resolved - local version kept',
                        conflict: true
                    };
                }
                
                this.stats.conflicts++;
            }

            // Bypass sync middleware when applying
            await this.bypassMiddleware(async () => {
                await Model.collection.replaceOne(
                    { _id: documentId },
                    sanitizedDocument,
                    { upsert: true }
                );
            });

            Logger.debug(`[ChangeProcessor] Replace applied successfully: ${documentId}`);
            return { success: true };

        } catch (error) {
            Logger.error(`[ChangeProcessor] Error applying replace:`, error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get Mongoose model for a collection
     * @param {string} collectionName - Name of the collection
     * @returns {mongoose.Model|null} - Mongoose model or null
     */
    getModel(collectionName) {
        try {
            // Get local connection
            const connection = this.databaseManager?.localConnection || mongoose.connection;
            
            // Try to find model by collection name
            const modelNames = connection.modelNames();
            
            for (const modelName of modelNames) {
                const model = connection.model(modelName);
                if (model.collection.name === collectionName) {
                    return model;
                }
            }

            Logger.warn(`[ChangeProcessor] No model found for collection: ${collectionName}`);
            return null;

        } catch (error) {
            Logger.error(`[ChangeProcessor] Error getting model:`, error);
            return null;
        }
    }

    /**
     * Bypass sync middleware when applying changes
     * This prevents changes from Atlas being synced back to Atlas
     * @param {Function} operation - Async operation to execute
     * @returns {Promise<any>} - Operation result
     */
    async bypassMiddleware(operation) {
        // Store original sync state
        const originalSyncEnabled = syncConfig.enabled;
        
        try {
            // Temporarily disable sync
            syncConfig.enabled = false;
            
            // Execute the operation
            const result = await operation();
            
            return result;

        } finally {
            // Restore original sync state
            syncConfig.enabled = originalSyncEnabled;
        }
    }

    /**
     * Get processing statistics
     * @returns {Object} - Statistics
     */
    getStats() {
        return {
            ...this.stats,
            successRate: this.stats.totalProcessed > 0 
                ? (this.stats.successful / this.stats.totalProcessed * 100).toFixed(2) + '%'
                : '0%'
        };
    }

    /**
     * Reset statistics
     */
    resetStats() {
        this.stats = {
            totalProcessed: 0,
            successful: 0,
            failed: 0,
            skipped: 0,
            conflicts: 0
        };
    }

    /**
     * Add change to processing queue
     * @param {Object} change - Change event
     */
    enqueueChange(change) {
        this.processingQueue.push(change);
        
        // Process queue if not already processing
        if (!this.isProcessing) {
            this.processQueue();
        }
    }

    /**
     * Process queued changes in batches
     */
    async processQueue() {
        if (this.isProcessing || this.processingQueue.length === 0) {
            return;
        }

        this.isProcessing = true;

        try {
            while (this.processingQueue.length > 0) {
                // Get batch of changes
                const batch = this.processingQueue.splice(0, this.batchSize);
                
                // Process batch in parallel
                const results = await Promise.allSettled(
                    batch.map(change => this.processChange(change))
                );

                // Log batch results
                const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
                const failed = results.filter(r => r.status === 'rejected' || !r.value.success).length;
                
                Logger.debug(`[ChangeProcessor] Batch processed: ${successful} successful, ${failed} failed`);
            }

        } catch (error) {
            Logger.error('[ChangeProcessor] Error processing queue:', error);
        } finally {
            this.isProcessing = false;
        }
    }

    /**
     * Clear processing queue
     */
    clearQueue() {
        this.processingQueue = [];
        this.isProcessing = false;
    }

    /**
     * Get queue size
     * @returns {number} - Number of changes in queue
     */
    getQueueSize() {
        return this.processingQueue.length;
    }

    /**
     * Update excluded collections dynamically
     * Requirements: 8.4, 8.5
     * 
     * @param {string[]} collections - Array of collection names to exclude
     * @returns {Object} - Result with success flag
     */
    updateExcludedCollections(collections) {
        try {
            // Validate input
            if (!Array.isArray(collections)) {
                return {
                    success: false,
                    message: 'Collections must be an array'
                };
            }

            // Validate each collection name
            for (const coll of collections) {
                if (typeof coll !== 'string' || coll.trim() === '') {
                    return {
                        success: false,
                        message: `Invalid collection name: "${coll}"`
                    };
                }
            }

            // Update the config (this will affect shouldApplyChange checks)
            syncConfig.bidirectionalSync.excludedCollections = collections;

            Logger.info(`[ChangeProcessor] Updated excluded collections: ${collections.join(', ') || 'none'}`);

            return {
                success: true,
                message: 'Excluded collections updated successfully',
                excludedCollections: collections
            };

        } catch (error) {
            Logger.error('[ChangeProcessor] Error updating excluded collections:', error);
            return {
                success: false,
                message: `Error updating excluded collections: ${error.message}`
            };
        }
    }

    /**
     * Get current excluded collections
     * 
     * @returns {string[]} - Array of excluded collection names
     */
    getExcludedCollections() {
        return [...(syncConfig.bidirectionalSync?.excludedCollections || [])];
    }

    /**
     * Validate bill sessions to prevent duplication
     * Checks if sessions in the update belong to the correct bill
     * @param {ObjectId} billId - Bill ID being updated
     * @param {Array} sessions - Array of session IDs
     * @returns {Promise<Object>} - Validation result
     */
    async validateBillSessions(billId, sessions) {
        try {
            // If no sessions or empty array, it's valid
            if (!sessions || sessions.length === 0) {
                return { success: true };
            }

            // Get Session model
            const Session = mongoose.model('Session');
            
            const errors = [];
            
            // Check each session
            for (const sessionId of sessions) {
                try {
                    // Get the session document
                    const session = await Session.findById(sessionId).lean();
                    
                    if (!session) {
                        // Session doesn't exist - skip validation
                        continue;
                    }
                    
                    // Check if session.bill matches the bill being updated
                    const sessionBillId = session.bill?._id ? session.bill._id.toString() : session.bill?.toString();
                    const targetBillId = billId.toString();
                    
                    if (sessionBillId && sessionBillId !== targetBillId) {
                        // Session belongs to a different bill - REJECT
                        errors.push({
                            sessionId: sessionId.toString(),
                            currentBill: sessionBillId,
                            attemptedBill: targetBillId,
                            message: `Session ${sessionId} belongs to bill ${sessionBillId}, cannot add to bill ${targetBillId}`
                        });
                        
                        Logger.warn(`[ChangeProcessor] 🚫 BLOCKED: Attempt to add session ${sessionId} to wrong bill`, {
                            sessionId: sessionId.toString(),
                            sessionBill: sessionBillId,
                            targetBill: targetBillId
                        });
                    }
                } catch (sessionError) {
                    Logger.error(`[ChangeProcessor] Error validating session ${sessionId}:`, sessionError);
                    // Continue with other sessions
                }
            }
            
            if (errors.length > 0) {
                return {
                    success: false,
                    errors: errors
                };
            }
            
            return { success: true };
            
        } catch (error) {
            Logger.error('[ChangeProcessor] Error in validateBillSessions:', error);
            // On error, allow the update to prevent blocking legitimate changes
            return { success: true };
        }
    }
}

export default ChangeProcessor;
