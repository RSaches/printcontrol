import { useCallback, useEffect, useRef, useState } from 'react';
import type { Update } from '@tauri-apps/plugin-updater';
import {
  checkForUpdate,
  downloadAndApply,
  type UpdateProgress,
} from '../services/updater.service';

type UpdaterState =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'available'; update: Update }
  | { status: 'downloading'; progress: UpdateProgress }
  | { status: 'up_to_date' }
  | { status: 'error'; message: string };

const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000; // 4 horas

export function useUpdater() {
  const [state, setState] = useState<UpdaterState>({ status: 'idle' });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const check = useCallback(async () => {
    setState({ status: 'checking' });
    try {
      const update = await checkForUpdate();
      if (update) {
        setState({ status: 'available', update });
      } else {
        setState({ status: 'up_to_date' });
      }
    } catch (err) {
      // Em dev (sem endpoint configurado) silencia o erro
      const message = err instanceof Error ? err.message : String(err);
      setState({ status: 'error', message });
    }
  }, []);

  const applyUpdate = useCallback(async () => {
    if (state.status !== 'available') return;
    const { update } = state;

    try {
      await downloadAndApply(update, (progress) => {
        setState({ status: 'downloading', progress });
      });
      // relaunch() foi chamado no final, não chega a ter um next-state.
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setState({ status: 'error', message });
    }
  }, [state]);

  const dismiss = useCallback(() => {
    setState({ status: 'idle' });
  }, []);

  useEffect(() => {
    check();
    intervalRef.current = setInterval(check, CHECK_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [check]);

  return { state, applyUpdate, dismiss, checkNow: check };
}
