'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User, Clinic, Subscription, RolePermission, Role, TabId, SensitiveAction } from '@/lib/types';
import { apiService } from '@/lib/services/api';
import { useToast } from './ToastContext';
import { syncFirebaseAuthSession, clearFirebaseAuthSession } from '@/lib/security/firebaseClient';

interface AuthContextType {
  user: User | null;
  clinic: Clinic | null;
  subscription: Subscription | null;
  permissions: RolePermission | null;
  isLoading: boolean;
  isTrialExpired: boolean;
  hasPermission: (tab: TabId) => boolean;
  hasActionPermission: (action: SensitiveAction) => boolean;
  login: (email: string, password?: string) => Promise<void>;
  registerTrial: (trialData: {
    name: string;
    email: string;
    phone?: string;
    clinicName: string;
    specialty?: string;
    teamSize?: string;
    password?: string;
    acceptTerms: boolean;
  }) => Promise<void>;
  logout: () => void;
  switchRole: (role: Role) => Promise<void>;
  refreshSubscription: () => Promise<void>;
}

const DEFAULT_USERS_BY_ROLE: Record<Role, string> = {
  admin: 'admin@cardiovida.com.br',
  recepcao: 'recepcao@cardiovida.com.br',
  medico: 'camila.med@cardiovida.com.br',
  financeiro: 'financeiro@cardiovida.com.br',
  terceirizado: 'terceirizado@suportesaude.com.br',
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [clinic, setClinic] = useState<Clinic | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [permissions, setPermissions] = useState<RolePermission | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isTrialExpired, setIsTrialExpired] = useState<boolean>(false);
  const { info, error, warning } = useToast();

  const handleLoginSuccess = async (data: {
    token: string;
    firebaseToken?: string | null;
    user: User;
    clinic: Clinic;
    subscription: Subscription;
    permissions: RolePermission;
  }) => {
    localStorage.setItem('mediflux_jwt_token', data.token);
    setUser(data.user);
    setClinic(data.clinic);
    setSubscription(data.subscription);
    setPermissions(data.permissions);
    setIsTrialExpired(false);

    // Integração de Firebase Authentication (correção de auditoria #4):
    // troca o custom token gerado pelo backend por uma sessão real do
    // Firebase — não bloqueia o login se falhar ou se a Service Account
    // ainda não estiver configurada (ver syncFirebaseAuthSession).
    await syncFirebaseAuthSession(data.firebaseToken ?? null);

    // Aviso se faltar menos de 2 dias
    if (
      data.subscription?.billingStatus === 'em_trial' &&
      data.subscription?.trialInfo?.isExpiringSoon
    ) {
      warning(
        '⚠️ Aviso de Expiração de Trial',
        `Restam apenas ${data.subscription.trialInfo.hoursRemaining} horas (${data.subscription.trialInfo.daysRemaining} dias) do seu período de testes de 7 dias.`
      );
    }
  };

  const login = async (email: string, password?: string) => {
    setIsLoading(true);
    try {
      const data = await apiService.login(email, password);
      await handleLoginSuccess(data);
      info('Sessão iniciada', `Bem-vindo(a), ${data.user.name} (${data.user.role.toUpperCase()})`);
    } catch (err: any) {
      if (err.errorCode === 'TRIAL_EXPIRED' || err.message?.includes('expirou')) {
        setIsTrialExpired(true);
      }
      error('Falha no login', err.message || 'Credenciais inválidas.');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const registerTrial = async (trialData: {
    name: string;
    email: string;
    phone?: string;
    clinicName: string;
    specialty?: string;
    teamSize?: string;
    password?: string;
    acceptTerms: boolean;
  }) => {
    setIsLoading(true);
    try {
      const data = await apiService.registerTrial(trialData);
      await handleLoginSuccess(data);
      info('Trial Ativado', `Bem-vindo(a), ${data.user.name}! Seu teste gratuito de 7 dias está ativo.`);
    } catch (err: any) {
      error('Erro no cadastro', err.message || 'Falha ao registrar clínica.');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = useCallback(() => {
    localStorage.removeItem('mediflux_jwt_token');
    setUser(null);
    setClinic(null);
    setSubscription(null);
    setPermissions(null);
    // Correção de auditoria #4: encerra também a sessão do Firebase,
    // para não deixar request.auth preenchido no browser depois que o
    // usuário já saiu do MediFlux (ver lib/security/firebaseClient.ts).
    void clearFirebaseAuthSession();
  }, []);

  const switchRole = async (role: Role) => {
    const targetEmail = DEFAULT_USERS_BY_ROLE[role];
    if (targetEmail) {
      await login(targetEmail, 'cardiovida2026');
    }
  };

  const refreshSubscription = async () => {
    try {
      const { subscription: updatedSub } = await apiService.getSubscription();
      setSubscription(updatedSub);
    } catch {
      // Ignora erro silencioso
    }
  };

  // Inicialização da sessão a partir de token válido
  useEffect(() => {
    let isMounted = true;
    const initAuth = async () => {
      const token = typeof window !== 'undefined' ? localStorage.getItem('mediflux_jwt_token') : null;
      if (!token) {
        if (isMounted) {
          setIsLoading(false);
        }
        return;
      }

      try {
        const data = await apiService.getMe();
        if (isMounted && data.user) {
          setUser(data.user);
          setClinic(data.clinic);
          setSubscription(data.subscription);
          setPermissions(data.permissions);
        }
      } catch {
        if (isMounted) {
          localStorage.removeItem('mediflux_jwt_token');
          setUser(null);
          setClinic(null);
          setSubscription(null);
          setPermissions(null);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    initAuth();

    // Listener para evento de 401
    const handleUnauthorized = () => {
      logout();
      error('Sessão expirada', 'Por favor, realize login novamente para continuar.');
    };

    window.addEventListener('mediflux:unauthorized', handleUnauthorized);
    return () => {
      isMounted = false;
      window.removeEventListener('mediflux:unauthorized', handleUnauthorized);
    };
  }, [error, logout]);

  const hasPermission = useCallback(
    (tab: TabId): boolean => {
      if (!user) return false;
      if (user.role === 'admin') return true;

      // Matriz de RBAC por abas
      if (tab === 'landing_page') return true;

      const defaultRoleTabs: Record<Role, TabId[]> = {
        admin: [
          'visao_geral',
          'atendimentos',
          'jornadas',
          'pendencias',
          'automacoes',
          'indicadores',
          'configuracoes',
          'auditoria_lgpd',
          'analise_inteligente',
        ],
        recepcao: ['atendimentos', 'jornadas', 'pendencias'],
        financeiro: ['visao_geral', 'pendencias', 'indicadores'],
        terceirizado: ['pendencias'],
        medico: ['visao_geral', 'atendimentos', 'jornadas', 'pendencias', 'auditoria_lgpd', 'analise_inteligente'],
      };

      if (permissions?.permittedTabs) {
        return permissions.permittedTabs.includes(tab);
      }

      return defaultRoleTabs[user.role]?.includes(tab) ?? false;
    },
    [user, permissions]
  );

  const hasActionPermission = useCallback(
    (action: SensitiveAction): boolean => {
      if (!user) return false;
      if (user.role === 'admin') return true;
      if (permissions?.grantedActions) {
        return permissions.grantedActions.includes(action);
      }
      return false;
    },
    [user, permissions]
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        clinic,
        subscription,
        permissions,
        isLoading,
        isTrialExpired,
        hasPermission,
        hasActionPermission,
        login,
        registerTrial,
        logout,
        switchRole,
        refreshSubscription,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return ctx;
}
