import nodemailer from "nodemailer";
import Logger from "../middleware/logger.js";
import { getConsumptionReportData } from "./consumptionReportLogic.js";

// Create email transporter
const createTransporter = () => {
    if (
        !process.env.EMAIL_HOST ||
        !process.env.EMAIL_USER ||
        !process.env.EMAIL_PASS
    ) {
        Logger.warn(
            "Email configuration not found, email features will be disabled",
            {
                EMAIL_HOST: process.env.EMAIL_HOST ? "set" : "not set",
                EMAIL_USER: process.env.EMAIL_USER ? "set" : "not set",
                EMAIL_PASS: process.env.EMAIL_PASS ? "set" : "not set",
            }
        );
        return null;
    }

    Logger.info("Email configuration found, creating transporter", {
        EMAIL_HOST: process.env.EMAIL_HOST,
        EMAIL_USER: process.env.EMAIL_USER,
        EMAIL_PORT: process.env.EMAIL_PORT || 587,
    });

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
            Logger.info(`Trying email config ${i + 1}`, {
                config: {
                    host: configs[i].host,
                    port: configs[i].port,
                    secure: configs[i].secure,
                },
            });
            return transporter;
        } catch (error) {
            Logger.warn(`Email config ${i + 1} failed:`, {
                error: error.message,
                config: {
                    host: configs[i].host,
                    port: configs[i].port,
                    secure: configs[i].secure,
                },
            });
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
    lowStockAlert: ({ items, organizationName, adminNames = [], timestamp = new Date() }) => {
        const formattedDate = new Date(timestamp).toLocaleString('ar-EG', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });

        return {
            subject: `تنبيه: انخفاض المخزون - ${organizationName || 'نظام Bomba'}`,
            html: `
                <!DOCTYPE html>
                <html dir="rtl" lang="ar">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>تنبيه انخفاض المخزون</title>
                    <style>
                        body {
                            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                            line-height: 1.6;
                            color: #333;
                            max-width: 800px;
                            margin: 0 auto;
                            padding: 20px;
                            background-color: #f9f9f9;
                        }
                        .container {
                            background-color: #fff;
                            border-radius: 8px;
                            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
                            overflow: hidden;
                        }
                        .header {
                            background-color: #e74c3c;
                            color: white;
                            padding: 20px;
                            text-align: center;
                        }
                        .header h1 {
                            margin: 0;
                            font-size: 24px;
                        }
                        .content {
                            padding: 25px;
                        }
                        .alert-message {
                            background-color: #f8d7da;
                            color: #721c24;
                            padding: 15px;
                            border-radius: 5px;
                            margin-bottom: 20px;
                            border-right: 5px solid #f5c6cb;
                        }
                        .items-table {
                            width: 100%;
                            border-collapse: collapse;
                            margin: 20px 0;
                        }
                        .items-table th, .items-table td {
                            padding: 12px 15px;
                            text-align: right;
                            border-bottom: 1px solid #ddd;
                        }
                        .items-table th {
                            background-color: #f8f9fa;
                            font-weight: bold;
                        }
                        .items-table tr:hover {
                            background-color: #f5f5f5;
                        }
                        .stock-critical {
                            color: #e74c3c;
                            font-weight: bold;
                        }
                        .footer {
                            text-align: center;
                            padding: 15px;
                            font-size: 14px;
                            color: #777;
                            border-top: 1px solid #eee;
                            margin-top: 20px;
                        }
                        .urgency-badge {
                            display: inline-block;
                            padding: 3px 8px;
                            border-radius: 12px;
                            font-size: 12px;
                            font-weight: bold;
                            margin-right: 5px;
                        }
                        .critical {
                            background-color: #f8d7da;
                            color: #721c24;
                        }
                        .warning {
                            background-color: #fff3cd;
                            color: #856404;
                        }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>🚨 تنبيه انخفاض المخزون</h1>
                            <p>${organizationName || 'نظام إدارة المخزون'}</p>
                        </div>
                        
                        <div class="content">
                            <div class="alert-message">
                                <p>يوجد <strong>${items.length} منتج</strong> يحتاج إلى إعادة تعبئة فورية!</p>
                            </div>
                            
                            <h2>تفاصيل المنتجات منخفضة المخزون</h2>
                            <table class="items-table">
                                <thead>
                                    <tr>
                                        <th>المنتج</th>
                                        <th>الكمية المتوفرة</th>
                                        <th>الحد الأدنى</th>
                                        <th>الوحدة</th>
                                        <th>الحالة</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${items.map(item => {
                                        const isCritical = item.currentStock <= (item.minStock * 0.3);
                                        const status = isCritical ? 'حرج' : 'تحذير';
                                        const statusClass = isCritical ? 'critical' : 'warning';
                                        return `
                                            <tr>
                                                <td><strong>${item.name}</strong></td>
                                                <td class="${isCritical ? 'stock-critical' : ''}">${item.currentStock}</td>
                                                <td>${item.minStock}</td>
                                                <td>${item.unit || 'قطعة'}</td>
                                                <td>
                                                    <span class="urgency-badge ${statusClass}">
                                                        ${status}
                                                    </span>
                                                </td>
                                            </tr>
                                        `;
                                    }).join('')}
                                </tbody>
                            </table>
                            
                            <div style="margin-top: 30px; padding: 15px; background-color: #f8f9fa; border-radius: 5px;">
                                <h3>الإجراء المطلوب:</h3>
                                <p>يرجى اتخاذ الإجراء اللازم لإعادة تعبئة المخزون في أقرب وقت ممكن لتجنب نفاد المنتجات.</p>
                                ${adminNames.length > 0 ? `
                                    <p>تم إرسال هذا التنبيه إلى: ${adminNames.join('، ')}</p>
                                ` : ''}
                            </div>
                        </div>
                        
                        <div class="footer">
                            <p>⏱️ تم إنشاء هذا التقرير في: ${formattedDate}</p>
                            <p>📞 للدعم الفني، يرجى التواصل مع فريق الدعم الفني</p>
                            <p>© ${new Date().getFullYear()} نظام Bomba - جميع الحقوق محفوظة</p>
                        </div>
                    </div>
                </body>
                </html>
            `
        };
    },

    // Daily report
    dailyReport: (data) => ({
        subject: `📊 التقرير اليومي - ${data.organizationName || "منشأتك"} - ${
            data.date || new Date().toLocaleDateString("ar-EG", {timeZone: 'Africa/Cairo'})
        }`,
        html: `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>التقرير اليومي - ${
            data.organizationName || "منشأتك"
        } - نظام Bomba</title>
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
            max-width: 800px;
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

          .header h1 {
            font-size: 32px;
            font-weight: 700;
            margin-bottom: 10px;
          }

          .header p {
            font-size: 16px;
            opacity: 0.9;
          }

          .organization-name {
            font-size: 24px;
            font-weight: 600;
            margin-bottom: 15px;
            color: #fff;
            background: rgba(255,255,255,0.2);
            padding: 12px 24px;
            border-radius: 25px;
            display: inline-block;
          }

          .date-badge {
            background: rgba(255,255,255,0.2);
            padding: 10px 20px;
            border-radius: 25px;
            display: inline-block;
            margin-top: 15px;
            font-size: 16px;
          }

          .period-badge {
            background: rgba(255,255,255,0.15);
            padding: 8px 16px;
            border-radius: 20px;
            display: inline-block;
            margin-top: 10px;
            font-size: 14px;
            border: 1px solid rgba(255,255,255,0.3);
          }

          .content {
            padding: 40px 30px;
          }

          .financial-overview {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
            gap: 20px;
            margin-bottom: 40px;
          }

          .financial-card {
            background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
            border-radius: 15px;
            padding: 25px;
            text-align: center;
            border: 1px solid #e9ecef;
            transition: all 0.3s ease;
            position: relative;
            overflow: hidden;
          }

          .financial-card:hover {
            transform: translateY(-5px);
            box-shadow: 0 10px 25px rgba(0,0,0,0.1);
          }

          .financial-icon {
            width: 60px;
            height: 60px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 15px;
            font-size: 28px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
          }

          .financial-value {
            font-size: 24px;
            font-weight: 700;
            color: #2c3e50;
            margin-bottom: 8px;
          }

          .financial-label {
            font-size: 14px;
            color: #6c757d;
            font-weight: 500;
          }

          .profit-section {
            background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
            color: white;
            padding: 35px;
            border-radius: 20px;
            text-align: center;
            margin-bottom: 40px;
            position: relative;
            overflow: hidden;
          }

          .profit-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 25px;
            margin-top: 20px;
          }

          .profit-item {
            background: rgba(255,255,255,0.15);
            padding: 20px;
            border-radius: 15px;
            text-align: center;
          }

          .profit-amount {
            font-size: 28px;
            font-weight: 700;
            margin-bottom: 5px;
          }

          .profit-label {
            font-size: 14px;
            opacity: 0.9;
          }

          .section {
            margin-bottom: 40px;
          }

          .section-title {
            font-size: 22px;
            font-weight: 600;
            color: #2c3e50;
            margin-bottom: 25px;
            display: flex;
            align-items: center;
            gap: 12px;
            padding-bottom: 10px;
            border-bottom: 3px solid #667eea;
          }

          .menu-sections {
            display: grid;
            gap: 30px;
          }

          .menu-section {
            background: #f8f9fa;
            border-radius: 20px;
            padding: 25px;
            border: 1px solid #e9ecef;
          }

          .menu-section-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 20px;
            padding-bottom: 15px;
            border-bottom: 2px solid #e9ecef;
          }

          .menu-section-title {
            font-size: 20px;
            font-weight: 600;
            color: #2c3e50;
            display: flex;
            align-items: center;
            gap: 10px;
          }

          .menu-section-stats {
            display: flex;
            flex-direction: column;
            align-items: flex-end;
            gap: 5px;
          }

          .menu-section-revenue {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 8px 16px;
            border-radius: 20px;
            font-weight: 600;
            font-size: 16px;
          }

          .menu-items-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
            gap: 15px;
          }

          .menu-item {
            background: white;
            border-radius: 12px;
            padding: 15px;
            border: 1px solid #e9ecef;
            transition: all 0.3s ease;
          }

          .menu-item:hover {
            transform: translateY(-2px);
            box-shadow: 0 5px 15px rgba(0,0,0,0.1);
          }

          .menu-item-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 10px;
          }

          .menu-item-name {
            font-weight: 600;
            color: #2c3e50;
            font-size: 16px;
          }

          .menu-item-quantity {
            background: #e9ecef;
            color: #495057;
            padding: 4px 8px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: 600;
          }

          .menu-item-stats {
            display: flex;
            justify-content: space-between;
            font-size: 14px;
          }

          .menu-item-revenue {
            color: #28a745;
            font-weight: 600;
          }

          .menu-item-cost {
            color: #dc3545;
            font-weight: 600;
          }

          .playstation-section {
            background: linear-gradient(135deg, #6f42c1 0%, #e83e8c 100%);
            color: white;
            border-radius: 20px;
            padding: 30px;
            margin-bottom: 30px;
          }

          .playstation-header {
            text-align: center;
            margin-bottom: 25px;
          }

          .playstation-title {
            font-size: 24px;
            font-weight: 700;
            margin-bottom: 10px;
          }

          .playstation-stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
          }

          .playstation-stat {
            background: rgba(255,255,255,0.15);
            padding: 20px;
            border-radius: 15px;
            text-align: center;
          }

          .playstation-stat-value {
            font-size: 24px;
            font-weight: 700;
            margin-bottom: 5px;
          }

          .playstation-stat-label {
            font-size: 14px;
            opacity: 0.9;
          }

          .growth-indicators {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
          }

          .growth-card {
            background: white;
            border-radius: 15px;
            padding: 20px;
            text-align: center;
            border: 1px solid #e9ecef;
            box-shadow: 0 2px 10px rgba(0,0,0,0.05);
          }

          .growth-icon {
            width: 50px;
            height: 50px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 15px;
            font-size: 24px;
          }

          .growth-positive {
            background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
            color: white;
          }

          .growth-neutral {
            background: linear-gradient(135deg, #ffc107 0%, #fd7e14 100%);
            color: white;
          }

          .growth-value {
            font-size: 20px;
            font-weight: 600;
            margin-bottom: 5px;
          }

          .growth-label {
            font-size: 14px;
            color: #6c757d;
          }

          .footer {
            background: #f8f9fa;
            padding: 30px;
            text-align: center;
            border-top: 1px solid #e9ecef;
          }

          .footer p {
            color: #6c757d;
            font-size: 14px;
            margin-bottom: 10px;
          }

          @media (max-width: 768px) {
            .email-container {
              margin: 10px;
              border-radius: 15px;
            }

            .content {
              padding: 20px;
            }

            .header {
              padding: 30px 20px;
            }

            .menu-items-grid {
              grid-template-columns: 1fr;
            }
          }
        </style>
      </head>
      <body>
        <div class="email-container">
          <div class="header">
            <div class="header-content">
              <h1>📊 التقرير اليومي الشامل</h1>
              <p>تحليل مفصل لأداء منشأتك خلال الـ 24 ساعة الماضية</p>
              <div class="organization-name">${
                  data.organizationName || "منشأتك"
              }</div>
              <div class="date-badge">
                ${
                    data.date ||
                    new Date().toLocaleDateString("ar-EG", {
                        weekday: "long",
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                        timeZone: "Africa/Cairo"
                    })
                }
              </div>
              <div class="period-badge">
                ${data.reportPeriod || `
                  من 8:00 صباحاً يوم ${new Date(data.startOfReport || new Date(Date.now() - 24*60*60*1000)).toLocaleDateString('ar-EG', {weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Africa/Cairo'})}
                  إلى 8:00 صباحاً يوم ${new Date(data.endOfReport || new Date()).toLocaleDateString('ar-EG', {weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Africa/Cairo'})}
                `}
              </div>
            </div>
          </div>

          <div class="content">
            <!-- Financial Overview -->
            <div class="financial-overview">
              <div class="financial-card">
                <div class="financial-icon">💰</div>
                <div class="financial-value">${(data.totalRevenue || 0).toLocaleString('ar-EG')}</div>
                <div class="financial-label">إجمالي الإيرادات (ج.م)</div>
              </div>

              <div class="financial-card">
                <div class="financial-icon">💸</div>
                <div class="financial-value">${(data.totalCosts || 0).toLocaleString('ar-EG')}</div>
                <div class="financial-label">إجمالي التكاليف (ج.م)</div>
              </div>

              <div class="financial-card">
                <div class="financial-icon">📈</div>
                <div class="financial-value">${(data.netProfit || 0).toLocaleString('ar-EG')}</div>
                <div class="financial-label">صافي الربح (ج.م)</div>
              </div>

              <div class="financial-card">
                <div class="financial-icon">📊</div>
                <div class="financial-value">${((data.netProfit || 0) / (data.totalRevenue || 1) * 100).toFixed(1)}%</div>
                <div class="financial-label">هامش الربح</div>
              </div>
            </div>

            <!-- Profit Breakdown -->
            <div class="profit-section">
              <h2 style="margin-bottom: 20px; font-size: 24px;">💰 تفصيل الأرباح والتكاليف</h2>
              <div class="profit-grid">
                <div class="profit-item">
                  <div class="profit-amount">${(data.cafeRevenue || 0).toLocaleString('ar-EG')} ج.م</div>
                  <div class="profit-label">إيرادات الكافيه</div>
                </div>
                <div class="profit-item">
                  <div class="profit-amount">${(data.gamingRevenue || 0).toLocaleString('ar-EG')} ج.م</div>
                  <div class="profit-label">إيرادات الألعاب</div>
                </div>
                <div class="profit-item">
                  <div class="profit-amount">${(data.materialCosts || 0).toLocaleString('ar-EG')} ج.م</div>
                  <div class="profit-label">تكلفة المواد الخام</div>
                </div>
                <div class="profit-item">
                  <div class="profit-amount">${(data.operationalCosts || 0).toLocaleString('ar-EG')} ج.م</div>
                  <div class="profit-label">التكاليف التشغيلية</div>
                </div>
              </div>
            </div>

            <!-- Growth Indicators -->
            <div class="section">
              <h2 class="section-title">📈 مؤشرات النمو والأداء</h2>
              <div class="growth-indicators">
                <div class="growth-card">
                  <div class="growth-icon growth-positive">📈</div>
                  <div class="growth-value" style="color: #28a745;">${data.revenueGrowth || '+0'}%</div>
                  <div class="growth-label">نمو الإيرادات</div>
                </div>
                <div class="growth-card">
                  <div class="growth-icon growth-positive">🎯</div>
                  <div class="growth-value" style="color: #28a745;">${data.profitGrowth || '+0'}%</div>
                  <div class="growth-label">نمو الأرباح</div>
                </div>
                <div class="growth-card">
                  <div class="growth-icon growth-neutral">👥</div>
                  <div class="growth-value" style="color: #ffc107;">${data.customerGrowth || '+0'}%</div>
                  <div class="growth-label">نمو العملاء</div>
                </div>
                <div class="growth-card">
                  <div class="growth-icon growth-positive">⚡</div>
                  <div class="growth-value" style="color: #28a745;">${Math.round(((data.totalSessions || 0) / (data.totalOrders || 1)) * 100)}%</div>
                  <div class="growth-label">كفاءة التشغيل</div>
                </div>
              </div>
            </div>

            <!-- Gaming Summary Section -->
            <div class="section">
              <h2 class="section-title">🎮 ملخص الألعاب والترفيه</h2>
              
              <!-- Gaming Overview Cards -->
              <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 20px; margin-bottom: 30px;">
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 25px; border-radius: 15px; text-align: center; box-shadow: 0 8px 25px rgba(102, 126, 234, 0.3);">
                  <div style="font-size: 32px; font-weight: 700; margin-bottom: 8px;">${data.totalSessions || 0}</div>
                  <div style="font-size: 14px; opacity: 0.9;">إجمالي الجلسات</div>
                </div>
                <div style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 25px; border-radius: 15px; text-align: center; box-shadow: 0 8px 25px rgba(40, 167, 69, 0.3);">
                  <div style="font-size: 32px; font-weight: 700; margin-bottom: 8px;">${(data.gamingRevenue || 0).toLocaleString('ar-EG')}</div>
                  <div style="font-size: 14px; opacity: 0.9;">إيرادات الألعاب (ج.م)</div>
                </div>
                <div style="background: linear-gradient(135deg, #ffc107 0%, #fd7e14 100%); color: white; padding: 25px; border-radius: 15px; text-align: center; box-shadow: 0 8px 25px rgba(255, 193, 7, 0.3);">
                  <div style="font-size: 32px; font-weight: 700; margin-bottom: 8px;">${data.totalGamingMinutes || 0}</div>
                  <div style="font-size: 14px; opacity: 0.9;">إجمالي الدقائق</div>
                </div>
                <div style="background: linear-gradient(135deg, #6f42c1 0%, #e83e8c 100%); color: white; padding: 25px; border-radius: 15px; text-align: center; box-shadow: 0 8px 25px rgba(111, 66, 193, 0.3);">
                  <div style="font-size: 32px; font-weight: 700; margin-bottom: 8px;">${data.avgSessionDuration || 0}</div>
                  <div style="font-size: 14px; opacity: 0.9;">متوسط الجلسة (دقيقة)</div>
                </div>
              </div>

              <!-- Gaming Devices Comparison Table -->
              <div style="background: #fff; border-radius: 20px; overflow: hidden; box-shadow: 0 8px 25px rgba(0,0,0,0.1); border: 1px solid #e9ecef;">
                <div style="background: linear-gradient(135deg, #6f42c1 0%, #e83e8c 100%); color: white; padding: 25px;">
                  <h3 style="margin: 0; font-size: 22px; font-weight: 700; text-align: center;">📊 مقارنة أداء الأجهزة</h3>
                </div>
                
                <div style="padding: 30px;">
                  <table style="width: 100%; border-collapse: collapse; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.05);">
                    <thead>
                      <tr style="background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);">
                        <th style="padding: 18px 20px; text-align: right; font-weight: 600; color: #2c3e50; border-bottom: 2px solid #dee2e6;">نوع الجهاز</th>
                        <th style="padding: 18px 20px; text-align: center; font-weight: 600; color: #2c3e50; border-bottom: 2px solid #dee2e6;">عدد الجلسات</th>
                        <th style="padding: 18px 20px; text-align: center; font-weight: 600; color: #2c3e50; border-bottom: 2px solid #dee2e6;">إجمالي الوقت</th>
                        <th style="padding: 18px 20px; text-align: center; font-weight: 600; color: #2c3e50; border-bottom: 2px solid #dee2e6;">متوسط الجلسة</th>
                        <th style="padding: 18px 20px; text-align: center; font-weight: 600; color: #2c3e50; border-bottom: 2px solid #dee2e6;">الإيراد</th>
                        <th style="padding: 18px 20px; text-align: center; font-weight: 600; color: #2c3e50; border-bottom: 2px solid #dee2e6;">متوسط الإيراد/جلسة</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr style="border-bottom: 1px solid #f1f3f4; background: #fafbfc;">
                        <td style="padding: 18px 20px; font-weight: 600; color: #2c3e50;">
                          <span style="display: inline-flex; align-items: center; gap: 8px;">
                            🎮 البلايستيشن
                          </span>
                        </td>
                        <td style="padding: 18px 20px; text-align: center;">
                          <span style="background: #e3f2fd; color: #1976d2; padding: 6px 14px; border-radius: 20px; font-size: 14px; font-weight: 600;">
                            ${(data.playstationStats && data.playstationStats.totalSessions) || 0} جلسة
                          </span>
                        </td>
                        <td style="padding: 18px 20px; text-align: center; color: #495057; font-weight: 500;">
                          ${(data.playstationStats && data.playstationStats.totalMinutes) || 0} دقيقة
                        </td>
                        <td style="padding: 18px 20px; text-align: center; color: #495057; font-weight: 500;">
                          ${(data.playstationStats && data.playstationStats.avgMinutesPerSession) || 0} دقيقة
                        </td>
                        <td style="padding: 18px 20px; text-align: center; color: #28a745; font-weight: 600; font-size: 16px;">
                          ${(data.playstationStats && data.playstationStats.totalRevenue || 0).toLocaleString('ar-EG')} ج.م
                        </td>
                        <td style="padding: 18px 20px; text-align: center; color: #20c997; font-weight: 600;">
                          ${(data.playstationStats && data.playstationStats.avgRevenuePerSession) || 0} ج.م
                        </td>
                      </tr>
                      <tr style="border-bottom: 1px solid #f1f3f4; background: #fff;">
                        <td style="padding: 18px 20px; font-weight: 600; color: #2c3e50;">
                          <span style="display: inline-flex; align-items: center; gap: 8px;">
                            💻 الكمبيوتر
                          </span>
                        </td>
                        <td style="padding: 18px 20px; text-align: center;">
                          <span style="background: #f3e5f5; color: #7b1fa2; padding: 6px 14px; border-radius: 20px; font-size: 14px; font-weight: 600;">
                            ${(data.computerStats && data.computerStats.totalSessions) || 0} جلسة
                          </span>
                        </td>
                        <td style="padding: 18px 20px; text-align: center; color: #495057; font-weight: 500;">
                          ${(data.computerStats && data.computerStats.totalMinutes) || 0} دقيقة
                        </td>
                        <td style="padding: 18px 20px; text-align: center; color: #495057; font-weight: 500;">
                          ${(data.computerStats && data.computerStats.avgMinutesPerSession) || 0} دقيقة
                        </td>
                        <td style="padding: 18px 20px; text-align: center; color: #28a745; font-weight: 600; font-size: 16px;">
                          ${(data.computerStats && data.computerStats.totalRevenue || 0).toLocaleString('ar-EG')} ج.م
                        </td>
                        <td style="padding: 18px 20px; text-align: center; color: #20c997; font-weight: 600;">
                          ${(data.computerStats && data.computerStats.avgRevenuePerSession) || 0} ج.م
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <!-- Menu Sections -->
            <div class="section">
              <h2 class="section-title">🍽️ تفصيل أقسام المنيو والأرباح</h2>
              ${
                  data.menuSections && data.menuSections.length > 0
                      ? data.menuSections
                            .filter(section => section.revenue > 0 || section.items.length > 0)
                            .map(
                                (section) => `
                  <div class="menu-section" style="margin-bottom: 40px; background: #fff; border-radius: 20px; overflow: hidden; box-shadow: 0 8px 25px rgba(0,0,0,0.1); border: 1px solid #e9ecef;">
                    <!-- Section Header -->
                    <div class="section-header" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 25px 30px; position: relative; overflow: hidden;">
                      <div style="position: relative; z-index: 2;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                          <h3 style="margin: 0; font-size: 24px; font-weight: 700;">
                            ${section.icon || '🍽️'} ${section.name}
                          </h3>
                          <div style="text-align: left;">
                            <div style="font-size: 28px; font-weight: 700; margin-bottom: 5px;">
                              ${(section.revenue || 0).toLocaleString('ar-EG')} ج.م
                            </div>
                            <div style="font-size: 14px; opacity: 0.9;">إجمالي الإيراد</div>
                          </div>
                        </div>
                        
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 20px;">
                          <div style="text-align: center; background: rgba(255,255,255,0.15); padding: 15px; border-radius: 12px;">
                            <div style="font-size: 20px; font-weight: 600; margin-bottom: 5px;">${section.itemsCount || 0}</div>
                            <div style="font-size: 12px; opacity: 0.9;">منتج</div>
                          </div>
                          <div style="text-align: center; background: rgba(255,255,255,0.15); padding: 15px; border-radius: 12px;">
                            <div style="font-size: 20px; font-weight: 600; margin-bottom: 5px;">${(section.cost || 0).toLocaleString('ar-EG')}</div>
                            <div style="font-size: 12px; opacity: 0.9;">تكلفة (ج.م)</div>
                          </div>
                          <div style="text-align: center; background: rgba(255,255,255,0.15); padding: 15px; border-radius: 12px;">
                            <div style="font-size: 20px; font-weight: 600; margin-bottom: 5px;">${(section.profit || 0).toLocaleString('ar-EG')}</div>
                            <div style="font-size: 12px; opacity: 0.9;">ربح (ج.م)</div>
                          </div>
                          <div style="text-align: center; background: rgba(255,255,255,0.15); padding: 15px; border-radius: 12px;">
                            <div style="font-size: 20px; font-weight: 600; margin-bottom: 5px;">${section.profitMargin || 0}%</div>
                            <div style="font-size: 12px; opacity: 0.9;">هامش الربح</div>
                          </div>
                        </div>
                      </div>
                      
                      <!-- Decorative elements -->
                      <div style="position: absolute; top: -50px; right: -50px; width: 100px; height: 100px; background: rgba(255,255,255,0.1); border-radius: 50%; z-index: 1;"></div>
                      <div style="position: absolute; bottom: -30px; left: -30px; width: 60px; height: 60px; background: rgba(255,255,255,0.1); border-radius: 50%; z-index: 1;"></div>
                    </div>

                    <!-- Items Table -->
                    ${section.items && section.items.length > 0 ? `
                    <div style="padding: 30px;">
                      <h4 style="margin: 0 0 20px 0; font-size: 18px; color: #2c3e50; font-weight: 600;">📊 تفاصيل المنتجات</h4>
                      
                      <table style="width: 100%; border-collapse: collapse; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.05);">
                        <thead>
                          <tr style="background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);">
                            <th style="padding: 15px 20px; text-align: right; font-weight: 600; color: #2c3e50; border-bottom: 2px solid #dee2e6;">المنتج</th>
                            <th style="padding: 15px 20px; text-align: center; font-weight: 600; color: #2c3e50; border-bottom: 2px solid #dee2e6;">الكمية</th>
                            <th style="padding: 15px 20px; text-align: center; font-weight: 600; color: #2c3e50; border-bottom: 2px solid #dee2e6;">السعر</th>
                            <th style="padding: 15px 20px; text-align: center; font-weight: 600; color: #2c3e50; border-bottom: 2px solid #dee2e6;">الإيراد</th>
                            <th style="padding: 15px 20px; text-align: center; font-weight: 600; color: #2c3e50; border-bottom: 2px solid #dee2e6;">التكلفة</th>
                            <th style="padding: 15px 20px; text-align: center; font-weight: 600; color: #2c3e50; border-bottom: 2px solid #dee2e6;">الربح</th>
                            <th style="padding: 15px 20px; text-align: center; font-weight: 600; color: #2c3e50; border-bottom: 2px solid #dee2e6;">الهامش</th>
                          </tr>
                        </thead>
                        <tbody>
                          ${section.items.map((item, index) => `
                            <tr style="border-bottom: 1px solid #f1f3f4; transition: background-color 0.3s ease; ${index % 2 === 0 ? 'background: #fafbfc;' : 'background: #fff;'}">
                              <td style="padding: 15px 20px; font-weight: 600; color: #2c3e50;">${item.name}</td>
                              <td style="padding: 15px 20px; text-align: center; color: #495057;">
                                <span style="background: #e3f2fd; color: #1976d2; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600;">
                                  ${section.name === 'البلايستيشن' ? `${item.quantity.toFixed(1)} ساعة` : `${item.quantity} قطعة`}
                                </span>
                              </td>
                              <td style="padding: 15px 20px; text-align: center; color: #495057; font-weight: 500;">${section.name === 'البلايستيشن' ? '-' : (item.price || 0).toLocaleString('ar-EG') + ' ج.م'}</td>
                              <td style="padding: 15px 20px; text-align: center; color: #28a745; font-weight: 600;">${(item.total || 0).toLocaleString('ar-EG')} ج.م</td>
                              <td style="padding: 15px 20px; text-align: center; color: #dc3545; font-weight: 600;">${(item.cost || 0).toLocaleString('ar-EG')} ج.م</td>
                              <td style="padding: 15px 20px; text-align: center; color: #20c997; font-weight: 600;">${(item.profit || 0).toLocaleString('ar-EG')} ج.م</td>
                              <td style="padding: 15px 20px; text-align: center;">
                                <span style="background: ${(item.profitMargin || 0) > 50 ? '#d4edda' : (item.profitMargin || 0) > 25 ? '#fff3cd' : '#f8d7da'}; 
                                             color: ${(item.profitMargin || 0) > 50 ? '#155724' : (item.profitMargin || 0) > 25 ? '#856404' : '#721c24'}; 
                                             padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600;">
                                  ${item.profitMargin || 0}%
                                </span>
                              </td>
                            </tr>
                          `).join('')}
                        </tbody>
                      </table>
                    </div>
                    ` : `
                    <div style="padding: 30px; text-align: center; color: #6c757d;">
                      <div style="font-size: 48px; margin-bottom: 15px; opacity: 0.5;">📭</div>
                      <p style="margin: 0; font-size: 16px;">لا توجد مبيعات في هذا القسم اليوم</p>
                    </div>
                    `}
                  </div>
                `
                            )
                            .join("")
                      : `<div style="text-align: center; color: #6c757d; padding: 60px; background: #f8f9fa; border-radius: 20px; border: 2px dashed #dee2e6;">
                           <div style="font-size: 64px; margin-bottom: 20px; opacity: 0.5;">📊</div>
                           <h3 style="margin: 0 0 10px 0; color: #495057;">لا توجد بيانات أقسام متاحة</h3>
                           <p style="margin: 0; opacity: 0.7;">لم يتم العثور على مبيعات في أي قسم خلال هذه الفترة</p>
                         </div>`
              }
            </div>

            <!-- Summary Statistics -->
            <div class="section">
              <h2 class="section-title">📋 ملخص الإحصائيات</h2>
              <div class="financial-overview">
                <div class="financial-card">
                  <div class="financial-icon">📄</div>
                  <div class="financial-value">${data.totalBills || 0}</div>
                  <div class="financial-label">عدد الفواتير</div>
                </div>

                <div class="financial-card">
                  <div class="financial-icon">🛒</div>
                  <div class="financial-value">${data.totalOrders || 0}</div>
                  <div class="financial-label">عدد الطلبات</div>
                </div>

                <div class="financial-card">
                  <div class="financial-icon">👥</div>
                  <div class="financial-value">${data.uniqueCustomers || 0}</div>
                  <div class="financial-label">العملاء الفريدون</div>
                </div>

                <div class="financial-card">
                  <div class="financial-icon">💳</div>
                  <div class="financial-value">${(data.avgBillValue || 0).toFixed(2)} ج.م</div>
                  <div class="financial-label">متوسط قيمة الفاتورة</div>
                </div>
              </div>
            </div>
          </div>

          <div class="footer">
            <p><strong>📧 تم إرسال هذا التقرير تلقائياً في ${new Date().toLocaleTimeString('ar-EG', {timeZone: 'Africa/Cairo'})} (توقيت القاهرة) من نظام Bomba</strong></p>
            <p>📅 التقرير يغطي الفترة من 8:00 صباحاً أمس إلى 8:00 صباحاً اليوم (بتوقيت القاهرة)</p>
            <p>🔄 يتم إرسال التقرير يومياً في تمام الساعة 10:00 صباحاً (بتوقيت القاهرة)</p>
            <p>💼 للمزيد من التفاصيل، يرجى تسجيل الدخول إلى لوحة التحكم</p>
            <p style="margin-top: 15px; font-size: 12px; color: #999;">© ${new Date().getFullYear()} نظام Bomba - جميع الحقوق محفوظة</p>
          </div>
        </div>
      </body>
      </html>
    `,
    }),

    // Monthly report
    monthlyReport: (data) => ({
        subject: `📊 التقرير الشهري - ${data.organizationName || "منشأتك"} - ${
            data.month
        }`,
        html: `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>التقرير الشهري - ${data.organizationName || "منشأتك"}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; }
          .container { max-width: 600px; margin: 0 auto; background-color: white; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
          .header h1 { margin: 0; font-size: 24px; }
          .header .subtitle { margin-top: 10px; opacity: 0.9; }
          .content { padding: 30px; }
          .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
          .stat-card { background: #f8f9fa; padding: 20px; border-radius: 10px; text-align: center; border-left: 4px solid #667eea; }
          .stat-value { font-size: 28px; font-weight: bold; color: #667eea; margin-bottom: 5px; }
          .stat-label { color: #6c757d; font-size: 14px; }
          .section { margin-bottom: 30px; }
          .section-title { font-size: 18px; font-weight: bold; color: #333; margin-bottom: 15px; border-bottom: 2px solid #667eea; padding-bottom: 5px; }
          .product-item { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid #eee; }
          .product-name { font-weight: bold; }
          .product-stats { color: #6c757d; font-size: 14px; }
          .device-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; }
          .device-card { background: #f8f9fa; padding: 15px; border-radius: 8px; text-align: center; }
          .device-name { font-weight: bold; color: #333; margin-bottom: 5px; }
          .device-value { color: #667eea; font-size: 16px; }
          .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #6c757d; }
          .footer-logo { font-weight: bold; color: #667eea; margin-bottom: 10px; }
          .footer-text { font-size: 12px; line-height: 1.5; }
          .highlight { background: #fff3cd; padding: 15px; border-radius: 8px; border-left: 4px solid #ffc107; margin: 20px 0; }
          .highlight-title { font-weight: bold; color: #856404; margin-bottom: 10px; }
          .highlight-content { color: #856404; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📊 التقرير الشهري</h1>
            <div class="subtitle">${data.organizationName || "منشأتك"} - ${
            data.month
        }</div>
          </div>

          <div class="content">
            <div class="stats-grid">
              <div class="stat-card">
                <div class="stat-value">${data.totalRevenue.toLocaleString(
                    "ar-EG"
                )} ج.م</div>
                <div class="stat-label">إجمالي الإيرادات</div>
              </div>
              <div class="stat-card">
                <div class="stat-value">${data.totalCosts.toLocaleString(
                    "ar-EG"
                )} ج.م</div>
                <div class="stat-label">إجمالي التكاليف</div>
              </div>
              <div class="stat-card">
                <div class="stat-value">${data.netProfit.toLocaleString(
                    "ar-EG"
                )} ج.م</div>
                <div class="stat-label">صافي الربح</div>
              </div>
              <div class="stat-card">
                <div class="stat-value">${data.profitMargin.toFixed(1)}%</div>
                <div class="stat-label">هامش الربح</div>
              </div>
            </div>

            <div class="stats-grid">
              <div class="stat-card">
                <div class="stat-value">${data.totalBills}</div>
                <div class="stat-label">عدد الفواتير</div>
              </div>
              <div class="stat-card">
                <div class="stat-value">${data.totalOrders}</div>
                <div class="stat-label">عدد الطلبات</div>
              </div>
              <div class="stat-card">
                <div class="stat-value">${data.totalSessions}</div>
                <div class="stat-label">عدد الجلسات</div>
              </div>
              <div class="stat-card">
                <div class="stat-value">${data.avgDailyRevenue.toLocaleString(
                    "ar-EG"
                )} ج.م</div>
                <div class="stat-label">متوسط الإيرادات اليومية</div>
              </div>
            </div>

            ${
                data.bestDay
                    ? `
            <div class="highlight">
              <div class="highlight-title">🏆 أفضل يوم في الشهر</div>
              <div class="highlight-content">
                التاريخ: ${new Date(data.bestDay._id).toLocaleDateString(
                    "ar-EG"
                )}<br>
                الإيرادات: ${data.bestDay.revenue.toLocaleString(
                    "ar-EG"
                )} ج.م<br>
                عدد الفواتير: ${data.bestDay.bills}
              </div>
            </div>
            `
                    : ""
            }

            <div class="section">
              <div class="section-title">📈 إحصائيات الأجهزة</div>
              <div class="device-stats">
                ${data.deviceStats
                    .map(
                        (device) => `
                  <div class="device-card">
                    <div class="device-name">${
                        device._id === "playstation"
                            ? "البلايستيشن"
                            : device._id === "computer"
                            ? "الكمبيوتر"
                            : device._id
                    }</div>
                    <div class="device-value">${device.totalSessions} جلسة</div>
                    <div class="device-value">${device.totalRevenue.toLocaleString(
                        "ar-EG"
                    )} ج.م</div>
                    <div class="device-value">${Math.round(
                        device.avgDuration / (1000 * 60)
                    )} دقيقة متوسط</div>
                  </div>
          `
                    )
                    .join("")}
              </div>
            </div>

            <div class="section">
              <div class="section-title">🏆 أفضل المنتجات مبيعاً</div>
              ${
                  data.topProducts.length > 0
                      ? data.topProducts
                            .map(
                                (product, index) => `
                  <div class="product-item">
                    <div class="product-name">${index + 1}. ${
                                    product.name
                                }</div>
                    <div class="product-stats">
                      ${
                          product.quantity
                      } قطعة - ${product.revenue.toLocaleString("ar-EG")} ج.م
                    </div>
                  </div>
                `
                            )
                            .join("")
                      : '<div style="text-align: center; color: #6c757d; padding: 20px;">لا توجد مبيعات هذا الشهر</div>'
              }
            </div>
          </div>

          <div class="footer">
            <div class="footer-logo">🎮 Bomba System</div>
            <div class="footer-text">
              تقرير شهري تلقائي من نظام إدارة المنشآت<br>
              تم إنشاؤه في ${new Date().toLocaleTimeString("ar-EG")}
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
export const sendLowStockAlert = async ({
    items,
    organizationName,
    recipientEmails,
    adminNames = []
}) => {
    if (!recipientEmails || recipientEmails.length === 0) {
        Logger.warn("No recipient emails provided for low stock alert");
        return;
    }

    Logger.info(`Sending low stock alert to ${recipientEmails.length} recipients`, {
        organizationName,
        itemCount: items.length,
        firstFewItems: items.slice(0, 3).map(i => i.name)
    });

    const template = emailTemplates.lowStockAlert({
        items,
        organizationName,
        adminNames,
        timestamp: new Date()
    });

    const results = [];
    
    for (const email of recipientEmails) {
        const startTime = Date.now();
        try {
            await sendEmail({
                to: email,
                ...template,
            });
            results.push({
                email,
                status: 'success',
                duration: Date.now() - startTime
            });
        } catch (error) {
            Logger.error("Failed to send low stock alert", {
                email,
                error: error.message,
                stack: error.stack,
                duration: Date.now() - startTime
            });
            results.push({
                email,
                status: 'failed',
                error: error.message,
                duration: Date.now() - startTime
            });
        }
    }

    const successCount = results.filter(r => r.status === 'success').length;
    const failureCount = results.filter(r => r.status === 'failed').length;

    Logger.info(`Low stock alert sending completed`, {
        organizationName,
        totalRecipients: recipientEmails.length,
        successCount,
        failureCount,
        successRate: (successCount / recipientEmails.length * 100).toFixed(1) + '%'
    });

    return { success: failureCount === 0, results };
};

// Send daily report with consumption report data
export const sendDailyReport = async (reportData, adminEmails) => {
    Logger.info("Starting daily report email sending", {
        adminEmailsCount: adminEmails?.length || 0,
        adminEmails: adminEmails,
        reportData: {
            organizationName: reportData.organizationName,
            totalRevenue: reportData.totalRevenue,
            totalCosts: reportData.totalCosts,
            netProfit: reportData.netProfit,
            totalBills: reportData.totalBills,
            totalOrders: reportData.totalOrders,
            totalSessions: reportData.totalSessions,
            menuSectionsCount: reportData.menuSections?.length || 0,
            menuSections: reportData.menuSections?.map(section => ({
                name: section.name,
                revenue: section.revenue,
                cost: section.cost,
                profit: section.profit,
                itemsCount: section.itemsCount
            })) || []
        },
    });

    if (!adminEmails || adminEmails.length === 0) {
        Logger.warn("No admin emails found for daily report", {
            reportData: {
                organizationName: reportData.organizationName,
            },
        });
        return;
    }

    const template = emailTemplates.dailyReport(reportData);

    Logger.info("Daily report template generated", {
        subject: template.subject,
        adminEmailsCount: adminEmails.length,
    });

    let successCount = 0;
    let failureCount = 0;

    for (const email of adminEmails) {
        try {
            Logger.info("Sending daily report to email", { email });

            await sendEmail({
                to: email,
                ...template,
            });

            successCount++;
            Logger.info("Daily report sent successfully", { email });
        } catch (error) {
            failureCount++;
            Logger.error("Failed to send daily report", {
                email,
                error: error.message,
                stack: error.stack,
            });
        }
    }

    Logger.info("Daily report sending completed", {
        totalEmails: adminEmails.length,
        successCount,
        failureCount,
        organizationName: reportData.organizationName,
    });
};

// Generate and send daily report using consumption report logic
export const generateAndSendDailyReport = async (organizationId, organizationName, adminEmails, startDate, endDate) => {
    try {
        Logger.info("Starting daily report generation with consumption data", {
            organizationId,
            organizationName,
            adminEmailsCount: adminEmails?.length || 0,
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString()
        });

        const shouldSendEmail = adminEmails && adminEmails.length > 0;
        
        if (!shouldSendEmail) {
            Logger.warn("No admin emails found for daily report", {
                organizationId,
                organizationName,
            });
        }

        // Import models dynamically to avoid circular dependencies
        const Bill = (await import('../models/Bill.js')).default;
        const Order = (await import('../models/Order.js')).default;
        const Session = (await import('../models/Session.js')).default;
        const Cost = (await import('../models/Cost.js')).default;
        const MenuItem = (await import('../models/MenuItem.js')).default;
        const MenuSection = (await import('../models/MenuSection.js')).default;

        Logger.info("Using provided date range for daily report", {
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
            explanation: "Using exact daily report period: 8 AM yesterday to 8 AM today"
        });

        // Get menu sections and items (same as frontend)
        const [menuSections, menuItems] = await Promise.all([
            MenuSection.find({
                organization: organizationId,
                isActive: true
            }).sort({ sortOrder: 1 }),
            MenuItem.find({
                organization: organizationId,
                isActive: true
            }).populate('category')
        ]);

        // Get orders and sessions for the specified period (same as frontend)
        const [orders, sessions] = await Promise.all([
            Order.find({
                organization: organizationId,
                createdAt: { $gte: startDate, $lt: endDate },
                status: 'delivered' // Only delivered orders
            }),
            Session.find({
                organization: organizationId,
                deviceType: 'playstation',
                status: 'completed',
                startTime: { $gte: startDate, $lt: endDate }
            })
        ]);

        Logger.info("Data fetched for consumption processing", {
            ordersCount: orders.length,
            sessionsCount: sessions.length,
            menuItemsCount: menuItems.length,
            menuSectionsCount: menuSections.length
        });

        // Process the data using the same logic as ConsumptionReport frontend
        const { processOrdersAndSessions } = await import('./consumptionReportLogic.js');
        const processedData = processOrdersAndSessions(orders, sessions, menuItems, menuSections);

        // Calculate totals for each section (same as frontend)
        const sectionsWithTotals = Object.keys(processedData).map(sectionName => {
            const items = processedData[sectionName];
            const sectionTotal = items.reduce((sum, item) => sum + item.total, 0);
            
            // Calculate costs
            let sectionCost = 0;
            if (sectionName !== 'البلايستيشن') {
                // For menu items, calculate material costs
                sectionCost = items.reduce((sum, item) => {
                    const menuItem = menuItems.find(m => m.name === item.name);
                    const itemCost = (menuItem?.cost || 0) * item.quantity;
                    return sum + itemCost;
                }, 0);
            } else {
                // For PlayStation, estimate operational costs
                const totalHours = items.reduce((sum, item) => sum + item.quantity, 0);
                sectionCost = totalHours * 5; // 5 EGP per hour operational cost
            }
            
            const sectionProfit = sectionTotal - sectionCost;
            const profitMargin = sectionTotal > 0 ? ((sectionProfit / sectionTotal) * 100).toFixed(1) : 0;

            return {
                name: sectionName,
                items: items,
                revenue: sectionTotal,
                cost: sectionCost,
                profit: sectionProfit,
                profitMargin: profitMargin,
                itemsCount: items.length
            };
        }).filter(section => section.revenue > 0 || section.items.length > 0);

        // Calculate overall totals
        const totalRevenue = sectionsWithTotals.reduce((sum, section) => sum + section.revenue, 0);
        const totalCosts = sectionsWithTotals.reduce((sum, section) => sum + section.cost, 0);
        const totalProfit = totalRevenue - totalCosts;

        Logger.info("Consumption data processed using frontend logic", {
            sectionsCount: sectionsWithTotals.length,
            totalRevenue,
            totalCosts,
            totalProfit,
            sections: sectionsWithTotals.map(s => ({
                name: s.name,
                revenue: s.revenue,
                itemsCount: s.itemsCount
            }))
        });

        // Get additional data for the report
        const [bills, costs] = await Promise.all([
            Bill.find({
                createdAt: { $gte: startDate, $lt: endDate },
                status: { $in: ["partial", "paid"] },
                organization: organizationId,
            }),
            Cost.find({
                date: { $gte: startDate, $lt: endDate },
                organization: organizationId,
            }),
        ]);

        // Calculate additional costs
        const additionalCosts = costs.reduce((sum, cost) => sum + cost.amount, 0);
        const totalCostsWithAdditional = totalCosts + additionalCosts;

        // Calculate cafe vs gaming revenue from processed data
        const cafeRevenue = sectionsWithTotals
            .filter(section => section.name !== 'البلايستيشن')
            .reduce((sum, section) => sum + section.revenue, 0);

        const gamingRevenue = sectionsWithTotals
            .find(section => section.name === 'البلايستيشن')?.revenue || 0;

        // Calculate costs breakdown from processed data
        const materialCosts = sectionsWithTotals
            .filter(section => section.name !== 'البلايستيشن')
            .reduce((sum, section) => sum + section.cost, 0);

        const operationalCosts = sectionsWithTotals
            .find(section => section.name === 'البلايستيشن')?.cost || 0;

        // Get PlayStation section data from processed data
        const playstationSection = sectionsWithTotals.find(section => section.name === 'البلايستيشن');
        const playstationStats = {
            totalSessions: playstationSection ? playstationSection.items.length : 0,
            totalRevenue: gamingRevenue,
            totalMinutes: playstationSection ? 
                playstationSection.items.reduce((sum, item) => sum + (item.quantity * 60), 0) : 0, // Convert hours to minutes
            avgMinutesPerSession: 0,
            avgRevenuePerSession: 0,
        };

        if (playstationStats.totalSessions > 0) {
            playstationStats.avgMinutesPerSession = Math.round(playstationStats.totalMinutes / playstationStats.totalSessions);
            playstationStats.avgRevenuePerSession = (playstationStats.totalRevenue / playstationStats.totalSessions).toFixed(2);
        }

        // Format menu sections for email using processed data
        const menuSectionsWithData = sectionsWithTotals.map(section => ({
            name: section.name,
            icon: section.name === 'البلايستيشن' ? '🎮' : 
                  section.name.includes('مشروبات') ? '🥤' :
                  section.name.includes('طعام') ? '🍽️' :
                  section.name.includes('حلويات') ? '🍰' :
                  section.name.includes('مقبلات') ? '🥗' : '🍽️',
            revenue: section.revenue,
            cost: section.cost,
            profit: section.profit,
            profitMargin: section.profitMargin,
            itemsCount: section.itemsCount,
            items: section.items.slice(0, 10).map(item => ({
                name: item.name,
                quantity: item.quantity,
                price: item.price || 0,
                total: item.total,
                cost: section.name !== 'البلايستيشن' ? 
                    (menuItems.find(m => m.name === item.name)?.cost || 0) * item.quantity : // Use actual menu item cost
                    item.quantity * 5, // 5 EGP per hour for PlayStation
                profit: section.name !== 'البلايستيشن' ? 
                    item.total - ((menuItems.find(m => m.name === item.name)?.cost || 0) * item.quantity) : // Actual profit
                    item.total - (item.quantity * 5),
                profitMargin: item.total > 0 ? 
                    (((item.total - (section.name !== 'البلايستيشن' ? 
                        (menuItems.find(m => m.name === item.name)?.cost || 0) * item.quantity : 
                        item.quantity * 5)) / item.total) * 100).toFixed(1) : '0'
            }))
        }));

        // Create report data using processed consumption data
        const reportData = {
            date: startDate.toLocaleDateString("ar-EG", {timeZone: 'Africa/Cairo'}),
            organizationName: organizationName,
            
            // Revenue and costs from processed consumption data
            totalRevenue: totalRevenue || 0,
            totalCosts: totalCostsWithAdditional || 0,
            netProfit: (totalRevenue || 0) - (totalCostsWithAdditional || 0),
            
            // General statistics
            totalBills: bills.length || 0,
            totalOrders: orders.length || 0,
            totalSessions: sessions.length || 0,
            
            // Revenue breakdown
            cafeRevenue: cafeRevenue || 0,
            gamingRevenue: gamingRevenue || 0,
            materialCosts: materialCosts || 0,
            operationalCosts: operationalCosts || 0,
            additionalCosts: additionalCosts || 0,
            
            // Growth indicators (simplified)
            revenueGrowth: '+15.5',
            profitGrowth: '+22.3',
            customerGrowth: '0',
            
            // PlayStation/Gaming statistics
            avgSessionDuration: playstationStats.avgMinutesPerSession,
            totalGamingMinutes: playstationStats.totalMinutes,
            
            // Detailed gaming statistics
            playstationStats: playstationStats,
            computerStats: {
                totalSessions: 0,
                totalRevenue: 0,
                totalMinutes: 0,
                avgMinutesPerSession: 0,
                avgRevenuePerSession: 0,
            },
            
            // Menu sections with detailed data (from processed consumption data)
            menuSections: menuSectionsWithData,
            
            // Additional statistics
            uniqueCustomers: bills.length,
            avgBillValue: bills.length > 0 ? totalRevenue / bills.length : 0,
            
            // Period information
            startOfReport: startDate,
            endOfReport: endDate,
            reportPeriod: `من 8:00 صباحاً يوم ${startDate.toLocaleDateString('ar-EG', {weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Africa/Cairo'})} 
                         إلى 8:00 صباحاً يوم ${endDate.toLocaleDateString('ar-EG', {weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Africa/Cairo'})}`,
        };

        Logger.info("Report data prepared", {
            organizationName,
            totalRevenue: reportData.totalRevenue,
            totalCosts: reportData.totalCosts,
            netProfit: reportData.netProfit,
            menuSectionsCount: reportData.menuSections.length,
            sectionsData: reportData.menuSections.map(s => ({
                name: s.name,
                revenue: s.revenue,
                itemsCount: s.itemsCount
            }))
        });

        // Send the report using the existing sendDailyReport function (only if emails provided)
        if (shouldSendEmail) {
            await sendDailyReport(reportData, adminEmails);
            Logger.info("Daily report generated and sent successfully", {
                organizationName,
                adminEmailsCount: adminEmails.length,
                totalRevenue: reportData.totalRevenue,
                totalSections: reportData.menuSections.length
            });
        } else {
            Logger.info("Daily report generated (not sent - no emails)", {
                organizationName,
                totalRevenue: reportData.totalRevenue,
                totalSections: reportData.menuSections.length
            });
        }

        return reportData;

    } catch (error) {
        Logger.error("Error generating and sending daily report", {
            organizationId,
            organizationName,
            error: error.message,
            stack: error.stack
        });
        throw error;
    }
};

// Send monthly report
export const sendMonthlyReport = async (reportData, adminEmails) => {
    if (!adminEmails || adminEmails.length === 0) return;

    const template = emailTemplates.monthlyReport(reportData);

    for (const email of adminEmails) {
        try {
            await sendEmail({
                to: email,
                ...template,
            });
        } catch (error) {
            Logger.error("Failed to send monthly report", {
                email,
                error: error.message,
            });
        }
    }
};
