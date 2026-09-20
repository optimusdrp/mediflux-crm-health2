'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Appointment, Patient } from '@/lib/types';
import { apiService } from '@/lib/services/api';
import { useToast } from '@/contexts/ToastContext';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
  Clock,
  User,
  Stethoscope,
  RefreshCw,
} from 'lucide-react';

interface AgendaViewProps {
  onSelectPatient: (id: string) => void;
  /** Paciente pré-selecionado ao abrir esta tela vindo do bloqueio "exige agendamento" em Jornadas — abre o formulário de novo agendamento já com esse paciente escolhido. */
  prefilledPatientId?: string;
  /** Chamado assim que o paciente pré-selecionado é consumido (formulário aberto) — o chamador limpa o valor para não reabrir o formulário numa visita futura à Agenda. */
  onPrefilledPatientConsumed?: () => void;
}

const STATUS_COLORS: Record<Appointment['status'], string> = {
  agendado: 'bg-sky-100 text-sky-800 border-sky-300',
  confirmado: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  em_atendimento: 'bg-amber-100 text-amber-800 border-amber-300',
  concluido: 'bg-slate-100 text-slate-600 border-slate-300',
  cancelado: 'bg-rose-100 text-rose-700 border-rose-300 line-through',
  faltou: 'bg-orange-100 text-orange-800 border-orange-300',
};

const STATUS_LABELS: Record<Appointment['status'], string> = {
  agendado: 'Agendado',
  confirmado: 'Confirmado',
  em_atendimento: 'Em Atendimento',
  concluido: 'Concluído',
  cancelado: 'Cancelado',
  faltou: 'Faltou',
};

/**
 * Agenda — calendário mensal interativo de agendamentos. Antes, a
 * única forma de ver consultas era um contador na Visão Geral, sem
 * nenhuma tela para de fato criar, editar ou visualizar a agenda por
 * dia. Esta tela usa a API de Appointment que já existia no backend,
 * mas nunca tinha uma interface própria.
 */
export function AgendaView({ onSelectPatient, prefilledPatientId, onPrefilledPatientConsumed }: AgendaViewProps) {
  const { success, error } = useToast();
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [editingAppointment, setEditingAppointment] = useState<Partial<Appointment> | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [patientSearch, setPatientSearch] = useState('');

  const fetchAppointments = async () => {
    setIsLoading(true);
    try {
      const startDate = formatDateISO(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1));
      const endDate = formatDateISO(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0));
      const res = await apiService.getAppointments({ startDate, endDate });
      setAppointments(res.appointments || []);
    } catch (err: any) {
      error('Erro ao carregar agenda', err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAppointments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentMonth]);

  // Abre o formulário de novo agendamento automaticamente quando esta
  // tela é aberta a partir do bloqueio "exige agendamento" em
  // Jornadas — já com o paciente pré-selecionado.
  useEffect(() => {
    if (prefilledPatientId) {
      setEditingAppointment({ patientId: prefilledPatientId, durationMinutes: 30, status: 'agendado' });
      onPrefilledPatientConsumed?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefilledPatientId]);

  const openNewAppointmentModal = (dateISO?: string) => {
    setEditingAppointment({ date: dateISO, durationMinutes: 30, status: 'agendado' });
    setPatientSearch('');
  };

  const searchPatients = async (term: string) => {
    setPatientSearch(term);
    if (term.trim().length < 2) {
      setPatients([]);
      return;
    }
    try {
      const res = await apiService.getPatients({ search: term });
      setPatients(res.patients || []);
    } catch {
      setPatients([]);
    }
  };

  const handleSaveAppointment = async () => {
    if (!editingAppointment?.patientId || !editingAppointment.date || !editingAppointment.time) return;
    setIsSaving(true);
    try {
      if (editingAppointment.id) {
        const res = await apiService.updateAppointment(editingAppointment.id, editingAppointment);
        setAppointments((prev) => prev.map((a) => (a.id === res.appointment.id ? res.appointment : a)));
        success('Consulta Atualizada', 'O agendamento foi salvo.');
      } else {
        const selectedPatient = patients.find((p) => p.id === editingAppointment.patientId);
        const res = await apiService.createAppointment({
          ...editingAppointment,
          patientName: selectedPatient?.name || editingAppointment.patientName,
          specialty: selectedPatient?.specialty || editingAppointment.specialty,
        });
        setAppointments((prev) => [...prev, res.appointment]);
        success('Consulta Agendada', `${res.appointment.patientName} — ${formatDateBR(res.appointment.date)} às ${res.appointment.time}.`);
      }
      setEditingAppointment(null);
    } catch (err: any) {
      error('Erro ao salvar agendamento', err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateStatus = async (appointment: Appointment, status: Appointment['status']) => {
    try {
      const res = await apiService.updateAppointment(appointment.id, { status });
      setAppointments((prev) => prev.map((a) => (a.id === res.appointment.id ? res.appointment : a)));
    } catch (err: any) {
      error('Erro ao atualizar status', err.message);
    }
  };

  // Grade do mês: dias do mês anterior/seguinte preenchendo as
  // semanas incompletas, para o calendário sempre ter linhas
  // completas de 7 colunas.
  const calendarDays = useMemo(() => {
    const firstDayOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const lastDayOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
    const startWeekday = firstDayOfMonth.getDay();
    const days: { date: Date; isCurrentMonth: boolean }[] = [];

    for (let i = startWeekday - 1; i >= 0; i--) {
      const d = new Date(firstDayOfMonth);
      d.setDate(d.getDate() - i - 1);
      days.push({ date: d, isCurrentMonth: false });
    }
    for (let d = 1; d <= lastDayOfMonth.getDate(); d++) {
      days.push({ date: new Date(currentMonth.getFullYear(), currentMonth.getMonth(), d), isCurrentMonth: true });
    }
    while (days.length % 7 !== 0) {
      const last = days[days.length - 1].date;
      const d = new Date(last);
      d.setDate(d.getDate() + 1);
      days.push({ date: d, isCurrentMonth: false });
    }
    return days;
  }, [currentMonth]);

  const appointmentsByDate = useMemo(() => {
    const map: Record<string, Appointment[]> = {};
    for (const a of appointments) {
      if (a.status === 'cancelado') continue;
      if (!map[a.date]) map[a.date] = [];
      map[a.date].push(a);
    }
    Object.values(map).forEach((list) => list.sort((a, b) => a.time.localeCompare(b.time)));
    return map;
  }, [appointments]);

  const todayISO = formatDateISO(new Date());
  const selectedDayAppointments = selectedDate ? appointmentsByDate[selectedDate] || [] : [];

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-sky-50 flex items-center justify-center shrink-0">
            <Calendar className="w-5 h-5 text-sky-600" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Agenda de Consultas</h2>
            <p className="text-xs text-slate-500">Calendário de agendamentos da clínica.</p>
          </div>
        </div>
        <button
          onClick={() => openNewAppointmentModal()}
          className="flex items-center gap-1.5 px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> Novo Agendamento
        </button>
      </div>

      {/* Month Navigation */}
      <div className="flex items-center justify-between bg-white rounded-2xl border border-slate-200 p-3">
        <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
          <ChevronLeft className="w-4 h-4 text-slate-600" />
        </button>
        <span className="font-bold text-sm text-slate-900 capitalize">
          {currentMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
        </span>
        <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
          <ChevronRight className="w-4 h-4 text-slate-600" />
        </button>
      </div>

      {/* Calendar Grid */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="grid grid-cols-7 bg-slate-50 border-b border-slate-200">
          {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((d) => (
            <div key={d} className="p-2 text-center text-[11px] font-bold text-slate-500 uppercase">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {calendarDays.map(({ date, isCurrentMonth }, idx) => {
            const dateISO = formatDateISO(date);
            const dayAppointments = appointmentsByDate[dateISO] || [];
            const isToday = dateISO === todayISO;

            return (
              <button
                key={idx}
                onClick={() => setSelectedDate(dateISO)}
                className={`min-h-[80px] sm:min-h-[100px] p-1.5 border-r border-b border-slate-100 text-left transition-colors hover:bg-sky-50/50 ${
                  !isCurrentMonth ? 'bg-slate-50/50' : ''
                } ${selectedDate === dateISO ? 'ring-2 ring-inset ring-sky-400' : ''}`}
              >
                <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[11px] font-bold ${
                  isToday ? 'bg-sky-600 text-white' : isCurrentMonth ? 'text-slate-700' : 'text-slate-300'
                }`}>
                  {date.getDate()}
                </span>
                <div className="mt-1 space-y-0.5">
                  {dayAppointments.slice(0, 2).map((a) => (
                    <div key={a.id} className={`px-1 py-0.5 rounded text-[9px] font-semibold truncate border ${STATUS_COLORS[a.status]}`}>
                      {a.time} {a.patientName}
                    </div>
                  ))}
                  {dayAppointments.length > 2 && (
                    <div className="text-[9px] text-slate-400 font-semibold pl-1">+{dayAppointments.length - 2} mais</div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Painel do dia selecionado */}
      {selectedDate && (
        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-900">{formatDateBR(selectedDate)}</h3>
            <button
              onClick={() => openNewAppointmentModal(selectedDate)}
              className="flex items-center gap-1 px-2.5 py-1 bg-sky-50 text-sky-700 rounded-lg text-[11px] font-bold hover:bg-sky-100 transition-colors"
            >
              <Plus className="w-3 h-3" /> Agendar neste dia
            </button>
          </div>
          {selectedDayAppointments.length === 0 ? (
            <p className="text-xs text-slate-400 italic py-3 text-center">Nenhuma consulta agendada neste dia.</p>
          ) : (
            <div className="space-y-2">
              {selectedDayAppointments.map((a) => (
                <div key={a.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between gap-3">
                  <button onClick={() => setEditingAppointment(a)} className="flex items-center gap-3 min-w-0 text-left flex-1">
                    <div className="w-10 text-center shrink-0">
                      <Clock className="w-3.5 h-3.5 text-slate-400 mx-auto" />
                      <span className="text-[11px] font-bold text-slate-700">{a.time}</span>
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-xs text-slate-900 truncate">{a.patientName}</div>
                      <div className="text-[11px] text-slate-500 truncate">{a.doctorName} • {a.procedure}</div>
                    </div>
                  </button>
                  <span className={`shrink-0 px-2 py-0.5 rounded text-[10px] font-bold border ${STATUS_COLORS[a.status]}`}>
                    {STATUS_LABELS[a.status]}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal de criar/editar agendamento */}
      {editingAppointment && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4" onClick={() => !isSaving && setEditingAppointment(null)}>
          <div className="bg-white rounded-2xl p-5 max-w-md w-full space-y-4 shadow-xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-slate-900 text-sm">{editingAppointment.id ? 'Editar Consulta' : 'Nova Consulta'}</h4>
              <button onClick={() => setEditingAppointment(null)} className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            {!editingAppointment.id && (
              <div>
                <label className="block font-semibold text-slate-600 mb-1 text-xs flex items-center gap-1">
                  <User className="w-3.5 h-3.5" /> Paciente
                </label>
                {editingAppointment.patientId && !patientSearch ? (
                  <div className="flex items-center justify-between px-3 py-2 bg-sky-50 border border-sky-200 rounded-xl text-xs">
                    <span className="font-semibold text-sky-900">{editingAppointment.patientName || 'Paciente selecionado'}</span>
                    <button onClick={() => setEditingAppointment((prev) => (prev ? { ...prev, patientId: undefined, patientName: undefined } : prev))} className="text-sky-600 text-[11px] font-bold">
                      Trocar
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Buscar paciente por nome..."
                      value={patientSearch}
                      onChange={(e) => searchPatients(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs"
                    />
                    {patients.length > 0 && (
                      <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg max-h-40 overflow-y-auto">
                        {patients.map((p) => (
                          <button
                            key={p.id}
                            onClick={() => {
                              setEditingAppointment((prev) => (prev ? { ...prev, patientId: p.id, patientName: p.name, specialty: p.specialty } : prev));
                              setPatientSearch('');
                              setPatients([]);
                            }}
                            className="w-full text-left px-3 py-2 hover:bg-slate-50 text-xs border-b border-slate-100 last:border-0"
                          >
                            {p.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-600 mb-1 text-xs">Data</label>
                <input
                  type="date"
                  value={editingAppointment.date || ''}
                  onChange={(e) => setEditingAppointment((prev) => (prev ? { ...prev, date: e.target.value } : prev))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-600 mb-1 text-xs">Horário</label>
                <input
                  type="time"
                  value={editingAppointment.time || ''}
                  onChange={(e) => setEditingAppointment((prev) => (prev ? { ...prev, time: e.target.value } : prev))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-600 mb-1 text-xs flex items-center gap-1">
                <Stethoscope className="w-3.5 h-3.5" /> Médico(a)
              </label>
              <input
                type="text"
                placeholder="Dr(a). Nome"
                value={editingAppointment.doctorName || ''}
                onChange={(e) => setEditingAppointment((prev) => (prev ? { ...prev, doctorName: e.target.value } : prev))}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-600 mb-1 text-xs">Procedimento</label>
                <input
                  type="text"
                  placeholder="Consulta Médica"
                  value={editingAppointment.procedure || ''}
                  onChange={(e) => setEditingAppointment((prev) => (prev ? { ...prev, procedure: e.target.value } : prev))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-600 mb-1 text-xs">Duração (min)</label>
                <input
                  type="number"
                  min={5}
                  step={5}
                  value={editingAppointment.durationMinutes || 30}
                  onChange={(e) => setEditingAppointment((prev) => (prev ? { ...prev, durationMinutes: Number(e.target.value) } : prev))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono"
                />
              </div>
            </div>

            {editingAppointment.id && (
              <div>
                <label className="block font-semibold text-slate-600 mb-1 text-xs">Status</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(Object.keys(STATUS_LABELS) as Appointment['status'][]).map((s) => (
                    <button
                      key={s}
                      onClick={() => setEditingAppointment((prev) => (prev ? { ...prev, status: s } : prev))}
                      className={`px-2 py-1.5 rounded-lg text-[10px] font-bold border transition-colors ${
                        editingAppointment.status === s ? STATUS_COLORS[s] : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {STATUS_LABELS[s]}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="block font-semibold text-slate-600 mb-1 text-xs">Notas (opcional)</label>
              <textarea
                rows={2}
                value={editingAppointment.notes || ''}
                onChange={(e) => setEditingAppointment((prev) => (prev ? { ...prev, notes: e.target.value } : prev))}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs resize-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setEditingAppointment(null)} disabled={isSaving} className="px-3 py-1.5 rounded-lg text-slate-600 hover:bg-slate-100 font-semibold text-xs disabled:opacity-50">
                Cancelar
              </button>
              <button
                onClick={handleSaveAppointment}
                disabled={isSaving || !editingAppointment.patientId || !editingAppointment.date || !editingAppointment.time}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs disabled:opacity-40 transition-colors"
              >
                {isSaving && <RefreshCw className="w-3 h-3 animate-spin" />}
                {isSaving ? 'Salvando...' : editingAppointment.id ? 'Salvar Alterações' : 'Confirmar Agendamento'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function formatDateISO(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDateBR(dateISO: string): string {
  const [year, month, day] = dateISO.split('-');
  return `${day}/${month}/${year}`;
}
