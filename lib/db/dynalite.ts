import dynalite from 'dynalite';
import {
  DynamoDBClient,
  CreateTableCommand,
  DescribeTableCommand,
  ListTablesCommand,
} from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  ScanCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import crypto from 'crypto';
import type { User, Clinic } from '@/lib/types';

// Global singleton for Dynalite instance and DynamoDB client across Next.js dev server reloads
declare global {
  var __dynalite_server: any | undefined;
  var __dynalite_client: DynamoDBClient | undefined;
  var __dynalite_doc_client: DynamoDBDocumentClient | undefined;
  var __dynalite_port: number | undefined;
  var __dynalite_initialized: boolean | undefined;
  var __dynalite_init_promise: Promise<void> | undefined;
}

const DYNALITE_DEFAULT_PORT = 4567;
const USERS_TABLE = 'MediFlux_Users';
const CLINICS_TABLE = 'MediFlux_Clinics';

export interface DynaliteUserRecord {
  email: string; // Partition Key (normalized lowercase)
  id: string;
  clinicId: string;
  name: string;
  role: 'admin' | 'recepcao' | 'medico' | 'financeiro' | 'terceirizado';
  crm?: string;
  specialty?: string;
  active: boolean;
  passwordHash: string;
  passwordSalt: string;
  registeredAt: string;
  lastLoginAt?: string;
  authSource: 'dynalite_dynamodb';
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
 * Verify password against stored hash & salt or demo pass
 */
export function verifyPassword(password: string, hash: string, salt: string): boolean {
  if (!password) return false;
  // Allow demo passwords or check pbkdf2
  const computed = crypto.pbkdf2Sync(password, salt, 1000, 32, 'sha256').toString('hex');
  return computed === hash;
}

/**
 * Initialize Dynalite local DynamoDB server and tables
 */
async function startDynaliteServer(): Promise<number> {
  if (global.__dynalite_port && global.__dynalite_server) {
    return global.__dynalite_port;
  }

  return new Promise((resolve, reject) => {
    const port = DYNALITE_DEFAULT_PORT;
    const server = dynalite({ createTableMs: 0 });

    server.listen(port, (err: any) => {
      if (err) {
        // If port is already in use (e.g. from previous hot-reload), reuse it
        if (err.code === 'EADDRINUSE') {
          console.log(`[Dynalite] Servidor já em execução na porta ${port}. Reutilizando.`);
          global.__dynalite_port = port;
          return resolve(port);
        }
        console.error('[Dynalite] Erro ao iniciar servidor:', err);
        return reject(err);
      }

      console.log(`[Dynalite] Servidor DynamoDB local iniciado com sucesso na porta ${port}`);
      global.__dynalite_server = server;
      global.__dynalite_port = port;
      resolve(port);
    });
  });
}

/**
 * Get DynamoDB Document Client connected to Dynalite
 */
export async function getDynaliteDocClient(): Promise<DynamoDBDocumentClient> {
  if (global.__dynalite_doc_client) {
    return global.__dynalite_doc_client;
  }

  const port = await startDynaliteServer();

  const client = new DynamoDBClient({
    endpoint: `http://127.0.0.1:${port}`,
    region: 'us-east-1',
    credentials: {
      accessKeyId: 'dynalite_mediflux_key',
      secretAccessKey: 'dynalite_mediflux_secret',
    },
  });

  const docClient = DynamoDBDocumentClient.from(client, {
    marshallOptions: { removeUndefinedValues: true },
  });

  global.__dynalite_client = client;
  global.__dynalite_doc_client = docClient;

  return docClient;
}

/**
 * Ensure DynamoDB tables and seed initial users in Dynalite
 */
export async function initializeDynaliteDatabase(): Promise<void> {
  if (global.__dynalite_initialized) return;

  if (global.__dynalite_init_promise) {
    return global.__dynalite_init_promise;
  }

  global.__dynalite_init_promise = (async () => {
    try {
      const port = await startDynaliteServer();
      const rawClient = new DynamoDBClient({
        endpoint: `http://127.0.0.1:${port}`,
        region: 'us-east-1',
        credentials: {
          accessKeyId: 'dynalite_mediflux_key',
          secretAccessKey: 'dynalite_mediflux_secret',
        },
      });

      // 1. Check & create Users table
      const listRes = await rawClient.send(new ListTablesCommand({}));
      const tableNames = listRes.TableNames || [];

      if (!tableNames.includes(USERS_TABLE)) {
        console.log(`[Dynalite] Criando tabela ${USERS_TABLE}...`);
        await rawClient.send(
          new CreateTableCommand({
            TableName: USERS_TABLE,
            AttributeDefinitions: [
              { AttributeName: 'email', AttributeType: 'S' },
            ],
            KeySchema: [
              { AttributeName: 'email', KeyType: 'HASH' },
            ],
            ProvisionedThroughput: {
              ReadCapacityUnits: 5,
              WriteCapacityUnits: 5,
            },
          })
        );
        console.log(`[Dynalite] Tabela ${USERS_TABLE} criada com sucesso.`);
      }

      // 2. Check & create Clinics table
      if (!tableNames.includes(CLINICS_TABLE)) {
        console.log(`[Dynalite] Criando tabela ${CLINICS_TABLE}...`);
        await rawClient.send(
          new CreateTableCommand({
            TableName: CLINICS_TABLE,
            AttributeDefinitions: [
              { AttributeName: 'id', AttributeType: 'S' },
            ],
            KeySchema: [
              { AttributeName: 'id', KeyType: 'HASH' },
            ],
            ProvisionedThroughput: {
              ReadCapacityUnits: 5,
              WriteCapacityUnits: 5,
            },
          })
        );
      }

      // 3. Seed demo users in Dynalite if not present
      const docClient = await getDynaliteDocClient();

      const demoUsers: Array<{
        user: Omit<User, 'active'> & { active?: boolean };
        passwords: string[];
      }> = [
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
            id: 'usr_recep_01',
            clinicId: 'clinic_cardiovida_01',
            name: 'Juliana Mendes',
            email: 'recepcao@cardiovida.com.br',
            role: 'recepcao',
            active: true,
          },
          passwords: ['cardiovida2026', '••••••••', 'recepcao123', 'demo', '123456'],
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
            id: 'usr_fin_01',
            clinicId: 'clinic_cardiovida_01',
            name: 'Carlos Eduardo Peixoto',
            email: 'financeiro@cardiovida.com.br',
            role: 'financeiro',
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
            active: true,
          },
          passwords: ['cardiovida2026', '••••••••', 'terceirizado123', 'demo', '123456'],
        },
      ];

      for (const item of demoUsers) {
        const emailKey = item.user.email.toLowerCase().trim();
        const existing = await docClient.send(
          new GetCommand({
            TableName: USERS_TABLE,
            Key: { email: emailKey },
          })
        );

        if (!existing.Item) {
          const { hash, salt } = hashPassword('cardiovida2026');
          const dynaliteRecord: DynaliteUserRecord = {
            email: emailKey,
            id: item.user.id,
            clinicId: item.user.clinicId,
            name: item.user.name,
            role: item.user.role,
            crm: item.user.crm,
            specialty: item.user.specialty,
            active: item.user.active ?? true,
            passwordHash: hash,
            passwordSalt: salt,
            registeredAt: '2026-01-01T00:00:00.000Z',
            authSource: 'dynalite_dynamodb',
          };

          await docClient.send(
            new PutCommand({
              TableName: USERS_TABLE,
              Item: dynaliteRecord,
            })
          );
          console.log(`[Dynalite] Usuário pré-cadastrado no DynamoDB: ${emailKey}`);
        }
      }

      global.__dynalite_initialized = true;
    } catch (error) {
      console.error('[Dynalite] Erro na inicialização do Dynalite:', error);
      throw error;
    }
  })();

  return global.__dynalite_init_promise;
}

/**
 * Get a user record directly from Dynalite DynamoDB by email
 */
export async function getUserByEmailInDynalite(email: string): Promise<DynaliteUserRecord | null> {
  await initializeDynaliteDatabase();
  const docClient = await getDynaliteDocClient();
  const normalizedEmail = (email || '').toLowerCase().trim();
  if (!normalizedEmail) return null;

  const result = await docClient.send(
    new GetCommand({
      TableName: USERS_TABLE,
      Key: { email: normalizedEmail },
    })
  );

  return (result.Item as DynaliteUserRecord) || null;
}

/**
 * Validates login directly against Dynalite DynamoDB table
 */
export async function validateDynaliteLogin(
  email: string,
  password?: string
): Promise<{
  success: boolean;
  user?: DynaliteUserRecord;
  errorCode?: 'USER_NOT_FOUND' | 'INVALID_PASSWORD' | 'INACTIVE_USER';
  message: string;
}> {
  await initializeDynaliteDatabase();
  const docClient = await getDynaliteDocClient();

  const normalizedEmail = (email || '').toLowerCase().trim();

  if (!normalizedEmail) {
    return {
      success: false,
      errorCode: 'USER_NOT_FOUND',
      message: 'O e-mail de acesso deve ser fornecido.',
    };
  }

  // 1. Query Dynalite table
  const result = await docClient.send(
    new GetCommand({
      TableName: USERS_TABLE,
      Key: { email: normalizedEmail },
    })
  );

  const userRecord = result.Item as DynaliteUserRecord | undefined;

  // CRITICAL REQUIREMENT: User must be registered in Dynalite
  if (!userRecord) {
    return {
      success: false,
      errorCode: 'USER_NOT_FOUND',
      message: `Acesso negado: Usuário "${normalizedEmail}" não está cadastrado no banco Dynalite. Cadastre-se no teste grátis ou use um perfil autorizado.`,
    };
  }

  if (!userRecord.active) {
    return {
      success: false,
      errorCode: 'INACTIVE_USER',
      message: 'Conta de usuário inativa no banco Dynalite. Contate o administrador.',
    };
  }

  // 2. Validate Password if provided
  if (password && password.trim().length > 0) {
    // Check if password matches stored hash OR standard demo pass
    const isPasswordValid =
      verifyPassword(password, userRecord.passwordHash, userRecord.passwordSalt) ||
      password === 'cardiovida2026' ||
      password === '••••••••' ||
      password === 'demo' ||
      password === 'admin123' ||
      password === '123456';

    if (!isPasswordValid) {
      return {
        success: false,
        errorCode: 'INVALID_PASSWORD',
        message: 'Senha incorreta para o usuário cadastrado no Dynalite.',
      };
    }
  }

  // 3. Update last login timestamp in Dynalite
  const now = new Date().toISOString();
  await docClient.send(
    new PutCommand({
      TableName: USERS_TABLE,
      Item: {
        ...userRecord,
        lastLoginAt: now,
      },
    })
  );

  return {
    success: true,
    user: { ...userRecord, lastLoginAt: now },
    message: 'Usuário autenticado com sucesso via banco Dynalite (DynamoDB Local).',
  };
}

/**
 * Register or update a user in Dynalite DynamoDB table
 */
export async function saveUserInDynalite(userData: {
  id: string;
  clinicId: string;
  name: string;
  email: string;
  role: 'admin' | 'recepcao' | 'medico' | 'financeiro' | 'terceirizado';
  crm?: string;
  specialty?: string;
  password?: string;
  active?: boolean;
}): Promise<DynaliteUserRecord> {
  await initializeDynaliteDatabase();
  const docClient = await getDynaliteDocClient();

  const normalizedEmail = userData.email.toLowerCase().trim();
  const rawPassword = userData.password || 'cardiovida2026';
  const { hash, salt } = hashPassword(rawPassword);

  const record: DynaliteUserRecord = {
    email: normalizedEmail,
    id: userData.id,
    clinicId: userData.clinicId,
    name: userData.name.trim(),
    role: userData.role,
    crm: userData.crm,
    specialty: userData.specialty,
    active: userData.active ?? true,
    passwordHash: hash,
    passwordSalt: salt,
    registeredAt: new Date().toISOString(),
    authSource: 'dynalite_dynamodb',
  };

  await docClient.send(
    new PutCommand({
      TableName: USERS_TABLE,
      Item: record,
    })
  );

  console.log(`[Dynalite] Novo usuário registrado no Dynalite: ${normalizedEmail} (${record.role})`);
  return record;
}

/**
 * List all users currently registered in Dynalite
 */
export async function listDynaliteUsers(): Promise<DynaliteUserRecord[]> {
  await initializeDynaliteDatabase();
  const docClient = await getDynaliteDocClient();

  const scanResult = await docClient.send(
    new ScanCommand({
      TableName: USERS_TABLE,
    })
  );

  return (scanResult.Items as DynaliteUserRecord[]) || [];
}

/**
 * Get Dynalite engine health and stats
 */
export async function getDynaliteStatus(): Promise<{
  online: boolean;
  port: number;
  tables: string[];
  userCount: number;
  engine: string;
}> {
  try {
    await initializeDynaliteDatabase();
    const port = global.__dynalite_port || DYNALITE_DEFAULT_PORT;
    const rawClient = global.__dynalite_client!;
    const listRes = await rawClient.send(new ListTablesCommand({}));
    const users = await listDynaliteUsers();

    return {
      online: true,
      port,
      tables: listRes.TableNames || [],
      userCount: users.length,
      engine: 'Dynalite In-Memory DynamoDB v3',
    };
  } catch (err: any) {
    return {
      online: false,
      port: DYNALITE_DEFAULT_PORT,
      tables: [],
      userCount: 0,
      engine: 'Dynalite (Offline/Error: ' + err.message + ')',
    };
  }
}
