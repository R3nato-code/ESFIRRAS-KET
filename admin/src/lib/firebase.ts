/* ==================================================================
   FIREBASE DO PAINEL
   Mesmo projeto Firebase do site. A instância é selecionada pela
   combinação de appId e projectId, sem assumir que getApps()[0] é correta.
   ================================================================== */

import { getApps, initializeApp, type FirebaseApp } from 'firebase/app'
import {
  initializeAppCheck,
  ReCaptchaEnterpriseProvider,
} from 'firebase/app-check'
import { getFirestore, type Firestore } from 'firebase/firestore'
import { getAuth, type Auth } from 'firebase/auth'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

const missingKeys = Object.entries(firebaseConfig)
  .filter(([, value]) => typeof value !== 'string' || value.trim() === '')
  .map(([key]) => key)

if (missingKeys.length > 0) {
  throw new Error(
    `Firebase do painel mal configurado. Faltando: ${missingKeys.join(', ')}. ` +
      'Local: preencha o .env da raiz. Render: configure o serviço do admin.',
  )
}

/* Reutiliza somente uma instância que corresponda ao appId e projectId
   configurados. Se já houver outro app no mesmo runtime, cria uma instância
   nomeada para o painel em vez de reutilizar getApps()[0] indiscriminadamente. */
const registeredApps = getApps()
const existingFirebaseApp = registeredApps.find(
  (app) =>
    app.options.appId === firebaseConfig.appId &&
    app.options.projectId === firebaseConfig.projectId,
)

const adminAppName = 'foxy-esfirras-admin'
const conflictingAdminApp = registeredApps.find(
  (app) => app.name === adminAppName && app !== existingFirebaseApp,
)

if (conflictingAdminApp) {
  throw new Error(
    'Já existe uma instância Firebase chamada "foxy-esfirras-admin" ' +
      'com uma configuração diferente. Verifique appId e projectId.',
  )
}

export const firebaseApp: FirebaseApp =
  existingFirebaseApp ??
  initializeApp(
    firebaseConfig,
    registeredApps.length > 0 ? adminAppName : undefined,
  )

/* App Check precisa ser inicializado antes de obter Firestore/Auth.
   Em produção, a chave é obrigatória: não deixa o painel operar silenciosamente
   sem a camada de atestação. Em desenvolvimento, permite iniciar sem ela. */
const appCheckSiteKey = import.meta.env.VITE_FIREBASE_APPCHECK_SITE_KEY?.trim()

if (!appCheckSiteKey) {
  if (import.meta.env.PROD) {
    throw new Error(
      'Firebase App Check não configurado no painel. ' +
        'Defina VITE_FIREBASE_APPCHECK_SITE_KEY no ambiente de build do serviço ADMIN.',
    )
  }

  console.warn(
    'Firebase App Check não configurado no painel. ' +
      'Defina VITE_FIREBASE_APPCHECK_SITE_KEY no .env da raiz.',
  )
} else {
  initializeAppCheck(firebaseApp, {
    provider: new ReCaptchaEnterpriseProvider(appCheckSiteKey),
    isTokenAutoRefreshEnabled: true,
  })
}

/* Os serviços são obtidos somente depois da inicialização do App Check. */
export const db: Firestore = getFirestore(firebaseApp)
export const auth: Auth = getAuth(firebaseApp)
