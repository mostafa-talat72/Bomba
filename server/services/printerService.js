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

/**
 * Minimal windows-1256 encoder (code point -> byte).
 * Node's Buffer has no cp1256 codec, and Buffer.from(text, 'cp1256') throws
 * ERR_UNKNOWN_ENCODING — which used to kill the entire print job.
 * Only entries verified against the windows-1256 table are included;
 * anything else becomes '?' (0x3F) instead of crashing.
 * Arabic-Indic digits (٠-٩, U+0660-69) and extended digits (U+06F0-F9) are
 * mapped to ASCII 0-9 since cp1256 has no glyphs for them.
 */
const CP1256_TABLE = new Map([
  [0x20AC, 0x80], [0x067E, 0x81], [0x201A, 0x82], [0x0192, 0x83],
  [0x201E, 0x84], [0x2026, 0x85], [0x2020, 0x86], [0x2021, 0x87],
  [0x02C6, 0x88], [0x2030, 0x89], [0x0679, 0x8A], [0x2039, 0x8B],
  [0x0152, 0x8C], [0x0686, 0x8D], [0x0698, 0x8E], [0x0688, 0x8F],
  [0x06AF, 0x90], [0x2018, 0x91], [0x2019, 0x92], [0x201C, 0x93],
  [0x201D, 0x94], [0x2022, 0x95], [0x2013, 0x96], [0x2014, 0x97],
  [0x06BE, 0x98], [0x2122, 0x99], [0x0691, 0x9A], [0x203A, 0x9B],
  [0x0153, 0x9C], [0x200C, 0x9D], [0x200D, 0x9E], [0x06BA, 0x9F],
  [0x00A0, 0xA0], [0x060C, 0xA1], [0x00A2, 0xA2], [0x00A3, 0xA3],
  [0x00A4, 0xA4], [0x00A5, 0xA5], [0x00A6, 0xA6], [0x00A7, 0xA7],
  [0x00A8, 0xA8], [0x00A9, 0xA9], [0x06C1, 0xAA], [0x00AB, 0xAB],
  [0x00AC, 0xAC], [0x00AD, 0xAD], [0x00AE, 0xAE], [0x00AF, 0xAF],
  [0x00B0, 0xB0], [0x00B1, 0xB1], [0x00B2, 0xB2], [0x00B3, 0xB3],
  [0x00B4, 0xB4], [0x00B5, 0xB5], [0x00B6, 0xB6], [0x00B7, 0xB7],
  [0x00B8, 0xB8], [0x00B9, 0xB9], [0x00BB, 0xBB], [0x00BC, 0xBC],
  [0x00BD, 0xBD], [0x00BE, 0xBE], [0x061F, 0xBF],
  [0x06C0, 0xC0], [0x0621, 0xC1], [0x0622, 0xC2], [0x0623, 0xC3],
  [0x0624, 0xC4], [0x0625, 0xC5], [0x0626, 0xC6], [0x0627, 0xC7],
  [0x0628, 0xC8], [0x0629, 0xC9], [0x062A, 0xCA], [0x062B, 0xCB],
  [0x062C, 0xCC], [0x062D, 0xCD], [0x062E, 0xCE], [0x062F, 0xCF],
  [0x0630, 0xD0], [0x0631, 0xD1], [0x0632, 0xD2], [0x0633, 0xD3],
  [0x0634, 0xD4], [0x0635, 0xD5], [0x0636, 0xD6], [0x0637, 0xD7],
  [0x0638, 0xD8], [0x0639, 0xD9], [0x063A, 0xDA], [0x0640, 0xDB],
  [0x0641, 0xDC], [0x0642, 0xDD], [0x0643, 0xDE], [0x0644, 0xDF],
  [0x0645, 0xE0], [0x0646, 0xE1], [0x0647, 0xE2], [0x0648, 0xE3],
  [0x0649, 0xE4], [0x064A, 0xE5], [0x064B, 0xE6], [0x064C, 0xE7],
  [0x064D, 0xE8], [0x064E, 0xE9], [0x064F, 0xEA], [0x0650, 0xEB],
  [0x0651, 0xEC], [0x0652, 0xED], [0x06D2, 0xFF],
]);

function encodeCp1256(str) {
  const out = [];
  for (const ch of String(str ?? '')) {
    const cp = ch.codePointAt(0);
    if (cp < 0x80) {
      out.push(cp);
      continue;
    }
    if (cp === 0xFEFF) continue; // drop BOM
    if (cp >= 0x0660 && cp <= 0x0669) { out.push(0x30 + (cp - 0x0660)); continue; }
    if (cp >= 0x06F0 && cp <= 0x06F9) { out.push(0x30 + (cp - 0x06F0)); continue; }
    if (cp === 0x066A) { out.push(0x25); continue; } // ٪ -> %
    const b = CP1256_TABLE.get(cp);
    out.push(b === undefined ? 0x3F : b); // '?' instead of crashing
  }
  return Buffer.from(out);
}

class PrinterService {
  constructor() {
    this.printer = null;
    this.isConnected = false;
    // Serializes all thermal-printer access (concurrent phone+desktop jobs
    // must never interleave on one USB device) and backs the warm connection.
    this._printQueue = Promise.resolve();
    this._cachedKey = null;
  }

  _cacheKeyFor(printSettings = {}) {
    return [
      printSettings.printerType || '',
      printSettings.printerDevice || '',
      printSettings.printerIP || '',
      printSettings.printerPort || '',
      printSettings.printerName || printSettings.name || '',
      printSettings.printerModel || printSettings.model || '',
    ].join('|');
  }

  /**
   * Ensure a live connection, reusing the warm one when settings match.
   * Skips the USB handshake (~0.2-1s) on every request after the first.
   */
  async ensureConnected(printSettings) {
    const key = this._cacheKeyFor(printSettings);
    if (this.printer && this.isConnected && this._cachedKey === key) return true;
    try { await this.disconnect(); } catch {}
    const ok = await this.initializePrinter(printSettings);
    this._cachedKey = ok ? key : null;
    return ok;
  }

  /**
   * Print one job: serialized behind other jobs, warm connection reused.
   * Never throws — always resolves { success, ... }.
   */
  async printJob(printSettings, { content, openDrawer = false, autoCut = false, docName } = {}) {
    const run = async () => {
      try {
        const ok = await this.ensureConnected(printSettings);
        if (!ok) return { success: false, error: 'Failed to connect to printer' };
        const result = await this.printDocument(content, openDrawer, autoCut, docName);
        if (!result.success) {
          // Stale handle (e.g. printer was unplugged): force a fresh
          // handshake on the next job instead of reusing a dead connection.
          this._cachedKey = null;
          this.isConnected = false;
        }
        return result;
      } catch (error) {
        this._cachedKey = null;
        this.isConnected = false;
        return { success: false, error: error.message };
      }
    };
    this._printQueue = this._printQueue.then(run, run);
    return this._printQueue;
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
      this.winPrinterNames = null;
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
          // أسماء بديلة للتجربة بالترتيب (الاسم الأساسي أولاً ثم بقية الطابعات المكتشفة)
          const extraNames = Array.isArray(printSettings.printerNameCandidates) ? printSettings.printerNameCandidates : [];
          this.winPrinterNames = [this.winPrinterName, ...extraNames]
            .map((n) => String(n || '').replace(/^printer:/, '').trim())
            .filter(Boolean)
            .filter((n, i, a) => a.indexOf(n) === i);
          iface = path.join(os.tmpdir(), `mte-print-${Date.now()}.bin`);
          this.winUseRawFallback = true;
          console.log(`Windows raw fallback: buffer -> ${iface} -> Out-Printer "${this.winPrinterNames.join('", "')}"`);
        }
      } else if (!iface) {
        console.log('Printer device not configured, skipping direct print');
        return false;
      }
      this.printer = new ThermalPrinter({
        type: printerModel,
        interface: iface,
        driver: printerDriver,
        characterSet: 'WPC1256_ARABIC',
        options: { timeout: 3000 }
      });
      if (typeof this.printer?.setCharacterSet === 'function') {
        try {
          this.printer.setCharacterSet('WPC1256_ARABIC');
        } catch (error) {
          console.warn('Printer character set fallback not supported:', error.message);
        }
      }
      if (typeof this.printer?.setEncoding === 'function') {
        try {
          this.printer.setEncoding('CP1256');
        } catch (error) {
          console.warn('Printer encoding fallback not supported:', error.message);
        }
      }
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
  getPrinterEncoding(language = 'ar') {
    return language === 'ar' ? 'cp1256' : 'cp1252';
  }

  /**
   * Encode text for the thermal printer WITHOUT crashing.
   * Node's Buffer has no cp1256/cp1252 codecs, so Arabic goes through an
   * internal windows-1256 table; anything unmappable becomes '?' (0x3F)
   * instead of throwing ERR_UNKNOWN_ENCODING and killing the whole job.
   */
  encodePrinterText(text, language = 'ar') {
    const normalized = String(text ?? '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    if (language === 'ar') return encodeCp1256(normalized);
    try {
      return Buffer.from(normalized, this.getPrinterEncoding(language));
    } catch (error) {
      console.warn('Falling back to latin1 encoding for printer output:', error.message);
      return Buffer.from(normalized, 'latin1');
    }
  }

  buildWindowsRawPrintBuffer(content, { openDrawer = false, autoCut = false, language = 'ar' } = {}) {
    const normalized = String(content ?? '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const textBuffer = this.encodePrinterText(normalized, language);
    const chunks = [];
    chunks.push(Buffer.from([0x1b, 0x40]));
    // ESC t 50 = WPC1256 عربي (مطابق للمسار المباشر setCharacterSet('WPC1256_ARABIC')).
    // القيمة السابقة 17 كانت PC866 سيريلي — سبب الحروف المشفرة.
    chunks.push(Buffer.from([0x1b, 0x74, 50]));
    chunks.push(textBuffer);
    if (openDrawer) {
      chunks.push(Buffer.from([0x1b, 0x70, 0x00, 0x19, 0xfa]));
    }
    if (autoCut) {
      // نفس تسلسل cut()‎ في node-thermal-printer: تغذية قبل القص ثم قص ثم تهيئة.
      chunks.push(Buffer.from([0x0a, 0x0a, 0x0a]));
      chunks.push(Buffer.from([0x1d, 0x56, 0x00]));
      chunks.push(Buffer.from([0x1b, 0x40]));
    } else {
      chunks.push(Buffer.from([0x0a, 0x0a, 0x0a]));
    }
    return Buffer.concat(chunks);
  }

  toRawPrinterBuffer(text, language = 'ar') {
    return this.encodePrinterText(text, language);
  }

  /**
   * إرسال buffer جاهز إلى طابعة ويندوز عبر winspool RAW (PowerShell)، مع
   * تجربة كل الأسماء المرشحة بالترتيب. تُستخدم للطباعة وفتح الدرج معاً.
   */
  async _sendBufferViaWindowsRaw(buffer, docName = 'MTE Receipt') {
    const filePath = path.join(os.tmpdir(), `mte-print-${Date.now()}.bin`);
    fs.writeFileSync(filePath, buffer);
    try {
      const escapedPath = filePath.replace(/'/g, "''");
      // اسم المهمة في قائمة طابعة ويندوز — ديناميكي حسب نوع المستند.
      // هروب لمصفوفة C# بين علامتي تنصيص.
      const escapedDocName = String(docName || 'MTE Receipt').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
      const nameList = (Array.isArray(this.winPrinterNames) && this.winPrinterNames.length
        ? this.winPrinterNames
        : [this.winPrinterName]).filter(Boolean);
      const escapedNames = nameList.map((n) => `'${String(n).replace(/'/g, "''")}'`).join(', ');
      const rawPrintScript = `
$bytes = [System.IO.File]::ReadAllBytes('${escapedPath}')
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public static class RawPrint {
  [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)]
  public class DocInfo { public string DocName; public string OutputFile; public string DataType; }
  [DllImport("winspool.drv", CharSet=CharSet.Unicode, SetLastError=true)]
  static extern bool OpenPrinter(string name, out IntPtr handle, IntPtr defaults);
  [DllImport("winspool.drv", SetLastError=true)] static extern bool ClosePrinter(IntPtr handle);
  [DllImport("winspool.drv", CharSet=CharSet.Unicode, SetLastError=true)]
  static extern int StartDocPrinter(IntPtr handle, int level, DocInfo info);
  [DllImport("winspool.drv", SetLastError=true)] static extern bool EndDocPrinter(IntPtr handle);
  [DllImport("winspool.drv", SetLastError=true)] static extern bool StartPagePrinter(IntPtr handle);
  [DllImport("winspool.drv", SetLastError=true)] static extern bool EndPagePrinter(IntPtr handle);
  [DllImport("winspool.drv", SetLastError=true)]
  static extern bool WritePrinter(IntPtr handle, byte[] bytes, int count, out int written);
  public static bool Send(string name, byte[] bytes) {
    IntPtr handle;
    if (!OpenPrinter(name, out handle, IntPtr.Zero)) return false;
    try {
      var info = new DocInfo { DocName = "${escapedDocName}", DataType = "RAW" };
      if (StartDocPrinter(handle, 1, info) == 0 || !StartPagePrinter(handle)) return false;
      int written;
      var ok = WritePrinter(handle, bytes, bytes.Length, out written);
      EndPagePrinter(handle); EndDocPrinter(handle);
      return ok && written == bytes.Length;
    } finally { ClosePrinter(handle); }
  }
}
"@
$names = @(${escapedNames})
$sent = $false
foreach ($n in $names) { if ([RawPrint]::Send($n, $bytes)) { $sent = $true; break } }
if (-not $sent) { throw 'Raw print failed' }
`;
      const encodedScript = Buffer.from(rawPrintScript, 'utf16le').toString('base64');
      await execPromise(`powershell -NoProfile -EncodedCommand ${encodedScript}`, { timeout: 10000 });
    } finally {
      try { fs.unlinkSync(filePath); } catch {}
    }
  }

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

      const language = options.language || 'ar';
      const printBuffer = this.toRawPrinterBuffer(text, language);
      this.printer.raw(printBuffer);
      this.printer.raw(Buffer.from('\n'));

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
     this.printer.raw(this.toRawPrinterBuffer(separator, 'ar'));
     this.printer.raw(Buffer.from('\n'));
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
     this.printer.raw(this.toRawPrinterBuffer(headerRow, 'ar'));
     this.printer.raw(Buffer.from('\n'));
     this.printer.bold(false);

     // طباعة الصفوف
     rows.forEach(row => {
       let rowText = '';
       row.forEach((cell, index) => {
         const width = columnWidths[index] || 10;
         rowText += this.padText(cell, width);
       });
       this.printer.raw(this.toRawPrinterBuffer(rowText, 'ar'));
       this.printer.raw(Buffer.from('\n'));
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
    // وضع RAW الاحتياطي (بدون حزمة printer الأصلية): نبضة درج عبر winspool مباشرة.
    if (this.winUseRawFallback) {
      try {
        const drawerBuffer = this.buildWindowsRawPrintBuffer('', { openDrawer: true, autoCut: false, language: 'ar' });
        await this._sendBufferViaWindowsRaw(drawerBuffer, 'Cash Drawer');
        console.log('Cash drawer opened successfully (Windows raw fallback)');
        return true;
      } catch (error) {
        console.error('Error opening cash drawer (Windows raw fallback):', error.message);
        return false;
      }
    }
    try {
      this.printer.raw(Buffer.from([
        0x1B, 0x70, 0x00, 0x19, 0xFA,
        0x1B, 0x70, 0x01, 0x19, 0xFA,
      ]));
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
  async printDocument(content, openDrawer = false, autoCut = false, docName = 'MTE Receipt') {
    if (!this.isConnected || !this.printer) {
      console.log('Printer not connected');
      return { success: false, error: 'Printer not connected' };
    }
    try {
      const printLanguage = typeof content === 'string' && /[\u0600-\u06FF]/.test(content) ? 'ar' : 'en';

      if (this.winUseRawFallback) {
        const rawBuffer = this.buildWindowsRawPrintBuffer(content, {
          openDrawer,
          autoCut,
          language: printLanguage
        });

        await this._sendBufferViaWindowsRaw(rawBuffer, docName);

        if (openDrawer) console.log('Cash drawer opened successfully');
        console.log('Document printed successfully');
        return { success: true, cashDrawerTried: openDrawer };
      }

      const printBuffer = this.toRawPrinterBuffer(content, printLanguage);
      this.printer.raw(printBuffer);
      if (openDrawer) await this.openCashDrawer(false);
      if (autoCut) await this.cutPaper();
      else await this.feedLines(3);
      await this.printer.execute();
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
        this._cachedKey = null;
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