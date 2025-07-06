import Settings from '../models/Settings.js';

// @desc    Get settings by category
// @route   GET /api/settings/:category
// @access  Private
export const getSettings = async (req, res) => {
  try {
    const { category } = req.params;
    
    const settings = await Settings.findOne({ category })
      .populate('updatedBy', 'name');
    
    if (!settings) {
      return res.status(404).json({
        success: false,
        message: 'الإعدادات غير موجودة'
      });
    }
    
    res.json({
      success: true,
      data: settings
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'خطأ في جلب الإعدادات',
      error: error.message
    });
  }
};

// @desc    Update settings
// @route   PUT /api/settings/:category
// @access  Private (Admin only)
export const updateSettings = async (req, res) => {
  try {
    const { category } = req.params;
    const { settings } = req.body;
    
    const updatedSettings = await Settings.findOneAndUpdate(
      { category },
      {
        category,
        settings,
        updatedBy: req.user._id
      },
      {
        new: true,
        upsert: true,
        runValidators: true
      }
    ).populate('updatedBy', 'name');
    
    res.json({
      success: true,
      message: 'تم تحديث الإعدادات بنجاح',
      data: updatedSettings
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'خطأ في تحديث الإعدادات',
      error: error.message
    });
  }
};

// @desc    Get all settings categories
// @route   GET /api/settings
// @access  Private
export const getAllSettings = async (req, res) => {
  try {
    const settings = await Settings.find()
      .populate('updatedBy', 'name')
      .sort({ category: 1 });
    
    res.json({
      success: true,
      count: settings.length,
      data: settings
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'خطأ في جلب الإعدادات',
      error: error.message
    });
  }
};

// @desc    Reset settings to default
// @route   POST /api/settings/:category/reset
// @access  Private (Admin only)
export const resetSettings = async (req, res) => {
  try {
    const { category } = req.params;
    
    // Default settings for different categories
    const defaultSettings = {
      general: {
        cafeName: 'Bastira Café',
        currency: 'EGP',
        timezone: 'Africa/Cairo',
        language: 'ar',
        address: '',
        phone: '',
        email: ''
      },
      pricing: {
        playstationBaseRate: 15,
        playstationControllerRate: 5,
        computerHourlyRate: 20,
        taxRate: 0,
        serviceCharge: 0
      },
      notifications: {
        sessionNotifications: true,
        orderNotifications: true,
        inventoryNotifications: true,
        billNotifications: true,
        soundEnabled: true,
        emailNotifications: false
      },
      appearance: {
        theme: 'light',
        primaryColor: '#2563eb',
        fontSize: 'medium',
        showSidebar: true,
        compactMode: false
      },
      security: {
        sessionTimeout: 60,
        autoLogout: true,
        passwordExpiry: 90,
        maxLoginAttempts: 5,
        requirePasswordChange: false
      },
      backup: {
        autoBackup: true,
        backupFrequency: 'weekly',
        retentionDays: 30,
        backupLocation: 'local'
      }
    };
    
    const settings = defaultSettings[category];
    
    if (!settings) {
      return res.status(400).json({
        success: false,
        message: 'فئة إعدادات غير صحيحة'
      });
    }
    
    const updatedSettings = await Settings.findOneAndUpdate(
      { category },
      {
        category,
        settings,
        updatedBy: req.user._id
      },
      {
        new: true,
        upsert: true,
        runValidators: true
      }
    ).populate('updatedBy', 'name');
    
    res.json({
      success: true,
      message: 'تم إعادة تعيين الإعدادات للقيم الافتراضية',
      data: updatedSettings
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'خطأ في إعادة تعيين الإعدادات',
      error: error.message
    });
  }
};

// @desc    Export settings
// @route   GET /api/settings/export
// @access  Private (Admin only)
export const exportSettings = async (req, res) => {
  try {
    const settings = await Settings.find().select('-updatedBy -createdAt -updatedAt -__v');
    
    const exportData = {
      exportDate: new Date(),
      version: '1.0',
      settings: settings.reduce((acc, setting) => {
        acc[setting.category] = setting.settings;
        return acc;
      }, {})
    };
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename=bastira-settings.json');
    
    res.json({
      success: true,
      data: exportData
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'خطأ في تصدير الإعدادات',
      error: error.message
    });
  }
};

// @desc    Import settings
// @route   POST /api/settings/import
// @access  Private (Admin only)
export const importSettings = async (req, res) => {
  try {
    const { settings } = req.body;
    
    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({
        success: false,
        message: 'بيانات الإعدادات غير صحيحة'
      });
    }
    
    const importedSettings = [];
    
    for (const [category, categorySettings] of Object.entries(settings)) {
      const updatedSetting = await Settings.findOneAndUpdate(
        { category },
        {
          category,
          settings: categorySettings,
          updatedBy: req.user._id
        },
        {
          new: true,
          upsert: true,
          runValidators: true
        }
      );
      
      importedSettings.push(updatedSetting);
    }
    
    res.json({
      success: true,
      message: 'تم استيراد الإعدادات بنجاح',
      data: importedSettings
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'خطأ في استيراد الإعدادات',
      error: error.message
    });
  }
};