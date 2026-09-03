const LOCAL_PRINT_URL = 'http://127.0.0.1:9100/print';

const printInBrowser = (html: string): boolean => {
  if (typeof window === 'undefined' || typeof document === 'undefined' || !document.body) return false;

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
    window.setTimeout(() => frame.remove(), 30000);
  }, { once: true });
  return true;
};

const printThroughAgent = async (
  html: string,
  printerName?: string,
  options: { openDrawer?: boolean; cutPaper?: boolean; paperWidthMm?: number; drawerMode?: 'bill' | 'payment'; organization?: unknown } = {}
): Promise<boolean> => {
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null;
  const response = await fetch(LOCAL_PRINT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ html, printerName, ...options }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(result?.message
      ? `Print Agent returned ${response.status}: ${result.message}`
      : `Print Agent returned ${response.status}`);
  }
  return result?.success === true;
};

const printThroughDesktopFallback = async (html: string, printerName?: string, options: { paperWidthMm?: number } = {}): Promise<boolean> => {
  const desktopApi = typeof window !== 'undefined'
    ? (window as Window & {
        bombaDesktop?: {
          directPrint?: (content: string, targetPrinter?: string, options?: { paperWidthMm?: number }) => Promise<{ success?: boolean }>;
        };
      }).bombaDesktop
    : undefined;
  if (!desktopApi?.directPrint) return false;
  const result = await desktopApi.directPrint(html, printerName, options);
  return result?.success === true;
};

let printQueue: Promise<boolean> = Promise.resolve(true);
const recentPrints = new Map<string, number>();

const getPrintKey = (html: string, printerName?: string): string => {
  let hash = 0;
  const value = `${printerName || ''}|${html}`;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
  }
  return String(hash);
};

const runPrintJob = async (
  html: string,
  printerName?: string,
  options: { openDrawer?: boolean; cutPaper?: boolean; paperWidthMm?: number; drawerMode?: 'bill' | 'payment'; organization?: unknown } = {}
): Promise<boolean> => {
  try {
    if (await printThroughAgent(html, printerName, options)) return true;
  } catch (agentError) {
    try {
      if (await printThroughDesktopFallback(html, printerName, options)) return true;
    } catch (desktopError) {
      console.warn('Silent print agent and desktop print fallback failed:', desktopError);
    }
    console.warn('Silent print agent unavailable; using browser print:', agentError);
  }
  return printInBrowser(html);
};

export const printThroughLocalBridge = (
  html: string,
  printerName?: string,
  options: { openDrawer?: boolean; cutPaper?: boolean; paperWidthMm?: number; drawerMode?: 'bill' | 'payment'; organization?: unknown } = {}
): Promise<boolean> => {
  const printKey = getPrintKey(html, printerName);
  const now = Date.now();
  const previousPrint = recentPrints.get(printKey);
  if (previousPrint && now - previousPrint < 3000) return true;
  recentPrints.set(printKey, now);
  for (const [key, timestamp] of recentPrints) {
    if (now - timestamp >= 3000) recentPrints.delete(key);
  }
  const job = printQueue.then(
    () => runPrintJob(html, printerName, options),
    () => runPrintJob(html, printerName, options)
  );
  printQueue = job.catch(() => false);
  return job;
};
