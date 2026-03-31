// src/hooks/useTauriEvent.ts
import { listen, type EventCallback, type UnlistenFn } from "@tauri-apps/api/event";
import { useEffect, useRef } from "react";

export function useTauriEvent<T>(
  event: string,
  handler: EventCallback<T>,
  options?: { enabled?: boolean }
) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler; // evita stale closure sem re-registrar listener

  useEffect(() => {
    if (options?.enabled === false) return;

    let unlisten: UnlistenFn | undefined;

    listen<T>(event, (e) => handlerRef.current(e)).then((fn) => {
      unlisten = fn;
    });

    return () => {
      unlisten?.();
    };
  }, [event, options?.enabled]);
}
