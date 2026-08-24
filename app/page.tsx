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
        onNavigateToLandingPage={() => setActiveTab('landing_page')}
        onOpenUpgradeModal={() => setIsUpgradeModalOpen(true)}
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
          pendingCount={2}
          unreadMessagesCount={1}
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
