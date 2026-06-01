type Listener = (...args: any[]) => void;

export class EventEmitter {
  private listeners = new Map<string, Listener[]>();

  on(event: string, listener: Listener) {
    const existing = this.listeners.get(event) || [];
    existing.push(listener);
    this.listeners.set(event, existing);
    return this;
  }

  off(event: string, listener: Listener) {
    const existing = this.listeners.get(event);
    if (!existing) return this;
    this.listeners.set(
      event,
      existing.filter((l) => l !== listener),
    );
    return this;
  }

  once(event: string, listener: Listener) {
    const wrapped = (...args: any[]) => {
      this.off(event, wrapped);
      listener(...args);
    };
    return this.on(event, wrapped);
  }

  emit(event: string, ...args: any[]) {
    const existing = this.listeners.get(event);
    if (!existing) return false;
    existing.slice().forEach((listener) => listener(...args));
    return true;
  }
}
