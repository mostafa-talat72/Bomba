import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);
let SerialPort = null;
let serialPortLoaded = false;
async function getSerialPort() {
  if (serialPortLoaded) return SerialPort;
  serialPortLoaded = true;
  try {
    const mod = await import('serialport');
    SerialPort = mod.SerialPort || mod.default?.SerialPort || null;
  } catch { SerialPort = null; }
  return SerialPort;
}

class PrinterDetectionService {
  /**
   * كشف الطابعات المتصلة عبر USB
   */
  async detectUSBPrinters() {
    try {
      const platform = process.platform;
      let printers = [];

      if (platform === 'win32') {
        printers = await this.detectWindowsPrinters();
      } else if (platform === 'darwin') {
        printers = await this.detectMacPrinters();
      } else if (platform === 'linux') {
        printers = await this.detectLinuxPrinters();
      }

      return printers;
    } catch (error) {
      console.error('Error detecting USB printers:', error);
      return [];
    }
  }

  /**
   * كشف الطابعات على Windows
   */
  async detectWindowsPrinters() {
    try {
      const fakeNames = ['Microsoft Print to PDF','Microsoft XPS','OneNote','Fax','PDF24','Adobe PDF','Google Cloud'];
      const command = `powershell "Get-Printer | Where-Object { $_.Type -eq 'Local' -and $_.PrinterStatus -eq 'Normal' -and -not $_.WorkOffline } | Select-Object Name, DriverName, PortName, PrinterStatus | ConvertTo-Json"`;
      const { stdout } = await execPromise(command);
      if (!stdout || stdout.trim() === '') return [];
      const printersData = JSON.parse(stdout);
      const printers = Array.isArray(printersData) ? printersData : [printersData];
      return printers
        .filter(p => !fakeNames.some(fake => (p.Name||'').includes(fake)))
        .map(printer => ({
          name: printer.Name,
          driver: printer.DriverName,
          port: printer.PortName,
          path: printer.PortName,
          type: 'usb',
          status: printer.PrinterStatus
        }));
    } catch (error) {
      console.error('Error detecting Windows printers:', error);
      return [];
    }
  }

  /**
   * كشف الطابعات على macOS
   */
  async detectMacPrinters() {
    try {
      const { stdout } = await execPromise('lpstat -p -d');
      const printers = [];
      const lines = stdout.split('\n');
      for (const line of lines) {
        if (line.startsWith('printer')) {
          const match = line.match(/printer\s+(\S+)\s+is\s+(.+)/);
          if (match && /idle/i.test(match[2])) {
            printers.push({ name: match[1], status: match[2], path: match[1], type: 'usb' });
          }
        }
      }
      return printers;
    } catch (error) {
      console.error('Error detecting Mac printers:', error);
      return [];
    }
  }

  /**
   * كشف الطابعات على Linux
   */
  async detectLinuxPrinters() {
    try {
      const { stdout } = await execPromise('lpstat -p -d');
      const printers = [];
      const lines = stdout.split('\n');
      for (const line of lines) {
        if (line.startsWith('printer')) {
          const match = line.match(/printer\s+(\S+)\s+is\s+(.+)/);
          if (match && /idle/i.test(match[2])) {
            printers.push({ name: match[1], status: match[2], path: match[1], type: 'usb' });
          }
        }
      }

      const SP = await getSerialPort();
      if (SP) {
        try {
          const ports = await SP.list();
          for (const port of ports) {
            if (port.manufacturer && (
              port.manufacturer.includes('Printer') ||
              port.manufacturer.includes('Epson') ||
              port.manufacturer.includes('Star') ||
              port.manufacturer.includes('POS') ||
              port.productId === '0x0403'
            )) {
              printers.push({
                name: port.manufacturer || 'Unknown Printer',
                path: port.path,
                vendorId: port.vendorId,
                productId: port.productId,
                type: 'usb'
              });
            }
          }
        } catch (serialError) {
          console.error('Error detecting serial ports:', serialError);
        }
      }

      return printers;
    } catch (error) {
      console.error('Error detecting Linux printers:', error);
      return [];
    }
  }

  /**
   * كشف الطابعات الشبكية المتاحة
   */
  async detectNetworkPrinters() {
    try {
      // هذا يتطلب مسح الشبكة، وهو أمر معقد
      // للبساطة، سنرجع قائمة فارغة مع رسالة
      return [];
    } catch (error) {
      console.error('Error detecting network printers:', error);
      return [];
    }
  }

  /**
   * اختبار اتصال طابعة محددة
   */
  async testPrinterConnection(printerPath, printerType = 'usb') {
    try {
      if (printerType === 'usb') {
        if (printerPath.startsWith('/dev/') || printerPath.startsWith('COM')) {
          try {
            const SP = await getSerialPort();
            if (!SP) return { success: false, message: 'SerialPort not available' };
            const port = new SP({ 
              path: printerPath, 
              baudRate: 9600,
              autoOpen: false
            });
            
            await new Promise((resolve, reject) => {
              port.open((err) => {
                if (err) reject(err);
                else resolve(true);
              });
            });
            
            port.close();
            return { success: true, message: 'Printer connected successfully' };
          } catch (error) {
            return { success: false, message: 'Failed to connect to printer' };
          }
        }
        
        // للطابعات على Windows، نحاول إرسال أمر طباعة بسيط
        if (process.platform === 'win32') {
          try {
            const command = `powershell "Get-Printer -Name '${printerPath}' | Select-Object -Property PrinterStatus"`;
            const { stdout } = await execPromise(command);
            
            if (stdout.includes('Normal') || stdout.includes('Idle')) {
              return { success: true, message: 'Printer is ready' };
            } else {
              return { success: false, message: 'Printer status: ' + stdout.trim() };
            }
          } catch (error) {
            return { success: false, message: 'Failed to check printer status' };
          }
        }
      }
      
      return { success: false, message: 'Unsupported printer type or path' };
    } catch (error) {
      console.error('Error testing printer connection:', error);
      return { success: false, message: error.message };
    }
  }

  /**
   * الحصول على الطابعة المحفوظة لمستخدم وجهاز معين
   */
  async getPrinterForDevice(organization, userId, deviceId) {
    if (!organization || !organization.devicePrinters) return null;
    const devicePrinter = organization.devicePrinters.find(
      p => (p.userId?.toString() === userId?.toString() || !p.userId) && 
           (p.deviceId === deviceId || !p.deviceId)
    );

    return devicePrinter || null;
  }

  /**
   * حفظ إعدادات الطابعة لجهاز معين
   */
  async savePrinterForDevice(organization, userId, deviceId, printerPath, printerName) {
    if (!organization) {
      throw new Error('Organization is required');
    }

    // Use one atomic update so concurrent device registrations cannot conflict
    // with Mongoose's optimistic versioning on the organization document.
    const OrganizationModel = organization.constructor;
    return OrganizationModel.findByIdAndUpdate(
      organization._id,
      {
        $pull: {
          devicePrinters: { userId, deviceId }
        },
        $push: {
          devicePrinters: {
            userId,
            deviceId,
            printerPath,
            printerName,
            lastUsed: new Date()
          }
        }
      },
      { new: true, runValidators: true }
    );
  }

  /**
   * اكتشاف تلقائي للطابعة للمستخدم الحالي
   * - لو وجدت طابعة واحدة فقط: تحفظ تلقائيًا
   * - لو وجدت أكثر من واحدة: ترجع القائمة للمستخدم ليختار
   */
  async autoDetectPrinterForUser(organization, userId, deviceId = 'default') {
    try {
      const printers = await this.detectUSBPrinters();

      const fakeNames = [
        'Microsoft Print to PDF',
        'Microsoft XPS Document Writer',
        'OneNote',
        'Fax',
        'PDF24',
        'Adobe PDF',
        'Google Cloud Print'
      ];

      const realPrinters = printers.filter(p => {
        const name = p.name || p.path || '';
        return !fakeNames.some(fake => name.includes(fake));
      });

      if (realPrinters.length === 0) {
        return { success: false, message: 'لم يتم العثور على طابعات متصلة', printer: null, printers: [] };
      }

      if (realPrinters.length === 1) {
        const printer = realPrinters[0];
        await this.savePrinterForDevice(organization, userId, deviceId, printer.path, printer.name);

        if (!organization.printSettings) {
          organization.printSettings = {};
        }
        organization.printSettings.printerType = 'usb';
        organization.printSettings.printerDevice = printer.path;
        await organization.save();

        return {
          success: true,
          message: `تم اكتشاف الطابعة "${printer.name || printer.path}" تلقائيًا`,
          printer,
          printers: realPrinters
        };
      }

      return {
        success: true,
        message: `تم العثور على ${realPrinters.length} طابعات`,
        printer: null,
        printers: realPrinters
      };
    } catch (error) {
      console.error('Error auto-detecting printer for user:', error);
      return { success: false, message: error.message, printer: null, printers: [] };
    }
  }
}

export default new PrinterDetectionService();