/* ==================================================================
   SCRIPT DE CONCESSÃO DE CLAIM ADMIN
   ----------------------------------------------------------------
   Uso:
     GOOGLE_APPLICATION_CREDENTIALS="caminho/para/service-account.json" \
       npm --prefix admin run grant-admin -- email@exemplo.com

   O que faz:
     1. Busca o usuário pelo e-mail no Firebase Authentication.
     2. Define a custom claim `admin: true` no usuário.
     3. Exibe o UID e instruções de logout/login.

   Requisitos:
     - firebase-admin como dependência de desenvolvimento
     - Service account com permissão para gerenciar usuários
   ================================================================== */

import { initializeApp, applicationDefault, cert } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { readFileSync } from 'node:fs'

const email = process.argv[2]

if (!email) {
  console.error('Uso: npm --prefix admin run grant-admin -- <email>')
  process.exit(1)
}

const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS

if (!serviceAccountPath) {
  console.error(
    'Defina a variável GOOGLE_APPLICATION_CREDENTIALS com o caminho do JSON da service account.\n' +
    'Exemplo (PowerShell):\n' +
    '  $env:GOOGLE_APPLICATION_CREDENTIALS="C:\\caminho\\service-account.json"\n' +
    '  npm --prefix admin run grant-admin -- mascarenhasr02@gmail.com\n',
  )
  process.exit(1)
}

/* Inicializa o Admin SDK com a service account. */
let app
try {
  const serviceAccount = JSON.parse(
    readFileSync(serviceAccountPath, 'utf8'),
  )
  app = initializeApp({
    credential: cert(serviceAccount),
  })
} catch (error) {
  console.error(
    `Não foi possível carregar a service account em "${serviceAccountPath}".\n` +
      `Erro: ${error.message}\n`,
  )
  process.exit(1)
}

const auth = getAuth(app)

async function main() {
  try {
    /* 1. Busca o usuário pelo e-mail. */
    const userRecord = await auth.getUserByEmail(email)

    /* 2. Preserva outras custom claims e adiciona admin: true. */
    const existingClaims = userRecord.customClaims ?? {}
    await auth.setCustomUserClaims(userRecord.uid, {
      ...existingClaims,
      admin: true,
    })

    console.log('✅ Claim admin concedida com sucesso.')
    console.log(`   Usuário: ${email}`)
    console.log(`   UID:     ${userRecord.uid}`)
    console.log('')
    console.log('⚠️  O usuário precisa sair e entrar novamente no painel para que a')
    console.log('   claim tenha efeito na sessão atual.')
  } catch (error) {
    console.error(`❌ Falha ao conceder claim: ${error.message}`)
    process.exit(1)
  }
}

main()
