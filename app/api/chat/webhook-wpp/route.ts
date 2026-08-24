import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db/store';
import { ChatMessage, Patient } from '@/lib/types';
import { routeClinicalTriage } from '@/lib/ai/router';
import { verifyWhatsAppWebhookRequest } from '@/lib/security/webhookAuth';

// Normaliza números de telefone (remove caracteres especiais para comparação)
function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

export async function GET(req: NextRequest) {
  // Verificação de webhook healthcheck (padrão WhatsApp / Meta)
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  // Correção de auditoria (prioridade alta #5): o token de verificação
  // estava fixo no código-fonte ('cardiovida_secret_token') — movido
  // para variável de ambiente, consistente com o segredo usado na
  // validação de assinatura do POST abaixo (mesmo valor,
  // WHATSAPP_WEBHOOK_SECRET, serve para os dois propósitos).
  const expectedToken = process.env.WHATSAPP_WEBHOOK_SECRET;

  if (expectedToken && mode === 'subscribe' && token === expectedToken) {
    return new NextResponse(challenge || 'ok', { status: 200 });
  }

  return NextResponse.json({
    status: 'online',
    endpoint: '/api/chat/webhook-wpp',
    engine: 'whatsapp-web.js / Webhook Bridge',
    description: 'Webhook para recepção e processamento de mensagens recebidas via WhatsApp',
  });
}

export async function POST(req: NextRequest) {
  try {
    // Correção de auditoria (prioridade alta #5): o corpo é lido como
    // texto bruto ANTES de qualquer parsing — a validação de assinatura
    // HMAC (formato Meta) precisa do texto exato recebido; fazer
    // JSON.parse e depois reserializar poderia mudar espaçamento/ordem
    // de chaves e invalidar uma assinatura correta.
    const rawBody = await req.text();

    const isVerified = verifyWhatsAppWebhookRequest(rawBody, {
      metaSignature: req.headers.get('x-hub-signature-256'),
      sharedSecret: req.headers.get('x-webhook-secret'),
    });

    if (!isVerified) {
      console.warn('[Webhook WhatsApp] Requisição rejeitada — assinatura/segredo ausente ou inválido.');
      return NextResponse.json(
        { error: 'Assinatura ou segredo de webhook ausente ou inválido.' },
        { status: 401 }
      );
    }

    const body = JSON.parse(rawBody);
    const db = getDatabase();

    // Extrair dados flexivelmente (suporta formato direto, whatsapp-web.js event, ou Meta Cloud API)
    let fromPhone = '';
    let senderName = '';
    let messageText = '';
    let clinicId = db.clinics[0]?.id || 'clinic_cardiovida_01';

    if (body.from && body.text) {
      // Formato direto / whatsapp-web.js bridge
      fromPhone = String(body.from).replace(/@c\.us$/, '');
      senderName = body.pushname || body.name || `Paciente WhatsApp (${fromPhone.slice(-4)})`;
      messageText = String(body.text);
      if (body.clinicId) clinicId = body.clinicId;
    } else if (body.entry && body.entry[0]?.changes && body.entry[0]?.changes[0]?.value?.messages) {
      // Formato Meta Cloud API
      const msgObj = body.entry[0].changes[0].value.messages[0];
      const contactObj = body.entry[0].changes[0].value.contacts?.[0];
      fromPhone = msgObj.from;
      senderName = contactObj?.profile?.name || `Paciente (${fromPhone.slice(-4)})`;
      messageText = msgObj.text?.body || '[Mídia recebida]';
    } else if (body.message && body.message.body) {
      // Formato Baileys / WPPConnect
      fromPhone = String(body.message.from || '').replace(/@c\.us$/, '');
      senderName = body.message.pushName || 'Paciente';
      messageText = String(body.message.body);
    } else {
      return NextResponse.json(
        { error: 'Formato de payload de mensagem inválido. Envie { from, text, pushname }' },
        { status: 400 }
      );
    }

    if (!fromPhone || !messageText.trim()) {
      return NextResponse.json({ error: 'Número de origem (from) e texto da mensagem são obrigatórios.' }, { status: 400 });
    }

    const cleanFrom = normalizePhone(fromPhone);

    // 1. Procurar paciente existente pelo telefone
    let patient = db.patients.find(
      (p) => p.clinicId === clinicId && normalizePhone(p.phone).endsWith(cleanFrom.slice(-8))
    );

    // 2. Se o paciente não existir, criar automaticamente no funil de entrada
    if (!patient) {
      const formattedPhone = cleanFrom.length >= 10
        ? cleanFrom.length === 11
          ? `(${cleanFrom.slice(0, 2)}) ${cleanFrom.slice(2, 7)}-${cleanFrom.slice(7)}`
          : cleanFrom.length === 13 && cleanFrom.startsWith('55')
          ? `(${cleanFrom.slice(2, 4)}) ${cleanFrom.slice(4, 9)}-${cleanFrom.slice(9)}`
          : `+${cleanFrom}`
        : `+${cleanFrom}`;

      const newPatientId = `pat_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      patient = {
        id: newPatientId,
        clinicId,
        name: senderName,
        phone: formattedPhone,
        cpf: 'Aguardando cadastro',
        birthDate: '1990-01-01',
        healthInsurance: 'Aguardando confirmação',
        planNumber: 'WPP-PENDENTE',
        specialty: 'Triagem Geral / WhatsApp',
        funnelStage: 'novo',
        funnelId: 'funnel_principal',
        urgency: 'media',
        checklist: { doc_enviado: false, convenio_validado: false, termo_assinado: false },
        notes: `Contato iniciado via WhatsApp Web.js (${fromPhone})`,
        tags: ['#WhatsApp', '#NovoPaciente'],
        lastInteractionAt: new Date().toISOString(),
        originChannel: 'whatsapp',
        sentiment: 'neutro',
        leadScore: 60,
        requiresHumanReview: false,
        aiSummary: 'Paciente enviou mensagem via WhatsApp. Aguardando triagem clínica.',
      };

      db.patients.unshift(patient);
    }

    // 3. Registrar a mensagem do paciente no banco de dados
    const incomingMessage: ChatMessage = {
      id: `msg_wpp_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      clinicId,
      patientId: patient.id,
      sender: 'patient',
      senderName: patient.name,
      text: messageText,
      isInternalNote: false,
      timestamp: new Date().toISOString(),
      channel: 'whatsapp',
    };

    db.chatMessages.push(incomingMessage);
    patient.lastInteractionAt = incomingMessage.timestamp;

    // 4. Executar Triagem de Urgência por IA (Manchester) no contexto da mensagem
    let triageResult = null;
    try {
      triageResult = await routeClinicalTriage(messageText, {
        name: patient.name,
        healthInsurance: patient.healthInsurance,
        birthDate: patient.birthDate,
      });
      patient.urgency = triageResult.urgency;
      patient.sentiment =
        triageResult.urgency === 'critica' || triageResult.urgency === 'alta'
          ? 'urgente'
          : 'neutro';
      patient.aiSummary = `Triagem Manchester: ${triageResult.suggestedProtocol} (${triageResult.manchesterCategory}). ${triageResult.reasoning}`;
      if (triageResult.requiresHumanReview) {
        patient.requiresHumanReview = true;
      }
    } catch (triageErr) {
      console.warn('Triagem assíncrona falhou ou usou fallback:', triageErr);
    }

    // 5. Se o bot ou regras automáticas estiverem ativas, gerar resposta automática de boas-vindas / triagem
    const autoReplyText =
      triageResult?.suggestedAttendantResponse ||
      `Olá, ${patient.name.split(' ')[0]}! Recebemos sua mensagem na CardioVida. Nossa equipe médica e de triagem já foi notificada e retornará em instantes.`;

    const botReplyMessage: ChatMessage = {
      id: `msg_bot_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      clinicId,
      patientId: patient.id,
      sender: 'attendant',
      senderName: 'CardioBot (Assistente IA)',
      text: autoReplyText,
      isInternalNote: false,
      timestamp: new Date(Date.now() + 1000).toISOString(),
      channel: 'whatsapp',
    };

    db.chatMessages.push(botReplyMessage);

    // 6. Auditoria LGPD do evento de mensagem recebida
    db.auditLogs.unshift({
      id: `aud_${Date.now()}`,
      clinicId,
      action: 'WHATSAPP_MESSAGE_RECEIVED',
      target: `Paciente: ${patient.name} (${patient.phone})`,
      authorEmail: 'whatsapp-web.js-service@cardiovida.internal',
      authorRole: 'admin',
      ip: req.headers.get('x-forwarded-for') || '127.0.0.1',
      timestamp: new Date().toISOString(),
      details: {
        from: fromPhone,
        textPreview: messageText.substring(0, 50),
        urgency: patient.urgency,
      },
      lgpdCategory: 'consentimento',
    });

    return NextResponse.json({
      success: true,
      message: 'Mensagem recebida e processada com sucesso no sistema.',
      patientId: patient.id,
      patientName: patient.name,
      incomingMessage,
      botReplyMessage,
      triage: triageResult || null,
    });
  } catch (err: any) {
    console.error('Erro no webhook do WhatsApp:', err);
    return NextResponse.json({ error: err.message || 'Falha ao processar mensagem do WhatsApp' }, { status: 500 });
  }
}
