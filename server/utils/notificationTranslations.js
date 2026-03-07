// Notification translations for multi-language support
export const notificationTranslations = {
    // Session notifications
    session: {
        started: {
            ar: {
                title: "جلسة جديدة",
                message: (deviceName) => `تم بدء جلسة جديدة على ${deviceName}`
            },
            en: {
                title: "New Session",
                message: (deviceName) => `New session started on ${deviceName}`
            },
            fr: {
                title: "Nouvelle Session",
                message: (deviceName) => `Nouvelle session démarrée sur ${deviceName}`
            }
        },
        ended: {
            ar: {
                title: "انتهاء الجلسة",
                message: (deviceName, finalCost, currency) => `انتهت الجلسة على ${deviceName} - التكلفة: ${finalCost} ${currency}`
            },
            en: {
                title: "Session Ended",
                message: (deviceName, finalCost, currency) => `Session ended on ${deviceName} - Cost: ${finalCost} ${currency}`
            },
            fr: {
                title: "Session Terminée",
                message: (deviceName, finalCost, currency) => `Session terminée sur ${deviceName} - Coût: ${finalCost} ${currency}`
            }
        },
        paused: {
            ar: {
                title: "إيقاف مؤقت للجلسة",
                message: (deviceName) => `تم إيقاف الجلسة مؤقتاً على ${deviceName}`
            },
            en: {
                title: "Session Paused",
                message: (deviceName) => `Session paused on ${deviceName}`
            },
            fr: {
                title: "Session en Pause",
                message: (deviceName) => `Session mise en pause sur ${deviceName}`
            }
        }
    },

    // Order notifications
    order: {
        created: {
            ar: {
                title: "طلب جديد",
                message: (customerName, itemCount) => `طلب جديد من ${customerName} - ${itemCount} عنصر`
            },
            en: {
                title: "New Order",
                message: (customerName, itemCount) => `New order from ${customerName} - ${itemCount} item${itemCount > 1 ? 's' : ''}`
            },
            fr: {
                title: "Nouvelle Commande",
                message: (customerName, itemCount) => `Nouvelle commande de ${customerName} - ${itemCount} article${itemCount > 1 ? 's' : ''}`
            }
        },
        ready: {
            ar: {
                title: "طلب جاهز",
                message: (orderNumber) => `الطلب ${orderNumber} جاهز للتسليم`
            },
            en: {
                title: "Order Ready",
                message: (orderNumber) => `Order ${orderNumber} is ready for delivery`
            },
            fr: {
                title: "Commande Prête",
                message: (orderNumber) => `La commande ${orderNumber} est prête pour la livraison`
            }
        },
        cancelled: {
            ar: {
                title: "طلب ملغي",
                message: (orderNumber) => `تم إلغاء الطلب ${orderNumber}`
            },
            en: {
                title: "Order Cancelled",
                message: (orderNumber) => `Order ${orderNumber} has been cancelled`
            },
            fr: {
                title: "Commande Annulée",
                message: (orderNumber) => `La commande ${orderNumber} a été annulée`
            }
        }
    },

    // Inventory notifications
    inventory: {
        low_stock: {
            ar: {
                title: "مخزون منخفض",
                message: (itemName, currentStock, unit) => `المخزون منخفض للمنتج: ${itemName} (${currentStock} ${unit})`
            },
            en: {
                title: "Low Stock",
                message: (itemName, currentStock, unit) => `Low stock for product: ${itemName} (${currentStock} ${unit})`
            },
            fr: {
                title: "Stock Faible",
                message: (itemName, currentStock, unit) => `Stock faible pour le produit: ${itemName} (${currentStock} ${unit})`
            }
        },
        out_of_stock: {
            ar: {
                title: "نفاد المخزون",
                message: (itemName) => `نفد المخزون للمنتج: ${itemName}`
            },
            en: {
                title: "Out of Stock",
                message: (itemName) => `Product out of stock: ${itemName}`
            },
            fr: {
                title: "Rupture de Stock",
                message: (itemName) => `Produit en rupture de stock: ${itemName}`
            }
        }
    },

    // Billing notifications
    billing: {
        created: {
            ar: {
                title: "فاتورة جديدة",
                message: (billNumber, customerName) => `فاتورة جديدة ${billNumber} - ${customerName}`
            },
            en: {
                title: "New Bill",
                message: (billNumber, customerName) => `New bill ${billNumber} - ${customerName}`
            },
            fr: {
                title: "Nouvelle Facture",
                message: (billNumber, customerName) => `Nouvelle facture ${billNumber} - ${customerName}`
            }
        },
        paid: {
            ar: {
                title: "دفع مكتمل",
                message: (billNumber) => `تم دفع الفاتورة ${billNumber} بالكامل`
            },
            en: {
                title: "Payment Complete",
                message: (billNumber) => `Bill ${billNumber} has been fully paid`
            },
            fr: {
                title: "Paiement Complet",
                message: (billNumber) => `La facture ${billNumber} a été entièrement payée`
            }
        },
        partial_payment: {
            ar: {
                title: "دفع جزئي",
                message: (billNumber, remaining, currency) => `تم دفع جزء من الفاتورة ${billNumber} - المتبقي: ${remaining} ${currency}`
            },
            en: {
                title: "Partial Payment",
                message: (billNumber, remaining, currency) => `Partial payment for bill ${billNumber} - Remaining: ${remaining} ${currency}`
            },
            fr: {
                title: "Paiement Partiel",
                message: (billNumber, remaining, currency) => `Paiement partiel pour la facture ${billNumber} - Restant: ${remaining} ${currency}`
            }
        }
    },

    // Action texts
    actions: {
        viewOrder: {
            ar: "عرض الطلب",
            en: "View Order",
            fr: "Voir la Commande"
        },
        deliverOrder: {
            ar: "تسليم الطلب",
            en: "Deliver Order",
            fr: "Livrer la Commande"
        },
        manageInventory: {
            ar: "إدارة المخزون",
            en: "Manage Inventory",
            fr: "Gérer l'Inventaire"
        },
        restock: {
            ar: "إعادة التوريد",
            en: "Restock",
            fr: "Réapprovisionner"
        },
        viewBill: {
            ar: "عرض الفاتورة",
            en: "View Bill",
            fr: "Voir la Facture"
        }
    }
};

/**
 * Get translated notification content
 * @param {string} category - Notification category (session, order, inventory, billing)
 * @param {string} type - Notification type (started, ended, created, etc.)
 * @param {string} language - Language code (ar, en, fr)
 * @param {Array} params - Parameters for the message function
 * @returns {Object} - {title, message}
 */
export const getNotificationTranslation = (category, type, language = 'ar', ...params) => {
    const translations = notificationTranslations[category]?.[type]?.[language] || 
                        notificationTranslations[category]?.[type]?.ar;
    
    if (!translations) {
        return {
            title: 'Notification',
            message: 'New notification'
        };
    }

    return {
        title: translations.title,
        message: typeof translations.message === 'function' 
            ? translations.message(...params) 
            : translations.message
    };
};

/**
 * Get translated action text
 * @param {string} actionKey - Action key (viewOrder, deliverOrder, etc.)
 * @param {string} language - Language code (ar, en, fr)
 * @returns {string} - Translated action text
 */
export const getActionTranslation = (actionKey, language = 'ar') => {
    return notificationTranslations.actions[actionKey]?.[language] || 
           notificationTranslations.actions[actionKey]?.ar || 
           actionKey;
};
