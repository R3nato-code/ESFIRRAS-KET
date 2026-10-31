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

- criar pedidos válidos na coleção `pedidos`;
- ler pedidos (usado no cardápio/status);
- bloquear update/delete e todo o resto.

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
