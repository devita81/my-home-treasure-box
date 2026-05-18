import { type ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { MobileNav } from "./MobileNav";

interface AppLayoutProps {
  children: ReactNode;
}

/**
 * Wrapper de páginas autenticadas. Duas navegações distintas por
 * breakpoint:
 *
 *   • Desktop (>= lg): `<Sidebar />` fixa à esquerda. Recebe
 *     open=false fixo — o drawer mobile dela não é mais usado (foi
 *     substituído pela MobileNav). Como a Sidebar é `lg:translate-x-0`,
 *     ela só aparece no desktop; no mobile fica fora da tela.
 *
 *   • Mobile (< lg): `<MobileNav />` — header colorido no topo +
 *     tab bar inferior, estilo app nativo (referência: PetICare).
 *     Substituiu o antigo header slim com hambúrguer + drawer.
 *
 * O `<main>` ganha padding-bottom no mobile pra o conteúdo não ficar
 * coberto pela tab bar fixa (que tem altura própria + safe-area do
 * iOS). No desktop esse padding zera.
 */
export function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar — só desktop. open=false: drawer mobile desativado. */}
      <Sidebar open={false} onClose={() => {}} />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header + tab bar mobile (lg:hidden por dentro do componente) */}
        <MobileNav />

        <main className="flex-1 overflow-x-hidden pb-[calc(3.75rem+env(safe-area-inset-bottom))] lg:pb-0">
          {children}
        </main>
      </div>
    </div>
  );
}
