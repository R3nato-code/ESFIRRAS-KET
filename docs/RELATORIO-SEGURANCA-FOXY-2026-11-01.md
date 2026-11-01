# Relatório final — Hardening de Segurança Foxy Esfirras
**Data:** 01/11/2026  
**Projeto:** `ESFIRRAS-KET`  
**Destino:** Render Static Sites + Firebase Authentication/Firestore  
**Escopo:** alterações locais, auditoria de dependências, testes, build e varredura antimalware.  
**Publicação:** nenhuma.

## 1. Resumo executivo

Foram incorporados controles de segurança sem migrar a arquitetura de hospedagem estática. Os comandos de instalação e build do Render foram validados em uma cópia temporária limpa com os lockfiles do projeto.

**Resultados confirmados**
- Site: build aprovado.
- Painel: build aprovado.
- Instalação limpa `npm ci`: aprovada para os dois projetos na cópia isolada.
- Testes unitários: 75/75 aprovados.
- Testes Firestore Emulator: 39/39 aprovados.
- Auditoria completa de dependências do site: 0 vulnerabilidades.
- Auditoria de dependências de produção do site e painel: 0 vulnerabilidades.
- Auditoria completa do painel: 6 vulnerabilidades moderadas, somente em dependências de desenvolvimento.
- Microsoft Defender: cópia isolada do projeto examinada; nenhuma ameaça encontrada.
- Deploy: não executado.
- Regras Firestore: não publicadas.

## 2. Integridade e regras Firestore

Arquivo: `firestore.rules`.

Foram mantidos os princípios fornecidos pelo responsável pelo projeto:
- negação por padrão;
- visitantes criam somente pedidos pendentes;
- visitantes não leem pedidos nem histórico;
- leitura e mudanças de status exigem claim `admin == true`;
- transição de status exige histórico criado no mesmo commit;
- histórico append-only;
- pedido não pode ser apagado;
- autor do status/histórico precisa corresponder ao usuário autenticado.

Validações adicionais alinhadas ao catálogo atual:
- somente os quatro IDs e nomes oficiais de esfirras;
- preços oficiais: 500 e 600 centavos conforme o produto;
- quantidade de 1 a 20 por sabor;
- até quatro sabores distintos;
- sem sabores repetidos no mesmo pedido;
- total por item = quantidade × preço unitário;
- totais gerais iguais à soma dos itens;
- campos obrigatórios e campos permitidos estritos;
- limites de tamanho para nome, contato, observação e local de retirada;
- local de retirada é texto válido de até 120 caracteres, sem endereço hardcoded nas regras;
- forma de pagamento restrita ao enum usado pelo site.

As funções de validação foram divididas em etapas para evitar estouro do limite de avaliação do Firestore. Na execução final não ocorreu erro de limite de 1.000 expressões. Alguns payloads negativos geram mensagens de avaliação no Emulator e são negados; os 39 testes passaram.

**Limite importante:** Admin SDK ignora Firestore Security Rules. Credenciais de servidor e IAM precisam ser protegidos separadamente.

## 3. App Check e proteção contra abuso

Arquivos:
- `src/lib/firebase.ts`
- `admin/src/lib/firebase.ts`
- `src/vite-env.d.ts`
- `admin/src/vite-env.d.ts`
- `.env.example`
- `admin/.env.example`

Integração opcional de Firebase App Check com reCAPTCHA v3 foi adicionada aos dois apps. O código inicializa App Check quando `VITE_FIREBASE_APPCHECK_SITE_KEY` está definida e mantém o build funcional quando a variável ainda não existe.

**Ainda não está ativo:** a variável está ausente no `.env` local verificado e os domínios/keys não foram configurados no Console Firebase/Render. A enforcement não foi ativada. Não ativar enforcement até confirmar tokens válidos nos dois apps.

App Check reduz chamadas automatizadas de clientes não genuínos, mas não é anti-DDoS nem rate limiter por IP.

## 4. Autenticação, histórico e credenciais

- `admin/src/auth/AdminAuthProvider.tsx`: impede que uma resposta assíncrona de uma sessão anterior atualize a permissão de outra sessão.
- `admin/scripts/grant-admin.mjs`: preserva custom claims existentes ao adicionar `admin: true`.
- `firestore.rules`: exige UID e e-mail coerentes com o token autenticado para alterações e histórico.
- `src/components/OrderSection.tsx`: remove logs que expunham payload de pedidos e detalhes internos dos erros.

### Credencial de servidor — ação prioritária

Foi encontrado `.opencode/service-account-esfirra.json` dentro do projeto, que está localizado em uma pasta OneDrive.

O arquivo é ignorado pelo Git, mas **isso não impede que OneDrive sincronize a credencial**. Não foi lido, copiado, movido ou revogado.

Ação recomendada:
1. Mover o arquivo para fora do OneDrive e fora do repositório.
2. Ajustar o script administrativo para usar um caminho definido por variável de ambiente.
3. Como o histórico de sincronização/compartilhamento não foi confirmado, considerar a chave potencialmente exposta e revogá-la no Google Cloud IAM, emitindo outra.
4. Nunca inserir a chave em variáveis `VITE_*`, frontend, commits ou logs.

## 5. Dependências e supply chain

Arquivos: `package.json`, `package-lock.json` e equivalentes em `admin/`.

- Override compatível de `@grpc/grpc-js` para `^1.14.7`, removendo os alertas High/Critical anteriores sem downgrade amplo do Firebase.
- Site: `npm audit` completo com zero vulnerabilidades.
- Site e painel: `npm audit --omit=dev` com zero vulnerabilidades.
- Painel: seis alertas Moderate em dependências de desenvolvimento na cadeia `google-gax → rimraf → glob/minimatch`.
- `npm audit fix --dry-run` sugeriu mudanças/downgrades que não foram aplicados por risco de incompatibilidade.

Não declarar zero vulnerabilidades em toda a árvore do painel: os seis alertas moderados de desenvolvimento continuam registrados.

## 6. PWA, Render e cabeçalhos

- `scripts/pwa-plugin.ts`: geração do Service Worker corrigida para usar quebras de linha reais.
- `render.yaml`: cabeçalhos de segurança adicionados aos dois serviços estáticos:
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy: camera=(), microphone=(), geolocation=()`
  - `Strict-Transport-Security: max-age=31536000; includeSubDomains`

A cópia limpa passou por `npm ci` e pelos dois comandos `npm run build`; os diretórios `dist` foram gerados. Os builds também passaram na pasta original após a restauração dos módulos locais.

A tentativa de `npm ci` diretamente na pasta OneDrive encontrou `EPERM` ao substituir um binário nativo do Vite bloqueado pelo Windows. Para não deixar o ambiente de desenvolvimento incompleto, os módulos foram restaurados a partir da instalação limpa temporária; os builds locais foram repetidos e passaram.

O build do site mantém um aviso de bundle 3D acima de 900 kB; não é falha de build e não foi alterada a divisão de chunks para evitar mudança funcional desnecessária.

Os cabeçalhos ainda precisam ser conferidos por HTTP nos domínios efetivamente publicados.

## 7. Malware e XSS

- Pesquisa estática não encontrou `dangerouslySetInnerHTML`, atribuição direta a `innerHTML`, `eval`, `new Function` ou `document.write` no código-fonte examinado.
- React escapa texto por padrão.
- Nenhum upload de arquivos foi identificado no fluxo de pedidos.
- Microsoft Defender examinou a cópia temporária do projeto, incluindo dependências e builds, e informou: nenhuma ameaça encontrada.
- A proteção em tempo real estava habilitada e as assinaturas estavam atualizadas na consulta.

O histórico do Defender contém três detecções antigas:
- PUABundler:Win32/DriverPack;
- PUABundler:Win32/Rostpay;
- TrojanDownloader:PowerShell/Remcos.RPQ!MTB.

Todas estavam marcadas como inativas, com ação de remediação concluída e sem execução reportada. Os caminhos históricos não correspondiam à cópia do projeto examinada. Isso não certifica que o computador inteiro esteja livre de malware; uma verificação completa do sistema ainda é recomendável.

## 8. SQL Injection, NoSQL Injection e DDoS

### SQL Injection
O projeto não utiliza banco SQL nem executa comandos SQL. SQL Injection não é a superfície de ataque atual.

### NoSQL Injection / manipulação de dados
O uso do Firestore SDK é estruturado e as regras validam tipos, campos, catálogo, quantidades e totais. Não foi identificada concatenação de entrada em consultas SQL. Se uma API própria for adicionada, deve validar esquema no servidor e evitar construir consultas com entrada não confiável.

### DDoS / disponibilidade
O projeto é estático e o cliente grava diretamente no Firestore. Regras de segurança não impõem limites por IP. App Check não bloqueia DDoS volumétrico.

Para proteção adicional é necessária configuração externa:
- Cloudflare ou WAF equivalente na frente dos domínios próprios;
- proteção DDoS e regras de bot;
- monitoramento de quotas, erros e orçamento Firebase;
- controle da rota direta `onrender.com`;
- para rate limit por IP confiável, mover a criação do pedido para backend/Cloud Function com verificação App Check e limitação de taxa.

Não foi executado teste de carga ou ataque contra produção.

## 9. Tríade CIA

| Pilar | Controles locais | Pendências externas |
|---|---|---|
| Confidencialidade | leitura admin-only, logs reduzidos, cabeçalhos | IAM, credencial OneDrive, App Check, cabeçalhos publicados |
| Integridade | catálogo/preço/totais validados, histórico append-only, autoria | publicar regras e monitorar credenciais Admin SDK |
| Disponibilidade | builds estáticos, PWA corrigido, dependências de produção sem alertas | WAF/DDoS, rate limiting, App Check, quotas/alertas |

## 10. Arquivos alterados

- `firestore.rules`
- `scripts/pwa-plugin.ts`
- `src/components/OrderSection.tsx`
- `src/lib/firebase.ts`
- `src/vite-env.d.ts`
- `admin/src/lib/firebase.ts`
- `admin/src/vite-env.d.ts`
- `admin/src/auth/AdminAuthProvider.tsx`
- `admin/scripts/grant-admin.mjs`
- `admin/tests/rules/orders.rules.test.ts`
- `package.json`, `package-lock.json`
- `admin/package.json`, `admin/package-lock.json`
- `render.yaml`
- `.env.example`, `admin/.env.example`
- `docs/SEGURANCA-WEB-E-DADOS.md`

A pasta preexistente `src/utils/` não foi alterada.

## 11. Estado final e pendências

**Código local endurecido e builds/testes aprovados.** Não publicar até concluir:
1. migrar/rotacionar a service account que está sob OneDrive;
2. configurar App Check nos dois apps e validar tokens antes de enforcement;
3. resolver/revisar seis vulnerabilidades Moderate de desenvolvimento do admin;
4. publicar as regras no projeto Firebase correto;
5. configurar WAF/DDoS e rate limiting adequado;
6. verificar cabeçalhos HTTP, IAM, quotas e alertas no ambiente publicado.

Nenhum deploy foi feito no Render ou Firebase nesta execução.
