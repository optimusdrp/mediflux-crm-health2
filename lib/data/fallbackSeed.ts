import { Patient, Appointment } from '../types';

// Dados fictícios de demonstração removidos a pedido do usuário.
// As telas que antes usavam este fallback agora exibem estado vazio
// (ex.: "Nenhum atendimento localizado.") quando a API não retorna
// pacientes/agendamentos reais.
export const FALLBACK_PATIENTS: Patient[] = [];

export const FALLBACK_APPOINTMENTS: Appointment[] = [];
