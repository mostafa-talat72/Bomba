import pkg from 'node-thermal-printer';
import { Buffer } from 'buffer';
import { createRequire } from 'module';
import os from 'os';
import path from 'path';
import fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
const execPromise = promisify(exec);
const ThermalPrinter = pkg.ThermalPrinter || pkg.printer || pkg.default?.ThermalPrinter || pkg.default?.printer;
const PrinterTypes = pkg.types || pkg.Types || pkg.default?.types || { EPSON: 'epson' };
let printerDriver = null;
try {
  const require = createRequire(import.meta.url);
  printerDriver = require('printer');
} catch { printerDriver = null; }

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
      const printerModel = printSettings.printerModel || printSettings.model || PrinterTypes.EPSON || 'epson';
      let iface = printSettings.printerDevice || '';
      const printerName = printSettings.printerName || printSettings.name || '';
      this.winPrinterName = null;
      this.winUseRawFallback = false;
      if (printSettings.printerType === 'network' && printSettings.printerIP) {
        iface = `tcp://${printSettings.printerIP}:${printSettings.printerPort || 9100}`;
      } else if (process.platform === 'win32' && printSettings.printerType === 'usb') {
        if (printerDriver) {
          if (printerName) iface = `printer:${printerName}`;
          else if (iface && !iface.startsWith('printer:') && !iface.startsWith('tcp://')) iface = `printer:${iface}`;
        } else {
          // بدون حزمة printer الأصلية — استخدم ملف مؤقت ثم أرسله عبر PowerShell Out-Printer
          this.winPrinterName = printerName || iface || 'XP-80C';
          if (this.winPrinterName.startsWith('printer:')) this.winPrinterName = this.winPrinterName.slice(8);
          iface = path.join(os.tmpdir(), `mte-print-${Date.now()}.bin`);
          this.winUseRawFallback = true;
          console.log(`Windows raw fallback: buffer -> ${iface} -> Out-Printer "${this.winPrinterName}"`);
        }
      } else if (!iface) {
        console.log('Printer device not configured, skipping direct print');
        return false;
      }
      this.printer = new ThermalPrinter({
        type: printerModel,
        interface: iface,
        driver: printerDriver,
        options: { timeout: 1000 }
      });
      if (this.winUseRawFallback) {
        // لا نتحقق من وجود الملف قبل الكتابة
        this.isConnected = true;
        console.log('Printer initialized in Windows raw fallback mode');
        return true;
      }
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
   * @param {boolean} executeNow - إذا true ينفذ فوراً، إذا false يضيف الأمر للمخزن فقط (يُستعمل داخل printDocument)
   */
  async openCashDrawer(executeNow = true) {
    if (!this.isConnected || !this.printer) {
      console.log('Printer not connected, cannot open cash drawer');
      return false;
    }
    try {
      this.printer.raw(Buffer.from([0x1B, 0x70, 0x00, 0x19, 0xFA]));
      if (executeNow) {
        await this.printer.execute();
        console.log('Cash drawer opened successfully');
      }
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
      this.printer.println(content);
      if (openDrawer) await this.openCashDrawer(false);
      if (autoCut) await this.cutPaper();
      else await this.feedLines(3);
      await this.printer.execute();
      if (this.winUseRawFallback) {
        // أرسل الملف المؤقت إلى الطابعة الحقيقية عبر PowerShell
        try {
          const tmpFile = this.printer.Interface?.path || this.printer.interface;
          const filePath = typeof tmpFile === 'string' ? tmpFile : this.printer.Interface?.path;
          if (filePath && fs.existsSync(filePath)) {
            const ps = `powershell -Command "Get-Content -Path '${filePath.replace(/'/g, "''")}' -Encoding Byte -ReadCount 0 | Out-Printer -Name '${this.winPrinterName.replace(/'/g, "''")}'"`;
            await execPromise(ps, { timeout: 8000 });
            console.log(`Raw buffer sent to Windows printer "${this.winPrinterName}" via Out-Printer`);
            try { fs.unlinkSync(filePath); } catch {}
          }
        } catch (e) {
          console.error('Windows raw fallback print failed, trying direct file write:', e.message);
          // محاولة أخيرة: اكتب مباشرة إلى \\.\pipe أو استخدم print command
          throw e;
        }
      }
      if (openDrawer) console.log('Cash drawer opened successfully');
      console.log('Document printed successfully');
      return { success: true, cashDrawerTried: openDrawer };
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