# Foxy Esfirras — Segurança Web e Dados

## Objetivo e limites

Este documento registra controles implementados no repositório e ações de configuração externa. A aplicação é hospedada como dois sites estáticos no Render e usa Firebase Authentication/Firestore. Não há banco SQL nem API própria para pedidos neste desenho.

A tríade CIA significa **Confidencialidade, Integridade e Disponibilidade**.

## Controles no código

### Firestore e integridade dos pedidos

- Regras negam por padrão.
- Visitantes podem criar apenas pedidos pendentes; não podem ler pedidos nem histórico.
- Apenas usuários autenticados com custom claim `admin == true` podem ler pedidos/histórico e mudar status.
- Campos desconhecidos são recusados.
- Itens aceitos precisam corresponder ao catálogo e preços oficiais atuais.
- Quantidade por sabor é limitada a 1–20; são aceitos até quatro sabores distintos.
- Soma dos itens, quantidades e totais precisa fechar matematicamente.
- Nome, contato, observação e local de retirada têm limites de tamanho.
- Status só muda por transições permitidas e o histórico correspondente precisa ser criado no mesmo commit.
- Histórico é append-only; pedidos e históricos não podem ser apagados por clientes.
- Autor do status/histórico precisa corresponder ao UID e e-mail do token autenticado.
- O local de retirada é validado como texto não vazio de até 120 caracteres, sem hardcode do endereço nas regras. Isso permite atualizar o local sem reescrever regras.

As regras não protegem contra operações feitas com credenciais Admin SDK comprometidas: Admin SDK ignora Firestore Security Rules. Proteja service accounts e IAM.

### Firebase App Check

O site e o painel inicializam Firebase App Check com reCAPTCHA v3 quando `VITE_FIREBASE_APPCHECK_SITE_KEY` está definida no ambiente de build.

A chave de site é pública e não deve ser tratada como senha. Não coloque service account, private key ou segredo de servidor em variáveis `VITE_*`.

**Ativação necessária fora do código:**
1. No Console Firebase, abra App Check e registre os apps Web do site e do painel com o provedor reCAPTCHA v3.
2. Cadastre os domínios de produção do Render e todos os domínios próprios usados pelos dois sites no provedor reCAPTCHA.
3. Copie a site key pública e defina `VITE_FIREBASE_APPCHECK_SITE_KEY` nos ambientes de build dos dois serviços do Render e no `.env` local, se necessário.
4. Faça deploy dos dois sites.
5. Confira no Console Firebase se ambos recebem tokens válidos.
6. Só então ative enforcement para Cloud Firestore. Faça isso primeiro em janela de manutenção/monitoramento; acompanhe erros de clientes antigos e instalações PWA.

Sem a chave e sem enforcement no Console, o código App Check não impede requisições. Não ative enforcement antes de validar o fluxo real.

### Dependências

Os manifestos raiz e admin aplicam override compatível de `@grpc/grpc-js` para versão corrigida `^1.14.7`, evitando o downgrade amplo de Firebase sugerido pelo `npm audit fix`. O lockfile de cada projeto deve permanecer versionado para que `npm ci` no Render reproduza a árvore testada.

Não use `npm audit fix --force` sem análise de breaking changes. Reavalie alertas de dependências após cada atualização.

### Render

O `render.yaml` mantém os dois serviços estáticos e seus comandos de build atuais. Os cabeçalhos de hardening existentes são preservados. A chave App Check é opcional no build; sua ausência não bloqueia deploy, mas significa que App Check não será enviado pelo cliente.

O Render precisa executar os builds com Node 22 e `npm ci`. Não publique regras Firestore via Render; regras são implantadas com Firebase CLI separadamente.

## Ameaças e cobertura real

### SQL Injection / NoSQL Injection

- Não existe SQL neste projeto; portanto, SQL Injection não é a superfície aplicável.
- O cliente usa Firestore SDK e operações estruturadas, não concatena entrada do usuário em strings SQL.
- Regras de segurança validam esquema, tipos, catálogo, limites e campos aceitos.
- Isso reduz manipulação de documentos, mas não substitui validação em servidor para futuras APIs. Se uma API SQL for adicionada, use consultas parametrizadas.

### XSS e conteúdo malicioso

- React escapa texto por padrão.
- Não foram encontrados usos de `dangerouslySetInnerHTML`, atribuição direta a `innerHTML`, `eval`, `new Function` ou `document.write` no código-fonte analisado.
- Não adicione renderização de HTML fornecido pelo usuário sem sanitização robusta.
- Não há upload de arquivos no fluxo de pedidos verificado.

### Malware e supply chain

- O projeto não aceita upload de executáveis/arquivos de clientes no fluxo analisado.
- `npm audit` e revisão estática ajudam a identificar riscos, mas não provam ausência de malware.
- Execute Microsoft Defender/antivírus atualizado no computador e faça revisão de dependências/lockfiles antes de releases.
- Nunca commite `.env`, service accounts ou chaves privadas. O arquivo de service account localizado sob `.opencode` deve continuar ignorado pelo Git; não o copie para o frontend ou Render static site.
- Se qualquer service account tiver sido exposta, revogue-a e emita outra pelo Console Google Cloud.

### DDoS e abuso automatizado

App Check ajuda a reduzir tráfego de clientes não genuínos, mas **não é um serviço anti-DDoS nem um rate limiter por IP**. Regras Firestore validam dados, não impõem limites por IP, dispositivo ou frequência de escrita.

Para proteção de borda, configure um proxy/WAF como Cloudflare na frente dos domínios próprios:
- habilite proteção DDoS gerenciada;
- aplique rate limiting à rota de pedidos somente se ela for servida por endpoint próprio;
- aplique regras de bot/WAF e limite requisições abusivas;
- monitore picos, erros, custos e quotas do Firebase;
- não bloqueie os endpoints Firebase necessários ao SDK;
- valide se o domínio `onrender.com` não permanece como rota pública alternativa que contorne o proxy.

Como o site atual grava diretamente no Firestore, um rate limit confiável por IP exige migrar a criação do pedido para um backend/Cloud Function que valide App Check, aplique rate limit e grave usando Admin SDK. Isso é uma mudança arquitetural; não foi introduzida automaticamente para não quebrar o fluxo atual.

## Verificações obrigatórias antes de produção

- [x] Instalação limpa `npm ci` do site e painel em cópia isolada, seguida dos dois builds.
- [x] 75 testes unitários do painel aprovados.
- [x] 39 testes das regras Firestore aprovados no Emulator com JDK 21.
- [x] `npm audit` de produção: zero vulnerabilidades nos dois projetos.
- [ ] Resolver/revisar seis alertas moderados apenas em dependências de desenvolvimento do painel.
- [ ] Deploy de regras Firestore para o projeto Firebase correto.
- [ ] App Check configurado nos dois apps e enforcement ativado após métricas válidas.
- [ ] Cabeçalhos HTTP verificados nos domínios publicados.
- [ ] Cloudflare/WAF/rate limiting configurados e testados, incluindo rota direta do Render.
- [ ] Revisão de IAM e rotação de credenciais de service account.
- [ ] Alertas de orçamento/uso e monitoramento Firebase/Render.

## Credencial de servidor encontrada no diretório sincronizado

Foi encontrado o arquivo local `.opencode/service-account-esfirra.json`. Ele está ignorado pelo Git, mas o projeto inteiro está dentro da pasta OneDrive. **Git ignore não impede sincronização pelo OneDrive.**

- Não abra, copie para o frontend, publique ou envie esse JSON em chats/repositórios.
- Mova a credencial para uma pasta local fora do OneDrive e fora do repositório.
- Configure o caminho por uma variável de ambiente segura no computador que executa o script administrativo.
- Como não é possível confirmar o histórico de sincronização/compartilhamento do OneDrive, trate a chave como potencialmente exposta e considere revogá-la no Google Cloud IAM e emitir outra.
- Não movi nem revoguei a credencial nesta execução para não interromper o script administrativo sem uma migração confirmada.

## Resultados da auditoria local — 01/11/2026

- `npm ci` e `npm run build` aprovados para o site e o painel em uma cópia temporária isolada, usando os lockfiles atuais e os mesmos comandos de build.
- Builds também aprovados na pasta original após restaurar os módulos locais.
- 75/75 testes unitários do painel aprovados.
- 39/39 testes das regras aprovados no Firestore Emulator com JDK 21 portátil.
- Os testes negativos são rejeitados; o Emulator registra mensagens de avaliação para alguns payloads deliberadamente inválidos. Não houve falha de teste nem estouro do limite de 1.000 expressões na execução final.
- `npm audit` raiz: zero vulnerabilidades.
- `npm audit --omit=dev` raiz e admin: zero vulnerabilidades.
- Auditoria completa do admin: seis vulnerabilidades moderadas em dependências de desenvolvimento na cadeia `google-gax → rimraf → glob/minimatch`; nenhum alerta High/Critical permaneceu. O `npm audit fix --dry-run` sugeriu mudanças/downgrades que não foram aplicados para evitar regressões.
- Microsoft Defender examinou a cópia isolada do projeto, incluindo dependências e builds, e informou que não encontrou ameaças.
- O histórico do Defender contém detecções antigas de PUABundler (DriverPack/Rostpay) e TrojanDownloader Remcos, todas marcadas como inativas, com remediação concluída e sem execução reportada. Isso não substitui uma verificação completa do computador.

### Estado de publicação

As alterações estão no repositório local. Nenhuma regra foi publicada no Firebase e nenhum deploy foi feito no Render. A variável `VITE_FIREBASE_APPCHECK_SITE_KEY` ainda não está definida no `.env` local; App Check só passa a emitir tokens após configurar a chave nos dois serviços e registrar os domínios no Firebase Console.

## Rollback

Antes de publicar, crie commit/backup dos arquivos alterados. Se App Check bloquear clientes legítimos, desative temporariamente a enforcement no Console Firebase; não remova regras de autorização para contornar o problema. Se build falhar, reverta apenas os commits de hardening, sem apagar alterações preexistentes do projeto.
