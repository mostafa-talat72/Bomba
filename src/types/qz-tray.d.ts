declare module 'qz-tray' {
  const qz: {
    websocket: {
      isActive: () => boolean;
      connect: () => Promise<void>;
    };
    printers: {
      find: (printer?: string) => Promise<string | string[]>;
    };
    configs: {
      create: (printer: string) => unknown;
    };
    print: (
      config: unknown,
      data: Array<{ type: string; format: string; flavor: string; data: string }>
    ) => Promise<void>;
  };
  export default qz;
}
