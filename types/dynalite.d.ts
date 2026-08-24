declare module 'dynalite' {
  interface DynaliteOptions {
    ssl?: boolean;
    path?: string;
    createTableMs?: number;
    deleteTableMs?: number;
    updateTableMs?: number;
    maxSessions?: number;
    [key: string]: any;
  }

  interface DynaliteServer {
    listen(port: number, host?: string | ((err?: any) => void), callback?: (err?: any) => void): void;
    close(callback?: (err?: any) => void): void;
    [key: string]: any;
  }

  function dynalite(options?: DynaliteOptions): DynaliteServer;

  export default dynalite;
}
