const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("bombaDesktop", {
  isDesktop: true,
  isDev: process.argv.includes("--dev"),
  version: "1.0.0",
});