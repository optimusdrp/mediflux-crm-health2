'use client';

import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, signInWithCustomToken, signOut, Auth } from 'firebase/auth';
import firebaseConfig from '@/firebase-applet-config.json';

// ---------------------------------------------------------------------------
// Inicialização do Firebase Auth do lado do CLIENT (browser) — separado
// de lib/db/firestore.ts de propósito, porque aquele arquivo importa o
// módulo `crypto` do Node (usado em hashPassword/verifyPassword) e não
// pode ser incluído com segurança no bundle enviado ao browser. Este
// módulo só cuida de autenticar a sessão do Firebase a partir do custom
// token gerado pelo backend (lib/security/firebaseAdmin.ts) — nunca lida
// com senha nem decide quem pode logar.
// ---------------------------------------------------------------------------

let _clientApp: FirebaseApp | null = null;
let _clientAuth: Auth | null = null;

function getFirebaseClientApp(): FirebaseApp {
  if (_clientApp) return _clientApp;
  const existingApps = getApps();
  _clientApp = existingApps.length > 0 ? getApp() : initializeApp({
    projectId: firebaseConfig.projectId,
    appId: firebaseConfig.appId,
    apiKey: firebaseConfig.apiKey,
    authDomain: firebaseConfig.authDomain,
    storageBucket: firebaseConfig.storageBucket,
    messagingSenderId: firebaseConfig.messagingSenderId,
  });
  return _clientApp;
}

function getFirebaseClientAuth(): Auth {
  if (_clientAuth) return _clientAuth;
  _clientAuth = getAuth(getFirebaseClientApp());
  return _clientAuth;
}

/**
 * Troca o custom token gerado pelo backend por uma sessão real do
 * Firebase no browser — depois desta chamada, request.auth passa a
 * existir de fato nas firestore.rules, para leituras/escritas que o
 * front-end eventualmente fizer diretamente no Firestore.
 *
 * "Melhor esforço": se firebaseToken vier null (Service Account não
 * configurada no backend) ou a troca falhar por qualquer motivo, a
 * sessão do JWT próprio (localStorage) continua sendo a autenticação
 * real de toda a aplicação — esta chamada nunca deveria bloquear o
 * fluxo de login por conta própria.
 */
export async function syncFirebaseAuthSession(firebaseToken: string | null): Promise<void> {
  if (!firebaseToken) return;
  try {
    await signInWithCustomToken(getFirebaseClientAuth(), firebaseToken);
  } catch (error) {
    console.warn('[Firebase Auth] Falha ao sincronizar sessão do Firestore (não bloqueante):', error);
  }
}

/** Encerra a sessão do Firebase no browser — chamado junto do logout do JWT próprio, para não deixar uma sessão do Firestore "presa" depois que o usuário já saiu do MediFlux. */
export async function clearFirebaseAuthSession(): Promise<void> {
  try {
    await signOut(getFirebaseClientAuth());
  } catch {
    // Sessão já encerrada ou nunca chegou a existir — não é um erro real.
  }
}
