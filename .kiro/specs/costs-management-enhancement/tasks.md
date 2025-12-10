
# Implementation Plan

- [x] 1. Backend: Enhance Cost Category Model and API





  - Update CostCategory model with icon, color, and sortOrder fields
  - Add unique index for organization + name combination
  - Implement category CRUD endpoints with validation
  - Add category deletion protection logic
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [ ]* 1.1 Write property test for category field persistence
  - **Property 1: Category field persistence**
  - **Validates: Requirements 1.1**

- [ ]* 1.2 Write property test for category list ordering
  - **Property 2: Category list ordering**
  - **Validates: Requirements 1.2**

- [ ]* 1.3 Write property test for category name uniqueness
  - **Property 3: Category name uniqueness**
  - **Validates: Requirements 1.3**

- [ ]* 1.4 Write property test for category deletion protection
  - **Property 4: Category deletion protection**
  - **Validates: Requirements 1.4**

- [x] 2. Backend: Enhance Cost Model with Automatic Status Calculation





  - Update Cost model pre-save hook for status automation
  - Implement remainingAmount calculation logic
  - Add payment addition method with status updates
  - Ensure paidAmount never exceeds amount
  - _Requirements: 2.2, 2.3, 2.4, 2.5, 7.1, 7.2, 7.3, 7.4, 7.5_

- [ ]* 2.1 Write property test for required fields validation
  - **Property 5: Cost required fields validation**
  - **Validates: Requirements 2.1**

- [ ]* 2.2 Write property test for remaining amount calculation
  - **Property 6: Remaining amount calculation**
  - **Validates: Requirements 2.2**

- [ ]* 2.3 Write property test for payment-based status calculation
  - **Property 7: Payment-based status calculation**
  - **Validates: Requirements 2.3, 7.1, 7.2, 7.4**

- [ ]* 2.4 Write property test for date-based status calculation
  - **Property 8: Date-based status calculation**
  - **Validates: Requirements 2.4, 7.3**

- [ ]* 2.5 Write property test for payment addition
  - **Property 9: Payment addition maintains invariants**
  - **Validates: Requirements 2.5, 7.5**

- [x] 3. Backend: Update Cost Controller API





  - Enhance getCosts endpoint with category and status filtering
  - Add search functionality for description and vendor
  - Update createCost and updateCost endpoints
  - Implement addPayment endpoint
  - Add proper error handling and validation
  - _Requirements: 2.1, 6.1, 6.2, 6.3, 6.4_

- [ ]* 3.1 Write property test for category filter correctness
  - **Property 14: Category filter correctness**
  - **Validates: Requirements 6.1**

- [ ]* 3.2 Write property test for status filter correctness
  - **Property 15: Status filter correctness**
  - **Validates: Requirements 6.2**

- [ ]* 3.3 Write property test for multiple filter combination
  - **Property 16: Multiple filter combination**
  - **Validates: Requirements 6.3**

- [ ]* 3.4 Write property test for filter reset completeness
  - **Property 17: Filter reset completeness**
  - **Validates: Requirements 6.4**

- [x] 4. Backend: Verify Dual Database Sync





  - Ensure sync middleware is applied to Cost and CostCategory models
  - Test category creation sync to both databases
  - Test cost creation and update sync
  - Test deletion sync for both models
  - Verify sync queue handling and retry logic
  - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [ ]* 4.1 Write property test for category creation sync
  - **Property 10: Category creation sync consistency**
  - **Validates: Requirements 4.1**

- [ ]* 4.2 Write property test for cost operation sync
  - **Property 11: Cost operation sync consistency**
  - **Validates: Requirements 4.2**

- [ ]* 4.3 Write property test for category deletion sync
  - **Property 12: Category deletion sync consistency**
  - **Validates: Requirements 4.3**

- [ ]* 4.4 Write property test for cost deletion sync
  - **Property 13: Cost deletion sync consistency**
  - **Validates: Requirements 4.4**

- [x] 5. Checkpoint - Backend Tests





  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Frontend: Create Icon Picker Component





  - Create IconPickerModal component with Lucide icons
  - Implement icon search functionality
  - Add icon grid display with preview
  - Include commonly used cost category icons
  - _Requirements: 1.5, 8.1, 8.2, 8.3, 8.4_

- [ ]* 6.1 Write property test for default icon assignment
  - **Property 18: Default icon assignment**
  - **Validates: Requirements 8.5**

- [x] 7. Frontend: Create Category Manager Modal





  - Create CategoryManagerModal component
  - Add form fields for name, icon, color, description, sortOrder
  - Integrate IconPickerModal for icon selection
  - Add color picker input
  - Implement create and update functionality
  - Add validation and error handling
  - _Requirements: 1.1, 1.3, 3.2, 8.5_

- [x] 8. Frontend: Update Costs Page with Category Management





  - Add "إدارة الأقسام" button to open CategoryManagerModal
  - Display categories with icons and colors in filter section
  - Implement category selection with color highlighting
  - Add category CRUD operations
  - Show category deletion error when it has costs
  - _Requirements: 1.2, 1.4, 3.3, 3.4_

- [x] 9. Frontend: Enhance Cost Form Modal





  - Update CostFormModal with all required fields
  - Add category dropdown with icon and color display
  - Implement payment status selection
  - Add paidAmount field with validation
  - Show calculated remainingAmount
  - Add date and dueDate pickers
  - _Requirements: 2.1, 2.2, 2.3_

- [x] 10. Frontend: Implement Real-time Filtering





  - Add category filter buttons with colors
  - Add status filter dropdown
  - Implement search input with debouncing (300ms)
  - Combine filters with AND logic
  - Add "clear all filters" functionality
  - Update costs list in real-time
  - _Requirements: 5.3, 6.1, 6.2, 6.3, 6.4_

- [x] 11. Frontend: Enhance Costs Table Display





  - Display category icon and color for each cost
  - Show status badges with appropriate colors
  - Display paidAmount and remainingAmount
  - Add payment addition button for partial payments
  - Implement edit and delete actions
  - _Requirements: 3.1, 5.4_

- [x] 12. Frontend: Add Statistics Cards




  - Create summary cards for total, paid, pending, overdue
  - Calculate statistics from filtered costs
  - Use category colors for visual representation
  - Update statistics in real-time with filters
  - _Requirements: 3.4, 5.1_

- [x] 13. Frontend: Implement Payment Addition Modal





  - Create modal for adding payments to costs
  - Show current paidAmount and remainingAmount
  - Add payment amount input with validation
  - Prevent payment exceeding remainingAmount
  - Update cost status automatically after payment
  - _Requirements: 2.5, 7.5_

- [x] 14. Frontend: Add Loading and Error States





  - Implement skeleton loaders for initial load
  - Add loading spinners for actions
  - Show error toasts for failed operations
  - Add success toasts for successful operations
  - Implement retry functionality for failed requests
  - _Requirements: 5.5_

- [x] 15. Styling: Create Cost Management Animations





  - Add smooth transitions for filter changes
  - Implement fade-in animations for modals
  - Add hover effects for category buttons
  - Create loading animations
  - Add status badge animations
  - _Requirements: 5.2, 5.5_

- [x] 16. Checkpoint - Frontend Tests





  - Ensure all tests pass, ask the user if questions arise.

- [x] 17. Integration Testing






  - Test complete cost creation flow with category
  - Test payment addition and status updates
  - Test category management with costs
  - Test filtering combinations
  - Test sync between databases
  - Verify error handling scenarios

- [x] 18. Final Checkpoint - All Tests





  - Ensure all tests pass, ask the user if questions arise.
