/* ==================================================================
   CABEÇALHO DO PAINEL — marca à esquerda, usuário à direita.
   ================================================================== */

import { type User } from 'firebase/auth'

interface AdminHeaderProps {
  user: User | null
}

export function AdminHeader({ user }: AdminHeaderProps) {
  const email = user?.email ?? '—'

  return (
    <header className="admin-header">
      <div className="admin-header__brand">
        <span className="admin-header__brand__mark">F</span>
        <span className="admin-header__brand__name">Foxy Esfirras</span>
        <span className="admin-header__brand__tag">Painel de pedidos</span>
      </div>

      <div className="admin-header__meta">
        <span className="admin-header__user">
          <span className="admin-header__user__dot" aria-hidden="true" />
          {email}
        </span>
      </div>
    </header>
  )
}
