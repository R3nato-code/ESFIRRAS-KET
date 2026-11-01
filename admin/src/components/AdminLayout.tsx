/* ==================================================================
   LAYOUT PRINCIPAL — sidebar (desktop) + header + conteúdo.
   Em telas estreitas a sidebar vira overlay acionada por botão.
   ================================================================== */

import { useCallback, useState, type ReactNode } from 'react'
import { useAdminAuth } from '../auth/useAdminAuth'
import { AdminHeader } from './AdminHeader'

interface AdminLayoutProps {
  children: ReactNode
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const { user, logout } = useAdminAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const handleLogout = useCallback(async () => {
    try {
      await logout()
    } catch {
      // O próprio logout já registra o erro no contexto de auth.
    }
  }, [logout])

  return (
    <div className="admin-layout">
      {/* Botão de menu apenas visível em telas estreitas. */}
      <button
        className="admin-layout__mobile-toggle"
        aria-label="Abrir menu de navegação"
        aria-expanded={sidebarOpen}
        onClick={() => setSidebarOpen((open) => !open)}
      >
        <span className="sr-only">Menu</span>
        <span className="admin-layout__mobile-toggle__bar" aria-hidden="true" />
        <span className="admin-layout__mobile-toggle__bar" aria-hidden="true" />
        <span className="admin-layout__mobile-toggle__bar" aria-hidden="true" />
      </button>

      <aside
        className={`admin-sidebar ${sidebarOpen ? 'admin-sidebar--open' : ''}`}
      >
        <div className="admin-sidebar__header">
          <span className="admin-sidebar__brand">Foxy Esfirras</span>
          <button
            className="admin-sidebar__close"
            aria-label="Fechar menu"
            onClick={() => setSidebarOpen(false)}
          >
            <span className="sr-only">Fechar</span>
            <span aria-hidden="true">✕</span>
          </button>
        </div>

        <nav className="admin-nav" aria-label="Navegação principal">
          <a
            href="#dashboard"
            className="admin-nav__item admin-nav__item--active"
            aria-current="page"
          >
            <span className="admin-nav__icon" aria-hidden="true">📋</span>
            Dashboard
          </a>
        </nav>

        <div className="admin-sidebar__user">
          <div className="admin-user">
            <div className="admin-user__avatar" aria-hidden="true">
              {user?.email?.charAt(0).toUpperCase() || '?'}
            </div>
            <div className="admin-user__info">
              <div className="admin-user__email">{user?.email ?? '—'}</div>
              <div className="admin-user__role">Administrador</div>
            </div>
          </div>
          <button
            className="btn btn--ghost btn--block admin-sidebar__logout"
            onClick={handleLogout}
          >
            Sair
          </button>
        </div>
      </aside>

      {sidebarOpen && (
        <div
          className="admin-layout__overlay"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <main className="admin-layout__content">
        <AdminHeader user={user} />
        <div className="admin-layout__main">{children}</div>
      </main>
    </div>
  )
}
