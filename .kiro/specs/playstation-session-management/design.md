# تصميم نظام إدارة جلسات البلايستيشن المحسّن

## نظرة عامة

هذا المستند يحدد التصميم التفصيلي لتحسين نظام إدارة جلسات البلايستيشن، مع التركيز على تعديل الجلسات النشطة، ربط الجلسات بالطاولات، وإدارة الفواتير بشكل احترافي. التصميم يعتمد على البنية الحالية للنظام ويضيف تحسينات لتلبية المتطلبات الجديدة.

## البنية المعمارية

### المكونات الرئيسية

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React + TypeScript)             │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ PlayStation  │  │   Billing    │  │   Tables     │      │
│  │    Page      │  │    Page      │  │    Page      │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│         │                  │                  │              │
│         └──────────────────┴──────────────────┘              │
│                           │                                  │
│                  ┌────────▼────────┐                        │
│                  │   AppContext    │                        │
│                  │  (State Mgmt)   │                        │
│                  └────────┬────────┘                        │
│                           │                                  │
│                  ┌────────▼────────┐                        │
│                  │   API Service   │                        │
│                  └────────┬────────┘                        │
└───────────────────────────┼─────────────────────────────────┘
                            │
                   ┌────────▼────────┐
                   │   REST API      │
                   │  (Express.js)   │
                   └────────┬────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
┌───────▼────────┐  ┌──────▼──────┐  ┌────────▼────────┐
│    Session     │  │    Bill     │  │     Device      │
│  Controller    │  │ Controller  │  │   Controller    │
└───────┬────────┘  └──────┬──────┘  └────────┬────────┘
        │                   │                   │
┌───────▼────────┐  ┌──────▼──────┐  ┌────────▼────────┐
│    Session     │  │    Bill     │  │     Device      │
│     Model      │  │    Model    │  │     Model       │
└───────┬────────┘  └──────┬──────┘  └────────┬────────┘
        │                   │                   │
        └───────────────────┴───────────────────┘
                            │
                   ┌────────▼────────┐
                   │    MongoDB      │
                   └─────────────────┘
```

## نماذج البيانات

### 1. Session Model (تحديثات)

```javascript
{
  _id: ObjectId,
  deviceNumber: String,
  deviceName: String,
  deviceId: ObjectId (ref: Device),
  deviceType: String (enum: ['playstation', 'computer']),
  customerName: String, // اسم العميل (اختياري حتى إنهاء الجلسة)
  startTime: Date,
  endTime: Date,
  status: String (enum: ['active', 'completed', 'cancelled']),
  controllers: Number (1-4), // عدد الأذرع الحالي
  controllersHistory: [
    {
      controllers: Number,
      from: Date,
      to: Date
    }
  ], // سجل تغييرات عدد الأذرع
  totalCost: Number,
  discount: Number,
  finalCost: Number,
  notes: String,
  organization: ObjectId (ref: Organization),
  createdBy: ObjectId (ref: User),
  updatedBy: ObjectId (ref: User),
  bill: ObjectId (ref: Bill), // الفاتورة المرتبطة
  createdAt: Date,
  updatedAt: Date
}
```

**التحسينات:**
- `controllersHistory`: يحفظ سجل كامل لتغييرات عدد الأذرع مع الأوقات
- `customerName`: يمكن أن يكون فارغاً أثناء الجلسة، ويُطلب عند الإنهاء إذا لم تكن مرتبطة بطاولة
- `bill`: مرجع للفاتورة المرتبطة بالجلسة

### 2. Bill Model (تحديثات)

```javascript
{
  _id: ObjectId,
  billNumber: String,
  customerName: String,
  customerPhone: String,
  tableNumber: Number, // رقم الطاولة (اختياري)
  orders: [ObjectId (ref: Order)],
  sessions: [ObjectId (ref: Session)], // الجلسات المرتبطة
  subtotal: Number,
  discount: Number,
  discountPercentage: Number,
  tax: Number,
  total: Number,
  paid: Number,
  remaining: Number,
  status: String (enum: ['draft', 'partial', 'paid', 'cancelled', 'overdue']),
  paymentMethod: String (enum: ['cash', 'card', 'transfer', 'mixed']),
  payments: [Payment],
  partialPayments: [PartialPayment],
  qrCode: String,
  qrCodeUrl: String,
  notes: String,
  billType: String (enum: ['cafe', 'playstation', 'computer']), // نوع الفاتورة
  dueDate: Date,
  createdBy: ObjectId (ref: User),
  updatedBy: ObjectId (ref: User),
  organization: ObjectId (ref: Organization),
  createdAt: Date,
  updatedAt: Date
}
```

**التحسينات:**
- `billType`: يحدد نوع الفاتورة (كافيه، بلايستيشن، كمبيوتر)
- `tableNumber`: اختياري، يمكن أن يكون null للفواتير غير المرتبطة بطاولات
- `sessions`: مصفوفة من الجلسات المرتبطة بالفاتورة

### 3. Device Model (موجود حالياً)

```javascript
{
  _id: ObjectId,
  name: String,
  number: Number,
  type: String (enum: ['playstation', 'computer']),
  status: String (enum: ['available', 'active', 'maintenance', 'unavailable']),
  controllers: Number, // الحد الأقصى لعدد الأذرع
  playstationRates: Map<String, Number>, // أسعار الساعة لكل عدد أذرع
  hourlyRate: Number, // سعر الساعة للكمبيوتر
  organization: ObjectId (ref: Organization),
  createdAt: Date,
  updatedAt: Date
}
```

## المكونات والواجهات

### 1. صفحة البلايستيشن (PlayStation.tsx)

#### الحالة (State)

```typescript
interface PlayStationPageState {
  // الأجهزة
  devices: Device[];
  
  // الجلسات
  sessions: Session[];
  
  // واجهة بدء جلسة جديدة
  showNewSession: boolean;
  selectedDevice: Device | null;
  selectedControllers: number | null;
  selectedTableNumber: number | null;
  loadingSession: boolean;
  sessionError: string | null;
  
  // واجهة ربط جلسة بطاولة
  showLinkTableModal: boolean;
  selectedSessionForLink: Session | null;
  linkingTable: boolean;
  
  // واجهة تعديل عدد الأذرع
  updatingControllers: Record<string, boolean>;
  
  // واجهة إنهاء الجلسة
  endingSessions: Record<string, boolean>;
  showEndSessionModal: boolean;
  selectedSessionForEnd: Session | null;
  customerNameForEnd: string;
  
  // حالة التحميل
  isInitialLoading: boolean;
  loadingError: string | null;
}
```

#### الوظائف الرئيسية

```typescript
// بدء جلسة جديدة
async function handleStartSession(): Promise<void>

// إنهاء جلسة
async function handleEndSession(sessionId: string): Promise<void>

// تعديل عدد الأذرع
async function handleUpdateControllers(
  sessionId: string, 
  newControllers: number
): Promise<void>

// ربط جلسة بطاولة
async function handleLinkTableToSession(
  session: Session, 
  tableNumber: number | null
): Promise<void>

// فك ربط جلسة من طاولة
async function handleUnlinkTableFromSession(
  session: Session
): Promise<void>

// طلب اسم العميل عند إنهاء جلسة غير مرتبطة بطاولة
async function handleEndSessionWithCustomerName(
  sessionId: string, 
  customerName: string
): Promise<void>

// تحديث التكلفة الحالية للجلسة
async function updateSessionCost(sessionId: string): Promise<void>
```

### 2. صفحة الفواتير (Billing Page)

#### التحسينات المطلوبة

```typescript
interface BillingPageEnhancements {
  // عرض فواتير البلايستيشن في قسم منفصل
  playstationBills: Bill[];
  
  // عرض الأجهزة النشطة
  activeDevices: {
    device: Device;
    session: Session;
    bill: Bill;
  }[];
  
  // فلترة الفواتير حسب النوع
  filterByType: 'all' | 'cafe' | 'playstation' | 'computer';
}
```

#### الوظائف الجديدة

```typescript
// جلب فواتير البلايستيشن
async function fetchPlaystationBills(): Promise<Bill[]>

// جلب الأجهزة النشطة مع جلساتها وفواتيرها
async function fetchActiveDevicesWithSessions(): Promise<ActiveDevice[]>

// فلترة الفواتير حسب النوع
function filterBillsByType(type: BillType): Bill[]
```

### 3. مكون عرض الجلسة النشطة

```typescript
interface ActiveSessionCardProps {
  session: Session;
  device: Device;
  onUpdateControllers: (sessionId: string, controllers: number) => Promise<void>;
  onEndSession: (sessionId: string) => Promise<void>;
  onLinkTable: (session: Session) => void;
  onUnlinkTable: (session: Session) => void;
}

function ActiveSessionCard(props: ActiveSessionCardProps): JSX.Element
```

**المميزات:**
- عرض معلومات الجلسة (الوقت، عدد الأذرع، التكلفة الحالية)
- أزرار لتعديل عدد الأذرع (+/-)
- زر لربط الجلسة بطاولة (إذا لم تكن مرتبطة)
- زر لفك ربط الجلسة من الطاولة (إذا كانت مرتبطة)
- زر لإنهاء الجلسة
- عرض حالة ربط الطاولة (رقم الطاولة أو "بدون طاولة")

### 4. مكون نافذة إنهاء الجلسة

```typescript
interface EndSessionModalProps {
  session: Session;
  isLinkedToTable: boolean;
  onConfirm: (customerName?: string) => Promise<void>;
  onCancel: () => void;
}

function EndSessionModal(props: EndSessionModalProps): JSX.Element
```

**السلوك:**
- إذا كانت الجلسة مرتبطة بطاولة: تأكيد بسيط
- إذا لم تكن مرتبطة بطاولة: طلب اسم العميل قبل الإنهاء

## معالجة الأخطاء

### 1. أخطاء بدء الجلسة

```typescript
enum SessionStartError {
  DEVICE_IN_USE = 'الجهاز مستخدم حالياً',
  DEVICE_NOT_FOUND = 'الجهاز غير موجود',
  INVALID_CONTROLLERS = 'عدد الأذرع غير صحيح',
  BILL_CREATION_FAILED = 'فشل إنشاء الفاتورة',
  NETWORK_ERROR = 'خطأ في الاتصال بالخادم'
}
```

**الاستراتيجية:**
- عرض رسالة خطأ واضحة للمستخدم
- السماح بإعادة المحاولة
- تسجيل الخطأ في السجلات

### 2. أخطاء تعديل عدد الأذرع

```typescript
enum ControllersUpdateError {
  SESSION_NOT_ACTIVE = 'الجلسة غير نشطة',
  INVALID_COUNT = 'عدد الأذرع يجب أن يكون بين 1 و 4',
  UPDATE_FAILED = 'فشل تحديث عدد الأذرع',
  NETWORK_ERROR = 'خطأ في الاتصال بالخادم'
}
```

**الاستراتيجية:**
- عرض رسالة خطأ مؤقتة
- إعادة تحميل بيانات الجلسة
- عدم تغيير الواجهة حتى تأكيد النجاح

### 3. أخطاء إنهاء الجلسة

```typescript
enum SessionEndError {
  SESSION_NOT_FOUND = 'الجلسة غير موجودة',
  SESSION_NOT_ACTIVE = 'الجلسة غير نشطة',
  CUSTOMER_NAME_REQUIRED = 'اسم العميل مطلوب',
  BILL_UPDATE_FAILED = 'فشل تحديث الفاتورة',
  NETWORK_ERROR = 'خطأ في الاتصال بالخادم'
}
```

**الاستراتيجية:**
- إذا فشل تحديث الفاتورة: إنهاء الجلسة وتسجيل الخطأ
- إذا فشل إنهاء الجلسة: عرض رسالة خطأ والسماح بإعادة المحاولة
- حفظ اسم العميل في الحالة المحلية لتجنب فقدانه

### 4. أخطاء فك ربط الجلسة من الطاولة

```typescript
enum UnlinkTableError {
  SESSION_NOT_FOUND = 'الجلسة غير موجودة',
  SESSION_NOT_LINKED = 'الجلسة غير مرتبطة بطاولة',
  BILL_SEPARATION_FAILED = 'فشل فصل الفاتورة عن الطاولة',
  TABLE_UPDATE_FAILED = 'فشل تحديث حالة الطاولة',
  CUSTOMER_NAME_REQUIRED = 'اسم العميل مطلوب',
  NETWORK_ERROR = 'خطأ في الاتصال بالخادم'
}
```

**الاستراتيجية:**
- عرض نافذة تأكيد قبل فك الربط توضح التأثير
- إذا فشل فصل الفاتورة: عرض رسالة خطأ والسماح بإعادة المحاولة
- إذا لم يكن اسم العميل موجوداً: طلبه قبل إتمام فك الربط
- تحديث الواجهة فقط بعد تأكيد النجاح من الخادم

## استراتيجية الاختبار

### 1. اختبارات الوحدة (Unit Tests)

```typescript
// Session Model Tests
describe('Session Model', () => {
  test('should calculate cost correctly with multiple controller changes', async () => {
    // Test implementation
  });
  
  test('should update controllers history when controllers change', () => {
    // Test implementation
  });
  
  test('should end session and close all open periods', () => {
    // Test implementation
  });
});

// Bill Model Tests
describe('Bill Model', () => {
  test('should calculate subtotal from sessions correctly', async () => {
    // Test implementation
  });
  
  test('should update bill type based on sessions', () => {
    // Test implementation
  });
});
```

### 2. اختبارات التكامل (Integration Tests)

```typescript
// Session Controller Tests
describe('Session Controller', () => {
  test('should create session with bill', async () => {
    // Test implementation
  });
  
  test('should update controllers and recalculate cost', async () => {
    // Test implementation
  });
  
  test('should end session and update bill', async () => {
    // Test implementation
  });
  
  test('should link session to table', async () => {
    // Test implementation
  });
});
```

### 3. اختبارات واجهة المستخدم (UI Tests)

```typescript
// PlayStation Page Tests
describe('PlayStation Page', () => {
  test('should display all devices', () => {
    // Test implementation
  });
  
  test('should start new session', async () => {
    // Test implementation
  });
  
  test('should update controllers count', async () => {
    // Test implementation
  });
  
  test('should end session with customer name', async () => {
    // Test implementation
  });
  
  test('should link session to table', async () => {
    // Test implementation
  });
});
```

## الأداء والتحسينات

### 1. تحديث التكلفة في الوقت الفعلي

**المشكلة:** حساب التكلفة لكل جلسة نشطة كل ثانية يمكن أن يكون مكلفاً.

**الحل:**
- حساب التكلفة على الواجهة الأمامية بناءً على الوقت المنقضي
- تحديث التكلفة من الخادم كل دقيقة فقط
- حساب التكلفة النهائية الدقيقة عند إنهاء الجلسة

```typescript
// Frontend cost calculation
function calculateCurrentCost(session: Session): number {
  const now = new Date();
  let totalCost = 0;
  
  for (const period of session.controllersHistory) {
    const periodEnd = period.to || now;
    const durationMs = periodEnd.getTime() - period.from.getTime();
    const minutes = durationMs / (1000 * 60);
    const hourlyRate = getHourlyRate(session.deviceId, period.controllers);
    const periodCost = (minutes * hourlyRate) / 60;
    totalCost += periodCost;
  }
  
  return Math.round(totalCost);
}
```

### 2. تحسين تحميل البيانات

**الاستراتيجية:**
- تحميل البيانات بشكل متوازي عند فتح الصفحة
- استخدام WebSocket لتحديثات الوقت الفعلي
- تخزين مؤقت للبيانات التي لا تتغير كثيراً (الأجهزة، الطاولات)

```typescript
// Parallel data loading
async function loadInitialData() {
  const [devices, sessions, bills, tables] = await Promise.all([
    api.getDevices(),
    api.getSessions({ status: 'active' }),
    api.getBills({ status: ['draft', 'partial'] }),
    api.getTables()
  ]);
  
  return { devices, sessions, bills, tables };
}
```

### 3. الحفاظ على البيانات عند إعادة التحميل

**الاستراتيجية:**
- جميع البيانات محفوظة في قاعدة البيانات
- عند إعادة التحميل، جلب جميع الجلسات النشطة
- إعادة حساب التكلفة الحالية لكل جلسة
- استعادة حالة الواجهة من البيانات المحفوظة

```typescript
// Restore state after reload
async function restoreState() {
  const activeSessions = await api.getSessions({ status: 'active' });
  
  for (const session of activeSessions) {
    // Recalculate current cost
    session.currentCost = calculateCurrentCost(session);
  }
  
  return activeSessions;
}
```

## الأمان

### 1. التحقق من الصلاحيات

```typescript
// Middleware للتحقق من صلاحيات المستخدم
function checkPermission(permission: string) {
  return (req, res, next) => {
    if (!req.user.permissions.includes(permission)) {
      return res.status(403).json({
        success: false,
        message: 'ليس لديك صلاحية لتنفيذ هذا الإجراء'
      });
    }
    next();
  };
}

// ا��تخدام Middleware في المسارات
router.post('/sessions', checkPermission('playstation'), createSession);
router.put('/sessions/:id/controllers', checkPermission('playstation'), updateControllers);
router.put('/sessions/:id/end', checkPermission('playstation'), endSession);
```

### 2. التحقق من صحة البيانات

```typescript
// Validation schemas
const sessionSchema = {
  deviceId: { type: 'string', required: true },
  deviceNumber: { type: 'number', required: true },
  deviceName: { type: 'string', required: true },
  deviceType: { type: 'string', enum: ['playstation', 'computer'], required: true },
  controllers: { type: 'number', min: 1, max: 4 },
  tableNumber: { type: 'number', optional: true }
};

const controllersUpdateSchema = {
  controllers: { type: 'number', min: 1, max: 4, required: true }
};
```

## آلية فك ربط الجلسة من الطاولة

### تدفق العملية (Flow)

```
1. المستخدم يضغط على زر "فك الربط من الطاولة"
   ↓
2. النظام يعرض نافذة تأكيد:
   - "هل تريد فك ربط هذه الجلسة من الطاولة؟"
   - "سيتم نقل الفاتورة إلى قسم أجهزة البلايستيشن"
   ↓
3. المستخدم يؤكد
   ↓
4. النظام يتحقق من وجود اسم العميل:
   - إذا موجود: الانتقال للخطوة 5
   - إذا غير موجود: طلب اسم العميل
   ↓
5. النظام ينفذ العمليات التالية بالترتيب:
   a. فصل الفاتورة عن الطاولة (إزالة tableNumber)
   b. تحديث نوع الفاتورة إلى "playstation"
   c. إضافة/تحديث اسم العميل في الفاتورة
   d. تحديث حالة الطاولة (إزالة ارتباط الجلسة)
   e. تحديث بيانات الجلسة (إزالة tableNumber)
   ↓
6. النظام يحدث الواجهة:
   - نقل الفاتورة من قسم الطاولات إلى قسم البلايستيشن
   - تحديث عرض الجلسة لإظهار "بدون طاولة"
   - تحديث حالة الطاولة
   ↓
7. عرض رسالة نجاح: "تم فك ربط الجلسة من الطاولة بنجاح"
```

### معالجة الحالات الخاصة

#### 1. الطاولة تحتوي على طلبات كافيه بالإضافة للجلسة

**السيناريو:** طاولة رقم 5 لديها:
- جلسة بلايستيشن (50 جنيه)
- طلبات كافيه (100 جنيه)
- الإجمالي: 150 جنيه

**عند فك الربط:**
1. يتم إنشاء فاتورة جديدة للبلايستيشن (50 جنيه)
2. تبقى فاتورة الطاولة تحتوي على طلبات الكافيه فقط (100 جنيه)
3. يتم نقل بيانات الجلسة إلى الفاتورة الجديدة

#### 2. الطاولة تحتوي على جلسة بلايستيشن فقط

**السيناريو:** طاولة رقم 3 لديها:
- جلسة بلايستيشن فقط (50 جنيه)
- لا توجد طلبات كافيه

**عند فك الربط:**
1. يتم تحويل الفاتورة الحالية من نوع "cafe" إلى "playstation"
2. يتم إزالة رقم الطاولة من الفاتورة
3. يتم طلب اسم العميل إذا لم يكن موجوداً

#### 3. الجلسة تم دفع جزء من قيمتها

**السيناريو:** جلسة بلايستيشن (100 جنيه):
- تم دفع 50 جنيه
- المتبقي 50 جنيه

**عند فك الربط:**
1. يتم الاحتفاظ بسجل الدفعات الجزئية
2. يتم نقل جميع بيانات الدفع إلى الفاتورة الجديدة
3. يبقى المبلغ المتبقي كما هو (50 جنيه)

### API Endpoints الجديدة

```typescript
// فك ربط جلسة من طاولة
PUT /api/sessions/:sessionId/unlink-table
Request Body: {
  customerName?: string // اختياري، يُطلب إذا لم يكن موجوداً
}
Response: {
  success: boolean,
  message: string,
  data: {
    session: Session,
    bill: Bill,
    table: Table
  }
}
```

### تحديثات قاعدة البيانات

```javascript
// Session Model - إضافة حقل لتتبع تاريخ الربط
{
  tableHistory: [
    {
      tableNumber: Number,
      linkedAt: Date,
      unlinkedAt: Date
    }
  ]
}
```

## التوافق مع الأنظمة الموجودة

### 1. التكامل مع نظام الطاولات

- الجلسات يمكن ربطها بطاولات موجودة
- عند ربط جلسة بطاولة، يتم دمج الفاتورة مع فاتورة الطاولة
- يمكن فك ربط الجلسة من الطاولة في أي وقت
- عند فك الربط، يتم فصل الفاتورة ونقلها إلى قسم البلايستيشن

### 2. التكامل مع نظام الفواتير

- كل جلسة تُنشئ فاتورة تلقائياً
- الفواتير تُحدّث تلقائياً عند تغيير الجلسة
- يمكن دفع الفاتورة جزئياً أو كلياً
- الفواتير تُصنّف حسب النوع (كافيه، بلايستيشن، كمبيوتر)

### 3. التكامل مع نظام الإشعارات

- إشعار عند بدء جلسة جديدة
- إشعار عند إنهاء جلسة
- إشعار عند تعديل عدد الأذرع
- إشعار عند ربط جلسة بطاولة

## خطة النشر

### المرحلة 1: تحديث النماذج والـ API
1. تحديث Session Model لدعم controllersHistory
2. تحديث Bill Model لدعم billType
3. إضافة API endpoints الجديدة
4. اختبار الـ API

### المرحلة 2: تحديث الواجهة الأمامية
1. تحديث صفحة البلايستيشن
2. إضافة مكونات الواجهة الجديدة
3. تحديث صفحة الفواتير
4. اختبار الواجهة

### المرحلة 3: الاختبار والنشر
1. اختبار التكامل الشامل
2. اختبار الأداء
3. النشر التدريجي
4. المراقبة والتحسين
