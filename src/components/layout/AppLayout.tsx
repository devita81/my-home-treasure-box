import { useState, type ReactNode } from "react";
import { Sidebar, SidebarTrigger } from "./Sidebar";

interface AppLayoutProps {
  children: ReactNode;
}

/**
 * Wrapper de páginas autenticadas. Sidebar fixa à esquerda no
 * desktop (>= lg), drawer no mobile. Conteúdo da página fica à
 * direita, ocupando o espaço restante.
 *
 * Uso: cada `<Route>` autenticada é embrulhada com este layout —
 * ver `App.tsx`. As páginas próprias NÃO precisam mais renderizar
 * o `<Header />` antigo (que foi removido).
 *
 * Top bar mobile: aparece só em telas <lg, com o botão hambúrguer
 * pra abrir o drawer da sidebar. No desktop, a sidebar já é
 * sempre visível e essa top bar fica oculta.
 */
export function AppLayout({ children }: AppLayoutProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar open={drawerOpen} onClose={() => setDrawerOpen(false)} />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar slim — só no mobile, com hambúrguer */}
        <header className="sticky top-0 z-30 flex h-12 items-center gap-2 border-b border-border bg-card px-3 shadow-sm lg:hidden">
          <SidebarTrigger onClick={() => setDrawerOpen(true)} />
          <span className="font-display text-sm font-semibold">
            My Home Collection
          </span>
        </header>

        <main className="flex-1 overflow-x-hidden">{children}</main>
      </div>
    </div>
  );
}
