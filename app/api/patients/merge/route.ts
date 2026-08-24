import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db/store';
import { authenticateRequest, checkActionPermission } from '@/lib/server/authHelper';

export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.error || 'Não autorizado' }, { status: auth.status || 401 });
  }

  // Verifica permissão sensível 'unificar_duplicados'
  const canMerge =
    auth.user.role === 'admin' ||
    checkActionPermission(auth.user.clinicId, auth.user.role, 'unificar_duplicados');

  if (!canMerge) {
    return NextResponse.json(
      { error: 'Você não possui permissão para unificar registros duplicados.' },
      { status: 403 }
    );
  }

  try {
    const { primaryId, secondaryId } = await req.json();

    if (!primaryId || !secondaryId || primaryId === secondaryId) {
      return NextResponse.json(
        { error: 'IDs de paciente inválidos para unificação.' },
        { status: 400 }
      );
    }

    const db = getDatabase();
    const result = db.mergePatients(
      primaryId,
      secondaryId,
      auth.user.clinicId,
      auth.user.email,
      auth.user.role
    );

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Registro não encontrado' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: 'Registros de paciente unificados com sucesso.',
      patient: result.primaryPatient,
    });
  } catch (err) {
    console.error('Erro na unificação de pacientes:', err);
    return NextResponse.json({ error: 'Falha ao processar unificação.' }, { status: 500 });
  }
}
