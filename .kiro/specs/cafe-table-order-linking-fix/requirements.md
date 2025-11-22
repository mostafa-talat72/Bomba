# Requirements Document

## Introduction

This specification addresses critical issues in the Cafe management system related to table-order-bill linking. The system currently has problems where orders linked to tables appear in the "unlinked bills" section, and there are performance issues with order creation and updates. This feature will fix the table status management, ensure proper bill categorization, and improve the responsiveness of order operations.

## Glossary

- **Table**: A physical table in the cafe that can be assigned to customers
- **Order**: A collection of menu items requested by customers
- **Bill**: A financial document that contains orders and tracks payments
- **Table Status**: The current state of a table (empty/occupied/reserved)
- **Linked Bill**: A bill that is associated with a specific table
- **Unlinked Bill**: A bill that is not associated with any table (takeaway/delivery)
- **Table ID**: The MongoDB ObjectId that uniquely identifies a table
- **Table Number**: The display number shown to users (e.g., "1", "2", "3")

## Requirements

### Requirement 1

**User Story:** As a cafe staff member, I want orders linked to tables to appear in the correct table section, so that I can manage table orders separately from takeaway orders.

#### Acceptance Criteria

1. WHEN an order is created with a table ID THEN the system SHALL store the table reference as an ObjectId
2. WHEN displaying bills in the billing page THEN the system SHALL categorize bills with valid table references in the "table bills" section
3. WHEN displaying bills in the billing page THEN the system SHALL categorize bills without table references in the "unlinked bills" section
4. WHEN a bill has a table reference THEN the system SHALL display the table number alongside the bill information
5. WHEN the frontend receives bill data THEN the system SHALL correctly identify table-linked bills based on the table field presence

### Requirement 2

**User Story:** As a cafe staff member, I want table status to update immediately when orders are created or bills are paid, so that I can see accurate table availability in real-time.

#### Acceptance Criteria

1. WHEN an order is created for a table THEN the system SHALL change the table status to "occupied" immediately
2. WHEN a bill is fully paid THEN the system SHALL change the associated table status to "empty" immediately
3. WHEN a bill is deleted THEN the system SHALL change the associated table status to "empty" immediately
4. WHEN table status changes THEN the system SHALL emit a Socket.IO event to update all connected clients
5. WHEN the frontend receives a table status update event THEN the system SHALL update the table display color and status text immediately

### Requirement 3

**User Story:** As a cafe staff member, I want orders to appear in the orders page immediately after creation, so that the kitchen can start preparing them without delay.

#### Acceptance Criteria

1. WHEN an order is saved THEN the system SHALL persist it to the database within 500 milliseconds
2. WHEN an order is created THEN the system SHALL emit a Socket.IO event to notify all connected clients
3. WHEN the frontend receives an order creation event THEN the system SHALL add the order to the display within 100 milliseconds
4. WHEN an order is updated THEN the system SHALL propagate changes to all clients within 500 milliseconds
5. WHEN multiple orders are created simultaneously THEN the system SHALL handle them without blocking or delays

### Requirement 4

**User Story:** As a cafe staff member, I want the print dialog to appear immediately after saving an order, so that I can print kitchen tickets without waiting.

#### Acceptance Criteria

1. WHEN the save button is clicked THEN the system SHALL complete the save operation within 500 milliseconds
2. WHEN the save operation completes THEN the system SHALL trigger the print dialog within 100 milliseconds
3. WHEN printing is triggered THEN the system SHALL not block the UI from updating
4. WHEN an order is saved and printed THEN the system SHALL update the table status before showing the print dialog
5. WHEN network latency occurs THEN the system SHALL show a loading indicator but not block the print action

### Requirement 5

**User Story:** As a cafe staff member, I want deleted bills to properly clean up associated orders and table status, so that tables become available for new customers.

#### Acceptance Criteria

1. WHEN a bill is deleted THEN the system SHALL delete all associated orders from the database
2. WHEN a bill is deleted THEN the system SHALL set the associated table status to "empty"
3. WHEN a bill is deleted THEN the system SHALL emit Socket.IO events to update all clients
4. WHEN orders are deleted THEN the system SHALL restore inventory quantities for items that were deducted
5. WHEN a table becomes empty THEN the system SHALL update the table color to indicate availability

### Requirement 6

**User Story:** As a system administrator, I want all table references to use ObjectId consistently, so that the system maintains data integrity across frontend and backend.

#### Acceptance Criteria

1. WHEN the frontend sends a table reference THEN the system SHALL use the table ObjectId not the table number
2. WHEN the backend receives a table reference THEN the system SHALL validate it as a valid ObjectId
3. WHEN querying bills by table THEN the system SHALL use ObjectId comparison not string comparison
4. WHEN populating table data THEN the system SHALL use Mongoose populate to retrieve full table documents
5. WHEN displaying table information THEN the system SHALL extract the table number from the populated table object
