# Requirements Document - Bidirectional Sync

## Introduction

هذه الميزة تضيف المزامنة الثنائية الاتجاه بين Local MongoDB و MongoDB Atlas، بحيث أي تغيير يحدث على أي من القاعدتين يظهر تلقائياً على الأخرى. هذا يسمح بالعمل من أجهزة متعددة مع الحفاظ على تزامن البيانات.

## Glossary

- **Bidirectional Sync**: المزامنة الثنائية الاتجاه بين قاعدتي البيانات
- **Change Stream**: ميزة MongoDB لمراقبة التغييرات في الوقت الفعلي
- **Conflict Resolution**: آلية حل التعارضات عند حدوث تغييرات متزامنة
- **Origin Tracking**: تتبع مصدر التغيير لتجنب الحلقات اللانهائية
- **Last Write Wins (LWW)**: استراتيجية حل التعارضات حيث آخر تعديل يفوز
- **Sync Loop**: حلقة مزامنة لانهائية تحدث عند عدم تتبع المصدر
- **Atlas Change Listener**: مستمع يراقب التغييرات على Atlas
- **Local Change Listener**: مستمع يراقب التغييرات على Local (موجود حالياً)

## Requirements

### Requirement 1

**User Story:** كمستخدم، أريد أن أرى التغييرات التي تحدث على Atlas من أجهزة أخرى تظهر تلقائياً على جهازي المحلي، حتى أتمكن من العمل بشكل متزامن مع فريقي.

#### Acceptance Criteria

1. WHEN a document is created on Atlas THEN the Bomba System SHALL replicate it to Local MongoDB and execute model business logic
2. WHEN a document is updated on Atlas THEN the Bomba System SHALL replicate the update to Local MongoDB and execute model business logic
3. WHEN a document is deleted on Atlas THEN the Bomba System SHALL replicate the deletion to Local MongoDB
4. WHEN Atlas changes are detected THEN the Bomba System SHALL apply them within 5 seconds
5. THE Bomba System SHALL continue monitoring Atlas changes continuously while running
6. WHEN applying Atlas changes THEN the Bomba System SHALL execute Mongoose pre-save hooks and model validation to maintain data consistency

### Requirement 2

**User Story:** كمطور، أريد تجنب الحلقات اللانهائية من المزامنة، حتى لا تتسبب التغييرات في تحديثات متكررة لا نهائية.

#### Acceptance Criteria

1. WHEN a change originates from Local THEN the Bomba System SHALL mark it to prevent re-syncing from Atlas
2. WHEN a change originates from Atlas THEN the Bomba System SHALL mark it to prevent re-syncing to Atlas
3. WHEN applying a synced change THEN the Bomba System SHALL bypass the sync middleware
4. THE Bomba System SHALL track change origin using metadata fields
5. WHEN a sync loop is detected THEN the Bomba System SHALL log a warning and break the loop

### Requirement 3

**User Story:** كمستخدم، أريد حل تلقائي للتعارضات عند حدوث تغييرات متزامنة، حتى لا أفقد البيانات أو أواجه أخطاء.

#### Acceptance Criteria

1. WHEN the same document is modified on both databases simultaneously THEN the Bomba System SHALL apply Last Write Wins strategy
2. WHEN a conflict is detected THEN the Bomba System SHALL log the conflict details
3. WHEN applying conflict resolution THEN the Bomba System SHALL preserve the document with the latest timestamp
4. THE Bomba System SHALL track document versions using timestamps
5. WHEN a conflict occurs THEN the Bomba System SHALL record it in conflict metrics

### Requirement 4

**User Story:** كمسؤول نظام، أريد مراقبة حالة المزامنة الثنائية، حتى أتأكد من أن البيانات متزامنة بشكل صحيح.

#### Acceptance Criteria

1. WHEN sync operations occur THEN the Bomba System SHALL track metrics for both directions (Local→Atlas and Atlas→Local)
2. THE Bomba System SHALL expose metrics showing sync lag for both directions
3. WHEN Atlas Change Stream disconnects THEN the Bomba System SHALL log the disconnection and attempt reconnection
4. THE Bomba System SHALL provide health check endpoint showing bidirectional sync status
5. WHEN sync lag exceeds threshold THEN the Bomba System SHALL emit warnings for the affected direction

### Requirement 5

**User Story:** كمطور، أريد أن تكون المزامنة الثنائية اختيارية، حتى أتمكن من تعطيلها إذا لزم الأمر.

#### Acceptance Criteria

1. THE Bomba System SHALL support configuration to enable/disable bidirectional sync
2. WHEN bidirectional sync is disabled THEN the Bomba System SHALL continue one-way sync (Local→Atlas)
3. WHEN bidirectional sync is enabled THEN the Bomba System SHALL start Atlas Change Stream listener
4. THE Bomba System SHALL validate configuration on startup
5. WHEN configuration is invalid THEN the Bomba System SHALL log errors and use safe defaults

### Requirement 6

**User Story:** كمستخدم، أريد أن تكون المزامنة من Atlas سريعة وفعالة، حتى لا تؤثر على أداء التطبيق.

#### Acceptance Criteria

1. WHEN Atlas changes are received THEN the Bomba System SHALL process them asynchronously
2. THE Bomba System SHALL batch multiple Atlas changes for efficient processing
3. WHEN processing Atlas changes THEN the Bomba System SHALL not block Local operations
4. THE Bomba System SHALL use connection pooling for Atlas Change Stream
5. WHEN Atlas Change Stream has high volume THEN the Bomba System SHALL handle backpressure gracefully

### Requirement 7

**User Story:** كمسؤول نظام، أريد التعامل مع انقطاع الاتصال بـ Atlas بشكل صحيح، حتى لا تفقد التغييرات.

#### Acceptance Criteria

1. WHEN Atlas Change Stream disconnects THEN the Bomba System SHALL attempt automatic reconnection
2. WHEN reconnecting to Atlas Change Stream THEN the Bomba System SHALL resume from last processed change
3. THE Bomba System SHALL use resume tokens to track Change Stream position
4. WHEN resume token is invalid THEN the Bomba System SHALL perform full sync to catch up
5. THE Bomba System SHALL persist resume tokens to survive application restarts

### Requirement 8

**User Story:** كمطور، أريد استبعاد بعض الـ collections من المزامنة الثنائية، حتى أتحكم في ما يتم مزامنته.

#### Acceptance Criteria

1. THE Bomba System SHALL support configuration for excluded collections in bidirectional sync
2. WHEN a collection is excluded THEN the Bomba System SHALL not sync changes from Atlas for that collection
3. WHEN a collection is excluded THEN the Bomba System SHALL continue one-way sync (Local→Atlas) for that collection
4. THE Bomba System SHALL validate excluded collections list on startup
5. WHEN configuration changes THEN the Bomba System SHALL apply new exclusions without restart

### Requirement 9

**User Story:** كمستخدم، أريد أن تكون المزامنة الثنائية آمنة من حيث البيانات، حتى لا تحدث أخطاء أو فقدان بيانات.

#### Acceptance Criteria

1. WHEN applying Atlas changes THEN the Bomba System SHALL use transactions where supported
2. WHEN a sync operation fails THEN the Bomba System SHALL retry with exponential backoff
3. WHEN max retries are reached THEN the Bomba System SHALL log the failure and continue with other changes
4. THE Bomba System SHALL validate data integrity before applying changes
5. WHEN data validation fails THEN the Bomba System SHALL reject the change and log the error

### Requirement 10

**User Story:** كمطور، أريد تتبع مصدر كل تغيير، حتى أتمكن من تصحيح المشاكل وفهم تدفق البيانات.

#### Acceptance Criteria

1. WHEN a change originates from Local THEN the Bomba System SHALL add metadata indicating Local origin
2. WHEN a change originates from Atlas THEN the Bomba System SHALL add metadata indicating Atlas origin
3. THE Bomba System SHALL include device/instance identifier in change metadata
4. WHEN querying documents THEN the Bomba System SHALL expose sync metadata for debugging
5. THE Bomba System SHALL clean up old sync metadata periodically to avoid bloat
