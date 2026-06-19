// Modo Demo — mascara dados sensíveis (valores R$, nomes, CPFs) na UI
// sem tocar no banco. A flag fica em localStorage e é lida diretamente
// pelas funções de formatação (`fmtBRL`, `maskName`, etc.).
//
// Como o estado é global e síncrono (não passa por React state), o
// toggle dispara `window.location.reload()` pra garantir que todos os
// valores re-renderizam com as novas máscaras. Componentes "ao vivo"
// (badge, toggle) usam `subscribeDemoMode` pra reagir sem reload.

const STORAGE_KEY = "mhc.demoMode";
const listeners = new Set<() => void>();

function readFlag(): boolean {
  try {
    return typeof window !== "undefined" && window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

let cached = readFlag();

export function isDemoMode(): boolean {
  return cached;
}

export function setDemoMode(enabled: boolean): void {
  cached = enabled;
  try {
    if (enabled) window.localStorage.setItem(STORAGE_KEY, "1");
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l());
}

export function subscribeDemoMode(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** Toggle + reload — garante re-render de todos os valores formatados. */
export function toggleDemoModeWithReload(): void {
  setDemoMode(!cached);
  if (typeof window !== "undefined") {
    setTimeout(() => window.location.reload(), 50);
  }
}
