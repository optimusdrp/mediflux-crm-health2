'use client';

import React, { useState, useEffect } from 'react';
import { TabId, Patient, DuplicateMatch } from '@/lib/types';
import { ToastProvider } from '@/contexts/ToastContext';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { FilterPreferencesProvider } from '@/contexts/FilterPreferencesContext';
import { Header } from '@/components/layout/Header';
import { Sidebar } from '@/components/layout/Sidebar';
import { AccessDeniedGuard } from '@/components/layout/AccessDeniedGuard';
import { apiService } from '@/lib/services/api';

// Views
import { LandingPage } from '@/components/views/LandingPage';
import { VisaoGeralView } from '@/components/views/VisaoGeralView';
import { AtendimentosView } from '@/components/views/AtendimentosView';
import { JornadasView } from '@/components/views/JornadasView';
import { PendenciasView } from '@/components/views/PendenciasView';
import { AutomacoesView } from '@/components/views/AutomacoesView';
import { IndicadoresView } from '@/components/views/IndicadoresView';
import { ConfiguracoesView } from '@/components/views/ConfiguracoesView';
import { AuditoriaLGPDView } from '@/components/views/AuditoriaLGPDView';
import { AnaliseInteligenteView } from '@/components/views/AnaliseInteligenteView';

// Modals
import { DuplicateMergeModal } from '@/components/modals/DuplicateMergeModal';
import { ProfileModal } from '@/components/modals/ProfileModal';
import { NewPatientModal } from '@/components/modals/NewPatientModal';
import { PatientEditModal } from '@/components/modals/PatientEditModal';
import { TrialExpirationBanner } from '@/components/layout/TrialExpirationBanner';
import { TrialExpiredModal } from '@/components/modals/TrialExpiredModal';
import { UpgradeModal } from '@/components/modals/UpgradeModal';

function MediFluxAppContent() {
  const { user, subscription, isTrialExpired, hasPermission, isLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>('visao_geral');
  const [selectedPatientId, setSelectedPatientId] = useState<string>('');

  // Modals state
  const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  // Correção de responsividade: controla se o Sidebar (menu lateral)
  // está aberto em telas pequenas, onde ele fica recolhido por
  // padrão. Em telas grandes (lg: e acima) isso é ignorado — o
  // Sidebar permanece sempre visível.
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isNewPatientModalOpen, setIsNewPatientModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [patientToEdit, setPatientToEdit] = useState<Patient | null>(null);

  // Duplicates list
  const [duplicates, setDuplicates] = useState<DuplicateMatch[]>([]);

  const loadDuplicates = async () => {
    if (!user) return;
    try {
      const res = await apiService.getDuplicateCandidates();
      setDuplicates(res.duplicates);
    } catch {
      // Ignora erro silencioso
    }
  };

  useEffect(() => {
    let isMounted = true;
    if (!user) return;

    const fetchDuplicates = async () => {
      try {
        const res = await apiService.getDuplicateCandidates();
        if (isMounted) {
          setDuplicates(res.duplicates);
        }
      } catch {
        // Ignora erro silencioso
      }
    };
    fetchDuplicates();
    return () => {
      isMounted = false;
    };
  }, [user]);

  /**
   * Contagens reais do Sidebar — antes eram valores fixos (2 e 1),
   * sempre iguais independente de qualquer dado real (ver relato real
   * do usuário: a fila aparecia vazia mas o badge mostrava "1").
   *
   * Regras confirmadas pelo usuário:
   *  - "Atendimentos": total de conversas cujo ÚLTIMA mensagem foi do
   *    paciente (lastMessageSender === 'patient') — aguardando resposta
   *    da clínica.
   *  - "Pendências & SLA": dentre essas, quantas já ultrapassaram o
   *    tempo máximo de resposta configurado pela clínica
   *    (settings.whatsappAlerts.slaAlertMinutes, editável em
   *    Configurações → Alertas WhatsApp & SLA — 15 min é o padrão).
   *
   * Pacientes sem lastMessageSender (criados antes deste campo existir
   * no backend) são tratados como 'attendant' — não entram em nenhuma
   * das duas contagens, para não gerar um pico falso de pendências no
   * dia em que este campo passar a existir.
   */
  const [awaitingReplyCount, setAwaitingReplyCount] = useState(0);
  const [slaBreachedCount, setSlaBreachedCount] = useState(0);

  useEffect(() => {
    let isMounted = true;
    if (!user) return;

    const loadSidebarCounts = async () => {
      try {
        const [patientsRes, settingsRes] = await Promise.allSettled([apiService.getPatients(), apiService.getClinicSettings()]);
        if (!isMounted) return;

        const patientsList = patientsRes.status === 'fulfilled' ? patientsRes.value.patients || [] : [];
        const slaMinutes =
          settingsRes.status === 'fulfilled' ? settingsRes.value.settings?.whatsappAlerts?.slaAlertMinutes ?? 15 : 15;

        const awaitingReply = patientsList.filter((p) => p.lastMessageSender === 'patient');
        const now = Date.now();
        const slaBreached = awaitingReply.filter((p) => {
          const lastInteraction = new Date(p.lastInteractionAt).getTime();
          if (Number.isNaN(lastInteraction)) return false;
          const minutesSinceLastMessage = (now - lastInteraction) / (1000 * 60);
          return minutesSinceLastMessage > slaMinutes;
        });

        setAwaitingReplyCount(awaitingReply.length);
        setSlaBreachedCount(slaBreached.length);
      } catch {
        // Mantém os últimos valores conhecidos em caso de falha pontual
      }
    };

    loadSidebarCounts();
    const interval = setInterval(loadSidebarCounts, 60000); // recalcula a cada minuto — o tempo decorrido muda mesmo sem nenhuma ação do usuário
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [user]);

  const handleOpenEditModal = (patient: Patient) => {
    setPatientToEdit(patient);
    setIsEditModalOpen(true);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white">
        <div className="w-12 h-12 rounded-2xl bg-sky-500 flex items-center justify-center animate-pulse mb-4 shadow-lg shadow-sky-500/30">
          <span className="font-extrabold text-xl">M</span>
        </div>
        <h2 className="text-base font-bold">MediFlux CRM Health</h2>
        <p className="text-xs text-slate-400 mt-1">Carregando ecossistema clínico multi-tenant...</p>
      </div>
    );
  }

  // A landing page é a página principal padrão. O sistema só é exibido se o usuário estiver logado e cadastrado.
  if (!user || activeTab === 'landing_page') {
    return <LandingPage onEnterApp={() => setActiveTab('visao_geral')} />;
  }

  const isTrialExpiredState = isTrialExpired || Boolean(subscription?.trialInfo?.isExpired);
  const isPermitted = hasPermission(activeTab) && !isTrialExpiredState;

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col antialiased text-slate-900 selection:bg-sky-500 selection:text-white">
      {/* Top Header */}
      <Header
        onOpenDuplicatesModal={() => setIsDuplicateModalOpen(true)}
        duplicatesCount={duplicates.length}
        onOpenUpgradeModal={() => setIsUpgradeModalOpen(true)}
        onOpenProfileModal={() => setIsProfileModalOpen(true)}
        onToggleSidebar={() => setIsMobileSidebarOpen((prev) => !prev)}
      />

      {/* Trial Expiration Notification Banner (Warns when < 2 days) */}
      <TrialExpirationBanner onOpenUpgradeModal={() => setIsUpgradeModalOpen(true)} />

      {/* Main Content Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar */}
        <Sidebar
          activeTab={activeTab}
          onSelectTab={(tab) => {
            setActiveTab(tab);
          }}
          pendingCount={slaBreachedCount}
          unreadMessagesCount={awaitingReplyCount}
          isOpenOnMobile={isMobileSidebarOpen}
          onCloseMobile={() => setIsMobileSidebarOpen(false)}
        />

        {/* Dynamic View Container */}
        <main className="flex-1 overflow-y-auto min-h-0 bg-slate-50/60">
          {!isPermitted ? (
            <AccessDeniedGuard
              tab={activeTab}
              reason={isTrialExpiredState ? 'trial_expired' : 'rbac'}
            />
          ) : (
            <>
              {activeTab === 'visao_geral' && (
                <VisaoGeralView
                  onNavigateTab={(t) => setActiveTab(t)}
                  onSelectPatient={(id) => {
                    setSelectedPatientId(id);
                    setActiveTab('atendimentos');
                  }}
                  onOpenNewPatientModal={() => setIsNewPatientModalOpen(true)}
                />
              )}

              {activeTab === 'atendimentos' && (
                <AtendimentosView
                  initialPatientId={selectedPatientId}
                  onOpenEditModal={handleOpenEditModal}
                  onOpenNewPatientModal={() => setIsNewPatientModalOpen(true)}
                />
              )}

              {activeTab === 'jornadas' && (
                <JornadasView
                  onSelectPatient={(id) => {
                    setSelectedPatientId(id);
                    setActiveTab('atendimentos');
                  }}
                  onOpenNewPatientModal={() => setIsNewPatientModalOpen(true)}
                />
              )}

              {activeTab === 'pendencias' && (
                <PendenciasView
                  onSelectPatient={(id) => {
                    setSelectedPatientId(id);
                    setActiveTab('atendimentos');
                  }}
                />
              )}

              {activeTab === 'automacoes' && <AutomacoesView />}

              {activeTab === 'indicadores' && <IndicadoresView />}

              {activeTab === 'configuracoes' && <ConfiguracoesView />}

              {activeTab === 'auditoria_lgpd' && <AuditoriaLGPDView />}

              {activeTab === 'analise_inteligente' && <AnaliseInteligenteView />}
            </>
          )}
        </main>
      </div>

      {/* Duplicates Modal */}
      <DuplicateMergeModal
        isOpen={isDuplicateModalOpen}
        onClose={() => setIsDuplicateModalOpen(false)}
        duplicates={duplicates}
        onMergeComplete={() => loadDuplicates()}
      />

      {/* Profile Modal */}
      <ProfileModal isOpen={isProfileModalOpen} onClose={() => setIsProfileModalOpen(false)} />

      {/* New Patient Modal */}
      <NewPatientModal
        isOpen={isNewPatientModalOpen}
        onClose={() => setIsNewPatientModalOpen(false)}
        onPatientCreated={(p) => {
          setSelectedPatientId(p.id);
          setActiveTab('atendimentos');
        }}
      />

      {/* Patient Edit Modal */}
      <PatientEditModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setPatientToEdit(null);
        }}
        patient={patientToEdit}
        onPatientUpdated={() => {}}
      />

      {/* Upgrade Plan Modal */}
      <UpgradeModal
        isOpen={isUpgradeModalOpen}
        onClose={() => setIsUpgradeModalOpen(false)}
      />

      {/* Trial Expired Lockout Modal */}
      <TrialExpiredModal
        isOpen={isTrialExpired || Boolean(subscription?.trialInfo?.isExpired)}
      />
    </div>
  );
}

export default function Page() {
  return (
    <ToastProvider>
      <AuthProvider>
        <FilterPreferencesProvider>
          <MediFluxAppContent />
        </FilterPreferencesProvider>
      </AuthProvider>
    </ToastProvider>
  );
}
