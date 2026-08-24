import { NextRequest, NextResponse } from 'next/server';
import { updateTrialSimulation } from '@/lib/db/firestore';
import { authenticateRequest } from '@/lib/server/authHelper';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  // Achado adicional de auditoria (revisão de continuidade): esta rota
  // não exigia autenticação — sem token, usava um e-mail padrão fixo
  // ('optimusdrp@gmail.com'), e o e-mail-alvo também podia vir
  // livremente do corpo da requisição (body.email), sem nenhuma
  // verificação de posse. Qualquer requisição não autenticada podia
  // forçar o status de trial de QUALQUER conta do sistema. Corrigido
  // exigindo autenticação e restringindo a simulação à própria conta do
  // usuário autenticado — nunca a um e-mail arbitrário do corpo da
  // requisição.
  const auth = await authenticateRequest(req);
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.error || 'Não autorizado' }, { status: auth.status || 401 });
  }

  try {
    const body = await req.json();
    const mode = body.mode || 'expiring_soon_36h';
    const email = auth.user.email;

    const result = await updateTrialSimulation({
      email,
      mode,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.message }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      trialStatus: result.trialStatus,
      message: result.message,
    });
  } catch (error: any) {
    console.error('Erro ao simular estado do Trial:', error);
    return NextResponse.json(
      { error: 'Erro ao processar simulação: ' + (error.message || '') },
      { status: 500 }
    );
  }
}
