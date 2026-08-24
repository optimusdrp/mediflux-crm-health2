import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, checkTabPermission } from "@/lib/server/authHelper";
import { startSession, stopSession, getSessionStatus } from "@/lib/whatsapp/sessionManager";

// ---------------------------------------------------------------------------
// Conexão real com WhatsApp (lib/whatsapp/sessionManager.ts). Mesma
// proteção de acesso da tela de Configurações — conectar/desconectar
// equivale a dar ou revogar o controle do número de WhatsApp real da
// clínica, uma ação tão sensível quanto editar credenciais de integração
// de EHR (ver app/api/ehr/route.ts).
// ---------------------------------------------------------------------------

async function requireConfigAccess(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (!auth.authenticated || !auth.user) {
    return { ok: false as const, response: NextResponse.json({ error: auth.error || "Não autorizado" }, { status: auth.status || 401 }) };
  }
  if (!checkTabPermission(auth.user.clinicId, auth.user.role, "configuracoes")) {
    return { ok: false as const, response: NextResponse.json({ error: "Sem permissão para acessar Configurações." }, { status: 403 }) };
  }
  return { ok: true as const, user: auth.user };
}

// Inicia a conexão — sobe o Chromium headless e começa a gerar o QR
// code (authMethod "qr", padrão) ou o código de pareamento por telefone
// (authMethod "phone_number", exige phoneNumber no corpo). Devolve
// imediatamente com status "initializing"; o front-end consulta GET em
// polling até o QR/código aparecer (ou a conexão completar, se já havia
// uma sessão salva válida).
export async function POST(req: NextRequest) {
  const check = await requireConfigAccess(req);
  if (!check.ok) return check.response;

  let authMethod: "qr" | "phone_number" = "qr";
  let phoneNumber: string | undefined;
  try {
    const body = await req.json().catch(() => ({}));
    if (body?.authMethod === "phone_number") {
      authMethod = "phone_number";
      // Só dígitos, formato internacional (código do país + DDD +
      // número, sem símbolos) — o mesmo formato que requestPairingCode
      // do whatsapp-web.js espera.
      const digitsOnly = String(body.phoneNumber || "").replace(/\D/g, "");
      if (digitsOnly.length < 10) {
        return NextResponse.json(
          { error: "Número de telefone inválido — informe com código do país e DDD, só dígitos (ex.: 5511987654321)." },
          { status: 400 }
        );
      }
      phoneNumber = digitsOnly;
    }
  } catch {
    // Corpo ausente ou inválido — mantém o padrão (QR code), mesmo
    // comportamento de antes desta mudança.
  }

  try {
    const entry = await startSession(check.user.clinicId, { authMethod, phoneNumber });
    return NextResponse.json({ status: entry.status, qrDataUrl: entry.qrDataUrl, pairingCode: entry.pairingCode });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Erro ao iniciar conexão com o WhatsApp." }, { status: 500 });
  }
}

// Consulta de status — o front-end faz polling neste endpoint durante o
// fluxo de conexão (QR/código pendente → sincronizando histórico →
// conectado).
export async function GET(req: NextRequest) {
  const check = await requireConfigAccess(req);
  if (!check.ok) return check.response;

  const status = getSessionStatus(check.user.clinicId);
  return NextResponse.json(status);
}

// Encerra a conexão — desloga de verdade (não é só "parar de usar"), a
// próxima conexão exige escanear um QR code novo.
export async function DELETE(req: NextRequest) {
  const check = await requireConfigAccess(req);
  if (!check.ok) return check.response;

  try {
    await stopSession(check.user.clinicId);
    return NextResponse.json({ status: "disconnected" });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Erro ao desconectar o WhatsApp." }, { status: 500 });
  }
}
