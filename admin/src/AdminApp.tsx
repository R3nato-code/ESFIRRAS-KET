/**
 * FASE 5 — Login e layout do painel.
 *
 * Monta a pilha de autenticação e o layout principal:
 *   AdminAuthProvider → ToastProvider → RequireAdmin → AdminLayout
 *
 * - Sem sessão válida → LoginScreen (fornecido por RequireAdmin).
 * - Sessão sem claim `admin` → tela de erro de permissão.
 * - Sessão de admin → AdminLayout com sidebar e conteúdo.
 *
 * O conteúdo real do dashboard entra na Fase 6. Por enquanto, o layout
 * exibe um placeholder de boas-vindas.
 */

import { AdminAuthProvider } from './auth/AdminAuthProvider'
import { RequireAdmin } from './auth/RequireAdmin'
import { AdminLayout } from './components/AdminLayout'
import { ToastProvider } from './components/Toast'
import { Dashboard } from './components/Dashboard'
import './styles/dashboard.css'

export default function AdminApp() {
  return (
    <AdminAuthProvider>
      <ToastProvider>
        <RequireAdmin>
          <AdminLayout>
            <Dashboard />
          </AdminLayout>
        </RequireAdmin>
      </ToastProvider>
    </AdminAuthProvider>
  )
}
