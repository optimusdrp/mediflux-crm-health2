// whatsapp-web.js é publicado como CommonJS puro (sem "type": "module" nem
// campo "exports" mapeado para ESM). Este projeto (Next.js) resolve
// módulos via seu próprio bundler, que lida bem com CJS a partir de
// TypeScript/ESM na maioria dos casos — mas o padrão de import default +
// desestruturação abaixo é usado por precaução, já que é o mesmo problema
// já diagnosticado e corrigido no projeto irmão mediflux-dev (Node/tsx
// puro): named imports de um pacote CJS a partir de ESM dependem de
// análise estática do module.exports que é conhecida por ser frágil em
// alguns ambientes/versões do runtime.
import pkg from "whatsapp-web.js";
const { Client, LocalAuth, RemoteAuth } = pkg;
// import type é apagado inteiramente na compilação — nunca sofre do
// mesmo problema de interop em runtime do import de valor acima.
import type { Client as ClientType, Chat } from "whatsapp-web.js";
import QRCode from "qrcode";
import { syncIncomingMessage, syncHistoricalUnreadChats, syncViaContactPolling } from "./messageSync";
import { createFirestoreRemoteAuthStore } from "../security/whatsappRemoteAuthStore";

// ---------------------------------------------------------------------------
// Conexão real com WhatsApp via whatsapp-web.js
//
// Diferente das rotas de API do Next.js (sem estado, cada requisição
// independente), uma conexão de WhatsApp é um processo de LONGA DURAÇÃO:
// abre um Chromium headless (via Puppeteer) que mantém uma sessão viva do
// WhatsApp Web. Por isso este módulo vive fora do ciclo request/response
// normal — os clients ficam em memória do processo Node.js que hospeda o
// servidor Next.js, indexados por clinicId, e sobrevivem entre
// requisições HTTP enquanto esse processo estiver de pé.
//
// Decisões de arquitetura:
//
// 1. Um Client por clínica, em memória (Map<clinicId, ClientEntry>) — não
//    em Firestore nem no store em memória de dados de negócio. Se o
//    processo do servidor reiniciar, as sessões em memória se perdem
//    (a autenticação em si sobrevive — em disco via LocalAuth, ou no
//    Firebase Storage via RemoteAuth, ver ponto 2 abaixo — só a
//    instância do Client precisa ser recriada com um novo startSession()).
//
// 2. DUAS estratégias de PERSISTÊNCIA da sessão, escolhidas via a
//    variável de ambiente WHATSAPP_SESSION_STRATEGY:
//    - "local" (padrão) — LocalAuth, uma pasta por clínica em
//      .wwebjs_auth/clinic-<clinicId>/. Simples e rápido, mas exige
//      disco persistente entre reinicializações do processo — não
//      funciona em ambientes serverless com contêiner efêmero.
//    - "remote" — RemoteAuth, salvando o arquivo de sessão comprimido no
//      Firebase Storage (metadados no Firestore) — ver
//      lib/security/whatsappRemoteAuthStore.ts. Funciona mesmo sem disco
//      persistente, ao custo de um sync periódico (padrão: a cada 5
//      minutos) em vez de escrita imediata a cada mudança de estado.
//    Em ambos os casos, o par de chaves da sessão do WhatsApp Web
//    equivale à senha real do WhatsApp da clínica — nunca deve ir para
//    controle de versão (.gitignore já cobre a pasta local) nem para
//    backup sem criptografia.
//
// 3. DUAS formas de AUTENTICAR uma conexão nova, escolhidas por chamada
//    a startSession(clinicId, { authMethod }):
//    - "qr" (padrão) — QR code escaneado pela câmera do WhatsApp no
//      celular.
//    - "phone_number" — código de pareamento de 8 dígitos: a clínica
//      informa o número de telefone, recebe o código diretamente no
//      WhatsApp (sem precisar escanear nada), e digita esse código no
//      MediFlux. Útil quando não há como usar a câmera do celular
//      (ex.: acesso só pelo próprio navegador do celular) ou quando o
//      operador prefere não abrir a câmera.
//
// 4. Ao ficar pronta (evento "ready"), a sessão sincroniza o histórico de
//    conversas com mensagens não lidas (syncHistoricalUnreadChats) — é
//    isso que traz para a Caixa de Entrada de Atendimentos os contatos
//    que já tinham mensagens pendentes ANTES da conexão ter sido feita,
//    não só as que chegarem dali em diante.
// ---------------------------------------------------------------------------

export type WhatsAppConnectionStatus =
  | "disconnected"
  | "initializing"
  | "qr_pending"
  | "phone_code_pending"
  | "syncing_history"
  | "connected"
  | "auth_failed";

export type WhatsAppAuthMethod = "qr" | "phone_number";

// Intervalo do polling contínuo de contatos/mensagens (ver
// lib/whatsapp/messageSync.ts, syncViaContactPolling()) — alternativa
// habilitada por padrão ao mecanismo baseado em eventos
// (client.on("message", ...)), que se mostrou não confiável em
// determinados ambientes (ver README.md, seção "Alternativa quando a
// sincronização de histórico não funciona"). Configurável via
// WHATSAPP_POLLING_INTERVAL_MS para ajustar a frequência sem precisar
// mexer no código — um valor mais baixo detecta mensagens mais rápido,
// ao custo de mais chamadas ao WhatsApp Web por minuto.
const POLLING_SYNC_INTERVAL_MS = Number(process.env.WHATSAPP_POLLING_INTERVAL_MS) || 15000;

interface StartSessionOptions {
  authMethod?: WhatsAppAuthMethod;
  /** Obrigatório quando authMethod é "phone_number" — formato internacional, só dígitos (ex.: 5511987650000). */
  phoneNumber?: string;
}

interface ClientEntry {
  client: ClientType;
  status: WhatsAppConnectionStatus;
  authMethod: WhatsAppAuthMethod;
  qrDataUrl?: string;
  pairingCode?: string;
  connectedNumber?: string;
  lastError?: string;
  historySyncResult?: { chatsScanned: number; chatsWithUnread: number; messagesImported: number };
  // Preenchido quando a importação do histórico falha mesmo depois das
  // tentativas de getChatsWithRetry() — a conexão continua "connected"
  // normalmente (mensagens novas seguem chegando), só o histórico
  // anterior à conexão não foi trazido desta vez. Ver README.md, seção
  // "Alternativa quando a sincronização de histórico não funciona".
  historySyncError?: string;
  // Referência do setInterval do polling contínuo (ver
  // startContactPolling() abaixo) — guardada para poder ser limpa ao
  // desconectar, evitando um intervalo órfão rodando sem sessão.
  pollingIntervalId?: ReturnType<typeof setInterval>;
}

// Correção de robustez: usa global (mesmo padrão já usado em
// lib/db/store.ts para o store de dados de negócio) em vez de uma
// simples variável de módulo. Confirmado em teste real que, em certas
// condições do bundler do Next.js (rotas de API compiladas como bundles
// separados), uma variável de módulo comum pode não ser compartilhada
// de forma confiável entre rotas diferentes — o que faria uma sessão
// conectada "desaparecer" ao consultar o status ou tentar enviar uma
// mensagem a partir de outra rota. `global` sempre aponta para o mesmo
// objeto dentro do processo Node.js, independente de como o bundler
// separa os módulos.
declare global {
  // eslint-disable-next-line no-var
  var __mediflux_whatsapp_sessions__: Map<string, ClientEntry> | undefined;
}

function getSessionsMap(): Map<string, ClientEntry> {
  if (!global.__mediflux_whatsapp_sessions__) {
    global.__mediflux_whatsapp_sessions__ = new Map<string, ClientEntry>();
  }
  return global.__mediflux_whatsapp_sessions__;
}

function authFolderFor(clinicId: string): string {
  const safe = clinicId.replace(/[^a-zA-Z0-9_-]/g, "_");
  return `clinic-${safe}`;
}

// Cacheia a versão resolvida durante o tempo de vida do processo — não
// precisa buscar de novo a cada nova conexão/reconexão, só na primeira
// vez (ou depois de um fallback, na próxima tentativa).
let cachedWebVersion: string | null = null;

/**
 * Busca a versão atual conhecida como estável do WhatsApp Web no
 * índice mantido pela comunidade (wppconnect-team/wa-version) —
 * correção de um erro real reportado em uso: a versão fixada por
 * padrão dentro do whatsapp-web.js (DefaultOptions.webVersion, em
 * node_modules/whatsapp-web.js/src/util/Constants.js) fica desatualizada
 * com o tempo, e o WhatsApp Web real evolui de forma incompatível com
 * ela — manifestando-se como erros genéricos tipo "r: r" em operações
 * como getChats(), mesmo com a sessão conectada.
 *
 * Este índice publica versões com data de expiração (cada uma fica
 * disponível por cerca de 2 meses) — por isso a versão não pode ser
 * fixada como um número no código, precisa ser resolvida em runtime
 * a cada deploy.
 *
 * "Melhor esforço" deliberado: se a busca falhar (rede indisponível,
 * índice fora do ar), devolve null — o chamador então usa a versão
 * padrão embutida na biblioteca em vez de travar a conexão por causa
 * de uma falha de rede numa correção que é, em si, opcional.
 */
async function resolveLatestStableWebVersion(): Promise<string | null> {
  if (cachedWebVersion) return cachedWebVersion;

  try {
    const res = await fetch("https://raw.githubusercontent.com/wppconnect-team/wa-version/main/versions.json", {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { currentVersion?: string };
    if (data.currentVersion) {
      cachedWebVersion = data.currentVersion;
      return cachedWebVersion;
    }
    return null;
  } catch (e) {
    console.warn("[WhatsApp] Falha ao resolver a versão atual do WhatsApp Web — usando a versão padrão da biblioteca.", e);
    return null;
  }
}

/**
 * Constrói a authStrategy conforme WHATSAPP_SESSION_STRATEGY. "remote"
 * exige FIREBASE_SERVICE_ACCOUNT_KEY configurada (mesma variável já usada
 * pela integração de Firebase Auth) — sem ela, cai para "local" com um
 * aviso no log, em vez de derrubar a conexão inteira por uma
 * configuração ausente.
 */
function buildAuthStrategy(clinicId: string) {
  const strategy = (process.env.WHATSAPP_SESSION_STRATEGY || "local").toLowerCase();
  const clientId = authFolderFor(clinicId);

  if (strategy === "remote") {
    if (!process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      console.warn(
        `[WhatsApp] WHATSAPP_SESSION_STRATEGY=remote definido, mas FIREBASE_SERVICE_ACCOUNT_KEY ausente — usando LocalAuth como fallback para a clínica ${clinicId}.`
      );
    } else {
      return new RemoteAuth({
        clientId,
        dataPath: ".wwebjs_auth",
        store: createFirestoreRemoteAuthStore(),
        backupSyncIntervalMs: 5 * 60 * 1000,
      });
    }
  }

  return new LocalAuth({ clientId, dataPath: ".wwebjs_auth" });
}

/**
 * Inicia (ou reaproveita) a sessão de WhatsApp de uma clínica.
 * Idempotente na prática: se já existe uma sessão em qualquer estado que
 * não seja "disconnected"/"auth_failed", devolve a entrada existente em
 * vez de criar um segundo Client para a mesma clínica — mesmo que
 * authMethod peça algo diferente do que já está em andamento (trocar de
 * método exige desconectar primeiro).
 */
export async function startSession(clinicId: string, options: StartSessionOptions = {}): Promise<ClientEntry> {
  const existing = getSessionsMap().get(clinicId);
  if (
    existing &&
    (existing.status === "initializing" ||
      existing.status === "qr_pending" ||
      existing.status === "phone_code_pending" ||
      existing.status === "syncing_history" ||
      existing.status === "connected")
  ) {
    return existing;
  }

  const authMethod: WhatsAppAuthMethod = options.authMethod || "qr";
  if (authMethod === "phone_number" && !options.phoneNumber) {
    throw new Error("phoneNumber é obrigatório quando authMethod é 'phone_number'.");
  }

  const entry: ClientEntry = { client: null as unknown as ClientType, status: "initializing", authMethod };
  getSessionsMap().set(clinicId, entry);

  // Resolvido ANTES de instanciar o Client, para poder passar como
  // webVersion junto com webVersionCache abaixo — sem isso, a
  // biblioteca pediria ao índice remoto a versão antiga fixada por
  // padrão nela mesma, o que não resolveria o problema de verdade (ver
  // resolveLatestStableWebVersion() acima para a explicação completa).
  const resolvedWebVersion = await resolveLatestStableWebVersion();

  const client = new Client({
    authStrategy: buildAuthStrategy(clinicId),
    // undefined aqui faz a biblioteca usar sua própria versão padrão
    // (desatualizada) — só definimos quando a resolução acima teve
    // sucesso, nunca fixamos um número aqui, porque o índice remoto
    // expira essas versões com o tempo.
    webVersion: resolvedWebVersion || undefined,
    // Correção de um erro real reportado em uso: a versão do WhatsApp
    // Web que vem fixada por padrão dentro do whatsapp-web.js
    // (DefaultOptions.webVersion, em node_modules/whatsapp-web.js/src/
    // util/Constants.js) fica desatualizada com o tempo — o WhatsApp
    // Web real (o que roda de fato nos servidores da Meta) segue
    // evoluindo, e uma versão antiga fixada pode não ser mais
    // totalmente compatível com o código que a biblioteca injeta no
    // navegador. Isso se manifesta como erros genéricos e pouco
    // informativos tipo "r: r" em operações como getChats() — mesmo
    // com a sessão conectada e funcionando para o básico (ver
    // getChatsWithRetry() em lib/whatsapp/messageSync.ts, que já lida
    // com instabilidades pontuais, mas não com uma incompatibilidade
    // de versão persistente como essa).
    //
    // A correção é sempre buscar a versão mais recente do WhatsApp Web
    // de um índice mantido pela comunidade (wppconnect-team/wa-version,
    // usado como referência padrão por praticamente todo consumidor da
    // biblioteca para este mesmo problema), em vez de depender da
    // versão fixa e cada vez mais antiga que vem embutida na
    // instalação do pacote. O placeholder {version} é substituído pela
    // própria biblioteca pela versão que ela detecta como a mais atual
    // em uso na sessão — não uma versão fixa escolhida por nós, que
    // ficaria desatualizada com o tempo do mesmo jeito.
    webVersionCache: {
      type: "remote",
      remotePath:
        process.env.WHATSAPP_WEB_VERSION_REMOTE_PATH ||
        "https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/{version}.html",
    },
    // pairWithPhoneNumber ativa o fluxo de código de pareamento em vez
    // do QR code — a biblioteca ainda emite o evento "qr" internamente
    // (necessário para o protocolo de conexão), mas com essa opção
    // ativa ela também dispara "code" com o código de 8 dígitos, que é
    // o que de fato mostramos ao usuário nesse modo.
    pairWithPhoneNumber:
      authMethod === "phone_number"
        ? { phoneNumber: options.phoneNumber!, showNotification: true, intervalMs: 180000 }
        : undefined,
    puppeteer: {
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    },
  });
  entry.client = client;

  client.on("qr", async (qr) => {
    // No modo "phone_number", o evento "qr" ainda é emitido pelo
    // protocolo interno da biblioteca, mas não deve ser mostrado ao
    // usuário — o pareamento por telefone tem sua própria UI (o código
    // de 8 dígitos, via o evento "code" abaixo).
    if (entry.authMethod === "phone_number") return;
    try {
      entry.qrDataUrl = await QRCode.toDataURL(qr);
      entry.status = "qr_pending";
    } catch (e) {
      console.error(`[WhatsApp] Falha ao gerar QR code para a clínica ${clinicId}:`, e);
    }
  });

  client.on("code", (code) => {
    entry.pairingCode = code;
    entry.status = "phone_code_pending";
  });

  client.on("ready", async () => {
    entry.qrDataUrl = undefined;
    entry.pairingCode = undefined;
    entry.connectedNumber = client.info?.wid?.user;
    entry.status = "syncing_history";

    // Sincronização do histórico de contatos com mensagens não lidas —
    // roda uma vez, logo que a sessão fica pronta, antes de marcar como
    // "connected". Ver lib/whatsapp/messageSync.ts.
    try {
      entry.historySyncResult = await syncHistoricalUnreadChats(clinicId, client);
    } catch (e: any) {
      // "Melhor esforço" deliberado: a conexão segue "connected" no
      // finally abaixo mesmo aqui — mensagens novas continuam sendo
      // sincronizadas normalmente via o listener de "message" (evento
      // contínuo, mecanismo diferente do getChats() que falhou aqui —
      // ver README.md para a explicação completa). Só o histórico
      // anterior à conexão não foi importado desta vez.
      entry.historySyncError =
        "Não foi possível importar o histórico de conversas anteriores à conexão. As mensagens novas, a partir de agora, continuam sendo recebidas normalmente.";
      console.error(`[WhatsApp] Falha ao sincronizar histórico de não lidas (clínica ${clinicId}):`, e);
    } finally {
      entry.status = "connected";
      startContactPolling(clinicId, client, entry);
    }
  });

  // Sincronização em tempo (quase) real: toda mensagem recebida DEPOIS
  // da conexão já estar pronta vira uma mensagem de chat de um paciente
  // (novo ou existente) — ver lib/whatsapp/messageSync.ts. Mantido como
  // caminho PRIMÁRIO (mais rápido, sem espera de intervalo) — o
  // polling contínuo acima é o caminho de RESERVA, que garante a
  // sincronização mesmo se este evento não disparar de forma confiável
  // no ambiente em questão (comportamento já observado e documentado
  // em uso real — ver README.md). syncIncomingMessage() e
  // syncViaContactPolling() compartilham a mesma checagem de
  // deduplicação, então não há risco de mensagem duplicada mesmo com
  // os dois caminhos ativos ao mesmo tempo.
  client.on("message", async (message) => {
    await syncIncomingMessage(clinicId, message);
  });

  client.on("auth_failure", (msg) => {
    entry.status = "auth_failed";
    entry.lastError = msg;
  });

  client.on("disconnected", (reason) => {
    if (entry.pollingIntervalId) {
      clearInterval(entry.pollingIntervalId);
      entry.pollingIntervalId = undefined;
    }
    entry.status = "disconnected";
    entry.qrDataUrl = undefined;
    entry.pairingCode = undefined;
    entry.connectedNumber = undefined;
    entry.lastError = reason;
    getSessionsMap().delete(clinicId);
  });

  // client.initialize() é assíncrono e de longa duração (sobe o
  // Chromium) — não aguardamos aqui de propósito. A rota HTTP que chama
  // startSession() devolve a resposta imediatamente (status
  // "initializing"), e o front-end consulta o status/QR code/código de
  // pareamento via polling em getSessionStatus() logo abaixo.
  client.initialize().catch((e) => {
    entry.status = "auth_failed";
    entry.lastError = e?.message || String(e);
  });

  return entry;
}

/** Estado atual da sessão de uma clínica — para o front-end fazer polling durante a conexão e a sincronização de histórico. */
export function getSessionStatus(clinicId: string): {
  status: WhatsAppConnectionStatus;
  authMethod?: WhatsAppAuthMethod;
  qrDataUrl?: string;
  pairingCode?: string;
  connectedNumber?: string;
  lastError?: string;
  historySyncResult?: { chatsScanned: number; chatsWithUnread: number; messagesImported: number };
  historySyncError?: string;
} {
  const entry = getSessionsMap().get(clinicId);
  if (!entry) return { status: "disconnected" };
  return {
    status: entry.status,
    authMethod: entry.authMethod,
    qrDataUrl: entry.qrDataUrl,
    pairingCode: entry.pairingCode,
    connectedNumber: entry.connectedNumber,
    lastError: entry.lastError,
    historySyncResult: entry.historySyncResult,
    historySyncError: entry.historySyncError,
  };
}

/**
 * Encerra a sessão de uma clínica — desloga do WhatsApp Web (invalida a
 * sessão salva, exigindo novo QR code ou código de pareamento numa
 * próxima conexão) e fecha o Chromium.
 */
/**
 * Inicia o polling contínuo de contatos/mensagens para uma sessão —
 * ver lib/whatsapp/messageSync.ts, syncViaContactPolling(), para a
 * explicação completa de por que este mecanismo existe como
 * alternativa ao evento "message". Uma rodada de cada vez: se uma
 * rodada ainda estiver em andamento quando o próximo tick do
 * setInterval disparar, esse tick é ignorado (a flag `running` evita
 * rodadas sobrepostas, que poderiam competir pela mesma aba do
 * Chromium).
 */
function startContactPolling(clinicId: string, client: ClientType, entry: ClientEntry): void {
  let running = false;
  entry.pollingIntervalId = setInterval(async () => {
    if (running || entry.status !== "connected") return;
    running = true;
    try {
      await syncViaContactPolling(clinicId, client);
    } catch (e) {
      // syncViaContactPolling() já captura os próprios erros
      // internamente (devolve failed: true em vez de lançar) — este
      // catch é só uma proteção adicional contra qualquer falha
      // inesperada não prevista, para o setInterval nunca parar de
      // rodar por causa de uma exceção não tratada.
      console.error(`[WhatsApp Polling] Erro inesperado numa rodada de polling (clínica ${clinicId}):`, e);
    } finally {
      running = false;
    }
  }, POLLING_SYNC_INTERVAL_MS);
}

export async function stopSession(clinicId: string): Promise<void> {
  const entry = getSessionsMap().get(clinicId);
  if (!entry) return;
  if (entry.pollingIntervalId) {
    clearInterval(entry.pollingIntervalId);
    entry.pollingIntervalId = undefined;
  }
  try {
    await entry.client.logout();
  } catch (e) {
    console.warn(`[WhatsApp] Erro ao deslogar a clínica ${clinicId} (prosseguindo com a limpeza local):`, e);
  }
  try {
    await entry.client.destroy();
  } catch (e) {
    console.warn(`[WhatsApp] Erro ao destruir o client da clínica ${clinicId}:`, e);
  }
  getSessionsMap().delete(clinicId);
}

/**
 * Devolve o Client ativo de uma clínica, só quando a sessão está
 * "connected" — usado por lib/whatsapp/messageSender.ts para enviar
 * mensagens reais a partir da tela de Atendimentos. Devolve null em
 * qualquer outro estado (desconectado, ainda conectando, sincronizando
 * histórico, etc.) — nunca um Client parcialmente inicializado, que
 * poderia falhar de forma confusa ao tentar enviar.
 */
export function getActiveClient(clinicId: string): ClientType | null {
  const entry = getSessionsMap().get(clinicId);
  if (!entry || entry.status !== "connected") return null;
  return entry.client;
}

export type { Chat };
