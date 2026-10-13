"use client";

import { useState } from "react";
import { Loader2, RefreshCw, Trash2, AlertCircle } from "lucide-react";

interface DevTriggersTabProps {
    addToast: (msg: string, type: "success" | "error") => void;
    onTriggerSuccess?: () => void;
}

export function DevTriggersTab({ addToast, onTriggerSuccess }: DevTriggersTabProps) {
    const [syncPostId, setSyncPostId] = useState("");
    const [syncPostUrl, setSyncPostUrl] = useState("");
    const [runningSync, setRunningSync] = useState(false);
    const [runningCleanup, setRunningCleanup] = useState(false);

    const handleSyncTrigger = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!syncPostId || !syncPostUrl) {
            addToast("Pauta ID e URL do Post são obrigatórios", "error");
            return;
        }
        setRunningSync(true);
        try {
            const res = await fetch("/api/deviktor-sys/triggers", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "sync_instagram_post",
                    task_id: syncPostId.trim(),
                    post_url: syncPostUrl.trim(),
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Erro ao sincronizar");

            if (data.success) {
                addToast("Métricas sincronizadas com sucesso!", "success");
                setSyncPostId("");
                setSyncPostUrl("");
                if (onTriggerSuccess) {
                    onTriggerSuccess();
                }
            } else {
                addToast(data.message || "Sincronização retornou alerta", "error");
            }
        } catch (err: any) {
            addToast(err.message, "error");
        } finally {
            setRunningSync(false);
        }
    };

    const handleCleanupTrigger = async () => {
        if (!confirm("Tem certeza que deseja forçar a varredura e exclusão de usuários sem perfil no Auth?")) return;
        setRunningCleanup(true);
        try {
            const res = await fetch("/api/deviktor-sys/triggers", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "cleanup_ghost_users" }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Erro ao limpar");

            addToast(
                `Varredura concluída. ${data.deleted_count} fantasmas removidos, ${data.failed_count} falhas.`,
                "success"
            );
            if (onTriggerSuccess) {
                onTriggerSuccess();
            }
        } catch (err: any) {
            addToast(err.message, "error");
        } finally {
            setRunningCleanup(false);
        }
    };

    return (
        <div className="grid gap-6 md:grid-cols-2">
            {/* Instagram Metrics Syncer */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 flex flex-col gap-4 font-sans">
                <div className="border-b border-slate-800 pb-3">
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                        <RefreshCw className="h-4.5 w-4.5 text-violet-450 animate-pulse" />
                        Forçar Sincronização de Métricas
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-1">
                        Dispara manualmente a execução da Edge Function do Supabase para atualizar curtidas, comentários e alcance de uma pauta específica.
                    </p>
                </div>
                <form onSubmit={handleSyncTrigger} className="space-y-4">
                    <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">
                            ID da Pauta (UUID)
                        </label>
                        <input
                            type="text"
                            value={syncPostId}
                            onChange={(e) => setSyncPostId(e.target.value)}
                            placeholder="ex: 93d3e1c6-33b8-4fbf-89c7-bc7cc914eb7f"
                            className="w-full rounded-lg border border-slate-800 bg-slate-950 py-2 px-3 text-xs text-white placeholder-slate-650 outline-none focus:border-violet-500/50 font-mono"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">
                            URL do Post do Instagram
                        </label>
                        <input
                            type="url"
                            value={syncPostUrl}
                            onChange={(e) => setSyncPostUrl(e.target.value)}
                            placeholder="ex: https://www.instagram.com/p/DU_5VEFCcpA/"
                            className="w-full rounded-lg border border-slate-800 bg-slate-950 py-2 px-3 text-xs text-white placeholder-slate-650 outline-none focus:border-violet-500/50 font-mono"
                            required
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={runningSync}
                        className="w-full inline-flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg py-2 text-xs font-bold transition-all disabled:opacity-50 cursor-pointer font-sans"
                    >
                        {runningSync ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                <span>Invocando Scraper do Apify...</span>
                            </>
                        ) : (
                            <span>Acionar Sincronização</span>
                        )}
                    </button>
                </form>
            </div>

            {/* Database Ghost User Cleanup */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 flex flex-col justify-between gap-6 font-sans">
                <div>
                    <div className="border-b border-slate-800 pb-3 mb-4">
                        <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                            <Trash2 className="h-4.5 w-4.5 text-red-500" />
                            Limpar Usuários Fantasmas
                        </h3>
                        <p className="text-[11px] text-slate-500 mt-1">
                            Identifica contas no Supabase Auth criadas há mais de 10 minutos que falharam em concluir o fluxo de criação de perfil (`perfis_usuarios`).
                        </p>
                    </div>
                    <div className="text-xs text-slate-400 bg-red-950/10 border border-red-950/30 rounded-xl p-4 flex gap-3 items-start">
                        <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                        <div>
                            <p className="font-bold text-slate-350">Ação Destrutiva e Auditável</p>
                            <p className="text-[11px] mt-1 text-slate-400">
                                A exclusão destas contas é permanente no Supabase Auth. Essa ação é útil para remover rascunhos de testes incompletos sem deixar vestígios órfãos.
                            </p>
                        </div>
                    </div>
                </div>
                <button
                    onClick={handleCleanupTrigger}
                    disabled={runningCleanup}
                    className="w-full inline-flex items-center justify-center gap-2 bg-red-950/40 hover:bg-red-950/60 border border-red-900/30 text-red-400 hover:text-red-300 rounded-lg py-2.5 text-xs font-bold transition-all disabled:opacity-50 cursor-pointer font-sans"
                >
                    {runningCleanup ? (
                        <>
                            <Loader2 className="h-4 w-4 animate-spin mr-1" />
                            <span>Excluindo contas no Auth...</span>
                        </>
                    ) : (
                        <span>Excluir Contas Sem Perfil</span>
                    )}
                </button>
            </div>
        </div>
    );
}
