import { NextRequest, NextResponse } from 'next/server';

// URL real do backend (API Gateway -> Lambda mediflux-core-api).
// Login sempre deveria ter usado isso, como o restante do sistema —
// esta rota antes chamava uma camada de Firestore abandonada há
// muito tempo (ver histórico do repositório), que passou a retornar
// 500 e travava o acesso de qualquer usuário. Correção: repassa a
// requisição tal como recebida para o backend real e devolve a
// resposta dele sem alterar nada.
const BACKEND_URL = 'https://qdluxmo7p4.execute-api.us-east-1.amazonaws.com/auth/login';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();

    const backendResponse = await fetch(BACKEND_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });

    const responseText = await backendResponse.text();

    return new NextResponse(responseText, {
      status: backendResponse.status,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  } catch (err: any) {
    console.error('Erro ao repassar login para o backend real:', err);
    return NextResponse.json(
      { error: 'Falha na comunicação com o servidor de autenticação.' },
      { status: 502 }
    );
  }
}
