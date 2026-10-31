/* ==================================================================
   TELA DE LOGIN — e-mail/senha com recuperação de senha.
   ================================================================== */

import { useCallback, useState } from 'react'
import { useAdminAuth } from './useAdminAuth'
import { toAppError } from '../lib/errors'

interface LoginScreenProps {
  onAuthenticated?: () => void
}

export function LoginScreen({ onAuthenticated }: LoginScreenProps = {}) {
  const { login, sendPasswordReset, loading, error, clearError } =
    useAdminAuth()

  const [mode, setMode] = useState<'login' | 'reset'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetSent, setResetSent] = useState(false)

  const handleLogin = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault()
      clearError()
      try {
        await login(email, password)
        onAuthenticated?.()
      } catch {
        // login já define a mensagem de erro no contexto
      }
    },
    [email, password, login, clearError, onAuthenticated],
  )

  const handleReset = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault()
      clearError()
      try {
        await sendPasswordReset(resetEmail)
        setResetSent(true)
      } catch {
        // sendPasswordReset já define a mensagem de erro
      }
    },
    [resetEmail, sendPasswordReset, clearError],
  )

  const appError = error ? toAppError(error) : null

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <span className="auth-brand__mark">F</span>
          <span className="auth-brand__name">Foxy Esfirras</span>
          <span className="auth-brand__tag">Painel de pedidos</span>
        </div>

        {mode === 'reset'
          ? resetSent ? (
            <ResetSent
              onBack={() => {
                setMode('login')
                setResetSent(false)
                clearError()
              }}
            />
          ) : (
            <ResetForm
              email={resetEmail}
              setEmail={setResetEmail}
              sending={loading}
              error={appError}
              onSubmit={handleReset}
              onBack={() => {
                setMode('login')
                setResetEmail('')
                clearError()
              }}
            />
          )
          : (
            <LoginForm
              email={email}
              setEmail={setEmail}
              password={password}
              setPassword={setPassword}
              showPassword={showPassword}
              setShowPassword={setShowPassword}
              submitting={loading}
              error={appError}
              onSubmit={handleLogin}
              onForgotPassword={() => {
                setMode('reset')
                clearError()
              }}
            />
          )}

        <div className="auth-footer">
          <p className="auth-footer__text">
            Acesso restrito à equipe da Foxy Esfirras.
          </p>
        </div>
      </div>
    </div>
  )
}

/* ---------- Formulário de login ---------- */

interface LoginFormProps {
  email: string
  setEmail: (value: string) => void
  password: string
  setPassword: (value: string) => void
  showPassword: boolean
  setShowPassword: (value: boolean) => void
  submitting: boolean
  error: ReturnType<typeof toAppError> | null
  onSubmit: (event: React.FormEvent) => void
  onForgotPassword: () => void
}

function LoginForm({
  email,
  setEmail,
  password,
  setPassword,
  showPassword,
  setShowPassword,
  submitting,
  error,
  onSubmit,
  onForgotPassword,
}: LoginFormProps) {
  return (
    <form className="auth-form" onSubmit={onSubmit} noValidate>
      {error && (
        <div className="auth-error" role="alert" aria-live="polite">
          <span className="auth-error__icon" aria-hidden="true">
            ⚠
          </span>
          <span className="auth-error__message">{error.message}</span>
          {error.hint && (
            <span className="auth-error__hint">{error.hint}</span>
          )}
        </div>
      )}

      <div className="auth-field">
        <label className="auth-label" htmlFor="login-email">
          E-mail
        </label>
        <input
          id="login-email"
          name="email"
          type="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={submitting}
          style={{ minHeight: '44px' }}
        />
      </div>

      <div className="auth-field">
        <label className="auth-label" htmlFor="login-password">
          Senha
        </label>
        <div className="auth-password-input">
          <input
            id="login-password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={submitting}
            style={{ minHeight: '44px' }}
          />
          <button
            type="button"
            className="auth-toggle-password"
            onClick={() => setShowPassword(!showPassword)}
            aria-label={
              showPassword ? 'Ocultar senha' : 'Mostrar senha'
            }
            aria-pressed={showPassword}
          >
            <span className="sr-only">
              {showPassword ? 'Ocultar senha' : 'Mostrar senha'}
            </span>
            {showPassword ? '🙈' : '👁'}
          </button>
        </div>
      </div>

      <div className="auth-actions">
        <button
          type="submit"
          className="btn btn--primary btn--block"
          disabled={submitting}
        >
          {submitting ? 'Entrando...' : 'Entrar no painel'}
        </button>
      </div>

      <p className="auth-help">
        <button
          type="button"
          className="btn btn--ghost btn--block"
          onClick={onForgotPassword}
          disabled={submitting}
        >
          Esqueci minha senha
        </button>
      </p>
    </form>
  )
}

/* ---------- Formulário de redefinição ---------- */

interface ResetFormProps {
  email: string
  setEmail: (value: string) => void
  sending: boolean
  error: ReturnType<typeof toAppError> | null
  onSubmit: (event: React.FormEvent) => void
  onBack: () => void
}

function ResetForm({
  email,
  setEmail,
  sending,
  error,
  onSubmit,
  onBack,
}: ResetFormProps) {
  return (
    <>
      <h2 className="auth-title">Redefinir senha</h2>
      <p className="auth-subtitle">
        Informe o e-mail da sua conta administrativa. Enviaremos um link para
        redefinir a senha.
      </p>

      {error && (
        <div className="auth-error" role="alert" aria-live="polite">
          <span className="auth-error__icon" aria-hidden="true">
            ⚠
          </span>
          <span className="auth-error__message">{error.message}</span>
        </div>
      )}

      <form className="auth-form" onSubmit={onSubmit} noValidate>
        <div className="auth-field">
          <label className="auth-label" htmlFor="reset-email">
            E-mail
          </label>
          <input
            id="reset-email"
            name="email"
            type="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={sending}
            style={{ minHeight: '44px' }}
          />
        </div>

        <div className="auth-actions">
          <button
            type="submit"
            className="btn btn--primary btn--block"
            disabled={sending}
          >
            {sending ? 'Enviando...' : 'Enviar link de redefinição'}
          </button>
        </div>
      </form>

      <p className="auth-help">
        <button type="button" className="btn btn--ghost btn--block" onClick={onBack}>
          Voltar ao login
        </button>
      </p>
    </>
  )
}

/* ---------- Confirmação de envio ---------- */

interface ResetSentProps {
  onBack: () => void
}

function ResetSent({ onBack }: ResetSentProps) {
  return (
    <>
      <h2 className="auth-title">Link enviado</h2>
      <p className="auth-subtitle">
        Verifique sua caixa de entrada (e a pasta de spam) para redefinir a
        senha da sua conta administrativa.
      </p>

      <div className="auth-actions">
        <button
          type="button"
          className="btn btn--primary btn--block"
          onClick={onBack}
        >
          Voltar ao login
        </button>
      </div>
    </>
  )
}
