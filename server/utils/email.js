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

    // Try different configurations
    const configs = [
        {
            service: "gmail",
            host: process.env.EMAIL_HOST,
            port: process.env.EMAIL_PORT || 587,
            secure: false,
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS,
            },
            tls: {
                rejectUnauthorized: false,
            },
        },
        {
            host: process.env.EMAIL_HOST,
            port: 465,
            secure: true,
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS,
            },
        },
        {
            host: process.env.EMAIL_HOST,
            port: 587,
            secure: false,
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS,
            },
        },
        // Simple fallback configuration
        {
            host: "smtp.gmail.com",
            port: 587,
            secure: false,
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS,
            },
        },
    ];

    for (let i = 0; i < configs.length; i++) {
        try {
            const transporter = nodemailer.createTransport(configs[i]);
            Logger.info(`Trying email config ${i + 1}`);
            return transporter;
        } catch (error) {
            Logger.warn(`Email config ${i + 1} failed:`, error.message);
            if (i === configs.length - 1) {
                throw new Error("All email configurations failed");
            }
        }
    }
};

// Send email
export const sendEmail = async (options) => {
    let transporter = createTransporter();

    if (!transporter) {
        // Fallback: create simple transporter
        try {
            transporter = nodemailer.createTransport({
                host: "smtp.gmail.com",
                port: 587,
                secure: false,
                auth: {
                    user: process.env.EMAIL_USER,
                    pass: process.env.EMAIL_PASS,
                },
            });
            Logger.info("Using fallback email transporter");
        } catch (fallbackError) {
            throw new Error("Email service not configured and fallback failed");
        }
    }

    try {
        // Try to verify transporter configuration
        try {
            await transporter.verify();
            Logger.info("Email transporter verified successfully");
        } catch (verifyError) {
            Logger.warn(
                "Email transporter verification failed, trying to send anyway",
                {
                    error: verifyError.message,
                }
            );
        }

        const mailOptions = {
            from: `"Bomba System" <${process.env.EMAIL_USER}>`,
            to: options.to,
            subject: options.subject,
            text: options.text,
            html: options.html,
        };

        Logger.info("Sending email", {
            to: options.to,
            subject: options.subject,
            from: process.env.EMAIL_USER,
        });

        const result = await transporter.sendMail(mailOptions);

        Logger.info("Email sent successfully", {
            messageId: result.messageId,
            to: options.to,
        });

        return result;
    } catch (error) {
        Logger.error("Failed to send email", {
            to: options.to,
            subject: options.subject,
            error: error.message,
            stack: error.stack,
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
        subject: `📊 التقرير اليومي - ${new Date().toLocaleDateString(
            "ar-EG"
        )}`,
        html: `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>التقرير اليومي - نظام Bomba</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }

          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 20px;
          }

          .email-container {
            max-width: 600px;
            margin: 0 auto;
            background: #ffffff;
            border-radius: 20px;
            overflow: hidden;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
          }

          .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 40px 30px;
            text-align: center;
            position: relative;
            overflow: hidden;
          }

          .header-content {
            position: relative;
            z-index: 2;
          }

          .header-decoration {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            z-index: 1;
          }

          .decoration-circle {
            position: absolute;
            border-radius: 50%;
            background: rgba(255, 255, 255, 0.1);
            animation: float 6s ease-in-out infinite;
          }

          .decoration-circle:nth-child(1) {
            width: 80px;
            height: 80px;
            top: 20px;
            left: 20px;
            animation-delay: 0s;
          }

          .decoration-circle:nth-child(2) {
            width: 60px;
            height: 60px;
            top: 60px;
            right: 40px;
            animation-delay: 2s;
          }

          .decoration-circle:nth-child(3) {
            width: 40px;
            height: 40px;
            bottom: 30px;
            left: 50%;
            animation-delay: 4s;
          }

          @keyframes float {
            0%, 100% { transform: translateY(0px) rotate(0deg); }
            50% { transform: translateY(-20px) rotate(180deg); }
          }

          .header::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><pattern id="grain" width="100" height="100" patternUnits="userSpaceOnUse"><circle cx="50" cy="50" r="1" fill="white" opacity="0.1"/></pattern></defs><rect width="100" height="100" fill="url(%23grain)"/></svg>');
            opacity: 0.3;
          }

          .header h1 {
            font-size: 28px;
            font-weight: 700;
            margin-bottom: 10px;
            position: relative;
            z-index: 1;
          }

          .header p {
            font-size: 16px;
            opacity: 0.9;
            position: relative;
            z-index: 1;
          }

          .date-badge {
            background: rgba(255,255,255,0.2);
            padding: 8px 16px;
            border-radius: 25px;
            display: inline-block;
            margin-top: 15px;
            font-size: 14px;
            position: relative;
            z-index: 1;
          }

          .content {
            padding: 40px 30px;
          }

          .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 40px;
          }

          .stat-card {
            background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
            border-radius: 15px;
            padding: 25px;
            text-align: center;
            border: 1px solid #e9ecef;
            transition: all 0.3s ease;
            position: relative;
            overflow: hidden;
          }

          .stat-card::before {
            content: '';
            position: absolute;
            top: 0;
            left: -100%;
            width: 100%;
            height: 100%;
            background: linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent);
            transition: left 0.5s ease;
          }

          .stat-card:hover::before {
            left: 100%;
          }

          .stat-card:hover {
            transform: translateY(-5px);
          }

          .stat-icon {
            width: 50px;
            height: 50px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 15px;
            font-size: 24px;
          }

          .stat-value {
            font-size: 28px;
            font-weight: 700;
            color: #2c3e50;
            margin-bottom: 5px;
          }

          .stat-label {
            font-size: 14px;
            color: #6c757d;
            font-weight: 500;
          }

          .revenue { background: linear-gradient(135deg, #28a745, #20c997); }
          .bills { background: linear-gradient(135deg, #007bff, #6610f2); }
          .orders { background: linear-gradient(135deg, #fd7e14, #ffc107); }
          .sessions { background: linear-gradient(135deg, #6f42c1, #e83e8c); }

          .section {
            margin-bottom: 40px;
          }

          .section-title {
            font-size: 20px;
            font-weight: 600;
            color: #2c3e50;
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 2px solid #e9ecef;
            position: relative;
          }

          .section-title::after {
            content: '';
            position: absolute;
            bottom: -2px;
            right: 0;
            width: 50px;
            height: 2px;
            background: linear-gradient(135deg, #667eea, #764ba2);
          }

          .top-products {
            background: #f8f9fa;
            border-radius: 15px;
            padding: 25px;
            border: 1px solid #e9ecef;
          }

          .product-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 15px 0;
            border-bottom: 1px solid #e9ecef;
            transition: all 0.3s ease;
            border-radius: 8px;
            padding: 15px;
            margin-bottom: 5px;
          }

          .product-item:hover {
            background: rgba(102, 126, 234, 0.05);
            transform: translateX(-5px);
          }

          .product-item:last-child {
            border-bottom: none;
          }

          .product-rank {
            background: linear-gradient(135deg, #667eea, #764ba2);
            color: white;
            width: 30px;
            height: 30px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 600;
            font-size: 14px;
          }

          .product-name {
            font-weight: 500;
            color: #2c3e50;
            flex: 1;
            margin: 0 15px;
          }

          .product-quantity {
            background: #e9ecef;
            padding: 5px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
            color: #6c757d;
          }

          .footer {
            background: #f8f9fa;
            padding: 30px;
            text-align: center;
            border-top: 1px solid #e9ecef;
          }

          .footer-logo {
            font-size: 24px;
            font-weight: 700;
            color: #667eea;
            margin-bottom: 10px;
          }

          .footer-text {
            color: #6c757d;
            font-size: 14px;
            margin-bottom: 20px;
          }

          .footer-actions {
            display: flex;
            justify-content: center;
            gap: 30px;
            margin-top: 20px;
            padding-top: 20px;
            border-top: 1px solid #e9ecef;
          }

          .action-item {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 10px 15px;
            background: rgba(102, 126, 234, 0.1);
            border-radius: 20px;
            transition: all 0.3s ease;
            cursor: pointer;
          }

          .action-item:hover {
            background: rgba(102, 126, 234, 0.2);
            transform: translateY(-2px);
          }

          .action-icon {
            font-size: 16px;
          }

          .action-text {
            font-size: 12px;
            color: #667eea;
            font-weight: 500;
          }

          .profit-section {
            background: linear-gradient(135deg, #28a745, #20c997);
            color: white;
            border-radius: 15px;
            padding: 25px;
            margin-bottom: 30px;
            text-align: center;
            position: relative;
            overflow: hidden;
          }

          .profit-section::before {
            content: '';
            position: absolute;
            top: -50%;
            left: -50%;
            width: 200%;
            height: 200%;
            background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%);
            animation: shimmer 3s ease-in-out infinite;
          }

          @keyframes shimmer {
            0%, 100% { transform: rotate(0deg); }
            50% { transform: rotate(180deg); }
          }

          .profit-title {
            font-size: 18px;
            font-weight: 600;
            margin-bottom: 10px;
          }

          .profit-amount {
            font-size: 32px;
            font-weight: 700;
            margin-bottom: 5px;
          }

          .profit-subtitle {
            font-size: 14px;
            opacity: 0.9;
          }

          .performance-summary {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
          }

          .performance-item {
            background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
            border-radius: 15px;
            padding: 20px;
            display: flex;
            align-items: center;
            border: 1px solid #e9ecef;
            transition: all 0.3s ease;
          }

          .performance-item:hover {
            transform: translateY(-3px);
            box-shadow: 0 10px 25px rgba(0,0,0,0.1);
          }

          .performance-icon {
            font-size: 32px;
            margin-left: 15px;
            width: 50px;
            height: 50px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            background: linear-gradient(135deg, #667eea, #764ba2);
            color: white;
          }

          .performance-content {
            flex: 1;
          }

          .performance-title {
            font-size: 14px;
            color: #6c757d;
            font-weight: 500;
            margin-bottom: 5px;
          }

          .performance-value {
            font-size: 24px;
            font-weight: 700;
            color: #2c3e50;
          }

          @media (max-width: 600px) {
            .stats-grid {
              grid-template-columns: 1fr;
            }

            .content {
              padding: 20px;
            }

            .header {
              padding: 30px 20px;
            }
          }
        </style>
      </head>
      <body>
        <div class="email-container">
          <div class="header">
            <div class="header-content">
              <h1>📊 التقرير اليومي</h1>
              <p>ملخص شامل لأداء منشأتك اليوم</p>
              <div class="date-badge">
                ${new Date().toLocaleDateString("ar-EG", {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                })}
              </div>
            </div>
            <div class="header-decoration">
              <div class="decoration-circle"></div>
              <div class="decoration-circle"></div>
              <div class="decoration-circle"></div>
            </div>
          </div>

          <div class="content">
            <!-- Profit Section -->
            <div class="profit-section">
              <div class="profit-title">💰 صافي الربح اليوم</div>
              <div class="profit-amount">${data.netProfit || 0} ج.م</div>
              <div class="profit-subtitle">إجمالي الإيرادات: ${
                  data.totalRevenue || 0
              } ج.م</div>
            </div>

            <!-- Statistics Grid -->
            <div class="stats-grid">
              <div class="stat-card">
                <div class="stat-icon revenue">💰</div>
                <div class="stat-value">${data.totalRevenue || 0}</div>
                <div class="stat-label">إجمالي الإيرادات (ج.م)</div>
              </div>

              <div class="stat-card">
                <div class="stat-icon bills">📄</div>
                <div class="stat-value">${data.totalBills || 0}</div>
                <div class="stat-label">عدد الفواتير</div>
              </div>

              <div class="stat-card">
                <div class="stat-icon orders">🛒</div>
                <div class="stat-value">${data.totalOrders || 0}</div>
                <div class="stat-label">عدد الطلبات</div>
              </div>

              <div class="stat-card">
                <div class="stat-icon sessions">🎮</div>
                <div class="stat-value">${data.totalSessions || 0}</div>
                <div class="stat-label">عدد الجلسات</div>
              </div>
            </div>

            <!-- Performance Summary -->
            <div class="section">
              <h2 class="section-title">📈 ملخص الأداء</h2>
              <div class="performance-summary">
                <div class="performance-item">
                  <div class="performance-icon">🎯</div>
                  <div class="performance-content">
                    <div class="performance-title">معدل النمو</div>
                    <div class="performance-value">+${Math.round(
                        (data.totalRevenue || 0) / 100
                    )}%</div>
                  </div>
                </div>
                <div class="performance-item">
                  <div class="performance-icon">⚡</div>
                  <div class="performance-content">
                    <div class="performance-title">كفاءة التشغيل</div>
                    <div class="performance-value">${Math.round(
                        ((data.totalSessions || 0) / (data.totalOrders || 1)) *
                            100
                    )}%</div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Top Products Section -->
            <div class="section">
              <h2 class="section-title">🏆 أكثر المنتجات مبيعاً</h2>
              <div class="top-products">
                ${
                    data.topProducts && data.topProducts.length > 0
                        ? data.topProducts
                              .map(
                                  (product, index) => `
                    <div class="product-item">
                      <div class="product-rank">${index + 1}</div>
                      <div class="product-name">${product.name}</div>
                      <div class="product-quantity">${
                          product.quantity
                      } قطعة</div>
                    </div>
                  `
                              )
                              .join("")
                        : '<div style="text-align: center; color: #6c757d; padding: 20px;">لا توجد مبيعات اليوم</div>'
                }
              </div>
            </div>
          </div>

          <div class="footer">
            <div class="footer-logo">🎮 Bomba System</div>
            <div class="footer-text">
              تقرير تلقائي من نظام إدارة المنشآت<br>
              تم إنشاؤه في ${new Date().toLocaleTimeString("ar-EG")}
            </div>
            <div class="footer-actions">
              <div class="action-item">
                <span class="action-icon">📊</span>
                <span class="action-text">عرض التقارير التفصيلية</span>
              </div>
              <div class="action-item">
                <span class="action-icon">⚙️</span>
                <span class="action-text">إعدادات الإشعارات</span>
              </div>
            </div>
          </div>
      </div>
      </body>
      </html>
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
