'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { QrCode, CheckCircle2, XCircle, Loader2, Unplug, RefreshCw, ShieldAlert, History, Smartphone, KeyRound } from 'lucide-react';
import { apiService } from '@/lib/services/api';
import { useToast } from '@/contexts/ToastContext';

// ---------------------------------------------------------------------------
// Conexão REAL com WhatsApp — via Evolution API (REST), rodando na AWS
// (ECS Fargate). Migrado de whatsapp-web.js/Puppeteer (que abria um
// Chromium local e era a causa raiz da instabilidade que motivou a
// migração para essa arquitetura). O painel de simulação/demonstração
// que existia nesta tela (ligado a app/api/settings/whatsapp-web-js)
// foi removido — este é o único painel de conexão de WhatsApp da tela.
//
// Duas formas de autenticar uma conexão nova: QR code (escaneado pela
// câmera) ou código de pareamento por telefone. O backend correspondente
// é a rota /settings/whatsapp-connection da Lambda core-api, que chama
// a Evolution API diretamente (ver lib/evolutionApi.ts na Lambda).
// ---------------------------------------------------------------------------

type WaStatus = 'disconnected' | 'initializing' | 'qr_pending' | 'phone_code_pending' | 'connected' | 'auth_failed';
type WaAuthMethod = 'qr' | 'phone_number';

const POLL_INTERVAL_MS = 2000;

export const WhatsAppRealConnectionPanel: React.FC = () => {
  const { success, error: showErrorToast } = useToast();
  const [status, setStatus] = useState<WaStatus>('disconnected');
  const [qrDataUrl, setQrDataUrl] = useState<string | undefined>();
  const [pairingCode, setPairingCode] = useState<string | undefined>();
  const [connectedNumber, setConnectedNumber] = useState<string | undefined>();
  const [lastError, setLastError] = useState<string | undefined>();
  const [isActing, setIsActing] = useState(false);
  /**
   * Abre o pop-up de importação assim que a conexão passa de
   * qualquer outro estado para 'connected' pela primeira vez nesta
   * sessão da tela — nunca reabre sozinho num poll seguinte que
   * ainda esteja 'connected' (ver applyStatus, que só dispara isso
   * na transição, checando o status anterior via prevStatusRef).
   */
  const [showImportPrompt, setShowImportPrompt] = useState(false);
  const prevStatusRef = useRef<WaStatus>('disconnected');

  // Escolha de método antes de conectar — só relevante enquanto
  // "disconnected"; depois de iniciar, o método fica fixo até
  // desconectar e começar de novo.
  const [selectedMethod, setSelectedMethod] = useState<WaAuthMethod>('qr');
  const [phoneInput, setPhoneInput] = useState('');

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const applyStatus = useCallback(
    (s: {
      status: string;
      qrDataUrl?: string;
      pairingCode?: string;
      connectedNumber?: string;
      lastError?: string;
    }) => {
      setStatus(s.status as WaStatus);
      setQrDataUrl(s.qrDataUrl);
      setPairingCode(s.pairingCode);
      setConnectedNumber(s.connectedNumber);
      setLastError(s.lastError);
      // Abre o pop-up de importação só na TRANSIÇÃO para 'connected'
      // (veio de qualquer outro estado) — nunca de novo enquanto a
      // tela continua 'connected' num poll seguinte, e nunca ao
      // recarregar a página já conectada (prevStatusRef começa em
      // 'disconnected', mas o primeiro poll real após montar já teria
      // vindo de outro estado transitório antes de chegar aqui).
      if (s.status === 'connected' && prevStatusRef.current !== 'connected') {
        setShowImportPrompt(true);
      }
      prevStatusRef.current = s.status as WaStatus;
      // Só para o polling quando chega num estado final (conectado ou falha) ou volta a desconectado.
      if (s.status === 'connected' || s.status === 'auth_failed' || s.status === 'disconnected') {
        stopPolling();
      }
    },
    [stopPolling]
  );

  const fetchStatus = useCallback(async () => {
    try {
      const data = await apiService.getWhatsAppConnectionStatus();
      applyStatus(data);
    } catch {
      // Falha de rede pontual durante o polling — próxima tentativa
      // corrige sozinha, não precisa de tratamento especial aqui.
    }
  }, [applyStatus]);

  const startPolling = useCallback(() => {
    stopPolling();
    pollRef.current = setInterval(fetchStatus, POLL_INTERVAL_MS);
  }, [fetchStatus, stopPolling]);

  useEffect(() => {
    (async () => {
      await fetchStatus();
    })();
    return () => stopPolling();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (status === 'initializing' || status === 'qr_pending' || status === 'phone_code_pending') {
      startPolling();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const phoneDigitsOnly = phoneInput.replace(/\D/g, '');
  const isPhoneValid = phoneDigitsOnly.length >= 10;

  const handleConnect = async () => {
    if (selectedMethod === 'phone_number' && !isPhoneValid) {
      showErrorToast('Número inválido', 'Informe o número completo, com código do país e DDD (ex.: 55 11 98765-4321).');
      return;
    }
    setIsActing(true);
    try {
      const data = await apiService.connectWhatsApp(
        selectedMethod === 'phone_number' ? { authMethod: 'phone_number', phoneNumber: phoneDigitsOnly } : { authMethod: 'qr' }
      );
      applyStatus(data);
      startPolling();
    } catch (err: any) {
      showErrorToast('Não foi possível iniciar a conexão', err?.message || 'Tente novamente em instantes.');
    } finally {
      setIsActing(false);
    }
  };

  const handleDisconnect = async () => {
    setIsActing(true);
    try {
      await apiService.disconnectWhatsApp();
      setStatus('disconnected');
      setQrDataUrl(undefined);
      setPairingCode(undefined);
      setConnectedNumber(undefined);
      setPhoneInput('');
      prevStatusRef.current = 'disconnected';
      success('WhatsApp desconectado', 'A sessão foi encerrada. Será necessário conectar novamente (QR code ou código de pareamento) para reconectar.');
    } catch (err: any) {
      showErrorToast('Não foi possível desconectar', err?.message || 'Tente novamente em instantes.');
    } finally {
      setIsActing(false);
    }
  };

  return (
    <div className="rounded-2xl border-2 border-emerald-300 bg-white p-4 space-y-3">
      <div className="flex items-center gap-2">
        <QrCode className="w-4 h-4 text-emerald-700" />
        <p className="text-xs font-bold text-emerald-900">Conexão real com WhatsApp</p>
        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-600 text-white uppercase">Sessão de verdade</span>
      </div>
      <p className="text-[10.5px] text-slate-500">
        Diferente do painel de demonstração acima, este conecta ao WhatsApp real da clínica — as mensagens trocadas
        aqui são de pacientes de verdade.
      </p>

      {status === 'disconnected' && (
        <div className="space-y-3">
          <p className="text-[11px] text-slate-600">Escolha como conectar:</p>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setSelectedMethod('qr')}
              className={`px-3 py-2.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 border transition-colors cursor-pointer ${
                selectedMethod === 'qr'
                  ? 'bg-emerald-600 border-emerald-600 text-white'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <QrCode className="w-3.5 h-3.5" />
              QR code
            </button>
            <button
              type="button"
              onClick={() => setSelectedMethod('phone_number')}
              className={`px-3 py-2.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 border transition-colors cursor-pointer ${
                selectedMethod === 'phone_number'
                  ? 'bg-emerald-600 border-emerald-600 text-white'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <KeyRound className="w-3.5 h-3.5" />
              Código por telefone
            </button>
          </div>

          {selectedMethod === 'qr' ? (
            <p className="text-[11px] text-slate-600">
              Ao clicar em conectar, um QR code aparecerá aqui — abra o WhatsApp no celular da clínica, vá em{' '}
              <strong>Aparelhos conectados → Conectar um aparelho</strong>, e escaneie.
            </p>
          ) : (
            <div className="space-y-2">
              <p className="text-[11px] text-slate-600">
                Informe o número de WhatsApp da clínica (com código do país e DDD) — você vai receber um código de 8
                dígitos diretamente no aplicativo, sem precisar escanear nada.
              </p>
              <div className="relative">
                <Smartphone className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="tel"
                  value={phoneInput}
                  onChange={(e) => setPhoneInput(e.target.value)}
                  placeholder="55 11 98765-4321"
                  className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500"
                />
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={handleConnect}
            disabled={isActing || (selectedMethod === 'phone_number' && !isPhoneValid)}
            className="w-full px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {isActing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : selectedMethod === 'qr' ? <QrCode className="w-3.5 h-3.5" /> : <KeyRound className="w-3.5 h-3.5" />}
            {selectedMethod === 'qr' ? 'Conectar WhatsApp' : 'Gerar código de pareamento'}
          </button>
        </div>
      )}

      {(status === 'initializing' || (status === 'qr_pending' && !qrDataUrl)) && (
        <div className="flex items-center gap-2 text-[11px] text-slate-600 py-2">
          <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
          Preparando a conexão — isso pode levar alguns segundos...
        </div>
      )}

      {status === 'qr_pending' && qrDataUrl && (
        <div className="space-y-2.5">
          <p className="text-[11px] text-slate-600">
            Abra o WhatsApp no celular da clínica → <strong>Aparelhos conectados → Conectar um aparelho</strong> e
            escaneie o código abaixo:
          </p>
          <div className="bg-white rounded-xl border border-slate-200 p-3 inline-block">
            {/* eslint-disable-next-line @next/next/no-img-element -- QR code é uma data URL gerada dinamicamente (base64), não uma imagem de CDN otimizável por next/image */}
            <img src={qrDataUrl} alt="QR code para conectar o WhatsApp" className="w-48 h-48" />
          </div>
          <p className="text-[10.5px] text-slate-400">
            O código expira em alguns minutos — clique em &quot;Gerar novo código&quot; se ele parar de funcionar.
          </p>
          <button
            type="button"
            onClick={handleConnect}
            disabled={isActing}
            className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-[11px] font-semibold flex items-center gap-1.5 disabled:opacity-60 cursor-pointer"
          >
            <RefreshCw className="w-3 h-3" />
            Gerar novo código
          </button>
        </div>
      )}

      {status === 'phone_code_pending' && pairingCode && (
        <div className="space-y-2.5">
          <p className="text-[11px] text-slate-600">
            No celular da clínica, abra o WhatsApp → <strong>Aparelhos conectados → Conectar um aparelho → Conectar
            com número de telefone</strong> e digite o código abaixo quando solicitado:
          </p>
          <div className="bg-slate-900 rounded-xl border border-slate-800 py-4 px-3 text-center">
            <span className="text-2xl font-mono font-bold text-white tracking-[0.3em]">{pairingCode}</span>
          </div>
          <p className="text-[10.5px] text-slate-400">
            O código expira em alguns minutos — clique em &quot;Gerar novo código&quot; se ele parar de funcionar.
          </p>
          <button
            type="button"
            onClick={handleConnect}
            disabled={isActing}
            className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-[11px] font-semibold flex items-center gap-1.5 disabled:opacity-60 cursor-pointer"
          >
            <RefreshCw className="w-3 h-3" />
            Gerar novo código
          </button>
        </div>
      )}

      {status === 'connected' && (
        <div className="space-y-2.5">
          <div className="flex items-center gap-2 text-emerald-700">
            <CheckCircle2 className="w-4 h-4" />
            <p className="text-xs font-semibold">Conectado{connectedNumber ? ` — número ${connectedNumber}` : ''}</p>
          </div>
          <p className="text-[11px] text-slate-600">
            As mensagens recebidas neste número aparecem na Caixa de Entrada de Atendimentos.
          </p>
          <button
            type="button"
            onClick={handleDisconnect}
            disabled={isActing}
            className="px-3.5 py-2 bg-white border border-red-200 hover:bg-red-50 text-red-600 rounded-lg text-xs font-semibold flex items-center gap-2 disabled:opacity-60 cursor-pointer"
          >
            {isActing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Unplug className="w-3.5 h-3.5" />}
            Desconectar
          </button>
        </div>
      )}

      {status === 'auth_failed' && (
        <div className="space-y-2.5">
          <div className="flex items-start gap-2 text-red-700">
            <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold">Não foi possível conectar</p>
              {lastError && <p className="text-[10.5px] text-red-500 mt-0.5 break-words">{lastError}</p>}
            </div>
          </div>
          <button
            type="button"
            onClick={handleConnect}
            disabled={isActing}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center gap-2 disabled:opacity-60 cursor-pointer"
          >
            {isActing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Tentar novamente
          </button>
        </div>
      )}

      <div className="flex items-start gap-1.5 pt-1.5 border-t border-emerald-100">
        <ShieldAlert className="w-3 h-3 text-emerald-600 shrink-0 mt-0.5" />
        <p className="text-[10px] text-emerald-700/80">
          A sessão fica salva no servidor da clínica — desconectar aqui revoga o acesso de verdade, como remover um
          aparelho conectado no WhatsApp do celular.
        </p>
      </div>

      {showImportPrompt && (
        <WhatsAppImportPrompt onClose={() => setShowImportPrompt(false)} />
      )}
    </div>
  );
};

/**
 * Pop-up exibido uma vez, na transição para 'connected' — pergunta
 * se a clínica quer importar os contatos que já existiam nessa
 * instância do WhatsApp antes de conectar ao MediFlux, e, se sim, se
 * eles já devem nascer como paciente confirmado ou como lead (a
 * mesma escolha vale para todos; ajustes individuais depois ficam em
 * Contatos → aba WhatsApp). Nunca importa nada sozinho sem essa
 * confirmação explícita.
 */
const WhatsAppImportPrompt: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { success, error: showErrorToast } = useToast();
  const [step, setStep] = useState<'ask_import' | 'ask_as_patient' | 'importing'>('ask_import');

  const handleDecline = () => {
    onClose();
  };

  const handleAccept = () => {
    setStep('ask_as_patient');
  };

  const handleChooseAndImport = async (asPatient: boolean) => {
    setStep('importing');
    try {
      const { contacts } = await apiService.getWhatsAppContacts();
      const pending = contacts.filter((c) => !c.alreadyImported);
      if (pending.length === 0) {
        success('Nada para importar', 'Todos os contatos do WhatsApp já estão no MediFlux.');
        onClose();
        return;
      }
      const res = await apiService.bulkImportWhatsAppContacts({
        asPatient,
        contacts: pending.map((c) => ({ remoteJid: c.remoteJid, phone: c.phone, name: c.name })),
      });
      success(
        'Contatos Importados',
        `${res.importedCount} contato(s) importado(s)${res.skippedCount ? `, ${res.skippedCount} já existiam e foram ignorados` : ''}. Veja em Contatos → aba WhatsApp.`
      );
    } catch (err: any) {
      showErrorToast('Falha ao importar contatos', err?.message || 'Tente novamente pela aba WhatsApp em Contatos.');
    } finally {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-5 max-w-sm w-full space-y-3 shadow-xl">
        {step === 'ask_import' && (
          <>
            <h4 className="font-bold text-slate-900 text-sm">WhatsApp conectado!</h4>
            <p className="text-xs text-slate-600">
              Encontramos contatos que já existiam nesta conversa do WhatsApp, antes de conectar ao MediFlux. Deseja importá-los agora?
            </p>
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={handleDecline} className="px-3 py-1.5 rounded-lg text-slate-600 hover:bg-slate-100 font-semibold text-xs">
                Agora não
              </button>
              <button onClick={handleAccept} className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition-colors">
                Importar contatos
              </button>
            </div>
          </>
        )}
        {step === 'ask_as_patient' && (
          <>
            <h4 className="font-bold text-slate-900 text-sm">Como importar?</h4>
            <p className="text-xs text-slate-600">
              Os contatos importados já devem ser tratados como pacientes confirmados, ou como leads (interessados, ainda não atendidos)?
              Você pode ajustar cada um individualmente depois, em Contatos → aba WhatsApp.
            </p>
            <div className="flex flex-col gap-2 pt-1">
              <button
                onClick={() => handleChooseAndImport(false)}
                className="w-full p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-left transition-colors"
              >
                <div className="font-bold text-xs">Como Leads</div>
                <div className="text-[10px] text-slate-500 mt-0.5">Recomendado — ainda não são pacientes confirmados.</div>
              </button>
              <button
                onClick={() => handleChooseAndImport(true)}
                className="w-full p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-left transition-colors"
              >
                <div className="font-bold text-xs">Como Pacientes Confirmados</div>
                <div className="text-[10px] text-slate-500 mt-0.5">Use só se tiver certeza de que já são pacientes de verdade.</div>
              </button>
            </div>
          </>
        )}
        {step === 'importing' && (
          <div className="flex items-center gap-2 text-slate-600 text-xs py-4 justify-center">
            <Loader2 className="w-4 h-4 animate-spin" /> Importando contatos e histórico...
          </div>
        )}
      </div>
    </div>
  );
};
