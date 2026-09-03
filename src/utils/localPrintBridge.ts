const LOCAL_PRINT_URL = 'http://127.0.0.1:9100/print';

export const printThroughLocalBridge = async (
  html: string,
  printerName?: string,
  options: { openDrawer?: boolean; drawerMode?: 'bill' | 'payment'; organization?: unknown } = {}
): Promise<boolean> => {
  const desktopApi = typeof window !== 'undefined'
    ? (window as Window & { bombaDesktop?: { directPrint?: (html: string, printerName?: string) => Promise<{ success?: boolean }> } }).bombaDesktop
    : undefined;
  if (!desktopApi) return false;
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
