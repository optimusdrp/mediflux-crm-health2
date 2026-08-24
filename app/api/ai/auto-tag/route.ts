import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db/store';
import { authenticateRequest, checkFeatureAddon } from '@/lib/server/authHelper';
import { routeAutoTag } from '@/lib/ai/router';

export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.error || 'Não autorizado' }, { status: auth.status || 401 });
  }

  const clinicId = auth.user.clinicId;

  // Feature Gating
  if (!checkFeatureAddon(clinicId, 'classificacao_automatica')) {
    return NextResponse.json(
      {
        error: 'Add-on de Classificação Automática (Auto-Tagging) não contratado.',
        feature: 'classificacao_automatica',
        blocked: true,
      },
      { status: 403 }
    );
  }

  try {
    const { messages, patientId } = await req.json();

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'Array de mensagens é obrigatório.' }, { status: 400 });
    }

    const tagResult = await routeAutoTag(messages);

    const db = getDatabase();
    db.getSubscription(clinicId).aiCallsCount += 1;

    let patient;
    if (patientId) {
      patient = db.getPatientById(patientId, clinicId);
      if (patient) {
        const mergedTags = Array.from(new Set([...patient.tags, ...tagResult.tags]));
        patient.tags = mergedTags;
        if (tagResult.specialtySuggested && patient.specialty === 'Clínica Geral') {
          patient.specialty = tagResult.specialtySuggested;
        }
      }
    }

    return NextResponse.json({ result: tagResult, patient });
  } catch (err) {
    console.error('Erro no auto-tagging:', err);
    return NextResponse.json({ error: 'Falha ao gerar tags automáticas.' }, { status: 500 });
  }
}
