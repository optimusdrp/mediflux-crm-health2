import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db/store';
import { authenticateRequest } from '@/lib/server/authHelper';
import { ChatMessage } from '@/lib/types';
import { sendWhatsAppMessage, WhatsAppSendError } from '@/lib/whatsapp/messageSender';

export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.error || 'Não autorizado' }, { status: auth.status || 401 });
  }

  const { searchParams } = new URL(req.url);
  const patientId = searchParams.get('patientId');

  if (!patientId) {
    return NextResponse.json({ error: 'Parâmetro patientId é obrigatório' }, { status: 400 });
  }

  const db = getDatabase();
  // Validação anti-IDOR: O paciente pertence à clínica do usuário?
  const patient = db.getPatientById(patientId, auth.user.clinicId);
  if (!patient) {
    return NextResponse.json({ error: 'Registro não encontrado' }, { status: 404 });
  }

  const messages = db.chatMessages
    .filter((m) => m.patientId === patientId && m.clinicId === auth.user!.clinicId)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  return NextResponse.json({ messages });
}

export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.error || 'Não autorizado' }, { status: auth.status || 401 });
  }

  try {
    const { patientId, text, isInternalNote, sender, channel } = await req.json();

    if (!patientId || !text) {
      return NextResponse.json(
        { error: 'patientId e text são campos obrigatórios.' },
        { status: 400 }
      );
    }

    const db = getDatabase();
    const patient = db.getPatientById(patientId, auth.user.clinicId);
    if (!patient) {
      return NextResponse.json({ error: 'Registro não encontrado' }, { status: 404 });
    }

    const newMessage: ChatMessage = {
      id: `msg_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      clinicId: auth.user.clinicId,
      patientId,
      sender: sender || (isInternalNote ? 'attendant' : 'attendant'),
      senderName: auth.user.name,
      text,
      isInternalNote: !!isInternalNote,
      timestamp: new Date().toISOString(),
      channel: channel || patient.originChannel,
    };

    db.chatMessages.push(newMessage);
    patient.lastInteractionAt = newMessage.timestamp;

    // Se for mensagem externa para o paciente via WhatsApp, auditar LGPD
    if (!isInternalNote) {
      db.auditLogs.unshift({
        id: `aud_${Date.now()}`,
        clinicId: auth.user.clinicId,
        action: 'CHAT_MESSAGE_SENT',
        target: `Paciente: ${patient.name} (${patient.phone}) via ${newMessage.channel}`,
        authorEmail: auth.user.email,
        authorRole: auth.user.role,
        ip: req.headers.get('x-forwarded-for') || '127.0.0.1',
        timestamp: new Date().toISOString(),
        details: { patientId, textPreview: text.substring(0, 40) },
        lgpdCategory: 'consentimento',
      });
    }

    // Envio real via WhatsApp — só quando o canal é WhatsApp e não é
    // uma nota interna (que nunca sai do MediFlux). A mensagem já foi
    // gravada acima independente do resultado deste envio: se a sessão
    // não estiver conectada ou o envio falhar, o atendente não perde o
    // texto que digitou, mas a resposta da API sinaliza claramente que
    // a entrega real não aconteceu — ver whatsappDeliveryError abaixo.
    let whatsappDeliveryError: string | undefined;
    if (!isInternalNote && newMessage.channel === 'whatsapp') {
      try {
        await sendWhatsAppMessage(auth.user.clinicId, patient.phone, text);
      } catch (err) {
        whatsappDeliveryError =
          err instanceof WhatsAppSendError ? err.message : 'Falha inesperada ao enviar a mensagem pelo WhatsApp.';
        console.error(`[WhatsApp Send] Falha ao entregar mensagem ao paciente ${patient.id}:`, err);
      }
    }

    return NextResponse.json({ message: newMessage, whatsappDeliveryError });
  } catch (err) {
    console.error('Erro ao enviar mensagem:', err);
    return NextResponse.json({ error: 'Falha ao gravar mensagem.' }, { status: 500 });
  }
}
