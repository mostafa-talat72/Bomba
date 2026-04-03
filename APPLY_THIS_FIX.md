# ✅ الإصلاح النهائي - استخدام reportController في scheduler.js

## المشكلة
التقارير المرسلة عبر الإيميل تحسب الجلسات بصفر، بينما صفحة التقارير وتقرير الاستهلاك تعرض البيانات بشكل صحيح.

## الحل
استخدام نفس الوظائف الموجودة في `reportController.js` التي تستخدمها صفحة التقارير وصفحة تقرير الاستهلاك.

---

## الخطوات المطلوبة

### 1. افتح ملف `server/utils/scheduler.js`

### 2. ابحث عن وظيفة `generateDailyReportForOrganization`

### 3. استبدل الكود الموجود بالكود التالي:

```javascript
const generateDailyReportForOrganization = async (organization) => {
    try {
        // Check if daily report is enabled for this organization
        if (organization.reportSettings?.dailyReportEnabled === false) {
            Logger.info(`Daily report disabled for organization: ${organization.name}`);
            return;
        }

        const now = new Date();

        // Get the configured start time for this organization (default: 08:00)
        const startTimeStr = organization.reportSettings?.dailyReportStartTime || "08:00";
        const [startHour, startMinute] = startTimeStr.split(':').map(Number);

        // Calculate the report period based on organization's configured time
        const endOfReport = new Date(now);
        endOfReport.setHours(startHour, startMinute || 0, 0, 0);
        
        // If current time is before the configured time today, use yesterday's time
        if (now < endOfReport) {
            endOfReport.setDate(endOfReport.getDate() - 1);
        }
        // Get organization timezone (default to Africa/Cairo if not set)
        const orgTimezone = organization.timezone || 'Africa/Cairo';
        
        const startOfReport = new Date(endOfReport);
        startOfReport.setDate(startOfReport.getDate() - 1); // 24 hours before

        // Format dates for logging
        const formatForLog = (date) => {
            return {
                iso: date.toISOString(),
                local: date.toLocaleString('ar-EG', { timeZone: orgTimezone }),
                date: date.toLocaleDateString('ar-EG', { timeZone: orgTimezone }),
                time: date.toLocaleTimeString('ar-EG', { timeZone: orgTimezone })
            };
        };

        Logger.info(`📅 Daily report period for ${organization.name}:`, {
            configuredStartTime: startTimeStr,
            currentTime: formatForLog(now),
            reportStart: formatForLog(startOfReport),
            reportEnd: formatForLog(endOfReport),
            timezone: `${orgTimezone}`
        });

        // Get emails from organization settings
        const reportEmails = organization.reportSettings?.dailyReportEmails || [];
        
        if (reportEmails.length === 0) {
            Logger.warn(
                `No report emails configured for organization: ${organization.name}`,
                {
                    organizationId: organization._id,
                }
            );
            return;
        }

        Logger.info(`📊 Using reportController functions (same as Reports page) for ${organization.name}...`);

        // Import required modules
        const { generateDailyReportPDF } = await import('./pdfGenerator.js');
        
        // ✅ استخدام نفس الوظائف الموجودة في reportController.js (نفس منطق /api/reports)
        const reportController = await import('../controllers/reportController.js');
        
        // ✅ استخدام getSalesReportData - نفس ما تستخدمه صفحة التقارير وتقرير الاستهلاك
        const salesData = await reportController.getSalesReportData(
            organization._id,
            startOfReport,
            endOfReport
        );
        
        Logger.info(`💰 Sales data from reportController for ${organization.name}:`, {
            totalRevenue: salesData.totalRevenue,
            totalOrders: salesData.totalOrders,
            totalSessions: salesData.totalSessions,
            cafeRevenue: salesData.revenueBreakdown.cafe,
            playstationRevenue: salesData.revenueBreakdown.playstation,
            computerRevenue: salesData.revenueBreakdown.computer
        });
        
        // ✅ استخدام getTopProductsBySection - نفس ما تستخدمه صفحة التقارير
        const topProductsBySection = await reportController.getTopProductsBySection(
            organization._id,
            startOfReport,
            endOfReport
        );
        
        Logger.info(`📦 Top products by section for ${organization.name}:`, {
            sectionsCount: topProductsBySection.length
        });

        // Fetch costs
        const costs = await Cost.find({
            date: { $gte: startOfReport, $lte: endOfReport },
            organization: organization._id,
        }).lean();

        // ✅ استخدام البيانات من salesData (نفس منطق صفحة التقارير)
        const totalRevenue = salesData.totalRevenue;
        const cafeRevenue = salesData.revenueBreakdown.cafe;
        const playstationRevenue = salesData.revenueBreakdown.playstation;
        const computerRevenue = salesData.revenueBreakdown.computer;
        
        const totalCosts = costs.reduce((sum, cost) => sum + (Number(cost.paidAmount) || Number(cost.amount) || 0), 0);
        const netProfit = totalRevenue - totalCosts;

        Logger.info(`💵 Final calculations for ${organization.name}:`, {
            totalRevenue,
            totalCosts,
            netProfit,
            totalOrders: salesData.totalOrders,
            totalSessions: salesData.totalSessions
        });

        const reportData = {
            date: startOfReport.toLocaleDateString("ar-EG"),
            organizationName: organization.name,
            totalRevenue: totalRevenue || 0,
            totalCosts: totalCosts || 0,
            netProfit: netProfit || 0,
            totalBills: salesData.totalOrders + salesData.totalSessions,
            totalOrders: salesData.totalOrders || 0,
            totalSessions: salesData.totalSessions || 0,
            topProducts: salesData.topProducts || [],
            topProductsBySection: topProductsBySection,
            revenueByType: {
                playstation: playstationRevenue || 0,
                computer: computerRevenue || 0,
                cafe: cafeRevenue || 0
            },
            startOfReport: startOfReport,
            endOfReport: endOfReport,
            reportPeriod: `من ${startTimeStr} يوم ${startOfReport.toLocaleDateString('ar-EG', {weekday: 'long', day: 'numeric', month: 'long'})} 
                         إلى ${startTimeStr} يوم ${endOfReport.toLocaleDateString('ar-EG', {weekday: 'long', day: 'numeric', month: 'long'})}`,
        };

        Logger.info(`✅ Report data prepared for ${organization.name}:`, {
            organizationId: organization._id,
            totalRevenue: reportData.totalRevenue,
            totalOrders: reportData.totalOrders,
            totalSessions: reportData.totalSessions,
            netProfit: reportData.netProfit,
            topProductsCount: reportData.topProducts.length,
            sectionsCount: reportData.topProductsBySection.length
        });

        // Generate PDF
        const pdfBuffer = await generateDailyReportPDF(reportData);

        // Get organization owner's language and currency preferences
        const owner = await User.findById(organization.owner).select('preferences').lean();
        const ownerLanguage = owner?.preferences?.language || 'ar';
        const organizationCurrency = organization.currency || 'EGP';

        // Add language and currency to reportData
        reportData.language = ownerLanguage;
        reportData.currency = organizationCurrency;

        // Send report via email with PDF attachment
        await sendDailyReport(reportData, reportEmails, pdfBuffer);
        
        // Update lastReportSentAt timestamp
        organization.reportSettings.lastReportSentAt = new Date();
        await organization.save();
        
        Logger.info(
            `✅ Daily report sent successfully for organization: ${organization.name}`,
            {
                organizationId: organization._id,
                emailCount: reportEmails.length,
                emails: reportEmails,
                sentAt: organization.reportSettings.lastReportSentAt
            }
        );
    } catch (error) {
        Logger.error(
            `❌ Failed to generate daily report for organization: ${organization.name}`,
            {
                organizationId: organization._id,
                error: error.message,
                stack: error.stack
            }
        );
    }
};
```

### 4. ابحث عن وظيفة `generateMonthlyReportForOrganization`

### 5. استبدل الكود الموجود بالكود التالي:

```javascript
const generateMonthlyReportForOrganization = async (organization) => {
    try {
        // Check if daily report is enabled for this organization
        if (organization.reportSettings?.dailyReportEnabled === false) {
            Logger.info(`Reports disabled for organization: ${organization.name}`);
            return;
        }

        const now = new Date();

        // Get the configured start time for this organization (default: 08:00)
        const startTimeStr = organization.reportSettings?.dailyReportStartTime || "08:00";
        const [startHour, startMinute] = startTimeStr.split(':').map(Number);

        // Calculate the monthly report period based on organization's configured time
        // End: First day of current month at configured time
        const endOfReport = new Date(now.getFullYear(), now.getMonth(), 1);
        endOfReport.setHours(startHour, startMinute || 0, 0, 0);
        
        // If we haven't reached the configured time on the 1st yet, use last month
        if (now < endOfReport) {
            endOfReport.setMonth(endOfReport.getMonth() - 1);
        }
        
        // Get organization timezone (default to Africa/Cairo if not set)
        const orgTimezone = organization.timezone || 'Africa/Cairo';
        
        // Start: First day of previous month at configured time
        const startOfReport = new Date(endOfReport);
        startOfReport.setMonth(startOfReport.getMonth() - 1);

        // Format dates for logging
        const formatForLog = (date) => {
            return {
                iso: date.toISOString(),
                local: date.toLocaleString('ar-EG', { timeZone: orgTimezone }),
                date: date.toLocaleDateString('ar-EG', { timeZone: orgTimezone }),
                time: date.toLocaleTimeString('ar-EG', { timeZone: orgTimezone })
            };
        };

        Logger.info(`📅 Monthly report period for ${organization.name}:`, {
            configuredStartTime: startTimeStr,
            currentTime: formatForLog(now),
            reportStart: formatForLog(startOfReport),
            reportEnd: formatForLog(endOfReport),
            timezone: `${orgTimezone}`
        });

        // Get emails from organization settings (same as daily report)
        const reportEmails = organization.reportSettings?.dailyReportEmails || [];
        
        if (reportEmails.length === 0) {
            Logger.warn(
                `No report emails configured for organization: ${organization.name}`,
                {
                    organizationId: organization._id,
                }
            );
            return;
        }

        Logger.info(`📊 Using reportController functions for monthly report of ${organization.name}...`);

        // Import required modules
        const reportController = await import('../controllers/reportController.js');
        
        // ✅ استخدام getSalesReportData - نفس ما تستخدمه صفحة التقارير
        const salesData = await reportController.getSalesReportData(
            organization._id,
            startOfReport,
            endOfReport
        );
        
        Logger.info(`💰 Monthly sales data from reportController for ${organization.name}:`, {
            totalRevenue: salesData.totalRevenue,
            totalOrders: salesData.totalOrders,
            totalSessions: salesData.totalSessions,
            cafeRevenue: salesData.revenueBreakdown.cafe,
            playstationRevenue: salesData.revenueBreakdown.playstation,
            computerRevenue: salesData.revenueBreakdown.computer
        });
        
        // ✅ استخدام getTopProductsBySection - نفس ما تستخدمه صفحة التقارير
        const topProductsBySection = await reportController.getTopProductsBySection(
            organization._id,
            startOfReport,
            endOfReport
        );

        // Fetch costs
        const costs = await Cost.find({
            date: { $gte: startOfReport, $lte: endOfReport },
            organization: organization._id,
        }).lean();

        // Calculate totals using data from reportController
        const totalRevenue = salesData.totalRevenue;
        const cafeRevenue = salesData.revenueBreakdown.cafe;
        const playstationRevenue = salesData.revenueBreakdown.playstation;
        const computerRevenue = salesData.revenueBreakdown.computer;
        
        const totalCosts = costs.reduce((sum, cost) => sum + (Number(cost.paidAmount) || Number(cost.amount) || 0), 0);
        const netProfit = totalRevenue - totalCosts;

        Logger.info(`💵 Monthly final calculations for ${organization.name}:`, {
            totalRevenue,
            totalCosts,
            netProfit,
            totalOrders: salesData.totalOrders,
            totalSessions: salesData.totalSessions
        });

        // Calculate daily averages
        const daysInPeriod = Math.ceil((endOfReport - startOfReport) / (1000 * 60 * 60 * 24));
        const avgDailyRevenue = daysInPeriod > 0 ? totalRevenue / daysInPeriod : 0;

        const reportData = {
            month: startOfReport.toLocaleDateString("ar-EG", { month: "long", year: "numeric" }),
            organizationName: organization.name,
            totalRevenue: totalRevenue || 0,
            totalCosts: totalCosts || 0,
            netProfit: netProfit || 0,
            profitMargin: totalRevenue > 0 ? ((netProfit / totalRevenue) * 100) : 0,
            totalBills: salesData.totalOrders + salesData.totalSessions,
            totalOrders: salesData.totalOrders || 0,
            totalSessions: salesData.totalSessions || 0,
            topProducts: salesData.topProducts || [],
            topProductsBySection: topProductsBySection,
            revenueByType: {
                playstation: playstationRevenue || 0,
                computer: computerRevenue || 0,
                cafe: cafeRevenue || 0
            },
            avgDailyRevenue: avgDailyRevenue || 0,
            daysInPeriod: daysInPeriod,
            startOfReport: startOfReport,
            endOfReport: endOfReport,
            reportPeriod: `من ${startTimeStr} يوم ${startOfReport.toLocaleDateString('ar-EG', {day: 'numeric', month: 'long', year: 'numeric'})} 
                         إلى ${startTimeStr} يوم ${endOfReport.toLocaleDateString('ar-EG', {day: 'numeric', month: 'long', year: 'numeric'})}`,
        };

        Logger.info(`✅ Monthly report data prepared for ${organization.name}:`, {
            organizationId: organization._id,
            totalRevenue: reportData.totalRevenue,
            totalOrders: reportData.totalOrders,
            totalSessions: reportData.totalSessions,
            netProfit: reportData.netProfit,
            daysInPeriod: reportData.daysInPeriod,
            avgDailyRevenue: reportData.avgDailyRevenue
        });

        // Get organization owner's language and currency preferences
        const owner = await User.findById(organization.owner).select('preferences').lean();
        const ownerLanguage = owner?.preferences?.language || 'ar';
        const organizationCurrency = organization.currency || 'EGP';

        // Send report via email (reuse sendMonthlyReport function)
        await sendMonthlyReport(reportData, reportEmails, ownerLanguage, organizationCurrency);
        
        Logger.info(
            `✅ Monthly report sent successfully for organization: ${organization.name}`,
            {
                organizationId: organization._id,
                emailCount: reportEmails.length,
                emails: reportEmails,
                month: reportData.month
            }
        );
    } catch (error) {
        Logger.error(
            `❌ Failed to generate monthly report for organization: ${organization.name}`,
            {
                organizationId: organization._id,
                error: error.message,
                stack: error.stack
            }
        );
    }
};
```

---

## ✅ بعد تطبيق الإصلاح

### اختبر التقرير:
1. اذهب إلى صفحة الإعدادات
2. اضغط على "إرسال تقرير الآن"
3. تحقق من السجلات (logs) - يجب أن ترى:
   ```
   📊 Using reportController functions (same as Reports page) for [organization]...
   💰 Sales data from reportController for [organization]:
     - totalRevenue: XXX
     - totalOrders: XX
     - totalSessions: XX  ← يجب أن يكون أكبر من صفر!
   ```
4. تحقق من التقرير المرسل عبر الإيميل - يجب أن تظهر الجلسات بشكل صحيح

### النتيجة المتوقعة:
- ✅ الجلسات تظهر بنفس القيم الموجودة في صفحة التقارير
- ✅ الإيرادات محسوبة بشكل صحيح
- ✅ التقرير يستخدم نفس المنطق الموجود في `/api/reports`

---

## ملاحظة مهمة

هذا الإصلاح يجعل `scheduler.js` يستخدم **نفس الوظائف** التي تستخدمها:
- صفحة التقارير (`/api/reports`)
- صفحة تقرير الاستهلاك
- الـ endpoints: `/api/orders` و `/api/sessions`

لذلك النتائج ستكون **متطابقة تماماً** 🎯
