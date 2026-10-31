/* ==================================================================
   GUARD DE ROTA — exige sessão autenticada com claim `admin`.
   - carregando → tela de carregamento
   - não autenticado → tela de login
   - autenticado sem admin → erro de permissão
   - admin → renderiza os filhos
   ================================================================== */

import { type ReactNode } from 'react'
import { useAdminAuth } from './useAdminAuth'
import { LoginScreen } from './LoginScreen'
import { ErrorState } from '../components/ErrorState'

interface RequireAdminProps {
  children: ReactNode
}

export function RequireAdmin({ children }: RequireAdminProps) {
  const { user, isAdmin, loading, logout } = useAdminAuth()

  if (loading) {
    return <AuthLoadingScreen />
  }

  if (!user) {
    return <LoginScreen />
  }

  if (!isAdmin) {
    return (
      <ErrorState
        title="Sem permissão de administrador"
        message="Sua conta não tem a claim de administrador (`admin`)."
        hint={
          "Peça ao responsável para conceder a claim e, em seguida, sair e entrar novamente. " +
          "Se você acha que isto é um erro, tente sair e entrar de novo."
        }
        onRetry={logout}
        retryLabel="Sair e tentar novamente"
      />
    )
  }

  return <>{children}</>
}

function AuthLoadingScreen() {
  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <span className="auth-brand__mark">F</span>
          <span className="auth-brand__name">Foxy Esfirras</span>
        </div>
        <div className="auth-loading">
          <span className="auth-loading__dot" aria-hidden="true" />
          <span className="auth-loading__dot" aria-hidden="true" />
          <span className="auth-loading__dot" aria-hidden="true" />
          <span className="sr-only">Carregando sessão...</span>
        </div>
      </div>
    </div>
  )
}
