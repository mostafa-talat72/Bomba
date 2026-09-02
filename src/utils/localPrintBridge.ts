const LOCAL_PRINT_URL = 'http://127.0.0.1:9100/print';

export const printThroughLocalBridge = async (
  html: string,
  printerName?: string,
  options: { openDrawer?: boolean; drawerMode?: 'bill' | 'payment'; organization?: unknown } = {}
): Promise<boolean> => {
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
    if (!response.ok) return false;
    const result = await response.json();
    return result?.success === true;
  } catch {
    return false;
  }
};
