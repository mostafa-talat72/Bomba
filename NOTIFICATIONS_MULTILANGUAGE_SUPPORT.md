# Notifications Multi-Language and Currency Support - Completed

## Overview
تم تحديث نظام الإشعارات لدعم الثلاث لغات (عربي، إنجليزي، فرنسي) والعملات المختلفة من قاعدة البيانات.

## Changes Made

### 1. Backend - Translation System

#### Created: `server/utils/notificationTranslations.js`
- نظام ترجمة شامل للإشعارات يدعم 3 لغات
- دوال مساعدة:
  - `getNotificationTranslation(category, type, language, ...params)` - للحصول على الترجمة المناسبة
  - `getActionTranslation(actionKey, language)` - لترجمة نصوص الأزرار

#### Notification Categories Supported:
1. **Session Notifications** (إشعارات الجلسات):
   - `started` - جلسة جديدة / New Session / Nouvelle Session
   - `ended` - انتهاء الجلسة / Session Ended / Session Terminée
   - `paused` - إيقاف مؤقت / Session Paused / Session en Pause

2. **Order Notifications** (إشعارات الطلبات):
   - `created` - طلب جديد / New Order / Nouvelle Commande
   - `ready` - طلب جاهز / Order Ready / Commande Prête
   - `cancelled` - طلب ملغي / Order Cancelled / Commande Annulée

3. **Inventory Notifications** (إشعارات المخزون):
   - `low_stock` - مخزون منخفض / Low Stock / Stock Faible
   - `out_of_stock` - نفاد المخزون / Out of Stock / Rupture de Stock

4. **Billing Notifications** (إشعارات الفواتير):
   - `created` - فاتورة جديدة / New Bill / Nouvelle Facture
   - `paid` - دفع مكتمل / Payment Complete / Paiement Complet
   - `partial_payment` - دفع جزئي / Partial Payment / Paiement Partiel

#### Action Buttons Translations:
- `viewOrder` - عرض الطلب / View Order / Voir la Commande
- `deliverOrder` - تسليم الطلب / Deliver Order / Livrer la Commande
- `manageInventory` - إدارة المخزون / Manage Inventory / Gérer l'Inventaire
- `restock` - إعادة التوريد / Restock / Réapprovisionner
- `viewBill` - عرض الفاتورة / View Bill / Voir la Facture

### 2. Backend - Model Updates

#### Updated: `server/models/Notification.js`
- تحديث جميع الـ static methods لاستخدام نظام الترجمات الجديد
- إضافة معاملات `language` و `currency` لجميع الدوال
- استخدام `getCurrencySymbol()` لعرض رمز العملة المناسب حسب اللغة
- حفظ اللغة والعملة في `metadata` لكل إشعار

**Updated Methods:**
- `createSessionNotification(type, session, createdBy, language, currency)`
- `createOrderNotification(type, order, createdBy, language)`
- `createInventoryNotification(type, item, createdBy, language)`
- `createBillingNotification(type, bill, createdBy, language, currency)`

### 3. Backend - Service Updates

#### Updated: `server/services/notificationService.js`
- تحديث جميع الدوال لقبول معاملات `language` و `currency`
- الدوال المحدثة:
  - `createSessionNotification(type, session, createdBy, language, currency)`
  - `createOrderNotification(type, order, createdBy, language)`
  - `createInventoryNotification(type, item, createdBy, language)`
  - `createBillingNotification(type, bill, createdBy, language, currency)`

### 4. Backend - Controller Updates

#### Updated: `server/controllers/sessionController.js`
- جميع استدعاءات `createSessionNotification` تمرر اللغة والعملة
- يتم جلب اللغة من `req.user.preferences.language`
- يتم جلب العملة من `organization.currency`

#### Updated: `server/controllers/orderController.js`
- جميع استدعاءات `createOrderNotification` تمرر اللغة
- يتم جلب اللغة من `req.user.preferences.language`
- تم التحديث في 4 مواقع مختلفة

#### Updated: `server/controllers/inventoryController.js`
- استدعاءات `createInventoryNotification` تمرر اللغة
- يتم جلب اللغة من `req.user.preferences.language`

#### Updated: `server/controllers/billingController.js`
- جميع استدعاءات `createBillingNotification` تمرر اللغة والعملة
- يتم جلب اللغة من `req.user.preferences.language`
- يتم جلب العملة من `organization.currency`

## How It Works

### Language Detection Flow:
1. عند إنشاء إشعار، يتم جلب لغة المستخدم من `user.preferences.language`
2. إذا لم تكن محددة، يتم استخدام العربية كلغة افتراضية
3. يتم تمرير اللغة إلى دالة الترجمة المناسبة
4. يتم إنشاء الإشعار بالنص المترجم

### Currency Detection Flow:
1. عند إنشاء إشعار يحتوي على مبالغ مالية، يتم جلب العملة من `organization.currency`
2. إذا لم تكن محددة، يتم استخدام EGP كعملة افتراضية
3. يتم استخدام `getCurrencySymbol(currency, language)` لعرض رمز العملة المناسب
4. مثال: EGP بالعربية = "ج.م"، بالإنجليزية = "EGP"

### Example Notification Creation:

```javascript
// Session notification with language and currency
const userLanguage = req.user.preferences?.language || 'ar';
const organization = await Organization.findById(req.user.organization).select('currency');
const currency = organization?.currency || 'EGP';

await NotificationService.createSessionNotification(
    "ended",
    session,
    req.user._id,
    userLanguage,
    currency
);

// Result in Arabic:
// Title: "انتهاء الجلسة"
// Message: "انتهت الجلسة على PS4-1 - التكلفة: 50 ج.م"

// Result in English:
// Title: "Session Ended"
// Message: "Session ended on PS4-1 - Cost: 50 EGP"

// Result in French:
// Title: "Session Terminée"
// Message: "Session terminée sur PS4-1 - Coût: 50 EGP"
```

## Benefits

1. **Multi-Language Support**: الإشعارات تظهر بلغة المستخدم المفضلة
2. **Currency Flexibility**: دعم جميع العملات مع رموز مناسبة لكل لغة
3. **Consistent Experience**: تجربة متسقة عبر جميع أنواع الإشعارات
4. **Easy Maintenance**: سهولة إضافة لغات جديدة أو تعديل الترجمات
5. **Backward Compatible**: يعمل مع الإشعارات القديمة (يستخدم العربية افتراضياً)

## Supported Languages

- **Arabic (ar)**: اللغة العربية - RTL
- **English (en)**: English Language - LTR
- **French (fr)**: Langue Française - LTR

## Supported Currencies

All currencies from `localeHelper.js`:
- EGP (Egyptian Pound) - جنيه مصري
- SAR (Saudi Riyal) - ريال سعودي
- AED (UAE Dirham) - درهم إماراتي
- USD (US Dollar) - دولار أمريكي
- EUR (Euro) - يورو
- GBP (British Pound) - جنيه إسترليني

## Testing

To test the multi-language notifications:

1. Change user language in settings
2. Perform actions that trigger notifications:
   - Start/end a gaming session
   - Create/update an order
   - Add/remove inventory items
   - Create/pay a bill
3. Check that notifications appear in the selected language
4. Verify currency symbols match the organization's currency

## Future Enhancements

- Add more languages (Spanish, German, etc.)
- Add notification preferences per user
- Add email notifications with multi-language support
- Add push notifications with multi-language support
