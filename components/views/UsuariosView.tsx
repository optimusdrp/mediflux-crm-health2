'use client';

import React, { useState, useEffect } from 'react';
import { apiService } from '@/lib/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { User, Role } from '@/lib/types';
import {
  UserPlus,
  Edit3,
  Shield,
  ShieldOff,
  X,
  Save,
  Copy,
  CheckCircle2,
  Search,
  KeyRound,
  Lock,
} from 'lucide-react';

const ROLE_LABELS: Record<Role, string> = {
  admin: 'Administrador',
  medico: 'Profissional de Saúde / Médico',
  recepcao: 'Recepção',
  financeiro: 'Contador / Financeiro',
  terceirizado: 'Terceirizado',
};

const ROLE_OPTIONS: Role[] = ['admin', 'medico', 'recepcao', 'financeiro', 'terceirizado'];

interface UserFormState {
  name: string;
  email: string;
  role: Role;
  /** Perfis adicionais, além do principal (role acima) — o usuário tem a união das permissões de todos os perfis, a menos que um administrador defina uma permissão customizada para ele. */
  additionalRoles: Role[];
  specialty: string;
  crm: string;
}

const EMPTY_FORM: UserFormState = { name: '', email: '', role: 'recepcao', additionalRoles: [], specialty: '', crm: '' };

/**
 * Página de Gestão de Usuários — NOVA. Acesso restrito ao
 * Administrador: lista todos os usuários da clínica, permite
 * cadastrar novos, editar dados/perfil de acesso, e ativar/desativar
 * contas. Usuários nunca são excluídos de verdade — apenas
 * desativados, já que pacientes e logs de auditoria os referenciam
 * (excluir de verdade criaria registros órfãos e quebraria a trilha
 * de auditoria LGPD). Desativar já bloqueia login de fato no backend.
 */
export function UsuariosView() {
  const { user: currentUser } = useAuth();
  const { success, error } = useToast();

  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<Role | 'todos'>('todos');

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createForm, setCreateForm] = useState<UserFormState>(EMPTY_FORM);
  const [isSavingCreate, setIsSavingCreate] = useState(false);
  const [temporaryPasswordResult, setTemporaryPasswordResult] = useState<{ email: string; password: string } | null>(null);
  const [copiedPassword, setCopiedPassword] = useState(false);

  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editForm, setEditForm] = useState<UserFormState>(EMPTY_FORM);
  const [editNewPassword, setEditNewPassword] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const [pendingToggle, setPendingToggle] = useState<User | null>(null);

  /**
   * Configuração de visibilidade da fila de Atendimentos — o admin
   * decide se, por padrão, cada usuário vê só as conversas atribuídas
   * a ele mesmo ou a fila inteira (com opção de filtrar). Persistida
   * em ClinicSettings.queueVisibility; administradores sempre veem
   * tudo, a restrição vale só para os demais perfis.
   */
  const [restrictQueueToAssigned, setRestrictQueueToAssigned] = useState(false);
  const [isLoadingQueueConfig, setIsLoadingQueueConfig] = useState(true);
  const [isSavingQueueConfig, setIsSavingQueueConfig] = useState(false);

  const fetchQueueConfig = async () => {
    setIsLoadingQueueConfig(true);
    try {
      const res = await apiService.getClinicSettings();
      setRestrictQueueToAssigned(res.settings?.queueVisibility?.restrictToAssignedUser || false);
    } catch {
      // Silencioso — a tela funciona normalmente com o padrão (fila inteira visível).
    } finally {
      setIsLoadingQueueConfig(false);
    }
  };

  const handleToggleQueueRestriction = async () => {
    const next = !restrictQueueToAssigned;
    setIsSavingQueueConfig(true);
    try {
      await apiService.saveClinicSettings({ queueVisibility: { restrictToAssignedUser: next } });
      setRestrictQueueToAssigned(next);
      success(
        'Configuração Salva',
        next ? 'Cada usuário agora vê apenas as conversas atribuídas a ele.' : 'A equipe agora vê a fila completa de Atendimentos, com opção de filtrar.'
      );
    } catch (err: any) {
      error('Falha ao salvar configuração', err?.message || 'Tente novamente.');
    } finally {
      setIsSavingQueueConfig(false);
    }
  };

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const res = await apiService.getUsers();
      setUsers(res.users || []);
    } catch (err: any) {
      error('Falha ao carregar usuários', err?.message || 'Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchQueueConfig();
  }, []);

  const filteredUsers = users.filter((u) => {
    const matchesSearch = !search.trim() || u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase());
    const matchesRole = roleFilter === 'todos' || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const handleCreateUser = async () => {
    if (!createForm.name.trim() || !createForm.email.trim()) {
      error('Campos obrigatórios', 'Nome e e-mail são obrigatórios.');
      return;
    }
    setIsSavingCreate(true);
    try {
      const res = await apiService.createUser(createForm);
      setUsers((prev) => [...prev, res.user]);
      if (res.temporaryPassword) {
        setTemporaryPasswordResult({ email: res.user.email, password: res.temporaryPassword });
      } else {
        success('Usuário criado', `${res.user.name} foi cadastrado com sucesso.`);
        setIsCreateModalOpen(false);
      }
      setCreateForm(EMPTY_FORM);
    } catch (err: any) {
      error('Falha ao criar usuário', err?.message || 'Tente novamente.');
    } finally {
      setIsSavingCreate(false);
    }
  };

  const startEditingUser = (user: User) => {
    setEditingUser(user);
    setEditForm({ name: user.name, email: user.email, role: user.role, additionalRoles: user.additionalRoles || [], specialty: user.specialty || '', crm: user.crm || '' });
    setEditNewPassword('');
  };

  const handleSaveEdit = async () => {
    if (!editingUser || !editForm.name.trim()) return;
    setIsSavingEdit(true);
    try {
      const payload: any = { id: editingUser.id, name: editForm.name.trim(), role: editForm.role, additionalRoles: editForm.additionalRoles, specialty: editForm.specialty, crm: editForm.crm };
      if (editNewPassword.trim()) {
        if (editNewPassword.length < 8) {
          error('Senha muito curta', 'A nova senha deve ter pelo menos 8 caracteres.');
          setIsSavingEdit(false);
          return;
        }
        payload.newPassword = editNewPassword;
      }
      const res = await apiService.updateUser(payload);
      setUsers((prev) => prev.map((u) => (u.id === editingUser.id ? { ...u, ...res.user } : u)));
      success('Usuário atualizado', 'As alterações foram salvas.');
      setEditingUser(null);
    } catch (err: any) {
      error('Falha ao atualizar usuário', err?.message || 'Tente novamente.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleToggleActive = async (targetUser: User) => {
    try {
      const res = await apiService.updateUser({ id: targetUser.id, active: !targetUser.active });
      setUsers((prev) => prev.map((u) => (u.id === targetUser.id ? { ...u, ...res.user } : u)));
      success(targetUser.active ? 'Usuário desativado' : 'Usuário reativado', `${targetUser.name} ${targetUser.active ? 'não poderá mais acessar o sistema' : 'já pode acessar o sistema novamente'}.`);
      setPendingToggle(null);
    } catch (err: any) {
      error('Falha ao atualizar usuário', err?.message || 'Não é possível desativar sua própria conta.');
      setPendingToggle(null);
    }
  };

  const copyTemporaryPassword = () => {
    if (!temporaryPasswordResult) return;
    navigator.clipboard?.writeText(temporaryPasswordResult.password);
    setCopiedPassword(true);
    setTimeout(() => setCopiedPassword(false), 2000);
  };

  // Esta tela é só para administradores — quem chega aqui sem ser
  // admin (ex.: digitando a URL/tab diretamente) vê este aviso, sem
  // qualquer dado de outros usuários carregado ou exposto.
  if (currentUser?.role !== 'admin') {
    return (
      <div className="p-6 max-w-xl mx-auto text-center py-20">
        <Shield className="w-10 h-10 text-slate-300 mx-auto mb-3" />
        <h2 className="font-bold text-slate-700">Acesso restrito</h2>
        <p className="text-slate-500 text-xs mt-1">Apenas o Administrador da clínica pode gerenciar usuários.</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Usuários da Clínica</h2>
          <p className="text-xs text-slate-500 mt-0.5">Gerencie quem tem acesso ao sistema e qual o perfil de cada pessoa.</p>
        </div>
        <button
          onClick={() => {
            setCreateForm(EMPTY_FORM);
            setIsCreateModalOpen(true);
          }}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors shrink-0"
        >
          <UserPlus className="w-3.5 h-3.5" /> Novo Usuário
        </button>
      </div>

      {/* Visibilidade da Fila de Atendimentos — política da clínica */}
      {!isLoadingQueueConfig && (
        <div className="p-4 bg-white rounded-2xl border border-slate-200 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-slate-400" /> Visibilidade da Fila de Atendimentos
            </span>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {restrictQueueToAssigned
                ? 'Cada usuário vê apenas as conversas atribuídas a ele. Administradores sempre veem a fila inteira.'
                : 'Toda a equipe vê a fila completa de Atendimentos, com opção de filtrar por "Minhas Conversas".'}
            </p>
          </div>
          <button
            onClick={handleToggleQueueRestriction}
            disabled={isSavingQueueConfig}
            className={`shrink-0 relative w-11 h-6 rounded-full transition-colors disabled:opacity-50 ${
              restrictQueueToAssigned ? 'bg-sky-600' : 'bg-slate-300'
            }`}
          >
            <span
              className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-xs transition-transform ${
                restrictQueueToAssigned ? 'translate-x-5' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-2.5">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por nome ou e-mail..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-xs bg-white"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value as Role | 'todos')}
          className="px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white"
        >
          <option value="todos">Todos os perfis</option>
          {ROLE_OPTIONS.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </select>
      </div>

      {/* Lista de usuários */}
      {isLoading ? (
        <div className="text-center py-16 text-slate-400 text-xs">Carregando usuários...</div>
      ) : filteredUsers.length === 0 ? (
        <div className="text-center py-16 text-slate-400 text-xs">Nenhum usuário encontrado.</div>
      ) : (
        <div className="space-y-2">
          {filteredUsers.map((u) => (
            <div
              key={u.id}
              className={`p-4 bg-white rounded-2xl border flex items-center justify-between gap-3 ${
                u.active ? 'border-slate-200' : 'border-slate-200 opacity-60'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs font-bold shrink-0">
                  {u.name.split(' ').map((n) => n[0]).slice(0, 2).join('')}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 text-xs truncate">{u.name}</span>
                    {u.id === currentUser?.id && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-sky-100 text-sky-700 font-semibold shrink-0">Você</span>
                    )}
                    {!u.active && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-rose-100 text-rose-700 font-semibold shrink-0">Inativo</span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-500 truncate">{u.email}</div>
                  <div className="text-[11px] text-slate-400">
                    {ROLE_LABELS[u.role]}
                    {u.additionalRoles && u.additionalRoles.length > 0 && ` + ${u.additionalRoles.map((r) => ROLE_LABELS[r]).join(', ')}`}
                    {u.specialty ? ` • ${u.specialty}` : ''}
                    {u.crm ? ` • ${u.crm}` : ''}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => startEditingUser(u)}
                  className="p-2 text-slate-500 hover:text-sky-600 hover:bg-slate-50 rounded-lg transition-colors"
                  title="Editar usuário"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
                {u.id !== currentUser?.id && (
                  <button
                    onClick={() => setPendingToggle(u)}
                    className={`p-2 rounded-lg transition-colors ${
                      u.active ? 'text-slate-500 hover:text-rose-600 hover:bg-rose-50' : 'text-slate-500 hover:text-emerald-600 hover:bg-emerald-50'
                    }`}
                    title={u.active ? 'Desativar usuário' : 'Reativar usuário'}
                  >
                    {u.active ? <ShieldOff className="w-3.5 h-3.5" /> : <Shield className="w-3.5 h-3.5" />}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de criação */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            {temporaryPasswordResult ? (
              <div className="p-5 space-y-4">
                <div className="flex items-center gap-2 text-emerald-700 font-bold text-sm">
                  <CheckCircle2 className="w-5 h-5" /> Usuário criado com sucesso
                </div>
                <p className="text-xs text-slate-600">
                  Uma senha temporária foi gerada para <strong>{temporaryPasswordResult.email}</strong>. Copie e repasse ao usuário por um
                  canal seguro — ela não será exibida novamente.
                </p>
                <div className="flex items-center gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <code className="flex-1 font-mono text-sm text-slate-900">{temporaryPasswordResult.password}</code>
                  <button
                    onClick={copyTemporaryPassword}
                    className="p-1.5 text-slate-500 hover:text-sky-600 hover:bg-white rounded-lg transition-colors"
                    title="Copiar senha"
                  >
                    {copiedPassword ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-slate-600 text-xs">O usuário poderá trocar essa senha a qualquer momento em Meu Perfil → Alterar Senha.</p>
                <button
                  onClick={() => {
                    setTemporaryPasswordResult(null);
                    setIsCreateModalOpen(false);
                  }}
                  className="w-full py-2 bg-slate-900 text-white rounded-lg font-bold text-xs hover:bg-slate-800 transition-colors"
                >
                  Concluir
                </button>
              </div>
            ) : (
              <>
                <div className="p-5 border-b border-slate-200 flex items-center justify-between">
                  <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                    <UserPlus className="w-4 h-4 text-sky-600" /> Novo Usuário
                  </h3>
                  <button onClick={() => setIsCreateModalOpen(false)} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="p-5 space-y-3 text-xs">
                  <div>
                    <label className="block font-semibold text-slate-600 mb-1">Nome completo</label>
                    <input
                      type="text"
                      value={createForm.name}
                      onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-600 mb-1">E-mail</label>
                    <input
                      type="email"
                      value={createForm.email}
                      onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-600 mb-1">Perfil de Acesso (Principal)</label>
                    <select
                      value={createForm.role}
                      onChange={(e) => setCreateForm({ ...createForm, role: e.target.value as Role, additionalRoles: createForm.additionalRoles.filter((r) => r !== e.target.value) })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                    >
                      {ROLE_OPTIONS.map((r) => (
                        <option key={r} value={r}>
                          {ROLE_LABELS[r]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-600 mb-1">
                      Perfis Adicionais <span className="text-slate-400 font-normal">(opcional)</span>
                    </label>
                    <p className="text-[10px] text-slate-500 mb-1.5">O usuário terá a união das permissões de todos os perfis marcados.</p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {ROLE_OPTIONS.filter((r) => r !== createForm.role).map((r) => (
                        <label key={r} className="flex items-center gap-1.5 px-2.5 py-1.5 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50">
                          <input
                            type="checkbox"
                            checked={createForm.additionalRoles.includes(r)}
                            onChange={(e) =>
                              setCreateForm({
                                ...createForm,
                                additionalRoles: e.target.checked
                                  ? [...createForm.additionalRoles, r]
                                  : createForm.additionalRoles.filter((x) => x !== r),
                              })
                            }
                          />
                          <span>{ROLE_LABELS[r]}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-600 mb-1">Especialidade</label>
                      <input
                        type="text"
                        value={createForm.specialty}
                        onChange={(e) => setCreateForm({ ...createForm, specialty: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-600 mb-1">CRM (se aplicável)</label>
                      <input
                        type="text"
                        placeholder="CRM/UF 000000"
                        value={createForm.crm}
                        onChange={(e) => setCreateForm({ ...createForm, crm: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono"
                      />
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-400 flex items-center gap-1.5 pt-1">
                    <KeyRound className="w-3 h-3" /> Uma senha temporária será gerada automaticamente para o novo usuário.
                  </p>
                  <button
                    onClick={handleCreateUser}
                    disabled={isSavingCreate}
                    className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl font-bold transition-colors disabled:opacity-50"
                  >
                    <Save className="w-3.5 h-3.5" /> {isSavingCreate ? 'Criando...' : 'Criar Usuário'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Modal de edição */}
      {editingUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-sky-600" /> Editar Usuário
              </h3>
              <button onClick={() => setEditingUser(null)} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-600 mb-1">Nome completo</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-600 mb-1">E-mail</label>
                <input type="text" value={editForm.email} disabled className="w-full px-3 py-2 border border-slate-200 bg-slate-50 rounded-xl text-slate-500" />
              </div>
              <div>
                <label className="block font-semibold text-slate-600 mb-1">Perfil de Acesso (Principal)</label>
                <select
                  value={editForm.role}
                  onChange={(e) => setEditForm({ ...editForm, role: e.target.value as Role, additionalRoles: editForm.additionalRoles.filter((r) => r !== e.target.value) })}
                  disabled={editingUser.id === currentUser?.id}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl disabled:opacity-50"
                  title={editingUser.id === currentUser?.id ? 'Você não pode alterar seu próprio perfil de acesso' : ''}
                >
                  {ROLE_OPTIONS.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-600 mb-1">
                  Perfis Adicionais <span className="text-slate-400 font-normal">(opcional)</span>
                </label>
                <p className="text-[10px] text-slate-500 mb-1.5">O usuário terá a união das permissões de todos os perfis marcados.</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {ROLE_OPTIONS.filter((r) => r !== editForm.role).map((r) => (
                    <label key={r} className="flex items-center gap-1.5 px-2.5 py-1.5 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50">
                      <input
                        type="checkbox"
                        disabled={editingUser.id === currentUser?.id}
                        checked={editForm.additionalRoles.includes(r)}
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            additionalRoles: e.target.checked
                              ? [...editForm.additionalRoles, r]
                              : editForm.additionalRoles.filter((x) => x !== r),
                          })
                        }
                      />
                      <span>{ROLE_LABELS[r]}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-600 mb-1">Especialidade</label>
                  <input
                    type="text"
                    value={editForm.specialty}
                    onChange={(e) => setEditForm({ ...editForm, specialty: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-600 mb-1">CRM</label>
                  <input
                    type="text"
                    value={editForm.crm}
                    onChange={(e) => setEditForm({ ...editForm, crm: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono"
                  />
                </div>
              </div>
              <div className="pt-2 border-t border-slate-200">
                <label className="block font-semibold text-slate-600 mb-1">Redefinir senha (opcional)</label>
                <input
                  type="password"
                  placeholder="Deixe em branco para não alterar"
                  value={editNewPassword}
                  onChange={(e) => setEditNewPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                />
              </div>
              <button
                onClick={handleSaveEdit}
                disabled={isSavingEdit}
                className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl font-bold transition-colors disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" /> {isSavingEdit ? 'Salvando...' : 'Salvar Alterações'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmação de ativar/desativar */}
      {pendingToggle && (
        <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-5 max-w-sm w-full space-y-3 shadow-xl">
            <h4 className="font-bold text-slate-900 text-sm">
              {pendingToggle.active ? 'Desativar' : 'Reativar'} "{pendingToggle.name}"?
            </h4>
            <p className="text-slate-500 text-xs">
              {pendingToggle.active
                ? 'O usuário perderá o acesso ao sistema imediatamente. O histórico dele permanece intacto e você pode reativá-lo quando quiser.'
                : 'O usuário poderá acessar o sistema novamente com a mesma senha de antes.'}
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setPendingToggle(null)} className="px-3 py-1.5 rounded-lg text-slate-600 hover:bg-slate-100 font-semibold text-xs">
                Cancelar
              </button>
              <button
                onClick={() => handleToggleActive(pendingToggle)}
                className={`px-3 py-1.5 rounded-lg text-white font-semibold text-xs ${
                  pendingToggle.active ? 'bg-rose-600 hover:bg-rose-700' : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {pendingToggle.active ? 'Desativar' : 'Reativar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
