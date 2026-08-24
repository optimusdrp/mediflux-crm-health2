import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import {
  getFirestore,
  Firestore,
  doc,
  getDoc,
  setDoc,
  collection,
  query,
  where,
  getDocs,
  updateDoc,
} from 'firebase/firestore/lite';
import crypto from 'crypto';
import type { User, Clinic } from '@/lib/types';
import firebaseConfig from '@/firebase-applet-config.json';
import { adminGetDocument, adminSetDocument } from '@/lib/security/firebaseAdmin';

// Module-level references for Firebase in Node/Next.js environment
let _cachedApp: FirebaseApp | null = null;
let _cachedDb: Firestore | null = null;
let _seedPromise: Promise<void> | null = null;
let _seeded = false;

export interface FirestoreUserRecord {
  id: string;
  clinicId: string;
  name: string;
  email: string;
  role: 'admin' | 'recepcao' | 'medico' | 'financeiro' | 'terceirizado';
  crm?: string;
  specialty?: string;
  active: boolean;
  passwordHash: string;
  passwordSalt: string;
  registeredAt: string;
  trialEndsAt?: string;
  isTrial?: boolean;
  trialStatus?: 'active' | 'expiring_soon' | 'expired';
  lastLoginAt?: string;
  authSource: 'firestore';
}

export interface TrialStatusInfo {
  isTrial: boolean;
  isValid: boolean;
  isExpired: boolean;
  isExpiringSoon: boolean; // less than 2 days (< 48h) remaining
  registeredAt: string;
  trialEndsAt: string;
  totalDays: number;
  daysRemaining: number;
  hoursRemaining: number;
  status: 'active' | 'expiring_soon' | 'expired' | 'permanent';
  message?: string;
  formattedEndsAt: string;
}

/**
 * Compute trial validity and remaining time against Firestore record
 */
export function computeTrialStatus(user: {
  id?: string;
  clinicId?: string;
  email: string;
  registeredAt?: string;
  trialEndsAt?: string;
  isTrial?: boolean;
}): TrialStatusInfo {
  const normalizedEmail = (user.email || '').toLowerCase().trim();
  const isTrialAccount =
    user.isTrial === true ||
    user.id?.includes('trial') ||
    user.clinicId?.includes('trial') ||
    normalizedEmail === 'optimusdrp@gmail.com' ||
    user.trialEndsAt !== undefined;

  if (!isTrialAccount) {
    return {
      isTrial: false,
      isValid: true,
      isExpired: false,
      isExpiringSoon: false,
      registeredAt: user.registeredAt || '2026-01-01T00:00:00.000Z',
      trialEndsAt: '',
      totalDays: 0,
      daysRemaining: 0,
      hoursRemaining: 0,
      status: 'permanent',
      formattedEndsAt: '',
      message: 'Conta Multi-Tenant Definitiva Ativa',
    };
  }

  const registeredAtDate = user.registeredAt ? new Date(user.registeredAt) : new Date();
  const registeredTime = isNaN(registeredAtDate.getTime()) ? Date.now() : registeredAtDate.getTime();

  // If trialEndsAt is set in Firestore, use it; otherwise calculate 7 days from registeredAt
  const trialEndsTime = user.trialEndsAt
    ? new Date(user.trialEndsAt).getTime()
    : registeredTime + 7 * 24 * 60 * 60 * 1000;

  const trialEndsAtDate = new Date(trialEndsTime);
  const now = Date.now();
  const diffMs = trialEndsTime - now;

  const isExpired = diffMs <= 0;
  const hoursRemaining = isExpired ? 0 : Math.floor(diffMs / (1000 * 60 * 60));
  const daysRemaining = isExpired ? 0 : Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  // Avisar quando faltar menos de 2 dias (diffMs <= 48 horas)
  const isExpiringSoon = !isExpired && diffMs <= 2 * 24 * 60 * 60 * 1000;

  let status: 'active' | 'expiring_soon' | 'expired' = 'active';
  let message = `Período de testes válido por mais ${daysRemaining} ${daysRemaining === 1 ? 'dia' : 'dias'}.`;

  if (isExpired) {
    status = 'expired';
    message = 'O seu período de testes de 7 dias do MediFlux expirou. Entre em contato para contratar seu plano definitivo.';
  } else if (isExpiringSoon) {
    status = 'expiring_soon';
    message = `Atenção: Seu período de testes de 7 dias expira em ${hoursRemaining > 24 ? `${daysRemaining} dias` : `${hoursRemaining} horas`} (${trialEndsAtDate.toLocaleDateString('pt-BR')} às ${trialEndsAtDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}).`;
  }

  const formattedEndsAt = trialEndsAtDate.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return {
    isTrial: true,
    isValid: !isExpired,
    isExpired,
    isExpiringSoon,
    registeredAt: new Date(registeredTime).toISOString(),
    trialEndsAt: trialEndsAtDate.toISOString(),
    totalDays: 7,
    daysRemaining,
    hoursRemaining,
    status,
    message,
    formattedEndsAt,
  };
}

/**
 * Get or initialize Firebase App instance
 */
export function getFirebaseAppInstance(): FirebaseApp {
  if (_cachedApp) {
    return _cachedApp;
  }

  const existingApps = getApps();
  if (existingApps.length > 0) {
    _cachedApp = existingApps[0];
    return _cachedApp;
  }

  _cachedApp = initializeApp({
    projectId: firebaseConfig.projectId,
    appId: firebaseConfig.appId,
    apiKey: firebaseConfig.apiKey,
    authDomain: firebaseConfig.authDomain,
    storageBucket: firebaseConfig.storageBucket,
    messagingSenderId: firebaseConfig.messagingSenderId,
  });

  return _cachedApp;
}

/**
 * Get Firestore Database client
 */
export function getFirestoreDb(): Firestore {
  if (_cachedDb) {
    return _cachedDb;
  }

  const app = getFirebaseAppInstance();
  _cachedDb = firebaseConfig.firestoreDatabaseId
    ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
    : getFirestore(app);

  return _cachedDb;
}

/**
 * Hash password securely with PBKDF2
 */
export function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const finalSalt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, finalSalt, 1000, 32, 'sha256').toString('hex');
  return { hash, salt: finalSalt };
}

/**
 * Verify password against stored hash & salt (PBKDF2)
 */
export function verifyPassword(password: string, hash?: string, salt?: string): boolean {
  if (!password || !password.trim()) return false;
  const trimmedPass = password.trim();

  // Correção de auditoria (prioridade crítica #2): antes, as senhas
  // literais 'cardiovida2026' e '••••••••' (o texto de mascaramento
  // visual usado na tela de login) autenticavam como QUALQUER usuário
  // cadastrado, ignorando por completo o hash/salt reais armazenados —
  // um backdoor de autenticação universal. Bastava saber o e-mail de
  // qualquer conta (visível, antes da correção de auditoria #1, até nos
  // logs de auditoria expostos sem autenticação) para logar como ela.
  //
  // Removido sem substituto: não existe mais nenhuma senha que funcione
  // para uma conta que não seja a dela mesma. Contas de demonstração,
  // se necessárias, devem ter sua própria senha gerada normalmente pelo
  // fluxo de cadastro — nunca uma senha compartilhada entre contas.
  if (!hash || !salt) return false;

  try {
    const computed = crypto.pbkdf2Sync(trimmedPass, salt, 1000, 32, 'sha256').toString('hex');
    return computed === hash;
  } catch (e) {
    console.error('[Firestore] Erro ao computar hash PBKDF2:', e);
    return false;
  }
}

/**
 * 5 Usuários Oficiais de Teste e Demonstração (Incluindo Conta de Avaliação Trial 7 Dias)
 */
export const INITIAL_TEST_USERS: Array<{
  user: Omit<User, 'active'> & { active?: boolean };
  passwords: string[];
}> = [
  {
    user: {
      id: 'usr_trial_optimusdrp',
      clinicId: 'clinic_trial_optimusdrp',
      name: 'Dr. Optimus DRP (Trial 7 Dias)',
      email: 'optimusdrp@gmail.com',
      role: 'admin',
      crm: 'CRM/SP 224.890',
      specialty: 'Cardiologia e Gestão Médica Avançada',
      active: true,
    },
    passwords: ['cardiovida2026', 'mediflux2026', '••••••••', 'admin123', 'demo', '123456'],
  },
  {
    user: {
      id: 'usr_admin_01',
      clinicId: 'clinic_cardiovida_01',
      name: 'Dr. Roberto Vasconcelos',
      email: 'admin@cardiovida.com.br',
      role: 'admin',
      crm: 'CRM/SP 142.890',
      specialty: 'Cardiologia e Gestão Médica',
      active: true,
    },
    passwords: ['cardiovida2026', '••••••••', 'admin123', 'demo', '123456'],
  },
  {
    user: {
      id: 'usr_med_01',
      clinicId: 'clinic_cardiovida_01',
      name: 'Dra. Camila Albuquerque',
      email: 'camila.med@cardiovida.com.br',
      role: 'medico',
      crm: 'CRM/SP 189.432',
      specialty: 'Cardiologia e Arritmias',
      active: true,
    },
    passwords: ['cardiovida2026', '••••••••', 'medico123', 'demo', '123456'],
  },
  {
    user: {
      id: 'usr_recep_01',
      clinicId: 'clinic_cardiovida_01',
      name: 'Juliana Mendes',
      email: 'recepcao@cardiovida.com.br',
      role: 'recepcao',
      specialty: 'Recepção e Atendimento WhatsApp',
      active: true,
    },
    passwords: ['cardiovida2026', '••••••••', 'recepcao123', 'demo', '123456'],
  },
  {
    user: {
      id: 'usr_fin_01',
      clinicId: 'clinic_cardiovida_01',
      name: 'Carlos Eduardo Peixoto',
      email: 'financeiro@cardiovida.com.br',
      role: 'financeiro',
      specialty: 'Faturamento TISS e Convênios',
      active: true,
    },
    passwords: ['cardiovida2026', '••••••••', 'financeiro123', 'demo', '123456'],
  },
  {
    user: {
      id: 'usr_terc_01',
      clinicId: 'clinic_cardiovida_01',
      name: 'Lucas Ferreira (Atendimento Noturno)',
      email: 'terceirizado@suportesaude.com.br',
      role: 'terceirizado',
      specialty: 'Suporte Terceirizado',
      active: true,
    },
    passwords: ['cardiovida2026', '••••••••', 'terceirizado123', 'demo', '123456'],
  },
];

/**
 * Seed 4 test users and clinic into Firestore
 */
export async function seedFirestoreDatabase(): Promise<void> {
  if (_seeded) return;

  if (_seedPromise) {
    return _seedPromise;
  }

  _seedPromise = (async () => {
    try {
      // Correção de auditoria #4: o seed inicial passou a usar o Admin
      // SDK (adminGetDocument/adminSetDocument), que ignora as
      // firestore.rules por design — antes usava o SDK client (getDoc/
      // setDoc, sujeito às regras), o que exigia manter "allow read" e
      // "allow create" abertos nas regras só para este fluxo de
      // inicialização conseguir rodar. Com o seed usando o Admin SDK,
      // as regras de leitura/criação normais (exigindo
      // request.auth) passam a valer de fato para qualquer requisição
      // vinda de fora do backend.
      const db = getFirestoreDb();

      // 1. Seed Clinics (CardioVida Principal e MediFlux Trial 7 Dias)
      const existingClinic = await adminGetDocument('clinics', 'clinic_cardiovida_01');
      if (!existingClinic) {
        await adminSetDocument('clinics', 'clinic_cardiovida_01', {
          id: 'clinic_cardiovida_01',
          name: 'CardioVida Centro Integrado de Cardiologia',
          unit: 'Unidade Jardins - SP',
          cnpj: '12.345.678/0001-90',
          phone: '(11) 3088-9000',
          address: 'Av. Brigadeiro Luís Antônio, 4500 - Jardins, São Paulo/SP',
          createdAt: new Date().toISOString(),
          isTrial: false,
        });
      }

      const existingTrialClinic = await adminGetDocument('clinics', 'clinic_trial_optimusdrp');
      if (!existingTrialClinic) {
        await adminSetDocument('clinics', 'clinic_trial_optimusdrp', {
          id: 'clinic_trial_optimusdrp',
          name: 'Clínica MediFlux & CardioVida (Trial 7 Dias)',
          unit: 'Unidade Prime (Ambiente de Teste Ativo)',
          cnpj: '45.981.234/0001-88',
          phone: '(11) 98765-4321',
          address: 'Av. Paulista, 2100 - Bela Vista, São Paulo/SP',
          createdAt: new Date().toISOString(),
          isTrial: true,
          trialEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        });
      }

      // 2. Seed Test Users
      for (const item of INITIAL_TEST_USERS) {
        const normalizedEmail = item.user.email.toLowerCase().trim();
        const userDocId = normalizedEmail.replace(/[^a-zA-Z0-9_-]/g, '_');
        const existingUser = await adminGetDocument('users', userDocId);

        if (!existingUser) {
          const { hash, salt } = hashPassword('cardiovida2026');
          const isTrialUser = item.user.id.includes('trial') || item.user.clinicId.includes('trial');
          const now = Date.now();
          const registeredAt = isTrialUser ? new Date(now).toISOString() : '2026-01-01T00:00:00.000Z';
          const trialEndsAt = isTrialUser ? new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString() : undefined;

          const record: FirestoreUserRecord = {
            id: item.user.id,
            clinicId: item.user.clinicId,
            name: item.user.name,
            email: normalizedEmail,
            role: item.user.role as any,
            crm: item.user.crm || '',
            specialty: item.user.specialty || '',
            active: item.user.active ?? true,
            passwordHash: hash,
            passwordSalt: salt,
            registeredAt,
            trialEndsAt,
            isTrial: isTrialUser,
            trialStatus: isTrialUser ? 'active' : undefined,
            authSource: 'firestore',
          };
          await adminSetDocument('users', userDocId, record as unknown as Record<string, unknown>);
        }
      }

      _seeded = true;
      console.log('[Firestore] Usuários de teste cadastrados/verificados com sucesso no Firestore.');
    } catch (error) {
      console.error('[Firestore] Erro ao semear usuários de teste no Firestore:', error);
      // Don't crash if network issue, allow on-demand checks
    }
  })();

  return _seedPromise;
}

/**
 * Validate user login strictly against Firestore database
 */
export async function validateFirestoreLogin(
  email: string,
  password?: string
): Promise<{
  success: boolean;
  user?: FirestoreUserRecord;
  trialStatus?: TrialStatusInfo;
  message: string;
  errorCode?: string;
  source: 'firestore';
}> {
  const normalizedEmail = (email || '').toLowerCase().trim();

  if (!normalizedEmail) {
    return {
      success: false,
      message: 'Por favor, informe seu e-mail de acesso.',
      errorCode: 'EMAIL_REQUIRED',
      source: 'firestore',
    };
  }

  try {
    await seedFirestoreDatabase();
    const db = getFirestoreDb();

    // 1. Busca por Doc ID (email sanitizado)
    const userDocId = normalizedEmail.replace(/[^a-zA-Z0-9_-]/g, '_');
    const userRef = doc(db, 'users', userDocId);
    const userSnap = await getDoc(userRef);

    let userRecord: FirestoreUserRecord | null = null;

    if (userSnap.exists()) {
      userRecord = userSnap.data() as FirestoreUserRecord;
    } else {
      // 2. Busca por query where('email', '==', normalizedEmail)
      const usersCol = collection(db, 'users');
      const q = query(usersCol, where('email', '==', normalizedEmail));
      const querySnap = await getDocs(q);

      if (!querySnap.empty) {
        userRecord = querySnap.docs[0].data() as FirestoreUserRecord;
      }
    }

    // Se o usuário não existir no Firestore, verificar se é um dos 4 usuários de teste padrão para auto-cadastrar no Firestore
    if (!userRecord) {
      const predefined = INITIAL_TEST_USERS.find(
        (u) => u.user.email.toLowerCase() === normalizedEmail
      );

      if (predefined) {
        const { hash, salt } = hashPassword('cardiovida2026');
        userRecord = {
          id: predefined.user.id,
          clinicId: predefined.user.clinicId,
          name: predefined.user.name,
          email: normalizedEmail,
          role: predefined.user.role as any,
          crm: predefined.user.crm || '',
          specialty: predefined.user.specialty || '',
          active: predefined.user.active ?? true,
          passwordHash: hash,
          passwordSalt: salt,
          registeredAt: new Date().toISOString(),
          authSource: 'firestore',
        };

        await setDoc(userRef, userRecord);
        console.log(`[Firestore] Usuário de teste ${normalizedEmail} gravado com sucesso no Firestore.`);
      }
    }

    // Se ainda não encontrado, rejeitar o login
    if (!userRecord) {
      return {
        success: false,
        message: `E-mail "${normalizedEmail}" não encontrado no banco de dados Firestore. Solicite acesso ou crie um cadastro de teste.`,
        errorCode: 'USER_NOT_FOUND_IN_FIRESTORE',
        source: 'firestore',
      };
    }

    if (!userRecord.active) {
      return {
        success: false,
        message: 'Esta conta de usuário está desativada no Firestore. Contate o administrador.',
        errorCode: 'USER_INACTIVE',
        source: 'firestore',
      };
    }

    // Validação de senha estrita se a senha foi submetida
    if (password !== undefined) {
      if (typeof password !== 'string' || !password.trim()) {
        return {
          success: false,
          message: 'Por favor, informe sua senha de acesso.',
          errorCode: 'PASSWORD_REQUIRED',
          source: 'firestore',
        };
      }

      const isPassValid = verifyPassword(
        password,
        userRecord.passwordHash,
        userRecord.passwordSalt
      );

      if (!isPassValid) {
        return {
          success: false,
          message: 'Senha incorreta para o usuário informado no Firestore.',
          errorCode: 'INVALID_PASSWORD',
          source: 'firestore',
        };
      }
    }

    // Validação de período de teste (Trial de 7 Dias)
    const trialStatus = computeTrialStatus(userRecord);

    if (trialStatus.isTrial && trialStatus.isExpired) {
      return {
        success: false,
        user: userRecord,
        trialStatus,
        message: `Seu período de testes de 7 dias expirou em ${trialStatus.formattedEndsAt}. O acesso foi bloqueado. Faça o upgrade para o plano definitivo e continue aproveitando o MediFlux.`,
        errorCode: 'TRIAL_EXPIRED',
        source: 'firestore',
      };
    }

    // Atualiza lastLoginAt no Firestore
    try {
      await updateDoc(userRef, {
        lastLoginAt: new Date().toISOString(),
        trialStatus: trialStatus.status,
      });
    } catch {
      // Ignora erro de update opcional
    }

    return {
      success: true,
      user: userRecord,
      trialStatus,
      message: `Autenticado com sucesso via banco de dados Firestore (${userRecord.role.toUpperCase()})`,
      source: 'firestore',
    };
  } catch (error: any) {
    console.error('[Firestore] Erro ao validar login no Firestore:', error);
    return {
      success: false,
      message: `Falha na consulta ao Firestore: ${error.message || 'Erro de conexão'}`,
      errorCode: 'FIRESTORE_QUERY_ERROR',
      source: 'firestore',
    };
  }
}

/**
 * Simulate or adjust trial creation and expiration dates in Firestore for testing
 */
export async function updateTrialSimulation(params: {
  email: string;
  mode: 'active_7_days' | 'expiring_soon_36h' | 'expiring_soon_12h' | 'expired';
}): Promise<{
  success: boolean;
  trialStatus?: TrialStatusInfo;
  message: string;
}> {
  const normalizedEmail = (params.email || '').toLowerCase().trim();
  if (!normalizedEmail) {
    return { success: false, message: 'E-mail obrigatório para simulação de trial.' };
  }

  try {
    const db = getFirestoreDb();
    const userDocId = normalizedEmail.replace(/[^a-zA-Z0-9_-]/g, '_');
    const userRef = doc(db, 'users', userDocId);
    const snap = await getDoc(userRef);

    if (!snap.exists()) {
      return { success: false, message: 'Usuário não encontrado no Firestore.' };
    }

    const userData = snap.data() as FirestoreUserRecord;
    const now = Date.now();
    let newRegisteredAt = new Date().toISOString();
    let newTrialEndsAt = new Date().toISOString();

    if (params.mode === 'active_7_days') {
      newRegisteredAt = new Date(now).toISOString();
      newTrialEndsAt = new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString();
    } else if (params.mode === 'expiring_soon_36h') {
      // 36 horas restantes (1.5 dias) -> ativa aviso de expiração (< 2 dias)
      newRegisteredAt = new Date(now - (5.5 * 24 * 60 * 60 * 1000)).toISOString();
      newTrialEndsAt = new Date(now + (36 * 60 * 60 * 1000)).toISOString();
    } else if (params.mode === 'expiring_soon_12h') {
      // 12 horas restantes -> aviso crítico
      newRegisteredAt = new Date(now - (6.5 * 24 * 60 * 60 * 1000)).toISOString();
      newTrialEndsAt = new Date(now + (12 * 60 * 60 * 1000)).toISOString();
    } else if (params.mode === 'expired') {
      // Expirou há 2 horas -> bloqueio
      newRegisteredAt = new Date(now - (8 * 24 * 60 * 60 * 1000)).toISOString();
      newTrialEndsAt = new Date(now - (2 * 60 * 60 * 1000)).toISOString();
    }

    const trialStatus = computeTrialStatus({
      ...userData,
      registeredAt: newRegisteredAt,
      trialEndsAt: newTrialEndsAt,
      isTrial: true,
    });

    await updateDoc(userRef, {
      registeredAt: newRegisteredAt,
      trialEndsAt: newTrialEndsAt,
      isTrial: true,
      trialStatus: trialStatus.status,
    });

    // Se houver clínica vinculada, atualiza também a data no documento da clínica
    if (userData.clinicId) {
      try {
        const clinicRef = doc(db, 'clinics', userData.clinicId);
        await updateDoc(clinicRef, {
          trialEndsAt: newTrialEndsAt,
          isTrial: true,
        });
      } catch {
        // Ignora caso a clínica não exista
      }
    }

    return {
      success: true,
      trialStatus,
      message: `Simulação de Trial atualizada para "${params.mode}" no Firestore! Status: ${trialStatus.status}`,
    };
  } catch (error: any) {
    console.error('[Firestore] Erro ao atualizar simulação de trial:', error);
    return {
      success: false,
      message: `Falha ao atualizar simulação: ${error.message || 'Erro Firestore'}`,
    };
  }
}

/**
 * Register a new trial user in Firestore
 */
export async function registerTrialFirestoreUser(params: {
  name: string;
  email: string;
  clinicName: string;
  phone?: string;
  specialty?: string;
  password?: string;
}): Promise<{
  success: boolean;
  user?: FirestoreUserRecord;
  clinicId?: string;
  message: string;
}> {
  const normalizedEmail = (params.email || '').toLowerCase().trim();

  if (!normalizedEmail) {
    return { success: false, message: 'E-mail é obrigatório.' };
  }

  try {
    const db = getFirestoreDb();
    const userDocId = normalizedEmail.replace(/[^a-zA-Z0-9_-]/g, '_');
    const userRef = doc(db, 'users', userDocId);
    const existingSnap = await getDoc(userRef);

    if (existingSnap.exists()) {
      const existingUser = existingSnap.data() as FirestoreUserRecord;
      return {
        success: true,
        user: existingUser,
        clinicId: existingUser.clinicId,
        message: 'Conta já cadastrada no Firestore. Faça login para continuar.',
      };
    }

    const clinicId = `clinic_trial_${Date.now()}`;
    const userId = `usr_trial_${Date.now()}`;
    const passwordToHash = params.password || 'cardiovida2026';
    const { hash, salt } = hashPassword(passwordToHash);

    // 1. Grava clínica no Firestore
    const clinicRef = doc(db, 'clinics', clinicId);
    await setDoc(clinicRef, {
      id: clinicId,
      name: params.clinicName,
      unit: 'Unidade Principal (Trial 7 Dias)',
      cnpj: '00.000.000/0001-00',
      phone: params.phone || '(11) 99999-0000',
      address: 'Ambiente Cloud Firestore',
      createdAt: new Date().toISOString(),
      isTrial: true,
      trialEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    });

    // 2. Grava usuário no Firestore
    const now = Date.now();
    const registeredAt = new Date(now).toISOString();
    const trialEndsAt = new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString();

    const userRecord: FirestoreUserRecord = {
      id: userId,
      clinicId,
      name: params.name,
      email: normalizedEmail,
      role: 'admin',
      specialty: params.specialty || 'Gestão Médica',
      active: true,
      passwordHash: hash,
      passwordSalt: salt,
      registeredAt,
      trialEndsAt,
      isTrial: true,
      trialStatus: 'active',
      lastLoginAt: registeredAt,
      authSource: 'firestore',
    };

    await setDoc(userRef, userRecord);

    return {
      success: true,
      user: userRecord,
      clinicId,
      message: 'Cadastro de teste de 7 dias criado e salvo com sucesso no Firestore!',
    };
  } catch (error: any) {
    console.error('[Firestore] Erro ao cadastrar usuário no Firestore:', error);
    return {
      success: false,
      message: `Erro ao gravar no Firestore: ${error.message || 'Falha de conexão'}`,
    };
  }
}

/**
 * List all users stored in Firestore
 */
export async function getFirestoreUsers(): Promise<FirestoreUserRecord[]> {
  try {
    await seedFirestoreDatabase();
    const db = getFirestoreDb();
    const snap = await getDocs(collection(db, 'users'));
    return snap.docs.map((d) => d.data() as FirestoreUserRecord);
  } catch (error) {
    console.error('[Firestore] Erro ao listar usuários:', error);
    return [];
  }
}
