/* ==================================================================
   FIREBASE DO PAINEL
   Mesmo projeto do site (esfirra-ket), mas autenticação e app próprios.
   Falha cedo no build/dev se as 6 variáveis não estiverem presentes.
   ================================================================== */

import { getApps, initializeApp, type FirebaseApp } from 'firebase/app'
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

/* Idempotente para Hot Module Replacement. */
export const firebaseApp: FirebaseApp = getApps().length
  ? getApps()[0]
  : initializeApp(firebaseConfig)

export const db: Firestore = getFirestore(firebaseApp)
export const auth: Auth = getAuth(firebaseApp)
