"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus, Building2, Ban, CheckCircle2 } from "lucide-react";

interface Unidade {
    id: string;
    nome: string;
    status: string;
    criado_em: string;
    users_count: number;
}

interface DevUnidadesTabProps {
    addToast: (msg: string, type: "success" | "error") => void;
}

export function DevUnidadesTab({ addToast }: DevUnidadesTabProps) {
    const [unidades, setUnidades] = useState<Unidade[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    const fetchUnidades = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/deviktor-sys/unidades");
            if (!res.ok) throw new Error("Erro ao carregar unidades");
            const data = await res.json();
            setUnidades(data);
        } catch (err: any) {
            addToast(err.message, "error");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUnidades();
    }, []);

    const handleToggleStatus = async (unidade: Unidade) => {
        const novoStatus = unidade.status === "ativo" ? "suspenso" : "ativo";
        
        if (novoStatus === "suspenso") {
            if (!confirm(`Atenção: Suspender a unidade '${unidade.nome}' impedirá que todos os ${unidade.users_count} usuários associados acessem o sistema. Deseja continuar?`)) {
                return;
            }
        }

        setActionLoading(unidade.id);
        try {
            const res = await fetch("/api/deviktor-sys/unidades", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: unidade.id, status: novoStatus })
            });
            if (!res.ok) throw new Error("Erro ao atualizar status");
            
            addToast(`Unidade ${novoStatus === "ativo" ? "reativada" : "suspensa"} com sucesso`, "success");
            fetchUnidades();
        } catch (err: any) {
            addToast(err.message, "error");
        } finally {
            setActionLoading(null);
        }
    };

    const handleCreatePrompt = async () => {
        const id = prompt("Digite o ID (slug) da nova unidade (ex: sp, pr_silva):");
        if (!id) return;
        const nome = prompt("Digite o nome completo da unidade:");
        if (!nome) return;

        try {
            const res = await fetch("/api/deviktor-sys/unidades", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id, nome })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Erro ao criar unidade");
            
            addToast("Unidade criada com sucesso", "success");
            fetchUnidades();
        } catch (err: any) {
            addToast(err.message, "error");
        }
    };

    return (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div>
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                        <Building2 className="h-4.5 w-4.5 text-violet-400" />
                        Gestão de Tenants (Unidades)
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-1">
                        Gerencie os gabinetes ativos. Suspender uma unidade bloqueia o login de todos os seus usuários.
                    </p>
                </div>
                <button
                    onClick={handleCreatePrompt}
                    className="inline-flex items-center gap-1 bg-violet-600 hover:bg-violet-500 text-white rounded-lg px-3 py-1.5 text-xs font-bold transition-all cursor-pointer shadow-md shadow-violet-500/20"
                >
                    <Plus className="h-4 w-4" />
                    Nova Unidade
                </button>
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
                                <th className="p-3 rounded-tl-lg">ID / Nome</th>
                                <th className="p-3">Usuários</th>
                                <th className="p-3">Data de Criação</th>
                                <th className="p-3 text-right rounded-tr-lg">Status / Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/30 text-slate-300">
                            {unidades.map((u) => (
                                <tr key={u.id} className="hover:bg-slate-900/40 transition-colors">
                                    <td className="p-3">
                                        <div className="font-bold text-white">{u.nome}</div>
                                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">{u.id}</div>
                                    </td>
                                    <td className="p-3 font-mono">
                                        {u.users_count}
                                    </td>
                                    <td className="p-3 text-[10px] text-slate-500 font-mono">
                                        {new Date(u.criado_em).toLocaleDateString("pt-BR")}
                                    </td>
                                    <td className="p-3 text-right">
                                        <div className="flex items-center justify-end gap-3">
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                                u.status === "ativo" 
                                                    ? "bg-emerald-950/30 text-emerald-400 border border-emerald-900/50" 
                                                    : "bg-red-950/30 text-red-400 border border-red-900/50"
                                            }`}>
                                                {u.status}
                                            </span>
                                            
                                            <button
                                                onClick={() => handleToggleStatus(u)}
                                                disabled={actionLoading === u.id}
                                                className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                                                    u.status === "ativo"
                                                        ? "text-slate-500 hover:text-red-400 border-slate-800 hover:bg-red-950/30 hover:border-red-900/50"
                                                        : "text-slate-500 hover:text-emerald-400 border-slate-800 hover:bg-emerald-950/30 hover:border-emerald-900/50"
                                                }`}
                                                title={u.status === "ativo" ? "Suspender Unidade" : "Ativar Unidade"}
                                            >
                                                {actionLoading === u.id ? (
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                ) : u.status === "ativo" ? (
                                                    <Ban className="h-4 w-4" />
                                                ) : (
                                                    <CheckCircle2 className="h-4 w-4" />
                                                )}
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {unidades.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="p-8 text-center text-slate-500 italic">Nenhuma unidade cadastrada.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
