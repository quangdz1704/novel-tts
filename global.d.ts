declare global {
  interface Window {
    EventEmitter: typeof import('events').EventEmitter;
  }
}
export {};
