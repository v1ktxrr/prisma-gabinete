"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus, Edit2, Trash2, X, ShieldAlert, UserCog, ScanFace, Download, Fingerprint, UserX, Activity } from "lucide-react";

interface UserProfile {
    id: string;
    email: string;
    created_at: string;
    last_sign_in_at: string;
    nome?: string;
    cargo?: string;
    unidade_id?: string;
    modulos?: string[];
    celular?: string;
}

const CATEGORIAS_MODULOS = [
    {
        titulo: "Agenda Oficial (Global)",
        modulos: [
            { id: "agenda_global_ver", label: "Visualizar Agenda" },
            { id: "agenda_global_editar", label: "Editar Agenda", dep: "agenda_global_ver", depLabel: "Visualizar Agenda" },
            { id: "agenda_global_presenca", label: "Registrar Presença", dep: "agenda_global_ver", depLabel: "Visualizar Agenda" },
        ]
    },
    {
        titulo: "Agenda de Comunicação & Briefings",
        modulos: [
            { id: "agenda_comunicacao_ver", label: "Visualizar Comunicação" },
            { id: "agenda_comunicacao_editar", label: "Editar Comunicação", dep: "agenda_comunicacao_ver", depLabel: "Visualizar Comunicação" },
            { id: "briefing_editar", label: "Editar Briefings", dep: "agenda_comunicacao_ver", depLabel: "Visualizar Comunicação" },
        ]
    },
    {
        titulo: "Ofícios (Protocolo)",
        modulos: [
            { id: "oficios_ver", label: "Visualizar Ofícios" },
            { id: "oficios_tramitar", label: "Tramitar/Editar Ofícios", dep: "oficios_ver", depLabel: "Visualizar Ofícios" },
        ]
    },
    {
        titulo: "Administração & Cadastros",
        modulos: [
            { id: "usuarios_gerenciar", label: "Gerenciar Usuários" },
            { id: "aniversariantes_gerenciar", label: "Gerenciar Aniversariantes" },
            { id: "visao_geral_auditoria", label: "Visão Geral & Auditoria" },
        ]
    }
];

interface DevUsersTabProps {
    addToast: (msg: string, type: "success" | "error") => void;
}

export function DevUsersTab({ addToast }: DevUsersTabProps) {
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [unidades, setUnidades] = useState<{id: string, nome: string}[]>([]);
    const [loading, setLoading] = useState(true);

    const [showModal, setShowModal] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [convidar, setConvidar] = useState(true);

    const [showSessionsModal, setShowSessionsModal] = useState(false);
    const [sessions, setSessions] = useState<any[]>([]);
    const [loadingSessions, setLoadingSessions] = useState(false);

    const [form, setForm] = useState({
        id: "",
        email: "",
        password: "",
        nome: "",
        cargo: "assessoria",
        unidade_id: "CG",
        modulos: ["agenda_global_ver"]
    });

    const fetchSessions = async () => {
        setLoadingSessions(true);
        try {
            const res = await fetch("/api/deviktor-sys/users/sessions");
            if (!res.ok) throw new Error("Erro ao carregar sessões");
            const data = await res.json();
            setSessions(data);
        } catch (err: any) {
            addToast(err.message, "error");
        } finally {
            setLoadingSessions(false);
        }
    };

    const handleRevokeSession = async (sessionId: string) => {
        if (!confirm("Tem certeza que deseja revogar esta sessão ativa? O usuário correspondente será deslogado imediatamente.")) return;
        try {
            const res = await fetch("/api/deviktor-sys/users/sessions", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ session_id: sessionId })
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Erro ao revogar sessão");
            }
            addToast("Sessão revogada com sucesso", "success");
            fetchSessions();
        } catch (err: any) {
            addToast(err.message, "error");
        }
    };

    const handleCompliance = async (action: "export" | "anonymize" | "hard_delete", userId: string, email: string) => {
        let msg = "";
        if (action === "export") {
            msg = `Confirmar exportação de todos os dados do usuário ${email} (Portabilidade LGPD)?`;
        } else if (action === "anonymize") {
            msg = `⚠️ ALERTA CRÍTICO: Deseja anonimizar irreversivelmente os dados do usuário ${email}? O nome, e-mail e celular serão substituídos por hashes SHA-256 e o acesso será bloqueado permanentemente. Esta ação NÃO pode ser desfeita.`;
        } else if (action === "hard_delete") {
            msg = `🚨 PERIGO EXTREMO: Deseja realizar a exclusão física e permanente de todos os dados operacionais e conta do usuário ${email}? Isso apagará tarefas, relatórios, históricos e perfil de forma definitiva. Esta operação NÃO tem volta.`;
        }

        if (!confirm(msg)) return;

        try {
            const res = await fetch("/api/deviktor-sys/compliance", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action, user_id: userId })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Erro ao processar conformidade");

            if (action === "export") {
                const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(data.data, null, 2))}`;
                const downloadAnchor = document.createElement("a");
                downloadAnchor.setAttribute("href", jsonString);
                downloadAnchor.setAttribute("download", `lgpd_export_${email}_${new Date().toISOString().split("T")[0]}.json`);
                document.body.appendChild(downloadAnchor);
                downloadAnchor.click();
                downloadAnchor.remove();
                addToast("Dados exportados e baixados com sucesso!", "success");
            } else if (action === "anonymize") {
                addToast("Usuário anonimizado e bloqueado com sucesso!", "success");
                fetchUsers();
            } else if (action === "hard_delete") {
                addToast("Usuário e todos os seus dados excluídos permanentemente!", "success");
                fetchUsers();
            }
        } catch (err: any) {
            addToast(err.message, "error");
        }
    };

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const [usersRes, unidadesRes] = await Promise.all([
                fetch("/api/deviktor-sys/users"),
                fetch("/api/deviktor-sys/unidades")
            ]);
            
            if (!usersRes.ok) throw new Error("Erro ao carregar usuários");
            const data = await usersRes.json();
            setUsers(data);

            if (unidadesRes.ok) {
                const uniData = await unidadesRes.json();
                setUnidades(uniData);
            }
        } catch (err: any) {
            addToast(err.message, "error");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);

        const url = isEditing 
            ? `/api/deviktor-sys/users/${form.id}`
            : "/api/deviktor-sys/users";
        const method = isEditing ? "PUT" : "POST";

        try {
            const bodyPayload: any = { 
                ...form,
                convidar: !isEditing ? convidar : false
            };
            if (isEditing && !bodyPayload.password) {
                delete bodyPayload.password;
            }
            if (!isEditing && convidar) {
                delete bodyPayload.password;
            }

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(bodyPayload),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Erro ao salvar usuário");

            addToast(
                isEditing 
                    ? "Usuário atualizado com sucesso" 
                    : (convidar ? "Convite enviado com sucesso" : "Usuário criado com sucesso"), 
                "success"
            );
            setShowModal(false);
            fetchUsers();
        } catch (err: any) {
            addToast(err.message, "error");
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id: string, email: string) => {
        if (!confirm(`ATENÇÃO: Deseja realmente excluir o usuário ${email}? Essa ação não pode ser desfeita e os dados associados poderão ficar órfãos ou ser apagados em cascata.`)) return;
        
        try {
            const res = await fetch(`/api/deviktor-sys/users/${id}`, { method: "DELETE" });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Erro ao excluir");
            }
            addToast("Usuário excluído com sucesso", "success");
            fetchUsers();
        } catch (err: any) {
            addToast(err.message, "error");
        }
    };

    const openCreateModal = () => {
        setIsEditing(false);
        setForm({
            id: "", email: "", password: "", nome: "", cargo: "assessoria", unidade_id: "CG", modulos: ["agenda_global_ver"]
        });
        setConvidar(true);
        setShowModal(true);
    };

    const openEditModal = (user: UserProfile) => {
        setIsEditing(true);
        setForm({
            id: user.id,
            email: user.email,
            password: "", // Leave blank, only update if typed
            nome: user.nome || "",
            cargo: user.cargo || "assessoria",
            unidade_id: user.unidade_id || "cg",
            modulos: user.modulos || []
        });
        setShowModal(true);
    };

    const handleImpersonate = async (email: string) => {
        if (!confirm(`Deseja gerar um link de login (Impersonation) para o usuário ${email}? Recomendamos abrir este link em uma janela anônima para não perder sua sessão atual.`)) return;

        try {
            const res = await fetch("/api/deviktor-sys/users/impersonate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Erro ao gerar link de impersonation");

            // Copia para a área de transferência e avisa o dev
            await navigator.clipboard.writeText(data.url);
            addToast("Link gerado e copiado! Cole em uma janela anônima.", "success");
            
            // Opcional: tentar abrir em nova aba
            // window.open(data.url, '_blank');
        } catch (err: any) {
            addToast(err.message, "error");
        }
    };

    return (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div>
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                        <UserCog className="h-4.5 w-4.5 text-violet-400" />
                        Gestão Global de Usuários (Root)
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-1">
                        Gerencie todos os usuários do sistema ignorando as políticas de RLS e limites por unidade.
                    </p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => {
                            fetchSessions();
                            setShowSessionsModal(true);
                        }}
                        className="inline-flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-bold transition-all cursor-pointer shadow-md"
                    >
                        <Activity className="h-4 w-4 text-emerald-400" />
                        Sessões Ativas
                    </button>
                    <button
                        onClick={openCreateModal}
                        className="inline-flex items-center gap-1 bg-violet-600 hover:bg-violet-500 text-white rounded-lg px-3 py-1.5 text-xs font-bold transition-all cursor-pointer shadow-md shadow-violet-500/20"
                    >
                        <Plus className="h-4 w-4" />
                        Novo Usuário
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="flex h-40 items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-slate-600" />
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                        <thead>
                            <tr className="border-b border-slate-800 bg-slate-950/50 text-[10px] text-slate-500 uppercase tracking-wide font-bold">
                                <th className="p-3 rounded-tl-lg">Usuário</th>
                                <th className="p-3">Cargo / Unidade</th>
                                <th className="p-3">Módulos</th>
                                <th className="p-3">Último Acesso</th>
                                <th className="p-3 text-right rounded-tr-lg">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/30 text-slate-300">
                            {users.map((u) => (
                                <tr key={u.id} className="hover:bg-slate-900/40 transition-colors">
                                    <td className="p-3">
                                        <div className="font-bold text-white">{u.nome || "Sem nome"}</div>
                                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">{u.email}</div>
                                    </td>
                                    <td className="p-3">
                                        <div className="capitalize font-bold text-violet-400">{u.cargo || "-"}</div>
                                        <div className="text-[10px] text-slate-500 uppercase font-bold">{u.unidade_id || "-"}</div>
                                    </td>
                                    <td className="p-3 max-w-[150px]">
                                        <div className="flex flex-wrap gap-1">
                                            {u.modulos?.map(m => (
                                                <span key={m} className="bg-slate-800 border border-slate-700 text-slate-300 px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wider font-bold">
                                                    {m}
                                                </span>
                                            ))}
                                            {(!u.modulos || u.modulos.length === 0) && <span className="text-slate-600 italic">Nenhum</span>}
                                        </div>
                                    </td>
                                    <td className="p-3 text-[10px] text-slate-500 font-mono">
                                        {u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleDateString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "Nunca acessou"}
                                    </td>
                                    <td className="p-3 text-right">
                                        <div className="flex items-center justify-end gap-1">
                                            <button
                                                onClick={() => handleCompliance("export", u.id, u.email)}
                                                className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-blue-950/30 rounded-lg transition-colors cursor-pointer"
                                                title="Exportar Dados (Portabilidade LGPD)"
                                            >
                                                <Download className="h-3.5 w-3.5" />
                                            </button>
                                            <button
                                                onClick={() => handleCompliance("anonymize", u.id, u.email)}
                                                className="p-1.5 text-slate-400 hover:text-yellow-500 hover:bg-yellow-950/30 rounded-lg transition-colors cursor-pointer"
                                                title="Anonimizar Perfil (Soft Purge)"
                                            >
                                                <Fingerprint className="h-3.5 w-3.5" />
                                            </button>
                                            <button
                                                onClick={() => handleCompliance("hard_delete", u.id, u.email)}
                                                className="p-1.5 text-slate-500 hover:text-red-500 hover:bg-red-950/30 rounded-lg transition-colors cursor-pointer"
                                                title="Exclusão Física (Hard Purge)"
                                            >
                                                <UserX className="h-3.5 w-3.5" />
                                            </button>
                                            <div className="w-[1px] h-4 bg-slate-800 mx-1" />
                                            <button
                                                onClick={() => handleImpersonate(u.email)}
                                                className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-emerald-950/30 rounded-lg transition-colors cursor-pointer"
                                                title="Logar Como (Impersonation)"
                                            >
                                                <ScanFace className="h-3.5 w-3.5" />
                                            </button>
                                            <button
                                                onClick={() => openEditModal(u)}
                                                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                                                title="Editar"
                                            >
                                                <Edit2 className="h-3.5 w-3.5" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(u.id, u.email)}
                                                className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-950/30 rounded-lg transition-colors cursor-pointer"
                                                title="Excluir"
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {users.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="p-8 text-center text-slate-500 italic">Nenhum usuário encontrado.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {/* MODAL CRUD */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-lg flex flex-col gap-4 text-left max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                            <h4 className="font-bold text-white text-sm flex items-center gap-2">
                                <ShieldAlert className="h-4 w-4 text-amber-500" />
                                {isEditing ? "Editar Usuário (Bypass RLS)" : "Novo Usuário (Root)"}
                            </h4>
                            <button 
                                onClick={() => setShowModal(false)}
                                className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded-md cursor-pointer"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            {!isEditing && (
                                <div className="bg-slate-950/45 p-3 rounded-xl border border-slate-800 space-y-2 mb-2">
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide">Método de Cadastro</label>
                                    <div className="flex gap-4">
                                        <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                                            <input
                                                type="radio"
                                                name="metodo_cadastro"
                                                checked={convidar}
                                                onChange={() => setConvidar(true)}
                                                className="accent-violet-500"
                                            />
                                            <span>Convidar por e-mail (Resend SMTP)</span>
                                        </label>
                                        <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                                            <input
                                                type="radio"
                                                name="metodo_cadastro"
                                                checked={!convidar}
                                                onChange={() => setConvidar(false)}
                                                className="accent-violet-500"
                                            />
                                            <span>Criar diretamente (com senha manual)</span>
                                        </label>
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-4">
                                <div className={isEditing || !convidar ? "" : "col-span-2"}>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">E-mail (Login)</label>
                                    <input
                                        type="email"
                                        value={form.email}
                                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                                        className="w-full rounded-lg border border-slate-800 bg-slate-950 py-2 px-3 text-xs text-white outline-none focus:border-violet-500/50 disabled:opacity-50"
                                        disabled={isEditing}
                                        required
                                    />
                                </div>
                                {(isEditing || !convidar) && (
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">
                                            Senha {isEditing && "(Deixe vazio para manter)"}
                                        </label>
                                        <input
                                            type="password"
                                            value={form.password}
                                            onChange={(e) => setForm({ ...form, password: e.target.value })}
                                            className="w-full rounded-lg border border-slate-800 bg-slate-950 py-2 px-3 text-xs text-white outline-none focus:border-violet-500/50"
                                            required={!isEditing && !convidar}
                                            minLength={6}
                                        />
                                    </div>
                                )}
                                <div className="col-span-2">
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Nome Completo</label>
                                    <input
                                        type="text"
                                        value={form.nome}
                                        onChange={(e) => setForm({ ...form, nome: e.target.value })}
                                        className="w-full rounded-lg border border-slate-800 bg-slate-950 py-2 px-3 text-xs text-white outline-none focus:border-violet-500/50"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Cargo</label>
                                    <select
                                        value={form.cargo}
                                        onChange={(e) => setForm({ ...form, cargo: e.target.value })}
                                        className="w-full rounded-lg border border-slate-800 bg-slate-950 py-2 px-3 text-xs text-white outline-none focus:border-violet-500/50"
                                    >
                                        <option value="chefia">Chefia</option>
                                        <option value="assessoria">Assessoria</option>
                                        <option value="comunicacao">Comunicação</option>
                                        <option value="secretaria">Secretaria</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Unidade</label>
                                    <select
                                        value={form.unidade_id}
                                        onChange={(e) => setForm({ ...form, unidade_id: e.target.value })}
                                        className="w-full rounded-lg border border-slate-800 bg-slate-950 py-2 px-3 text-xs text-white outline-none focus:border-violet-500/50"
                                        required
                                    >
                                        <option value="" disabled>Selecione uma unidade</option>
                                        {unidades.map(u => (
                                            <option key={u.id} value={u.id}>{u.nome} ({u.id})</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="col-span-2 space-y-4">
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide">Permissões e Módulos de Acesso</label>
                                    <div className="space-y-4 bg-slate-950 p-4 rounded-xl border border-slate-800/80">
                                        {CATEGORIAS_MODULOS.map(cat => (
                                            <div key={cat.titulo} className="space-y-2">
                                                <span className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider">{cat.titulo}</span>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                    {cat.modulos.map(modulo => {
                                                        const isChecked = form.modulos.includes(modulo.id);
                                                        const hasDepWarning = modulo.dep && isChecked && !form.modulos.includes(modulo.dep);
                                                        
                                                        return (
                                                            <label 
                                                                key={modulo.id} 
                                                                className={`flex flex-col gap-1 cursor-pointer bg-slate-900/60 p-2.5 rounded-lg border transition-all hover:bg-slate-900 ${
                                                                    isChecked ? "border-violet-500/50" : "border-slate-850"
                                                                }`}
                                                            >
                                                                <div className="flex items-center gap-2">
                                                                    <input 
                                                                        type="checkbox" 
                                                                        checked={isChecked}
                                                                        onChange={(e) => {
                                                                            let nextModulos = [...form.modulos];
                                                                            if (e.target.checked) {
                                                                                nextModulos.push(modulo.id);
                                                                                if (modulo.dep && !nextModulos.includes(modulo.dep)) {
                                                                                    addToast(`Nota: "${modulo.label}" depende de "${modulo.depLabel}".`, "success");
                                                                                }
                                                                            } else {
                                                                                nextModulos = nextModulos.filter(m => m !== modulo.id);
                                                                            }
                                                                            setForm({ ...form, modulos: nextModulos });
                                                                        }}
                                                                        className="accent-violet-500"
                                                                    />
                                                                    <span className="text-[11px] text-slate-200 font-bold">{modulo.label}</span>
                                                                </div>
                                                                {hasDepWarning && (
                                                                    <div className="text-[9px] text-amber-500 font-bold ml-5 animate-pulse flex items-center gap-1">
                                                                        ⚠️ Requer: {modulo.depLabel}
                                                                    </div>
                                                                )}
                                                            </label>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            
                            <div className="pt-2 border-t border-slate-800 flex justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="px-4 py-2 rounded-lg text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="inline-flex items-center justify-center bg-violet-600 hover:bg-violet-500 text-white rounded-lg px-4 py-2 text-xs font-bold transition-all disabled:opacity-50 cursor-pointer"
                                >
                                    {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                                    <span>
                                        {submitting 
                                            ? (!isEditing && convidar ? "Enviando convite..." : "Salvando...") 
                                            : (!isEditing && convidar ? "Convidar por E-mail" : "Salvar Usuário")}
                                    </span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL SESSÕES ATIVAS */}
            {showSessionsModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-4xl flex flex-col gap-4 text-left max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                            <h4 className="font-bold text-white text-sm flex items-center gap-2">
                                <Activity className="h-4 w-4 text-emerald-400" />
                                Controle de Sessões Ativas (Supabase Auth)
                            </h4>
                            <button 
                                onClick={() => setShowSessionsModal(false)}
                                className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded-md cursor-pointer"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                        {loadingSessions ? (
                            <div className="flex h-40 items-center justify-center">
                                <Loader2 className="h-6 w-6 animate-spin text-slate-650" />
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse text-xs">
                                    <thead>
                                        <tr className="border-b border-slate-800 bg-slate-950/50 text-[10px] text-slate-500 uppercase tracking-wide font-bold">
                                            <th className="p-3 rounded-tl-lg">E-mail</th>
                                            <th className="p-3">IP</th>
                                            <th className="p-3">Dispositivo / User Agent</th>
                                            <th className="p-3">MFA (AAL)</th>
                                            <th className="p-3">Criada em</th>
                                            <th className="p-3 text-right rounded-tr-lg">Ação</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800/30 text-slate-300">
                                        {sessions.map((s) => (
                                            <tr key={s.id} className="hover:bg-slate-900/40 transition-colors">
                                                <td className="p-3 font-bold text-white font-mono text-[10px]">
                                                    {s.email || "Desconhecido"}
                                                </td>
                                                <td className="p-3 font-mono text-slate-400 text-[10px]">{s.ip || "N/A"}</td>
                                                <td className="p-3 max-w-[240px] truncate text-slate-400 font-mono text-[9px]" title={s.user_agent}>
                                                    {s.user_agent || "N/A"}
                                                </td>
                                                <td className="p-3">
                                                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${s.aal === 'aal2' ? 'bg-emerald-950 text-emerald-450 border border-emerald-800' : 'bg-slate-850 text-slate-450 border border-slate-750'}`}>
                                                        {s.aal || "aal1"}
                                                    </span>
                                                </td>
                                                <td className="p-3 text-[10px] text-slate-500 font-mono">
                                                    {s.created_at ? new Date(s.created_at).toLocaleString("pt-BR") : "N/A"}
                                                </td>
                                                <td className="p-3 text-right">
                                                    <button
                                                        onClick={() => handleRevokeSession(s.id)}
                                                        className="bg-red-950/30 text-red-400 border border-red-900/45 px-2 py-1 rounded hover:bg-red-900/40 hover:text-white transition-all text-[10px] font-bold cursor-pointer"
                                                    >
                                                        Derrubar
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                        {sessions.length === 0 && (
                                            <tr>
                                                <td colSpan={6} className="p-8 text-center text-slate-500 italic">Nenhuma sessão ativa encontrada.</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
