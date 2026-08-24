import { NextRequest, NextResponse } from 'next/server';
import { getFirestoreUsers, seedFirestoreDatabase } from '@/lib/db/firestore';
import { authenticateRequest } from '@/lib/server/authHelper';
import firebaseConfig from '@/firebase-applet-config.json';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  // Achado adicional de auditoria (revisão de continuidade): mesmo
  // problema de /api/auth/dynalite-status — rota de diagnóstico sem
  // autenticação, devolvendo dados de todos os usuários do sistema.
  const auth = await authenticateRequest(req);
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.error || 'Não autorizado' }, { status: auth.status || 401 });
  }

  try {
    await seedFirestoreDatabase();
    const users = await getFirestoreUsers();

    // Map users without sensitive password hashes
    const sanitizedUsers = users.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      clinicId: u.clinicId,
      crm: u.crm,
      specialty: u.specialty,
      active: u.active,
      registeredAt: u.registeredAt,
      lastLoginAt: u.lastLoginAt,
      authSource: u.authSource,
    }));

    return NextResponse.json({
      status: {
        connected: true,
        projectId: firebaseConfig.projectId,
        databaseId: firebaseConfig.firestoreDatabaseId || '(default)',
        collection: 'users',
        provider: 'Google Cloud Firestore',
      },
      totalRegisteredUsers: sanitizedUsers.length,
      users: sanitizedUsers,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Erro ao consultar status do Firestore: ' + err.message },
      { status: 500 }
    );
  }
}
