# Email Templates Language & Currency Fix

## Problem
Email templates (daily reports, monthly reports, and low stock alerts) were not using the organization owner's language and currency settings. They were using hardcoded values or defaults.

## Solution
Updated all email sending functions to fetch the organization owner's language preference and organization's currency, then pass these values to the email templates.

## Changes Made

### 1. server/utils/scheduler.js
Updated three email sending locations:

#### Low Stock Alert (line ~127)
- Fetches organization owner's language from `User.preferences.language`
- Fetches organization currency from `Organization.currency`
- Passes `language` and `currency` to `sendLowStockAlert()`

```javascript
// Get organization owner's language and currency preferences
const owner = await User.findById(organization.owner).select('preferences').lean();
const ownerLanguage = owner?.preferences?.language || 'ar';
const organizationCurrency = organization.currency || 'EGP';

await sendLowStockAlert({
    items: lowStockItems,
    organizationName: organization.name,
    recipientEmails: adminEmails,
    adminNames: admins.map(a => a.name),
    language: ownerLanguage,
    currency: organizationCurrency
});
```

#### Daily Report (line ~449)
- Fetches organization owner's language and currency
- Passes them to `sendDailyReport()`

```javascript
// Get organization owner's language and currency preferences
const owner = await User.findById(organization.owner).select('preferences').lean();
const ownerLanguage = owner?.preferences?.language || 'ar';
const organizationCurrency = organization.currency || 'EGP';

await sendDailyReport(reportData, reportEmails, pdfBuffer, ownerLanguage, organizationCurrency);
```

#### Monthly Report (line ~750)
- Fetches organization owner's language and currency
- Passes them to `sendMonthlyReport()`

```javascript
// Get organization owner's language and currency preferences
const owner = await User.findById(organization.owner).select('preferences').lean();
const ownerLanguage = owner?.preferences?.language || 'ar';
const organizationCurrency = organization.currency || 'EGP';

await sendMonthlyReport(reportData, reportEmails, ownerLanguage, organizationCurrency);
```

### 2. server/controllers/organizationController.js
Updated manual daily report sending (line ~955):

```javascript
// Get organization owner's language and currency preferences
const owner = await User.findById(organization.owner).select('preferences').lean();
const ownerLanguage = owner?.preferences?.language || 'ar';
const organizationCurrency = organization.currency || 'EGP';

await sendDailyReport(reportData, reportEmails, pdfBuffer, ownerLanguage, organizationCurrency);
```

### 3. server/utils/email.js
Updated email function signatures to accept language and currency:

#### sendDailyReport (line ~703)
```javascript
export const sendDailyReport = async (reportData, adminEmails, pdfBuffer = null, language = 'ar', currency = 'EGP') => {
    // ... logs with language and currency
    
    // Pass to template
    const emailTemplate = emailTemplates.dailyReport({
        ...reportData,
        language,
        currency
    });
}
```

#### sendMonthlyReport (line ~816)
```javascript
export const sendMonthlyReport = async (reportData, adminEmails, language = 'ar', currency = 'EGP') => {
    if (!adminEmails || adminEmails.length === 0) return;

    const template = emailTemplates.monthlyReport({
        ...reportData,
        language,
        currency
    });
}
```

#### sendLowStockAlert (line ~628)
Already had `language` and `currency` parameters with defaults - no changes needed.

## How It Works

1. When an email needs to be sent (scheduled or manual):
   - System fetches the organization owner using `Organization.owner` reference
   - Reads owner's language from `User.preferences.language` (defaults to 'ar')
   - Reads organization's currency from `Organization.currency` (defaults to 'EGP')

2. These values are passed to email functions:
   - `sendLowStockAlert({ ..., language, currency })`
   - `sendDailyReport(reportData, emails, pdf, language, currency)`
   - `sendMonthlyReport(reportData, emails, language, currency)`

3. Email templates use these values to:
   - Display text in the correct language (using `emailTranslations[language]`)
   - Format currency with correct symbol (using `getCurrencySymbol(currency, language)`)
   - Format dates with correct locale (using `getLocaleFromLanguage(language)`)

## Supported Languages
- Arabic (ar) - default
- English (en)
- French (fr)

## Supported Currencies
- EGP (Egyptian Pound) - default
- SAR (Saudi Riyal)
- AED (UAE Dirham)
- USD (US Dollar)
- EUR (Euro)
- GBP (British Pound)

## Testing
To test the changes:
1. Set organization owner's language preference in User settings
2. Set organization currency in Organization settings
3. Trigger email sending (low stock alert, daily report, or monthly report)
4. Verify email is in correct language with correct currency symbols

## Files Modified
- `server/utils/scheduler.js` - 3 locations updated
- `server/controllers/organizationController.js` - 1 location updated
- `server/utils/email.js` - 2 function signatures updated

## Status
✅ Completed - All email templates now use organization owner's language and currency settings
