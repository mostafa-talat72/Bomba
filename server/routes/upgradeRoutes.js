/**
 * Upgrade monitoring routes
 * Provides endpoints to monitor and control auto-upgrades
 */

import express from 'express';
import Bill from '../models/Bill.js';
import { protect, authorize } from '../middleware/auth.js';
import Logger from '../middleware/logger.js';

const router = express.Router();

// @desc    Get upgrade statistics
// @route   GET /api/upgrades/stats
// @access  Private (Admin only)
router.get('/stats', protect, async (req, res) => {
    try {
        // Check if user is admin
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Admin only.'
            });
        }

        // Get upgrade statistics
        const stats = await Bill.aggregate([
            {
                $match: {
                    organization: req.user.organization,
                    upgradeHistory: { $exists: true, $ne: [] }
                }
            },
            {
                $unwind: '$upgradeHistory'
            },
            {
                $group: {
                    _id: '$upgradeHistory.type',
                    totalUpgrades: { $sum: 1 },
                    totalUpgradedItems: { $sum: '$upgradeHistory.upgradedCount' },
                    totalFailedItems: { $sum: '$upgradeHistory.failedCount' },
                    avgExecutionTime: { $avg: '$upgradeHistory.executionTime' },
                    lastUpgrade: { $max: '$upgradeHistory.upgradedAt' }
                }
            }
        ]);

        // Get bills that still need upgrade
        const billsNeedingUpgrade = await Bill.countDocuments({
            organization: req.user.organization,
            'itemPayments.menuItemId': { $exists: false },
            'itemPayments.0': { $exists: true }
        });

        // Get recently upgraded bills
        const recentUpgrades = await Bill.find({
            organization: req.user.organization,
            'upgradeHistory.upgradedAt': {
                $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
            }
        })
        .select('billNumber upgradeHistory')
        .sort({ 'upgradeHistory.upgradedAt': -1 })
        .limit(10);

        res.json({
            success: true,
            data: {
                stats,
                billsNeedingUpgrade,
                recentUpgrades: recentUpgrades.map(bill => ({
                    billNumber: bill.billNumber,
                    billId: bill._id,
                    lastUpgrade: bill.upgradeHistory[bill.upgradeHistory.length - 1]
                }))
            }
        });

    } catch (error) {
        Logger.error('Error getting upgrade stats:', error);
        res.status(500).json({
            success: false,
            message: 'Error getting upgrade statistics',
            error: error.message
        });
    }
});

// @desc    Manually trigger upgrade for specific bill
// @route   POST /api/upgrades/bill/:id
// @access  Private (Admin only)
router.post('/bill/:id', protect, async (req, res) => {
    try {
        // Check if user is admin
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Admin only.'
            });
        }

        const bill = await Bill.findOne({
            _id: req.params.id,
            organization: req.user.organization
        });

        if (!bill) {
            return res.status(404).json({
                success: false,
                message: 'Bill not found'
            });
        }

        // Force upgrade
        const result = await bill.upgradeItemPaymentsToNewFormat();

        Logger.info(`Manual upgrade triggered for bill ${bill.billNumber}`, {
            billId: bill._id,
            result,
            triggeredBy: req.user._id
        });

        res.json({
            success: true,
            message: result.upgraded ? 'Bill upgraded successfully' : 'No upgrade needed',
            data: result
        });

    } catch (error) {
        Logger.error('Error manually upgrading bill:', error);
        res.status(500).json({
            success: false,
            message: 'Error upgrading bill',
            error: error.message
        });
    }
});

// @desc    Get upgrade configuration
// @route   GET /api/upgrades/config
// @access  Private (Admin only)
router.get('/config', protect, async (req, res) => {
    try {
        // Check if user is admin
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Admin only.'
            });
        }

        const autoUpgradeConfig = (await import('../config/autoUpgradeConfig.js')).default;

        res.json({
            success: true,
            data: autoUpgradeConfig
        });

    } catch (error) {
        Logger.error('Error getting upgrade config:', error);
        res.status(500).json({
            success: false,
            message: 'Error getting upgrade configuration',
            error: error.message
        });
    }
});

export default router;