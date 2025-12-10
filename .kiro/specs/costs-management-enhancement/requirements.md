# Requirements Document

## Introduction

تحسين نظام إدارة التكاليف في تطبيق Bomba ليصبح أكثر مرونة ووضوحاً وسهولة في الاستخدام. يشمل التحسين إضافة إمكانية إدارة أقسام التكاليف بشكل ديناميكي مع أيقونات مخصصة، تحسين واجهة المستخدم، ودعم حالات الدفع المختلفة (مدفوع بالكامل، جزئياً، متأخر، معلق).

## Glossary

- **Cost System**: نظام إدارة التكاليف - النظام المسؤول عن تتبع وإدارة جميع مصروفات المشروع
- **Cost Category**: قسم التكلفة - تصنيف للتكاليف (مثل: رواتب، إيجار، صيانة، مشتريات)
- **Cost Entry**: مدخل التكلفة - سجل مصروف واحد في النظام
- **Payment Status**: حالة الدفع - الحالة الحالية للمصروف (مدفوع، معلق، متأخر، إلخ)
- **Local MongoDB**: قاعدة البيانات المحلية على الجهاز
- **Atlas MongoDB**: قاعدة البيانات السحابية على MongoDB Atlas
- **Dual Database Sync**: المزامنة الثنائية - نظام المزامنة بين القاعدتين المحلية والسحابية

## Requirements

### Requirement 1: Dynamic Cost Category Management

**User Story:** كمدير للنظام، أريد إنشاء وإدارة أقسام التكاليف بشكل ديناميكي، حتى أتمكن من تصنيف المصروفات حسب احتياجات مشروعي الخاصة.

#### Acceptance Criteria

1. WHEN a user creates a new cost category THEN the system SHALL store the category with name, icon, color, and description
2. WHEN a user views the cost categories list THEN the system SHALL display all categories sorted by sortOrder and name
3. WHEN a user updates a category THEN the system SHALL validate that the new name does not conflict with existing categories
4. WHEN a user attempts to delete a category that has associated costs THEN the system SHALL prevent deletion and display the count of associated costs
5. WHEN a user selects an icon for a category THEN the system SHALL provide a selection from Lucide React icon library

### Requirement 2: Enhanced Cost Entry Management

**User Story:** كموظف مالي، أريد إضافة وتعديل المصروفات مع تحديد حالة الدفع بدقة، حتى أتمكن من تتبع المدفوعات الكاملة والجزئية والمتأخرة.

#### Acceptance Criteria

1. WHEN a user creates a cost entry THEN the system SHALL require category, description, amount, and date fields
2. WHEN a user sets payment status to "partially_paid" THEN the system SHALL calculate and display remainingAmount as amount minus paidAmount
3. WHEN a user sets payment status to "paid" THEN the system SHALL set paidAmount equal to amount and remainingAmount to zero
4. WHEN a cost entry has a dueDate in the past and status is "pending" THEN the system SHALL automatically update status to "overdue"
5. WHEN a user adds a payment to a cost entry THEN the system SHALL update paidAmount, remainingAmount, and status accordingly

### Requirement 3: Visual Category Representation

**User Story:** كمستخدم للنظام، أريد رؤية أيقونات ملونة مميزة لكل قسم تكلفة، حتى أتمكن من التعرف على الأقسام بسرعة وسهولة.

#### Acceptance Criteria

1. WHEN a user views a cost entry THEN the system SHALL display the category icon with the category color
2. WHEN a user creates or edits a category THEN the system SHALL provide a color picker for selecting custom colors
3. WHEN a user filters costs by category THEN the system SHALL highlight the selected category button with its assigned color
4. WHEN the system displays category statistics THEN the system SHALL use the category color for visual representation
5. WHEN a category is inactive THEN the system SHALL display it with reduced opacity in the interface

### Requirement 4: Dual Database Synchronization

**User Story:** كمدير تقني، أريد أن تتزامن جميع عمليات التكاليف والأقسام بين القاعدة المحلية والسحابية، حتى تكون البيانات متسقة ومتاحة دائماً.

#### Acceptance Criteria

1. WHEN a cost category is created THEN the system SHALL sync the category to both Local MongoDB and Atlas MongoDB
2. WHEN a cost entry is created or updated THEN the system SHALL sync the changes to both databases
3. WHEN a cost category is deleted THEN the system SHALL remove it from both Local MongoDB and Atlas MongoDB
4. WHEN a cost entry is deleted THEN the system SHALL remove it from both databases
5. WHEN sync fails for one database THEN the system SHALL log the error and retry the operation

### Requirement 5: Enhanced User Interface

**User Story:** كمستخدم للنظام، أريد واجهة مستخدم واضحة وسريعة الاستجابة، حتى أتمكن من إدارة التكاليف بكفاءة.

#### Acceptance Criteria

1. WHEN a user opens the costs page THEN the system SHALL display summary statistics within 500 milliseconds
2. WHEN a user filters costs by category or status THEN the system SHALL update the display within 200 milliseconds
3. WHEN a user searches for costs THEN the system SHALL filter results in real-time as the user types
4. WHEN the system displays cost entries THEN the system SHALL use color-coded status badges for quick identification
5. WHEN a user performs any action THEN the system SHALL provide immediate visual feedback

### Requirement 6: Category-Based Cost Filtering

**User Story:** كمستخدم مالي، أريد تصفية التكاليف حسب القسم والحالة، حتى أتمكن من تحليل المصروفات بشكل منظم.

#### Acceptance Criteria

1. WHEN a user selects a category filter THEN the system SHALL display only costs belonging to that category
2. WHEN a user selects a status filter THEN the system SHALL display only costs with that status
3. WHEN a user applies multiple filters THEN the system SHALL combine filters using AND logic
4. WHEN a user clears all filters THEN the system SHALL display all costs
5. WHEN filtered results are empty THEN the system SHALL display a helpful message

### Requirement 7: Payment Status Automation

**User Story:** كمدير مالي، أريد أن يحدث النظام حالات الدفع تلقائياً، حتى أتمكن من رؤية الحالة الصحيحة دون تدخل يدوي.

#### Acceptance Criteria

1. WHEN paidAmount equals amount THEN the system SHALL automatically set status to "paid"
2. WHEN paidAmount is greater than zero and less than amount THEN the system SHALL automatically set status to "partially_paid"
3. WHEN paidAmount is zero and dueDate is in the past THEN the system SHALL automatically set status to "overdue"
4. WHEN paidAmount is zero and dueDate is in the future or null THEN the system SHALL set status to "pending"
5. WHEN a payment is added that completes the cost THEN the system SHALL update status to "paid"

### Requirement 8: Icon Selection Interface

**User Story:** كمدير للنظام، أريد اختيار أيقونة مناسبة لكل قسم من مجموعة واسعة من الأيقونات، حتى أتمكن من تمييز الأقسام بصرياً.

#### Acceptance Criteria

1. WHEN a user creates or edits a category THEN the system SHALL display an icon picker modal
2. WHEN the icon picker is displayed THEN the system SHALL show commonly used icons for cost categories
3. WHEN a user searches for an icon THEN the system SHALL filter the icon list in real-time
4. WHEN a user selects an icon THEN the system SHALL update the category preview immediately
5. WHEN no icon is selected THEN the system SHALL use "DollarSign" as the default icon
