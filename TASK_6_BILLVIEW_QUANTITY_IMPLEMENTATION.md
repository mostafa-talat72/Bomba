# Task 6: BillView Component - Quantity Selection Implementation

## Overview
Successfully implemented quantity selection functionality in the BillView component to support partial payment of specific quantities of items.

## Changes Made

### 1. State Management
Added new state variables to manage the payment modal and quantity selection:
- `showPaymentModal`: Controls the visibility of the payment modal
- `selectedItems`: Tracks which items are selected for payment
- `itemQuantities`: Stores the quantity to pay for each selected item
- `paymentMethod`: Stores the selected payment method (cash/card/transfer)
- `isProcessingPayment`: Indicates if a payment is being processed
- `paymentError`: Stores any error messages from payment processing

### 2. Payment Handler Function
Implemented `handlePaymentSubmit()` function that:
- Aggregates selected items with their quantities
- Finds the itemId for each item from the orders
- Calls the `api.payForItems()` method with the correct payload format
- Handles success and error responses
- Refreshes the bill data after successful payment
- Resets the modal state

### 3. UI Components Added

#### Payment Button
- Added "دفع أصناف محددة" (Pay for specific items) button in the header
- Only visible when bill status is not 'paid' and there are orders
- Opens the payment modal when clicked

#### Payment Modal
The modal includes:

**Item Selection Section:**
- Lists all items with remaining quantities > 0
- For each item displays:
  - Item name with price
  - Quantity controls (-, +, and "Pay Full Quantity" buttons)
  - Current quantity selector display
  - Total quantity, paid quantity, and remaining quantity
  - Addons information if applicable
- Shows "All items fully paid" message when no items remain

**Payment Method Section:**
- Three payment method options: Cash (💵), Card (💳), Transfer (📱)
- Visual indication of selected method with orange highlighting

**Payment Summary Section:**
- Shows selected items with quantities
- Displays individual item totals
- Shows grand total of payment
- Only visible when items are selected

**Action Buttons:**
- Cancel button: Closes modal and resets state
- Confirm Payment button: 
  - Disabled when no items selected or during processing
  - Shows loading spinner during payment processing
  - Displays appropriate text based on state

### 4. Error Handling
- Displays error messages in a red alert box at the top of the modal
- Validates that items are selected before allowing payment
- Handles API errors gracefully
- Clears errors when modal is closed

### 5. Integration with Existing Code
- Uses the existing `aggregateItemsWithPayments()` utility function
- Leverages the existing `api.payForItems()` method
- Maintains consistency with the Billing.tsx implementation
- Uses the same item key generation logic for proper item identification

## Requirements Validated

✅ **Requirement 1.1**: Payment amount calculation based on selected quantity
✅ **Requirement 1.2**: Quantity tracking update (paid and remaining quantities)
✅ **Requirement 1.4**: Display of paid quantity and remaining quantity
✅ **Requirement 4.1**: Validation to prevent overpayment (enforced by +/- button limits)
✅ **Requirement 4.2**: Validation to prevent invalid quantity input (buttons disabled appropriately)

## Technical Details

### Item Key Generation
Items are uniquely identified using a composite key:
```typescript
const itemKey = `${item.name}|${item.price}|${addonsKey}`;
```
This ensures items with the same name but different prices or addons are treated separately.

### Quantity Controls
- Minus button: Decreases quantity, disabled when quantity is 0
- Plus button: Increases quantity, disabled when quantity reaches remaining quantity
- "Pay Full Quantity" button: Sets quantity to remaining quantity, disabled when already at max

### Payment Flow
1. User opens payment modal
2. User selects items and quantities using +/- buttons
3. User selects payment method
4. User reviews payment summary
5. User clicks "Confirm Payment"
6. System processes payment via API
7. Bill is refreshed with updated payment information
8. Modal closes and state is reset

## Testing Recommendations

### Manual Testing
1. Open a bill with unpaid items via QR code or direct link
2. Click "دفع أصناف محددة" button
3. Test quantity selection with +/- buttons
4. Test "Pay Full Quantity" button
5. Verify payment summary calculations
6. Test payment with different methods
7. Verify error handling with invalid scenarios
8. Confirm bill updates after successful payment

### Edge Cases to Test
- Bill with all items fully paid
- Bill with partially paid items
- Items with addons
- Multiple items with same name but different prices
- Payment of partial quantities across multiple items
- Network errors during payment
- Invalid quantity attempts (should be prevented by UI)

## Files Modified
- `src/pages/BillView.tsx`: Added payment modal and quantity selection functionality

## Dependencies
- Existing `api.payForItems()` method in `src/services/api.ts`
- Existing `aggregateItemsWithPayments()` utility in `src/utils/billAggregation.ts`
- Existing `formatCurrency()` and `formatDecimal()` utilities

## Notes
- The implementation follows the same pattern as the Billing.tsx component for consistency
- All TypeScript types are properly defined and no compilation errors exist
- The UI is fully responsive and follows the existing design patterns
- Arabic RTL support is maintained throughout
- The component properly handles loading states and errors
