import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db/store';
import { authenticateRequest } from '@/lib/server/authHelper';
import { filterAllowedFields, PATIENT_ALLOWED_CREATE_FIELDS } from '@/lib/security/fieldWhitelists';
import { Patient } from '@/lib/types';

export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.error || 'Não autorizado' }, { status: auth.status || 401 });
  }

  const { searchParams } = new URL(req.url);
  const search = searchParams.get('search')?.toLowerCase() || '';
  const specialty = searchParams.get('specialty');
  const stage = searchParams.get('stage');
  const urgency = searchParams.get('urgency');

  const db = getDatabase();
  let list = db.patients.filter((p) => p.clinicId === auth.user!.clinicId);

  if (search) {
    list = list.filter(
      (p) =>
        p.name.toLowerCase().includes(search) ||
        p.phone.includes(search) ||
        p.cpf.includes(search) ||
        p.healthInsurance.toLowerCase().includes(search)
    );
  }

  if (specialty && specialty !== 'todas') {
    list = list.filter((p) => p.specialty.toLowerCase() === specialty.toLowerCase());
  }

  if (stage && stage !== 'todos') {
    list = list.filter((p) => p.funnelStage === stage);
  }

  if (urgency && urgency !== 'todas') {
    list = list.filter((p) => p.urgency === urgency);
  }

  // Ordena por data da última interação decrescente para que conversas recentes do WhatsApp fiquem no topo
  list.sort((a, b) => new Date(b.lastInteractionAt || 0).getTime() - new Date(a.lastInteractionAt || 0).getTime());

  return NextResponse.json({ patients: list });
}

export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.error || 'Não autorizado' }, { status: auth.status || 401 });
  }

  try {
    const rawBody = await req.json();
    const cleanFields = filterAllowedFields<Patient>(rawBody, PATIENT_ALLOWED_CREATE_FIELDS);

    if (!cleanFields.name || !cleanFields.phone) {
      return NextResponse.json(
        { error: 'Nome e telefone são campos obrigatórios para o cadastro.' },
        { status: 400 }
      );
    }

    const db = getDatabase();
    const clinicId = auth.user.clinicId;
    const sub = db.getSubscription(clinicId);

    // Contabiliza atendimento novo no plano da clínica
    sub.currentPeriodAppointments += 1;
    const isOverLimit = sub.currentPeriodAppointments > sub.maxAppointmentsPerMonth;

    const newPatient: Patient = {
      id: `pat_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      clinicId,
      name: cleanFields.name,
      phone: cleanFields.phone,
      cpf: cleanFields.cpf || '',
      birthDate: cleanFields.birthDate || '',
      healthInsurance: cleanFields.healthInsurance || 'Particular',
      planNumber: cleanFields.planNumber || '',
      specialty: cleanFields.specialty || 'Clínica Geral',
      funnelStage: cleanFields.funnelStage || 'novo',
      funnelId: cleanFields.funnelId || 'funnel_principal',
      urgency: cleanFields.urgency || 'media',
      checklist: cleanFields.checklist || { doc_enviado: false, convenio_validado: false, termo_assinado: false },
      notes: cleanFields.notes || '',
      tags: cleanFields.tags || ['#NovoPaciente'],
      lastInteractionAt: new Date().toISOString(),
      originChannel: cleanFields.originChannel || 'whatsapp',
      assignedUserId: cleanFields.assignedUserId || auth.user.id,
      requiresHumanReview: false,
    };

    db.patients.unshift(newPatient);

    // Registra log imutável de auditoria
    db.auditLogs.unshift({
      id: `aud_${Date.now()}`,
      clinicId,
      action: 'CRIACAO_PACIENTE',
      target: `${newPatient.id} (${newPatient.name})`,
      authorEmail: auth.user.email,
      authorRole: auth.user.role,
      ip: req.headers.get('x-forwarded-for') || '127.0.0.1',
      timestamp: new Date().toISOString(),
      details: { name: newPatient.name, originChannel: newPatient.originChannel },
      lgpdCategory: 'alteracao_cadastral',
    });

    return NextResponse.json({
      patient: newPatient,
      usageWarning: {
        overLimit: isOverLimit,
        currentCount: sub.currentPeriodAppointments,
        maxAllowed: sub.maxAppointmentsPerMonth,
      },
    });
  } catch (err) {
    console.error('Erro na criação de paciente:', err);
    return NextResponse.json({ error: 'Erro ao criar paciente.' }, { status: 500 });
  }
}
