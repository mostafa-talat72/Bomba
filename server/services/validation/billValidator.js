/**
 * Bill Validation Service
 * 
 * Provides comprehensive validation for bill documents
 * Used by sync system, API controllers, and database operations
 */

import mongoose from 'mongoose';
import Logger from '../../middleware/logger.js';

class BillValidator {
    /**
     * Validate a complete bill document
     * @param {Object} bill - Bill document to validate
     * @param {string} operation - Operation type ('insert', 'update', 'replace')
     * @returns {Object} - Validation result
     */
    static validateBill(bill, operation = 'insert') {
        const errors = [];
        const warnings = [];

        try {
            // Basic structure validation
            if (!bill || typeof bill !== 'object') {
                errors.push('Bill must be a valid object');
                return { success: false, errors, warnings };
            }

            // Required fields validation
            const requiredFieldsResult = this.validateRequiredFields(bill, operation);
            if (!requiredFieldsResult.success) {
                errors.push(...requiredFieldsResult.errors);
            }

            // Enum validation
            const enumValidationResult = this.validateEnumFields(bill);
            if (!enumValidationResult.success) {
                errors.push(...enumValidationResult.errors);
            }

            // Numeric constraints validation
            const numericValidationResult = this.validateNumericConstraints(bill);
            if (!numericValidationResult.success) {
                errors.push(...numericValidationResult.errors);
            }

            // Business logic validation
            const businessValidationResult = this.validateBusinessLogic(bill);
            if (!businessValidationResult.success) {
                errors.push(...businessValidationResult.errors);
            }
            warnings.push(...businessValidationResult.warnings);

            return {
                success: errors.length === 0,
                errors,
                warnings
            };

        } catch (error) {
            Logger.error('[BillValidator] Validation error:', error);
            return {
                success: false,
                errors: [`Validation error: ${error.message}`],
                warnings
            };
        }
    }

    /**
     * Validate required fields
     * @param {Object} bill - Bill document
     * @param {string} operation - Operation type
     * @returns {Object} - Validation result
     */
    static validateRequiredFields(bill, operation) {
        const errors = [];

        // Always required fields
        const alwaysRequired = ['organization', 'createdBy'];
        
        // Required for insert and replace operations
        const insertRequired = ['subtotal', 'total', 'billType'];

        const requiredFields = operation === 'update' ? alwaysRequired : [...alwaysRequired, ...insertRequired];

        for (const field of requiredFields) {
            const value = bill[field];
            
            if (value === undefined || value === null) {
                errors.push(`Required field missing: "${field}"`);
            } else if (typeof value === 'string' && value.trim() === '') {
                errors.push(`Required field cannot be empty: "${field}"`);
            }
        }

        // Validate ObjectId fields
        const objectIdFields = ['organization', 'createdBy', 'updatedBy', 'table'];
        for (const field of objectIdFields) {
            if (bill[field] && !mongoose.Types.ObjectId.isValid(bill[field])) {
                errors.push(`Invalid ObjectId for field "${field}"`);
            }
        }

        return {
            success: errors.length === 0,
            errors
        };
    }

    /**
     * Validate enum fields
     * @param {Object} bill - Bill document
     * @returns {Object} - Validation result
     */
    static validateEnumFields(bill) {
        const errors = [];

        // Validate bill status
        const validStatuses = ['draft', 'partial', 'paid', 'cancelled', 'overdue'];
        if (bill.status && !validStatuses.includes(bill.status)) {
            errors.push(`Invalid bill status: "${bill.status}". Must be one of: ${validStatuses.join(', ')}`);
        }

        // Validate bill type
        const validTypes = ['cafe', 'playstation', 'computer'];
        if (bill.billType && !validTypes.includes(bill.billType)) {
            errors.push(`Invalid bill type: "${bill.billType}". Must be one of: ${validTypes.join(', ')}`);
        }

        // Validate payment method
        const validPaymentMethods = ['cash', 'card', 'transfer', 'mixed'];
        if (bill.paymentMethod && !validPaymentMethods.includes(bill.paymentMethod)) {
            errors.push(`Invalid payment method: "${bill.paymentMethod}". Must be one of: ${validPaymentMethods.join(', ')}`);
        }

        return {
            success: errors.length === 0,
            errors
        };
    }

    /**
     * Validate numeric constraints
     * @param {Object} bill - Bill document
     * @returns {Object} - Validation result
     */
    static validateNumericConstraints(bill) {
        const errors = [];

        // Validate numeric fields
        const numericFields = ['subtotal', 'tax', 'total', 'discount', 'paid', 'remaining'];
        
        for (const field of numericFields) {
            if (bill[field] !== undefined) {
                if (typeof bill[field] !== 'number' || bill[field] < 0) {
                    errors.push(`${field} must be a non-negative number`);
                }
            }
        }

        // Validate that total >= subtotal (if both exist)
        if (bill.subtotal !== undefined && bill.total !== undefined) {
            if (bill.total < bill.subtotal) {
                errors.push('Total cannot be less than subtotal');
            }
        }

        return {
            success: errors.length === 0,
            errors
        };
    }

    /**
     * Validate business logic rules
     * @param {Object} bill - Bill document
     * @returns {Object} - Validation result
     */
    static validateBusinessLogic(bill) {
        const errors = [];
        const warnings = [];

        // Validate bill number format
        if (bill.billNumber && typeof bill.billNumber === 'string') {
            if (bill.billNumber.length > 50) {
                errors.push('Bill number cannot exceed 50 characters');
            }
            if (bill.billNumber.length < 3) {
                errors.push('Bill number must be at least 3 characters long');
            }
        }

        // Validate arrays
        if (bill.orders && !Array.isArray(bill.orders)) {
            errors.push('Orders must be an array');
        }

        if (bill.sessions && !Array.isArray(bill.sessions)) {
            errors.push('Sessions must be an array');
        }

        if (bill.payments && !Array.isArray(bill.payments)) {
            errors.push('Payments must be an array');
        }

        // Validate payment consistency
        if (bill.status === 'paid' && bill.remaining > 0) {
            warnings.push('Bill marked as paid but has remaining amount');
        }

        if (bill.status === 'draft' && bill.paid > 0) {
            warnings.push('Bill marked as draft but has amount paid');
        }

        return {
            success: errors.length === 0,
            errors,
            warnings
        };
    }

    /**
     * Sanitize bill document
     * Removes invalid fields and applies defaults
     * @param {Object} bill - Bill document to sanitize
     * @returns {Object} - Sanitized bill document
     */
    static sanitizeBill(bill) {
        if (!bill || typeof bill !== 'object') {
            return null;
        }

        const sanitized = { ...bill };

        // Apply defaults
        if (!sanitized.status) {
            sanitized.status = 'draft';
        }

        if (!sanitized.billType) {
            sanitized.billType = 'cafe';
        }

        if (!sanitized.paymentMethod) {
            sanitized.paymentMethod = 'cash';
        }

        if (sanitized.subtotal === undefined) {
            sanitized.subtotal = 0;
        }

        if (sanitized.total === undefined) {
            sanitized.total = 0;
        }

        if (sanitized.tax === undefined) {
            sanitized.tax = 0;
        }

        if (sanitized.discount === undefined) {
            sanitized.discount = 0;
        }

        if (sanitized.paid === undefined) {
            sanitized.paid = 0;
        }

        if (sanitized.remaining === undefined) {
            sanitized.remaining = 0;
        }

        // Ensure arrays are initialized
        if (!sanitized.orders) {
            sanitized.orders = [];
        }

        if (!sanitized.sessions) {
            sanitized.sessions = [];
        }

        if (!sanitized.payments) {
            sanitized.payments = [];
        }

        // Trim string fields
        if (typeof sanitized.billNumber === 'string') {
            sanitized.billNumber = sanitized.billNumber.trim();
        }

        if (typeof sanitized.notes === 'string') {
            sanitized.notes = sanitized.notes.trim();
        }

        return sanitized;
    }

    /**
     * Check if a bill document can be safely inserted/updated
     * @param {Object} bill - Bill document
     * @param {string} operation - Operation type
     * @returns {boolean} - True if safe to proceed
     */
    static isSafeForOperation(bill, operation = 'insert') {
        const validation = this.validateBill(bill, operation);
        
        if (!validation.success) {
            Logger.warn(`[BillValidator] Bill validation failed for ${operation}:`, {
                errors: validation.errors,
                warnings: validation.warnings,
                bill: bill
            });
            return false;
        }

        if (validation.warnings.length > 0) {
            Logger.info(`[BillValidator] Bill validation warnings for ${operation}:`, {
                warnings: validation.warnings,
                billId: bill._id
            });
        }

        return true;
    }
}

export default BillValidator;