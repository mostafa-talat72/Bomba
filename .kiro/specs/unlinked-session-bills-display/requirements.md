# Requirements Document

## Introduction

هذا المستند يحدد متطلبات إصلاح عرض فواتير جلسات البلايستيشن والكمبيوتر غير المرتبطة بطاولة في صفحة الفواتير. حالياً، الفواتير التي تحتوي على جلسات (PlayStation/Computer) ولكنها غير مرتبطة بطاولة لا تظهر بشكل صحيح في قسم أجهزة البلايستيشن.

## Glossary

- **Session**: جلسة استخدام جهاز (بلايستيشن أو كمبيوتر) مع تتبع الوقت والتكلفة
- **Bill**: فاتورة تحتوي على طلبات كافيه و/أو جلسات أجهزة
- **Table**: طاولة في المقهى يمكن ربط الفواتير بها
- **Unlinked Bill**: فاتورة غير مرتبطة بطاولة
- **Device Type**: نوع الجهاز (playstation أو computer)
- **Billing Page**: صفحة الفواتير التي تعرض جميع الفواتير النشطة والمدفوعة
- **PlayStation Section**: قسم في صفحة الفواتير مخصص لعرض فواتير أجهزة البلايستيشن

## Requirements

### Requirement 1

**User Story:** كمستخدم للنظام، أريد أن أرى جميع فواتير جلسات البلايستيشن غير المرتبطة بطاولة في قسم أجهزة البلايستيشن، حتى أتمكن من إدارة ومتابعة هذه الفواتير بسهولة.

#### Acceptance Criteria

1. WHEN a PlayStation session bill is not linked to a table THEN the system SHALL display it in the PlayStation devices section
2. WHEN displaying unlinked session bills THEN the system SHALL show the customer name if available
3. WHEN displaying unlinked session bills THEN the system SHALL show a clear indicator that the bill is not linked to a table
4. WHEN filtering by status (paid/unpaid/all) THEN the system SHALL apply the filter to unlinked session bills
5. WHEN searching for devices THEN the system SHALL include unlinked session bills in the search results

### Requirement 2

**User Story:** كمستخدم للنظام، أريد أن أرى فواتير جلسات الكمبيوتر غير المرتبطة بطاولة في قسم مخصص، حتى أتمكن من إدارتها بشكل منفصل عن البلايستيشن.

#### Acceptance Criteria

1. WHEN a computer session bill is not linked to a table THEN the system SHALL display it in a dedicated computer devices section
2. WHEN displaying computer session bills THEN the system SHALL use appropriate icons and styling to distinguish them from PlayStation bills
3. WHEN filtering computer bills by status THEN the system SHALL apply the same filtering logic as PlayStation bills
4. WHEN a bill contains both PlayStation and computer sessions THEN the system SHALL display it in both sections appropriately

### Requirement 3

**User Story:** كمستخدم للنظام، أريد أن تكون الفواتير مجمعة حسب الجهاز بشكل صحيح، حتى أتمكن من رؤية جميع الفواتير المتعلقة بكل جهاز في مكان واحد.

#### Acceptance Criteria

1. WHEN multiple bills exist for the same device THEN the system SHALL group them under the device name
2. WHEN a device has both linked and unlinked bills THEN the system SHALL show only unlinked bills in the PlayStation section
3. WHEN a device has an active session THEN the system SHALL display an "active session" indicator
4. WHEN a device is linked to a table THEN the system SHALL display the table number indicator
5. WHEN grouping bills by device THEN the system SHALL use the device name from the session data

### Requirement 4

**User Story:** كمدير للنظام، أريد أن يتم عرض الفواتير بشكل متسق ومنظم، حتى يسهل على الموظفين إيجاد ومعالجة الفواتير المطلوبة.

#### Acceptance Criteria

1. WHEN displaying bills in the PlayStation section THEN the system SHALL maintain consistent styling with other bill displays
2. WHEN a bill has no sessions THEN the system SHALL display it in a separate "bills without sessions" group
3. WHEN collapsing/expanding device groups THEN the system SHALL preserve the state during page updates
4. WHEN displaying bill status THEN the system SHALL use clear visual indicators (colors, icons, text)
5. WHEN displaying bill amounts THEN the system SHALL show total, paid, and remaining amounts clearly
