import { getDatabase } from "@/lib/db/store";
import type { Patient, ChatMessage } from "@/lib/types";
import type { Client as ClientType, Message as WhatsAppMessage, Chat } from "whatsapp-web.js";

// ---------------------------------------------------------------------------
// Sincronização de mensagens do WhatsApp com a Caixa de Entrada de
// Atendimentos — dois fluxos complementares:
//
// 1. syncIncomingMessage — uma mensagem NOVA, recebida em tempo real
//    depois que a conexão já está pronta (client.on("message", ...) em
//    sessionManager.ts).
//
// 2. syncHistoricalUnreadChats — roda UMA VEZ, logo que a sessão fica
//    pronta (evento "ready"): varre todos os contatos (chats 1:1, não
//    grupos) que já tinham mensagens não lidas ANTES da conexão ter sido
//    feita, e importa o histórico recente de cada um. Sem isso, só
//    apareceriam na Caixa de Entrada as mensagens que chegassem DEPOIS
//    de conectar — o pedido original foi explicitamente sincronizar
//    também o que já estava pendente.
//
// Ambos os fluxos convergem para a mesma lógica de "encontrar ou criar
// paciente por telefone" e "gravar mensagem", para nunca duplicar
// paciente nem mensagem entre os dois caminhos.
// ---------------------------------------------------------------------------

function formatPhoneFromWhatsAppId(waId: string): string {
  // waId chega como "5511987650000@c.us" — remove o sufixo e o código do
  // país (Brasil, "55") quando presente, deixando "11987650000".
  const digitsOnly = waId.replace(/@c\.us$/, "").replace(/\D/g, "");
  const withoutCountryCode = digitsOnly.startsWith("55") && digitsOnly.length > 11 ? digitsOnly.slice(2) : digitsOnly;

  if (withoutCountryCode.length === 11) {
    return `(${withoutCountryCode.slice(0, 2)}) ${withoutCountryCode.slice(2, 7)}-${withoutCountryCode.slice(7)}`;
  }
  if (withoutCountryCode.length === 10) {
    return `(${withoutCountryCode.slice(0, 2)}) ${withoutCountryCode.slice(2, 6)}-${withoutCountryCode.slice(6)}`;
  }
  return withoutCountryCode || waId;
}

function formatTimestamp(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toISOString();
}

/**
 * Busca um paciente existente pelo telefone (dentro da clínica) ou cria
 * um novo, no início do funil — mesmo formato de criação usado pelas
 * rotas de API (server/routes ou app/api/patients), para o paciente
 * criado aqui se comportar de forma idêntica a um cadastrado
 * manualmente.
 */
function findOrCreatePatientByPhone(clinicId: string, phone: string, displayName: string): Patient {
  const db = getDatabase();
  const existing = db.patients.find((p) => p.clinicId === clinicId && p.phone === phone);
  if (existing) return existing;

  const newPatient: Patient = {
    id: `pat_wa_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    clinicId,
    name: displayName || phone,
    phone,
    cpf: "",
    birthDate: "",
    healthInsurance: "A confirmar",
    planNumber: "",
    specialty: "Clínica Geral",
    funnelStage: "novo",
    funnelId: "funnel_principal",
    urgency: "media",
    checklist: {},
    notes: "",
    tags: ["#WhatsApp"],
    lastInteractionAt: new Date().toISOString(),
    unreadCount: 0,
    originChannel: "whatsapp",
  };
  db.patients.push(newPatient);
  return newPatient;
}

/** Grava uma mensagem no chat do paciente e atualiza os metadados de exibição (última interação, não lidas). */
function recordMessage(
  clinicId: string,
  patient: Patient,
  text: string,
  timestamp: string,
  incrementUnread: boolean
): void {
  const db = getDatabase();
  const newMessage: ChatMessage = {
    id: `msg_wa_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    clinicId,
    patientId: patient.id,
    sender: "patient",
    senderName: patient.name,
    text,
    isInternalNote: false,
    timestamp,
    channel: "whatsapp",
  };
  db.chatMessages.push(newMessage);

  patient.lastInteractionAt = timestamp;
  if (incrementUnread) {
    patient.unreadCount = (patient.unreadCount || 0) + 1;
  }
}

/**
 * Processa uma mensagem recebida em TEMPO REAL de um Client conectado.
 * "Melhor esforço": uma falha aqui é registrada no log, mas nunca
 * derruba a sessão do WhatsApp em si.
 */
export async function syncIncomingMessage(clinicId: string, message: WhatsAppMessage): Promise<void> {
  // Mensagens enviadas pela própria clínica (ex.: atendente respondendo
  // direto pelo celular, fora do MediFlux) não são "recebidas".
  if (message.fromMe) return;
  // Mensagens de grupo ficam fora do escopo — a Caixa de Entrada é
  // modelada em torno de conversas 1:1 com um paciente.
  if (!message.from.endsWith("@c.us")) return;

  try {
    const phone = formatPhoneFromWhatsAppId(message.from);
    const timestamp = formatTimestamp(message.timestamp);
    const text = message.body || "";

    let displayName = phone;
    try {
      const contact = await message.getContact();
      displayName = contact?.pushname || contact?.name || phone;
    } catch {
      // Sem contato resolvido — usa o telefone como nome.
    }

    const patient = findOrCreatePatientByPhone(clinicId, phone, displayName);
    recordMessage(clinicId, patient, text, timestamp, true);
  } catch (e) {
    console.error(`[WhatsApp Sync] Falha ao sincronizar mensagem recebida em tempo real (clínica ${clinicId}):`, e);
  }
}

/**
 * Espera N milissegundos — usado só para dar tempo da store interna do
 * WhatsApp Web estabilizar antes da primeira tentativa de
 * client.getChats() (ver getChatsWithRetry() logo abaixo).
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry genérico para QUALQUER operação que passe por
 * pupPage.evaluate() do Puppeteer — não só getChats(). Confirmado em
 * uso real que essa instabilidade não é exclusiva de uma função: o
 * mesmo erro genérico ("r: r") já apareceu em getChats() E em
 * contact.getChat() (que por baixo também chama pupPage.evaluate(),
 * ver client.getChatById() na biblioteca) — ou seja, o problema é do
 * mecanismo de executar código dentro do Chromium em si, em
 * determinados ambientes, não de uma chamada específica.
 *
 * label é só para mensagens de log mais úteis (identifica qual
 * operação estava sendo tentada).
 */
async function withPuppeteerRetry<T>(label: string, operation: () => Promise<T>, maxAttempts = 2): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (e) {
      lastError = e;
      if (attempt < maxAttempts) {
        console.warn(`[WhatsApp] ${label} falhou na tentativa ${attempt}/${maxAttempts} — tentando de novo.`, e);
        await delay(1500 * attempt);
      }
    }
  }
  throw lastError;
}

/**
 * Chama client.getChats() com espera inicial e novas tentativas em caso
 * de falha — contorna uma instabilidade real e documentada da própria
 * biblioteca whatsapp-web.js: getChats() chamado imediatamente após o
 * evento "ready" pode falhar com um erro genérico e pouco informativo
 * (frequentemente serializado como algo como "r: r", uma variável
 * minificada do lado do WhatsApp Web) porque a store interna de chats
 * do WhatsApp Web ainda não terminou de estabilizar no navegador,
 * mesmo o cliente já reportando estar "pronto". Ver
 * https://github.com/wwebjs/whatsapp-web.js/issues/201845 — issue
 * aberta na própria biblioteca, sem correção definitiva do lado deles;
 * a mitigação prática (usada também por outros consumidores da
 * biblioteca) é uma espera inicial seguida de novas tentativas.
 *
 * Nunca deveria ser necessário em condições normais além da primeira
 * tentativa — se estiver, é sinal de uma sessão realmente instável, daí
 * o número limitado de tentativas em vez de retry indefinido.
 */
async function getChatsWithRetry(client: ClientType, maxAttempts = 2): Promise<Chat[]> {
  // Espera inicial antes mesmo da primeira tentativa — dar um instante
  // para a store do WhatsApp Web assentar reduz a chance de já cair no
  // erro na primeira chamada.
  await delay(1500);
  return withPuppeteerRetry("getChats()", () => client.getChats(), maxAttempts);
}

/**
 * Sincronização de histórico — roda uma vez, quando a sessão fica
 * pronta. Varre todos os chats individuais (não-grupo) com
 * unreadCount > 0 e importa as mensagens não lidas de cada um (mais uma
 * mensagem de contexto anterior, quando disponível, para o atendente
 * não abrir uma conversa "no vácuo").
 *
 * Cada mensagem histórica importada é tratada com a MESMA lógica de
 * criar/atualizar paciente que uma mensagem em tempo real — o paciente
 * resultante é idêntico, não importa por qual caminho a mensagem
 * chegou. O contador de não lidas do paciente reflete o unreadCount
 * real do WhatsApp no momento da sincronização, não é incrementado
 * mensagem a mensagem (evita inflar o contador ao importar várias
 * mensagens históricas de uma vez).
 *
 * "Melhor esforço" no nível mais externo: se mesmo com as tentativas de
 * getChatsWithRetry() a sincronização de histórico falhar, o erro é
 * relatado (ver sessionManager.ts) mas a conexão em si permanece
 * "connected" — o WhatsApp continua utilizável para mensagens novas
 * dali em diante, só o histórico anterior à conexão não foi importado
 * desta vez.
 */
export async function syncHistoricalUnreadChats(
  clinicId: string,
  client: ClientType
): Promise<{ chatsScanned: number; chatsWithUnread: number; messagesImported: number }> {
  const chats: Chat[] = await getChatsWithRetry(client);
  let chatsWithUnread = 0;
  let messagesImported = 0;

  for (const chat of chats) {
    if (chat.isGroup) continue;
    if (!chat.unreadCount || chat.unreadCount <= 0) continue;
    chatsWithUnread++;

    try {
      const phone = formatPhoneFromWhatsAppId(chat.id._serialized);
      let displayName = phone;
      try {
        const contact = await chat.getContact();
        displayName = contact?.pushname || contact?.name || phone;
      } catch {
        displayName = chat.name || phone;
      }

      const patient = findOrCreatePatientByPhone(clinicId, phone, displayName);

      // Busca um pouco mais que o número de não lidas, para dar
      // contexto de uma mensagem anterior já lida — sem isso, uma
      // conversa com 1 mensagem não lida apareceria sem nenhum
      // histórico prévio, mesmo que a conversa já viesse de mais longe.
      const fetchLimit = Math.min(chat.unreadCount + 3, 50);
      const messages = await chat.fetchMessages({ limit: fetchLimit });

      for (const message of messages) {
        if (message.fromMe) continue;
        const text = message.body || "";
        const timestamp = formatTimestamp(message.timestamp);

        // Evita duplicar mensagem já sincronizada numa sessão anterior
        // (ex.: servidor reiniciou e reconectou automaticamente) —
        // checagem por combinação de paciente + texto + timestamp, já
        // que o id da mensagem do WhatsApp não é persistido no schema
        // atual de ChatMessage.
        const db = getDatabase();
        const alreadyExists = db.chatMessages.some(
          (m) => m.patientId === patient.id && m.text === text && m.timestamp === timestamp
        );
        if (alreadyExists) continue;

        recordMessage(clinicId, patient, text, timestamp, false);
        messagesImported++;
      }

      // O contador de não lidas do paciente reflete o valor real do
      // WhatsApp no momento da sincronização — não a contagem de
      // mensagens importadas (que inclui contexto extra já lido).
      patient.unreadCount = chat.unreadCount;
    } catch (e) {
      console.error(`[WhatsApp Sync] Falha ao sincronizar histórico do chat (clínica ${clinicId}):`, e);
      // Continua para o próximo chat — uma falha isolada não deveria
      // interromper a sincronização dos demais contatos.
    }
  }

  return { chatsScanned: chats.length, chatsWithUnread, messagesImported };
}

// ---------------------------------------------------------------------------
// Alternativa a syncHistoricalUnreadChats — usada quando getChats() se
// mostra persistentemente instável em determinados ambientes (relatado
// e confirmado em uso real: falha mesmo após múltiplas tentativas com
// espera progressiva, e mesmo com a correção de versão do WhatsApp Web
// em sessionManager.ts — algo específico do ambiente que não foi
// possível reproduzir nem diagnosticar mais a fundo remotamente).
//
// Em vez de pedir a LISTA COMPLETA de chats de uma vez (getChats(),
// mecanismo com problema confirmado), usa getContacts() — uma função
// diferente do lado do WhatsApp Web, que acessa uma parte diferente da
// store interna, com chance real de não compartilhar a mesma
// instabilidade. Não há garantia absoluta disso — a causa raiz nunca
// foi confirmada com certeza — por isso este caminho é ativado
// explicitamente (ver sessionManager.ts, POLLING_SYNC_INTERVAL_MS) e
// rodado em POLLING CONTÍNUO, não uma vez só: se uma rodada falhar, a
// próxima (poucos segundos depois) tenta de novo automaticamente, sem
// exigir reconectar manualmente.
//
// getContacts() traz tanto contatos salvos na agenda quanto qualquer
// pessoa que já trocou mensagem com o número (o WhatsApp Web mantém uma
// entrada de contato para qualquer remetente conhecido pela sessão,
// esteja ou não salvo) — cobre tanto contatos já existentes quanto
// números novos que ainda não mandaram mensagem antes desta conexão.
// ---------------------------------------------------------------------------

export interface PollingSyncResult {
  contactsScanned: number;
  messagesImported: number;
  failed: boolean;
}

/**
 * Uma rodada de sincronização via polling — chamada repetidamente por
 * sessionManager.ts em intervalo fixo enquanto a sessão estiver
 * conectada. Cada chamada é independente e "melhor esforço" em todos os
 * níveis: uma falha ao listar contatos não lança exceção (devolve
 * failed: true), e uma falha ao processar um contato específico não
 * interrompe os demais.
 */
export async function syncViaContactPolling(clinicId: string, client: ClientType): Promise<PollingSyncResult> {
  let contacts: Awaited<ReturnType<ClientType["getContacts"]>>;
  try {
    contacts = await withPuppeteerRetry("getContacts()", () => client.getContacts());
  } catch (e) {
    console.warn(`[WhatsApp Polling] Falha ao listar contatos (clínica ${clinicId}) — tentando de novo na próxima rodada.`, e);
    return { contactsScanned: 0, messagesImported: 0, failed: true };
  }

  let messagesImported = 0;
  const db = getDatabase();

  for (const contact of contacts) {
    if (contact.isGroup || !contact.isUser) continue;

    try {
      const chat = await withPuppeteerRetry(`getChat() (contato ${contact.id._serialized})`, () => contact.getChat());
      if (!chat || chat.isGroup) continue;

      const phone = formatPhoneFromWhatsAppId(contact.id._serialized);
      // Só processa contatos com alguma mensagem — evita criar
      // pacientes "vazios" para toda a agenda do número conectado.
      const fetchLimit = chat.unreadCount && chat.unreadCount > 0 ? Math.min(chat.unreadCount + 3, 50) : 5;
      const messages = await withPuppeteerRetry(`fetchMessages() (contato ${contact.id._serialized})`, () =>
        chat.fetchMessages({ limit: fetchLimit })
      );
      const incomingMessages = messages.filter((m) => !m.fromMe);
      if (incomingMessages.length === 0) continue;

      let displayName = phone;
      try {
        displayName = contact.pushname || contact.name || phone;
      } catch {
        displayName = phone;
      }

      const patient = findOrCreatePatientByPhone(clinicId, phone, displayName);

      for (const message of incomingMessages) {
        const text = message.body || "";
        const timestamp = formatTimestamp(message.timestamp);

        // Mesma checagem de deduplicação usada em
        // syncHistoricalUnreadChats — essencial aqui, já que o
        // polling revisita repetidamente as mesmas conversas.
        const alreadyExists = db.chatMessages.some(
          (m) => m.patientId === patient.id && m.text === text && m.timestamp === timestamp
        );
        if (alreadyExists) continue;

        recordMessage(clinicId, patient, text, timestamp, true);
        messagesImported++;
      }

      if (typeof chat.unreadCount === "number") {
        patient.unreadCount = chat.unreadCount;
      }
    } catch (e) {
      console.warn(`[WhatsApp Polling] Falha ao processar um contato específico (clínica ${clinicId}) — seguindo para o próximo.`, e);
    }
  }

  return { contactsScanned: contacts.length, messagesImported, failed: false };
}

