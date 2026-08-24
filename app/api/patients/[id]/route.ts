import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db/store';
import { authenticateRequest, checkActionPermission } from '@/lib/server/authHelper';
import { filterAllowedFields, PATIENT_ALLOWED_UPDATE_FIELDS } from '@/lib/security/fieldWhitelists';
import { Patient } from '@/lib/types';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(req);
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.error || 'Não autorizado' }, { status: auth.status || 401 });
  }

  const { id } = await params;
  const db = getDatabase();
  // Anti-IDOR: Se não pertencer à clínica, retorna invariavelmente HTTP 404 genérico
  const patient = db.getPatientById(id, auth.user.clinicId);

  if (!patient) {
    return NextResponse.json({ error: 'Registro não encontrado' }, { status: 404 });
  }

  return NextResponse.json({ patient });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(req);
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.error || 'Não autorizado' }, { status: auth.status || 401 });
  }

  const { id } = await params;
  const db = getDatabase();
  const patient = db.getPatientById(id, auth.user.clinicId);

  if (!patient) {
    return NextResponse.json({ error: 'Registro não encontrado' }, { status: 404 });
  }

  try {
    const rawBody = await req.json();
    const cleanFields = filterAllowedFields<Patient>(rawBody, PATIENT_ALLOWED_UPDATE_FIELDS);

    // Aplica alterações mantendo a integridade multi-tenant
    Object.assign(patient, cleanFields);
    patient.lastInteractionAt = new Date().toISOString();

    // Log de auditoria
    db.auditLogs.unshift({
      id: `aud_${Date.now()}`,
      clinicId: auth.user.clinicId,
      action: 'ATUALIZACAO_PACIENTE',
      target: `${patient.id} (${patient.name})`,
      authorEmail: auth.user.email,
      authorRole: auth.user.role,
      ip: req.headers.get('x-forwarded-for') || '127.0.0.1',
      timestamp: new Date().toISOString(),
      details: { updatedFields: Object.keys(cleanFields) },
      lgpdCategory: 'alteracao_cadastral',
    });

    return NextResponse.json({ patient });
  } catch (err) {
    console.error('Erro na atualização do paciente:', err);
    return NextResponse.json({ error: 'Erro ao atualizar dados.' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(req);
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.error || 'Não autorizado' }, { status: auth.status || 401 });
  }

  const { id } = await params;
  const db = getDatabase();
  const patient = db.getPatientById(id, auth.user.clinicId);

  if (!patient) {
    return NextResponse.json({ error: 'Registro não encontrado' }, { status: 404 });
  }

  // Validação da ação sensível 'excluir_paciente'
  const canDelete =
    auth.user.role === 'admin' ||
    checkActionPermission(auth.user.clinicId, auth.user.role, 'excluir_paciente');

  if (!canDelete) {
    return NextResponse.json(
      { error: 'Permissão insuficiente para executar a exclusão definitiva do paciente.' },
      { status: 403 }
    );
  }

  // Remove paciente e logs relacionados
  db.patients = db.patients.filter((p) => p.id !== id);

  db.auditLogs.unshift({
    id: `aud_${Date.now()}`,
    clinicId: auth.user.clinicId,
    action: 'EXCLUSAO_PACIENTE',
    target: `${id} (${patient.name})`,
    authorEmail: auth.user.email,
    authorRole: auth.user.role,
    ip: req.headers.get('x-forwarded-for') || '127.0.0.1',
    timestamp: new Date().toISOString(),
    lgpdCategory: 'exclusao',
  });

  return NextResponse.json({ success: true, message: 'Paciente excluído com sucesso.' });
}
