/**
 * Auto-upgrade configuration
 * Controls when and how automatic upgrades are performed
 */

const autoUpgradeConfig = {
    // Enable/disable auto-upgrade
    enabled: process.env.AUTO_UPGRADE_ENABLED !== 'false', // Default: enabled
    
    // Upgrade triggers
    triggers: {
        onBillAccess: true,     // Upgrade when bill is accessed
        onBillUpdate: true,     // Upgrade when bill is updated
        onPayment: true,        // Upgrade when payment is made
    },
    
    // Upgrade options
    options: {
        maxRetries: 3,          // Max retries if upgrade fails
        logLevel: 'info',       // Logging level: 'debug', 'info', 'warn', 'error'
        batchSize: -1,          // No limit - upgrade all items at once (-1 = unlimited)
        timeout: 30000,         // Timeout for upgrade operation (ms) - increased for large bills
    },
    
    // Upgrade types
    types: {
        itemPayments: {
            enabled: true,
            priority: 1,        // Higher priority = upgraded first
            description: 'Add menuItemId to itemPayments'
        },
        // Future upgrade types can be added here
        sessionPayments: {
            enabled: false,     // Not implemented yet
            priority: 2,
            description: 'Future session payment upgrades'
        }
    },
    
    // Performance settings
    performance: {
        skipIfRecentlyUpgraded: true,   // Skip if upgraded in last 24 hours
        maxUpgradesPerHour: -1,         // No limit on upgrades per hour
        enableCaching: true,            // Cache upgrade results
    }
};

export default autoUpgradeConfig;