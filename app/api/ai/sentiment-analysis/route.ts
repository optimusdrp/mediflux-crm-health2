import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db/store';
import { authenticateRequest, checkFeatureAddon } from '@/lib/server/authHelper';
import { routeSentimentAnalysis } from '@/lib/ai/router';

export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.error || 'Não autorizado' }, { status: auth.status || 401 });
  }

  const clinicId = auth.user.clinicId;

  // Feature Gating
  if (!checkFeatureAddon(clinicId, 'analise_sentimento')) {
    return NextResponse.json(
      {
        error: 'Add-on de Análise de Sentimento não contratado.',
        feature: 'analise_sentimento',
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

    const result = await routeSentimentAnalysis(
      messages.length > 0 ? messages : [patient.notes || 'Sem histórico recente']
    );

    db.getSubscription(clinicId).aiCallsCount += 1;
    patient.sentiment = result.sentiment;

    return NextResponse.json({ result, patient });
  } catch (err) {
    console.error('Erro na análise de sentimento:', err);
    return NextResponse.json({ error: 'Falha ao analisar sentimento.' }, { status: 500 });
  }
}
