import nodemailer from "nodemailer";
import Logger from "../middleware/logger.js";

// Create email transporter
const createTransporter = () => {
    if (
        !process.env.EMAIL_HOST ||
        !process.env.EMAIL_USER ||
        !process.env.EMAIL_PASS
    ) {
        Logger.warn(
            "Email configuration not found, email features will be disabled"
        );
        return null;
    }

    return nodemailer.createTransport({
        host: process.env.EMAIL_HOST,
        port: process.env.EMAIL_PORT || 587,
        secure: process.env.EMAIL_PORT === "465",
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
        },
    });
};

// Send email
export const sendEmail = async (options) => {
    const transporter = createTransporter();

    if (!transporter) {
        throw new Error("Email service not configured");
    }

    try {
        const mailOptions = {
            from: `"Bomba System" <${process.env.EMAIL_USER}>`,
            to: options.to,
            subject: options.subject,
            text: options.text,
            html: options.html,
        };

        const result = await transporter.sendMail(mailOptions);

        Logger.info("Email sent successfully", {
            to: options.to,
            subject: options.subject,
            messageId: result.messageId,
        });

        return result;
    } catch (error) {
        Logger.error("Failed to send email", {
            to: options.to,
            subject: options.subject,
            error: error.message,
        });
        throw error;
    }
};

// Email templates
export const emailTemplates = {
    // Low stock alert
    lowStockAlert: (items) => ({
        subject: "تنبيه: انخفاض المخزون - نظام Bomba",
        html: `
      <div dir="rtl" style="font-family: Arial, sans-serif;">
        <h2>تنبيه انخفاض المخزون</h2>
        <p>المنتجات التالية وصلت للحد الأدنى من المخزون:</p>
        <ul>
          ${items
              .map(
                  (item) => `
            <li>
              <strong>${item.name}</strong> -
              متبقي: ${item.currentStock} ${item.unit}
              (الحد الأدنى: ${item.minStock})
            </li>
          `
              )
              .join("")}
        </ul>
        <p>يرجى إعادة تعبئة المخزون في أقرب وقت ممكن.</p>
        <hr>
                  <small>هذه رسالة تلقائية من نظام Bomba</small>
      </div>
    `,
    }),

    // Daily report
    dailyReport: (data) => ({
        subject: `التقرير اليومي - ${new Date().toLocaleDateString("ar-EG")}`,
        html: `
      <div dir="rtl" style="font-family: Arial, sans-serif;">
        <h2>التقرير اليومي</h2>
        <h3>ملخص المبيعات</h3>
        <ul>
          <li>إجمالي الإيرادات: ${data.totalRevenue} ج.م</li>
          <li>عدد الفواتير: ${data.totalBills}</li>
          <li>عدد الطلبات: ${data.totalOrders}</li>
          <li>عدد الجلسات: ${data.totalSessions}</li>
        </ul>

        <h3>أكثر المنتجات مبيعاً</h3>
        <ol>
          ${data.topProducts
              .map(
                  (product) => `
            <li>${product.name} - ${product.quantity} قطعة</li>
          `
              )
              .join("")}
        </ol>

        <hr>
                  <small>تقرير تلقائي من نظام Bomba</small>
      </div>
    `,
    }),

    // User account created
    userCreated: (user, password) => ({
        subject: "تم إنشاء حسابك في نظام Bomba",
        html: `
      <div dir="rtl" style="font-family: Arial, sans-serif;">
        <h2>مرحباً ${user.name}</h2>
                  <p>تم إنشاء حسابك في نظام Bomba بنجاح.</p>

        <h3>بيانات الدخول:</h3>
        <ul>
          <li>البريد الإلكتروني: ${user.email}</li>
          <li>كلمة المرور: ${password}</li>
          <li>الدور: ${user.role}</li>
        </ul>

        <p><strong>ملاحظة:</strong> يرجى تغيير كلمة المرور بعد أول تسجيل دخول.</p>

        <hr>
                  <small>رسالة من نظام Bomba</small>
      </div>
    `,
    }),
};

// Send low stock alert
export const sendLowStockAlert = async (items, adminEmails) => {
    if (!adminEmails || adminEmails.length === 0) return;

    const template = emailTemplates.lowStockAlert(items);

    for (const email of adminEmails) {
        try {
            await sendEmail({
                to: email,
                ...template,
            });
        } catch (error) {
            Logger.error("Failed to send low stock alert", {
                email,
                error: error.message,
            });
        }
    }
};

// Send daily report
export const sendDailyReport = async (reportData, adminEmails) => {
    if (!adminEmails || adminEmails.length === 0) return;

    const template = emailTemplates.dailyReport(reportData);

    for (const email of adminEmails) {
        try {
            await sendEmail({
                to: email,
                ...template,
            });
        } catch (error) {
            Logger.error("Failed to send daily report", {
                email,
                error: error.message,
            });
        }
    }
};
