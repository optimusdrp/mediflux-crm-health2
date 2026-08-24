import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDoc, collection, getDocs } from 'firebase/firestore/lite';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read firebase-applet-config.json
const configPath = path.resolve(__dirname, '../firebase-applet-config.json');
if (!fs.existsSync(configPath)) {
  console.error('❌ Arquivo firebase-applet-config.json não encontrado em', configPath);
  process.exit(1);
}

const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));

console.log('====================================================');
console.log('🚀 MEDIFLUX HEALTH - SCRIPT DE POPULAÇÃO DO FIRESTORE');
console.log('====================================================');
console.log(`📁 Projeto Firebase: ${firebaseConfig.projectId}`);
console.log(`🗄️  Database ID: ${firebaseConfig.firestoreDatabaseId || '(default)'}`);

// Initialize Firebase
const app = getApps().length > 0 ? getApp() : initializeApp({
  projectId: firebaseConfig.projectId,
  appId: firebaseConfig.appId,
  apiKey: firebaseConfig.apiKey,
  authDomain: firebaseConfig.authDomain,
  storageBucket: firebaseConfig.storageBucket,
  messagingSenderId: firebaseConfig.messagingSenderId,
});

const db = firebaseConfig.firestoreDatabaseId
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

// PBKDF2 Password Hashing
function hashPassword(password, salt) {
  const finalSalt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, finalSalt, 1000, 32, 'sha256').toString('hex');
  return { hash, salt: finalSalt };
}

// Usuários de Testes Oficiais Multi-Tenant e Trial 7 Dias
const INITIAL_TEST_USERS = [
  {
    id: 'usr_trial_optimusdrp',
    clinicId: 'clinic_trial_optimusdrp',
    name: 'Dr. Optimus DRP (Trial 7 Dias)',
    email: 'optimusdrp@gmail.com',
    role: 'admin',
    crm: 'CRM/SP 224.890',
    specialty: 'Cardiologia e Gestão Médica Avançada',
    active: true,
    defaultPassword: 'cardiovida2026',
  },
  {
    id: 'usr_admin_01',
    clinicId: 'clinic_cardiovida_01',
    name: 'Dr. Roberto Vasconcelos',
    email: 'admin@cardiovida.com.br',
    role: 'admin',
    crm: 'CRM/SP 142.890',
    specialty: 'Cardiologia e Gestão Médica',
    active: true,
    defaultPassword: 'cardiovida2026',
  },
  {
    id: 'usr_med_01',
    clinicId: 'clinic_cardiovida_01',
    name: 'Dra. Camila Albuquerque',
    email: 'camila.med@cardiovida.com.br',
    role: 'medico',
    crm: 'CRM/SP 189.432',
    specialty: 'Cardiologia e Arritmias',
    active: true,
    defaultPassword: 'cardiovida2026',
  },
  {
    id: 'usr_recep_01',
    clinicId: 'clinic_cardiovida_01',
    name: 'Juliana Mendes',
    email: 'recepcao@cardiovida.com.br',
    role: 'recepcao',
    specialty: 'Recepção e Atendimento WhatsApp',
    active: true,
    defaultPassword: 'cardiovida2026',
  },
  {
    id: 'usr_fin_01',
    clinicId: 'clinic_cardiovida_01',
    name: 'Carlos Eduardo Peixoto',
    email: 'financeiro@cardiovida.com.br',
    role: 'financeiro',
    specialty: 'Faturamento TISS e Convênios',
    active: true,
    defaultPassword: 'cardiovida2026',
  },
  {
    id: 'usr_terc_01',
    clinicId: 'clinic_cardiovida_01',
    name: 'Lucas Ferreira (Atendimento Noturno)',
    email: 'terceirizado@suportesaude.com.br',
    role: 'terceirizado',
    specialty: 'Suporte Terceirizado',
    active: true,
    defaultPassword: 'cardiovida2026',
  },
];

const INITIAL_CLINICS = [
  {
    id: 'clinic_cardiovida_01',
    name: 'CardioVida Centro Integrado de Cardiologia',
    unit: 'Unidade Jardins - SP',
    cnpj: '12.345.678/0001-90',
    phone: '(11) 3088-9000',
    address: 'Av. Brigadeiro Luís Antônio, 4500 - Jardins, São Paulo/SP',
    createdAt: '2026-01-01T00:00:00.000Z',
    isTrial: false,
  },
  {
    id: 'clinic_trial_optimusdrp',
    name: 'Clínica MediFlux & CardioVida (Trial 7 Dias)',
    unit: 'Unidade Prime (Ambiente de Teste Ativo)',
    cnpj: '45.981.234/0001-88',
    phone: '(11) 98765-4321',
    address: 'Av. Paulista, 2100 - Bela Vista, São Paulo/SP',
    createdAt: new Date().toISOString(),
    isTrial: true,
    trialEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

async function runSeed() {
  try {
    console.log('\n[1/3] Semeando dados das Clínicas (Tenants)...');
    for (const c of INITIAL_CLINICS) {
      const clinicRef = doc(db, 'clinics', c.id);
      await setDoc(clinicRef, c, { merge: true });
      console.log(`  ✅ Clínica "${c.name}" registrada com ID: ${c.id}`);
    }

    console.log('\n[2/3] Semeando os 4 Usuários de Testes no Firestore...');
    for (const testUser of INITIAL_TEST_USERS) {
      const normalizedEmail = testUser.email.toLowerCase().trim();
      const userDocId = normalizedEmail.replace(/[^a-zA-Z0-9_-]/g, '_');
      const userRef = doc(db, 'users', userDocId);

      const { hash, salt } = hashPassword(testUser.defaultPassword);

      const userRecord = {
        id: testUser.id,
        clinicId: testUser.clinicId,
        name: testUser.name,
        email: normalizedEmail,
        role: testUser.role,
        crm: testUser.crm || '',
        specialty: testUser.specialty || '',
        active: testUser.active,
        passwordHash: hash,
        passwordSalt: salt,
        registeredAt: '2026-01-01T00:00:00.000Z',
        lastLoginAt: new Date().toISOString(),
        authSource: 'firestore',
      };

      await setDoc(userRef, userRecord, { merge: true });
      console.log(`  ✅ [${testUser.role.toUpperCase()}] ${testUser.name}`);
      console.log(`     E-mail: ${normalizedEmail}`);
      console.log(`     Doc ID: ${userDocId} | Tenant: ${testUser.clinicId}`);
      console.log(`     Senha Padrão: ${testUser.defaultPassword}`);
    }

    console.log('\n[3/3] Validando leitura dos usuários cadastrados no Firestore...');
    const usersSnapshot = await getDocs(collection(db, 'users'));
    console.log(`  📊 Total de usuários encontrados na coleção "users": ${usersSnapshot.docs.length}`);

    console.log('\n====================================================');
    console.log('🎉 SUCESSO: Firestore populado com os usuários de teste!');
    console.log('====================================================\n');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Erro durante a população do Firestore:', error);
    process.exit(1);
  }
}

runSeed();
