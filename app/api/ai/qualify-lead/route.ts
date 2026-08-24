import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db/store';
import { authenticateRequest, checkFeatureAddon } from '@/lib/server/authHelper';
import { routeQualifyLead } from '@/lib/ai/router';

export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.error || 'Não autorizado' }, { status: auth.status || 401 });
  }

  const clinicId = auth.user.clinicId;

  // Feature Gating
  if (!checkFeatureAddon(clinicId, 'qualificacao_lead')) {
    return NextResponse.json(
      {
        error: 'Add-on de Qualificação de Leads não contratado.',
        feature: 'qualificacao_lead',
        blocked: true,
      },
      { status: 403 }
    );
  }

  try {
    const { patientId } = await req.json();

    if (!patientId) {
      return NextResponse.json({ error: 'patientId é obrigatório.' }, { status: 400 });
    }

    const db = getDatabase();
    const patient = db.getPatientById(patientId, clinicId);
    if (!patient) {
      return NextResponse.json({ error: 'Registro não encontrado' }, { status: 404 });
    }

    const messages = db.chatMessages
      .filter((m) => m.patientId === patientId && m.clinicId === clinicId)
      .map((m) => `${m.sender}: ${m.text}`);

    const result = await routeQualifyLead(
      { name: patient.name, healthInsurance: patient.healthInsurance, specialty: patient.specialty },
      messages.length > 0 ? messages : [patient.notes || 'Sem mensagens']
    );

    db.getSubscription(clinicId).aiCallsCount += 1;
    patient.leadScore = result.score;

    return NextResponse.json({ result, patient });
  } catch (err) {
    console.error('Erro na qualificação do lead:', err);
    return NextResponse.json({ error: 'Falha ao qualificar lead.' }, { status: 500 });
  }
}
