"use client";

import { useEffect, useState } from "react";
import { Loader2, Save, ToggleLeft, ToggleRight, Plus, Trash2, Edit3, X } from "lucide-react";

interface Config {
    chave: string;
    valor: any;
    descricao: string;
    atualizado_em: string;
}

interface DevConfigsTabProps {
    addToast: (msg: string, type: "success" | "error") => void;
}

export function DevConfigsTab({ addToast }: DevConfigsTabProps) {
    const [configs, setConfigs] = useState<Config[]>([]);
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState<string | null>(null);

    // Estado específico para edição do banner
    const [bannerDraft, setBannerDraft] = useState<{ ativo: boolean; mensagem: string; tipo: string } | null>(null);

    // Estado para o modal do CRUD
    const [showModal, setShowModal] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [formChave, setFormChave] = useState("");
    const [formDescricao, setFormDescricao] = useState("");
    const [formTipo, setFormTipo] = useState<"boolean" | "text" | "json">("boolean");
    const [formValor, setFormValor] = useState<string>("false");

    const fetchConfigs = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/deviktor-sys/configs");
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Erro ao carregar configs");
            }
            const data = await res.json();
            setConfigs(data);
            
            // Extract banner config for draft
            const bannerConfig = data.find((c: Config) => c.chave === "broadcast_banner");
            if (bannerConfig && bannerConfig.valor) {
                setBannerDraft(bannerConfig.valor);
            }
        } catch (err: any) {
            addToast(err.message, "error");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchConfigs();
    }, []);

    const toggleConfig = async (config: Config) => {
        if (typeof config.valor !== "boolean") {
            addToast("Apenas configurações booleanas podem ser alternadas rapidamente.", "error");
            return;
        }

        setUpdating(config.chave);
        try {
            const res = await fetch("/api/deviktor-sys/configs", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    chave: config.chave,
                    valor: !config.valor
                })
            });
            
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Erro ao atualizar");
            }
            
            setConfigs(prev => prev.map(c => c.chave === config.chave ? { ...c, valor: !c.valor } : c));
            addToast(`Configuração ${config.chave} updated`, "success");
        } catch (err: any) {
            addToast(err.message, "error");
        } finally {
            setUpdating(null);
        }
    };

    const updateBanner = async () => {
        if (!bannerDraft) return;
        setUpdating("broadcast_banner");
        try {
            const res = await fetch("/api/deviktor-sys/configs", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    chave: "broadcast_banner",
                    valor: bannerDraft
                })
            });
            
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Erro ao atualizar banner");
            }
            
            setConfigs(prev => prev.map(c => c.chave === "broadcast_banner" ? { ...c, valor: bannerDraft } : c));
            addToast("Banner de sistema atualizado com sucesso!", "success");
        } catch (err: any) {
            addToast(err.message, "error");
        } finally {
            setUpdating(null);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formChave.trim()) return;

        let parsedValor: any = formValor;
        if (formTipo === "boolean") {
            parsedValor = formValor === "true";
        } else if (formTipo === "json") {
            try {
                parsedValor = JSON.parse(formValor);
            } catch (err) {
                addToast("JSON inválido para o valor.", "error");
                return;
            }
        }

        setUpdating(formChave);
        try {
            const res = await fetch("/api/deviktor-sys/configs", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    chave: formChave.trim(),
                    valor: parsedValor,
                    descricao: formDescricao.trim()
                })
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Erro ao salvar configuração");
            }

            addToast(`Configuração '${formChave}' salva com sucesso!`, "success");
            setShowModal(false);
            fetchConfigs();
        } catch (err: any) {
            addToast(err.message, "error");
        } finally {
            setUpdating(null);
        }
    };

    const handleDelete = async (chave: string) => {
        if (!confirm(`Tem certeza que deseja excluir a configuração '${chave}'?`)) return;

        setUpdating(chave);
        try {
            const res = await fetch(`/api/deviktor-sys/configs?chave=${chave}`, {
                method: "DELETE"
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Erro ao excluir configuração");
            }

            addToast(`Configuração '${chave}' excluída com sucesso!`, "success");
            fetchConfigs();
        } catch (err: any) {
            addToast(err.message, "error");
        } finally {
            setUpdating(null);
        }
    };

    if (loading) {
        return (
            <div className="flex h-40 items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-slate-600" />
            </div>
        );
    }

    return (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 flex flex-col gap-4 relative">
            <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
                <div>
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                        Feature Flags & Sistema
                    </h3>
                    <p className="text-[11px] text-slate-500">
                        Controle de funcionalidades globais. Estas configurações são refletidas instantaneamente.
                    </p>
                </div>
                <button
                    onClick={() => {
                        setIsEditing(false);
                        setFormChave("");
                        setFormDescricao("");
                        setFormTipo("boolean");
                        setFormValor("false");
                        setShowModal(true);
                    }}
                    className="inline-flex items-center gap-1 bg-violet-600 hover:bg-violet-500 text-white rounded-lg px-2.5 py-1.5 text-xs font-bold transition-all cursor-pointer font-mono"
                >
                    <Plus className="h-3.5 w-3.5" />
                    Nova Config
                </button>
            </div>

            <div className="divide-y divide-slate-800/60 max-h-96 overflow-y-auto pr-1">
                {configs.map((config) => {
                    if (config.chave === "broadcast_banner") {
                        return (
                            <div key={config.chave} className="py-4 border-t border-slate-800 flex flex-col gap-3 mt-4 bg-slate-950/50 p-4 rounded-xl group relative">
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="text-sm font-bold text-white font-mono flex items-center gap-2">
                                            {config.chave}
                                            <span className="text-[10px] bg-violet-900/50 text-violet-400 px-2 py-0.5 rounded-full uppercase tracking-widest border border-violet-800">
                                                JSON
                                            </span>
                                            <div className="hidden group-hover:flex items-center gap-1">
                                                <button
                                                    onClick={() => {
                                                        setIsEditing(true);
                                                        setFormChave(config.chave);
                                                        setFormDescricao(config.descricao || "");
                                                        setFormTipo("json");
                                                        setFormValor(JSON.stringify(config.valor, null, 2));
                                                        setShowModal(true);
                                                    }}
                                                    className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800 transition-all cursor-pointer"
                                                    title="Editar JSON bruto"
                                                >
                                                    <Edit3 className="h-3.5 w-3.5" />
                                                </button>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => setBannerDraft(prev => prev ? { ...prev, ativo: !prev.ativo } : null)}
                                            className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all cursor-pointer font-mono ${
                                                bannerDraft?.ativo 
                                                ? "bg-emerald-950/30 border-emerald-900/50 text-emerald-400" 
                                                : "bg-slate-900 border-slate-700 text-slate-500"
                                            }`}
                                        >
                                            {bannerDraft?.ativo ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
                                            <span className="text-[10px] font-bold uppercase tracking-wider">
                                                {bannerDraft?.ativo ? "Banner Ativo" : "Banner Inativo"}
                                            </span>
                                        </button>
                                    </div>
                                    <div className="text-[11px] text-slate-400 mb-4">{config.descricao}</div>
                                </div>
                                
                                {bannerDraft && (
                                    <div className="flex gap-3 flex-col sm:flex-row">
                                        <div className="flex-1">
                                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1 font-mono">Mensagem</label>
                                            <textarea
                                                value={bannerDraft.mensagem}
                                                onChange={(e) => setBannerDraft({ ...bannerDraft, mensagem: e.target.value })}
                                                rows={2}
                                                className="w-full rounded-lg border border-slate-800 bg-slate-900 p-2 text-xs text-white outline-none focus:border-violet-500/50 font-mono"
                                            />
                                        </div>
                                        <div className="w-full sm:w-48">
                                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1 font-mono">Cor / Tipo</label>
                                            <select
                                                value={bannerDraft.tipo}
                                                onChange={(e) => setBannerDraft({ ...bannerDraft, tipo: e.target.value })}
                                                className="w-full rounded-lg border border-slate-800 bg-slate-900 p-2 text-xs text-white outline-none focus:border-violet-500/50 font-mono"
                                            >
                                                <option value="warning">Laranja (Aviso)</option>
                                                <option value="error">Vermelho (Crítico)</option>
                                                <option value="info">Roxo (Info)</option>
                                            </select>
                                            <button
                                                onClick={updateBanner}
                                                disabled={updating === "broadcast_banner"}
                                                className="w-full mt-2 inline-flex items-center justify-center gap-1 bg-violet-600 hover:bg-violet-500 text-white rounded-lg px-3 py-1.5 text-xs font-bold transition-all disabled:opacity-50 cursor-pointer font-mono"
                                            >
                                                {updating === "broadcast_banner" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                                Salvar Banner
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    }

                    return (
                        <div key={config.chave} className="py-4 flex items-center justify-between gap-4 group">
                            <div>
                                <div className="text-sm font-bold text-white font-mono flex items-center gap-2">
                                    {config.chave}
                                    <div className="hidden group-hover:flex items-center gap-1">
                                        <button
                                            onClick={() => {
                                                setIsEditing(true);
                                                setFormChave(config.chave);
                                                setFormDescricao(config.descricao || "");
                                                const tipo = typeof config.valor === "boolean" ? "boolean" : (typeof config.valor === "object" ? "json" : "text");
                                                setFormTipo(tipo);
                                                setFormValor(tipo === "json" ? JSON.stringify(config.valor, null, 2) : String(config.valor));
                                                setShowModal(true);
                                            }}
                                            className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-850 transition-all cursor-pointer"
                                            title="Editar Configuração"
                                        >
                                            <Edit3 className="h-3 w-3" />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(config.chave)}
                                            className="text-red-400 hover:text-red-300 p-1 rounded hover:bg-slate-850 transition-all cursor-pointer"
                                            title="Excluir Configuração"
                                        >
                                            <Trash2 className="h-3 w-3" />
                                        </button>
                                    </div>
                                </div>
                                <div className="text-[11px] text-slate-400 mt-1">{config.descricao}</div>
                            </div>
                            <div>
                                {typeof config.valor === "boolean" ? (
                                    <button
                                        onClick={() => toggleConfig(config)}
                                        disabled={updating === config.chave}
                                        className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all cursor-pointer font-mono ${
                                            config.valor 
                                            ? "bg-emerald-950/30 border-emerald-900/50 text-emerald-400 hover:bg-emerald-900/40" 
                                            : "bg-slate-900 border-slate-700 text-slate-500 hover:bg-slate-800"
                                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                                    >
                                        {updating === config.chave ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : config.valor ? (
                                            <ToggleRight className="h-5 w-5" />
                                        ) : (
                                            <ToggleLeft className="h-5 w-5" />
                                        )}
                                        <span className="text-[10px] font-bold uppercase tracking-wider">
                                            {config.valor ? "Ativado" : "Desativado"}
                                        </span>
                                    </button>
                                ) : (
                                    <div className="text-xs font-mono text-violet-400 bg-slate-950 px-2 py-1 rounded border border-slate-800">
                                        {JSON.stringify(config.valor)}
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
                {configs.length === 0 && (
                    <div className="text-center py-8 text-slate-500 text-xs font-mono">
                        Nenhuma configuração encontrada.
                    </div>
                )}
            </div>

            {/* MODAL CONFIG */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 font-mono">
                    <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
                            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                                {isEditing ? "Editar Configuração" : "Nova Configuração"}
                            </h3>
                            <button
                                onClick={() => setShowModal(false)}
                                className="text-slate-400 hover:text-white rounded p-1 cursor-pointer hover:bg-slate-800"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">
                                    Chave
                                </label>
                                <input
                                    type="text"
                                    value={formChave}
                                    onChange={(e) => setFormChave(e.target.value)}
                                    disabled={isEditing}
                                    placeholder="ex: modo_manutencao"
                                    required
                                    className="w-full rounded-lg border border-slate-800 bg-slate-950 py-2 px-3 text-xs text-white placeholder-slate-650 outline-none focus:border-violet-500/50 disabled:opacity-50"
                                />
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">
                                    Descrição
                                </label>
                                <textarea
                                    value={formDescricao}
                                    onChange={(e) => setFormDescricao(e.target.value)}
                                    placeholder="Explique para que serve esta configuração..."
                                    rows={2}
                                    className="w-full rounded-lg border border-slate-800 bg-slate-950 py-2 px-3 text-xs text-white placeholder-slate-650 outline-none focus:border-violet-500/50"
                                />
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">
                                    Tipo de Valor
                                </label>
                                <select
                                    value={formTipo}
                                    onChange={(e) => {
                                        const tipo = e.target.value as "boolean" | "text" | "json";
                                        setFormTipo(tipo);
                                        setFormValor(tipo === "boolean" ? "false" : (tipo === "json" ? "{}" : ""));
                                    }}
                                    className="w-full rounded-lg border border-slate-800 bg-slate-950 py-2 px-3 text-xs text-white outline-none focus:border-violet-500/50"
                                >
                                    <option value="boolean">Booleano (True/False)</option>
                                    <option value="text">Texto (String)</option>
                                    <option value="json">JSON Objeto / Array</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">
                                    Valor
                                </label>
                                {formTipo === "boolean" ? (
                                    <select
                                        value={formValor}
                                        onChange={(e) => setFormValor(e.target.value)}
                                        className="w-full rounded-lg border border-slate-800 bg-slate-950 py-2 px-3 text-xs text-white outline-none focus:border-violet-500/50"
                                    >
                                        <option value="false">Falso (False)</option>
                                        <option value="true">Verdadeiro (True)</option>
                                    </select>
                                ) : (
                                    <textarea
                                        value={formValor}
                                        onChange={(e) => setFormValor(e.target.value)}
                                        placeholder={formTipo === "json" ? '{"ativo": true, "mensagem": "..."}' : "Meu valor de configuração..."}
                                        rows={formTipo === "json" ? 4 : 2}
                                        required
                                        className="w-full rounded-lg border border-slate-800 bg-slate-950 py-2 px-3 text-xs text-white placeholder-slate-650 outline-none focus:border-violet-500/50 font-mono"
                                    />
                                )}
                            </div>

                            <button
                                type="submit"
                                disabled={updating === formChave}
                                className="w-full mt-2 inline-flex items-center justify-center gap-1 bg-violet-600 hover:bg-violet-500 text-white rounded-lg py-2 text-xs font-bold transition-all disabled:opacity-50 cursor-pointer"
                            >
                                {updating === formChave ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <Save className="h-4 w-4" />
                                )}
                                Salvar Configuração
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
