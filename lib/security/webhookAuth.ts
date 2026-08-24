import crypto from 'crypto';

// ---------------------------------------------------------------------------
// Correção de auditoria (prioridade alta #5): o webhook de recepção de
// mensagens do WhatsApp (app/api/chat/webhook-wpp/route.ts) processava
// qualquer POST recebido como se fosse uma mensagem real de paciente —
// sem validar de nenhuma forma que a requisição veio de fato do provedor
// configurado. Qualquer requisição forjada era aceita, criava um
// paciente novo se necessário, e acionava a IA de triagem clínica.
//
// Este módulo centraliza a validação de origem para os dois formatos de
// payload que o webhook aceita:
//
// 1. Meta Cloud API — assina o corpo da requisição com HMAC-SHA256,
//    enviado no header X-Hub-Signature-256 no formato "sha256=<hex>".
//    Verificação em tempo constante (crypto.timingSafeEqual), o mesmo
//    cuidado usado para qualquer comparação de segredo — comparar
//    caractere a caractere vazaria informação sobre o valor correto via
//    diferença de tempo de resposta.
//
// 2. Bridges customizadas (whatsapp-web.js direto, Baileys, WPPConnect)
//    — esses projetos não têm um padrão nativo de assinatura HMAC de
//    webhook; a defesa aqui é um segredo compartilhado simples, enviado
//    no header X-Webhook-Secret, comparado também em tempo constante.
//
// Em ambos os casos, a ausência da variável de ambiente correspondente
// bloqueia o webhook por completo (fail closed) — um provedor mal
// configurado não deveria abrir uma porta sem proteção nenhuma.
// ---------------------------------------------------------------------------

function timingSafeStringEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  // Buffers de tamanho diferente nunca são iguais — mas comparar o
  // tamanho primeiro não vaza informação útil sobre o conteúdo (só o
  // comprimento, que já é público pelo formato esperado do header).
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Valida a assinatura HMAC-SHA256 do formato Meta Cloud API
 * (header X-Hub-Signature-256, formato "sha256=<hex>").
 */
function verifyMetaSignature(rawBody: string, signatureHeader: string | null): boolean {
  const secret = process.env.WHATSAPP_WEBHOOK_SECRET;
  if (!secret) return false;
  if (!signatureHeader || !signatureHeader.startsWith('sha256=')) return false;

  const expectedSignature = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const receivedSignature = signatureHeader.slice('sha256='.length);

  return timingSafeStringEqual(receivedSignature, expectedSignature);
}

/**
 * Valida o segredo compartilhado simples usado pelas bridges
 * customizadas (header X-Webhook-Secret).
 */
function verifySharedSecret(secretHeader: string | null): boolean {
  const secret = process.env.WHATSAPP_WEBHOOK_SECRET;
  if (!secret) return false;
  if (!secretHeader) return false;

  return timingSafeStringEqual(secretHeader, secret);
}

/**
 * Ponto único de verificação do webhook de WhatsApp — tenta a assinatura
 * Meta primeiro (mais forte, cobre integridade do corpo inteiro); se o
 * header dela não estiver presente, cai para o segredo compartilhado
 * simples das bridges customizadas.
 */
export function verifyWhatsAppWebhookRequest(
  rawBody: string,
  headers: { metaSignature: string | null; sharedSecret: string | null }
): boolean {
  if (headers.metaSignature) {
    return verifyMetaSignature(rawBody, headers.metaSignature);
  }
  return verifySharedSecret(headers.sharedSecret);
}
