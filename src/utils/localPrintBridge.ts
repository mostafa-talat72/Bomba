const LOCAL_PRINT_URL = 'http://127.0.0.1:9100/print';

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
  options: { openDrawer?: boolean; drawerMode?: 'bill' | 'payment'; organization?: unknown } = {}
): Promise<boolean> => {
  const desktopApi = typeof window !== 'undefined'
    ? (window as Window & { bombaDesktop?: { directPrint?: (html: string, printerName?: string) => Promise<{ success?: boolean }> } }).bombaDesktop
    : undefined;
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
  options: { openDrawer?: boolean; drawerMode?: 'bill' | 'payment'; organization?: unknown } = {}
): Promise<boolean> => {
  const job = printQueue.then(
    () => printThroughLocalBridgeNow(html, printerName, options),
    () => printThroughLocalBridgeNow(html, printerName, options)
  );
  printQueue = job.catch(() => false);
  return job;
};
