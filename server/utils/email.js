import Logger from "../middleware/logger.js";
import { emailTranslations } from "./emailTranslations.js";
import { getCurrencySymbol, getLocaleFromLanguage } from "./localeHelper.js";

// Dynamic import for nodemailer to handle ES modules properly
let nodemailer;
try {
    nodemailer = await import("nodemailer");
    // Handle both default and named exports
    nodemailer = nodemailer.default || nodemailer;
} catch (error) {
    Logger.error("Failed to import nodemailer:", error);
}

// Create email transporter
const createTransporter = () => {
    if (!nodemailer) {
        Logger.error("Nodemailer is not available");
        return null;
    }
    
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

    // Create transporter with Gmail configuration
    try {
        const transporter = nodemailer.createTransport({
            service: "gmail",
            host: process.env.EMAIL_HOST,
            port: parseInt(process.env.EMAIL_PORT) || 587,
            secure: false,
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS,
            },
            tls: {
                rejectUnauthorized: false,
            },
        });
        
        Logger.info(`Email transporter created successfully`, {
            host: process.env.EMAIL_HOST,
            port: process.env.EMAIL_PORT || 587,
        });
        
        return transporter;
    } catch (error) {
        Logger.error(`Failed to create email transporter:`, {
            error: error.message,
            stack: error.stack
        });
        throw new Error("Email configuration failed: " + error.message);
    }
};

// Send email
export const sendEmail = async (options) => {
    let transporter = createTransporter();

    if (!transporter && nodemailer) {
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

// Email templates with multi-language support
export const emailTemplates = {
    // Low stock alert
    lowStockAlert: ({ items, organizationName, adminNames = [], timestamp = new Date(), language = 'ar', currency = 'EGP' }) => {
        const t = emailTranslations.lowStockAlert[language] || emailTranslations.lowStockAlert.ar;
        const locale = getLocaleFromLanguage(language);
        const currencySymbol = getCurrencySymbol(currency, language);
        const dir = language === 'ar' ? 'rtl' : 'ltr';
        const lang = language;
        
        const formattedDate = new Date(timestamp).toLocaleString(locale, {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });

        return {
            subject: t.subject(organizationName),
            html: `
                <!DOCTYPE html>
                <html dir="${dir}" lang="${lang}">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>${t.title}</title>
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
                            border-${dir === 'rtl' ? 'right' : 'left'}: 5px solid #f5c6cb;
                        }
                        .items-table {
                            width: 100%;
                            border-collapse: collapse;
                            margin: 20px 0;
                        }
                        .items-table th, .items-table td {
                            padding: 12px 15px;
                            text-align: ${dir === 'rtl' ? 'right' : 'left'};
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
                            margin-${dir === 'rtl' ? 'right' : 'left'}: 5px;
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
                            <h1>${t.title}</h1>
                            <p>${organizationName || t.systemName}</p>
                        </div>
                        
                        <div class="content">
                            <div class="alert-message">
                                <p>${t.alertMessage(items.length)}</p>
                            </div>
                            
                            <h2>${t.detailsTitle}</h2>
                            <table class="items-table">
                                <thead>
                                    <tr>
                                        <th>${t.tableHeaders.product}</th>
                                        <th>${t.tableHeaders.currentStock}</th>
                                        <th>${t.tableHeaders.minStock}</th>
                                        <th>${t.tableHeaders.unit}</th>
                                        <th>${t.tableHeaders.status}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${items.map(item => {
                                        const isCritical = item.currentStock <= (item.minStock * 0.3);
                                        const status = isCritical ? t.statusCritical : t.statusWarning;
                                        const statusClass = isCritical ? 'critical' : 'warning';
                                        return `
                                            <tr>
                                                <td><strong>${item.name}</strong></td>
                                                <td class="${isCritical ? 'stock-critical' : ''}">${item.currentStock}</td>
                                                <td>${item.minStock}</td>
                                                <td>${item.unit || t.defaultUnit}</td>
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
                                <h3>${t.actionTitle}</h3>
                                <p>${t.actionText}</p>
                                ${adminNames.length > 0 ? `
                                    <p>${t.sentTo(adminNames.join('، '))}</p>
                                ` : ''}
                            </div>
                        </div>
                        
                        <div class="footer">
                            <p>⏱️ ${t.footerCreated} ${formattedDate}</p>
                            <p>📞 ${t.footerSupport}</p>
                            <p>${t.footerCopyright(new Date().getFullYear())}</p>
                        </div>
                    </div>
                </body>
                </html>
            `
        };
    },

    // Daily report - simplified version with multi-language support
    dailyReport: (data) => {
        const language = data.language || 'ar';
        const currency = data.currency || 'EGP';
        const t = emailTranslations.dailyReport[language] || emailTranslations.dailyReport.ar;
        const locale = getLocaleFromLanguage(language);
        const currencySymbol = getCurrencySymbol(currency, language);
        const dir = language === 'ar' ? 'rtl' : 'ltr';
        const lang = language;
        
        const formattedDate = data.date || new Date().toLocaleDateString(locale);
        
        return {
            subject: t.subject(data.organizationName || t.defaultOrgName, formattedDate),
            html: `
                <!DOCTYPE html>
                <html dir="${dir}" lang="${lang}">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>${t.title}</title>
                    <style>
                        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; margin: 0; }
                        .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.1); }
                        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px 30px; text-align: center; }
                        .header h1 { margin: 0 0 10px 0; font-size: 28px; }
                        .header p { margin: 5px 0; opacity: 0.9; }
                        .org-name { font-size: 20px; font-weight: 600; background: rgba(255,255,255,0.2); padding: 10px 20px; border-radius: 25px; display: inline-block; margin: 10px 0; }
                        .content { padding: 40px 30px; }
                        .profit-section { background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 30px; border-radius: 20px; text-align: center; margin-bottom: 30px; }
                        .profit-title { font-size: 18px; font-weight: 600; margin-bottom: 10px; }
                        .profit-amount { font-size: 36px; font-weight: 700; margin-bottom: 10px; }
                        .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
                        .stat-card { background: #f8f9fa; border-radius: 15px; padding: 25px; text-align: center; border: 1px solid #e9ecef; }
                        .stat-value { font-size: 28px; font-weight: 700; color: #667eea; margin-bottom: 5px; }
                        .stat-label { font-size: 14px; color: #6c757d; }
                        .section-title { font-size: 20px; font-weight: 600; color: #2c3e50; margin-bottom: 20px; }
                        .products-list { background: #f8f9fa; border-radius: 15px; padding: 20px; border: 1px solid #e9ecef; }
                        .product-item { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #e9ecef; }
                        .product-item:last-child { border-bottom: none; }
                        .product-name { font-weight: 500; }
                        .product-quantity { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; }
                        .footer { background: #f8f9fa; padding: 30px; text-align: center; border-top: 1px solid #e9ecef; }
                        .footer p { color: #6c757d; font-size: 14px; margin: 10px 0; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>${t.title}</h1>
                            <p>${t.subtitle}</p>
                            <div class="org-name">${data.organizationName || t.defaultOrgName}</div>
                            <p>${formattedDate}</p>
                        </div>
                        
                        <div class="content">
                            <div class="profit-section">
                                <div class="profit-title">${t.netProfitTitle}</div>
                                <div class="profit-amount">${data.netProfit || 0} ${currencySymbol}</div>
                                <div>${t.totalRevenueLabel} ${data.totalRevenue || 0} ${currencySymbol}</div>
                            </div>
                            
                            <div class="stats-grid">
                                <div class="stat-card">
                                    <div class="stat-value">${data.totalRevenue || 0}</div>
                                    <div class="stat-label">${t.stats.totalRevenue} (${currencySymbol})</div>
                                </div>
                                <div class="stat-card">
                                    <div class="stat-value">${data.totalBills || 0}</div>
                                    <div class="stat-label">${t.stats.totalBills}</div>
                                </div>
                                <div class="stat-card">
                                    <div class="stat-value">${data.totalOrders || 0}</div>
                                    <div class="stat-label">${t.stats.totalOrders}</div>
                                </div>
                                <div class="stat-card">
                                    <div class="stat-value">${data.totalSessions || 0}</div>
                                    <div class="stat-label">${t.stats.totalSessions}</div>
                                </div>
                            </div>
                            
                            <h2 class="section-title">${t.topProductsTitle}</h2>
                            <div class="products-list">
                                ${data.topProducts && data.topProducts.length > 0
                                    ? data.topProducts.map((product, index) => `
                                        <div class="product-item">
                                            <div class="product-name">${index + 1}. ${product.name}</div>
                                            <div class="product-quantity">${product.quantity} ${t.unit}</div>
                                        </div>
                                    `).join('')
                                    : `<div style="text-align: center; color: #6c757d; padding: 20px;">${t.noDataAvailable}</div>`
                                }
                            </div>
                        </div>
                        
                        <div class="footer">
                            <p>${t.footerSentFrom}</p>
                            <p>${t.footerMoreDetails}</p>
                        </div>
                    </div>
                </body>
                </html>
            `
        };
    },

    // Monthly report
    monthlyReport: (data) => {
        const language = data.language || 'ar';
        const currency = data.currency || 'EGP';
        const t = emailTranslations.monthlyReport[language] || emailTranslations.monthlyReport.ar;
        const locale = getLocaleFromLanguage(language);
        const currencySymbol = getCurrencySymbol(currency, language);
        const dir = language === 'ar' ? 'rtl' : 'ltr';
        const lang = language;
        
        return {
            subject: t.subject(data.organizationName || t.defaultOrgName, data.month),
            html: `
                <!DOCTYPE html>
                <html dir="${dir}" lang="${lang}">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>${t.title}</title>
                    <style>
                        body { font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; }
                        .container { max-width: 600px; margin: 0 auto; background-color: white; }
                        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
                        .header h1 { margin: 0; font-size: 24px; }
                        .content { padding: 30px; }
                        .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
                        .stat-card { background: #f8f9fa; padding: 20px; border-radius: 10px; text-align: center; border-${dir === 'rtl' ? 'right' : 'left'}: 4px solid #667eea; }
                        .stat-value { font-size: 28px; font-weight: bold; color: #667eea; margin-bottom: 5px; }
                        .stat-label { color: #6c757d; font-size: 14px; }
                        .section-title { font-size: 18px; font-weight: bold; color: #333; margin: 30px 0 15px 0; border-bottom: 2px solid #667eea; padding-bottom: 5px; }
                        .product-item { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }
                        .product-name { font-weight: bold; }
                        .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #6c757d; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>${t.title}</h1>
                            <div>${data.organizationName || t.defaultOrgName} - ${data.month}</div>
                        </div>
                        
                        <div class="content">
                            <div class="stats-grid">
                                <div class="stat-card">
                                    <div class="stat-value">${data.totalRevenue.toLocaleString(locale)} ${currencySymbol}</div>
                                    <div class="stat-label">${t.stats.totalRevenue}</div>
                                </div>
                                <div class="stat-card">
                                    <div class="stat-value">${data.totalCosts.toLocaleString(locale)} ${currencySymbol}</div>
                                    <div class="stat-label">${t.stats.totalCosts}</div>
                                </div>
                                <div class="stat-card">
                                    <div class="stat-value">${data.netProfit.toLocaleString(locale)} ${currencySymbol}</div>
                                    <div class="stat-label">${t.stats.netProfit}</div>
                                </div>
                                <div class="stat-card">
                                    <div class="stat-value">${data.profitMargin.toFixed(1)}%</div>
                                    <div class="stat-label">${t.stats.profitMargin}</div>
                                </div>
                            </div>
                            
                            <div class="stats-grid">
                                <div class="stat-card">
                                    <div class="stat-value">${data.totalBills}</div>
                                    <div class="stat-label">${t.stats.totalBills}</div>
                                </div>
                                <div class="stat-card">
                                    <div class="stat-value">${data.totalOrders}</div>
                                    <div class="stat-label">${t.stats.totalOrders}</div>
                                </div>
                                <div class="stat-card">
                                    <div class="stat-value">${data.totalSessions}</div>
                                    <div class="stat-label">${t.stats.totalSessions}</div>
                                </div>
                                <div class="stat-card">
                                    <div class="stat-value">${data.avgDailyRevenue.toLocaleString(locale)} ${currencySymbol}</div>
                                    <div class="stat-label">${t.stats.avgDailyRevenue}</div>
                                </div>
                            </div>
                            
                            ${data.bestDay ? `
                                <div style="background: #fff3cd; padding: 15px; border-radius: 8px; border-${dir === 'rtl' ? 'right' : 'left'}: 4px solid #ffc107; margin: 20px 0;">
                                    <div style="font-weight: bold; color: #856404; margin-bottom: 10px;">${t.bestDayTitle}</div>
                                    <div style="color: #856404;">
                                        ${t.bestDay.date} ${new Date(data.bestDay._id).toLocaleDateString(locale)}<br>
                                        ${t.bestDay.revenue} ${data.bestDay.revenue.toLocaleString(locale)} ${currencySymbol}<br>
                                        ${t.bestDay.bills} ${data.bestDay.bills}
                                    </div>
                                </div>
                            ` : ''}
                            
                            <div class="section-title">${t.topProductsTitle}</div>
                            ${data.topProducts.length > 0
                                ? data.topProducts.map((product, index) => `
                                    <div class="product-item">
                                        <div class="product-name">${index + 1}. ${product.name}</div>
                                        <div>${product.quantity} ${t.piece} - ${product.revenue.toLocaleString(locale)} ${currencySymbol}</div>
                                    </div>
                                `).join('')
                                : `<div style="text-align: center; color: #6c757d; padding: 20px;">${t.noSalesThisMonth}</div>`
                            }
                        </div>
                        
                        <div class="footer">
                            <div style="font-weight: bold; color: #667eea; margin-bottom: 10px;">${t.footerTitle}</div>
                            <div style="font-size: 12px; line-height: 1.5;">
                                ${t.footerText}<br>
                                ${t.footerCreated} ${new Date().toLocaleTimeString(locale)}
                            </div>
                        </div>
                    </div>
                </body>
                </html>
            `
        };
    },

    // User account created
    userCreated: (user, password, language = 'ar') => {
        const t = emailTranslations.userCreated[language] || emailTranslations.userCreated.ar;
        const dir = language === 'ar' ? 'rtl' : 'ltr';
        const lang = language;
        
        return {
            subject: t.subject,
            html: `
                <!DOCTYPE html>
                <html dir="${dir}" lang="${lang}">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <style>
                        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; padding: 20px; }
                        .container { max-width: 600px; margin: 0 auto; background: #fff; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                        h2 { color: #667eea; margin-bottom: 20px; }
                        h3 { color: #333; margin-top: 20px; }
                        ul { list-style: none; padding: 0; }
                        li { padding: 8px 0; border-bottom: 1px solid #eee; }
                        .note { background: #fff3cd; padding: 15px; border-radius: 5px; margin-top: 20px; border-${dir === 'rtl' ? 'right' : 'left'}: 4px solid #ffc107; }
                        .note strong { color: #856404; }
                        hr { border: none; border-top: 1px solid #eee; margin: 20px 0; }
                        small { color: #6c757d; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <h2>${t.greeting(user.name)}</h2>
                        <p>${t.message}</p>
                        
                        <h3>${t.loginDetailsTitle}</h3>
                        <ul>
                            <li><strong>${t.email}</strong> ${user.email}</li>
                            <li><strong>${t.password}</strong> ${password}</li>
                            <li><strong>${t.role}</strong> ${user.role}</li>
                        </ul>
                        
                        <div class="note">
                            <p><strong>${t.note}</strong> ${t.noteText}</p>
                        </div>
                        
                        <hr>
                        <small>${t.footerText}</small>
                    </div>
                </body>
                </html>
            `
        };
    }
};

// Send low stock alert
export const sendLowStockAlert = async ({
    items,
    organizationName,
    recipientEmails,
    adminNames = [],
    language = 'ar',
    currency = 'EGP'
}) => {
    if (!recipientEmails || recipientEmails.length === 0) {
        Logger.warn("No recipient emails provided for low stock alert");
        return;
    }

    Logger.info(`Sending low stock alert to ${recipientEmails.length} recipients`, {
        organizationName,
        itemCount: items.length,
        language,
        currency,
        firstFewItems: items.slice(0, 3).map(i => i.name)
    });

    const template = emailTemplates.lowStockAlert({
        items,
        organizationName,
        adminNames,
        timestamp: new Date(),
        language,
        currency
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

// Send daily report with PDF attachment
// adminEmails can be either:
// - Array of strings (old format): ['email1@example.com', 'email2@example.com']
// - Array of objects (new format): [{email: 'email1@example.com', language: 'ar'}, {email: 'email2@example.com', language: 'en'}]
export const sendDailyReport = async (reportData, adminEmails, pdfBuffer = null, defaultLanguage = 'ar', currency = 'EGP') => {
    Logger.info("Starting daily report email sending", {
        adminEmailsCount: adminEmails?.length || 0,
        adminEmails: adminEmails,
        hasPdfBuffer: !!pdfBuffer,
        defaultLanguage: defaultLanguage,
        currency: currency,
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

    try {
        // Normalize adminEmails to new format
        const normalizedEmails = adminEmails.map(item => {
            if (typeof item === 'string') {
                // Old format: just email string
                return { email: item, language: defaultLanguage };
            } else if (item && typeof item === 'object' && item.email) {
                // New format: object with email and language
                return { email: item.email, language: item.language || defaultLanguage };
            }
            return null;
        }).filter(Boolean);

        if (normalizedEmails.length === 0) {
            Logger.warn("No valid emails after normalization", { adminEmails });
            return;
        }

        Logger.info("Normalized email list", {
            originalCount: adminEmails.length,
            normalizedCount: normalizedEmails.length,
            emails: normalizedEmails
        });

        // Send email to each admin with PDF attachment in their preferred language
        const sendPromises = normalizedEmails.map(async ({ email, language }) => {
            try {
                // Generate PDF for this specific language if not provided or if we have multiple languages
                let recipientPdfBuffer = pdfBuffer;
                const hasMultipleLanguages = new Set(normalizedEmails.map(e => e.language)).size > 1;
                
                if (!pdfBuffer || hasMultipleLanguages) {
                    const { generateDailyReportPDF } = await import('./pdfGenerator.js');
                    recipientPdfBuffer = await generateDailyReportPDF(reportData, language, currency);
                    Logger.info("Generated PDF for specific language", {
                        email,
                        language,
                        pdfSize: recipientPdfBuffer.length
                    });
                }

                const transporter = createTransporter();
                if (!transporter) {
                    throw new Error("Email transporter not configured");
                }

                // Get email template with recipient's language and currency
                const emailTemplate = emailTemplates.dailyReport({
                    ...reportData,
                    language,
                    currency
                });

                const mailOptions = {
                    from: `"Bomba System" <${process.env.EMAIL_USER}>`,
                    to: email,
                    subject: emailTemplate.subject,
                    html: emailTemplate.html,
                    attachments: [
                        {
                            filename: `daily-report-${reportData.date}.pdf`,
                            content: recipientPdfBuffer,
                            contentType: 'application/pdf'
                        }
                    ]
                };

                Logger.info("Sending daily report email", {
                    to: email,
                    language,
                    subject: emailTemplate.subject,
                    hasAttachment: true,
                    attachmentSize: recipientPdfBuffer.length
                });

                const result = await transporter.sendMail(mailOptions);

                Logger.info("Daily report email sent successfully", {
                    messageId: result.messageId,
                    to: email,
                    language
                });

                return { email, language, success: true, messageId: result.messageId };
            } catch (error) {
                Logger.error("Failed to send daily report email", {
                    to: email,
                    language,
                    error: error.message,
                    stack: error.stack,
                });
                return { email, language, success: false, error: error.message };
            }
        });

        const results = await Promise.all(sendPromises);
        const successCount = results.filter(r => r.success).length;
        const failCount = results.filter(r => !r.success).length;

        Logger.info("Daily report email sending completed", {
            total: normalizedEmails.length,
            success: successCount,
            failed: failCount,
            results: results
        });

        return results;
    } catch (error) {
        Logger.error("Failed to send daily report", {
            error: error.message,
            stack: error.stack,
        });
        throw error;
    }
};

// Send monthly report
export const sendMonthlyReport = async (reportData, adminEmails, language = 'ar', currency = 'EGP') => {
    if (!adminEmails || adminEmails.length === 0) return;

    const template = emailTemplates.monthlyReport({
        ...reportData,
        language,
        currency
    });

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
