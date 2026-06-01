import { useRef, useEffect } from 'react';

type EventCallback = (payload: any) => void;

export function useBackendCrawler() {
  const listenerRef = useRef<any>(null);
  const isAvailable =
    typeof window !== 'undefined' &&
    Boolean((window as any).__TAURI__ || (window as any).__TAURI_IPC__);

  useEffect(() => {
    return () => {
      if (listenerRef.current && listenerRef.current.then) {
        listenerRef.current.then((unsub: any) => unsub && unsub());
      }
    };
  }, []);

  async function start(
    jobId: string,
    url: string,
    ty: string,
    onEvent: EventCallback,
  ) {
    try {
      const tauri = await import('@tauri-apps/api/tauri');
      const events = await import('@tauri-apps/api/event');

      // listen for crawler-event
      const unlisten = await events.listen('crawler-event', (evt: any) => {
        const payload = evt.payload;
        if (payload && payload.jobId === jobId) {
          onEvent(payload.data);
        }
      });
      listenerRef.current = Promise.resolve(unlisten);

      await tauri.invoke('start_node_crawler', { job_id: jobId, url, ty });
      return true;
    } catch (e) {
      return Promise.reject(e);
    }
  }

  async function stop(jobId: string) {
    try {
      const tauri = await import('@tauri-apps/api/tauri');
      await tauri.invoke('stop_node_crawler', { job_id: jobId });
      if (listenerRef.current && listenerRef.current.then) {
        const unsub = await listenerRef.current;
        unsub && unsub();
        listenerRef.current = null;
      }
      return true;
    } catch (e) {
      return Promise.reject(e);
    }
  }

  return { isAvailable, start, stop };
}
