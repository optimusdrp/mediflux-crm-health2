'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  HeartPulse,
  Lock,
  Mail,
  User as UserIcon,
  Building2,
  Phone,
  Stethoscope,
  Users,
  CheckCircle2,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  Loader2,
  KeyRound,
  Eye,
  EyeOff,
  AlertCircle,
  Database,
  Server,
  FlaskConical,
  Check,
  RotateCcw,
  Sparkle,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';

interface AuthModalProps {
  isOpen: boolean;
  initialMode?: 'login' | 'register_trial';
  initialTestMode?: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

// ---------------------------------------------------------------------------
// Mesmo sistema visual da landing page (paleta clínica do Protocolo de
// Manchester, fundo claro, serif editorial para títulos) — nenhuma
// mudança de lógica de estado/formulário em relação à versão anterior,
// só a reestilização do JSX.
// ---------------------------------------------------------------------------

export function AuthModal({
  isOpen,
  initialMode = 'login',
  initialTestMode = false,
  onClose,
  onSuccess,
}: AuthModalProps) {
  const { login, registerTrial } = useAuth();
  const { success, error: toastError, info } = useToast();

  const [mode, setMode] = useState<'login' | 'register_trial'>(initialMode);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Test mode state activated only on 5 logo clicks
  const [isTestModeActive, setIsTestModeActive] = useState<boolean>(initialTestMode);
  const [logoClicks, setLogoClicks] = useState<number>(0);
  const clickTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Login form state (clean default fields)
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Trial form state
  const [trialData, setTrialData] = useState({
    name: '',
    email: '',
    phone: '',
    clinicName: '',
    specialty: 'Cardiologia e Gestão Médica',
    teamSize: '1 a 5 atendentes',
    password: '',
    acceptTerms: true,
  });

  const handleLogoClick = () => {
    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current);
    }

    const nextCount = logoClicks + 1;
    setLogoClicks(nextCount);

    if (nextCount >= 5) {
      setIsTestModeActive(true);
      setLogoClicks(0);
    } else {
      clickTimeoutRef.current = setTimeout(() => {
        setLogoClicks(0);
      }, 3000);
    }
  };

  const handleSelectTestProfile = (email: string, password = 'cardiovida2026') => {
    setLoginEmail(email);
    setLoginPassword(password);
    setErrorMessage(null);
    info('Credenciais Preenchidas', `E-mail: ${email}`);
  };

  if (!isOpen) return null;

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const trimmedEmail = loginEmail.trim();
    const trimmedPassword = loginPassword.trim();

    if (!trimmedEmail) {
      setErrorMessage('Por favor, informe seu e-mail de acesso.');
      return;
    }

    if (!trimmedPassword) {
      setErrorMessage('Por favor, informe sua senha de acesso.');
      return;
    }

    setIsSubmitting(true);
    try {
      await login(trimmedEmail, trimmedPassword);
      success('Login realizado com sucesso', 'Acessando o painel de governança clínica...');
      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'E-mail ou senha incorretos.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickRoleLogin = async (email: string) => {
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      await login(email.trim(), 'cardiovida2026');
      success('Acesso concedido', 'Entrando com perfil de demonstração...');
      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao autenticar perfil.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTrialSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!trialData.name.trim()) {
      setErrorMessage('Informe seu nome completo.');
      return;
    }
    if (!trialData.email.trim()) {
      setErrorMessage('Informe seu e-mail profissional.');
      return;
    }
    if (!trialData.clinicName.trim()) {
      setErrorMessage('Informe o nome da sua clínica ou consultório.');
      return;
    }
    if (!trialData.acceptTerms) {
      setErrorMessage('É necessário aceitar os Termos e Diretrizes de Privacidade da LGPD.');
      return;
    }

    setIsSubmitting(true);
    try {
      await registerTrial({
        name: trialData.name,
        email: trialData.email,
        phone: trialData.phone,
        clinicName: trialData.clinicName,
        specialty: trialData.specialty,
        teamSize: trialData.teamSize,
        password: trialData.password,
        acceptTerms: trialData.acceptTerms,
      });

      success(
        'Teste de 7 Dias Ativado!',
        `Bem-vindo(a) ao MediFlux Health! O ambiente para a ${trialData.clinicName} foi provisionado.`
      );
      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Falha ao processar o cadastro. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-clinical-ink/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl bg-clinical-paper border border-clinical-line rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Top Bar */}
        <div className="flex items-center justify-between p-5 border-b border-clinical-line bg-white">
          <div
            onClick={handleLogoClick}
            className="flex items-center gap-3 cursor-pointer select-none group transition-transform active:scale-95"
            title="Clique 5 vezes no logo para abrir o formulário de testes"
          >
            <div className="w-9 h-9 rounded-xl bg-clinical-ink flex items-center justify-center text-white shadow-md shadow-slate-900/10 group-hover:scale-105 transition-all">
              <HeartPulse className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-serif font-bold text-clinical-ink text-base tracking-tight">MediFlux</span>
                <span className="text-[10px] font-bold text-triage-blue bg-triage-blue-soft border border-triage-blue/20 px-1.5 py-0.5 rounded">
                  CRM HEALTH
                </span>
                {isTestModeActive && (
                  <span className="text-[9px] font-bold text-triage-orange bg-triage-orange-soft border border-triage-orange/30 px-1.5 py-0.5 rounded-full flex items-center gap-1 animate-pulse-slow">
                    <FlaskConical className="w-2.5 h-2.5" />
                    TESTES ATIVO
                  </span>
                )}
              </div>
              <p className="text-[11px] text-clinical-ink/50">Autenticação Segura & Governança Hospitalar</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-clinical-paper hover:bg-clinical-line text-clinical-ink/50 hover:text-clinical-ink flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="grid grid-cols-2 p-1.5 m-4 bg-white rounded-2xl border border-clinical-line">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setErrorMessage(null);
            }}
            className={`py-2.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${
              mode === 'login'
                ? 'bg-clinical-ink text-white shadow-sm'
                : 'text-clinical-ink/50 hover:text-clinical-ink'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>Entrar no CRM</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setMode('register_trial');
              setErrorMessage(null);
            }}
            className={`py-2.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 relative ${
              mode === 'register_trial'
                ? 'bg-triage-green text-white shadow-sm'
                : 'text-clinical-ink/50 hover:text-clinical-ink'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Testar 7 Dias Grátis</span>
            <span className="hidden sm:inline text-[9px] bg-white/25 text-white font-extrabold px-1.5 py-0.5 rounded-full ml-1">
              FULL
            </span>
          </button>
        </div>

        {/* Scrollable Form Content */}
        <div className="p-6 overflow-y-auto space-y-5 text-left flex-1">
          {/* Firestore Security Status Banner */}
          <div className="p-2.5 rounded-xl bg-white border border-clinical-line flex items-center justify-between text-[11px]">
            <div className="flex items-center gap-2 text-clinical-ink/60">
              <Database className="w-3.5 h-3.5 text-triage-blue" />
              <span>Validação de Acesso: <strong className="text-clinical-ink">Google Cloud Firestore</strong></span>
            </div>
            <span className="inline-flex items-center gap-1 text-[10px] text-triage-green bg-triage-green-soft border border-triage-green/20 px-2 py-0.5 rounded-full font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-triage-green animate-pulse-slow"></span>
              Isolamento Ativo
            </span>
          </div>

          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-triage-red-soft border border-triage-red/30 text-triage-red text-xs space-y-2 animate-in slide-in-from-top-1">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div className="leading-relaxed font-medium">{errorMessage}</div>
              </div>
              {mode === 'login' && (errorMessage.toLowerCase().includes('não encontrado') || errorMessage.toLowerCase().includes('não cadastrado')) && (
                <div className="pt-1 border-t border-triage-red/20 flex items-center justify-between">
                  <span className="text-[11px] text-triage-red/70">Ainda não possui conta?</span>
                  <button
                    type="button"
                    onClick={() => {
                      setTrialData((prev) => ({ ...prev, email: loginEmail.trim() }));
                      setMode('register_trial');
                      setErrorMessage(null);
                    }}
                    className="text-[11px] font-bold text-triage-green hover:text-triage-green/80 underline flex items-center gap-1"
                  >
                    <span>Criar Teste Grátis (7 Dias)</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          )}

          {mode === 'login' ? (
            /* ===== LOGIN FORM ===== */
            <div className="space-y-4">
              <form onSubmit={handleLoginSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-clinical-ink/70 block">E-mail de Acesso</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-clinical-ink/30 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      placeholder="seu.email@clinica.com.br"
                      required
                      className="w-full bg-white border border-clinical-line rounded-xl py-2.5 pl-10 pr-3 text-xs text-clinical-ink placeholder:text-clinical-ink/30 focus:outline-hidden focus:ring-2 focus:ring-triage-blue/30 focus:border-triage-blue transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-clinical-ink/70 block">Senha</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-clinical-ink/30 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="Sua senha de segurança"
                      required
                      className="w-full bg-white border border-clinical-line rounded-xl py-2.5 pl-10 pr-10 text-xs text-clinical-ink placeholder:text-clinical-ink/30 focus:outline-hidden focus:ring-2 focus:ring-triage-blue/30 focus:border-triage-blue transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-clinical-ink/30 hover:text-clinical-ink/60"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 rounded-xl bg-clinical-ink hover:bg-clinical-ink/90 text-white text-xs font-bold shadow-lg shadow-slate-900/15 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Autenticando sessão...</span>
                    </>
                  ) : (
                    <>
                      <span>Entrar no Sistema</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              {/* TEST LOGIN SECTION: Only displayed when activated via 5 clicks on logo */}
              {isTestModeActive && (
                <div className="mt-4 p-4 rounded-2xl bg-triage-orange-soft border border-triage-orange/30 space-y-3 animate-in fade-in duration-300">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-white text-triage-orange flex items-center justify-center">
                        <FlaskConical className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-clinical-ink">Formulário de Login de Testes (QA)</div>
                        <div className="text-[10px] text-clinical-ink/50">Desbloqueado ao clicar 5x no logo</div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setIsTestModeActive(false)}
                      className="text-[10px] text-triage-orange hover:text-triage-orange/70 underline"
                    >
                      Ocultar testes
                    </button>
                  </div>

                  <div className="text-[11px] text-clinical-ink/60">
                    Selecione uma conta de teste para preencher o formulário ou entrar imediatamente:
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {/* Trial 7 Dias Dr. Optimus */}
                    <div className="sm:col-span-2 p-2.5 bg-triage-green-soft border border-triage-green/30 rounded-xl space-y-1.5 shadow-sm">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-triage-green" />
                          <span className="text-xs font-bold text-clinical-ink">Dr. Optimus DRP (Trial 7 Dias)</span>
                        </div>
                        <span className="text-[9px] bg-white text-triage-green border border-triage-green/30 px-2 py-0.5 rounded-full font-bold">
                          7 Dias Grátis • Enterprise
                        </span>
                      </div>
                      <div className="text-[10px] text-clinical-ink/50 truncate">optimusdrp@gmail.com</div>
                      <div className="flex items-center gap-1.5 pt-1">
                        <button
                          type="button"
                          onClick={() => handleSelectTestProfile('optimusdrp@gmail.com', 'cardiovida2026')}
                          className="flex-1 py-1 px-2 text-[10px] font-semibold bg-white hover:bg-clinical-paper text-clinical-ink border border-clinical-line rounded-lg transition-colors text-center"
                        >
                          Preencher
                        </button>
                        <button
                          type="button"
                          onClick={() => handleQuickRoleLogin('optimusdrp@gmail.com')}
                          className="flex-1 py-1.5 px-3 text-[10px] font-bold bg-triage-green hover:bg-triage-green/90 text-white rounded-lg transition-all text-center shadow-xs"
                        >
                          Entrar no Trial (1-Clique)
                        </button>
                      </div>
                    </div>

                    {/* Admin */}
                    <div className="p-2.5 bg-white border border-clinical-line rounded-xl space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-clinical-ink">Dr. Roberto (Admin)</span>
                        <span className="text-[9px] bg-clinical-paper text-clinical-ink/60 border border-clinical-line px-1.5 py-0.5 rounded font-bold">
                          Full RBAC
                        </span>
                      </div>
                      <div className="text-[10px] text-clinical-ink/50 truncate">admin@cardiovida.com.br</div>
                      <div className="flex items-center gap-1.5 pt-1">
                        <button
                          type="button"
                          onClick={() => handleSelectTestProfile('admin@cardiovida.com.br', 'cardiovida2026')}
                          className="flex-1 py-1 px-2 text-[10px] font-semibold bg-clinical-paper hover:bg-clinical-line text-clinical-ink rounded-lg transition-colors text-center"
                        >
                          Preencher
                        </button>
                        <button
                          type="button"
                          onClick={() => handleQuickRoleLogin('admin@cardiovida.com.br')}
                          className="flex-1 py-1 px-2 text-[10px] font-bold bg-clinical-ink hover:bg-clinical-ink/90 text-white rounded-lg transition-colors text-center"
                        >
                          Entrar 1-Clique
                        </button>
                      </div>
                    </div>

                    {/* Medico */}
                    <div className="p-2.5 bg-white border border-clinical-line rounded-xl space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-clinical-ink">Dra. Camila (Médico)</span>
                        <span className="text-[9px] bg-triage-blue-soft text-triage-blue border border-triage-blue/20 px-1.5 py-0.5 rounded font-bold">
                          Clínico
                        </span>
                      </div>
                      <div className="text-[10px] text-clinical-ink/50 truncate">camila.med@cardiovida.com.br</div>
                      <div className="flex items-center gap-1.5 pt-1">
                        <button
                          type="button"
                          onClick={() => handleSelectTestProfile('camila.med@cardiovida.com.br', 'cardiovida2026')}
                          className="flex-1 py-1 px-2 text-[10px] font-semibold bg-clinical-paper hover:bg-clinical-line text-clinical-ink rounded-lg transition-colors text-center"
                        >
                          Preencher
                        </button>
                        <button
                          type="button"
                          onClick={() => handleQuickRoleLogin('camila.med@cardiovida.com.br')}
                          className="flex-1 py-1 px-2 text-[10px] font-bold bg-triage-blue hover:bg-triage-blue/90 text-white rounded-lg transition-colors text-center"
                        >
                          Entrar 1-Clique
                        </button>
                      </div>
                    </div>

                    {/* Recepcao */}
                    <div className="p-2.5 bg-white border border-clinical-line rounded-xl space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-clinical-ink">Juliana (Recepção)</span>
                        <span className="text-[9px] bg-triage-green-soft text-triage-green border border-triage-green/20 px-1.5 py-0.5 rounded font-bold">
                          WhatsApp
                        </span>
                      </div>
                      <div className="text-[10px] text-clinical-ink/50 truncate">recepcao@cardiovida.com.br</div>
                      <div className="flex items-center gap-1.5 pt-1">
                        <button
                          type="button"
                          onClick={() => handleSelectTestProfile('recepcao@cardiovida.com.br', 'cardiovida2026')}
                          className="flex-1 py-1 px-2 text-[10px] font-semibold bg-clinical-paper hover:bg-clinical-line text-clinical-ink rounded-lg transition-colors text-center"
                        >
                          Preencher
                        </button>
                        <button
                          type="button"
                          onClick={() => handleQuickRoleLogin('recepcao@cardiovida.com.br')}
                          className="flex-1 py-1 px-2 text-[10px] font-bold bg-triage-green hover:bg-triage-green/90 text-white rounded-lg transition-colors text-center"
                        >
                          Entrar 1-Clique
                        </button>
                      </div>
                    </div>

                    {/* Financeiro */}
                    <div className="p-2.5 bg-white border border-clinical-line rounded-xl space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-clinical-ink">Carlos (Financeiro)</span>
                        <span className="text-[9px] bg-triage-orange-soft text-triage-orange border border-triage-orange/20 px-1.5 py-0.5 rounded font-bold">
                          TISS/Faturamento
                        </span>
                      </div>
                      <div className="text-[10px] text-clinical-ink/50 truncate">financeiro@cardiovida.com.br</div>
                      <div className="flex items-center gap-1.5 pt-1">
                        <button
                          type="button"
                          onClick={() => handleSelectTestProfile('financeiro@cardiovida.com.br', 'cardiovida2026')}
                          className="flex-1 py-1 px-2 text-[10px] font-semibold bg-clinical-paper hover:bg-clinical-line text-clinical-ink rounded-lg transition-colors text-center"
                        >
                          Preencher
                        </button>
                        <button
                          type="button"
                          onClick={() => handleQuickRoleLogin('financeiro@cardiovida.com.br')}
                          className="flex-1 py-1 px-2 text-[10px] font-bold bg-triage-orange hover:bg-triage-orange/90 text-white rounded-lg transition-colors text-center"
                        >
                          Entrar 1-Clique
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="p-2 bg-white border border-clinical-line rounded-xl text-[10px] text-clinical-ink/50 flex items-center justify-between">
                    <span>Senha de teste padrão: <strong className="text-clinical-ink">cardiovida2026</strong></span>
                    <span className="text-triage-blue font-semibold flex items-center gap-1">
                      <Database className="w-3 h-3" /> Google Cloud Firestore
                    </span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* ===== REGISTER 7-DAY TRIAL FORM ===== */
            <form onSubmit={handleTrialSubmit} className="space-y-4">
              {/* Highlight Banner */}
              <div className="p-3 rounded-2xl bg-triage-green-soft border border-triage-green/30 text-xs space-y-1">
                <div className="flex items-center gap-1.5 text-triage-green font-bold">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Acesso Imediato ao Plano Enterprise Health</span>
                </div>
                <p className="text-clinical-ink/60 text-[11px]">
                  Teste todas as funcionalidades por 7 dias sem cobrança: Triagem Manchester com Dual AI, WhatsApp
                  Oficial e Integração PEP.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-clinical-ink/70 block">Nome do Responsável / Médico *</label>
                  <div className="relative">
                    <UserIcon className="w-4 h-4 text-clinical-ink/30 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={trialData.name}
                      onChange={(e) => setTrialData({ ...trialData, name: e.target.value })}
                      placeholder="Dr(a). Marcelo Antunes"
                      required
                      className="w-full bg-white border border-clinical-line rounded-xl py-2 pl-9 pr-3 text-xs text-clinical-ink placeholder:text-clinical-ink/30 focus:outline-hidden focus:ring-2 focus:ring-triage-blue/30"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-clinical-ink/70 block">E-mail Profissional *</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-clinical-ink/30 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      value={trialData.email}
                      onChange={(e) => setTrialData({ ...trialData, email: e.target.value })}
                      placeholder="marcelo@clinicamarcelo.com.br"
                      required
                      className="w-full bg-white border border-clinical-line rounded-xl py-2 pl-9 pr-3 text-xs text-clinical-ink placeholder:text-clinical-ink/30 focus:outline-hidden focus:ring-2 focus:ring-triage-blue/30"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-clinical-ink/70 block">Nome da Clínica ou Consultório *</label>
                  <div className="relative">
                    <Building2 className="w-4 h-4 text-clinical-ink/30 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={trialData.clinicName}
                      onChange={(e) => setTrialData({ ...trialData, clinicName: e.target.value })}
                      placeholder="Instituto de Saúde Antunes"
                      required
                      className="w-full bg-white border border-clinical-line rounded-xl py-2 pl-9 pr-3 text-xs text-clinical-ink placeholder:text-clinical-ink/30 focus:outline-hidden focus:ring-2 focus:ring-triage-blue/30"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-clinical-ink/70 block">WhatsApp / Telefone</label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-clinical-ink/30 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="tel"
                      value={trialData.phone}
                      onChange={(e) => setTrialData({ ...trialData, phone: e.target.value })}
                      placeholder="(11) 98877-6655"
                      className="w-full bg-white border border-clinical-line rounded-xl py-2 pl-9 pr-3 text-xs text-clinical-ink placeholder:text-clinical-ink/30 focus:outline-hidden focus:ring-2 focus:ring-triage-blue/30"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-clinical-ink/70 block">Especialidade Principal</label>
                  <div className="relative">
                    <Stethoscope className="w-4 h-4 text-clinical-ink/30 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <select
                      value={trialData.specialty}
                      onChange={(e) => setTrialData({ ...trialData, specialty: e.target.value })}
                      className="w-full bg-white border border-clinical-line rounded-xl py-2 pl-9 pr-3 text-xs text-clinical-ink focus:outline-hidden focus:ring-2 focus:ring-triage-blue/30 appearance-none"
                    >
                      <option value="Cardiologia e Gestão Médica">Cardiologia</option>
                      <option value="Dermatologia & Estética Avançada">Dermatologia</option>
                      <option value="Ortopedia e Traumatologia">Ortopedia</option>
                      <option value="Oftalmologia">Oftalmologia</option>
                      <option value="Pediatria">Pediatria</option>
                      <option value="Ginecologia e Obstetrícia">Ginecologia & Obstetrícia</option>
                      <option value="Clínica Médica Geral">Clínica Geral</option>
                      <option value="Policlínica / Multiespecialidades">Policlínica / Multiespecialidades</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-clinical-ink/70 block">Tamanho da Equipe</label>
                  <div className="relative">
                    <Users className="w-4 h-4 text-clinical-ink/30 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <select
                      value={trialData.teamSize}
                      onChange={(e) => setTrialData({ ...trialData, teamSize: e.target.value })}
                      className="w-full bg-white border border-clinical-line rounded-xl py-2 pl-9 pr-3 text-xs text-clinical-ink focus:outline-hidden focus:ring-2 focus:ring-triage-blue/30 appearance-none"
                    >
                      <option value="1 a 5 atendentes">1 a 5 atendentes</option>
                      <option value="6 a 15 atendentes">6 a 15 atendentes</option>
                      <option value="Mais de 16 atendentes">Mais de 16 atendentes</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-clinical-ink/70 block">Crie uma Senha de Acesso</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-clinical-ink/30 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={trialData.password}
                    onChange={(e) => setTrialData({ ...trialData, password: e.target.value })}
                    placeholder="Mínimo 6 caracteres"
                    className="w-full bg-white border border-clinical-line rounded-xl py-2 pl-9 pr-10 text-xs text-clinical-ink placeholder:text-clinical-ink/30 focus:outline-hidden focus:ring-2 focus:ring-triage-blue/30"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-clinical-ink/30 hover:text-clinical-ink/60"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Consent and LGPD Checkbox */}
              <label className="flex items-start gap-2.5 cursor-pointer pt-1 text-[11px] text-clinical-ink/60">
                <input
                  type="checkbox"
                  checked={trialData.acceptTerms}
                  onChange={(e) => setTrialData({ ...trialData, acceptTerms: e.target.checked })}
                  className="mt-0.5 rounded border-clinical-line bg-white text-triage-blue focus:ring-0"
                />
                <span>
                  Concordo com os Termos de Uso e Política de Privacidade da MediFlux, em conformidade com o Artigo 11
                  da LGPD para dados sensíveis de saúde.
                </span>
              </label>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 rounded-xl bg-triage-green hover:bg-triage-green/90 text-white text-xs font-bold shadow-lg shadow-triage-green/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Provisionando clínica e ativando 7 dias...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Criar Conta & Iniciar Teste de 7 Dias</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <div className="flex items-center justify-center gap-4 text-[11px] text-clinical-ink/45 pt-1">
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-triage-green" /> Sem cartão
                </span>
                <span className="flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-triage-blue" /> LGPD Art. 11
                </span>
                <span className="flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-triage-orange" /> Ativação Imediata
                </span>
              </div>
            </form>
          )}
        </div>

        {/* Modal Footer Link */}
        <div className="p-4 bg-white border-t border-clinical-line text-center text-xs text-clinical-ink/50">
          {mode === 'login' ? (
            <div>
              Não possui uma clínica cadastrada?{' '}
              <button
                type="button"
                onClick={() => {
                  setMode('register_trial');
                  setErrorMessage(null);
                }}
                className="text-triage-blue hover:text-triage-blue/80 font-bold ml-1"
              >
                Testar grátis por 7 dias
              </button>
            </div>
          ) : (
            <div>
              Já possui uma conta ativa no MediFlux?{' '}
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setErrorMessage(null);
                }}
                className="text-triage-blue hover:text-triage-blue/80 font-bold ml-1"
              >
                Fazer login
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
