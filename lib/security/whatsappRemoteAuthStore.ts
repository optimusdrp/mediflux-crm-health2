import { getAdminApp } from './firebaseAdmin';
import { adminGetDocument, adminSetDocument } from './firebaseAdmin';
import fs from 'fs';

// ---------------------------------------------------------------------------
// Store remota de sessão do WhatsApp — implementa a interface exigida pelo
// RemoteAuth do whatsapp-web.js: sessionExists(), save(), extract(),
// delete(). Usada como alternativa a LocalAuth (sessão em disco) para
// ambientes SEM disco persistente entre reinicializações (ex.: deploys
// serverless em contêineres efêmeros) — nesses ambientes, LocalAuth perde
// a sessão a cada reinício do processo, exigindo escanear o QR code de
// novo toda vez.
//
// Por que Firebase Storage e não só o Firestore: o whatsapp-web.js
// comprime a sessão inteira num arquivo .zip antes de chamar save() —
// esse arquivo pode chegar a dezenas de MB, muito acima do limite de 1MB
// por documento do Firestore. O Firestore aqui guarda só METADADOS (se a
// sessão existe, quando foi salva pela última vez); o arquivo em si vai
// para o Storage, no mesmo projeto Firebase já configurado.
//
// Este store nunca decide QUANDO salvar/restaurar — isso é inteiramente
// controlado pelo RemoteAuth (ver lib/whatsapp/sessionManager.ts para
// como ele é instanciado). O papel deste módulo é só transportar o
// arquivo de um lado para o outro, de forma confiável.
// ---------------------------------------------------------------------------

const SESSIONS_COLLECTION = 'whatsapp_remote_sessions';

async function getStorageBucket() {
  // Import dinâmico (mesma técnica já usada em adminSetDocument /
  // adminGetDocument) para não carregar o SDK inteiro de Storage em
  // requisições que nunca usam sessão remota.
  const { getStorage } = await import('firebase-admin/storage');
  const app = getAdminApp();
  return getStorage(app).bucket();
}

function storagePathFor(sessionName: string): string {
  return `whatsapp-sessions/${sessionName}.zip`;
}

export interface RemoteAuthStore {
  sessionExists(options: { session: string }): Promise<boolean>;
  save(options: { session: string }): Promise<void>;
  extract(options: { session: string; path: string }): Promise<void>;
  delete(options: { session: string }): Promise<void>;
}

/**
 * Store remota real, para produção — arquivo no Firebase Storage,
 * metadados (existe / última atualização) no Firestore.
 *
 * "Melhor esforço" deliberado só na LEITURA de metadados
 * (sessionExists): se o Firestore falhar ao responder, tratamos como
 * "sessão não existe" — o RemoteAuth então pede um novo QR code em vez
 * de travar a conexão inteira por causa de uma falha transitória de
 * rede. save()/extract()/delete() continuam propagando erro
 * normalmente, porque um "melhor esforço" ali esconderia perda real de
 * dados da sessão.
 */
export function createFirestoreRemoteAuthStore(): RemoteAuthStore {
  return {
    async sessionExists({ session }) {
      try {
        const doc = await adminGetDocument(SESSIONS_COLLECTION, session);
        return doc?.exists === true;
      } catch (e) {
        console.warn(`[WhatsApp RemoteAuth] Falha ao consultar metadados da sessão "${session}" (tratando como inexistente):`, e);
        return false;
      }
    },

    async save({ session }) {
      // Neste ponto, o whatsapp-web.js já gravou o .zip comprimido em
      // disco local, num caminho temporário previsível
      // (<dataPath>/<session>.zip) — replicamos essa mesma convenção de
      // nome aqui para ler o arquivo certo.
      const localZipPath = `.wwebjs_auth/${session}.zip`;
      const buffer = fs.readFileSync(localZipPath);
      const bucket = await getStorageBucket();
      await bucket.file(storagePathFor(session)).save(buffer, {
        contentType: 'application/zip',
        metadata: { cacheControl: 'no-store' },
      });
      await adminSetDocument(SESSIONS_COLLECTION, session, {
        exists: true,
        updatedAt: new Date().toISOString(),
        sizeBytes: buffer.length,
      });
    },

    async extract({ session, path: destinationPath }) {
      const bucket = await getStorageBucket();
      await bucket.file(storagePathFor(session)).download({ destination: destinationPath });
    },

    async delete({ session }) {
      const bucket = await getStorageBucket();
      await bucket.file(storagePathFor(session)).delete({ ignoreNotFound: true });
      await adminSetDocument(SESSIONS_COLLECTION, session, {
        exists: false,
        deletedAt: new Date().toISOString(),
      });
    },
  };
}
