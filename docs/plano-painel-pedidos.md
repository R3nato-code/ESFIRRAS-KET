# Plano — Painel Administrativo de Pedidos | Foxy Esfirras

**Status:** em execução — Fases 1 a 3 concluídas (regras publicadas)  
**Data:** 31/10/2026  
**Repositório:** `R3nato-code/ESFIRRAS-KET`  
**Projeto Firebase:** `esfirra-ket`

---

## 1. Objetivo

Criar um sistema administrativo separado para acompanhar e gerenciar os pedidos já registrados pelo site da Foxy Esfirras, sem recriar o site e sem criar um banco de dados paralelo.

O painel deve permitir:

- visualizar pedidos em tempo real;
- consultar todos os dados de cada pedido;
- acompanhar indicadores por status;
- pesquisar e filtrar pedidos;
- alterar o status com validação;
- registrar automaticamente todo o histórico de alterações;
- funcionar bem em computador, tablet e celular.

---

## 2. Decisões aprovadas

| Tema | Decisão |
|---|---|
| Autenticação | Firebase Authentication com e-mail e senha + custom claim `admin` |
| Publicação | Aplicativo separado, com deploy próprio no Render |
| Organização | Mesmo repositório, apps independentes: site na raiz e painel em `admin/` |
| Banco de dados | Mesmo Firestore do site; coleção `pedidos` como fonte da verdade |
| Contato | Campo opcional `customerContact` no pedido |
| Pagamento | Campo opcional `paymentMethod`: `pix`, `dinheiro` ou `cartao` |
| Status | Avanço normal, retrocesso de uma etapa e cancelamento |
| Estado final | `cancelado` é final por padrão |
| Histórico | Subcoleção imutável, gravada em transação atômica |
| Garantia | Regras do Firestore + transação no cliente; sem Cloud Functions |
| Contagem dos cards | Total geral por status |
| Identificador | ID do documento do Firestore, exibido de forma curta e copiável |

---

## 3. Estado atual verificado do projeto

### 3.1 Stack

- React 19 + TypeScript + Vite
- Three.js / React Three Fiber na entrada do site
- Firebase Web SDK 13
- Firestore como banco de dados
- Render como site estático
- Node.js exigido: `>=20.19`
- Ambiente local verificado: Node `v24.21.0`, npm `11.19.0`, Java `1.8`

### 3.2 Como o pedido é criado hoje

Arquivo: `src/components/OrderSection.tsx`

O site usa `addDoc(collection(db, 'pedidos'), orderData)` com:

```ts
{
  items: OrderItem[],
  customerName: string,
  notes: string,
  pickupLocation: string,
  totalItems: number,
  totalAmount: number,   // centavos
  status: 'pendente',
  createdAt: serverTimestamp()
}
```

Cada item contém:

```ts
{
  id: string,
  name: string,
  category: 'salgadas' | 'doces',
  quantity: number,
  unitPrice: number,   // centavos
  totalPrice: number   // centavos
}
```

### 3.3 Regras atuais do Firestore

Arquivo: `firestore.rules`

- `create` público para pedidos válidos;
- `read` público;
- `update` e `delete` bloqueados;
- todo o restante bloqueado.

**Risco atual:** a leitura pública permite que qualquer pessoa com a API key consulte todos os pedidos. O site não lê pedidos em nenhum lugar, então a leitura pode ser restringida ao admin sem quebrar o site.

### 3.4 O que ainda não existe

- autenticação administrativa;
- leitura/atualização de pedidos pelo painel;
- telefone ou contato do cliente;
- forma de pagamento;
- histórico de alterações;
- índices compostos para filtros;
- segundo serviço de deploy para o admin.

### 3.5 O que não será alterado sem necessidade

- entrada 3D e identidade visual do site;
- cardápio e preços;
- fluxo de montagem do pedido;
- deploy atual do site;
- estrutura da coleção `pedidos` além dos campos novos opcionais.

---

## 4. Arquitetura alvo

```text
Site Foxy (Render)              Admin Foxy (Render)
      │                              │
      └──────────────┬───────────────┘
                     ▼
          Firestore — projeto esfirra-ket
          └── pedidos/{pedidoId}
              └── historico/{registroId}
```

### 4.1 Dois aplicativos, um banco

- O site continua na raiz do repositório e no serviço atual do Render.
- O admin fica em `admin/`, com `package.json`, `node_modules`, build e deploy próprios.
- Cada aplicativo gera seu próprio `dist`:
  - site: `dist/`;
  - admin: `admin/dist/`.
- O build do site não inclui arquivos do admin, e vice-versa.
- Os dois usam o mesmo projeto Firebase e a mesma coleção `pedidos`.
- As regras e os índices do Firestore permanecem na raiz do repositório.

### 4.2 Por que aplicativo separado

- O bundle do site não carrega código administrativo.
- O admin pode ser publicado e revertido sem republicar o site.
- O domínio do admin pode ter controle de acesso e política de cache próprios.
- O site público não expõe link para o painel.
- O Firestore continua sendo a única fonte de verdade.

---

## 5. Estrutura de pastas proposta

```text
ESFIRRAS-KET/
├─ src/                                  # site atual
│  └─ components/
│     └─ OrderSection.tsx                # + contato e pagamento opcionais
├─ admin/                                # NOVO app administrativo
│  ├─ index.html
│  ├─ package.json
│  ├─ package-lock.json
│  ├─ tsconfig.json
│  ├─ vite.config.ts
│  ├─ .env.example
│  ├─ public/
│  │  └─ fonts/                          # Outfit local, se necessário
│  ├─ scripts/
│  │  └─ set-admin.mjs                   # concede/remove claim admin
│  └─ src/
│     ├─ main.tsx
│     ├─ AdminApp.tsx
│     ├─ styles/
│     │  ├─ tokens.css
│     │  ├─ base.css
│     │  ├─ layout.css
│     │  ├─ components.css
│     │  └─ responsive.css
│     ├─ lib/
│     │  ├─ firebase.ts
│     │  ├─ orders.ts                    # tipos, status, transições, mapeadores
│     │  ├─ format.ts                    # moeda, data/hora, telefone, ID curto
│     │  ├─ orderService.ts              # consultas e transação
│     │  ├─ errors.ts                    # tradução de erros do Firestore
│     │  └─ query.ts                     # helpers de busca/filtro/ordenação
│     ├─ auth/
│     │  ├─ AdminAuthProvider.tsx
│     │  ├─ useAdminAuth.ts
│     │  ├─ RequireAdmin.tsx
│     │  └─ LoginScreen.tsx
│     ├─ hooks/
│     │  ├─ useOrders.ts
│     │  ├─ useOrderCounts.ts
│     │  ├─ useOrderHistory.ts
│     │  ├─ useDebouncedValue.ts
│     │  └─ useNewOrderAlert.ts
│     └─ components/
│        ├─ AdminLayout.tsx
│        ├─ AdminHeader.tsx
│        ├─ StatsCards.tsx
│        ├─ OrdersFilters.tsx
│        ├─ OrdersTable.tsx
│        ├─ OrdersCards.tsx
│        ├─ OrderDetailDrawer.tsx
│        ├─ OrderItems.tsx
│        ├─ HistoryTimeline.tsx
│        ├─ StatusBadge.tsx
│        ├─ StatusActions.tsx
│        ├─ ConfirmDialog.tsx
│        ├─ EmptyState.tsx
│        ├─ ErrorState.tsx
│        ├─ Skeleton.tsx
│        ├─ Toast.tsx
│        └─ Icons.tsx
├─ scripts/
│  └─ (scripts auxiliares, se necessário)
├─ docs/
│  └─ plano-painel-pedidos.md             # este arquivo
├─ AGENTS.md                              # contexto para futuras sessões de IA
├─ firestore.rules                        # atualizado
├─ firestore.indexes.json                 # novo
├─ firebase.json                          # inclui indexes
├─ render.yaml                            # dois serviços estáticos
├─ README.md                              # seção do painel
└─ package.json                           # scripts de conveniência
```

---

## 6. Modelo de dados

### 6.1 Documento do pedido

Coleção: `pedidos`

| Campo | Tipo | Obrigatório | Observação |
|---|---|---|---|
| `customerName` | string | sim | Já existe |
| `customerContact` | string | não | Novo; telefone/WhatsApp |
| `items` | array | sim | Já existe; snapshot dos itens |
| `notes` | string | não | Já existe; máximo 280 |
| `pickupLocation` | string | sim | Já existe |
| `totalItems` | number inteiro | sim | Já existe |
| `totalAmount` | number inteiro | sim | Já existe; centavos |
| `paymentMethod` | string | não | Novo; `pix`, `dinheiro` ou `cartao` |
| `status` | string | sim | Já existe; valores canônicos abaixo |
| `createdAt` | timestamp | sim | Já existe; `serverTimestamp()` |
| `updatedAt` | timestamp | não | Controle interno |
| `statusUpdatedAt` | timestamp | não | Controle interno |
| `statusUpdatedBy` | map | não | Controle interno; `{ uid, email }` |
| `lastHistoryId` | string | não | Controle interno de integridade |

Valores canônicos de status:

```text
pendente
em_preparacao
pronto
entregue
cancelado
```

### 6.2 Documento de histórico

Subcoleção: `pedidos/{pedidoId}/historico`

| Campo | Tipo | Obrigatório | Observação |
|---|---|---|---|
| `pedidoId` | string | sim | Redundância para auditoria |
| `fromStatus` | string | sim | Status anterior |
| `toStatus` | string | sim | Novo status |
| `changedAt` | timestamp | sim | `serverTimestamp()` |
| `changedBy` | map | sim | `{ uid, email }` |
| `reason` | string | não | Motivo de cancelamento/retrocesso |

### 6.3 Compatibilidade com pedidos antigos

- Pedidos sem `customerContact` exibem **“Não informado”**.
- Pedidos sem `paymentMethod` exibem **“Não informado”**.
- Pedidos sem histórico exibem um evento inicial sintetizado a partir de `createdAt`:
  - “Pedido recebido pelo site”;
  - sem usuário responsável;
  - sem gravar nada no banco.
- Nenhum campo original será migrado ou sobrescrito.
- Antes da implementação, auditar os valores de `status` existentes. Se houver valor fora dos canônicos, tratar como status desconhecido e corrigir manualmente no Console ou com script pontual.

---

## 7. Máquina de status

| Status atual | Avançar | Voltar | Cancelar |
|---|---|---|---|
| `pendente` | `em_preparacao` | — | Sim |
| `em_preparacao` | `pronto` | `pendente` | Sim |
| `pronto` | `entregue` | `em_preparacao` | Sim |
| `entregue` | — | `pronto` | Não |
| `cancelado` | — | — | — |

Regras de negócio:

1. Retrocesso permitido apenas uma etapa por vez.
2. `cancelado` é terminal por padrão.
3. Cancelamento e retrocesso exigem confirmação e motivo.
4. `entregue` exige confirmação por ser conclusão do pedido.
5. Avanços normais podem ser aplicados com um clique.
6. O painel só mostra ações válidas para o status atual.
7. A validação definitiva fica nas regras do Firestore.
8. Toda alteração gera exatamente um registro no histórico.

---

## 8. Histórico e integridade

### 8.1 Transação de mudança de status

Pseudocódigo:

```ts
const orderRef = doc(db, 'pedidos', orderId)
const historyRef = doc(collection(db, 'pedidos', orderId, 'historico'))

await runTransaction(db, async (tx) => {
  const snap = await tx.get(orderRef)
  if (!snap.exists()) throw new Error('Pedido não encontrado')

  const currentStatus = snap.data().status
  if (!isValidTransition(currentStatus, nextStatus)) {
    throw new Error('Transição de status inválida')
  }

  tx.update(orderRef, {
    status: nextStatus,
    updatedAt: serverTimestamp(),
    statusUpdatedAt: serverTimestamp(),
    statusUpdatedBy: { uid: user.uid, email: user.email },
    lastHistoryId: historyRef.id
  })

  tx.set(historyRef, {
    pedidoId: orderId,
    fromStatus: currentStatus,
    toStatus: nextStatus,
    changedAt: serverTimestamp(),
    changedBy: { uid: user.uid, email: user.email },
    ...(reason ? { reason } : {})
  })
})
```

### 8.2 Contrato de integridade

As regras do Firestore devem exigir:

- update de pedido somente por admin autenticado;
- mudança de status somente se `lastHistoryId` apontar para um documento **novo** em `historico`;
- esse documento deve existir no estado pós-escrita (`existsAfter`);
- `fromStatus` deve ser igual ao status anterior do pedido;
- `toStatus` deve ser igual ao novo status do pedido;
- `lastHistoryId` deve ser igual ao ID do registro criado;
- `changedAt` e `statusUpdatedAt` devem usar `request.time`;
- `changedBy.uid` e `statusUpdatedBy.uid` devem ser iguais a `request.auth.uid`;
- o histórico não pode ser atualizado nem apagado;
- o pedido não pode ser apagado;
- somente campos de status e controle podem mudar.

Campos permitidos no update do pedido:

```text
status
updatedAt
statusUpdatedAt
statusUpdatedBy
lastHistoryId
```

Qualquer tentativa de alterar `customerName`, `items`, `totalAmount`, `notes`, `createdAt` etc. deve ser negada.

### 8.3 Prevenção de duplicidade

- Cada mudança usa um novo ID de documento de histórico.
- O pedido guarda apenas o último ID em `lastHistoryId`.
- O histórico é append-only.
- A transação lê o status atual antes de gravar.
- Se outro admin alterou o pedido antes, a transição é revalidada e a operação falha com mensagem de conflito.
- Repetir a mesma ação não cria outro registro: o novo status já não permite a mesma transição.

### 8.4 Limitação conhecida

As regras bloqueiam o app e qualquer SDK cliente. Um operador com Admin SDK, Console ou credenciais de service account ainda pode burlar as regras. Para garantia absoluta seria necessário Cloud Function com regras fechadas para escrita e backups. Essa opção não faz parte do escopo aprovado.

Recomendação adicional: habilitar backup/exportação periódica do Firestore quando o projeto estiver no plano adequado.

---

## 9. Aplicativo administrativo

### 9.1 Autenticação

- Firebase Authentication com provedor **Email/Password**.
- Sem cadastro público no painel.
- Login com e-mail e senha.
- “Esqueci minha senha” via `sendPasswordResetEmail`.
- Sessão restaurada com `onAuthStateChanged`.
- Após login, verificar `getIdTokenResult(true).claims.admin === true`.
- Se a claim não existir:
  - encerrar sessão;
  - mostrar “Sua conta não tem permissão de administrador”.
- Cabeçalho mostra o e-mail do usuário e botão “Sair”.

Script de permissão:

```bash
GOOGLE_APPLICATION_CREDENTIALS="caminho/para/service-account.json" \
  npm --prefix admin run grant-admin -- admin@exemplo.com
```

Requisitos:

- `firebase-admin` apenas como dependência de desenvolvimento;
- service account nunca commitada;
- adicionar padrões de service account ao `.gitignore`;
- após conceder a claim, o usuário deve sair e entrar novamente.

### 9.2 Telas

#### Login

- Marca Foxy;
- campos de e-mail e senha;
- mostrar/ocultar senha;
- mensagens de erro claras;
- link de recuperação de senha;
- estado de carregamento;
- layout responsivo.

#### Dashboard

- Cabeçalho com marca, e-mail do admin, status de conexão e sair.
- Cards de indicadores:
  - Pendente;
  - Em preparação;
  - Pronto;
  - Entregue;
  - Cancelado.
- Cards clicáveis para filtrar.
- Destaque visual para pedidos que precisam de atendimento.
- Busca por nome, telefone ou ID.
- Filtros por status e período.
- Ordenação por data e valor.
- Lista em tabela no desktop e cartões no celular.
- Botão “Carregar mais”.
- Atualização em tempo real.
- Toast quando um novo pedido chegar com o painel aberto.
- Estado vazio e estado de erro.

#### Detalhe do pedido

- Drawer lateral no desktop.
- Tela cheia no celular.
- Cabeçalho com ID curto, status e data.
- Dados do cliente e contato.
- Link `tel:` e WhatsApp quando houver telefone.
- Itens com quantidade, preço unitário e subtotal.
- Total, pagamento, retirada e observações.
- Ações de status.
- Linha do tempo completa.
- Botão de copiar ID completo.
- Fechamento por Escape, botão e clique fora.
- Foco preso no drawer enquanto aberto.

### 9.3 Consultas e tempo real

Lista:

```ts
onSnapshot(query(
  collection(db, 'pedidos'),
  ...(statusFilter ? [where('status', '==', statusFilter)] : []),
  ...(periodStart ? [where('createdAt', '>=', periodStart)] : []),
  ...(periodEnd ? [where('createdAt', '<=', periodEnd)] : []),
  orderBy('createdAt', 'desc'),
  limit(pageSize)
))
```

- `pageSize` inicial: 50 ou 100.
- “Carregar mais” aumenta o limite.
- Busca é feita no conjunto carregado.
- Se o termo parecer um ID completo, tentar `getDoc` como fallback.
- Pedidos com `createdAt` pendente são exibidos como “Processando data”.

Histórico:

```ts
onSnapshot(
  query(
    collection(db, 'pedidos', orderId, 'historico'),
    orderBy('changedAt', 'asc')
  ),
  ...
)
```

Indicadores:

```ts
getCountFromServer(query(
  collection(db, 'pedidos'),
  where('status', '==', status)
))
```

- Uma consulta por status.
- Atualizar após mudanças de status e após novos pedidos.
- Evitar polling agressivo; usar debounce.

### 9.4 Busca, filtros e ordenação

Busca:

- nome do cliente;
- telefone;
- ID do pedido;
- normalização de acentos e maiúsculas;
- debounce de 250 ms;
- limpar busca.

Filtros:

- status;
- hoje;
- últimos 7 dias;
- últimos 30 dias;
- tudo;
- intervalo personalizado com data inicial e final.

Ordenação:

- mais recentes primeiro (padrão);
- mais antigos primeiro;
- maior valor;
- menor valor.

### 9.5 Visual e responsividade

- Fundo claro quente, cartões brancos e texto escuro.
- Laranja da marca `#E85403` como cor de destaque.
- Cores de status:
  - pendente: âmbar;
  - em preparação: azul;
  - pronto: verde;
  - entregue: cinza;
  - cancelado: vermelho.
- Fonte Outfit local, se os arquivos forem copiados; fallback para `system-ui`.
- Sem framework de UI e sem biblioteca de gráficos.
- Ícones SVG locais.
- Desktop: sidebar + conteúdo + drawer.
- Tablet: sidebar recolhível + grid adaptado.
- Celular: topo compacto, filtros em rolagem horizontal, cartões e drawer em tela cheia.
- Áreas de toque com pelo menos 44 px.
- Respeitar `prefers-reduced-motion`.
- Contraste adequado e foco visível.

### 9.6 Formatadores

- Moeda: `Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })`, convertendo centavos.
- Data/hora: `Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', ... })`.
- Telefone: exibição como digitado; link WhatsApp com dígitos normalizados e prefixo `55` quando necessário.
- Status: labels em português.
- ID curto: prefixo `#` + parte do ID; ID completo disponível para copiar.

### 9.7 Tratamento de erros

| Código | Tratamento |
|---|---|
| `permission-denied` | Sessão sem permissão ou regras não publicadas |
| `failed-precondition` | Índice ausente; orientar a rodar o deploy de índices |
| `unavailable` | Sem conexão; permitir tentar novamente |
| `aborted` | Conflito de transação; recarregar pedido |
| `not-found` | Pedido removido ou inexistente |
| claim ausente | Encerrar sessão e mostrar mensagem |

- Nunca mostrar stack trace para o usuário.
- Registrar detalhes no console em desenvolvimento.
- Usar `aria-live` para feedback de status e erros.
- Desabilitar botões durante a gravação.
- Em conflito, atualizar o status exibido e pedir nova confirmação.

---

## 10. Alterações no site existente

Arquivo principal: `src/components/OrderSection.tsx`

Adicionar, sem redesenhar a seção:

1. Campo opcional **WhatsApp / telefone**:
   - `type="tel"`;
   - `inputMode="tel"`;
   - `autoComplete="tel"`;
   - máximo de 20 caracteres;
   - validação apenas se preenchido;
   - armazenar em `customerContact`.

2. Campo opcional **Forma de pagamento**:
   - opções `Pix`, `Dinheiro`, `Cartão`;
   - valor armazenado `pix`, `dinheiro` ou `cartao`;
   - permitir não selecionar.

3. Incluir os campos no objeto `OrderData`.
4. Incluir os dados no resumo/mensagem, quando existirem.
5. Manter `status: 'pendente'` e `createdAt: serverTimestamp()`.
6. Não alterar preços, itens, layout geral ou fluxo de confirmação.

Compatibilidade:

- campos opcionais não quebram pedidos antigos;
- as regras novas devem aceitar pedidos sem esses campos;
- o site antigo continua funcionando durante a transição.

---

## 11. Segurança do Firestore

### 11.1 Criação pública

Permitir `create` em `pedidos` somente se:

- todos os campos obrigatórios existirem;
- `status == 'pendente'`;
- `createdAt == request.time`;
- `customerName` for string não vazia;
- `items` for lista não vazia;
- `totalItems` e `totalAmount` forem inteiros positivos;
- `pickupLocation` for string;
- `notes` for string com tamanho limitado;
- `customerContact`, se existir, for string com tamanho limitado;
- `paymentMethod`, se existir, estiver no enum permitido;
- apenas campos permitidos forem enviados;
- `lastHistoryId`, `statusUpdatedBy` e campos internos não forem aceitos na criação.

### 11.2 Leitura

- `pedidos` e `historico`: somente admin autenticado.
- Remover a leitura pública atual.
- O site não lê pedidos, então não há quebra.
- Se no futuro o cliente precisar acompanhar o pedido, criar um mecanismo seguro separado.

### 11.3 Atualização

- Somente admin.
- Status deve mudar.
- Transição deve ser válida.
- Apenas campos de controle podem mudar.
- `statusUpdatedBy.uid` deve ser o usuário autenticado.
- `lastHistoryId` deve apontar para um histórico novo criado no mesmo commit.
- `statusUpdatedAt` e `updatedAt` devem ser `request.time`.

### 11.4 Histórico

- Somente admin pode ler.
- Somente admin pode criar.
- `fromStatus` e `toStatus` devem corresponder ao estado anterior e posterior do pedido.
- `changedAt == request.time`.
- `changedBy.uid == request.auth.uid`.
- `reason`, se existir, deve ser string com tamanho limitado.
- `update` e `delete` sempre negados.

### 11.5 Exclusão

- `delete` de pedidos: negado.
- `delete` de histórico: negado.
- Cancelamento é representado por status `cancelado`, não por exclusão.

### 11.6 Índices

Arquivo novo: `firestore.indexes.json`

Índice principal:

```json
{
  "collectionGroup": "pedidos",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "status", "order": "ASCENDING" },
    { "fieldPath": "createdAt", "order": "DESCENDING" }
  ]
}
```

Atualizar `firebase.json`:

```json
{
  "firestore": {
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  }
}
```

### 11.7 Proteções adicionais opcionais

- Firebase App Check para reduzir spam na criação pública.
- Limitação de taxa por Cloud Function, se necessário no futuro.
- Backup/exportação periódica do Firestore.
- Revisão de IAM da service account.
- Nunca commitar `.env`, service accounts ou tokens.

---

## 12. Deploy

### 12.1 Firebase — passos manuais

1. Acessar o Console do Firebase do projeto `esfirra-ket`.
2. Ativar Authentication → Sign-in method → Email/Password.
3. Criar o primeiro usuário administrador.
4. Gerar uma service account em Configurações do projeto → Contas de serviço.
5. Salvar o JSON fora do repositório.
6. Configurar `GOOGLE_APPLICATION_CREDENTIALS`.
7. Rodar o script para aplicar `admin: true`.
8. Publicar regras e índices.
9. Após o deploy do admin, adicionar o domínio em Authentication → Authorized domains.
10. Se a API key tiver restrição por referrer, adicionar o domínio do admin também.

### 12.2 Render — segundo serviço

Serviço atual (site):

```text
Nome: foxy-esfirras
Tipo: Static Site
Build: npm ci && npm run build
Publish: ./dist
```

Novo serviço (admin):

```text
Nome: foxy-esfirras-admin
Tipo: Static Site
Build: cd admin && npm ci && npm run build
Publish: admin/dist
```

Variáveis do admin:

```text
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
```

As mesmas seis variáveis do site. Elas são lidas em tempo de build; após alterar, fazer novo deploy sem cache.

### 12.3 render.yaml

Adicionar o segundo serviço ao arquivo existente:

```yaml
  - type: web
    name: foxy-esfirras-admin
    runtime: static
    buildCommand: cd admin && npm ci && npm run build
    staticPublishPath: admin/dist
    envVars:
      - key: VITE_FIREBASE_API_KEY
        sync: false
      - key: VITE_FIREBASE_AUTH_DOMAIN
        sync: false
      - key: VITE_FIREBASE_PROJECT_ID
        sync: false
      - key: VITE_FIREBASE_STORAGE_BUCKET
        sync: false
      - key: VITE_FIREBASE_MESSAGING_SENDER_ID
        sync: false
      - key: VITE_FIREBASE_APP_ID
        sync: false
    headers:
      - path: /assets/*
        name: Cache-Control
        value: public, max-age=31536000, immutable
```

### 12.4 Ordem segura de publicação

1. Fazer backup ou exportação do Firestore, se possível.
2. Publicar regras e índices.
3. Verificar se o site antigo ainda cria pedidos.
4. Publicar o site com contato/pagamento.
5. Criar o serviço do admin no Render.
6. Cadastrar as variáveis de ambiente.
7. Publicar o admin.
8. Adicionar o domínio do admin no Firebase Auth.
9. Criar um pedido de teste no site.
10. Verificar o pedido no admin.
11. Testar avanço, retrocesso, cancelamento e histórico.
12. Confirmar que usuário não autenticado não consegue ler pedidos.

### 12.5 Rollback

- Site: usar o deploy anterior no Render.
- Admin: usar o deploy anterior no Render.
- Regras: manter cópia da versão anterior e republicar pelo Firebase CLI.
- Dados: não há migração destrutiva; os campos novos são opcionais.
- Histórico: nunca é apagado por rollback de aplicação.

---

## 13. Fases de implementação

### Fase 0 — Preparação

- [ ] Confirmar acesso ao Console do Firebase.
- [ ] Confirmar acesso ao Render.
- [ ] Ativar Email/Password no Authentication.
- [ ] Criar usuário administrador.
- [ ] Gerar service account fora do repositório.
- [ ] Instalar Java 21+ para o Emulador do Firestore (CLI 15 exige 21+).
- [ ] Auditar os status existentes na coleção `pedidos`.

### Fase 1 — Estrutura do admin ✅ concluída em 31/10/2026

- [x] Criar `admin/` com Vite + React + TypeScript.
- [x] Criar `package.json`, `tsconfig.json` e `vite.config.ts`.
- [x] Validar as 6 variáveis `VITE_FIREBASE_*` no build.
- [x] Criar `admin/.env.example`.
- [x] Configurar scripts de dev, build e preview.
- [x] Adicionar fontes/ícones necessários (Outfit local, favicon, apple-touch, logo).
- [x] Garantir que o build do site não inclua o admin.

Evidências: `npm --prefix admin run build` (tsc + vite) e `npm run build` (site)
passam; dev server do admin responde 200 em `http://localhost:5174/`; `admin/dist`
não é lido pelo build do site. `admin/package-lock.json` versionado.

### Fase 2 — Domínio e camada de dados

### Fase 2 — Domínio e camada de dados ✅ concluída em 31/10/2026

- [x] Criar tipos `Order`, `OrderItem`, `OrderStatus`, `OrderHistoryEntry`.
- [x] Criar labels e cores de status.
- [x] Criar funções de transição válida.
- [x] Criar formatadores de moeda, data, telefone e ID.
- [x] Criar `orderService.ts` com queries.
- [x] Criar transação de mudança de status.
- [x] Criar tradução de erros do Firestore.
- [x] Criar testes unitários das funções puras.

Entregues: `orders.ts` (status, máquina de estados, `getOrderActions`, mapeadores
tolerantes a pedidos legados), `format.ts`, `query.ts` (busca sem acento,
períodos em America/Sao_Paulo, ordenação, contagens), `errors.ts`,
`firebase.ts` e `orderService.ts` (listeners, contagens, `changeOrderStatus`
em transação com histórico e checagem de conflito).
Testes: Vitest (`npm --prefix admin test`) — 75 casos passando; `tsc` e build
do admin OK. Nenhuma regra do Firestore foi alterada ainda (Fase 3).

### Fase 3 — Regras e índices — ✅ implementada e testada; publicação pendente

- [x] Atualizar `firestore.rules`.
- [x] Restringir leitura a admin.
- [x] Validar criação pública.
- [x] Validar transições.
- [x] Validar imutabilidade de campos.
- [x] Exigir histórico no mesmo commit.
- [x] Bloquear update/delete do histórico.
- [x] Criar `firestore.indexes.json`.
- [x] Atualizar `firebase.json`.
- [x] Testar regras no Emulador do Firestore.
- [x] Publicar regras e índices — publicado em 31/10/2026 no projeto `esfirra-ket`.

Evidências: 33 testes de regras (`npm --prefix admin run test:rules`) passando
contra o Emulador do Firestore. Contrato validado: leitura só com claim `admin`,
criação pública apenas `pendente` com `createdAt == request.time`, update restrito
aos 5 campos de controle, vínculo `lastHistoryId` ↔ histórico novo via `getAfter`,
motivo obrigatório em cancelamento/retrocesso, histórico e pedido sem update/delete.
O site não lê `pedidos` (só `addDoc`), então fechar a leitura não o quebra.

Publicação (31/10/2026):
- backup da versão anterior em `docs/rollback/firestore.rules.2026-10-31`;
- índice publicado antes das regras;
- regras compiladas pelo CLI e liberadas em `cloud.firestore`;
- smoke test real (`npm --prefix admin run smoke:prod`): leitura anônima negada,
  criação com status inválido negada, criação válida aceita e leitura do pedido
  criado negada — 4/4.

Pendências: auditar status legados no Console (pedidos com valor fora dos
canônicos aparecem como "desconhecido" e não avançam até correção manual) e
apagar o pedido de teste `hxVFS1qn2dXbLLMK1el6` (delete é bloqueado por regra).
Rollback das regras: `Copy-Item docs/rollback/firestore.rules.2026-10-31 firestore.rules`
e depois `npx firebase-tools deploy --only firestore:rules`.
Observação de ambiente: o Firebase CLI 15 exige **Java 21+** para o emulador
(Java 8 do sistema não serve).

### Fase 4 — Site

- [ ] Adicionar campo de contato.
- [ ] Adicionar campo de pagamento.
- [ ] Validar campos opcionais.
- [ ] Incluir no objeto enviado ao Firestore.
- [ ] Atualizar mensagem/resumo, se fizer sentido.
- [ ] Garantir compatibilidade com pedidos antigos.
- [ ] Testar criação de pedido com e sem os novos campos.

### Fase 5 — Login e layout

- [ ] Criar `firebase.ts` do admin.
- [ ] Criar contexto de autenticação.
- [ ] Criar tela de login.
- [ ] Validar claim `admin`.
- [ ] Criar recuperação de senha.
- [ ] Criar layout com sidebar/header.
- [ ] Criar logout.
- [ ] Criar estados de carregamento e erro.

### Fase 6 — Dashboard

- [ ] Criar cards de status.
- [ ] Criar busca.
- [ ] Criar filtros de status e período.
- [ ] Criar ordenação.
- [ ] Criar tabela desktop.
- [ ] Criar cartões mobile.
- [ ] Criar “Carregar mais”.
- [ ] Criar destaque de pedidos pendentes.
- [ ] Criar toast de novo pedido.
- [ ] Criar estados vazios.

### Fase 7 — Detalhe e histórico

- [ ] Criar drawer de detalhe.
- [ ] Exibir dados do cliente, contato, itens, totais, pagamento e observações.
- [ ] Criar ações de status.
- [ ] Criar confirmação para cancelar/retroceder/entregar.
- [ ] Exigir motivo quando necessário.
- [ ] Criar transação com histórico.
- [ ] Criar linha do tempo.
- [ ] Criar evento inicial sintético.
- [ ] Atualizar em tempo real.
- [ ] Tratar conflitos de concorrência.

### Fase 8 — Polimento e entrega

- [ ] Revisar responsividade.
- [ ] Revisar acessibilidade.
- [ ] Revisar mensagens de erro.
- [ ] Rodar build do site.
- [ ] Rodar build do admin.
- [ ] Rodar testes unitários.
- [ ] Rodar testes de regras (se Java disponível).
- [ ] Testar fluxo completo em ambiente de teste.
- [ ] Criar serviço no Render.
- [ ] Configurar variáveis.
- [ ] Publicar.
- [ ] Adicionar domínio ao Firebase Auth.
- [ ] Atualizar README.
- [ ] Fazer smoke test em produção.

---

## 14. Estratégia de testes

### 14.1 Testes unitários

- transições válidas e inválidas;
- retrocessos;
- cancelamento;
- status terminal;
- formatação de moeda;
- formatação de data;
- normalização de busca;
- filtros;
- ordenação;
- geração de link WhatsApp.

### 14.2 Testes das regras

Usar `@firebase/rules-unit-testing` com o Emulador do Firestore.

Casos obrigatórios:

- [ ] leitura sem autenticação negada;
- [ ] leitura por usuário sem claim negada;
- [ ] leitura por admin permitida;
- [ ] criação válida pelo site permitida;
- [ ] criação sem campos obrigatórios negada;
- [ ] criação com `status` diferente de `pendente` negada;
- [ ] criação com `createdAt` do cliente negada;
- [ ] criação com `paymentMethod` inválido negada;
- [ ] update por admin com transição válida + histórico permitido;
- [ ] update sem histórico negado;
- [ ] update com transição inválida negado;
- [ ] update tentando alterar `customerName` negado;
- [ ] update tentando alterar `items` negado;
- [ ] update tentando alterar `totalAmount` negado;
- [ ] update/delete de histórico negado;
- [ ] reutilização de `lastHistoryId` negada;
- [ ] delete de pedido negado.

### 14.3 Testes manuais

- login com credencial válida;
- login com senha errada;
- login com usuário sem claim;
- recuperação de senha;
- restauração de sessão;
- logout;
- listagem em tempo real;
- criação de pedido no site aparecendo no admin;
- filtros;
- busca por nome, telefone e ID;
- ordenação;
- detalhe do pedido;
- avanço de status;
- retrocesso com motivo;
- cancelamento com motivo;
- tentativa de ação inválida;
- dois navegadores alterando o mesmo pedido;
- visualização em desktop, tablet e celular;
- navegação por teclado;
- mensagens de erro quando as regras ou índices não estão publicados.

---

## 15. Critérios de aceite

O projeto será considerado concluído quando:

1. O site continuar funcionando sem regressões.
2. O site permitir contato e pagamento opcionais.
3. O admin tiver login individual e bloquear usuários sem permissão.
4. O painel listar pedidos reais do Firestore em tempo real.
5. Os cards mostrarem contagens corretas por status.
6. Busca, filtros, ordenação e detalhe funcionarem.
7. Avanço, retrocesso e cancelamento respeitarem a máquina de estados.
8. Toda alteração gerar exatamente um registro de histórico.
9. O histórico exibir status anterior, novo status, data, hora, usuário e motivo.
10. O histórico não puder ser editado ou apagado pelo painel.
11. Pedidos antigos continuarem visíveis e editáveis.
12. Usuário não autenticado não conseguir ler pedidos.
13. O layout funcionar em desktop, tablet e celular.
14. Os builds do site e do admin passarem.
15. As regras e os índices estiverem publicados.
16. O README documentar o setup e o deploy.

---

## 16. Riscos e limitações

| Risco | Mitigação |
|---|---|
| Leitura pública atual expõe pedidos | Restringir a leitura a admin |
| Pedidos antigos sem contato/pagamento | Exibir “Não informado” |
| Pedidos antigos sem histórico | Evento inicial sintético |
| Status legado desconhecido | Auditar antes e corrigir manualmente |
| Índice composto ausente | Publicar `firestore.indexes.json` |
| Regras publicadas antes do admin | Testar criação do site logo após o deploy |
| Dois admins alterando o mesmo pedido | Transação + revalidação + mensagem de conflito |
| Admin SDK/Console pode burlar regras | Restringir IAM + backups |
| Spam na criação pública | App Check ou rate limit futuro |
| Java 8 não roda o emulador | Instalar Java 21+ (exigência do CLI 15) |
| Domínio do admin não autorizado no Auth | Adicionar em Authorized domains |
| API key restrita por referrer | Adicionar domínio do admin |
| Contagem de cards não reflete período | Cards são totais gerais; filtro afeta a lista |
| Busca limitada ao conjunto carregado | “Carregar mais” e fallback por ID exato |

---

## 17. Comandos previstos

### Instalação

```bash
npm ci
npm --prefix admin install
```

### Desenvolvimento

```bash
# site
npm run dev

# painel
npm --prefix admin run dev
```

### Build

```bash
npm run build
npm --prefix admin run build
```

### Firebase

```bash
npx firebase-tools login
npm run deploy:rules
npm run deploy:indexes
npm run deploy:firestore
```

### Permissão de admin

```bash
GOOGLE_APPLICATION_CREDENTIALS="caminho/service-account.json" \
  npm --prefix admin run grant-admin -- admin@exemplo.com
```

### Testes

```bash
npm test
npm --prefix admin test
npm run test:rules
```

> Os scripts exatos serão definidos na implementação.

---

## 18. Pendências manuais do responsável

- [ ] Ativar Authentication → Email/Password.
- [ ] Criar o primeiro usuário administrador.
- [ ] Gerar a service account.
- [ ] Configurar `GOOGLE_APPLICATION_CREDENTIALS` localmente.
- [ ] Rodar o script de claim admin.
- [ ] Publicar regras e índices.
- [ ] Criar o segundo serviço no Render.
- [ ] Cadastrar as 6 variáveis no Render.
- [ ] Adicionar o domínio do admin no Firebase Auth.
- [ ] Ajustar restrições da API key, se existirem.
- [ ] Instalar Java 21+ para testes de regras.
- [ ] Fazer o smoke test final.

---

## 19. Próximo passo

1. Trocar para o agente de execução.
2. Implementar na ordem das fases.
3. Manter este documento atualizado caso alguma decisão mude.
4. Registrar no README o resultado final e as instruções de operação.
