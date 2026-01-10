/**
 * Device Validation Service
 * 
 * Provides comprehensive validation for device documents
 * Used by sync system, API controllers, and database operations
 */

import Logger from '../../middleware/logger.js';

class DeviceValidator {
    /**
     * Validate a complete device document
     * @param {Object} device - Device document to validate
     * @param {string} operation - Operation type ('insert', 'update', 'replace')
     * @returns {Object} - Validation result
     */
    static validateDevice(device, operation = 'insert') {
        const errors = [];
        const warnings = [];

        try {
            // Basic structure validation
            if (!device || typeof device !== 'object') {
                errors.push('Device must be a valid object');
                return { success: false, errors, warnings };
            }

            // Required fields validation
            const requiredFieldsResult = this.validateRequiredFields(device, operation);
            if (!requiredFieldsResult.success) {
                errors.push(...requiredFieldsResult.errors);
            }

            // Type-specific validation
            const typeValidationResult = this.validateTypeSpecificFields(device);
            if (!typeValidationResult.success) {
                errors.push(...typeValidationResult.errors);
            }
            warnings.push(...typeValidationResult.warnings);

            // Enum validation
            const enumValidationResult = this.validateEnumFields(device);
            if (!enumValidationResult.success) {
                errors.push(...enumValidationResult.errors);
            }

            // Numeric constraints validation
            const numericValidationResult = this.validateNumericConstraints(device);
            if (!numericValidationResult.success) {
                errors.push(...numericValidationResult.errors);
            }

            // Business logic validation
            const businessValidationResult = this.validateBusinessLogic(device);
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
            Logger.error('[DeviceValidator] Validation error:', error);
            return {
                success: false,
                errors: [`Validation error: ${error.message}`],
                warnings
            };
        }
    }

    /**
     * Validate required fields
     * @param {Object} device - Device document
     * @param {string} operation - Operation type
     * @returns {Object} - Validation result
     */
    static validateRequiredFields(device, operation) {
        const errors = [];

        // Always required fields
        const alwaysRequired = ['name', 'organization'];
        
        // Required for insert and replace operations
        const insertRequired = ['number', 'status'];

        const requiredFields = operation === 'update' ? alwaysRequired : [...alwaysRequired, ...insertRequired];

        for (const field of requiredFields) {
            const value = device[field];
            
            if (value === undefined || value === null) {
                errors.push(`Required field missing: "${field}"`);
            } else if (typeof value === 'string' && value.trim() === '') {
                errors.push(`Required field cannot be empty: "${field}"`);
            }
        }

        return {
            success: errors.length === 0,
            errors
        };
    }

    /**
     * Validate type-specific fields
     * @param {Object} device - Device document
     * @returns {Object} - Validation result
     */
    static validateTypeSpecificFields(device) {
        const errors = [];
        const warnings = [];

        const deviceType = device.type || 'playstation'; // Default type

        if (deviceType === 'computer') {
            // Computer devices require hourlyRate
            if (!device.hourlyRate || device.hourlyRate <= 0) {
                errors.push('Computer devices require a valid hourlyRate > 0');
            }

            // Computer devices shouldn't have playstationRates
            if (device.playstationRates) {
                warnings.push('Computer devices should not have playstationRates field');
            }

        } else if (deviceType === 'playstation') {
            // PlayStation devices require playstationRates
            if (!device.playstationRates || typeof device.playstationRates !== 'object') {
                errors.push('PlayStation devices require playstationRates object');
            } else {
                // Validate playstationRates structure
                const ratesValidation = this.validatePlayStationRates(device.playstationRates);
                if (!ratesValidation.success) {
                    errors.push(...ratesValidation.errors);
                }
                warnings.push(...ratesValidation.warnings);
            }

            // PlayStation devices shouldn't have hourlyRate
            if (device.hourlyRate !== undefined) {
                warnings.push('PlayStation devices should not have hourlyRate field');
            }
        }

        return {
            success: errors.length === 0,
            errors,
            warnings
        };
    }

    /**
     * Validate PlayStation rates structure
     * @param {Object} rates - PlayStation rates object
     * @returns {Object} - Validation result
     */
    static validatePlayStationRates(rates) {
        const errors = [];
        const warnings = [];

        if (!rates || typeof rates !== 'object') {
            errors.push('PlayStation rates must be an object');
            return { success: false, errors, warnings };
        }

        // Check that all controller counts (1-4) have valid rates
        for (let i = 1; i <= 4; i++) {
            const rate = rates[i.toString()];
            
            if (rate === undefined || rate === null) {
                errors.push(`PlayStation rates missing for ${i} controller(s)`);
            } else if (typeof rate !== 'number' || rate <= 0) {
                errors.push(`PlayStation rate for ${i} controller(s) must be a positive number`);
            }
        }

        // Check for unexpected keys
        const validKeys = ['1', '2', '3', '4'];
        const actualKeys = Object.keys(rates);
        const invalidKeys = actualKeys.filter(key => !validKeys.includes(key));
        
        if (invalidKeys.length > 0) {
            warnings.push(`Unexpected keys in playstationRates: ${invalidKeys.join(', ')}`);
        }

        return {
            success: errors.length === 0,
            errors,
            warnings
        };
    }

    /**
     * Validate enum fields
     * @param {Object} device - Device document
     * @returns {Object} - Validation result
     */
    static validateEnumFields(device) {
        const errors = [];

        // Validate device type
        const validTypes = ['playstation', 'computer'];
        if (device.type && !validTypes.includes(device.type)) {
            errors.push(`Invalid device type: "${device.type}". Must be one of: ${validTypes.join(', ')}`);
        }

        // Validate device status
        const validStatuses = ['available', 'active', 'maintenance'];
        if (device.status && !validStatuses.includes(device.status)) {
            errors.push(`Invalid device status: "${device.status}". Must be one of: ${validStatuses.join(', ')}`);
        }

        return {
            success: errors.length === 0,
            errors
        };
    }

    /**
     * Validate numeric constraints
     * @param {Object} device - Device document
     * @returns {Object} - Validation result
     */
    static validateNumericConstraints(device) {
        const errors = [];

        // Validate controllers count
        if (device.controllers !== undefined) {
            if (typeof device.controllers !== 'number' || device.controllers < 1 || device.controllers > 4) {
                errors.push('Controllers count must be a number between 1 and 4');
            }
        }

        // Validate hourlyRate (for computer devices)
        if (device.hourlyRate !== undefined) {
            if (typeof device.hourlyRate !== 'number' || device.hourlyRate < 0) {
                errors.push('Hourly rate must be a non-negative number');
            }
        }

        return {
            success: errors.length === 0,
            errors
        };
    }

    /**
     * Validate business logic rules
     * @param {Object} device - Device document
     * @returns {Object} - Validation result
     */
    static validateBusinessLogic(device) {
        const errors = [];
        const warnings = [];

        // Device number format validation
        if (device.number && typeof device.number === 'string') {
            const deviceType = device.type || 'playstation';
            const expectedPrefix = deviceType === 'playstation' ? 'ps' : 'pc';
            
            if (!device.number.startsWith(expectedPrefix)) {
                warnings.push(`Device number "${device.number}" should start with "${expectedPrefix}" for ${deviceType} devices`);
            }
        }

        // Name length validation
        if (device.name && typeof device.name === 'string') {
            if (device.name.length > 100) {
                errors.push('Device name cannot exceed 100 characters');
            }
            if (device.name.length < 2) {
                errors.push('Device name must be at least 2 characters long');
            }
        }

        return {
            success: errors.length === 0,
            errors,
            warnings
        };
    }

    /**
     * Sanitize device document
     * Removes invalid fields and applies defaults
     * @param {Object} device - Device document to sanitize
     * @returns {Object} - Sanitized device document
     */
    static sanitizeDevice(device) {
        if (!device || typeof device !== 'object') {
            return null;
        }

        const sanitized = { ...device };

        // Apply defaults
        if (!sanitized.type) {
            sanitized.type = 'playstation';
        }

        if (!sanitized.status) {
            sanitized.status = 'available';
        }

        if (!sanitized.controllers) {
            sanitized.controllers = 2;
        }

        // Type-specific defaults
        if (sanitized.type === 'computer' && !sanitized.hourlyRate) {
            sanitized.hourlyRate = 15;
        }

        if (sanitized.type === 'playstation' && !sanitized.playstationRates) {
            sanitized.playstationRates = {
                '1': 20,
                '2': 20,
                '3': 25,
                '4': 30
            };
        }

        // Clean up type-specific fields
        if (sanitized.type === 'computer') {
            delete sanitized.playstationRates;
        } else if (sanitized.type === 'playstation') {
            delete sanitized.hourlyRate;
        }

        // Trim string fields
        if (typeof sanitized.name === 'string') {
            sanitized.name = sanitized.name.trim();
        }

        return sanitized;
    }

    /**
     * Check if a device document can be safely inserted/updated
     * @param {Object} device - Device document
     * @param {string} operation - Operation type
     * @returns {boolean} - True if safe to proceed
     */
    static isSafeForOperation(device, operation = 'insert') {
        const validation = this.validateDevice(device, operation);
        
        if (!validation.success) {
            Logger.warn(`[DeviceValidator] Device validation failed for ${operation}:`, {
                errors: validation.errors,
                warnings: validation.warnings,
                device: device
            });
            return false;
        }

        if (validation.warnings.length > 0) {
            Logger.info(`[DeviceValidator] Device validation warnings for ${operation}:`, {
                warnings: validation.warnings,
                deviceId: device._id
            });
        }

        return true;
    }
}

export default DeviceValidator;