import pkg from 'node-thermal-printer';
import { Buffer } from 'buffer';
const ThermalPrinter = pkg.ThermalPrinter || pkg.printer || pkg.default?.ThermalPrinter || pkg.default?.printer;
const PrinterTypes = pkg.types || pkg.Types || pkg.default?.types || { EPSON: 'epson' };

class PrinterService {
  constructor() {
    this.printer = null;
    this.isConnected = false;
  }

  /**
   * تهيئة الطابعة حسب إعدادات المنشأة
   */
  async initializePrinter(printSettings) {
    if (!printSettings || printSettings.printerType === 'none') {
      console.log('Printer not configured or disabled');
      return false;
    }

    try {
      // node-thermal-printer expects type = printer model (epson/star), not interface type
      const printerModel = printSettings.printerModel || printSettings.model || PrinterTypes.EPSON || 'epson';
      let iface = printSettings.printerDevice || '';
      if (printSettings.printerType === 'network' && printSettings.printerIP) {
        iface = `tcp://${printSettings.printerIP}:${printSettings.printerPort || 9100}`;
      } else if (!iface) {
        // No device configured - treat as not connected, will fallback to window print
        console.log('Printer device not configured, skipping direct print');
        return false;
      }
      this.printer = new ThermalPrinter({
        type: printerModel,
        interface: iface,
        options: {
          timeout: 1000
        }
      });

      // محاولة الاتصال بالطابعة
      const connected = await this.printer.isPrinterConnected();
      this.isConnected = connected;
      
      if (connected) {
        console.log('Printer connected successfully');
        return true;
      } else {
        console.log('Failed to connect to printer');
        return false;
      }
    } catch (error) {
      console.error('Error initializing printer:', error);
      this.isConnected = false;
      return false;
    }
  }

  /**
   * طباعة نص بسيط
   */
  async printText(text, options = {}) {
    if (!this.isConnected || !this.printer) {
      console.log('Printer not connected');
      return false;
    }

    try {
      if (options.align) {
        this.printer.align(options.align);
      }
      if (options.bold) {
        this.printer.bold(true);
      }
      if (options.underline) {
        this.printer.underline(true);
      }
      if (options.size) {
        this.printer.setTextSize(options.size);
      }

      this.printer.println(text);

      // إعادة تعيين التنسيقات
      this.printer.bold(false);
      this.printer.underline(false);
      this.printer.setTextSize(0);
      this.printer.align('LEFT');

      return true;
    } catch (error) {
      console.error('Error printing text:', error);
      return false;
    }
  }

  /**
   * طباعة خط فاصل
   */
  async printSeparator(char = '-', length = 48) {
    if (!this.isConnected || !this.printer) {
      return false;
    }

    try {
      const separator = char.repeat(length);
      this.printer.println(separator);
      return true;
    } catch (error) {
      console.error('Error printing separator:', error);
      return false;
    }
  }

  /**
   * طباعة جدول
   */
  async printTable(headers, rows, columnWidths) {
    if (!this.isConnected || !this.printer) {
      return false;
    }

    try {
      // طباعة الرأس
      this.printer.bold(true);
      let headerRow = '';
      headers.forEach((header, index) => {
        const width = columnWidths[index] || 10;
        headerRow += this.padText(header, width);
      });
      this.printer.println(headerRow);
      this.printer.bold(false);

      // طباعة الصفوف
      rows.forEach(row => {
        let rowText = '';
        row.forEach((cell, index) => {
          const width = columnWidths[index] || 10;
          rowText += this.padText(cell, width);
        });
        this.printer.println(rowText);
      });

      return true;
    } catch (error) {
      console.error('Error printing table:', error);
      return false;
    }
  }

  /**
   * تنسيق النص بعرض محدد
   */
  padText(text, width, align = 'left') {
    let paddedText = String(text).substring(0, width);
    
    if (align === 'center') {
      const padding = Math.floor((width - paddedText.length) / 2);
      paddedText = ' '.repeat(padding) + paddedText + ' '.repeat(width - padding - paddedText.length);
    } else if (align === 'right') {
      paddedText = ' '.repeat(width - paddedText.length) + paddedText;
    } else {
      paddedText = paddedText + ' '.repeat(width - paddedText.length);
    }
    
    return paddedText;
  }

  /**
   * فتح درج الكاشير
   */
  async openCashDrawer() {
    if (!this.isConnected || !this.printer) {
      console.log('Printer not connected, cannot open cash drawer');
      return false;
    }

    try {
      // إرسال أمر فتح درج الكاشير (ESC/POS command)
      // الأمر الصحيح: 1B700019FA (HEX) = [0x1B, 0x70, 0x00, 0x19, 0xFA]
      // ESC p m t1 t2 - حيث:
      // - 0x1B = ESC
      // - 0x70 = 'p' (pulse command)
      // - 0x00 = m (mode)
      // - 0x19 = t1 (25ms pulse duration)
      // - 0xFA = t2 (250ms pulse interval)
      this.printer.raw(Buffer.from([0x1B, 0x70, 0x00, 0x19, 0xFA]));
      await this.printer.execute();
      console.log('Cash drawer opened successfully');
      return true;
    } catch (error) {
      console.error('Error opening cash drawer:', error);
      return false;
    }
  }

  /**
   * قص الورق
   */
  async cutPaper() {
    if (!this.isConnected || !this.printer) {
      return false;
    }

    try {
      this.printer.cut();
      return true;
    } catch (error) {
      console.error('Error cutting paper:', error);
      return false;
    }
  }

  /**
   * إطلاق الورق (تغذية)
   */
  async feedLines(lines = 3) {
    if (!this.isConnected || !this.printer) {
      return false;
    }

    try {
      this.printer.feed(lines);
      return true;
    } catch (error) {
      console.error('Error feeding paper:', error);
      return false;
    }
  }

  /**
   * طباعة مستند كامل
   */
  async printDocument(content, openDrawer = false, autoCut = false) {
    if (!this.isConnected || !this.printer) {
      console.log('Printer not connected');
      return { success: false, error: 'Printer not connected' };
    }

    try {
      // طباعة المحتوى
      this.printer.println(content);

      // فتح درج الكاشير إذا طُلب
      if (openDrawer) {
        await this.openCashDrawer();
      }

      // قص الورق إذا طُلب
      if (autoCut) {
        await this.cutPaper();
      } else {
        await this.feedLines(3);
      }

      // تنفيذ الطباعة
      await this.printer.execute();
      
      console.log('Document printed successfully');
      return { success: true };
    } catch (error) {
      console.error('Error printing document:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * إغلاق الاتصال بالطابعة
   */
  async disconnect() {
    if (this.printer) {
      try {
        await this.printer.clear();
        this.isConnected = false;
        console.log('Printer disconnected');
      } catch (error) {
        console.error('Error disconnecting printer:', error);
      }
    }
  }

  /**
   * التحقق من حالة الاتصال
  */
  getConnectionStatus() {
    return this.isConnected;
  }
}

// تصدير نسخة واحدة من الخدمة
export default new PrinterService();