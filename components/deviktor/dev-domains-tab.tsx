"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus, Edit2, Trash2, X } from "lucide-react";

interface Eixo {
    id: string;
    chave: string;
    nome: string;
    cor: string;
    criado_em: string;
}

interface Formato {
    id: string;
    chave: string;
    nome: string;
    criado_em: string;
}

interface DevDomainsTabProps {
    addToast: (msg: string, type: "success" | "error") => void;
}

export function DevDomainsTab({ addToast }: DevDomainsTabProps) {
    const [eixos, setEixos] = useState<Eixo[]>([]);
    const [formatos, setFormatos] = useState<Formato[]>([]);
    const [loadingEixos, setLoadingEixos] = useState(true);
    const [loadingFormatos, setLoadingFormatos] = useState(true);

    // Form states
    const [showEixoModal, setShowEixoModal] = useState(false);
    const [eixoForm, setEixoForm] = useState({ id: "", chave: "", nome: "", cor: "#64748b" });
    const [isEditingEixo, setIsEditingEixo] = useState(false);
    const [submittingEixo, setSubmittingEixo] = useState(false);

    const [showFormatoModal, setShowFormatoModal] = useState(false);
    const [formatoForm, setFormatoForm] = useState({ id: "", chave: "", nome: "" });
    const [isEditingFormato, setIsEditingFormato] = useState(false);
    const [submittingFormato, setSubmittingFormato] = useState(false);

    const fetchEixos = async () => {
        setLoadingEixos(true);
        try {
            const res = await fetch("/api/deviktor-sys/domains/eixos");
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Erro ao carregar eixos");
            }
            const data = await res.json();
            setEixos(data.eixos || []);
        } catch (err: any) {
            addToast(err.message, "error");
        } finally {
            setLoadingEixos(false);
        }
    };

    const fetchFormatos = async () => {
        setLoadingFormatos(true);
        try {
            const res = await fetch("/api/deviktor-sys/domains/formatos");
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Erro ao carregar formatos");
            }
            const data = await res.json();
            setFormatos(data.formatos || []);
        } catch (err: any) {
            addToast(err.message, "error");
        } finally {
            setLoadingFormatos(false);
        }
    };

    useEffect(() => {
        fetchEixos();
        fetchFormatos();
    }, []);

    const handleEixoSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmittingEixo(true);
        const url = isEditingEixo 
            ? `/api/deviktor-sys/domains/eixos/${eixoForm.id}`
            : "/api/deviktor-sys/domains/eixos";
        const method = isEditingEixo ? "PUT" : "POST";

        try {
            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    chave: eixoForm.chave,
                    nome: eixoForm.nome,
                    cor: eixoForm.cor,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Erro ao salvar eixo");

            addToast(isEditingEixo ? "Eixo atualizado com sucesso" : "Eixo criado com sucesso", "success");
            setShowEixoModal(false);
            setEixoForm({ id: "", chave: "", nome: "", cor: "#64748b" });
            fetchEixos();
        } catch (err: any) {
            addToast(err.message, "error");
        } finally {
            setSubmittingEixo(false);
        }
    };

    const handleFormatoSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmittingFormato(true);
        const url = isEditingFormato 
            ? `/api/deviktor-sys/domains/formatos/${formatoForm.id}`
            : "/api/deviktor-sys/domains/formatos";
        const method = isEditingFormato ? "PUT" : "POST";

        try {
            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    chave: formatoForm.chave,
                    nome: formatoForm.nome,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Erro ao salvar formato");

            addToast(isEditingFormato ? "Formato atualizado com sucesso" : "Formato criado com sucesso", "success");
            setShowFormatoModal(false);
            setFormatoForm({ id: "", chave: "", nome: "" });
            fetchFormatos();
        } catch (err: any) {
            addToast(err.message, "error");
        } finally {
            setSubmittingFormato(false);
        }
    };

    const handleDeleteEixo = async (id: string) => {
        if (!confirm("Tem certeza que deseja excluir este eixo?")) return;
        try {
            const res = await fetch(`/api/deviktor-sys/domains/eixos/${id}`, { method: "DELETE" });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Erro ao excluir");
            }
            addToast("Eixo excluído com sucesso", "success");
            fetchEixos();
        } catch (err: any) {
            addToast(err.message, "error");
        }
    };

    const handleDeleteFormato = async (id: string) => {
        if (!confirm("Tem certeza que deseja excluir este formato?")) return;
        try {
            const res = await fetch(`/api/deviktor-sys/domains/formatos/${id}`, { method: "DELETE" });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Erro ao excluir");
            }
            addToast("Formato excluído com sucesso", "success");
            fetchFormatos();
        } catch (err: any) {
            addToast(err.message, "error");
        }
    };

    return (
        <div className="grid gap-8 md:grid-cols-2">
            {/* Eixos Temáticos */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 flex flex-col gap-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div>
                        <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                            Eixos Temáticos
                        </h3>
                        <p className="text-[11px] text-slate-500">
                            Classificação estratégica de pautas e calendários.
                        </p>
                    </div>
                    <button
                        onClick={() => {
                            setIsEditingEixo(false);
                            setEixoForm({ id: "", chave: "", nome: "", cor: "#64748b" });
                            setShowEixoModal(true);
                        }}
                        className="inline-flex items-center gap-1 bg-violet-600 hover:bg-violet-500 text-white rounded-lg px-2.5 py-1.5 text-xs font-bold transition-all cursor-pointer font-sans"
                    >
                        <Plus className="h-3.5 w-3.5" />
                        Novo Eixo
                    </button>
                </div>

                {loadingEixos ? (
                    <div className="flex h-40 items-center justify-center">
                        <Loader2 className="h-6 w-6 animate-spin text-slate-600" />
                    </div>
                ) : eixos.length === 0 ? (
                    <p className="text-xs italic text-slate-500 text-center py-8">Nenhum eixo cadastrado.</p>
                ) : (
                    <div className="divide-y divide-slate-800/60 max-h-96 overflow-y-auto pr-1">
                        {eixos.map((e) => (
                            <div key={e.id} className="py-3 flex items-center justify-between gap-4 group">
                                <div className="flex items-center gap-3">
                                    <span 
                                        className="h-3.5 w-3.5 rounded-full shrink-0 border border-black/10" 
                                        style={{ backgroundColor: e.cor }}
                                    />
                                    <div>
                                        <div className="text-xs font-bold text-white">{e.nome}</div>
                                        <div className="text-[10px] font-mono text-slate-500">{e.chave}</div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={() => {
                                            setIsEditingEixo(true);
                                            setEixoForm({ id: e.id, chave: e.chave, nome: e.nome, cor: e.cor });
                                            setShowEixoModal(true);
                                        }}
                                        className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                                        title="Editar"
                                    >
                                        <Edit2 className="h-3.5 w-3.5" />
                                    </button>
                                    <button
                                        onClick={() => handleDeleteEixo(e.id)}
                                        className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-950/20 rounded-lg transition-colors cursor-pointer"
                                        title="Excluir"
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Formatos de Mídia */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 flex flex-col gap-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div>
                        <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                            Formatos de Mídia
                        </h3>
                        <p className="text-[11px] text-slate-500">
                            Tipos de entregas de comunicação produzidas.
                        </p>
                    </div>
                    <button
                        onClick={() => {
                            setIsEditingFormato(false);
                            setFormatoForm({ id: "", chave: "", nome: "" });
                            setShowFormatoModal(true);
                        }}
                        className="inline-flex items-center gap-1 bg-violet-600 hover:bg-violet-500 text-white rounded-lg px-2.5 py-1.5 text-xs font-bold transition-all cursor-pointer font-sans"
                    >
                        <Plus className="h-3.5 w-3.5" />
                        Novo Formato
                    </button>
                </div>

                {loadingFormatos ? (
                    <div className="flex h-40 items-center justify-center">
                        <Loader2 className="h-6 w-6 animate-spin text-slate-600" />
                    </div>
                ) : formatos.length === 0 ? (
                    <p className="text-xs italic text-slate-500 text-center py-8">Nenhum formato cadastrado.</p>
                ) : (
                    <div className="divide-y divide-slate-800/60 max-h-96 overflow-y-auto pr-1">
                        {formatos.map((f) => (
                            <div key={f.id} className="py-3 flex items-center justify-between gap-4 group">
                                <div>
                                    <div className="text-xs font-bold text-white">{f.nome}</div>
                                    <div className="text-[10px] font-mono text-slate-500">{f.chave}</div>
                                </div>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={() => {
                                            setIsEditingFormato(true);
                                            setFormatoForm({ id: f.id, chave: f.chave, nome: f.nome });
                                            setShowFormatoModal(true);
                                        }}
                                        className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                                        title="Editar"
                                    >
                                        <Edit2 className="h-3.5 w-3.5" />
                                    </button>
                                    <button
                                        onClick={() => handleDeleteFormato(f.id)}
                                        className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-950/20 rounded-lg transition-colors cursor-pointer"
                                        title="Excluir"
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* EIXO MODAL */}
            {showEixoModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-sm flex flex-col gap-4 text-left font-sans">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                            <h4 className="font-bold text-white text-sm">
                                {isEditingEixo ? "Editar Eixo Temático" : "Novo Eixo Temático"}
                            </h4>
                            <button 
                                onClick={() => setShowEixoModal(false)}
                                className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded-md cursor-pointer"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                        <form onSubmit={handleEixoSubmit} className="space-y-4">
                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">
                                    Chave única (Slug)
                                </label>
                                <input
                                    type="text"
                                    value={eixoForm.chave}
                                    onChange={(e) => setEixoForm({ ...eixoForm, chave: e.target.value })}
                                    placeholder="ex: assistencia_social"
                                    className="w-full rounded-lg border border-slate-800 bg-slate-950 py-2 px-3 text-xs text-white placeholder-slate-650 outline-none focus:border-violet-500/50 disabled:opacity-40"
                                    disabled={isEditingEixo}
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">
                                    Nome amigável
                                </label>
                                <input
                                    type="text"
                                    value={eixoForm.nome}
                                    onChange={(e) => setEixoForm({ ...eixoForm, nome: e.target.value })}
                                    placeholder="ex: Assistência Social"
                                    className="w-full rounded-lg border border-slate-800 bg-slate-950 py-2 px-3 text-xs text-white placeholder-slate-650 outline-none focus:border-violet-500/50"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">
                                    Cor Hexadecimal
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        type="color"
                                        value={eixoForm.cor}
                                        onChange={(e) => setEixoForm({ ...eixoForm, cor: e.target.value })}
                                        className="h-8 w-12 rounded border border-slate-800 bg-transparent cursor-pointer p-0 shrink-0"
                                    />
                                    <input
                                        type="text"
                                        value={eixoForm.cor}
                                        onChange={(e) => setEixoForm({ ...eixoForm, cor: e.target.value })}
                                        placeholder="#64748b"
                                        className="w-full rounded-lg border border-slate-800 bg-slate-950 py-2 px-3 text-xs text-white outline-none focus:border-violet-500/50"
                                        required
                                    />
                                </div>
                            </div>
                            <button
                                type="submit"
                                disabled={submittingEixo}
                                className="w-full inline-flex items-center justify-center bg-violet-600 hover:bg-violet-500 text-white rounded-lg py-2 text-xs font-bold transition-all disabled:opacity-50 cursor-pointer font-sans"
                            >
                                {submittingEixo ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                                <span>Salvar Eixo</span>
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* FORMATO MODAL */}
            {showFormatoModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-sm flex flex-col gap-4 text-left font-sans">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                            <h4 className="font-bold text-white text-sm">
                                {isEditingFormato ? "Editar Formato" : "Novo Formato de Mídia"}
                            </h4>
                            <button 
                                onClick={() => setShowFormatoModal(false)}
                                className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded-md cursor-pointer"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                        <form onSubmit={handleFormatoSubmit} className="space-y-4">
                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">
                                    Chave única (Slug)
                                </label>
                                <input
                                    type="text"
                                    value={formatoForm.chave}
                                    onChange={(e) => setFormatoForm({ ...formatoForm, chave: e.target.value })}
                                    placeholder="ex: podcast"
                                    className="w-full rounded-lg border border-slate-800 bg-slate-950 py-2 px-3 text-xs text-white placeholder-slate-650 outline-none focus:border-violet-500/50 disabled:opacity-40"
                                    disabled={isEditingFormato}
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">
                                    Nome amigável
                                </label>
                                <input
                                    type="text"
                                    value={formatoForm.nome}
                                    onChange={(e) => setFormatoForm({ ...formatoForm, nome: e.target.value })}
                                    placeholder="ex: Podcast"
                                    className="w-full rounded-lg border border-slate-800 bg-slate-950 py-2 px-3 text-xs text-white placeholder-slate-650 outline-none focus:border-violet-500/50"
                                    required
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={submittingFormato}
                                className="w-full inline-flex items-center justify-center bg-violet-600 hover:bg-violet-500 text-white rounded-lg py-2 text-xs font-bold transition-all disabled:opacity-50 cursor-pointer font-sans"
                            >
                                {submittingFormato ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                                <span>Salvar Formato</span>
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
