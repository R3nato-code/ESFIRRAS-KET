/* Smoke test pós-deploy das regras do Firestore.
   Roda como cliente ANÔNIMO, igual ao site, contra o projeto real.

   Uso (a partir de admin/):
     node --env-file=../.env scripts/smoke-prod.mjs

   O script cria UM pedido de teste com nome "TESTE — REGRAS NOVAS",
   porque as regras novas bloqueiam delete. Apague pelo Console depois.
*/

import { initializeApp } from 'firebase/app'
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  serverTimestamp,
} from 'firebase/firestore'

const app = initializeApp({
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
})

const db = getFirestore(app)
let failures = 0

function describeError(error) {
  return `${error?.code ?? 'sem-codigo'}: ${error?.message ?? error}`
}

function ok(message) {
  console.log(`  OK    ${message}`)
}

function fail(message) {
  failures += 1
  console.log(`  FALHA ${message}`)
}

function isPermissionDenied(error) {
  return (
    error?.code === 'permission-denied' ||
    /insufficient permissions/i.test(error?.message ?? '')
  )
}

function isApiKeyBlocked(error) {
  return /api key|referer|referrer/i.test(error?.message ?? '')
}

const validOrder = {
  items: [
    {
      id: 'smoke-teste',
      name: 'Pedido de teste (regras)',
      category: 'salgadas',
      quantity: 1,
      unitPrice: 100,
      totalPrice: 100,
    },
  ],
  customerName: 'TESTE — REGRAS NOVAS',
  notes: 'Criado pelo smoke test do deploy. Pode apagar no Console.',
  pickupLocation: 'Foxy Esfirras',
  totalItems: 1,
  totalAmount: 100,
  status: 'pendente',
  createdAt: serverTimestamp(),
}

console.log('\n1) Leitura anônima de pedidos deve ser negada')
try {
  await getDocs(collection(db, 'pedidos'))
  fail('leitura anônima foi PERMITIDA')
} catch (error) {
  if (isPermissionDenied(error)) ok('leitura anônima negada')
  else if (isApiKeyBlocked(error)) fail(`API key restrita para clientes Node: ${describeError(error)}`)
  else fail(`erro inesperado: ${describeError(error)}`)
}

console.log('\n2) Criação com status diferente de pendente deve ser negada')
try {
  await addDoc(collection(db, 'pedidos'), { ...validOrder, status: 'pronto' })
  fail('criação com status "pronto" foi PERMITIDA')
} catch (error) {
  if (isPermissionDenied(error)) ok('criação com status inválido negada')
  else fail(`erro inesperado: ${describeError(error)}`)
}

console.log('\n3) Criação válida (igual ao site) deve ser aceita')
let createdId = null

if (failures > 0) {
  console.log('  PULADO criação de teste: há falha anterior (evita criar lixo em produção)')
} else {
  try {
    const ref = await addDoc(collection(db, 'pedidos'), validOrder)
    createdId = ref.id
    ok(`pedido de teste criado: ${ref.id}`)
  } catch (error) {
    fail(`criação válida falhou: ${describeError(error)}`)
  }
}

if (createdId) {
  console.log('\n4) Pedido recém-criado não pode ser lido anonimamente')
  try {
    await getDoc(doc(db, 'pedidos', createdId))
    fail('pedido pôde ser lido sem autenticação')
  } catch (error) {
    if (isPermissionDenied(error)) ok('leitura do pedido criado negada')
    else fail(`erro inesperado: ${describeError(error)}`)
  }
}

console.log(`\nResultado: ${failures === 0 ? 'todos os checks passaram' : `${failures} check(s) falharam`}`)
process.exit(failures === 0 ? 0 : 1)
