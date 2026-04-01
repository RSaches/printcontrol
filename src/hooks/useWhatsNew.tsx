// src/hooks/useWhatsNew.ts
import { useState, useEffect, useCallback, createContext, useContext, type ReactNode } from 'react';
import { getVersion } from '@tauri-apps/api/app';
import { changelog, type VersionChangelog } from '../data/changelog';

const STORAGE_KEY = 'printcontrol_whats_new_seen_version';

function parseVersion(v: string): number[] {
  return v.split('.').map(Number);
}

function isNewer(a: string, b: string): boolean {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff > 0;
  }
  return false;
}

// ─── Hook interno ────────────────────────────────────────────────────────────

function useWhatsNewState() {
  const [visible, setVisible] = useState(false);
  const [entries, setEntries] = useState<VersionChangelog[]>([]);

  useEffect(() => {
    getVersion().then((currentVersion) => {
      const lastSeen = localStorage.getItem(STORAGE_KEY);

      // Se nunca abriu → mostra apenas a versão atual.
      // Se atualizou → mostra tudo que é mais novo que lastSeen.
      const unseen = changelog.filter((entry) =>
        lastSeen === null
          ? entry.version === currentVersion
          : isNewer(entry.version, lastSeen)
      );

      if (unseen.length > 0) {
        setEntries(unseen);
        setVisible(true);
      }
    });
  }, []);

  const dismiss = useCallback(() => {
    const latestVersion = changelog[0]?.version;
    if (latestVersion) {
      localStorage.setItem(STORAGE_KEY, latestVersion);
    }
    setVisible(false);
  }, []);

  // Abre manualmente exibindo todo o changelog (ex.: botão nas configurações).
  const showAll = useCallback(() => {
    setEntries(changelog);
    setVisible(true);
  }, []);

  return { visible, entries, dismiss, showAll };
}

// ─── Contexto compartilhado ──────────────────────────────────────────────────

type WhatsNewContextValue = ReturnType<typeof useWhatsNewState>;

const WhatsNewContext = createContext<WhatsNewContextValue | null>(null);

export function WhatsNewProvider({ children }: { children: ReactNode }) {
  const value = useWhatsNewState();
  return (
    <WhatsNewContext.Provider value={value}>
      {children}
    </WhatsNewContext.Provider>
  );
}

export function useWhatsNew(): WhatsNewContextValue {
  const ctx = useContext(WhatsNewContext);
  if (!ctx) throw new Error('useWhatsNew deve ser usado dentro de WhatsNewProvider');
  return ctx;
}
