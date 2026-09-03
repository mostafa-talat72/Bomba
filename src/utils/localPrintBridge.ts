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

const printThroughWeb = async (html: string): Promise<boolean> => printInBrowser(html);

let printQueue: Promise<boolean> = Promise.resolve(true);

export const printThroughLocalBridge = (
  html: string,
  _printerName?: string,
  _options: { openDrawer?: boolean; cutPaper?: boolean; drawerMode?: 'bill' | 'payment'; organization?: unknown } = {}
): Promise<boolean> => {
  const job = printQueue.then(
    () => printThroughWeb(html),
    () => printThroughWeb(html)
  );
  printQueue = job.catch(() => false);
  return job;
};
