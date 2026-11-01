/* ==================================================================
   AUTENTICAÇÃO DO PAINEL — Firebase Auth + claim `admin`.
   Gerencia sessão, valida a claim de administrador e expõe login,
   logout e redefinição de senha para a UI.
   ================================================================== */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  type User,
} from 'firebase/auth'
import { auth } from '../lib/firebase'

export interface AdminAuthContextValue {
  user: User | null
  /** true somente quando o token de ID tem `claims.admin === true`. */
  isAdmin: boolean
  loading: boolean
  error: string | null
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  sendPasswordReset: (email: string) => Promise<void>
  clearError: () => void
}

const AdminAuthContext =
  createContext<AdminAuthContextValue | null>(null)

export function AdminAuthProvider({
  children,
}: {
  children: ReactNode
}) {
  const [user, setUser] = useState<User | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let authCheckVersion = 0

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      const currentVersion = ++authCheckVersion
      setLoading(true)
      setError(null)
      setIsAdmin(false)
      setUser(firebaseUser)

      if (!firebaseUser) {
        setLoading(false)
        return
      }

      try {
        const result = await firebaseUser.getIdTokenResult(true)

        // Ignora respostas assíncronas de uma sessão/usuário anterior.
        if (
          currentVersion === authCheckVersion &&
          auth.currentUser?.uid === firebaseUser.uid
        ) {
          setIsAdmin(result.claims.admin === true)
        }
      } catch {
        if (
          currentVersion === authCheckVersion &&
          auth.currentUser?.uid === firebaseUser.uid
        ) {
          setIsAdmin(false)
        }
      } finally {
        if (currentVersion === authCheckVersion) {
          setLoading(false)
        }
      }
    })

    return () => {
      authCheckVersion += 1
      unsubscribe()
    }
  }, [])

  const login = useCallback(
    async (email: string, password: string) => {
      setLoading(true)
      setError(null)
      try {
        await signInWithEmailAndPassword(auth, email.trim(), password)
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : 'Erro ao entrar.'
        setError(message)
        setLoading(false)
        throw err
      }
    },
    [],
  )

  const logout = useCallback(async () => {
    setError(null)
    try {
      await signOut(auth)
      // onAuthStateChanged ajusta loading quando o usuário vira null.
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Erro ao sair.'
      setError(message)
      setLoading(false)
      throw err
    }
  }, [])

  const sendPasswordReset = useCallback(
    async (email: string) => {
      setLoading(true)
      setError(null)
      try {
        await sendPasswordResetEmail(auth, email.trim())
      } catch (err: unknown) {
        const message =
          err instanceof Error
            ? err.message
            : 'Erro ao enviar redefinição de senha.'
        setError(message)
        throw err
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  const clearError = useCallback(() => setError(null), [])

  const value: AdminAuthContextValue = {
    user,
    isAdmin,
    loading,
    error,
    login,
    logout,
    sendPasswordReset,
    clearError,
  }

  return (
    <AdminAuthContext.Provider value={value}>
      {children}
    </AdminAuthContext.Provider>
  )
}

/** Hook de consumo. Lança se usado fora do AdminAuthProvider. */
export function useAdminAuth(): AdminAuthContextValue {
  const context = useContext(AdminAuthContext)
  if (!context) {
    throw new Error(
      'useAdminAuth deve ser usado dentro de um AdminAuthProvider.',
    )
  }
  return context
}

export type { User }
