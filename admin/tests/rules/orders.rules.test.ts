/* ==================================================================
   TESTES DAS REGRAS DO FIRESTORE
   Cobrem o contrato de segurança: leitura restrita, criação pública
   controlada, transições válidas, histórico append-only e vínculo
   pedido↔histórico no mesmo commit.

   Requer o emulador: `npm --prefix admin run test:rules`.
   ================================================================== */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import {
  Timestamp,
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  type Firestore,
} from 'firebase/firestore'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

const PROJECT_ID = 'demo-esfirra-ket'
const ADMIN_UID = 'admin-1'
const ADMIN_EMAIL = 'admin@foxy.test'

const RULES = readFileSync(
  fileURLToPath(new URL('../../../firestore.rules', import.meta.url)),
  'utf8',
)

let testEnv: RulesTestEnvironment

function splitEmulatorHost(): { host: string; port: number } {
  const raw = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080'
  const [host, port] = raw.split(':')
  return { host, port: Number(port) }
}

function anonDb(): Firestore {
  return testEnv.unauthenticatedContext().firestore()
}

/** Autenticado, mas SEM a claim admin. */
function userDb(): Firestore {
  return testEnv
    .authenticatedContext('user-1', { email: 'user@foxy.test' })
    .firestore()
}

function adminDb(): Firestore {
  return testEnv
    .authenticatedContext(ADMIN_UID, { admin: true, email: ADMIN_EMAIL })
    .firestore()
}

const ADMIN_ACTOR = { uid: ADMIN_UID, email: ADMIN_EMAIL }

/** Payload equivalente ao enviado pelo site (src/components/OrderSection.tsx). */
function validOrder(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    items: [
      {
        id: 'carne',
        name: 'Esfirra de carne',
        category: 'salgadas',
        quantity: 2,
        unitPrice: 800,
        totalPrice: 1600,
      },
    ],
    customerName: 'Maria',
    notes: '',
    pickupLocation: 'Foxy Esfirras',
    totalItems: 2,
    totalAmount: 1600,
    status: 'pendente',
    createdAt: serverTimestamp(),
    ...overrides,
  }
}

/** Semeia dados sem passar pelas regras. */
async function seedOrder(
  id: string,
  overrides: Record<string, unknown> = {},
): Promise<void> {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'pedidos', id), {
      ...validOrder({ createdAt: Timestamp.now() }),
      ...overrides,
    })
  })
}

async function seedHistory(
  orderId: string,
  historyId: string,
  overrides: Record<string, unknown> = {},
): Promise<void> {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(
      doc(context.firestore(), 'pedidos', orderId, 'historico', historyId),
      {
        pedidoId: orderId,
        fromStatus: 'pendente',
        toStatus: 'em_preparacao',
        changedAt: Timestamp.now(),
        changedBy: ADMIN_ACTOR,
        ...overrides,
      },
    )
  })
}

interface ChangeStatusOptions {
  historyId?: string
  /** Permite apontar para outro histórico (teste de reutilização). */
  lastHistoryId?: string
  reason?: string
  actor?: { uid: string; email: string }
  /** Não grava o histórico: deve ser negado pelas regras. */
  skipHistory?: boolean
  /** Sobrescreve campos do update do pedido. */
  orderPatch?: Record<string, unknown>
  /** Sobrescreve campos do documento de histórico. */
  historyPatch?: Record<string, unknown>
}

/** Mesma transação usada por orderService.changeOrderStatus. */
async function changeStatus(
  db: Firestore,
  orderId: string,
  from: string,
  to: string,
  options: ChangeStatusOptions = {},
): Promise<void> {
  const historyId = options.historyId ?? 'hist-1'
  const actor = options.actor ?? ADMIN_ACTOR

  const orderRef = doc(db, 'pedidos', orderId)
  const historyRef = doc(db, 'pedidos', orderId, 'historico', historyId)

  await runTransaction(db, async (transaction) => {
    transaction.update(orderRef, {
      status: to,
      updatedAt: serverTimestamp(),
      statusUpdatedAt: serverTimestamp(),
      statusUpdatedBy: actor,
      lastHistoryId: options.lastHistoryId ?? historyId,
      ...options.orderPatch,
    })

    if (!options.skipHistory) {
      transaction.set(historyRef, {
        pedidoId: orderId,
        fromStatus: from,
        toStatus: to,
        changedAt: serverTimestamp(),
        changedBy: actor,
        ...(options.reason ? { reason: options.reason } : {}),
        ...options.historyPatch,
      })
    }
  })
}

beforeAll(async () => {
  const { host, port } = splitEmulatorHost()
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: RULES, host, port },
  })
})

afterAll(async () => {
  await testEnv.cleanup()
})

beforeEach(async () => {
  await testEnv.clearFirestore()
})

/* ==================================================================
   Leitura
   ================================================================== */

describe('leitura de pedidos', () => {
  beforeEach(async () => {
    await seedOrder('pedido-1')
    await seedHistory('pedido-1', 'hist-1')
  })

  it('nega leitura sem autenticação', async () => {
    await assertFails(getDoc(doc(anonDb(), 'pedidos', 'pedido-1')))
    await assertFails(getDocs(collection(anonDb(), 'pedidos')))
  })

  it('nega leitura para usuário autenticado sem claim admin', async () => {
    await assertFails(getDoc(doc(userDb(), 'pedidos', 'pedido-1')))
    await assertFails(getDocs(collection(userDb(), 'pedidos')))
  })

  it('nega leitura do histórico sem admin', async () => {
    await assertFails(
      getDocs(collection(anonDb(), 'pedidos', 'pedido-1', 'historico')),
    )
  })

  it('permite leitura para admin', async () => {
    const db = adminDb()
    await assertSucceeds(getDoc(doc(db, 'pedidos', 'pedido-1')))
    await assertSucceeds(getDocs(collection(db, 'pedidos')))
    await assertSucceeds(
      getDocs(collection(db, 'pedidos', 'pedido-1', 'historico')),
    )
  })
})

/* ==================================================================
   Criação pública
   ================================================================== */

describe('criação pública de pedido', () => {
  it('aceita o payload do site com createdAt do servidor', async () => {
    await assertSucceeds(addDoc(collection(anonDb(), 'pedidos'), validOrder()))
  })

  it('aceita contato e pagamento opcionais válidos', async () => {
    await assertSucceeds(
      addDoc(
        collection(anonDb(), 'pedidos'),
        validOrder({
          customerContact: '11912345678',
          paymentMethod: 'pix',
        }),
      ),
    )
  })

  it('nega quando faltam campos obrigatórios', async () => {
    const withoutName = validOrder()
    delete withoutName.customerName
    await assertFails(addDoc(collection(anonDb(), 'pedidos'), withoutName))
  })

  it('nega status diferente de pendente', async () => {
    await assertFails(
      addDoc(collection(anonDb(), 'pedidos'), validOrder({ status: 'pronto' })),
    )
  })

  it('nega createdAt vindo do cliente', async () => {
    await assertFails(
      addDoc(
        collection(anonDb(), 'pedidos'),
        validOrder({ createdAt: Timestamp.now() }),
      ),
    )
  })

  it('nega campos internos de controle na criação', async () => {
    await assertFails(
      addDoc(
        collection(anonDb(), 'pedidos'),
        validOrder({ lastHistoryId: 'hist-1' }),
      ),
    )
    await assertFails(
      addDoc(
        collection(anonDb(), 'pedidos'),
        validOrder({ statusUpdatedBy: ADMIN_ACTOR }),
      ),
    )
  })

  it('nega forma de pagamento fora do enum', async () => {
    await assertFails(
      addDoc(
        collection(anonDb(), 'pedidos'),
        validOrder({ paymentMethod: 'boleto' }),
      ),
    )
  })

  it('nega listas vazias, totais inválidos e observação longa', async () => {
    await assertFails(
      addDoc(collection(anonDb(), 'pedidos'), validOrder({ items: [] })),
    )
    await assertFails(
      addDoc(collection(anonDb(), 'pedidos'), validOrder({ totalItems: 0 })),
    )
    await assertFails(
      addDoc(collection(anonDb(), 'pedidos'), validOrder({ totalAmount: 0 })),
    )
    await assertFails(
      addDoc(
        collection(anonDb(), 'pedidos'),
        validOrder({ notes: 'x'.repeat(281) }),
      ),
    )
    await assertFails(
      addDoc(
        collection(anonDb(), 'pedidos'),
        validOrder({ customerContact: '1'.repeat(21) }),
      ),
    )
  })

  it('nega tipo errado nos campos', async () => {
    await assertFails(
      addDoc(collection(anonDb(), 'pedidos'), validOrder({ totalAmount: '1600' })),
    )
    await assertFails(
      addDoc(collection(anonDb(), 'pedidos'), validOrder({ customerName: 42 })),
    )
  })
})

/* ==================================================================
   Mudança de status
   ================================================================== */

describe('mudança de status pelo admin', () => {
  beforeEach(async () => {
    await seedOrder('pedido-1')
  })

  it('aceita avanço com histórico no mesmo commit', async () => {
    const db = adminDb()
    await assertSucceeds(
      changeStatus(db, 'pedido-1', 'pendente', 'em_preparacao'),
    )

    const order = await getDoc(doc(db, 'pedidos', 'pedido-1'))
    expect(order.data()?.status).toBe('em_preparacao')
    expect(order.data()?.lastHistoryId).toBe('hist-1')

    const history = await getDoc(
      doc(db, 'pedidos', 'pedido-1', 'historico', 'hist-1'),
    )
    expect(history.data()).toMatchObject({
      pedidoId: 'pedido-1',
      fromStatus: 'pendente',
      toStatus: 'em_preparacao',
    })
  })

  it('nega update sem o histórico correspondente', async () => {
    await assertFails(
      changeStatus(adminDb(), 'pedido-1', 'pendente', 'em_preparacao', {
        skipHistory: true,
      }),
    )
  })

  it('nega transição inválida mesmo com histórico', async () => {
    await assertFails(
      changeStatus(adminDb(), 'pedido-1', 'pendente', 'pronto'),
    )
  })

  it('nega saltos de etapa a partir de em_preparacao', async () => {
    await seedOrder('pedido-2', { status: 'em_preparacao' })
    await assertFails(changeStatus(adminDb(), 'pedido-2', 'em_preparacao', 'entregue'))
  })

  it('nega alteração de campos originais no mesmo update', async () => {
    await assertFails(
      changeStatus(adminDb(), 'pedido-1', 'pendente', 'em_preparacao', {
        orderPatch: { customerName: 'Outra pessoa' },
      }),
    )
    await assertFails(
      changeStatus(adminDb(), 'pedido-1', 'pendente', 'em_preparacao', {
        orderPatch: { items: [] },
      }),
    )
    await assertFails(
      changeStatus(adminDb(), 'pedido-1', 'pendente', 'em_preparacao', {
        orderPatch: { totalAmount: 1 },
      }),
    )
  })

  it('nega histórico com fromStatus incoerente', async () => {
    await assertFails(
      changeStatus(adminDb(), 'pedido-1', 'pendente', 'em_preparacao', {
        historyPatch: { fromStatus: 'em_preparacao' },
      }),
    )
  })

  it('nega histórico com toStatus incoerente', async () => {
    await assertFails(
      changeStatus(adminDb(), 'pedido-1', 'pendente', 'em_preparacao', {
        historyPatch: { toStatus: 'pronto' },
      }),
    )
  })

  it('grava o histórico com outro id mesmo sendo segundo avanço', async () => {
    const db = adminDb()
    await assertSucceeds(changeStatus(db, 'pedido-1', 'pendente', 'em_preparacao'))
    await assertSucceeds(
      changeStatus(db, 'pedido-1', 'em_preparacao', 'pronto', {
        historyId: 'hist-2',
      }),
    )

    const entries = await getDocs(
      collection(db, 'pedidos', 'pedido-1', 'historico'),
    )
    expect(entries.size).toBe(2)
  })

  it('nega reutilização do lastHistoryId anterior', async () => {
    const db = adminDb()
    await assertSucceeds(changeStatus(db, 'pedido-1', 'pendente', 'em_preparacao'))
    await assertFails(
      changeStatus(db, 'pedido-1', 'em_preparacao', 'pronto', {
        historyId: 'hist-2',
        lastHistoryId: 'hist-1',
      }),
    )
  })

  it('nega update assinado por outro usuário', async () => {
    await assertFails(
      changeStatus(adminDb(), 'pedido-1', 'pendente', 'em_preparacao', {
        actor: { uid: 'outro-admin', email: ADMIN_EMAIL },
      }),
    )
  })

  it('nega update por usuário sem claim admin', async () => {
    await assertFails(
      changeStatus(userDb(), 'pedido-1', 'pendente', 'em_preparacao'),
    )
  })

  it('nega timestamps do cliente no pedido', async () => {
    await assertFails(
      changeStatus(adminDb(), 'pedido-1', 'pendente', 'em_preparacao', {
        orderPatch: { updatedAt: Timestamp.now() },
      }),
    )
  })

  it('exige motivo para cancelar', async () => {
    await assertFails(
      changeStatus(adminDb(), 'pedido-1', 'pendente', 'cancelado'),
    )
    await assertSucceeds(
      changeStatus(adminDb(), 'pedido-1', 'pendente', 'cancelado', {
        reason: 'Cliente desistiu',
      }),
    )
  })

  it('exige motivo para retroceder', async () => {
    await seedOrder('pedido-3', { status: 'pronto' })
    await assertFails(
      changeStatus(adminDb(), 'pedido-3', 'pronto', 'em_preparacao'),
    )
    await assertSucceeds(
      changeStatus(adminDb(), 'pedido-3', 'pronto', 'em_preparacao', {
        reason: 'Item errado',
      }),
    )
  })

  it('nega cancelamento após entrega', async () => {
    await seedOrder('pedido-4', { status: 'entregue' })
    await assertFails(
      changeStatus(adminDb(), 'pedido-4', 'entregue', 'cancelado', {
        reason: 'Tarde demais',
      }),
    )
  })

  it('nega status legado desconhecido', async () => {
    await seedOrder('pedido-5', { status: 'finalizado' })
    await assertFails(
      changeStatus(adminDb(), 'pedido-5', 'finalizado', 'entregue', {
        reason: 'Teste',
      }),
    )
  })
})

/* ==================================================================
   Histórico append-only e integridade
   ================================================================== */

describe('histórico e exclusão', () => {
  beforeEach(async () => {
    await seedOrder('pedido-1')
  })

  it('nega update e delete de histórico', async () => {
    const db = adminDb()
    await assertSucceeds(changeStatus(db, 'pedido-1', 'pendente', 'em_preparacao'))

    const historyRef = doc(db, 'pedidos', 'pedido-1', 'historico', 'hist-1')
    await assertFails(updateDoc(historyRef, { reason: 'editado' }))
    await assertFails(deleteDoc(historyRef))
  })

  it('nega delete de pedido', async () => {
    await assertFails(deleteDoc(doc(adminDb(), 'pedidos', 'pedido-1')))
  })

  it('nega criar histórico isolado, sem o pedido apontar para ele', async () => {
    const db = adminDb()
    await assertFails(
      setDoc(doc(db, 'pedidos', 'pedido-1', 'historico', 'avulso'), {
        pedidoId: 'pedido-1',
        fromStatus: 'pendente',
        toStatus: 'em_preparacao',
        changedAt: serverTimestamp(),
        changedBy: ADMIN_ACTOR,
      }),
    )
  })

  it('aceita transição completa até entregue', async () => {
    const db = adminDb()
    await assertSucceeds(changeStatus(db, 'pedido-1', 'pendente', 'em_preparacao'))
    await assertSucceeds(
      changeStatus(db, 'pedido-1', 'em_preparacao', 'pronto', {
        historyId: 'hist-2',
      }),
    )
    await assertSucceeds(
      changeStatus(db, 'pedido-1', 'pronto', 'entregue', {
        historyId: 'hist-3',
      }),
    )

    const order = await getDoc(doc(db, 'pedidos', 'pedido-1'))
    expect(order.data()?.status).toBe('entregue')
    expect(order.data()?.lastHistoryId).toBe('hist-3')
  })
})
