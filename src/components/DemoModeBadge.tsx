import { useEffect, useState } from "react";
import { EyeOff } from "lucide-react";
import { isDemoMode, subscribeDemoMode, toggleDemoModeWithReload } from "@/lib/demo-mode";

/**
 * Badge fixo no topo da tela quando o Modo Demo está ativo. Mantém o
 * usuário ciente (pra não esquecer ligado) e oferece um clique rápido
 * pra desligar. Reage via subscribe — não precisa de context.
 */
export function DemoModeBadge() {
  const [enabled, setEnabled] = useState(isDemoMode());

  useEffect(() => subscribeDemoMode(() => setEnabled(isDemoMode())), []);

  if (!enabled) return null;

  return (
    <button
      type="button"
      onClick={toggleDemoModeWithReload}
      className="fixed left-1/2 top-2 z-[60] -translate-x-1/2 flex items-center gap-1.5 rounded-full bg-amber-500 px-3 py-1 text-xs font-bold text-amber-950 shadow-lg ring-2 ring-amber-300 hover:bg-amber-400 pt-safe-top"
      title="Clique para desligar o Modo Demo"
      aria-label="Modo Demo ativo — clique para desligar"
    >
      <EyeOff className="h-3.5 w-3.5" />
      MODO DEMO
    </button>
  );
}
