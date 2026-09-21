'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Contact, ContactGroup, Funnel } from '@/lib/types';
import { apiService } from '@/lib/services/api';
import { useToast } from '@/contexts/ToastContext';
import {
  Users,
  UserPlus,
  Search,
  Phone,
  Mail,
  Edit3,
  Trash2,
  X,
  Sparkles,
  Tag,
  ArrowRight,
  FolderPlus,
  Folder,
} from 'lucide-react';

interface ContatosViewProps {
  onSelectPatient: (id: string) => void;
}

type ContactTab = 'paciente' | 'lead' | 'outro' | 'grupos';

const TAB_LABELS: Record<ContactTab, string> = {
  paciente: 'Pacientes',
  lead: 'Leads',
  outro: 'Outros Contatos',
  grupos: 'Grupos',
};

const LEAD_STATUS_LABELS: Record<string, string> = {
  novo: 'Novo',
  em_contato: 'Em Contato',
  qualificado: 'Qualificado',
  convertido: 'Convertido',
  perdido: 'Perdido',
};

const LEAD_STATUS_COLORS: Record<string, string> = {
  novo: 'bg-slate-100 text-slate-700',
  em_contato: 'bg-sky-100 text-sky-700',
  qualificado: 'bg-amber-100 text-amber-800',
  convertido: 'bg-emerald-100 text-emerald-700',
  perdido: 'bg-rose-100 text-rose-700',
};

interface ContactFormState {
  name: string;
  phone: string;
  email: string;
  notes: string;
  leadStatus: string;
  tags: string;
  /** Vincula o lead a uma etapa de um funil real — quando escolhidos, o lead já nasce como um Patient real (patientStatus: 'lead'), participando do Kanban normalmente. */
  funnelId: string;
  funnelStage: string;
}

const EMPTY_FORM: ContactFormState = { name: '', phone: '', email: '', notes: '', leadStatus: 'novo', tags: '', funnelId: '', funnelStage: '' };

/**
 * Central de Contatos — unifica pacientes (Patient, refletido
 * automaticamente), leads (interessados que ainda não viraram
 * pacientes) e outros contatos (fornecedores, parceiros, etc.) numa
 * única tela com 3 abas. Antes disso, "lead" era só um campo dentro
 * de Patient (leadScore), misturado com pacientes reais, sem
 * distinção nem lugar próprio para gerenciar.
 */
export function ContatosView({ onSelectPatient }: ContatosViewProps) {
  const { success, error } = useToast();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [funnels, setFunnels] = useState<Funnel[]>([]);
  const [groups, setGroups] = useState<ContactGroup[]>([]);
  const [isLoadingGroups, setIsLoadingGroups] = useState(true);
  const [editingGroup, setEditingGroup] = useState<Partial<ContactGroup> | null>(null);
  const [isSavingGroup, setIsSavingGroup] = useState(false);
  const [pendingGroupDeleteId, setPendingGroupDeleteId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ContactTab>('paciente');
  const [search, setSearch] = useState('');

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createForm, setCreateForm] = useState<ContactFormState>(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);

  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [editForm, setEditForm] = useState<ContactFormState>(EMPTY_FORM);

  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const fetchContacts = async () => {
    setIsLoading(true);
    try {
      const [contactsRes, settingsRes] = await Promise.allSettled([
        apiService.getContacts(),
        apiService.getClinicSettings(),
      ]);
      if (contactsRes.status === 'fulfilled') {
        setContacts(contactsRes.value.contacts || []);
      }
      if (settingsRes.status === 'fulfilled') {
        setFunnels(settingsRes.value.settings?.funnels || []);
      }
    } catch (err: any) {
      error('Erro ao carregar contatos', err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchGroups = async () => {
    setIsLoadingGroups(true);
    try {
      const res = await apiService.getContactGroups();
      setGroups(res.groups || []);
    } catch (err: any) {
      error('Erro ao carregar grupos', err.message);
    } finally {
      setIsLoadingGroups(false);
    }
  };

  useEffect(() => {
    fetchContacts();
    fetchGroups();
  }, []);

  const tabCounts = useMemo(() => {
    return {
      paciente: contacts.filter((c) => c.type === 'paciente').length,
      lead: contacts.filter((c) => c.type === 'lead').length,
      outro: contacts.filter((c) => c.type === 'outro').length,
    };
  }, [contacts]);

  const filteredContacts = useMemo(() => {
    return contacts
      .filter((c) => c.type === activeTab)
      .filter((c) => {
        if (!search.trim()) return true;
        const term = search.toLowerCase();
        return (c.name || '').toLowerCase().includes(term) || (c.phone || '').includes(search);
      });
  }, [contacts, activeTab, search]);

  const openCreateModal = () => {
    setCreateForm(EMPTY_FORM);
    setIsCreateModalOpen(true);
  };

  const handleCreate = async () => {
    if (!createForm.name.trim()) {
      error('Nome obrigatório', 'Informe o nome do contato.');
      return;
    }
    setIsSaving(true);
    try {
      const res = await apiService.createContact({
        type: activeTab === 'paciente' ? 'lead' : (activeTab as 'lead' | 'outro'),
        name: createForm.name.trim(),
        phone: createForm.phone.trim() || undefined,
        email: createForm.email.trim() || undefined,
        notes: createForm.notes.trim() || undefined,
        leadStatus: activeTab !== 'outro' ? (createForm.leadStatus as Contact['leadStatus']) : undefined,
        tags: createForm.tags ? createForm.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
        funnelId: activeTab !== 'outro' && createForm.funnelId ? createForm.funnelId : undefined,
        funnelStage: activeTab !== 'outro' && createForm.funnelStage ? createForm.funnelStage : undefined,
      });
      setContacts((prev) => [...prev, res.contact]);
      success('Contato Criado', res.patient ? `"${res.contact.name}" foi adicionado ao funil "${funnels.find((f) => f.id === createForm.funnelId)?.name}".` : `"${res.contact.name}" foi adicionado.`);
      setIsCreateModalOpen(false);
    } catch (err: any) {
      error('Falha ao criar contato', err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const openEditModal = (contact: Contact) => {
    setEditingContact(contact);
    setEditForm({
      name: contact.name || '',
      phone: contact.phone || '',
      email: contact.email || '',
      notes: contact.notes || '',
      leadStatus: contact.leadStatus || 'novo',
      tags: (contact.tags || []).join(', '),
      funnelId: '',
      funnelStage: '',
    });
  };

  const handleSaveEdit = async () => {
    if (!editingContact || !editForm.name.trim()) return;
    setIsSaving(true);
    try {
      const res = await apiService.updateContact({
        id: editingContact.id,
        name: editForm.name.trim(),
        phone: editForm.phone.trim() || undefined,
        email: editForm.email.trim() || undefined,
        notes: editForm.notes.trim() || undefined,
        leadStatus: editingContact.type === 'lead' ? (editForm.leadStatus as Contact['leadStatus']) : undefined,
        tags: editForm.tags ? editForm.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
        funnelId: editingContact.type === 'lead' && !editingContact.patientId && editForm.funnelId ? editForm.funnelId : undefined,
        funnelStage: editingContact.type === 'lead' && !editingContact.patientId && editForm.funnelStage ? editForm.funnelStage : undefined,
      });
      if (res.patient) {
        // O Contact simples foi promovido a Patient — recarrega a
        // lista inteira, já que o id do registro mudou (o Contact
        // antigo foi removido, um novo derivado do Patient tomou seu lugar).
        await fetchContacts();
        success('Lead Vinculado ao Funil', `"${res.contact.name}" agora participa do Kanban de Jornadas.`);
      } else {
        setContacts((prev) => prev.map((c) => (c.id === res.contact.id ? res.contact : c)));
        success('Contato Atualizado', 'As alterações foram salvas.');
      }
      setEditingContact(null);
    } catch (err: any) {
      error('Falha ao atualizar contato', err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!pendingDeleteId) return;
    try {
      await apiService.deleteContact(pendingDeleteId);
      setContacts((prev) => prev.filter((c) => c.id !== pendingDeleteId));
      success('Contato Removido', 'O contato foi excluído.');
      setPendingDeleteId(null);
    } catch (err: any) {
      error('Falha ao excluir contato', err.message);
      setPendingDeleteId(null);
    }
  };

  const openNewGroupModal = () => {
    setEditingGroup({ name: '', description: '', contactIds: [] });
  };

  const handleSaveGroup = async () => {
    if (!editingGroup?.name?.trim()) return;
    setIsSavingGroup(true);
    try {
      if (editingGroup.id) {
        await apiService.updateContactGroup({
          id: editingGroup.id,
          name: editingGroup.name.trim(),
          description: editingGroup.description,
          contactIds: editingGroup.contactIds || [],
        });
        setGroups((prev) => prev.map((g) => (g.id === editingGroup.id ? { ...g, ...editingGroup, name: editingGroup.name!.trim() } as ContactGroup : g)));
        success('Grupo Atualizado', 'As alterações foram salvas.');
      } else {
        const res = await apiService.createContactGroup({
          name: editingGroup.name.trim(),
          description: editingGroup.description,
          contactIds: editingGroup.contactIds || [],
        });
        setGroups((prev) => [...prev, res.group]);
        success('Grupo Criado', `"${res.group.name}" foi criado.`);
      }
      setEditingGroup(null);
    } catch (err: any) {
      error('Falha ao salvar grupo', err.message);
    } finally {
      setIsSavingGroup(false);
    }
  };

  const handleDeleteGroup = async () => {
    if (!pendingGroupDeleteId) return;
    try {
      await apiService.deleteContactGroup(pendingGroupDeleteId);
      setGroups((prev) => prev.filter((g) => g.id !== pendingGroupDeleteId));
      success('Grupo Removido', 'O grupo foi excluído — os contatos dele não foram afetados.');
      setPendingGroupDeleteId(null);
    } catch (err: any) {
      error('Falha ao excluir grupo', err.message);
      setPendingGroupDeleteId(null);
    }
  };

  const initials = (name?: string) =>
    (name || '?')
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-sky-50 flex items-center justify-center shrink-0">
            <Users className="w-5 h-5 text-sky-600" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Central de Contatos</h2>
            <p className="text-xs text-slate-500">Pacientes, leads e outros contatos, tudo num só lugar.</p>
          </div>
        </div>
        <button
          onClick={activeTab === 'grupos' ? openNewGroupModal : openCreateModal}
          className="flex items-center gap-1.5 px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
        >
          {activeTab === 'grupos' ? (
            <>
              <FolderPlus className="w-3.5 h-3.5" /> Novo Grupo
            </>
          ) : (
            <>
              <UserPlus className="w-3.5 h-3.5" /> {activeTab === 'paciente' ? 'Novo Lead' : `Novo ${activeTab === 'lead' ? 'Lead' : 'Contato'}`}
            </>
          )}
        </button>
      </div>

      {/* Tabs */}
      <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-xl w-fit flex-wrap">
        {(['paciente', 'lead', 'outro', 'grupos'] as ContactTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 ${
              activeTab === tab ? 'bg-white text-sky-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {TAB_LABELS[tab]}
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === tab ? 'bg-sky-100 text-sky-700' : 'bg-slate-200 text-slate-600'}`}>
              {tab === 'grupos' ? groups.length : tabCounts[tab]}
            </span>
          </button>
        ))}
      </div>

      {/* Search */}
      {activeTab !== 'grupos' && (
      <div className="relative max-w-sm">
        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
        <input
          type="text"
          placeholder="Buscar por nome ou telefone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8 pr-3 py-1.5 w-full bg-white border border-slate-200 rounded-lg text-xs focus:outline-hidden focus:ring-1 focus:ring-sky-500"
        />
      </div>
      )}

      {/* List */}
      {activeTab === 'grupos' ? (
        isLoadingGroups ? (
          <div className="text-center py-16 text-slate-400 text-xs">Carregando grupos...</div>
        ) : groups.length === 0 ? (
          <div className="text-center py-16 text-slate-400 text-xs">Nenhum grupo criado ainda.</div>
        ) : (
          <div className="space-y-2">
            {groups.map((group) => (
              <div key={group.id} className="bg-white p-3.5 rounded-xl border border-slate-200 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                    <Folder className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-xs text-slate-900 truncate">{group.name}</div>
                    <div className="text-[11px] text-slate-500 truncate">
                      {group.description ? `${group.description} • ` : ''}{(group.contactIds || []).length} contato{(group.contactIds || []).length !== 1 ? 's' : ''}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => setEditingGroup(group)} className="p-1.5 text-slate-400 hover:text-sky-600 hover:bg-slate-50 rounded-lg transition-colors">
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => setPendingGroupDeleteId(group.id)} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-slate-50 rounded-lg transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      ) : isLoading ? (
        <div className="text-center py-16 text-slate-400 text-xs">Carregando contatos...</div>
      ) : filteredContacts.length === 0 ? (
        <div className="text-center py-16 text-slate-400 text-xs">
          Nenhum contato nesta aba{search ? ' para essa busca' : ''}.
        </div>
      ) : (
        <div className="space-y-2">
          {filteredContacts.map((contact) => (
            <div key={contact.id} className="bg-white p-3.5 rounded-xl border border-slate-200 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs font-bold shrink-0">
                  {initials(contact.name)}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-slate-900 truncate">{contact.name}</span>
                    {contact.type === 'lead' && contact.leadStatus && (
                      <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold shrink-0 ${LEAD_STATUS_COLORS[contact.leadStatus]}`}>
                        {LEAD_STATUS_LABELS[contact.leadStatus]}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-0.5">
                    {contact.phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="w-3 h-3" /> {contact.phone}
                      </span>
                    )}
                    {contact.email && (
                      <span className="flex items-center gap-1 truncate">
                        <Mail className="w-3 h-3 shrink-0" /> {contact.email}
                      </span>
                    )}
                  </div>
                  {contact.tags && contact.tags.length > 0 && (
                    <div className="flex items-center gap-1 mt-1 flex-wrap">
                      {contact.tags.map((tag) => (
                        <span key={tag} className="px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded text-[10px] flex items-center gap-0.5">
                          <Tag className="w-2.5 h-2.5" /> {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                {contact.type === 'paciente' && contact.patientId ? (
                  <button
                    onClick={() => onSelectPatient(contact.patientId!)}
                    className="flex items-center gap-1 px-2.5 py-1.5 bg-sky-50 text-sky-700 rounded-lg text-[11px] font-bold hover:bg-sky-100 transition-colors"
                  >
                    Abrir Atendimento <ArrowRight className="w-3 h-3" />
                  </button>
                ) : (
                  <>
                    <button onClick={() => openEditModal(contact)} className="p-1.5 text-slate-400 hover:text-sky-600 hover:bg-slate-50 rounded-lg transition-colors">
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => setPendingDeleteId(contact.id)} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-slate-50 rounded-lg transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de criar contato */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4" onClick={() => !isSaving && setIsCreateModalOpen(false)}>
          <div className="bg-white rounded-2xl p-5 max-w-md w-full space-y-3 shadow-xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-sky-600" /> Novo {activeTab === 'outro' ? 'Contato' : 'Lead'}
              </h4>
              <button onClick={() => setIsCreateModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <ContactFormFields form={createForm} setForm={setCreateForm} showLeadStatus={activeTab !== 'outro'} funnels={funnels} showFunnelSelector={activeTab !== 'outro'} />
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setIsCreateModalOpen(false)} disabled={isSaving} className="px-3 py-1.5 rounded-lg text-slate-600 hover:bg-slate-100 font-semibold text-xs disabled:opacity-50">
                Cancelar
              </button>
              <button
                onClick={handleCreate}
                disabled={isSaving || !createForm.name.trim() || (!!createForm.funnelId && !!createForm.funnelStage && !createForm.phone.trim())}
                className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs disabled:opacity-40 transition-colors"
              >
                {isSaving ? 'Salvando...' : 'Criar Contato'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de editar contato */}
      {editingContact && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4" onClick={() => !isSaving && setEditingContact(null)}>
          <div className="bg-white rounded-2xl p-5 max-w-md w-full space-y-3 shadow-xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-slate-900 text-sm">Editar Contato</h4>
              <button onClick={() => setEditingContact(null)} className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <ContactFormFields
              form={editForm}
              setForm={setEditForm}
              showLeadStatus={editingContact.type === 'lead'}
              funnels={funnels}
              showFunnelSelector={editingContact.type === 'lead' && !editingContact.patientId}
            />
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setEditingContact(null)} disabled={isSaving} className="px-3 py-1.5 rounded-lg text-slate-600 hover:bg-slate-100 font-semibold text-xs disabled:opacity-50">
                Cancelar
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={isSaving || !editForm.name.trim()}
                className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs disabled:opacity-40 transition-colors"
              >
                {isSaving ? 'Salvando...' : 'Salvar Alterações'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmação de exclusão */}
      {pendingDeleteId && (
        <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-5 max-w-sm w-full space-y-3 shadow-xl">
            <h4 className="font-bold text-slate-900 text-sm">Excluir este contato?</h4>
            <p className="text-slate-500 text-xs">Esta ação não pode ser desfeita.</p>
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setPendingDeleteId(null)} className="px-3 py-1.5 rounded-lg text-slate-600 hover:bg-slate-100 font-semibold text-xs">
                Cancelar
              </button>
              <button onClick={handleDelete} className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs transition-colors">
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de criar/editar grupo */}
      {editingGroup && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4" onClick={() => !isSavingGroup && setEditingGroup(null)}>
          <div className="bg-white rounded-2xl p-5 max-w-md w-full space-y-3 shadow-xl max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                <Folder className="w-4 h-4 text-indigo-600" /> {editingGroup.id ? 'Editar Grupo' : 'Novo Grupo'}
              </h4>
              <button onClick={() => setEditingGroup(null)} className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="text-xs space-y-3">
              <div>
                <label className="block font-semibold text-slate-600 mb-1">Nome do grupo</label>
                <input
                  type="text"
                  placeholder="Ex.: Convênio Unimed, Leads de Instagram"
                  value={editingGroup.name || ''}
                  onChange={(e) => setEditingGroup((prev) => (prev ? { ...prev, name: e.target.value } : prev))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-600 mb-1">Descrição (opcional)</label>
                <input
                  type="text"
                  value={editingGroup.description || ''}
                  onChange={(e) => setEditingGroup((prev) => (prev ? { ...prev, description: e.target.value } : prev))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                />
              </div>
              <div className="flex-1 overflow-hidden flex flex-col">
                <label className="block font-semibold text-slate-600 mb-1">
                  Contatos <span className="text-slate-400 font-normal">(pacientes, leads e outros, juntos)</span>
                </label>
                <div className="max-h-56 overflow-y-auto space-y-1 border border-slate-200 rounded-xl p-1.5">
                  {contacts.length === 0 ? (
                    <p className="text-center text-slate-400 py-3">Nenhum contato cadastrado ainda.</p>
                  ) : (
                    contacts.map((c) => (
                      <label key={c.id} className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-50 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={(editingGroup.contactIds || []).includes(c.id)}
                          onChange={(e) =>
                            setEditingGroup((prev) => {
                              if (!prev) return prev;
                              const current = prev.contactIds || [];
                              return { ...prev, contactIds: e.target.checked ? [...current, c.id] : current.filter((id) => id !== c.id) };
                            })
                          }
                        />
                        <span className={`shrink-0 px-1.5 py-0.2 rounded text-[9px] font-bold ${
                          c.type === 'paciente' ? 'bg-emerald-100 text-emerald-700' : c.type === 'lead' ? 'bg-sky-100 text-sky-700' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {c.type === 'paciente' ? 'PAC' : c.type === 'lead' ? 'LEAD' : 'OUTRO'}
                        </span>
                        <span className="truncate">{c.name}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setEditingGroup(null)} disabled={isSavingGroup} className="px-3 py-1.5 rounded-lg text-slate-600 hover:bg-slate-100 font-semibold text-xs disabled:opacity-50">
                Cancelar
              </button>
              <button
                onClick={handleSaveGroup}
                disabled={isSavingGroup || !editingGroup.name?.trim()}
                className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs disabled:opacity-40 transition-colors"
              >
                {isSavingGroup ? 'Salvando...' : 'Salvar Grupo'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmação de exclusão de grupo */}
      {pendingGroupDeleteId && (
        <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-5 max-w-sm w-full space-y-3 shadow-xl">
            <h4 className="font-bold text-slate-900 text-sm">Excluir este grupo?</h4>
            <p className="text-slate-500 text-xs">Os contatos que fazem parte dele não serão excluídos, só o agrupamento.</p>
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setPendingGroupDeleteId(null)} className="px-3 py-1.5 rounded-lg text-slate-600 hover:bg-slate-100 font-semibold text-xs">
                Cancelar
              </button>
              <button onClick={handleDeleteGroup} className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs transition-colors">
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ContactFormFields({
  form,
  setForm,
  showLeadStatus,
  funnels,
  showFunnelSelector,
}: {
  form: ContactFormState;
  setForm: React.Dispatch<React.SetStateAction<ContactFormState>>;
  showLeadStatus: boolean;
  funnels: Funnel[];
  showFunnelSelector: boolean;
}) {
  const selectedFunnel = funnels.find((f) => f.id === form.funnelId);
  return (
    <div className="space-y-3 text-xs">
      {showFunnelSelector && (
        <div className="p-3 bg-sky-50/60 border border-sky-200/60 rounded-xl space-y-2.5">
          <p className="text-[10px] text-sky-800 font-semibold">
            Vincule este lead a um funil (opcional) — ele já aparece no Kanban de Jornadas. Só vira paciente de verdade quando o atendimento for concluído.
          </p>
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block font-semibold text-slate-600 mb-1">Funil</label>
              <select
                value={form.funnelId}
                onChange={(e) => setForm((prev) => ({ ...prev, funnelId: e.target.value, funnelStage: '' }))}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white"
              >
                <option value="">Nenhum (só contato)</option>
                {funnels.map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-600 mb-1">Etapa</label>
              <select
                value={form.funnelStage}
                disabled={!form.funnelId}
                onChange={(e) => setForm((prev) => ({ ...prev, funnelStage: e.target.value }))}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white disabled:bg-slate-100 disabled:text-slate-400"
              >
                <option value="">Selecione...</option>
                {selectedFunnel?.stages.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>
          {form.funnelId && form.funnelStage && (
            <p className="text-[10px] text-amber-700">Telefone é obrigatório para vincular a um funil.</p>
          )}
        </div>
      )}
      <div>
        <label className="block font-semibold text-slate-600 mb-1">Nome</label>
        <input
          type="text"
          value={form.name}
          onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
          className="w-full px-3 py-2 border border-slate-300 rounded-xl"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block font-semibold text-slate-600 mb-1">Telefone</label>
          <input
            type="text"
            value={form.phone}
            onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
            className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono"
          />
        </div>
        <div>
          <label className="block font-semibold text-slate-600 mb-1">E-mail</label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
            className="w-full px-3 py-2 border border-slate-300 rounded-xl"
          />
        </div>
      </div>
      {showLeadStatus && (
        <div>
          <label className="block font-semibold text-slate-600 mb-1">Status do Lead</label>
          <select
            value={form.leadStatus}
            onChange={(e) => setForm((prev) => ({ ...prev, leadStatus: e.target.value }))}
            className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white"
          >
            {Object.entries(LEAD_STATUS_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>
      )}
      <div>
        <label className="block font-semibold text-slate-600 mb-1">Tags (separadas por vírgula)</label>
        <input
          type="text"
          placeholder="Ex.: instagram, urgente"
          value={form.tags}
          onChange={(e) => setForm((prev) => ({ ...prev, tags: e.target.value }))}
          className="w-full px-3 py-2 border border-slate-300 rounded-xl"
        />
      </div>
      <div>
        <label className="block font-semibold text-slate-600 mb-1">Notas</label>
        <textarea
          rows={2}
          value={form.notes}
          onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
          className="w-full px-3 py-2 border border-slate-300 rounded-xl resize-none"
        />
      </div>
    </div>
  );
}
