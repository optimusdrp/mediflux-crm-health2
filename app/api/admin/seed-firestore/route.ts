import { NextRequest, NextResponse } from 'next/server';
import { seedFirestoreDatabase, getFirestoreUsers } from '@/lib/db/firestore';
import { authenticateRequest } from '@/lib/server/authHelper';
import firebaseConfig from '@/firebase-applet-config.json';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  // Achado adicional de auditoria (revisão de continuidade): esta rota
  // administrativa não exigia nenhuma autenticação — qualquer requisição
  // sem token disparava o seed e recebia de volta a lista completa de
  // usuários (e-mail, role, clinicId) de todas as clínicas. Corrigido
  // exigindo o mesmo requireAuth que as demais rotas administrativas do
  // projeto usam — só um usuário já autenticado (role admin) pode rodar
  // isto.
  const auth = await authenticateRequest(req);
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.error || 'Não autorizado' }, { status: auth.status || 401 });
  }
  if (auth.user.role !== 'admin') {
    return NextResponse.json({ error: 'Apenas administradores podem executar esta operação.' }, { status: 403 });
  }

  try {
    const startTime = Date.now();
    await seedFirestoreDatabase();
    const users = await getFirestoreUsers();

    const sanitizedUsers = users.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      clinicId: u.clinicId,
      crm: u.crm,
      specialty: u.specialty,
      active: u.active,
      authSource: u.authSource,
    }));

    return NextResponse.json({
      success: true,
      message: 'Banco de dados Firestore semeado com sucesso!',
      totalUsers: sanitizedUsers.length,
      users: sanitizedUsers,
      config: {
        projectId: firebaseConfig.projectId,
        databaseId: firebaseConfig.firestoreDatabaseId || '(default)',
        collection: 'users',
      },
      durationMs: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('[API /api/admin/seed-firestore] Erro ao semear:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Falha ao semear Firestore' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}
