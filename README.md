# Foxy Esfirras

Site de encomendas de esfirras (React + Vite + Three.js) com pedidos gravados no
Firestore. A entrada tem uma cena 3D e o cardápio fica em uma segunda tela.

## Stack

- React 19 + TypeScript + Vite
- Three.js / React Three Fiber (cena da entrada)
- Firebase Firestore (pedidos)
- Deploy: Render (site estático)

## Rodando localmente

```bash
npm ci
cp .env.example .env   # preencha com os dados do Firebase
npm run dev
```

As 6 variáveis `VITE_FIREBASE_*` são obrigatórias. Se faltar alguma, o Vite
para com uma mensagem dizendo exatamente o que está faltando (em vez de subir
uma tela branca).

## Deploy no Render

O arquivo `render.yaml` já descreve o serviço (site estático, `npm ci && npm run build`,
publicação de `./dist`).

1. No Render: **New > Blueprint** e selecione este repositório.
2. O Render pede os valores das 6 variáveis `VITE_FIREBASE_*` (estão com
   `sync: false`, então não ficam no Git). Pegue em Console Firebase >
   Configurações do projeto > Seus apps > SDK.
3. Aplique o Blueprint. Cada push na branch `main` gera um novo deploy.

Também é possível criar manualmente: **New > Static Site**, com
**Build Command** `npm ci && npm run build` e **Publish Directory** `dist`,
cadastrando as 6 variáveis em **Environment**.

> As variáveis são lidas em tempo de **build**: depois de alterá-las, use
> **Manual Deploy > Clear build cache & deploy**.

## Firestore

O banco fica no Google Cloud (projeto `esfirra-ket`) e é independente do Render —
o site só faz chamadas HTTPS para o Firestore, então funciona igual em produção.

As regras em `firestore.rules` permitem:

- criação pública de pedidos válidos na coleção `pedidos`;
- leitura de pedidos e histórico somente por administradores autenticados (claim `admin`);
- alteração de status por transação com histórico correspondente;
- histórico append-only e bloqueio de exclusão de pedidos.

O site público apenas cria pedidos; a consulta e a gestão são feitas pelo painel administrativo.

Para publicar as regras (requer login no Firebase CLI):

```bash
npm run deploy:rules
```

## Checklist pós-deploy

- [ ] As 6 variáveis `VITE_FIREBASE_*` cadastradas no Render
- [ ] Regras do Firestore publicadas (`npm run deploy:rules`)
- [ ] Domínio do Render liberado nas restrições da API key
      (Google Cloud > APIs e serviços > Credenciais), caso a chave esteja
      restrita a referrers HTTP
- [ ] Testar um pedido de verdade e conferir o documento em `pedidos`

## Painel administrativo

O painel é um aplicativo independente localizado em `admin/`. Ele usa o mesmo projeto Firebase (`esfirra-ket`) e a mesma coleção `pedidos`; não cria banco paralelo.

### Desenvolvimento e build

```bash
npm --prefix admin ci
npm --prefix admin run dev
npm --prefix admin test
npm --prefix admin run build
```

O painel lê as seis variáveis `VITE_FIREBASE_*` do arquivo `.env` na raiz durante o desenvolvimento. Consulte `admin/.env.example` para os nomes necessários. Não coloque credenciais de service account no frontend.

### Acesso e segurança

- Login por Firebase Authentication (Email/Password).
- O usuário precisa da custom claim `admin: true`.
- A leitura de pedidos e histórico é restrita a administradores autenticados pelas regras do Firestore.
- Alterações de status gravam pedido e histórico na mesma transação. O histórico é append-only.
- Configure o domínio publicado do painel em Authentication > Settings > Authorized domains no Firebase.

### Deploy do painel no Render

O `render.yaml` declara dois serviços estáticos independentes: `foxy-esfirras` e `foxy-esfirras-admin`. Ao criar/sincronizar o Blueprint, configure no serviço do admin as seis variáveis `VITE_FIREBASE_*` com os valores do app Web do projeto `esfirra-ket`. O build do admin é `cd admin && npm ci && npm run build` e o diretório publicado é `admin/dist`.

Depois do deploy, adicione o domínio `onrender.com` ou o domínio personalizado efetivo do painel aos domínios autorizados do Firebase Auth e valide login, leitura, atualização de status e histórico. O deploy depende de acesso à conta Render e não é executado por um build local.

As regras do Firestore são compartilhadas e ficam na raiz do repositório. Consulte `docs/plano-painel-pedidos.md` e `AGENTS.md` antes de alterar esse contrato.

## Aplicativos instaláveis (PWA)

O site público e o painel administrativo possuem PWAs independentes, cada um com manifesto, ícones, service worker e cache próprios. Após abrir cada site com conexão, o navegador pode oferecer a opção **Instalar aplicativo** ou **Adicionar à tela inicial**.

- O shell, arquivos compilados, fontes e imagens locais são pré-armazenados para abrir a interface quando estiver sem conexão.
- Navegações usam rede primeiro e recorrem ao shell em cache quando offline.
- Os dados do Firebase/Firestore e as ações de pedido/login continuam exigindo conexão; o service worker não armazena respostas de API nem dados privados.
- Novas versões atualizam o service worker e removem caches antigos.
- O service worker é registrado somente em builds de produção. Para testar instalação, use os endereços HTTPS publicados (localhost também é aceito por navegadores em desenvolvimento).

Depois de publicar uma nova versão no Render, abra cada endereço novamente com internet para receber os arquivos e o service worker atualizados. Se o navegador mantiver uma versão antiga, feche e reabra o PWA ou atualize a página.
