/**
 * Email template translations for multi-language support
 */

export const emailTranslations = {
    // Low Stock Alert
    lowStockAlert: {
        ar: {
            subject: (orgName) => `تنبيه: انخفاض المخزون - ${orgName || 'نظام Bomba'}`,
            title: '🚨 تنبيه انخفاض المخزون',
            alertMessage: (count) => `يوجد <strong>${count} منتج</strong> يحتاج إلى إعادة تعبئة فورية!`,
            detailsTitle: 'تفاصيل المنتجات منخفضة المخزون',
            tableHeaders: {
                product: 'المنتج',
                currentStock: 'الكمية المتوفرة',
                minStock: 'الحد الأدنى',
                unit: 'الوحدة',
                status: 'الحالة'
            },
            statusCritical: 'حرج',
            statusWarning: 'تحذير',
            defaultUnit: 'قطعة',
            actionTitle: 'الإجراء المطلوب:',
            actionText: 'يرجى اتخاذ الإجراء اللازم لإعادة تعبئة المخزون في أقرب وقت ممكن لتجنب نفاد المنتجات.',
            sentTo: (names) => `تم إرسال هذا التنبيه إلى: ${names}`,
            footerCreated: 'تم إنشاء هذا التقرير في:',
            footerSupport: 'للدعم الفني، يرجى التواصل مع فريق الدعم الفني',
            footerCopyright: (year) => `© ${year} نظام Bomba - جميع الحقوق محفوظة`,
            systemName: 'نظام إدارة المخزون'
        },
        en: {
            subject: (orgName) => `Alert: Low Stock - ${orgName || 'Bomba System'}`,
            title: '🚨 Low Stock Alert',
            alertMessage: (count) => `There are <strong>${count} products</strong> that need immediate restocking!`,
            detailsTitle: 'Low Stock Product Details',
            tableHeaders: {
                product: 'Product',
                currentStock: 'Available Quantity',
                minStock: 'Minimum Stock',
                unit: 'Unit',
                status: 'Status'
            },
            statusCritical: 'Critical',
            statusWarning: 'Warning',
            defaultUnit: 'piece',
            actionTitle: 'Required Action:',
            actionText: 'Please take necessary action to restock as soon as possible to avoid product shortages.',
            sentTo: (names) => `This alert was sent to: ${names}`,
            footerCreated: 'This report was created at:',
            footerSupport: 'For technical support, please contact the support team',
            footerCopyright: (year) => `© ${year} Bomba System - All Rights Reserved`,
            systemName: 'Inventory Management System'
        },
        fr: {
            subject: (orgName) => `Alerte: Stock Faible - ${orgName || 'Système Bomba'}`,
            title: '🚨 Alerte de Stock Faible',
            alertMessage: (count) => `Il y a <strong>${count} produits</strong> qui nécessitent un réapprovisionnement immédiat!`,
            detailsTitle: 'Détails des Produits à Stock Faible',
            tableHeaders: {
                product: 'Produit',
                currentStock: 'Quantité Disponible',
                minStock: 'Stock Minimum',
                unit: 'Unité',
                status: 'Statut'
            },
            statusCritical: 'Critique',
            statusWarning: 'Avertissement',
            defaultUnit: 'pièce',
            actionTitle: 'Action Requise:',
            actionText: 'Veuillez prendre les mesures nécessaires pour réapprovisionner dès que possible afin d\'éviter les ruptures de stock.',
            sentTo: (names) => `Cette alerte a été envoyée à: ${names}`,
            footerCreated: 'Ce rapport a été créé à:',
            footerSupport: 'Pour le support technique, veuillez contacter l\'équipe de support',
            footerCopyright: (year) => `© ${year} Système Bomba - Tous Droits Réservés`,
            systemName: 'Système de Gestion des Stocks'
        }
    },

    // Daily Report
    dailyReport: {
        ar: {
            subject: (orgName, date) => `📊 التقرير اليومي - ${orgName || "منشأتك"} - ${date}`,
            title: '📊 التقرير اليومي',
            subtitle: 'ملخص شامل لأداء منشأتك اليوم',
            defaultOrgName: 'منشأتك',
            netProfitTitle: '💰 صافي الربح اليوم',
            totalRevenueLabel: 'إجمالي الإيرادات:',
            stats: {
                totalRevenue: 'إجمالي الإيرادات',
                totalBills: 'عدد الفواتير',
                totalOrders: 'عدد الطلبات',
                totalSessions: 'عدد الجلسات'
            },
            performanceTitle: '📈 ملخص الأداء',
            performance: {
                growthRate: 'معدل النمو',
                efficiency: 'كفاءة التشغيل'
            },
            topProductsTitle: '🏆 أكثر المنتجات مبيعاً',
            noDataAvailable: 'لا توجد بيانات متاحة',
            unit: 'وحدة',
            footerSentFrom: 'تم إرسال هذا التقرير تلقائياً من نظام Bomba',
            footerMoreDetails: 'للمزيد من التفاصيل، يرجى تسجيل الدخول إلى لوحة التحكم',
            footerLinks: {
                dashboard: 'لوحة التحكم',
                settings: 'الإعدادات'
            }
        },
        en: {
            subject: (orgName, date) => `📊 Daily Report - ${orgName || "Your Business"} - ${date}`,
            title: '📊 Daily Report',
            subtitle: 'Comprehensive summary of your business performance today',
            defaultOrgName: 'Your Business',
            netProfitTitle: '💰 Today\'s Net Profit',
            totalRevenueLabel: 'Total Revenue:',
            stats: {
                totalRevenue: 'Total Revenue',
                totalBills: 'Number of Bills',
                totalOrders: 'Number of Orders',
                totalSessions: 'Number of Sessions'
            },
            performanceTitle: '📈 Performance Summary',
            performance: {
                growthRate: 'Growth Rate',
                efficiency: 'Operating Efficiency'
            },
            topProductsTitle: '🏆 Top Selling Products',
            noDataAvailable: 'No data available',
            unit: 'unit',
            footerSentFrom: 'This report was sent automatically from Bomba System',
            footerMoreDetails: 'For more details, please log in to the dashboard',
            footerLinks: {
                dashboard: 'Dashboard',
                settings: 'Settings'
            }
        },
        fr: {
            subject: (orgName, date) => `📊 Rapport Quotidien - ${orgName || "Votre Entreprise"} - ${date}`,
            title: '📊 Rapport Quotidien',
            subtitle: 'Résumé complet des performances de votre entreprise aujourd\'hui',
            defaultOrgName: 'Votre Entreprise',
            netProfitTitle: '💰 Bénéfice Net d\'Aujourd\'hui',
            totalRevenueLabel: 'Revenu Total:',
            stats: {
                totalRevenue: 'Revenu Total',
                totalBills: 'Nombre de Factures',
                totalOrders: 'Nombre de Commandes',
                totalSessions: 'Nombre de Sessions'
            },
            performanceTitle: '📈 Résumé des Performances',
            performance: {
                growthRate: 'Taux de Croissance',
                efficiency: 'Efficacité Opérationnelle'
            },
            topProductsTitle: '🏆 Produits les Plus Vendus',
            noDataAvailable: 'Aucune donnée disponible',
            unit: 'unité',
            footerSentFrom: 'Ce rapport a été envoyé automatiquement depuis le Système Bomba',
            footerMoreDetails: 'Pour plus de détails, veuillez vous connecter au tableau de bord',
            footerLinks: {
                dashboard: 'Tableau de Bord',
                settings: 'Paramètres'
            }
        }
    },

    // Monthly Report
    monthlyReport: {
        ar: {
            subject: (orgName, month) => `📊 التقرير الشهري - ${orgName || "منشأتك"} - ${month}`,
            title: '📊 التقرير الشهري',
            defaultOrgName: 'منشأتك',
            stats: {
                totalRevenue: 'إجمالي الإيرادات',
                totalCosts: 'إجمالي التكاليف',
                netProfit: 'صافي الربح',
                profitMargin: 'هامش الربح',
                totalBills: 'عدد الفواتير',
                totalOrders: 'عدد الطلبات',
                totalSessions: 'عدد الجلسات',
                avgDailyRevenue: 'متوسط الإيرادات اليومية'
            },
            bestDayTitle: '🏆 أفضل يوم في الشهر',
            bestDay: {
                date: 'التاريخ:',
                revenue: 'الإيرادات:',
                bills: 'عدد الفواتير:'
            },
            deviceStatsTitle: '📈 إحصائيات الأجهزة',
            deviceTypes: {
                playstation: 'البلايستيشن',
                computer: 'الكمبيوتر'
            },
            session: 'جلسة',
            avgMinutes: 'دقيقة متوسط',
            topProductsTitle: '🏆 أفضل المنتجات مبيعاً',
            noSalesThisMonth: 'لا توجد مبيعات هذا الشهر',
            piece: 'قطعة',
            footerTitle: '🎮 Bomba System',
            footerText: 'تقرير شهري تلقائي من نظام إدارة المنشآت',
            footerCreated: 'تم إنشاؤه في'
        },
        en: {
            subject: (orgName, month) => `📊 Monthly Report - ${orgName || "Your Business"} - ${month}`,
            title: '📊 Monthly Report',
            defaultOrgName: 'Your Business',
            stats: {
                totalRevenue: 'Total Revenue',
                totalCosts: 'Total Costs',
                netProfit: 'Net Profit',
                profitMargin: 'Profit Margin',
                totalBills: 'Number of Bills',
                totalOrders: 'Number of Orders',
                totalSessions: 'Number of Sessions',
                avgDailyRevenue: 'Average Daily Revenue'
            },
            bestDayTitle: '🏆 Best Day of the Month',
            bestDay: {
                date: 'Date:',
                revenue: 'Revenue:',
                bills: 'Number of Bills:'
            },
            deviceStatsTitle: '📈 Device Statistics',
            deviceTypes: {
                playstation: 'PlayStation',
                computer: 'Computer'
            },
            session: 'session',
            avgMinutes: 'avg minutes',
            topProductsTitle: '🏆 Top Selling Products',
            noSalesThisMonth: 'No sales this month',
            piece: 'piece',
            footerTitle: '🎮 Bomba System',
            footerText: 'Automatic monthly report from the business management system',
            footerCreated: 'Created at'
        },
        fr: {
            subject: (orgName, month) => `📊 Rapport Mensuel - ${orgName || "Votre Entreprise"} - ${month}`,
            title: '📊 Rapport Mensuel',
            defaultOrgName: 'Votre Entreprise',
            stats: {
                totalRevenue: 'Revenu Total',
                totalCosts: 'Coûts Totaux',
                netProfit: 'Bénéfice Net',
                profitMargin: 'Marge Bénéficiaire',
                totalBills: 'Nombre de Factures',
                totalOrders: 'Nombre de Commandes',
                totalSessions: 'Nombre de Sessions',
                avgDailyRevenue: 'Revenu Quotidien Moyen'
            },
            bestDayTitle: '🏆 Meilleur Jour du Mois',
            bestDay: {
                date: 'Date:',
                revenue: 'Revenu:',
                bills: 'Nombre de Factures:'
            },
            deviceStatsTitle: '📈 Statistiques des Appareils',
            deviceTypes: {
                playstation: 'PlayStation',
                computer: 'Ordinateur'
            },
            session: 'session',
            avgMinutes: 'minutes moy',
            topProductsTitle: '🏆 Produits les Plus Vendus',
            noSalesThisMonth: 'Aucune vente ce mois-ci',
            piece: 'pièce',
            footerTitle: '🎮 Système Bomba',
            footerText: 'Rapport mensuel automatique du système de gestion d\'entreprise',
            footerCreated: 'Créé à'
        }
    },

    // User Created
    userCreated: {
        ar: {
            subject: 'تم إنشاء حسابك في نظام Bomba',
            greeting: (name) => `مرحباً ${name}`,
            message: 'تم إنشاء حسابك في نظام Bomba بنجاح.',
            loginDetailsTitle: 'بيانات الدخول:',
            email: 'البريد الإلكتروني:',
            password: 'كلمة المرور:',
            role: 'الدور:',
            note: 'ملاحظة:',
            noteText: 'يرجى تغيير كلمة المرور بعد أول تسجيل دخول.',
            footerText: 'رسالة من نظام Bomba'
        },
        en: {
            subject: 'Your Account Has Been Created in Bomba System',
            greeting: (name) => `Hello ${name}`,
            message: 'Your account has been successfully created in Bomba System.',
            loginDetailsTitle: 'Login Details:',
            email: 'Email:',
            password: 'Password:',
            role: 'Role:',
            note: 'Note:',
            noteText: 'Please change your password after first login.',
            footerText: 'Message from Bomba System'
        },
        fr: {
            subject: 'Votre Compte a été Créé dans le Système Bomba',
            greeting: (name) => `Bonjour ${name}`,
            message: 'Votre compte a été créé avec succès dans le Système Bomba.',
            loginDetailsTitle: 'Détails de Connexion:',
            email: 'Email:',
            password: 'Mot de Passe:',
            role: 'Rôle:',
            note: 'Note:',
            noteText: 'Veuillez changer votre mot de passe après la première connexion.',
            footerText: 'Message du Système Bomba'
        }
    }
};
