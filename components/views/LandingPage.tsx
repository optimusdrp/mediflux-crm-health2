'use client';

import React, { useState, useRef } from 'react';
import {
  HeartPulse,
  ShieldCheck,
  Sparkles,
  Bot,
  Lock,
  ArrowRight,
  Database,
  Smartphone,
  ClockAlert,
  ChevronRight,
  MessageSquareText,
  Layers,
  Play,
  FlaskConical,
  CheckCircle2,
} from 'lucide-react';
import { AuthModal } from '@/components/modals/AuthModal';

interface LandingPageProps {
  onEnterApp: () => void;
}

// ---------------------------------------------------------------------------
// Sistema visual construído em torno da escala de cores do Protocolo de
// Manchester (ver app/globals.css para os tokens triage-*) — a lógica de
// triagem por prioridade que o produto automatiza é usada aqui como
// estrutura da própria página, não como decoração aplicada por cima.
// ---------------------------------------------------------------------------

const MANCHESTER_SCALE = [
  { level: 'Vermelho', meaning: 'Emergência', desc: 'Atendimento imediato', color: 'bg-triage-red', text: 'text-triage-red' },
  { level: 'Laranja', meaning: 'Muito urgente', desc: 'Até 10 minutos', color: 'bg-triage-orange', text: 'text-triage-orange' },
  { level: 'Amarelo', meaning: 'Urgente', desc: 'Até 60 minutos', color: 'bg-triage-yellow', text: 'text-triage-yellow' },
  { level: 'Verde', meaning: 'Pouco urgente', desc: 'Até 2 horas', color: 'bg-triage-green', text: 'text-triage-green' },
  { level: 'Azul', meaning: 'Não urgente', desc: 'Agendamento padrão', color: 'bg-triage-blue', text: 'text-triage-blue' },
] as const;

export function LandingPage({ onEnterApp }: LandingPageProps) {
  const [selectedPlanPeriod, setSelectedPlanPeriod] = useState<'monthly' | 'annual'>('annual');
  const [activeFaq, setActiveFaq] = useState<number | null>(0);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register_trial'>('login');
  const [isTestModeActive, setIsTestModeActive] = useState(false);

  const [logoClicks, setLogoClicks] = useState(0);
  const clickTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleLogoClick = () => {
    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current);
    }

    const nextClicks = logoClicks + 1;
    setLogoClicks(nextClicks);

    if (nextClicks >= 5) {
      setIsTestModeActive(true);
      setAuthModalMode('login');
      setIsAuthModalOpen(true);
      setLogoClicks(0);
    } else {
      clickTimeoutRef.current = setTimeout(() => {
        setLogoClicks(0);
      }, 3000);
    }
  };

  const openLogin = () => {
    setIsTestModeActive(false);
    setAuthModalMode('login');
    setIsAuthModalOpen(true);
  };

  const openTrialRegister = () => {
    setIsTestModeActive(false);
    setAuthModalMode('register_trial');
    setIsAuthModalOpen(true);
  };

  const features = [
    {
      icon: Bot,
      title: 'Triagem Clínica Dual AI (Manchester)',
      badge: 'Dual Engine',
      accent: 'red' as const,
      description:
        'Cascata com Amazon Bedrock + Google Gemini e fallback heurístico com Manchester rigoroso. Identificação automática de emergências clínicas e encaminhamento com revisão humana mandatória.',
    },
    {
      icon: ShieldCheck,
      title: 'Conformidade LGPD & Trilha Imutável',
      badge: 'Art. 11 LGPD',
      accent: 'green' as const,
      description:
        'Registro de auditoria criptográfico de cada acesso a prontuário, exportação de relatórios regulatórios, anonimização com 1 clique e gestão granular de consentimento do paciente.',
    },
    {
      icon: Smartphone,
      title: 'Omnichannel com WhatsApp Cloud API',
      badge: 'Meta Oficial',
      accent: 'blue' as const,
      description:
        'Conexão oficial da Meta BSP sem risco de bloqueio de número, central multi-atendente, mensagens estruturadas, templates aprovados e simulador integrado.',
    },
    {
      icon: Database,
      title: 'Integrações PEP / EHR Nativas (TISS/TUSS)',
      badge: 'HL7 & TISS',
      accent: 'yellow' as const,
      description:
        'Sincronização bidirecional de agendamentos e prontuários com iClinic, TOTVS Saúde, HiDoctor e Feegow, com reconciliação automática de duplicados.',
    },
    {
      icon: ClockAlert,
      title: 'Matriz de SLA & Alertas WhatsApp',
      badge: 'Zero No-Show',
      accent: 'orange' as const,
      description:
        'Disparo de alertas imediatos via WhatsApp para o telefone de plantão em casos críticos, sirenes na tela da recepção e monitoramento de tempo de espera em tempo real.',
    },
    {
      icon: Lock,
      title: 'Controle de Acesso RBAC em 2 Camadas',
      badge: 'Segurança',
      accent: 'blue' as const,
      description:
        'Permissões personalizadas por perfil (Admin, Médico, Recepção, Faturamento, Terceirizado) com restrições a nível de tela e ações críticas de governança.',
    },
  ];

  const accentClasses: Record<string, { iconBg: string; iconText: string; badge: string }> = {
    red: { iconBg: 'bg-triage-red-soft', iconText: 'text-triage-red', badge: 'bg-triage-red-soft text-triage-red border-triage-red/20' },
    orange: { iconBg: 'bg-triage-orange-soft', iconText: 'text-triage-orange', badge: 'bg-triage-orange-soft text-triage-orange border-triage-orange/20' },
    yellow: { iconBg: 'bg-triage-yellow-soft', iconText: 'text-triage-yellow', badge: 'bg-triage-yellow-soft text-triage-yellow border-triage-yellow/20' },
    green: { iconBg: 'bg-triage-green-soft', iconText: 'text-triage-green', badge: 'bg-triage-green-soft text-triage-green border-triage-green/20' },
    blue: { iconBg: 'bg-triage-blue-soft', iconText: 'text-triage-blue', badge: 'bg-triage-blue-soft text-triage-blue border-triage-blue/20' },
  };

  const metrics = [
    { value: '< 2.4s', label: 'Tempo Médio de Triagem IA', desc: 'Classificação Manchester imediata' },
    { value: '99.98%', label: 'Disponibilidade com Fallback', desc: 'Redundância dual resiliente' },
    { value: '-42%', label: 'Redução de No-Show', desc: 'Com automações e confirmações ativas' },
    { value: '100%', label: 'Auditoria e Isolamento Tenant', desc: 'Separação lógica por clínica' },
  ];

  const plans = [
    {
      name: 'Clínica Pro',
      highlight: false,
      priceMonthly: 'R$ 590',
      priceAnnual: 'R$ 490',
      description: 'Ideal para consultórios individuais e clínicas em expansão com foco em triagem ágil.',
      features: [
        'Até 5 atendentes simultâneos',
        '1 Número WhatsApp Cloud API Oficial',
        'Triagem Clínica Dual AI (Até 1.500 msgs/mês)',
        'Kanban de Jornadas e Funis',
        'Conformidade LGPD com Trilha de Auditoria',
        'Suporte em horário comercial',
      ],
      cta: 'Iniciar Demonstração',
    },
    {
      name: 'Enterprise Health',
      highlight: true,
      badge: 'Mais Escolhido',
      priceMonthly: 'R$ 1.290',
      priceAnnual: 'R$ 990',
      description: 'Estrutura completa para policlínicas, hospitais-dia e centros médicos de alta demanda.',
      features: [
        'Atendentes ilimitados com RBAC avançado',
        'Múltiplos números WhatsApp + Webhook API',
        'Triagem Dual AI ilimitada + Triage Lab',
        'Integrações PEP (iClinic, TOTVS, HiDoctor, Feegow)',
        'Alertas de Plantão WhatsApp + SLA Sonoro',
        'Unificação inteligente de pacientes duplicados',
        'Gerente de conta e SLA de 99.9%',
      ],
      cta: 'Acessar Ambiente Completo',
    },
    {
      name: 'Redes & Hospitais',
      highlight: false,
      priceMonthly: 'Sob Consulta',
      priceAnnual: 'Sob Consulta',
      description: 'Para redes de saúde, operadoras e cooperativas com requisitos complexos de governança.',
      features: [
        'Multi-unidades e filiais isoladas',
        'Conector HL7 / FHIR customizado',
        'Deploy On-Premises ou VPC Dedicada',
        'DPO dedicado para auditorias de compliance',
        'Treinamento presencial para equipes clínicas',
      ],
      cta: 'Falar com Especialistas',
    },
  ];

  const faqs = [
    {
      q: 'Como funciona a Triagem Clínica Dual AI com Protocolo de Manchester?',
      a: 'O sistema utiliza uma arquitetura em cascata: a mensagem do paciente é avaliada pelo motor primário com guardrails médicos. Caso o provedor esteja indisponível, a requisição passa automaticamente para o modelo secundário ou para o motor heurístico local baseado na tabela de cores de Manchester (Vermelho, Laranja, Amarelo, Verde, Azul). Casos graves acionam revisão humana obrigatória e alertas de plantão.',
    },
    {
      q: 'O MediFlux está de acordo com a LGPD para dados sensíveis de saúde?',
      a: 'Sim. Em conformidade rigorosa com o Art. 11 da LGPD, todos os dados clínicos trafegam criptografados em repouso e em trânsito. O sistema mantém uma trilha imutável de auditoria registrando quem acessou, editou ou exportou prontuários, com ferramentas nativas de anonimização e download de relatórios.',
    },
    {
      q: 'A integração com o WhatsApp é oficial da Meta?',
      a: 'Sim, utilizamos a WhatsApp Business Cloud API Oficial da Meta (BSP). Isso garante entrega instantânea, suporte a templates interativos aprovados, sem risco de banimento de chips ou dependência de aparelhos celulares ligados.',
    },
    {
      q: 'Posso integrar com o meu Prontuário Eletrônico (PEP) atual?',
      a: 'O MediFlux possui conectores nativos para sistemas como iClinic, TOTVS Saúde, HiDoctor e Feegow, além de disponibilizar Webhooks com assinatura criptográfica HMAC SHA-256 e proteção SSRF para conexão com qualquer outro software.',
    },
  ];

  return (
    <div className="min-h-screen bg-clinical-paper text-clinical-ink antialiased font-sans selection:bg-triage-blue selection:text-white">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 bg-clinical-paper/90 backdrop-blur-md border-b border-clinical-line px-4 sm:px-8 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div
            onClick={handleLogoClick}
            className="flex items-center gap-3 cursor-pointer select-none group transition-transform active:scale-95"
            title="Clique 5 vezes no logo para abrir o modo de testes"
          >
            <div className="w-10 h-10 rounded-xl bg-clinical-ink flex items-center justify-center text-white shadow-md group-hover:scale-105 transition-all">
              <HeartPulse className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-serif font-bold text-clinical-ink text-lg tracking-tight">MediFlux</span>
                <span className="text-[10px] font-bold text-triage-blue bg-triage-blue-soft border border-triage-blue/20 px-1.5 py-0.5 rounded tracking-wider">
                  CRM HEALTH
                </span>
                {isTestModeActive && (
                  <span className="text-[9px] font-bold text-triage-yellow bg-triage-yellow-soft border border-triage-yellow/30 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                    <FlaskConical className="w-2.5 h-2.5" />
                    TESTES
                  </span>
                )}
              </div>
              <span className="text-[11px] text-clinical-ink/50 hidden sm:inline">
                Plataforma de Governança e Inteligência Clínica
              </span>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-6 text-xs font-semibold text-clinical-ink/60">
            <a href="#recursos" className="hover:text-clinical-ink transition-colors">
              Recursos
            </a>
            <a href="#manchester" className="hover:text-clinical-ink transition-colors">
              Protocolo de Manchester
            </a>
            <a href="#dual-ai" className="hover:text-clinical-ink transition-colors">
              Triagem Dual AI
            </a>
            <a href="#planos" className="hover:text-clinical-ink transition-colors">
              Planos & Preços
            </a>
            <a href="#faq" className="hover:text-clinical-ink transition-colors">
              Perguntas Frequentes
            </a>
          </nav>

          <div className="flex items-center gap-3">
            <button
              onClick={openLogin}
              className="px-4 py-2 text-xs font-bold text-white bg-clinical-ink hover:bg-clinical-ink/90 rounded-xl shadow-md transition-all flex items-center gap-1.5"
            >
              <span>Entrar no CRM</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-14 pb-20 px-4 sm:px-8 overflow-hidden">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center relative z-10">
          <div className="lg:col-span-12 space-y-6 text-center lg:text-left max-w-3xl mx-auto lg:mx-0">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-clinical-line text-xs text-clinical-ink/70 font-semibold shadow-sm">
              <Sparkles className="w-3.5 h-3.5 text-triage-blue" />
              <span>Triagem clínica automatizada com o Protocolo de Manchester</span>
            </div>

            <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl font-semibold text-clinical-ink tracking-tight leading-[1.1]">
              Cada mensagem de paciente,{' '}
              <span className="italic text-triage-red">triada com a mesma disciplina</span>{' '}
              de um pronto-socorro
            </h1>

            <p className="text-clinical-ink/60 text-sm sm:text-base max-w-xl mx-auto lg:mx-0 leading-relaxed">
              Centralize atendimentos no WhatsApp Oficial, execute triagem com protocolo de Manchester, automatize
              jornadas do paciente e sincronize com prontuários eletrônicos sob rigorosa conformidade com a LGPD.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3 pt-2">
              <button
                onClick={openTrialRegister}
                className="w-full sm:w-auto px-7 py-3.5 rounded-xl bg-clinical-ink hover:bg-clinical-ink/90 text-white text-sm font-bold shadow-lg transition-all flex items-center justify-center gap-2 group"
              >
                <Sparkles className="w-4 h-4 text-triage-yellow" />
                <span>Testar o MediFlux por 7 dias</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </button>
              <a
                href="#recursos"
                className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-white hover:bg-clinical-line/40 text-clinical-ink/80 text-sm font-semibold border border-clinical-line transition-all flex items-center justify-center gap-2"
              >
                <Play className="w-3.5 h-3.5 text-triage-blue" />
                <span>Conhecer Funcionalidades</span>
              </a>
            </div>

            <div className="pt-4 flex flex-wrap items-center justify-center lg:justify-start gap-x-6 gap-y-2 text-xs text-clinical-ink/50">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-triage-green" />
                WhatsApp Cloud API Oficial (Meta)
              </span>
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-triage-blue" />
                LGPD Art. 11 & Trilha Auditável
              </span>
              <span className="flex items-center gap-1.5">
                <Database className="w-4 h-4 text-triage-yellow" />
                Padrão TISS / HL7 Integrado
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Manchester Scale Strip — signature structural device */}
      <section id="manchester" className="py-10 border-y border-clinical-line bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-8">
          <p className="text-center text-[11px] font-semibold text-clinical-ink/40 uppercase tracking-wider mb-5">
            A mesma escala de prioridade usada nos prontos-socorros brasileiros
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {MANCHESTER_SCALE.map((tier) => (
              <div key={tier.level} className="flex items-center gap-2.5 p-3 rounded-xl border border-clinical-line">
                <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${tier.color}`} />
                <div className="min-w-0">
                  <p className={`text-xs font-bold ${tier.text}`}>{tier.level}</p>
                  <p className="text-[10.5px] text-clinical-ink/50 truncate">{tier.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Metrics Counter Section */}
      <section className="py-10 border-b border-clinical-line bg-clinical-paper">
        <div className="max-w-7xl mx-auto px-4 sm:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 text-center">
            {metrics.map((m, idx) => (
              <div key={idx} className="space-y-1">
                <div className="font-serif text-2xl sm:text-4xl font-semibold text-clinical-ink tracking-tight">
                  {m.value}
                </div>
                <div className="text-xs sm:text-sm font-bold text-clinical-ink/70">{m.label}</div>
                <div className="text-[11px] text-clinical-ink/45">{m.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Main Features Section */}
      <section id="recursos" className="py-20 px-4 sm:px-8 max-w-7xl mx-auto">
        <div className="text-center max-w-3xl mx-auto space-y-3 mb-14">
          <span className="text-xs font-bold uppercase tracking-wider text-triage-blue bg-triage-blue-soft border border-triage-blue/20 px-2.5 py-1 rounded-full">
            Arquitetura Hospitalar Completa
          </span>
          <h2 className="font-serif text-2xl sm:text-4xl font-semibold text-clinical-ink tracking-tight">
            Tudo o que sua clínica necessita em um único ecossistema
          </h2>
          <p className="text-clinical-ink/55 text-xs sm:text-sm">
            Construído para atender as especificidades regulatórias do setor de saúde brasileiro com alta performance.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feat, idx) => {
            const IconComp = feat.icon;
            const accent = accentClasses[feat.accent];
            return (
              <div
                key={idx}
                className="p-6 rounded-2xl bg-white border border-clinical-line hover:border-clinical-ink/20 transition-all space-y-4 hover:shadow-lg group"
              >
                <div className="flex items-center justify-between">
                  <div className={`w-10 h-10 rounded-xl ${accent.iconBg} ${accent.iconText} flex items-center justify-center transition-colors`}>
                    <IconComp className="w-5 h-5" />
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${accent.badge}`}>
                    {feat.badge}
                  </span>
                </div>
                <h3 className="text-base font-bold text-clinical-ink">
                  {feat.title}
                </h3>
                <p className="text-xs text-clinical-ink/55 leading-relaxed">{feat.description}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Dual AI Deep Dive Section */}
      <section id="dual-ai" className="py-16 bg-white border-y border-clinical-line px-4 sm:px-8">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-6 space-y-4">
            <span className="text-xs font-bold text-clinical-ink/60 uppercase tracking-wider bg-clinical-paper border border-clinical-line px-2.5 py-1 rounded-full">
              Inteligência Artificial Clínica
            </span>
            <h2 className="font-serif text-2xl sm:text-4xl font-semibold text-clinical-ink tracking-tight">
              Como funciona o Protocolo de Manchester Automatizado
            </h2>
            <p className="text-xs sm:text-sm text-clinical-ink/60 leading-relaxed">
              O motor de IA do MediFlux analisa cada mensagem recebida via WhatsApp ou canais de chat, extraindo
              sintomas, tempo de evolução e sinais de alerta com base no protocolo internacional de Manchester.
            </p>

            <div className="space-y-3 pt-2">
              <div className="flex items-start gap-3 p-3 bg-triage-red-soft rounded-xl border border-triage-red/20 text-xs">
                <span className="w-4 h-4 rounded-full bg-triage-red shrink-0 mt-0.5" />
                <div>
                  <strong className="text-clinical-ink">Vermelho (Emergência Imediata):</strong> Notificação instantânea via
                  WhatsApp ao médico de plantão e alerta sonoro na tela da recepção.
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 bg-triage-yellow-soft rounded-xl border border-triage-yellow/20 text-xs">
                <span className="w-4 h-4 rounded-full bg-triage-yellow shrink-0 mt-0.5" />
                <div>
                  <strong className="text-clinical-ink">Amarelo / Verde (Urgente / Pouco Urgente):</strong> Enfileiramento com
                  SLA prioritário e sugestão de rascunhos com revisão humana.
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 bg-triage-blue-soft rounded-xl border border-triage-blue/20 text-xs">
                <span className="w-4 h-4 rounded-full bg-triage-blue shrink-0 mt-0.5" />
                <div>
                  <strong className="text-clinical-ink">Triagem Lab & Fallback Heurístico:</strong> Simulação prévia de
                  cenários no painel com zero indisponibilidade operacional.
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-6 bg-clinical-ink rounded-2xl p-6 border border-clinical-ink space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3 text-xs font-bold text-white/70">
              <span>Fluxo de Decisão do MediFlux AI</span>
              <span className="text-triage-green font-mono">Status: 200 OK</span>
            </div>

            <div className="space-y-2 text-xs font-mono">
              <div className="p-3 bg-white/5 rounded-xl border border-white/10 text-white/80">
                <span className="text-triage-blue">1. Entrada de Mensagem:</span> &ldquo;Sinto aperto no peito e suor frio há 20
                minutos.&rdquo;
              </div>
              <div className="p-3 bg-white/5 rounded-xl border border-white/10 text-white/80">
                <span className="text-triage-yellow">2. Motor Primário (Amazon Bedrock / Gemini):</span>
                <div className="text-[11px] text-white/60 mt-1">
                  • Sinais: Dor torácica opressiva, sudorese, início agudo
                  <br />• Manchester: <strong className="text-triage-red">VERMELHO (Emergência)</strong>
                  <br />• Revisão Humana Obrigatória: <span className="text-triage-green">SIM</span>
                </div>
              </div>
              <div className="p-3 bg-triage-red/10 rounded-xl border border-triage-red/30 text-white/80">
                <span className="text-triage-red">3. Ação Imediata:</span> Alerta disparado para WhatsApp do Plantão
                (+55 11 98877-6655).
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing & Plans Section */}
      <section id="planos" className="py-20 px-4 sm:px-8 max-w-7xl mx-auto">
        <div className="text-center max-w-3xl mx-auto space-y-3 mb-12">
          <span className="text-xs font-bold uppercase tracking-wider text-triage-blue bg-triage-blue-soft border border-triage-blue/20 px-2.5 py-1 rounded-full">
            Planos Transparentes
          </span>
          <h2 className="font-serif text-2xl sm:text-4xl font-semibold text-clinical-ink tracking-tight">
            Escolha a capacidade ideal para sua clínica
          </h2>
          <p className="text-clinical-ink/55 text-xs sm:text-sm">
            Sem taxa de adesão oculta. Todos os planos incluem WhatsApp Cloud API Oficial e conformidade LGPD.
          </p>

          <div className="flex items-center justify-center gap-3 pt-4">
            <button
              onClick={() => setSelectedPlanPeriod('monthly')}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all ${
                selectedPlanPeriod === 'monthly'
                  ? 'bg-clinical-ink text-white shadow-sm'
                  : 'text-clinical-ink/50 hover:text-clinical-ink'
              }`}
            >
              Mensal
            </button>
            <button
              onClick={() => setSelectedPlanPeriod('annual')}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                selectedPlanPeriod === 'annual'
                  ? 'bg-clinical-ink text-white shadow-sm'
                  : 'text-clinical-ink/50 hover:text-clinical-ink'
              }`}
            >
              <span>Anual</span>
              <span className="text-[10px] bg-triage-green text-white px-1.5 py-0.5 rounded font-bold">
                -20% OFF
              </span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {plans.map((p, idx) => (
            <div
              key={idx}
              className={`p-6 sm:p-8 rounded-3xl border flex flex-col justify-between transition-all relative ${
                p.highlight
                  ? 'bg-white border-clinical-ink shadow-2xl ring-2 ring-clinical-ink/10'
                  : 'bg-white border-clinical-line hover:border-clinical-ink/30'
              }`}
            >
              {p.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-clinical-ink text-white font-bold text-[10px] uppercase tracking-wider shadow-md">
                  {p.badge}
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-bold text-clinical-ink">{p.name}</h3>
                  <p className="text-xs text-clinical-ink/55 mt-1">{p.description}</p>
                </div>

                <div className="py-2">
                  <div className="flex items-baseline gap-1">
                    <span className="font-serif text-3xl font-semibold text-clinical-ink">
                      {selectedPlanPeriod === 'annual' ? p.priceAnnual : p.priceMonthly}
                    </span>
                    <span className="text-xs text-clinical-ink/50">/mês</span>
                  </div>
                  {selectedPlanPeriod === 'annual' && p.priceAnnual !== 'Sob Consulta' && (
                    <span className="text-[10px] text-triage-green font-semibold">Faturamento anual com economia</span>
                  )}
                </div>

                <div className="border-t border-clinical-line pt-4 space-y-2.5">
                  <span className="text-[11px] font-bold text-clinical-ink/60 uppercase tracking-wider block">
                    Incluso no plano:
                  </span>
                  {p.features.map((feat, fIdx) => (
                    <div key={fIdx} className="flex items-start gap-2 text-xs text-clinical-ink/70">
                      <CheckCircle2 className="w-3.5 h-3.5 text-triage-blue shrink-0 mt-0.5" />
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-8">
                <button
                  onClick={openTrialRegister}
                  className={`w-full py-3 rounded-xl text-xs font-bold transition-all ${
                    p.highlight
                      ? 'bg-clinical-ink hover:bg-clinical-ink/90 text-white shadow-md'
                      : 'bg-clinical-paper hover:bg-clinical-line/60 text-clinical-ink'
                  }`}
                >
                  {p.cta}
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-16 px-4 sm:px-8 max-w-4xl mx-auto border-t border-clinical-line">
        <div className="text-center space-y-3 mb-10">
          <span className="text-xs font-bold uppercase tracking-wider text-triage-blue bg-triage-blue-soft border border-triage-blue/20 px-2.5 py-1 rounded-full">
            Dúvidas Técnicas
          </span>
          <h2 className="font-serif text-2xl sm:text-3xl font-semibold text-clinical-ink tracking-tight">Perguntas Frequentes</h2>
        </div>

        <div className="space-y-3">
          {faqs.map((faq, idx) => {
            const isOpen = activeFaq === idx;
            return (
              <div
                key={idx}
                className="rounded-2xl bg-white border border-clinical-line overflow-hidden transition-all"
              >
                <button
                  onClick={() => setActiveFaq(isOpen ? null : idx)}
                  className="w-full p-4 sm:p-5 text-left flex items-center justify-between gap-4 font-bold text-xs sm:text-sm text-clinical-ink/80 hover:text-clinical-ink"
                >
                  <span>{faq.q}</span>
                  <ChevronRight
                    className={`w-4 h-4 text-clinical-ink/40 transition-transform ${isOpen ? 'rotate-90 text-triage-blue' : ''}`}
                  />
                </button>
                {isOpen && (
                  <div className="px-4 sm:px-5 pb-5 text-xs text-clinical-ink/55 leading-relaxed border-t border-clinical-line pt-3">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Final Call to Action */}
      <section className="py-16 px-4 sm:px-8 bg-clinical-ink border-t border-clinical-ink">
        <div className="max-w-4xl mx-auto text-center space-y-6">
          <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center text-clinical-ink mx-auto shadow-lg">
            <HeartPulse className="w-6 h-6" />
          </div>

          <h2 className="font-serif text-3xl sm:text-4xl font-semibold text-white tracking-tight">
            Pronto para transformar a governança e o atendimento da sua clínica?
          </h2>

          <p className="text-white/60 text-xs sm:text-sm max-w-xl mx-auto">
            Experimente agora o ecossistema completo com triagem inteligente, conformidade LGPD e WhatsApp Cloud API.
          </p>

          <button
            onClick={openTrialRegister}
            className="px-8 py-4 rounded-xl bg-white hover:bg-white/90 text-clinical-ink font-bold text-sm shadow-xl transition-all inline-flex items-center gap-2"
          >
            <Sparkles className="w-4 h-4 text-triage-yellow" />
            <span>Testar o MediFlux por 7 dias Grátis</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-clinical-line bg-clinical-paper py-8 px-4 sm:px-8 text-xs text-clinical-ink/45">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div
            onClick={handleLogoClick}
            className="flex items-center gap-2 cursor-pointer select-none hover:text-clinical-ink/70 transition-colors"
            title="Clique 5 vezes para abrir o modo de testes"
          >
            <HeartPulse className="w-4 h-4 text-triage-blue" />
            <span className="font-bold text-clinical-ink/70">MediFlux CRM Health</span>
            <span>•</span>
            <span>Tecnologia Médica & Conformidade LGPD</span>
          </div>

          <div className="flex items-center gap-4">
            <button onClick={openLogin} className="hover:text-clinical-ink transition-colors">
              Painel do Sistema (Login)
            </button>
            <span>•</span>
            <a href="#manchester" className="hover:text-clinical-ink transition-colors">
              Termos & Privacidade
            </a>
            <span>•</span>
            <span>São Paulo, SP - Brasil</span>
          </div>
        </div>
      </footer>

      {/* Auth & Trial Registration Modal */}
      {isAuthModalOpen && (
        <AuthModal
          key={`${authModalMode}-${isTestModeActive}`}
          isOpen={isAuthModalOpen}
          initialMode={authModalMode}
          initialTestMode={isTestModeActive}
          onClose={() => setIsAuthModalOpen(false)}
          onSuccess={onEnterApp}
        />
      )}
    </div>
  );
}
