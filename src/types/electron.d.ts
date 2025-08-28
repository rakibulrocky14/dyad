import { IpcRenderer } from 'electron';

declare global {
  interface Window {
    electron: {
      ipcRenderer: {
        invoke(channel: string, ...args: any[]): Promise<any>;
        on(channel: string, listener: (...args: any[]) => void): () => void;
        removeAllListeners(channel: string): void;
        removeListener(channel: string, listener: (...args: any[]) => void): void;
      };
    };
  }
}

// To make this file a module
export {};
