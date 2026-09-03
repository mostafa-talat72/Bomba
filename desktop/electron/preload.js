const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("bombaDesktop", {
  isDesktop: true,
  isDev: process.argv.includes("--dev"),
  version: "1.0.0",
  // Print functions
  printBill: (billData, orgName, lang, tFunc) => {
    const { ipcRenderer } = require("electron");
    ipcRenderer.send('print-bill', { bill: billData, fallbackOrgName: orgName, language: lang, t: tFunc });
  },
  printKitchenOrder: (orderData) => {
    const { ipcRenderer } = require("electron");
    ipcRenderer.send('print-kitchen-order', orderData);
  },
  printOrder: (orderData) => {
    const { ipcRenderer } = require("electron");
    ipcRenderer.send('print-order', orderData);
  },
  // Print preview function - shows Electron print preview (not browser popup)
  printPreview: () => {
    const { ipcRenderer } = require("electron");
    ipcRenderer.send('print-preview');
  },
  // Direct print to default printer without preview (desktop only)
  directPrint: (html, printerName, options) => {
    const { ipcRenderer } = require("electron");
    return ipcRenderer.invoke('direct-print', { html, printerName, ...options });
  },
});