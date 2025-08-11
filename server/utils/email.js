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
            data.date || new Date().toLocaleDateString("ar-EG")
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

          .organization-name {
            font-size: 20px;
            font-weight: 600;
            margin-bottom: 15px;
            color: #fff;
            background: rgba(255,255,255,0.2);
            padding: 10px 20px;
            border-radius: 25px;
            display: inline-block;
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

          .period-badge {
            background: rgba(255,255,255,0.15);
            padding: 6px 12px;
            border-radius: 20px;
            display: inline-block;
            margin-top: 10px;
            font-size: 12px;
            position: relative;
            z-index: 1;
            border: 1px solid rgba(255,255,255,0.3);
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

          .section {
            margin-bottom: 40px;
          }

          .section-title {
            font-size: 20px;
            font-weight: 600;
            color: #2c3e50;
            margin-bottom: 20px;
            display: flex;
            align-items: center;
            gap: 10px;
          }

          .profit-section {
            background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
            color: white;
            padding: 30px;
            border-radius: 20px;
            text-align: center;
            margin-bottom: 30px;
            position: relative;
            overflow: hidden;
          }

          .profit-section::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><pattern id="profit-grain" width="100" height="100" patternUnits="userSpaceOnUse"><circle cx="50" cy="50" r="1" fill="white" opacity="0.1"/></pattern></defs><rect width="100" height="100" fill="url(%23profit-grain)"/></svg>');
            opacity: 0.3;
          }

          .profit-title {
            font-size: 18px;
            font-weight: 600;
            margin-bottom: 10px;
            position: relative;
            z-index: 1;
          }

          .profit-amount {
            font-size: 36px;
            font-weight: 700;
            margin-bottom: 10px;
            position: relative;
            z-index: 1;
          }

          .profit-subtitle {
            font-size: 14px;
            opacity: 0.9;
            position: relative;
            z-index: 1;
          }

          .performance-summary {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
          }

          .performance-item {
            background: #f8f9fa;
            border-radius: 15px;
            padding: 20px;
            display: flex;
            align-items: center;
            gap: 15px;
            border: 1px solid #e9ecef;
          }

          .performance-icon {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 18px;
            color: white;
          }

          .performance-content {
            flex: 1;
          }

          .performance-title {
            font-size: 14px;
            color: #6c757d;
            margin-bottom: 5px;
          }

          .performance-value {
            font-size: 20px;
            font-weight: 600;
            color: #2c3e50;
          }

          .products-list {
            background: #f8f9fa;
            border-radius: 15px;
            padding: 20px;
            border: 1px solid #e9ecef;
          }

          .product-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 12px 0;
            border-bottom: 1px solid #e9ecef;
          }

          .product-item:last-child {
            border-bottom: none;
          }

          .product-name {
            font-weight: 500;
            color: #2c3e50;
          }

          .product-quantity {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
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

          .footer-links {
            display: flex;
            justify-content: center;
            gap: 20px;
            margin-top: 15px;
          }

          .footer-link {
            color: #667eea;
            text-decoration: none;
            font-weight: 500;
            transition: color 0.3s ease;
          }

          .footer-link:hover {
            color: #764ba2;
          }

          @media (max-width: 600px) {
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
          }
        </style>
      </head>
      <body>
        <div class="email-container">
          <div class="header">
            <div class="header-content">
              <h1>📊 التقرير اليومي</h1>
              <p>ملخص شامل لأداء منشأتك اليوم</p>
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
                    })
                }
              </div>
              <div class="period-badge">
                ${data.reportPeriod || `
                  من 5:00 صباحاً يوم ${new Date(data.startOfReport).toLocaleDateString('ar-EG', {weekday: 'long', day: 'numeric', month: 'long'})}
                  إلى 5:00 صباحاً يوم ${new Date(data.endOfReport).toLocaleDateString('ar-EG', {weekday: 'long', day: 'numeric', month: 'long'})}
                `}
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
              <div class="products-list">
                ${
                    data.topProducts && data.topProducts.length > 0
                        ? data.topProducts
                              .map(
                                  (product, index) => `
                    <div class="product-item">
                      <div class="product-name">${index + 1}. ${
                                      product.name
                                  }</div>
                      <div class="product-quantity">${
                          product.quantity
                      } وحدة</div>
                    </div>
                  `
                              )
                              .join("")
                        : `<div style="text-align: center; color: #6c757d; padding: 20px;">لا توجد بيانات متاحة</div>`
                }
              </div>
            </div>
          </div>

          <div class="footer">
            <p>تم إرسال هذا التقرير تلقائياً من نظام Bomba</p>
            <p>للمزيد من التفاصيل، يرجى تسجيل الدخول إلى لوحة التحكم</p>
            <div class="footer-links">
              <a href="#" class="footer-link">لوحة التحكم</a>
              <a href="#" class="footer-link">التقارير التفصيلية</a>
              <a href="#" class="footer-link">الإعدادات</a>
            </div>
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

// Send daily report
export const sendDailyReport = async (reportData, adminEmails) => {
    Logger.info("Starting daily report email sending", {
        adminEmailsCount: adminEmails?.length || 0,
        adminEmails: adminEmails,
        reportData: {
            organizationName: reportData.organizationName,
            totalRevenue: reportData.totalRevenue,
            totalBills: reportData.totalBills,
            totalOrders: reportData.totalOrders,
            totalSessions: reportData.totalSessions,
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
