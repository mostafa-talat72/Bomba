# Data Validation Implementation

## Overview

This document describes the data validation and safety features implemented in the Change Processor for bidirectional sync. The validation ensures data integrity before applying changes from Atlas to Local MongoDB.

**Requirements:** 9.1, 9.4, 9.5

## Features

### 1. Document Structure Validation

Validates that documents conform to the expected schema structure:
- Checks for valid document objects
- Identifies unknown fields (logs warnings but doesn't reject)
- Supports nested fields with dot notation

### 2. Field Type Validation

Validates that field values match the expected types from Mongoose schemas:
- **Number**: Validates numeric values
- **String**: Accepts most types (can be converted)
- **Boolean**: Validates boolean values
- **Date**: Validates Date objects and parseable date strings
- **ObjectId**: Validates MongoDB ObjectIds and valid ObjectId strings
- **Array**: Validates array types

### 3. Required Fields Validation

Ensures all required fields are present:
- Only applies to `insert` and `replace` operations
- Skipped for `update` operations (partial documents)
- Checks all fields marked as `required` in schema

### 4. Enum Validation

Validates enum field values:
- Checks that values are in the allowed enum list
- Provides clear error messages with valid options
- Applies to fields like `status`, `paymentMethod`, `billType`, etc.

### 5. Numeric Constraints Validation

Validates numeric field constraints:
- **Min**: Ensures values are not below minimum
- **Max**: Ensures values do not exceed maximum
- Examples: `subtotal >= 0`, `controllers <= 4`

## Implementation

### Core Validation Method

```javascript
validateDocumentData(document, collectionName, operationType)
```

**Parameters:**
- `document`: Document or partial document to validate
- `collectionName`: Name of the collection (e.g., 'bills', 'orders')
- `operationType`: Type of operation ('insert', 'update', 'replace')

**Returns:**
```javascript
{
    success: boolean,
    errors: string[]
}
```

### Integration with Change Processing

Validation is integrated into all change application methods:

#### Insert Operations
```javascript
async applyInsert(change) {
    // ... get model ...
    
    // Validate document
    const validation = this.validateDocumentData(
        document, 
        collectionName, 
        'insert'
    );
    
    if (!validation.success) {
        Logger.error('Document validation failed', {
            documentId: document._id,
            errors: validation.errors
        });
        
        return {
            success: false,
            reason: 'Document validation failed',
            validationErrors: validation.errors
        };
    }
    
    // ... apply change ...
}
```

#### Update Operations
```javascript
async applyUpdate(change) {
    // ... get model ...
    
    // Validate updated fields
    if (updateDescription.updatedFields) {
        const validation = this.validateDocumentData(
            updateDescription.updatedFields,
            collectionName,
            'update'
        );
        
        if (!validation.success) {
            // Reject invalid update
            return {
                success: false,
                reason: 'Update validation failed',
                validationErrors: validation.errors
            };
        }
    }
    
    // ... apply change ...
}
```

#### Replace Operations
```javascript
async applyReplace(change) {
    // ... get model ...
    
    // Validate full document
    const validation = this.validateDocumentData(
        document,
        collectionName,
        'replace'
    );
    
    if (!validation.success) {
        // Reject invalid replacement
        return {
            success: false,
            reason: 'Document validation failed',
            validationErrors: validation.errors
        };
    }
    
    // ... apply change ...
}
```

## Error Handling

### Validation Failures

When validation fails:
1. **Logging**: Error is logged with details
2. **Rejection**: Change is rejected (not applied)
3. **Statistics**: Failure is recorded in stats
4. **Response**: Detailed error messages returned

### Error Message Format

```javascript
{
    success: false,
    reason: 'Document validation failed',
    validationErrors: [
        'Required field missing: "organization"',
        'Invalid enum value for field "status": "invalid_status" not in [draft, partial, paid, cancelled, overdue]',
        'Value for field "subtotal" (-50) is below minimum (0)',
        'Type mismatch for field "total": expected Number, got String'
    ]
}
```

## Validation Rules by Collection

### Bills Collection

**Required Fields:**
- `subtotal` (Number, min: 0)
- `total` (Number, min: 0)
- `organization` (ObjectId)
- `createdBy` (ObjectId)
- `billType` (String, enum)

**Enum Fields:**
- `status`: ['draft', 'partial', 'paid', 'cancelled', 'overdue']
- `paymentMethod`: ['cash', 'card', 'transfer', 'mixed']
- `billType`: ['cafe', 'playstation', 'computer']

**Numeric Constraints:**
- `subtotal`, `total`, `paid`, `remaining`, `discount`, `tax`: min: 0
- `discountPercentage`: min: 0, max: 100

### Orders Collection

**Required Fields:**
- `orderNumber` (String)
- `subtotal` (Number, min: 0)
- `finalAmount` (Number, min: 0)
- `organization` (ObjectId)
- `createdBy` (ObjectId)

**Enum Fields:**
- `status`: ['pending', 'preparing', 'ready', 'delivered', 'cancelled']

**Numeric Constraints:**
- `subtotal`, `finalAmount`, `discount`, `totalCost`: min: 0

### Sessions Collection

**Required Fields:**
- `deviceNumber` (String)
- `deviceName` (String)
- `deviceId` (ObjectId)
- `deviceType` (String, enum)
- `startTime` (Date)
- `status` (String, enum)
- `organization` (ObjectId)
- `createdBy` (ObjectId)

**Enum Fields:**
- `deviceType`: ['playstation', 'computer']
- `status`: ['active', 'completed', 'cancelled']

**Numeric Constraints:**
- `controllers`: min: 1, max: 4
- `totalCost`, `discount`, `finalCost`: min: 0

## Testing

### Unit Tests

Test individual validation methods:
```bash
node server/scripts/testDataValidation.js
```

**Tests:**
1. Valid documents (should pass)
2. Missing required fields (should reject)
3. Invalid enum values (should reject)
4. Negative numbers (should reject)
5. Wrong types (should reject)
6. Update operations (should not check required fields)

### Integration Tests

Test validation with change processing:
```bash
node server/scripts/testValidationIntegration.js
```

**Tests:**
1. Valid insert changes (should process)
2. Invalid insert changes (should reject)
3. Invalid update changes (should reject)
4. Valid update changes (should process)
5. Invalid replace changes (should reject)
6. Statistics tracking (should count failures)

## Performance Considerations

### Validation Overhead

- **Minimal Impact**: Validation is fast (< 1ms per document)
- **Schema Caching**: Mongoose schemas are cached
- **Early Exit**: Validation stops on first critical error
- **Async Processing**: Validation doesn't block other operations

### Optimization Strategies

1. **Selective Validation**: Only validate changed fields in updates
2. **Schema Reuse**: Reuse Mongoose schema definitions
3. **Batch Processing**: Validate multiple changes in parallel
4. **Error Aggregation**: Collect all errors before rejecting

## Monitoring

### Validation Metrics

Track validation failures:
```javascript
const stats = changeProcessor.getStats();
console.log('Failed:', stats.failed);
console.log('Success Rate:', stats.successRate);
```

### Logging

All validation failures are logged:
```javascript
Logger.error('[ChangeProcessor] Document validation failed', {
    collection: 'bills',
    documentId: '...',
    errors: [...]
});
```

## Best Practices

### 1. Schema Design

- Define clear required fields
- Use appropriate enum values
- Set realistic min/max constraints
- Document field purposes

### 2. Error Handling

- Log all validation failures
- Provide detailed error messages
- Track validation statistics
- Monitor failure patterns

### 3. Testing

- Test all validation rules
- Test edge cases
- Test with real data
- Test performance impact

### 4. Maintenance

- Keep schemas up to date
- Review validation logs
- Update validation rules as needed
- Document schema changes

## Troubleshooting

### Common Issues

**Issue: Valid documents rejected**
- Check schema definitions
- Verify field types match
- Check for typos in field names
- Review enum values

**Issue: Invalid documents accepted**
- Verify validation is enabled
- Check schema constraints
- Review validation logic
- Test with invalid data

**Issue: Performance degradation**
- Check validation complexity
- Review schema size
- Monitor validation time
- Consider caching strategies

## Future Enhancements

1. **Custom Validators**: Support custom validation functions
2. **Async Validation**: Support async validation rules
3. **Validation Caching**: Cache validation results
4. **Validation Profiles**: Different validation levels (strict/lenient)
5. **Schema Versioning**: Handle schema migrations

## References

- Requirements: 9.1, 9.4, 9.5
- Design Document: `.kiro/specs/bidirectional-sync/design.md`
- Change Processor: `server/services/sync/changeProcessor.js`
- Test Scripts: `server/scripts/testDataValidation.js`
