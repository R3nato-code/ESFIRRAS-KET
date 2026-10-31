import { initializeApp, getApps, type FirebaseApp } from 'firebase/app'
import {
  getFirestore,
  doc,
  setDoc,
  serverTimestamp,
  collection,
  addDoc,
  type Firestore,
} from 'firebase/firestore'

/* ------------------------------------------------------------------
   Variáveis de ambiente (preencha .env com os valores do Console Firebase)
   ------------------------------------------------------------------ */
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

/* Falha cedo com mensagem clara se o .env não estiver preenchido.
   Sem isso o Firebase inicializa com valores undefined e o Firestore
   responde "permission-denied", escondendo a causa real. */
const missingEnv = Object.entries(firebaseConfig)
  .filter(([, value]) => !value || typeof value !== 'string')
  .map(([key]) => key)

if (missingEnv.length > 0) {
  console.error(
    '❌ Firebase: variáveis de ambiente ausentes no .env ->',
    missingEnv.join(', '),
  )
  throw new Error(
    `Firebase mal configurado. Faltando no .env: ${missingEnv.join(', ')}`,
  )
}

/* Aviso se algum valor veio com lixo (ex.: vírgula/aspas sobrando do copy-paste) */
for (const [key, value] of Object.entries(firebaseConfig)) {
  if (/[",\s]$/.test(value as string)) {
    console.warn(
      `⚠️ Firebase: o valor de ${key} termina com caractere inválido (vírgula/aspas/espaço). Verifique o .env.`,
    )
  }
}

console.info('🔥 Firebase inicializando projeto:', firebaseConfig.projectId)

/* ------------------------------------------------------------------
   Inicialização do App Firebase (idempotente para Hot Module Replacement)
   ------------------------------------------------------------------ */
let app: FirebaseApp
if (!getApps().length) {
  app = initializeApp(firebaseConfig)
} else {
  app = getApps()[0]
}

/* ------------------------------------------------------------------
   Instância do Firestore
   ------------------------------------------------------------------ */
export const db: Firestore = getFirestore(app)

/* ------------------------------------------------------------------
   Helpers reutilizados pelas próximas fases do plano
   ------------------------------------------------------------------ */

/**
 * Grava (ou sobrescreve) um documento em qualquer coleção.
 * Aceita dados parciais e injeta createdAt/updatedAt automaticamente.
 */
export async function saveDoc<T extends Record<string, unknown>>(
  collectionPath: string,
  documentId: string,
  data: T
): Promise<void> {
  const ref = doc(db, collectionPath, documentId)
  await setDoc(
    ref,
    {
      ...data,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  )
}

/**
 * Marca um documento como criado pela primeira vez (createdAt imutável).
 */
export async function markCreated<T extends Record<string, unknown>>(
  collectionPath: string,
  documentId: string,
  data: T
): Promise<void> {
  const ref = doc(db, collectionPath, documentId)
  await setDoc(
    ref,
    {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  )
}

export { doc, serverTimestamp, collection, addDoc }
