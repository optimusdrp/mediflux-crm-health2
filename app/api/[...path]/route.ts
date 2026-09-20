import { NextRequest, NextResponse } from 'next/server';

/**
 * Proxy genérico — repassa QUALQUER chamada /api/* (que não tenha uma
 * rota Next.js mais específica) direto para o backend real (API
 * Gateway -> Lambda mediflux-core-api). Substitui, de uma vez, todas
 * as rotas locais antigas que dependiam de Firestore ou de uma
 * variável em memória do processo Next.js (ambos abandonados há
 * muito tempo, mas nunca removidos — cada deploy reinicia essa
 * memória e derruba qualquer rota que ainda dependesse dela).
 *
 * O caminho é reconstruído a partir do segmento catch-all: uma
 * chamada do front-end para /api/patients vira uma chamada real para
 * {BACKEND_URL}/patients; /api/patients/abc123 vira
 * {BACKEND_URL}/patients/abc123; query string é preservada.
 */
const BACKEND_URL = 'https://qdluxmo7p4.execute-api.us-east-1.amazonaws.com';

export const dynamic = 'force-dynamic';

async function proxyRequest(req: NextRequest, params: { path: string[] }) {
  const targetPath = params.path.join('/');
  const targetUrl = `${BACKEND_URL}/${targetPath}${req.nextUrl.search}`;

  const headers = new Headers();
  const authorization = req.headers.get('authorization');
  if (authorization) headers.set('Authorization', authorization);
  const contentType = req.headers.get('content-type');
  if (contentType) headers.set('Content-Type', contentType);

  const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
  const body = hasBody ? await req.text() : undefined;

  try {
    const backendResponse = await fetch(targetUrl, {
      method: req.method,
      headers,
      body,
    });

    const responseText = await backendResponse.text();
    const responseContentType = backendResponse.headers.get('content-type') || 'application/json; charset=utf-8';

    return new NextResponse(responseText, {
      status: backendResponse.status,
      headers: { 'Content-Type': responseContentType },
    });
  } catch (err: any) {
    console.error(`Erro ao repassar ${req.method} /${targetPath} para o backend real:`, err);
    return NextResponse.json(
      { error: 'Falha na comunicação com o servidor.' },
      { status: 502 }
    );
  }
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return proxyRequest(req, await ctx.params);
}
export async function POST(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return proxyRequest(req, await ctx.params);
}
export async function PUT(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return proxyRequest(req, await ctx.params);
}
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return proxyRequest(req, await ctx.params);
}
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return proxyRequest(req, await ctx.params);
}
