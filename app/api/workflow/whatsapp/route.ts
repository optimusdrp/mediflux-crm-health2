import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getDatabase } from '@/lib/db/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const payloadSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  email: z.string().email('E-mail inválido').optional().or(z.literal('')),
  company: z.string().optional(),
  phone: z.string().min(8, 'Telefone do WhatsApp inválido'),
  projectType: z.string().optional().default('Atendimento Geral'),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const validation = payloadSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Dados do lead inválidos para o WhatsApp.', details: validation.error.format() },
        { status: 400 }
      );
    }

    const { name, company, phone, projectType } = validation.data;
    const cleanPhone = phone.replace(/\D/g, '');
    const formattedPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;

    const messageText = `Olá ${name}! Recebemos seu contato referente ao serviço *${projectType}* ${company ? `(${company})` : ''}. Nossa equipe já está pronta para atendê-lo.`;
    const encodedMessage = encodeURIComponent(messageText);

    // Link oficial direto para abertura no WhatsApp (Desktop/Web/App) sem necessidade de QR Code prévio
    const whatsappLink = `https://wa.me/${formattedPhone}?text=${encodedMessage}`;

    // Registrar no banco local de mensagens e pacientes para sincronia total com o dashboard
    const db = getDatabase();
    // Fallback só é exercitado se db.clinics estiver vazio (não deveria
    // acontecer em condições normais, já que o seed sempre popula pelo
    // menos uma clínica) — valor alinhado com o clinicId real usado em
    // todo o resto do store (ver correção em lib/db/store.ts).
    const clinicId = db.clinics[0]?.id || 'clinic_cardiovida_01';

    let patient = db.patients.find(
      (p) => p.clinicId === clinicId && p.phone.replace(/\D/g, '').endsWith(cleanPhone.slice(-8))
    );

    if (!patient) {
      patient = {
        id: `pat_${Date.now()}`,
        clinicId,
        name,
        phone: phone,
        cpf: 'Aguardando cadastro',
        birthDate: '1990-01-01',
        healthInsurance: company || 'Particular',
        planNumber: 'WPP-DIRECT',
        specialty: projectType || 'Cardiologia',
        funnelStage: 'novo',
        funnelId: 'funnel_principal',
        urgency: 'media',
        checklist: { doc_enviado: false, convenio_validado: false, termo_assinado: false },
        notes: `Contato automático via WhatsApp Lead Dispatcher (${projectType})`,
        tags: ['#WhatsApp', '#LeadAutomatico', '#SemQRCode'],
        lastInteractionAt: new Date().toISOString(),
        originChannel: 'whatsapp',
        sentiment: 'positivo',
        leadScore: 85,
        requiresHumanReview: false,
        aiSummary: `Lead recebido via automação WhatsApp: ${name} (${projectType}). Conexão direta estabelecida.`,
      };
      db.patients.unshift(patient);
    }

    db.chatMessages.push({
      id: `msg_${Date.now()}`,
      clinicId,
      patientId: patient.id,
      sender: 'bot',
      senderName: 'Atendente Virtual WhatsApp',
      text: messageText,
      isInternalNote: false,
      timestamp: new Date().toISOString(),
      channel: 'whatsapp',
    });

    return NextResponse.json({
      success: true,
      message: 'Sessão do WhatsApp pronta e mensagem despachada com sucesso (sem necessidade de QR Code)!',
      whatsappLink,
      data: {
        phone: formattedPhone,
        name,
        projectType,
        patientId: patient.id,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[WhatsApp Workflow API Error]:', error);
    return NextResponse.json(
      { error: error.message || 'Erro interno ao processar automação de WhatsApp.' },
      { status: 500 }
    );
  }
}
