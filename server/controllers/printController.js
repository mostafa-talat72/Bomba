import printerService from '../services/printerService.js';
import printerDetectionService from '../services/printerDetectionService.js';
import Organization from '../models/Organization.js';
import { aggregateItemsWithPayments } from '../utils/billAggregation.js';

class PrintController {
  /**
   * طباعة فاتورة مباشرة
   */
  async printBill(req, res) {
    try {
      const { bill, organization, language = 'ar', tableSectionName } = req.body;

      if (!bill) {
        return res.status(400).json({ success: false, message: 'Bill data is required' });
      }

      // الحصول على إعدادات الطابعة من المنشأة
      let printSettings = {};
      if (organization) {
        if (typeof organization === 'object' && organization.printSettings) {
          printSettings = organization.printSettings;
        } else if (typeof organization === 'string') {
          const org = await Organization.findById(organization);
          if (org) {
            printSettings = org.printSettings || {};
          }
        }
      }

      // التحقق من أن الطابعة معدة
      if (!printSettings || printSettings.printerType === 'none') {
        return res.status(400).json({ 
          success: false, 
          message: 'Printer not configured. Please configure printer settings first.' 
        });
      }

      // تهيئة الطابعة
      const connected = await printerService.initializePrinter(printSettings);
      if (!connected) {
        return res.status(500).json({ 
          success: false, 
          message: 'Failed to connect to printer. Please check printer connection.' 
        });
      }

      // توليد محتوى الفاتورة للطباعة
      const content = await this.generateBillContent(bill, organization, language, tableSectionName, printSettings);

      // طباعة الفاتورة مع فتح درج الكاشير إذا كان مفعلاً
      const openDrawer = printSettings.openCashDrawer !== false;
      const autoCut = printSettings.autoCut === true;

      const result = await printerService.printDocument(content, openDrawer, autoCut);

      // إغلاق الاتصال بالطابعة
      await printerService.disconnect();

      if (result.success) {
        return res.json({ 
          success: true, 
          message: 'Bill printed successfully',
          cashDrawerOpened: openDrawer
        });
      } else {
        return res.status(500).json({ 
          success: false, 
          message: 'Failed to print bill',
          error: result.error
        });
      }
    } catch (error) {
      console.error('Error in printBill:', error);
      await printerService.disconnect();
      return res.status(500).json({ 
        success: false, 
        message: 'Internal server error during printing',
        error: error.message
      });
    }
  }

  /**
   * طباعة طلب مباشرة
   */
  async printOrder(req, res) {
    try {
      const { order, organization, language = 'ar' } = req.body;

      if (!order) {
        return res.status(400).json({ success: false, message: 'Order data is required' });
      }

      // الحصول على إعدادات الطابعة
      let printSettings = {};
      if (organization) {
        if (typeof organization === 'object' && organization.printSettings) {
          printSettings = organization.printSettings;
        } else if (typeof organization === 'string') {
          const org = await Organization.findById(organization);
          if (org) {
            printSettings = org.printSettings || {};
          }
        }
      }

      if (!printSettings || printSettings.printerType === 'none') {
        return res.status(400).json({ 
          success: false, 
          message: 'Printer not configured' 
        });
      }

      const connected = await printerService.initializePrinter(printSettings);
      if (!connected) {
        return res.status(500).json({ 
          success: false, 
          message: 'Failed to connect to printer' 
        });
      }

      const content = await this.generateOrderContent(order, organization, language, printSettings);

      // طباعة الطلب بدون فتح درج الكاشير
      const result = await printerService.printDocument(content, false, printSettings.autoCut);

      await printerService.disconnect();

      if (result.success) {
        return res.json({ success: true, message: 'Order printed successfully' });
      } else {
        return res.status(500).json({ 
          success: false, 
          message: 'Failed to print order',
          error: result.error
        });
      }
    } catch (error) {
      console.error('Error in printOrder:', error);
      await printerService.disconnect();
      return res.status(500).json({ 
        success: false, 
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  /**
   * طباعة تقرير الاستهلاك مباشرة
   */
  async printConsumptionReport(req, res) {
    try {
      const { reportData, organization, language = 'ar' } = req.body;

      if (!reportData) {
        return res.status(400).json({ success: false, message: 'Report data is required' });
      }

      let printSettings = {};
      if (organization) {
        if (typeof organization === 'object' && organization.printSettings) {
          printSettings = organization.printSettings;
        } else if (typeof organization === 'string') {
          const org = await Organization.findById(organization);
          if (org) {
            printSettings = org.printSettings || {};
          }
        }
      }

      if (!printSettings || printSettings.printerType === 'none') {
        return res.status(400).json({ 
          success: false, 
          message: 'Printer not configured' 
        });
      }

      const connected = await printerService.initializePrinter(printSettings);
      if (!connected) {
        return res.status(500).json({ 
          success: false, 
          message: 'Failed to connect to printer' 
        });
      }

      const content = await this.generateConsumptionReportContent(reportData, organization, language, printSettings);

      // طباعة التقرير بدون فتح درج الكاشير
      const result = await printerService.printDocument(content, false, printSettings.autoCut);

      await printerService.disconnect();

      if (result.success) {
        return res.json({ success: true, message: 'Report printed successfully' });
      } else {
        return res.status(500).json({ 
          success: false, 
          message: 'Failed to print report',
          error: result.error
        });
      }
    } catch (error) {
      console.error('Error in printConsumptionReport:', error);
      await printerService.disconnect();
      return res.status(500).json({ 
        success: false, 
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  /**
   * توليد محتوى الفاتورة للطباعة
   */
  async generateBillContent(bill, organization, language, tableSectionName, printSettings) {
    const orgName = organization?.name || 'Cafe Management System';
    const charsPerLine = printSettings.charactersPerLine || 48;
    const isRTL = language === 'ar';

    let content = '';

    // الرأس
    if (printSettings.printHeader !== false) {
      content += this.centerText(orgName, charsPerLine) + '\n';
      content += this.centerText(bill.billNumber || '', charsPerLine) + '\n';
      content += this.centerText(new Date(bill.createdAt || new Date()).toLocaleString(language), charsPerLine) + '\n';
      
      if (bill.table?.number) {
        content += this.centerText(`Table: ${bill.table.number}${tableSectionName ? ` (${tableSectionName})` : ''}`, charsPerLine) + '\n';
      } else if (bill.customerName) {
        content += this.centerText(`Customer: ${bill.customerName}`, charsPerLine) + '\n';
      }
      
      content += '-'.repeat(charsPerLine) + '\n';
    }

    // الطلبات
    if (bill.orders && bill.orders.length > 0) {
      content += 'ORDERS\n';
      content += '-'.repeat(charsPerLine) + '\n';
      
      const aggregatedItems = aggregateItemsWithPayments(
        bill.orders,
        bill.itemPayments,
        bill.status,
        bill.paid,
        bill.total
      );

      aggregatedItems.forEach(item => {
        const variant = item.variant;
        const variantText = variant && variant !== 'عادي' ? ` (${variant})` : '';
        const name = item.name + variantText;
        const qty = item.totalQuantity;
        const paidQty = item.paidQuantity;
        const total = item.price * item.totalQuantity;
        
        content += `${name}\n`;
        content += `Qty: ${qty} | Paid: ${paidQty} | Total: ${total}\n`;
      });
      
      content += '-'.repeat(charsPerLine) + '\n';
    }

    // الجلسات
    if (bill.sessions && bill.sessions.length > 0) {
      content += 'SESSIONS\n';
      content += '-'.repeat(charsPerLine) + '\n';
      
      bill.sessions.forEach(session => {
        const startTime = new Date(session.startTime);
        const endTime = session.endTime ? new Date(session.endTime) : new Date();
        const durationInMinutes = Math.floor((endTime.getTime() - startTime.getTime()) / (1000 * 60));
        const hours = Math.floor(durationInMinutes / 60);
        const minutes = durationInMinutes % 60;
        
        let durationText = '';
        if (language === 'ar') {
          durationText = hours > 0 && minutes > 0 ? `${hours}س ${minutes}د` : hours > 0 ? `${hours}س` : `${minutes}د`;
        } else {
          durationText = hours > 0 && minutes > 0 ? `${hours}h ${minutes}m` : hours > 0 ? `${hours}h` : `${minutes}m`;
        }
        
        const finalCost = session.finalCost || session.totalCost || 0;
        content += `${session.deviceName || session.deviceNumber}: ${durationText} - ${finalCost}\n`;
      });
      
      content += '-'.repeat(charsPerLine) + '\n';
    }

    // الإجماليات
    content += 'TOTALS\n';
    content += '-'.repeat(charsPerLine) + '\n';
    
    if (bill.discount && bill.discount > 0) {
      content += `Discount: ${bill.discount}\n`;
    }
    if (bill.tax && bill.tax > 0) {
      content += `Tax: ${bill.tax}\n`;
    }
    
    content += `TOTAL: ${bill.total || 0}\n`;
    content += `PAID: ${bill.paid || 0}\n`;
    content += `REMAINING: ${bill.remaining || 0}\n`;

    // التذييل
    if (printSettings.printFooter !== false) {
      content += '-'.repeat(charsPerLine) + '\n';
      content += this.centerText('Thank you for your visit!', charsPerLine) + '\n';
    }

    return content;
  }

  /**
   * توليد محتوى الطلب للطباعة
   */
  async generateOrderContent(order, organization, language, printSettings) {
    const orgName = organization?.name || 'Cafe Management System';
    const charsPerLine = printSettings.charactersPerLine || 48;

    let content = '';

    content += this.centerText(orgName, charsPerLine) + '\n';
    content += this.centerText(`Order #${order.orderNumber || ''}`, charsPerLine) + '\n';
    content += this.centerText(new Date(order.createdAt || new Date()).toLocaleString(language), charsPerLine) + '\n';
    
    if (order.table?.number) {
      content += this.centerText(`Table: ${order.table.number}`, charsPerLine) + '\n';
    }
    
    content += '-'.repeat(charsPerLine) + '\n';

    if (order.items && order.items.length > 0) {
      order.items.forEach(item => {
        content += `${item.name}\n`;
        content += `Qty: ${item.quantity} | Price: ${item.price}\n`;
      });
    }

    content += '-'.repeat(charsPerLine) + '\n';
    content += `Total: ${order.totalAmount || order.subtotal || 0}\n`;

    return content;
  }

  /**
   * توليد محتوى تقرير الاستهلاك للطباعة
   */
  async generateConsumptionReportContent(reportData, organization, language, printSettings) {
    const orgName = organization?.name || 'Cafe Management System';
    const charsPerLine = printSettings.charactersPerLine || 48;

    let content = '';

    content += this.centerText(orgName, charsPerLine) + '\n';
    content += this.centerText('Consumption Report', charsPerLine) + '\n';
    content += this.centerText(new Date().toLocaleString(language), charsPerLine) + '\n';
    content += '-'.repeat(charsPerLine) + '\n';

    if (reportData.items && reportData.items.length > 0) {
      reportData.items.forEach(item => {
        content += `${item.name}\n`;
        content += `Sold: ${item.soldQuantity} | Consumed: ${item.consumedQuantity}\n`;
      });
    }

    content += '-'.repeat(charsPerLine) + '\n';
    content += `Total Sales: ${reportData.totalSales || 0}\n`;
    content += `Total Consumption: ${reportData.totalConsumption || 0}\n`;

    return content;
  }

  /**
   * توسيط النص
   */
  centerText(text, width) {
    const textLength = text.length;
    const padding = Math.floor((width - textLength) / 2);
    return ' '.repeat(Math.max(0, padding)) + text;
  }

  /**
   * كشف الطابعات المتاحة
   */
  async detectPrinters(req, res) {
    try {
      const { printerType = 'usb' } = req.query;
      let printers = [];
      if (printerType === 'usb') printers = await printerDetectionService.detectUSBPrinters();
      else if (printerType === 'network') printers = await printerDetectionService.detectNetworkPrinters();
      return res.json({ success: true, printers, count: printers.length });
    } catch (error) {
      console.error('Error detecting printers:', error);
      return res.json({ success: true, printers: [], count: 0, warning: error.message });
    }
  }

  /**
   * اختبار اتصال طابعة
   */
  async testPrinter(req, res) {
    try {
      const { printerPath, printerType = 'usb' } = req.body;
      if (!printerPath) return res.status(400).json({ success: false, message: 'Printer path is required' });
      const organizationId = req.user.organization?._id || req.user.organization;
      let printSettings = { printerType, printerDevice: printerPath };
      if (organizationId) {
        try {
          const org = await Organization.findById(organizationId).select('printSettings');
          if (org?.printSettings) printSettings = { ...org.printSettings, printerDevice: printerPath, printerType };
        } catch {}
      }
      const connected = await printerService.initializePrinter(printSettings);
      if (!connected) return res.json(await printerDetectionService.testPrinterConnection(printerPath, printerType));
      const testContent = '\n' + 'الطباعة نجحت'.padStart(24) + '\n' + new Date().toLocaleString('ar-EG') + '\n\n\n';
      const result = await printerService.printDocument(testContent, false, true);
      await printerService.disconnect();
      if (result.success) return res.json({ success: true, message: 'تمت طباعة ورقة الاختبار بنجاح' });
      const fallback = await printerDetectionService.testPrinterConnection(printerPath, printerType);
      return res.json(fallback);
    } catch (error) {
      console.error('Error testing printer:', error);
      return res.status(500).json({ 
        success: false, 
        message: 'Failed to test printer',
        error: error.message
      });
    }
  }

  /**
   * حفظ إعدادات الطابعة للجهاز الحالي
   */
  async saveDevicePrinter(req, res) {
    try {
      const { printerPath, printerName, deviceId } = req.body;
      const userId = req.user._id;

      if (!printerPath || !printerName) {
        return res.status(400).json({ 
          success: false, 
          message: 'Printer path and name are required' 
        });
      }

      const organizationId = req.user.organization?._id || req.user.organization;
      if (!organizationId) return res.status(400).json({ success: false, message: 'User not linked to organization' });
      const organization = await Organization.findById(organizationId);
      if (!organization) return res.status(404).json({ success: false, message: 'Organization not found' });

      // حفظ إعدادات الطابعة للجهاز
      await printerDetectionService.savePrinterForDevice(
        organization, 
        userId, 
        deviceId || 'default', 
        printerPath, 
        printerName
      );

      return res.json({ 
        success: true, 
        message: 'Printer settings saved successfully' 
      });
    } catch (error) {
      console.error('Error saving device printer:', error);
      return res.status(500).json({ 
        success: false, 
        message: 'Failed to save printer settings',
        error: error.message
      });
    }
  }

  /**
   * الحصول على إعدادات الطابعة للجهاز الحالي
   */
  async getDevicePrinter(req, res) {
    try {
      const userId = req.user._id;
      const { deviceId = 'default' } = req.query;

      const organizationId = req.user.organization?._id || req.user.organization;
      if (!organizationId) return res.status(400).json({ success: false, message: 'User not linked to organization' });
      const organization = await Organization.findById(organizationId);
      if (!organization) return res.status(404).json({ success: false, message: 'Organization not found' });

      const devicePrinter = await printerDetectionService.getPrinterForDevice(
        organization, 
        userId, 
        deviceId
      );

      return res.json({ 
        success: true, 
        printer: devicePrinter 
      });
    } catch (error) {
      console.error('Error getting device printer:', error);
      return res.status(500).json({ 
        success: false, 
        message: 'Failed to get printer settings',
        error: error.message
      });
    }
  }

  /**
   * فتح درج الكاشير فقط (بدون طباعة)
   */
  async openCashDrawerOnly(req, res) {
    try {
      const { organization } = req.body;

      if (!organization) {
        return res.status(400).json({ 
          success: false, 
          message: 'Organization data is required' 
        });
      }

      // الحصول على إعدادات الطابعة من المنشأة
      let printSettings = {};
      if (organization) {
        if (typeof organization === 'object' && organization.printSettings) {
          printSettings = organization.printSettings;
        } else if (typeof organization === 'string') {
          const org = await Organization.findById(organization);
          if (org) {
            printSettings = org.printSettings || {};
          }
        }
      }

      // التحقق من أن الطابعة معدة وأن فتح الدفع مفعلاً
      if (!printSettings || printSettings.printerType === 'none') {
        return res.status(400).json({ 
          success: false, 
          message: 'Printer not configured' 
        });
      }

      if (printSettings.openCashDrawerOnPayment === false) {
        return res.status(400).json({ 
          success: false, 
          message: 'Cash drawer opening on payment is disabled in settings' 
        });
      }

      // تهيئة الطابعة
      const connected = await printerService.initializePrinter(printSettings);
      if (!connected) {
        return res.status(500).json({ 
          success: false, 
          message: 'Failed to connect to printer' 
        });
      }

      // فتح درج الكاشير فقط
      const result = await printerService.openCashDrawer();

      // إغلاق الاتصال بالطابعة
      await printerService.disconnect();

      if (result) {
        return res.json({ 
          success: true, 
          message: 'Cash drawer opened successfully' 
        });
      } else {
        return res.status(500).json({ 
          success: false, 
          message: 'Failed to open cash drawer' 
        });
      }
    } catch (error) {
      console.error('Error opening cash drawer:', error);
      await printerService.disconnect();
      return res.status(500).json({ 
        success: false, 
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  /**
   * اكتشاف تلقائي للطابعة وربطها بالمستخدم الحالي
   */
  async autoDetectPrinter(req, res) {
    try {
      const userId = req.user._id;
      const { deviceId = 'default' } = req.body;
      const organizationId = req.user.organization?._id || req.user.organization;
      if (!organizationId) return res.status(400).json({ success: false, message: 'User not linked to organization' });
      const organization = await Organization.findById(organizationId);
      if (!organization) return res.status(404).json({ success: false, message: 'Organization not found' });

      const result = await printerDetectionService.autoDetectPrinterForUser(
        organization, 
        userId, 
        deviceId
      );

      return res.json(result);
    } catch (error) {
      console.error('Error auto-detecting printer:', error);
      return res.status(500).json({ 
        success: false, 
        message: 'Failed to auto-detect printer',
        error: error.message
      });
    }
  }

  /**
   * اكتشاف تلقائي وطباعة الفاتورة مباشرة
   * بدون الحاجة لتحديد الطابعة في الإعدادات
   */
  async autoDetectAndPrintBill(req, res) {
    try {
      const { bill, organization, language = 'ar', tableSectionName } = req.body;

      if (!bill) {
        return res.status(400).json({ success: false, message: 'Bill data is required' });
      }

      // 1. كشف الطابعات المتصلة
      console.log('Auto-detecting thermal printer...');
      const detectedPrinters = await printerDetectionService.detectUSBPrinters();
      
      if (!detectedPrinters || detectedPrinters.length === 0) {
        return res.status(400).json({ 
          success: false, 
          message: 'No thermal printer detected. Please connect a thermal printer.' 
        });
      }

      console.log('Detected printers:', detectedPrinters);

      // 2. اختيار أول طابعة متصلة (يفترض أنها طابعة حرارية)
      const selectedPrinter = detectedPrinters[0];
      console.log('Selected printer:', selectedPrinter.name, 'at port:', selectedPrinter.path);

      // 3. إعداد إعدادات الطابعة المكتشفة تلقائياً
      const autoDetectedSettings = {
        printerType: 'usb',
        printerDevice: selectedPrinter.path,
        printerName: selectedPrinter.driver || selectedPrinter.name,
        printerIP: null,
        printerPort: null,
        printerModel: 'epson',
        autoCut: true,
        openCashDrawer: true
      };

      // 4. تهيئة الطابعة بالإعدادات المكتشفة
      const connected = await printerService.initializePrinter(autoDetectedSettings);
      if (!connected) {
        return res.status(500).json({ 
          success: false, 
          message: 'Failed to connect to detected printer. Please try again.' 
        });
      }

      // 5. توليد محتوى الفاتورة للطباعة
      const content = await this.generateBillContent(bill, organization, language, tableSectionName, autoDetectedSettings);

      // 6. طباعة الفاتورة مع فتح درج الكاشير
      const result = await printerService.printDocument(content, true, true);

      // 7. إغلاق الاتصال بالطابعة
      await printerService.disconnect();

      if (result.success) {
        return res.json({ 
          success: true, 
          message: 'Bill printed successfully',
          cashDrawerOpened: true,
          printerUsed: selectedPrinter.name
        });
      } else {
        return res.status(500).json({ 
          success: false, 
          message: 'Failed to print bill',
          error: result.error
        });
      }
    } catch (error) {
      console.error('Error in autoDetectAndPrintBill:', error);
      await printerService.disconnect();
      return res.status(500).json({ 
        success: false, 
        message: 'Internal server error during auto-detect printing',
        error: error.message
      });
    }
  }

  /**
   * اكتشاف تلقائي وطباعة الطلب مباشرة
   * بدون الحاجة لتحديد الطابعة في الإعدادات
   */
  async autoDetectAndPrintOrder(req, res) {
    try {
      const { order, organization, language = 'ar' } = req.body;

      if (!order) {
        return res.status(400).json({ success: false, message: 'Order data is required' });
      }

      // 1. كشف الطابعات المتصلة
      console.log('Auto-detecting thermal printer for order...');
      const detectedPrinters = await printerDetectionService.detectUSBPrinters();
      
      if (!detectedPrinters || detectedPrinters.length === 0) {
        return res.status(400).json({ 
          success: false, 
          message: 'No thermal printer detected. Please connect a thermal printer.' 
        });
      }

      console.log('Detected printers:', detectedPrinters);

      // 2. اختيار أول طابعة متصلة
      const selectedPrinter = detectedPrinters[0];
      console.log('Selected printer for order:', selectedPrinter.name, 'at port:', selectedPrinter.path);

      // 3. إعداد إعدادات الطابعة المكتشفة تلقائياً
      const autoDetectedSettings = {
        printerType: 'usb',
        printerDevice: selectedPrinter.path,
        printerName: selectedPrinter.driver || selectedPrinter.name,
        printerIP: null,
        printerPort: null,
        printerModel: 'epson',
        autoCut: true,
        openCashDrawer: false
      };

      // 4. تهيئة الطابعة بالإعدادات المكتشفة
      const connected = await printerService.initializePrinter(autoDetectedSettings);
      if (!connected) {
        return res.status(500).json({ 
          success: false, 
          message: 'Failed to connect to detected printer. Please try again.' 
        });
      }

      // 5. توليد محتوى الطلب للطباعة
      const content = await this.generateOrderContent(order, organization, language, autoDetectedSettings);

      // 6. طباعة الطلب بدون فتح درج الكاشير
      const result = await printerService.printDocument(content, false, true);

      // 7. إغلاق الاتصال بالطابعة
      await printerService.disconnect();

      if (result.success) {
        return res.json({ 
          success: true, 
          message: 'Order printed successfully',
          printerUsed: selectedPrinter.name
        });
      } else {
        return res.status(500).json({ 
          success: false, 
          message: 'Failed to print order',
          error: result.error
        });
      }
    } catch (error) {
      console.error('Error in autoDetectAndPrintOrder:', error);
      await printerService.disconnect();
      return res.status(500).json({ 
        success: false, 
        message: 'Internal server error during auto-detect order printing',
        error: error.message
      });
    }
  }
}

export default new PrintController();