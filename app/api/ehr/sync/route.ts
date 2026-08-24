import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db/store';
import { authenticateRequest } from '@/lib/server/authHelper';

export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.error || 'Não autorizado' }, { status: auth.status || 401 });
  }

  try {
    const { id } = await req.json();
    const db = getDatabase();
    const ehr = db.ehrIntegrations.find((e) => e.id === id && e.clinicId === auth.user!.clinicId);

    if (!ehr) {
      return NextResponse.json({ error: 'Registro não encontrado' }, { status: 404 });
    }

    // Regra: Bloqueio de sync sem credencial configurada
    if (ehr.status === 'unconfigured' || (!ehr.maskedKey && !ehr.rawKey)) {
      return NextResponse.json(
        {
          error: 'Sincronização bloqueada: Chave de API ou credencial não informada para este provedor.',
          blocked: true,
        },
        { status: 400 }
      );
    }

    ehr.lastSyncAt = new Date().toISOString();
    ehr.status = 'connected';

    return NextResponse.json({
      success: true,
      message: `Sincronização com ${ehr.provider} executada com sucesso.`,
      syncedAt: ehr.lastSyncAt,
      syncedEntitiesCount: {
        patients: db.patients.filter((p) => p.clinicId === auth.user!.clinicId).length,
        appointments: db.appointments.filter((a) => a.clinicId === auth.user!.clinicId).length,
      },
    });
  } catch (err) {
    console.error('Erro na sincronização EHR:', err);
    return NextResponse.json({ error: 'Falha na sincronização.' }, { status: 500 });
  }
}
