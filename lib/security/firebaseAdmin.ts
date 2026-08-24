import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import firebaseConfig from '@/firebase-applet-config.json';

// ---------------------------------------------------------------------------
// Integração de Firebase Authentication (via Admin SDK) — resolve a
// limitação de arquitetura documentada em firestore.rules: o projeto
// autentica usuários com um JWT próprio (lib/security/jwt.ts), mas nunca
// autenticava a SESSÃO DO FIRESTORE em si, então request.auth nas regras
// de segurança sempre era null, tornando impossível expressar "só o
// dono dos dados pode ler/escrever" sem abrir mão da proteção por
// completo.
//
// O padrão usado aqui é o de Custom Tokens: depois que o backend já
// validou a senha do usuário do jeito que sempre validou
// (verifyPassword() em lib/db/firestore.ts, com hash PBKDF2), ele passa
// a também gerar um token assinado pelo Firebase Admin SDK — que só o
// backend, de posse da Service Account, consegue gerar — contendo o
// clinicId do usuário como claim customizada. O front-end troca esse
// token por uma sessão real do Firebase (signInWithCustomToken), e a
// partir daí request.auth.token.clinicId passa a existir de verdade nas
// regras do Firestore.
//
// Este módulo NUNCA valida senha nem decide quem pode logar — isso
// continua sendo responsabilidade exclusiva de verifyPassword(). Ele só
// entra em cena DEPOIS que o login já foi aprovado, para dar ao usuário
// já autenticado uma identidade que o Firestore reconhece.
// ---------------------------------------------------------------------------

let _adminApp: App | null = null;

/**
 * Inicializa (ou reaproveita) a instância do Firebase Admin App, a
 * partir da Service Account fornecida via variável de ambiente.
 *
 * FIREBASE_SERVICE_ACCOUNT_KEY espera o CONTEÚDO do arquivo JSON da
 * Service Account (não um caminho de arquivo) — mais portável para
 * ambientes sem sistema de arquivos persistente (ex.: Vercel, Cloud
 * Run) e evita a necessidade de subir um arquivo de credencial junto
 * com o deploy. Gere essa credencial em: Console do Firebase → ícone de
 * engrenagem → Configurações do projeto → Contas de serviço → Gerar
 * nova chave privada.
 */
export function getAdminApp(): App {
  if (_adminApp) return _adminApp;

  const existingApps = getApps();
  if (existingApps.length > 0) {
    _adminApp = existingApps[0];
    return _adminApp;
  }

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!serviceAccountJson) {
    throw new Error(
      'FIREBASE_SERVICE_ACCOUNT_KEY não está definida no ambiente. ' +
        'Gere uma Service Account em Console do Firebase → Configurações do projeto → ' +
        'Contas de serviço → Gerar nova chave privada, e defina o CONTEÚDO do arquivo ' +
        'JSON gerado (não o caminho do arquivo) nesta variável de ambiente.'
    );
  }

  let serviceAccount: Record<string, unknown>;
  try {
    serviceAccount = JSON.parse(serviceAccountJson);
  } catch {
    throw new Error(
      'FIREBASE_SERVICE_ACCOUNT_KEY não contém um JSON válido. Confirme que o valor ' +
        'colado é o conteúdo completo do arquivo baixado do Console do Firebase.'
    );
  }

  _adminApp = initializeApp({
    credential: cert(serviceAccount as any),
  });

  return _adminApp;
}

/**
 * Gera um Firebase Custom Token para o usuário já autenticado pelo
 * fluxo próprio do backend (verifyPassword). O uid do token é o mesmo
 * id do usuário já usado no restante do sistema — assim
 * request.auth.uid, nas regras do Firestore, bate com o userId do
 * documento em /users/{userId}. clinicId vai como claim customizada,
 * usada por belongsToClinic() em firestore.rules.
 *
 * "Melhor esforço" deliberado: se a geração do custom token falhar (ex.:
 * FIREBASE_SERVICE_ACCOUNT_KEY ausente ou inválida em um ambiente que
 * ainda não configurou isso), o login pelo JWT próprio continua
 * funcionando normalmente — a integração com o Firestore Auth é uma
 * camada adicional, não deveria derrubar o login inteiro se estiver mal
 * configurada. O chamador decide se quer tratar isso como bloqueante.
 */
export async function createFirebaseCustomToken(userId: string, clinicId: string): Promise<string | null> {
  try {
    const app = getAdminApp();
    return await getAuth(app).createCustomToken(userId, { clinicId });
  } catch (error: any) {
    console.error('[Firebase Admin] Falha ao gerar custom token:', error.message || error);
    return null;
  }
}

/**
 * Escreve um documento no Firestore via Admin SDK — que, por design,
 * ignora completamente as firestore.rules (é a ferramenta certa para
 * operações administrativas de confiança do próprio backend, como o
 * seed inicial de clínicas/usuários de demonstração).
 *
 * Criada especificamente para permitir fechar `allow create` nas regras
 * do Firestore (correção de auditoria #4) sem quebrar
 * seedFirestoreDatabase() em lib/db/firestore.ts — antes desta função, o
 * seed usava o SDK client (setDoc), que é sujeito às regras, e por isso
 * as regras precisavam manter `create` aberto por ID válido. Com o seed
 * passando a escrever por aqui, as regras podem negar `create` a
 * qualquer requisição vinda de fora do backend.
 *
 * Uso restrito de propósito: só para os pontos de escrita que hoje
 * rodam dentro de seedFirestoreDatabase() — nunca para servir requisição
 * de usuário direto, que deve continuar passando pelas rotas de API
 * normais (que já validam autenticação e RBAC antes de tocar em
 * qualquer dado).
 */
export async function adminSetDocument(
  collectionPath: string,
  docId: string,
  data: Record<string, unknown>
): Promise<void> {
  const { getFirestore } = await import('firebase-admin/firestore');
  const app = getAdminApp();
  // Correção: este projeto usa um banco Firestore NOMEADO (não o
  // "(default)"), configurado em firebase-applet-config.json →
  // firestoreDatabaseId. O SDK client (lib/db/firestore.ts,
  // getFirestoreDb()) já passa esse ID corretamente — getFirestore(app)
  // sem o segundo argumento aqui apontava silenciosamente para o banco
  // "(default)", diferente do banco que o resto do projeto usa. Como
  // "(default)" tipicamente não existe neste projeto, isso falhava (ou,
  // em um projeto onde "(default)" existisse por acaso, escreveria
  // dados em um banco que o Client SDK nunca leria de volta).
  const db = firebaseConfig.firestoreDatabaseId
    ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
    : getFirestore(app);
  await db.collection(collectionPath).doc(docId).set(data);
}

/**
 * Lê um documento via Admin SDK — mesma justificativa de
 * adminSetDocument acima: o seed precisa checar "este documento já
 * existe?" antes de criar, e essa leitura também é sujeita às
 * firestore.rules quando feita pelo SDK client.
 */
export async function adminGetDocument(collectionPath: string, docId: string): Promise<Record<string, unknown> | null> {
  const { getFirestore } = await import('firebase-admin/firestore');
  const app = getAdminApp();
  // Mesma correção de banco nomeado que adminSetDocument acima.
  const db = firebaseConfig.firestoreDatabaseId
    ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
    : getFirestore(app);
  const snap = await db.collection(collectionPath).doc(docId).get();
  return snap.exists ? (snap.data() as Record<string, unknown>) : null;
}
