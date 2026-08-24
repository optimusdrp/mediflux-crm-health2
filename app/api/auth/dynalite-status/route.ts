import { NextRequest, NextResponse } from 'next/server';
import { getDynaliteStatus, listDynaliteUsers } from '@/lib/db/dynalite';
import { authenticateRequest } from '@/lib/server/authHelper';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  // Achado adicional de auditoria (revisão de continuidade): esta rota
  // de diagnóstico não exigia autenticação e devolvia e-mail, nome,
  // role e clinicId de todos os usuários cadastrados via Dynalite, sem
  // nenhuma credencial. Corrigido exigindo o mesmo requireAuth que as
  // demais rotas do projeto.
  const auth = await authenticateRequest(req);
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.error || 'Não autorizado' }, { status: auth.status || 401 });
  }

  try {
    const status = await getDynaliteStatus();
    const users = await listDynaliteUsers();

    // Map users without sensitive password hashes
    const sanitizedUsers = users.map((u) => ({
      email: u.email,
      name: u.name,
      role: u.role,
      clinicId: u.clinicId,
      specialty: u.specialty,
      active: u.active,
      registeredAt: u.registeredAt,
      lastLoginAt: u.lastLoginAt,
      authSource: u.authSource,
    }));

    return NextResponse.json({
      status,
      totalRegisteredUsers: sanitizedUsers.length,
      users: sanitizedUsers,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Erro ao consultar status do Dynalite: ' + err.message },
      { status: 500 }
    );
  }
}
