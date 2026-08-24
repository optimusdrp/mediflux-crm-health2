import { getActiveClient } from "./sessionManager";

// ---------------------------------------------------------------------------
// Envio de mensagens REAIS via WhatsApp — a contraparte de
// lib/whatsapp/messageSync.ts (que trata RECEBIMENTO). Sem este módulo,
// uma mensagem "enviada" pelo atendente na tela de Atendimentos só era
// gravada no banco de dados interno do MediFlux — o paciente nunca
// recebia nada de verdade no WhatsApp, mesmo com uma sessão conectada.
//
// Usado por app/api/chat/messages/route.ts (POST) — só quando a
// mensagem não é uma nota interna e o canal do paciente é "whatsapp".
// Mensagens de outros canais (site, Instagram, Telegram) ou notas
// internas nunca chegam a este módulo.
// ---------------------------------------------------------------------------

/**
 * Converte um telefone no formato de exibição do sistema (qualquer
 * formato razoável: "(11) 98765-0000", "11987650000", "+55 11 98765-0000"
 * etc.) para o formato de destinatário que o whatsapp-web.js espera
 * ("5511987650000@c.us").
 *
 * Assume Brasil (código 55) quando o número não já inclui um código de
 * país — consistente com formatPhoneFromWhatsAppId() em messageSync.ts,
 * que faz a conversão inversa com a mesma suposição. Se o projeto vier
 * a atender clínicas fora do Brasil, este é o ponto único a ajustar.
 */
export function phoneToWhatsAppId(phone: string): string {
  const digitsOnly = phone.replace(/\D/g, "");
  // Já vem com código do país (13 dígitos: 55 + DDD + 9 dígitos, ou 12
  // para linha fixa) — usa como está. Caso contrário (10 ou 11
  // dígitos, sem "55"), prefixa com o código do Brasil.
  const withCountryCode = digitsOnly.length >= 12 ? digitsOnly : `55${digitsOnly}`;
  return `${withCountryCode}@c.us`;
}

export class WhatsAppSendError extends Error {
  constructor(
    message: string,
    public readonly reason: "not_connected" | "invalid_number" | "send_failed"
  ) {
    super(message);
    this.name = "WhatsAppSendError";
  }
}

/**
 * Envia uma mensagem de texto para um paciente via a sessão real de
 * WhatsApp da clínica. Lança WhatsAppSendError com um motivo específico
 * em cada caso de falha — o chamador (rota de API) decide como traduzir
 * isso para o atendente, mas sempre com um erro claro, nunca um envio
 * que "parece" ter funcionado sem ter funcionado de fato.
 */
export async function sendWhatsAppMessage(clinicId: string, patientPhone: string, text: string): Promise<void> {
  const client = getActiveClient(clinicId);
  if (!client) {
    throw new WhatsAppSendError(
      "O WhatsApp desta clínica não está conectado no momento — a mensagem foi salva no MediFlux, mas não foi enviada de verdade ao paciente.",
      "not_connected"
    );
  }

  const chatId = phoneToWhatsAppId(patientPhone);

  let isRegistered: boolean;
  try {
    isRegistered = await client.isRegisteredUser(chatId);
  } catch (e) {
    // Falha ao consultar (ex.: sessão instável) — trata como não
    // registrado, para dar um erro claro em vez de tentar enviar às
    // cegas e falhar de forma mais confusa mais adiante.
    throw new WhatsAppSendError(
      "Não foi possível confirmar se este número tem WhatsApp — a mensagem foi salva no MediFlux, mas não foi enviada.",
      "invalid_number"
    );
  }
  if (!isRegistered) {
    throw new WhatsAppSendError(
      `O número ${patientPhone} não parece ter WhatsApp ativo — a mensagem foi salva no MediFlux, mas não foi enviada.`,
      "invalid_number"
    );
  }

  try {
    await client.sendMessage(chatId, text);
  } catch (e: any) {
    throw new WhatsAppSendError(
      `Falha ao enviar a mensagem pelo WhatsApp (${e?.message || "erro desconhecido"}) — ela foi salva no MediFlux, mas não chegou ao paciente.`,
      "send_failed"
    );
  }
}
