const LOCAL_PRINT_URL = 'http://127.0.0.1:9100/print';

type QzTray = {
  websocket: {
    isActive: () => boolean;
    connect: () => Promise<void>;
  };
  printers: {
    find: (printer?: string) => Promise<string | string[]>;
  };
  configs: {
    create: (printer: string, options?: unknown) => unknown;
  };
  print: (config: unknown, data: Array<{ type: string; format: string; flavor: string; data: string }>) => Promise<void>;
};

let qzTrayPromise: Promise<QzTray> | null = null;

const getQzTray = async (): Promise<QzTray> => {
  if (!qzTrayPromise) {
    qzTrayPromise = import('qz-tray').then((module) => {
      const qz = (module.default || module) as QzTray;
      if (!qz.websocket || !qz.configs || !qz.print) {
        throw new Error('QZ Tray client is unavailable');
      }
      return qz;
    });
  }
  return qzTrayPromise;
};

const printThroughQzTray = async (html: string, printerName?: string): Promise<boolean> => {
  const qz = await getQzTray();
  if (!qz.websocket.isActive()) await qz.websocket.connect();
  const resolvedPrinter = printerName
    ? await qz.printers.find(printerName)
    : await qz.printers.find();
  const selectedPrinter = Array.isArray(resolvedPrinter) ? resolvedPrinter[0] : resolvedPrinter;
  if (!selectedPrinter) throw new Error('QZ Tray could not find a printer');
  const config = qz.configs.create(selectedPrinter, {
    size: { width: 80, height: 0 },
    units: 'mm',
    margins: 0,
    // Let the HTML/CSS determine the layout; only the paper width comes from
    // the printer profile.
    scaleContent: false,
  });
  await qz.print(config, [{ type: 'pixel', format: 'html', flavor: 'plain', data: html }]);
  return true;
};

const openCashDrawerThroughQzTray = async (printerName?: string): Promise<void> => {
  const qz = await getQzTray();
  if (!qz.websocket.isActive()) await qz.websocket.connect();
  const resolvedPrinter = printerName
    ? await qz.printers.find(printerName)
    : await qz.printers.find();
  const selectedPrinter = Array.isArray(resolvedPrinter) ? resolvedPrinter[0] : resolvedPrinter;
  if (!selectedPrinter) throw new Error('QZ Tray could not find a printer for the cash drawer');
  const config = qz.configs.create(selectedPrinter);
  await qz.print(config, [{
    type: 'raw',
    format: 'command',
    flavor: 'plain',
    data: '\x1B\x70\x00\x19\xFA',
  }]);
};

const cutPaperThroughQzTray = async (printerName?: string): Promise<void> => {
  const qz = await getQzTray();
  const resolvedPrinter = printerName
    ? await qz.printers.find(printerName)
    : await qz.printers.find();
  const selectedPrinter = Array.isArray(resolvedPrinter) ? resolvedPrinter[0] : resolvedPrinter;
  if (!selectedPrinter) throw new Error('QZ Tray could not find a printer for paper cutting');
  await qz.print(qz.configs.create(selectedPrinter), [{
    type: 'raw',
    format: 'command',
    flavor: 'plain',
    data: '\x1D\x56\x00',
  }]);
};

const printInBrowser = (html: string): boolean => {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false;

  const frame = document.createElement('iframe');
  frame.style.position = 'fixed';
  frame.style.left = '-10000px';
  frame.style.top = '0';
  frame.style.width = '100%';
  frame.style.height = '100%';
  frame.style.border = '0';
  frame.style.opacity = '0';
  frame.style.pointerEvents = 'none';
  document.body.appendChild(frame);
  const frameDocument = frame.contentDocument;
  if (!frameDocument) {
    frame.remove();
    return false;
  }
  frameDocument.open();
  frameDocument.write(html);
  frameDocument.close();
  frame.addEventListener('load', () => {
    window.setTimeout(() => {
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
    }, 100);
    window.setTimeout(() => frame.remove(), 1000);
  }, { once: true });
  return true;
};

const printThroughLocalBridgeNow = async (
  html: string,
  printerName?: string,
  options: { openDrawer?: boolean; cutPaper?: boolean; drawerMode?: 'bill' | 'payment'; organization?: unknown } = {}
): Promise<boolean> => {
  const desktopApi = typeof window !== 'undefined'
    ? (window as Window & { bombaDesktop?: { directPrint?: (html: string, printerName?: string) => Promise<{ success?: boolean }> } }).bombaDesktop
    : undefined;
  try {
    if (await printThroughQzTray(html, printerName)) {
      if (options.cutPaper) {
        try {
          await cutPaperThroughQzTray(printerName);
        } catch (cutError) {
          console.error('Order printed, but QZ Tray could not cut the paper:', cutError);
        }
      }
      if (options.openDrawer) {
        try {
          await openCashDrawerThroughQzTray(printerName);
        } catch (drawerError) {
          console.error('Receipt printed, but QZ Tray could not open the cash drawer:', drawerError);
        }
      }
      return true;
    }
  } catch (qzError) {
    console.warn('QZ Tray unavailable; using the local print bridge:', qzError);
  }
  if (!desktopApi) return printInBrowser(html);
  try {
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null;
    const response = await fetch(LOCAL_PRINT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ html, printerName, ...options }),
    });
    if (!response.ok) throw new Error(`Local print bridge returned ${response.status}`);
    const result = await response.json();
    return result?.success === true;
  } catch (error) {
    // Older installed Desktop builds may not include the HTTP bridge yet.
    // Use the existing hidden Electron print channel as a silent compatibility fallback.
    if (desktopApi?.directPrint) {
      try {
        const result = await desktopApi.directPrint(html, printerName);
        return result?.success === true;
      } catch (fallbackError) {
        console.error('Local print bridge and Desktop print fallback failed:', fallbackError);
      }
    }
    return false;
  }
};

let printQueue: Promise<boolean> = Promise.resolve(true);

export const printThroughLocalBridge = (
  html: string,
  printerName?: string,
  options: { openDrawer?: boolean; cutPaper?: boolean; drawerMode?: 'bill' | 'payment'; organization?: unknown } = {}
): Promise<boolean> => {
  const job = printQueue.then(
    () => printThroughLocalBridgeNow(html, printerName, options),
    () => printThroughLocalBridgeNow(html, printerName, options)
  );
  printQueue = job.catch(() => false);
  return job;
};
