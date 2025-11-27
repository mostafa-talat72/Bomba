# Implementation Plan

- [x] 1. Update Bill Model Schema


  - Add `paidQuantity` field to itemPayments schema
  - Add `paymentHistory` array to itemPayments schema
  - Update `isPaid` to be computed from `paidQuantity === quantity`
  - Add virtual field `remainingQuantity` computed as `quantity - paidQuantity`
  - _Requirements: 3.1, 3.2_

- [ ]* 1.1 Write property test for initial quantity state
  - **Property 10: Initial quantity state**
  - **Validates: Requirements 3.1**



- [x] 2. Update Bill Model Methods





  - Modify `payForItems()` method to accept items array with quantities
  - Update quantity tracking logic to use `paidQuantity` instead of `isPaid`
  - Add validation for quantity (must be > 0 and <= remainingQuantity)
  - Update `paymentHistory` for each item payment
  - Update `calculateRemainingAmount()` to use `paidQuantity`
  - _Requirements: 1.1, 1.2, 1.3, 2.1, 4.1, 4.2, 4.3_

- [ ]* 2.1 Write property test for payment amount calculation
  - **Property 1: Payment amount calculation**
  - **Validates: Requirements 1.1**

- [ ]* 2.2 Write property test for quantity tracking update
  - **Property 2: Quantity tracking update**
  - **Validates: Requirements 1.2**

- [ ]* 2.3 Write property test for payment history recording
  - **Property 3: Payment history recording**
  - **Validates: Requirements 1.3**

- [ ]* 2.4 Write property test for duplicate payment prevention
  - **Property 5: Duplicate payment prevention**
  - **Validates: Requirements 1.5**

- [ ]* 2.5 Write property test for remaining amount calculation
  - **Property 6: Remaining amount calculation**
  - **Validates: Requirements 2.1**

- [ ]* 2.6 Write property test for overpayment rejection
  - **Property 11: Overpayment rejection**
  - **Validates: Requirements 4.1**

- [x]* 2.7 Write property test for fully paid item rejection



  - **Property 12: Fully paid item rejection**
  - **Validates: Requirements 4.3**

- [x] 3. Update billingController payForItems function





  - Modify request body validation to accept items array with quantities
  - Update validation logic to check quantity for each item
  - Add error handling for invalid quantities
  - Add error handling for overpayment attempts
  - Update response to include paid quantities
  - _Requirements: 1.1, 1.2, 1.3, 4.1, 4.2, 4.3_

- [ ]* 3.1 Write unit tests for payForItems controller
  - Test successful payment with valid quantities
  - Test rejection of invalid quantities (zero, negative)
  - Test rejection of overpayment attempts
  - Test rejection of fully paid items
  - _Requirements: 4.1, 4.2, 4.3_

- [x] 4. Create migration script for existing data


  - Create script to migrate existing itemPayments data
  - Set `paidQuantity = quantity` for items where `isPaid === true`
  - Set `paidQuantity = 0` for items where `isPaid === false`
  - Initialize empty `paymentHistory` arrays
  - Test migration on sample data
  - _Requirements: 3.1_

- [ ]* 4.1 Write unit tests for migration script
  - Test migration of paid items
  - Test migration of unpaid items
  - Test data integrity after migration




- [x] 5. Update API service in frontend (api.ts)




  - Modify `payForItems` function to send items array with quantities
  - Update TypeScript interfaces for request/response
  - Add error handling for new error messages
  - _Requirements: 1.1, 1.2_

- [x] 6. Update BillView component





  - Add input fields for quantity selection per item
  - Display remaining quantity for each item
  - Add validation to prevent invalid quantity input
  - Update payment button to send quantities
  - Display paid quantity and remaining quantity
  - Update error message handling
  - _Requirements: 1.1, 1.2, 1.4, 4.1, 4.2_

- [ ]* 6.1 Write unit tests for BillView quantity input
  - Test quantity input validation
  - Test display of paid and remaining quantities
  - Test error message display

- [x] 7. Update bill aggregation utility





  - Modify `aggregateItemsWithPayments` to use `paidQuantity`
  - Update calculations to use remaining quantities
  - Ensure backward compatibility with old data structure
  - _Requirements: 1.4, 2.1_

- [ ]* 7.1 Write property test for total paid amount aggregation
  - **Property 7: Total paid amount aggregation**
  - **Validates: Requirements 2.2**

- [x] 8. Update bill status calculation logic





  - Modify pre-save hook to check all items' `paidQuantity`
  - Set status to "paid" when all items fully paid
  - Set status to "partial" when some items partially paid
  - _Requirements: 2.3, 2.4_

- [ ]* 8.1 Write property test for bill status - fully paid
  - **Property 8: Bill status - fully paid**
  - **Validates: Requirements 2.3**

- [ ]* 8.2 Write property test for bill status - partially paid
  - **Property 9: Bill status - partially paid**
  - **Validates: Requirements 2.4**

- [x] 9. Update Billing.tsx page





  - Update bill display to show quantity information
  - Update payment modal to support quantity input
  - Add validation messages for quantity errors
  - _Requirements: 1.4_

- [ ]* 9.1 Write property test for bill data display
  - **Property 4: Bill data display**
  - **Validates: Requirements 1.4**

- [x] 10. Run migration script on development database





  - Backup database before migration
  - Run migration script
  - Verify data integrity after migration
  - Test payment functionality with migrated data
  - _Requirements: 3.1_

- [x] 11. Integration testing










  - Test complete payment flow from frontend to backend
  - Test multiple partial payments on same item
  - Test payment of multiple items with different quantities
  - Test error scenarios (overpayment, invalid quantities)
  - Verify bill status updates correctly
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3, 2.4_

- [ ]* 11.1 Write integration tests for payment flow
  - Test end-to-end payment with partial quantities
  - Test bill status transitions
  - Test error handling

- [x] 12. Final checkpoint - Ensure all tests pass





  - Ensure all tests pass, ask the user if questions arise.
