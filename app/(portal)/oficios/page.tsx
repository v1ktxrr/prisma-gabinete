"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
    Plus,
    Search,
    Mail,
    FileText,
    Calendar,
    AlertTriangle,
    CheckCircle2,
    Clock,
    Archive,
    Trash2,
    Edit2,
    Loader2,
    X,
    Link2,
    ArrowRight,
    ArrowUpRight,
    ChevronRight,
    Send,
    User,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { usePermissions } from "@/hooks/usePermissions";
import { supabase } from "@/lib/supabase";
import { ToastContainer, ToastState } from "@/components/agenda-shared";
import type { Oficio, Atendimento, OficioHistorico } from "@/lib/types";

type OficioStatus = Oficio["status"];

// Helper para formatar data e hora (pt-BR)
function formatarDataHora(dataStr: string | null | undefined) {
    if (!dataStr) return "Sem data";
    const date = new Date(dataStr);
    if (Number.isNaN(date.getTime())) return "Data inválida";
    return new Intl.DateTimeFormat("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    }).format(date);
}

// Helper para formatar apenas data (pt-BR)
function formatarData(dataStr: string | null | undefined) {
    if (!dataStr) return "Sem data";
    // Ajusta para o fuso local tratando apenas a parte YYYY-MM-DD
    const date = new Date(dataStr.includes("T") ? dataStr : `${dataStr}T00:00:00`);
    if (Number.isNaN(date.getTime())) return "Data inválida";
    return new Intl.DateTimeFormat("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
    }).format(date);
}

// Lógica de alerta visual de prazo
function obterAlertaPrazo(prazoStr: string | null | undefined, status: string) {
    if (!prazoStr || status === "concluido" || status === "arquivado") {
        return { urgent: false, expired: false, label: "", class: "bg-slate-50 text-slate-600 border-slate-200" };
    }

    const deadline = new Date(prazoStr.includes("T") ? prazoStr : `${prazoStr}T00:00:00`);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const diffTime = deadline.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
        return {
            urgent: false,
            expired: true,
            label: `Atrasado há ${Math.abs(diffDays)} ${Math.abs(diffDays) === 1 ? "dia" : "dias"}`,
            class: "bg-red-50 text-red-700 border-red-200 animate-pulse font-extrabold"
        };
    }
    if (diffDays === 0) {
        return {
            urgent: true,
            expired: false,
            label: "Vence hoje!",
            class: "bg-amber-50 text-amber-700 border-amber-200 font-extrabold"
        };
    }
    if (diffDays <= 3) {
        return {
            urgent: true,
            expired: false,
            label: `Vence em ${diffDays} ${diffDays === 1 ? "dia" : "dias"}`,
            class: "bg-amber-50 text-amber-700 border-amber-200 font-extrabold"
        };
    }

    return {
        urgent: false,
        expired: false,
        label: `Prazo: ${formatarData(prazoStr)}`,
        class: "bg-slate-50 text-slate-600 border-slate-200"
    };
}

export default function OficiosPage() {
    const router = useRouter();
    const { user } = useAuth();
    const { loading: authLoading, hasModule, profile, unidadeId } = usePermissions();
    const canAccessOficios =
        profile?.cargo === "chefia" || hasModule("oficios_ver") || hasModule("oficios_tramitar");

    // Estados de dados
    const [oficios, setOficios] = useState<Oficio[]>([]);
    const [atendimentos, setAtendimentos] = useState<Atendimento[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [toasts, setToasts] = useState<ToastState[]>([]);

    // Estados de filtros inteligente
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState<string>("todos");
    const [dateFilter, setDateFilter] = useState(""); // Filtro por data de recebimento a partir de

    // Estados do Modal de Criação / Edição rápida
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedOficioForm, setSelectedOficioForm] = useState<Oficio | null>(null);

    // Estado do Drawer de Detalhes e Tramitação
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [detailedOficio, setDetailedOficio] = useState<Oficio | null>(null);
    const [historico, setHistorico] = useState<OficioHistorico[]>([]);
    const [loadingHistorico, setLoadingHistorico] = useState(false);

    // Estado para Exclusão
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [oficioToDelete, setOficioToDelete] = useState<Oficio | null>(null);

    // Estado para registrar nova tramitação direta no Drawer
    const [tramitacaoStatus, setTramitacaoStatus] = useState("");
    const [tramitacaoDesc, setTramitacaoDesc] = useState("");
    const [savingTramitacao, setSavingTramitacao] = useState(false);

    // Valores do Formulário
    const [numero, setNumero] = useState("");
    const [titulo, setTitulo] = useState("");
    const [destinatario, setDestinatario] = useState("");
    const [dataEmissao, setDataEmissao] = useState("");
    const [dataRecebimento, setDataRecebimento] = useState("");
    const [prazoResposta, setPrazoResposta] = useState("");
    const [statusVal, setStatusVal] = useState<OficioStatus>("pendente");
    const [atendimentoId, setAtendimentoId] = useState("");
    const [descricaoTramitacaoInicial, setDescricaoTramitacaoInicial] = useState("");
    const [arquivoUrl, setArquivoUrl] = useState("");

    // Helper para adicionar Toast
    const addToast = useCallback((message: string, type: "success" | "error") => {
        const id = Date.now();
        setToasts((prev) => [...prev, { id, message, type }]);
        window.setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== id));
        }, 4000);
    }, []);

    // Carregar lista de ofícios da API
    const carregarDados = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/oficios");
            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || "Não foi possível carregar os ofícios.");
            }

            setOficios(data.oficios ?? []);
            setAtendimentos(data.atendimentos ?? []);
        } catch (error) {
            const msg = error instanceof Error ? error.message : "Erro ao carregar dados.";
            addToast(msg, "error");
        } finally {
            setLoading(false);
        }
    }, [addToast]);

    // Carregar histórico de um ofício específico para a Timeline
    const carregarHistorico = useCallback(async (id: string) => {
        setLoadingHistorico(true);
        try {
            const res = await fetch(`/api/oficios?id=${id}`);
            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || "Erro ao carregar histórico.");
            }

            setDetailedOficio(data.oficio);
            setHistorico(data.historico ?? []);
            // Inicializar status da tramitação no drawer
            setTramitacaoStatus(data.oficio?.status || "");
        } catch (error) {
            const msg = error instanceof Error ? error.message : "Erro ao carregar histórico.";
            addToast(msg, "error");
        } finally {
            setLoadingHistorico(false);
        }
    }, [addToast]);

    // Redireciona para o login se não autenticado
    useEffect(() => {
        if (!authLoading && !user) {
            router.replace("/login");
        }
    }, [authLoading, router, user]);

    useEffect(() => {
        if (!authLoading && user && !canAccessOficios) {
            router.replace("/dashboard");
        }
    }, [authLoading, canAccessOficios, router, user]);

    // Carrega dados iniciais
    useEffect(() => {
        if (!user || !canAccessOficios) {
            return;
        }

        const timeoutId = window.setTimeout(() => {
            void carregarDados();
        }, 0);

        return () => window.clearTimeout(timeoutId);
    }, [user, canAccessOficios, carregarDados]);

    // Lógica de filtragem inteligente
    const oficiosFiltrados = useMemo(() => {
        return oficios.filter((oficio) => {
            const query = searchQuery.toLowerCase();
            const matchesText =
                oficio.numero.toLowerCase().includes(query) ||
                oficio.titulo.toLowerCase().includes(query) ||
                oficio.destinatario.toLowerCase().includes(query);

            const matchesStatus =
                statusFilter === "todos" || oficio.status === statusFilter;

            let matchesDate = true;
            if (dateFilter && oficio.data_recebimento) {
                const filterTime = new Date(`${dateFilter}T00:00:00`).getTime();
                const recebidoTime = new Date(oficio.data_recebimento).getTime();
                matchesDate = recebidoTime >= filterTime;
            }

            return matchesText && matchesStatus && matchesDate;
        });
    }, [oficios, searchQuery, statusFilter, dateFilter]);

    // Abrir Modal de Criação
    const handleAbrirCriar = () => {
        setSelectedOficioForm(null);
        setNumero("");
        setTitulo("");
        setDestinatario("");
        setDataEmissao(new Date().toISOString().split("T")[0]);
        setDataRecebimento(new Date().toISOString().split("T")[0] + "T12:00");
        setPrazoResposta("");
        setStatusVal("pendente");
        setAtendimentoId("");
        setDescricaoTramitacaoInicial("");
        setArquivoUrl("");
        setModalOpen(true);
    };

    // Abrir Modal de Edição Rápida
    const handleAbrirEditar = (e: React.MouseEvent, oficio: Oficio) => {
        e.stopPropagation(); // Evita abrir o drawer de detalhes
        setSelectedOficioForm(oficio);
        setNumero(oficio.numero);
        setTitulo(oficio.titulo);
        setDestinatario(oficio.destinatario);
        setDataEmissao(oficio.data_emissao);
        setDataRecebimento(oficio.data_recebimento ? oficio.data_recebimento.slice(0, 16) : "");
        setPrazoResposta(oficio.prazo_resposta || "");
        setStatusVal(oficio.status);
        setAtendimentoId(oficio.atendimento_id || "");
        setDescricaoTramitacaoInicial("");
        setArquivoUrl(oficio.arquivo_url || "");
        setModalOpen(true);
    };

    // Abrir Drawer de Detalhes
    const handleAbrirDetalhes = (oficio: Oficio) => {
        setDetailedOficio(oficio);
        setHistorico([]);
        setTramitacaoDesc("");
        setDrawerOpen(true);
        void carregarHistorico(oficio.id);
    };

    // Confirmar Exclusão
    const handleConfirmarExclusao = (e: React.MouseEvent, oficio: Oficio) => {
        e.stopPropagation(); // Evita abrir o drawer
        setOficioToDelete(oficio);
        setDeleteConfirmOpen(true);
    };

    // Criar ou Editar Ofício
    const handleSalvar = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!numero.trim() || !titulo.trim() || !destinatario.trim() || !dataEmissao) {
            addToast("Preencha todos os campos obrigatórios.", "error");
            return;
        }

        setSaving(true);
        try {
            let resolvedAtendimentoId = atendimentoId;
            if (atendimentoId === "new") {
                const { data: newAt, error: newAtError } = await supabase
                    .from("atendimentos")
                    .insert({
                        titulo: `Atendimento: ${titulo.trim()}`,
                        status: "aberto",
                        unidade_id: unidadeId ?? "CG",
                        data: new Date().toISOString()
                    })
                    .select("id")
                    .single();
                if (newAtError) throw newAtError;
                resolvedAtendimentoId = newAt.id;
            }

            const payload = {
                id: selectedOficioForm?.id,
                numero: numero.trim(),
                titulo: titulo.trim(),
                destinatario: destinatario.trim(),
                data_emissao: dataEmissao,
                data_recebimento: dataRecebimento ? new Date(dataRecebimento).toISOString() : null,
                prazo_resposta: prazoResposta || null,
                status: statusVal,
                atendimento_id: resolvedAtendimentoId || null,
                arquivo_url: arquivoUrl.trim() || null,
                descricao_tramitacao: descricaoTramitacaoInicial.trim() || undefined
            };

            const res = await fetch("/api/oficios", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || "Erro ao salvar ofício.");
            }

            addToast(
                selectedOficioForm ? "Ofício atualizado com sucesso!" : "Ofício e protocolo criados com sucesso!",
                "success"
            );
            setModalOpen(false);
            void carregarDados();
            if (drawerOpen && detailedOficio && selectedOficioForm && detailedOficio.id === selectedOficioForm.id) {
                void carregarHistorico(detailedOficio.id);
            }
        } catch (error) {
            const msg = error instanceof Error ? error.message : "Erro ao enviar.";
            addToast(msg, "error");
        } finally {
            setSaving(false);
        }
    };

    // Executar Exclusão
    const handleExcluir = async () => {
        if (!oficioToDelete) return;

        try {
            const res = await fetch(`/api/oficios?id=${oficioToDelete.id}`, {
                method: "DELETE",
            });
            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || "Erro ao excluir ofício.");
            }

            addToast("Ofício excluído com sucesso!", "success");
            setDeleteConfirmOpen(false);
            if (drawerOpen && detailedOficio?.id === oficioToDelete.id) {
                setDrawerOpen(false);
                setDetailedOficio(null);
            }
            setOficioToDelete(null);
            void carregarDados();
        } catch (error) {
            const msg = error instanceof Error ? error.message : "Erro ao excluir.";
            addToast(msg, "error");
        }
    };

    // Registrar nova tramitação (muda status e adiciona log na timeline)
    const handleRegistrarTramitacao = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!detailedOficio) return;

        setSavingTramitacao(true);
        try {
            const payload = {
                id: detailedOficio.id,
                numero: detailedOficio.numero,
                titulo: detailedOficio.titulo,
                destinatario: detailedOficio.destinatario,
                data_emissao: detailedOficio.data_emissao,
                data_recebimento: detailedOficio.data_recebimento,
                prazo_resposta: detailedOficio.prazo_resposta,
                atendimento_id: detailedOficio.atendimento_id,
                arquivo_url: detailedOficio.arquivo_url,
                status: tramitacaoStatus,
                acao_tramitacao: tramitacaoStatus === detailedOficio.status ? "encaminhado" : "status_alterado",
                descricao_tramitacao: tramitacaoDesc.trim() || undefined
            };

            const res = await fetch("/api/oficios", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || "Erro ao registrar tramitação.");
            }

            addToast("Tramitação registrada com sucesso!", "success");
            setTramitacaoDesc("");
            void carregarHistorico(detailedOficio.id);
            void carregarDados(); // Atualiza a lista principal
        } catch (error) {
            const msg = error instanceof Error ? error.message : "Erro ao registrar.";
            addToast(msg, "error");
        } finally {
            setSavingTramitacao(false);
        }
    };

    if (authLoading || !user || !canAccessOficios) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-50">
                <Loader2 className="h-8 w-8 animate-spin text-slate-900" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(241,245,249,0.5),_transparent_35%),linear-gradient(180deg,#f8fafc_0%,#f1f5f9_100%)]">
            <main className="mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-8">

                {/* Page Header */}
                <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all duration-200">
                    <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-slate-500">
                            Protocolo Geral & Controle de Fluxo
                        </p>
                        <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-900">
                            Sistema de Protocolo (Ofícios)
                        </h1>
                        <p className="mt-2 text-sm text-slate-600 max-w-2xl leading-relaxed">
                            Controle a tramitação e a linha do tempo de documentos oficiais recebidos ou emitidos. Monitore prazos legais, adicione despachos e vincule a atendimentos do hub.
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={handleAbrirCriar}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-5 py-3.5 text-sm font-bold text-white transition-all hover:bg-slate-800 active:scale-[0.98] cursor-pointer shadow-xs focus:outline-hidden focus:ring-2 focus:ring-slate-900/10"
                    >
                        <Plus className="h-4 w-4" />
                        Protocolar Ofício
                    </button>
                </section>

                {/* Painel de Filtros Inteligentes */}
                <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs grid grid-cols-1 md:grid-cols-12 gap-4">
                    {/* Busca por Palavra-Chave */}
                    <div className="relative md:col-span-5 w-full">
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-450 mb-1.5">Busca Textual</label>
                        <div className="relative">
                            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Nº, título ou destinatário..."
                                className="w-full rounded-xl border border-slate-200 bg-slate-55 pl-10 pr-4 py-2.5 text-sm text-slate-850 outline-hidden transition-all focus:border-slate-900 focus:bg-white focus:ring-2 focus:ring-slate-900/5 placeholder-slate-400"
                            />
                            {searchQuery && (
                                <button
                                    type="button"
                                    onClick={() => setSearchQuery("")}
                                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                                    aria-label="Limpar busca"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Filtro Status */}
                    <div className="md:col-span-4 w-full">
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-450 mb-1.5">Filtro de Status</label>
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="w-full rounded-xl border border-slate-200 bg-slate-55 px-4 py-2.5 text-sm text-slate-850 outline-hidden transition-all focus:border-slate-900 focus:bg-white focus:ring-2 focus:ring-slate-900/5 cursor-pointer"
                        >
                            <option value="todos">Todos os status</option>
                            <option value="pendente">Pendente</option>
                            <option value="em_analise">Em Análise</option>
                            <option value="encaminhado">Encaminhado</option>
                            <option value="concluido">Concluído</option>
                            <option value="arquivado">Arquivado</option>
                        </select>
                    </div>

                    {/* Filtro Data de Recebimento */}
                    <div className="md:col-span-3 w-full">
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-450 mb-1.5">Recebidos a partir de</label>
                        <div className="relative">
                            <input
                                type="date"
                                value={dateFilter}
                                onChange={(e) => setDateFilter(e.target.value)}
                                className="w-full rounded-xl border border-slate-200 bg-slate-55 px-4 py-2.5 text-sm text-slate-850 outline-hidden transition-all focus:border-slate-900 focus:bg-white focus:ring-2 focus:ring-slate-900/5 cursor-pointer"
                            />
                            {dateFilter && (
                                <button
                                    type="button"
                                    onClick={() => setDateFilter("")}
                                    className="absolute right-9 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                                    aria-label="Limpar data"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            )}
                        </div>
                    </div>
                </section>

                {/* Listagem */}
                <section className="mt-6">
                    {loading ? (
                        <div className="flex justify-center items-center py-20 rounded-3xl border border-slate-200 bg-white">
                            <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
                        </div>
                    ) : oficiosFiltrados.length === 0 ? (
                        <div className="rounded-3xl border border-dashed border-slate-200 bg-white px-4 py-16 text-center shadow-xs">
                            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-50 text-slate-400 border border-slate-100 shadow-2xs">
                                <Mail className="h-5 w-5 text-slate-500" />
                            </div>
                            <h3 className="mt-4 text-sm font-extrabold text-slate-900">
                                Nenhum registro protocolado
                            </h3>
                            <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
                                {searchQuery || statusFilter !== "todos" || dateFilter
                                    ? "Experimente redefinir os filtros ou buscar outra palavra-chave."
                                    : "Cadastre o primeiro ofício no botão de protocolo para abrir o fluxo de tramitações."}
                            </p>
                        </div>
                    ) : (
                        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xs">
                            <div className="overflow-x-auto">
                                <table className="w-full border-collapse text-left text-sm text-slate-500">
                                    <thead className="bg-slate-55/65 border-b border-slate-200 text-xs font-bold uppercase tracking-wider text-slate-500">
                                        <tr>
                                            <th className="px-6 py-4">Protocolo / Assunto</th>
                                            <th className="px-6 py-4">Destinatário</th>
                                            <th className="px-6 py-4">Data Recebimento</th>
                                            <th className="px-6 py-4">Prazo de Resposta</th>
                                            <th className="px-6 py-4">Atendimento</th>
                                            <th className="px-6 py-4">Status</th>
                                            <th className="px-6 py-4 text-right">Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-150 bg-white">
                                        {oficiosFiltrados.map((oficio) => {
                                            const alerta = obterAlertaPrazo(oficio.prazo_resposta, oficio.status);

                                            return (
                                                <tr
                                                    key={oficio.id}
                                                    onClick={() => handleAbrirDetalhes(oficio)}
                                                    className="group hover:bg-slate-50/50 transition-all cursor-pointer"
                                                >
                                                    {/* Documento / Número */}
                                                    <td className="px-6 py-4">
                                                        <div className="flex flex-col gap-0.5">
                                                            <span className="font-extrabold text-slate-900 text-sm group-hover:text-slate-900 group-hover:underline">
                                                                {oficio.numero}
                                                            </span>
                                                            <span className="text-xs text-slate-500 line-clamp-1 max-w-[240px]">
                                                                {oficio.titulo}
                                                            </span>
                                                        </div>
                                                    </td>

                                                    {/* Destinatário */}
                                                    <td className="px-6 py-4">
                                                        <span className="text-slate-700 font-medium">
                                                            {oficio.destinatario}
                                                        </span>
                                                    </td>

                                                    {/* Data Recebimento */}
                                                    <td className="px-6 py-4 text-xs text-slate-650 font-medium">
                                                        {oficio.data_recebimento ? (
                                                            <div className="flex items-center gap-1.5">
                                                                <Calendar className="h-3.5 w-3.5 text-slate-400" />
                                                                <span>{formatarDataHora(oficio.data_recebimento)}</span>
                                                            </div>
                                                        ) : (
                                                            <span className="text-slate-400 italic">Não registrada</span>
                                                        )}
                                                    </td>

                                                    {/* Prazo com alerta forte */}
                                                    <td className="px-6 py-4 text-xs">
                                                        {oficio.prazo_resposta ? (
                                                            <div className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl border ${alerta.class}`}>
                                                                {(alerta.expired || alerta.urgent) ? (
                                                                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                                                                ) : (
                                                                    <Clock className="h-3.5 w-3.5 shrink-0 text-slate-450" />
                                                                )}
                                                                <span>{alerta.label}</span>
                                                            </div>
                                                        ) : (
                                                            <span className="text-slate-400 italic">Sem prazo definido</span>
                                                        )}
                                                    </td>

                                                    {/* Atendimento Hub */}
                                                    <td className="px-6 py-4">
                                                        {oficio.atendimentos ? (
                                                            <div className="inline-flex items-center gap-1 rounded-lg bg-slate-50 border border-slate-200/50 px-2 py-0.5 text-xs text-slate-700 font-semibold max-w-[160px] truncate shadow-2xs">
                                                                <Link2 className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                                                                <span className="truncate">{oficio.atendimentos.titulo}</span>
                                                            </div>
                                                        ) : (
                                                            <span className="text-slate-400 italic text-xs">Sem vínculo</span>
                                                        )}
                                                    </td>

                                                    {/* Status Badge */}
                                                    <td className="px-6 py-4">
                                                        {oficio.status === "pendente" && (
                                                            <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-bold text-amber-700">
                                                                <Clock className="h-3 w-3 shrink-0" />
                                                                Pendente
                                                            </span>
                                                        )}
                                                        {oficio.status === "em_analise" && (
                                                            <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-xs font-bold text-blue-700">
                                                                <FileText className="h-3 w-3 shrink-0" />
                                                                Em Análise
                                                            </span>
                                                        )}
                                                        {oficio.status === "encaminhado" && (
                                                            <span className="inline-flex items-center gap-1 rounded-full border border-purple-200 bg-purple-50 px-2.5 py-0.5 text-xs font-bold text-purple-700">
                                                                <Send className="h-3 w-3 shrink-0" />
                                                                Encaminhado
                                                            </span>
                                                        )}
                                                        {oficio.status === "concluido" && (
                                                            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-250 bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
                                                                <CheckCircle2 className="h-3 w-3 shrink-0" />
                                                                Concluído
                                                            </span>
                                                        )}
                                                        {oficio.status === "arquivado" && (
                                                            <span className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-zinc-100 px-2.5 py-0.5 text-xs font-bold text-zinc-600">
                                                                <Archive className="h-3 w-3 shrink-0" />
                                                                Arquivado
                                                            </span>
                                                        )}
                                                    </td>

                                                    {/* Ações */}
                                                    <td className="px-6 py-4 text-right">
                                                        <div className="flex items-center justify-end gap-2">
                                                            <button
                                                                type="button"
                                                                onClick={(e) => handleAbrirEditar(e, oficio)}
                                                                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-all hover:bg-slate-50 hover:text-slate-900 active:scale-95 cursor-pointer shadow-2xs"
                                                                title="Editar dados rápidos"
                                                            >
                                                                <Edit2 className="h-3.5 w-3.5" />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={(e) => handleConfirmarExclusao(e, oficio)}
                                                                className="flex h-8 w-8 items-center justify-center rounded-lg border border-red-100 bg-white text-red-500 transition-all hover:bg-red-50 hover:text-red-750 active:scale-95 cursor-pointer shadow-2xs"
                                                                title="Excluir Registro"
                                                            >
                                                                <Trash2 className="h-3.5 w-3.5" />
                                                            </button>
                                                            <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-slate-600 transition-colors ml-1" />
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </section>
            </main>

            {/* DRAWER LATERAL DE DETALHES & HISTÓRICO DE TRAMITAÇÃO */}
            {drawerOpen && detailedOficio && (
                <div
                    className="fixed inset-0 bg-slate-950/30 backdrop-blur-xs z-40 flex justify-end"
                    onClick={() => setDrawerOpen(false)}
                >
                    <div
                        className="bg-white w-full max-w-lg h-full flex flex-col shadow-2xl border-l border-slate-200 animate-in slide-in-from-right duration-250"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header Drawer */}
                        <div className="border-b border-slate-100 px-6 py-5 flex items-center justify-between bg-slate-50/50">
                            <div>
                                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">Detalhes do Protocolo</span>
                                <h3 className="text-lg font-black text-slate-900 truncate mt-0.5">{detailedOficio.numero}</h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setDrawerOpen(false)}
                                className="text-slate-400 hover:text-slate-650 rounded-lg p-1.5 hover:bg-slate-100 transition-all cursor-pointer"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        {/* Conteúdo Drawer */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            {/* Cards de Info Básica */}
                            <div className="rounded-2xl border border-slate-150 bg-slate-50/50 p-4 space-y-3">
                                <div>
                                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Título / Assunto</h4>
                                    <p className="text-sm font-semibold text-slate-800">{detailedOficio.titulo}</p>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Destinatário/Origem</h4>
                                        <p className="text-sm font-semibold text-slate-700">{detailedOficio.destinatario}</p>
                                    </div>
                                    <div>
                                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Vínculo de Atendimento</h4>
                                        <p className="text-sm font-semibold text-slate-700">
                                            {detailedOficio.atendimentos?.titulo || "Sem vínculo"}
                                        </p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200/60">
                                    <div>
                                        <h4 className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Emissão</h4>
                                        <p className="text-xs font-semibold text-slate-700">{formatarData(detailedOficio.data_emissao)}</p>
                                    </div>
                                    <div>
                                        <h4 className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Recebimento</h4>
                                        <p className="text-xs font-semibold text-slate-700">
                                            {detailedOficio.data_recebimento ? formatarData(detailedOficio.data_recebimento) : "N/A"}
                                        </p>
                                    </div>
                                    <div>
                                        <h4 className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Status Atual</h4>
                                        <span className="text-[10px] font-extrabold capitalize text-slate-800">{detailedOficio.status.replace("_", " ")}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Ler Anexo Documento (Timbrado) */}
                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (detailedOficio?.arquivo_url) {
                                            window.open(detailedOficio.arquivo_url, "_blank", "noopener,noreferrer");
                                        } else {
                                            addToast("Nenhum arquivo PDF anexado a este ofício.", "error");
                                        }
                                    }}
                                    className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-2.5 text-xs font-bold text-slate-700 transition-all hover:bg-slate-50 cursor-pointer active:scale-98 shadow-2xs"
                                >
                                    <FileText className="h-4 w-4 text-slate-500" />
                                    Visualizar Anexo PDF
                                </button>
                            </div>

                            {/* Seção Linha do Tempo (Timeline) */}
                            <div>
                                <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 mb-4 flex items-center gap-2">
                                    <Clock className="h-4 w-4 text-slate-500" />
                                    Histórico de Tramitação
                                </h4>

                                {loadingHistorico ? (
                                    <div className="flex justify-center py-6">
                                        <Loader2 className="h-6 w-6 animate-spin text-slate-450" />
                                    </div>
                                ) : historico.length === 0 ? (
                                    <p className="text-xs text-slate-450 italic text-center py-4 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                                        Nenhuma tramitação registrada.
                                    </p>
                                ) : (
                                    /* Timeline Vertical */
                                    <div className="relative border-l border-slate-200 pl-5 ml-3.5 space-y-6">
                                        {historico.map((log) => (
                                            <div key={log.id} className="relative">
                                                {/* Indicador de nó na linha */}
                                                <span className="absolute -left-[27.5px] top-0.5 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-white ring-4 ring-slate-100 border border-slate-350">
                                                    {log.acao === "recebido" && (
                                                        <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
                                                    )}
                                                    {log.acao === "encaminhado" && (
                                                        <span className="h-1.5 w-1.5 rounded-full bg-purple-600" />
                                                    )}
                                                    {log.acao === "status_alterado" && (
                                                        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                                                    )}
                                                </span>

                                                <div className="flex flex-col gap-1">
                                                    <div className="flex flex-wrap items-center justify-between gap-1.5">
                                                        <span className="text-xs font-black text-slate-800 uppercase tracking-wide">
                                                            {log.acao === "recebido" && "Recebido / Protocolado"}
                                                            {log.acao === "encaminhado" && "Documento Encaminhado"}
                                                            {log.acao === "status_alterado" && "Status Alterado"}
                                                        </span>
                                                        <span className="text-[10px] font-bold text-slate-400">
                                                            {formatarDataHora(log.criado_em)}
                                                        </span>
                                                    </div>

                                                    {log.descricao && (
                                                        <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 border border-slate-100 rounded-lg p-2 mt-1">
                                                            {log.descricao}
                                                        </p>
                                                    )}

                                                    <div className="flex items-center gap-1 text-[10px] font-semibold text-slate-500 mt-1">
                                                        <User className="h-3 w-3 text-slate-400" />
                                                        <span>Realizado por:</span>
                                                        <span className="text-slate-800 font-bold">
                                                            {log.profiles?.nome || "Usuário do Sistema"}
                                                        </span>
                                                        {log.profiles?.cargo && (
                                                            <span className="text-slate-400">({log.profiles.cargo.replace("_", " ")})</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Seção Adicionar Despacho / Tramitação */}
                            <div className="border-t border-slate-150 pt-5">
                                <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 mb-3 flex items-center gap-2">
                                    <ArrowUpRight className="h-4 w-4 text-slate-500" />
                                    Registrar Novo Despacho
                                </h4>

                                <form onSubmit={handleRegistrarTramitacao} className="space-y-3.5">
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label htmlFor="drawer-status" className="block text-[10px] font-bold uppercase tracking-wider text-slate-450 mb-1">
                                                Novo Status
                                            </label>
                                            <select
                                                id="drawer-status"
                                                value={tramitacaoStatus}
                                                onChange={(e) => setTramitacaoStatus(e.target.value)}
                                                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 outline-hidden transition-all focus:border-slate-900 focus:bg-white bg-white cursor-pointer"
                                            >
                                                <option value="pendente">Pendente</option>
                                                <option value="em_analise">Em Análise</option>
                                                <option value="encaminhado">Encaminhado</option>
                                                <option value="concluido">Concluído</option>
                                                <option value="arquivado">Arquivado</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-450 mb-1">Ação</label>
                                            <div className="rounded-xl border border-slate-100 bg-slate-100 px-3 py-2 text-xs text-slate-600 font-bold uppercase select-none">
                                                {tramitacaoStatus === detailedOficio.status ? "Encaminhar" : "Mudar Status"}
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        <label htmlFor="drawer-desc" className="block text-[10px] font-bold uppercase tracking-wider text-slate-450 mb-1">
                                            Descrição / Despacho
                                        </label>
                                        <textarea
                                            id="drawer-desc"
                                            value={tramitacaoDesc}
                                            onChange={(e) => setTramitacaoDesc(e.target.value)}
                                            placeholder="Descreva a tramitação ou despacho..."
                                            rows={3}
                                            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-800 outline-hidden transition-all focus:border-slate-900 placeholder-slate-400"
                                            required
                                        />
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={savingTramitacao}
                                        className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-900 py-2.5 text-xs font-bold text-white transition-all hover:bg-slate-800 active:scale-95 disabled:opacity-50 cursor-pointer shadow-xs"
                                    >
                                        {savingTramitacao && <Loader2 className="h-4.5 w-4.5 animate-spin" />}
                                        Salvar Despacho
                                    </button>
                                </form>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL DE CRIAÇÃO / EDIÇÃO */}
            {modalOpen && (
                <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs z-50 flex justify-center items-start pt-[5vh] pb-[5vh] overflow-y-auto">
                    <div
                        className="bg-white w-full max-w-xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col mx-4 animate-in fade-in zoom-in-95 duration-200"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header Modal */}
                        <div className="border-b border-slate-100 px-6 py-5 flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-black text-slate-900">
                                    {selectedOficioForm ? "Editar Ofício" : "Protocolar Ofício (Entrada)"}
                                </h3>
                                <p className="text-xs text-slate-500">
                                    {selectedOficioForm ? "Modifique as informações gerais da correspondência." : "Insira as informações para protocolar a correspondência oficial."}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setModalOpen(false)}
                                className="text-slate-400 hover:text-slate-655 rounded-lg p-1 hover:bg-slate-55 transition-colors cursor-pointer"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        {/* Formulário */}
                        <form onSubmit={handleSalvar}>
                            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                                {/* Número do Ofício */}
                                <div>
                                    <label htmlFor="modal-numero" className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                                        Número do Documento <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        id="modal-numero"
                                        type="text"
                                        value={numero}
                                        onChange={(e) => setNumero(e.target.value)}
                                        placeholder="Ex: Ofício nº 123/2026-CG"
                                        className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-800 outline-hidden transition-all focus:border-slate-900 focus:ring-2 focus:ring-slate-900/5 placeholder-slate-400"
                                        required
                                        autoComplete="off"
                                    />
                                </div>

                                {/* Título/Assunto */}
                                <div>
                                    <label htmlFor="modal-titulo" className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                                        Assunto / Título <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        id="modal-titulo"
                                        type="text"
                                        value={titulo}
                                        onChange={(e) => setTitulo(e.target.value)}
                                        placeholder="Ex: Solicitação de Audiência com Secretário"
                                        className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-800 outline-hidden transition-all focus:border-slate-900 focus:ring-2 focus:ring-slate-900/5 placeholder-slate-400"
                                        required
                                        autoComplete="off"
                                    />
                                </div>

                                {/* Destinatário */}
                                <div>
                                    <label htmlFor="modal-destinatario" className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                                        Destinatário / Remetente <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        id="modal-destinatario"
                                        type="text"
                                        value={destinatario}
                                        onChange={(e) => setDestinatario(e.target.value)}
                                        placeholder="Ex: Secretaria de Estado de Saúde"
                                        className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-800 outline-hidden transition-all focus:border-slate-900 focus:ring-2 focus:ring-slate-900/5 placeholder-slate-400"
                                        required
                                        autoComplete="off"
                                    />
                                </div>

                                {/* Datas Grid */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label htmlFor="modal-data-emissao" className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                                            Data de Emissão <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            id="modal-data-emissao"
                                            type="date"
                                            value={dataEmissao}
                                            onChange={(e) => setDataEmissao(e.target.value)}
                                            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-800 outline-hidden transition-all focus:border-slate-900 focus:ring-2 focus:ring-slate-900/5"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label htmlFor="modal-data-recebimento" className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                                            Data/Hora de Recebimento
                                        </label>
                                        <input
                                            id="modal-data-recebimento"
                                            type="datetime-local"
                                            value={dataRecebimento}
                                            onChange={(e) => setDataRecebimento(e.target.value)}
                                            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-800 outline-hidden transition-all focus:border-slate-900 focus:ring-2 focus:ring-slate-900/5"
                                        />
                                    </div>
                                </div>

                                {/* Prazo e Status */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label htmlFor="modal-prazo-resposta" className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                                            Prazo de Resposta <span className="text-slate-400">(Opcional)</span>
                                        </label>
                                        <input
                                            id="modal-prazo-resposta"
                                            type="date"
                                            value={prazoResposta}
                                            onChange={(e) => setPrazoResposta(e.target.value)}
                                            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-800 outline-hidden transition-all focus:border-slate-900 focus:ring-2 focus:ring-slate-900/5"
                                        />
                                    </div>
                                    <div>
                                        <label htmlFor="modal-status" className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                                            Status Inicial <span className="text-red-500">*</span>
                                        </label>
                                        <select
                                            id="modal-status"
                                            value={statusVal}
                                            onChange={(e) => setStatusVal(e.target.value as OficioStatus)}
                                            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-850 outline-hidden transition-all focus:border-slate-900 focus:ring-2 focus:ring-slate-900/5 bg-white cursor-pointer"
                                        >
                                            <option value="pendente">Pendente</option>
                                            <option value="em_analise">Em Análise</option>
                                            <option value="encaminhado">Encaminhado</option>
                                            <option value="concluido">Concluído</option>
                                            <option value="arquivado">Arquivado</option>
                                        </select>
                                    </div>
                                </div>

                                {/* Atendimento Vinculado */}
                                <div>
                                    <label htmlFor="modal-atendimento" className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                                        Vincular a Atendimento <span className="text-slate-450">(Opcional)</span>
                                    </label>
                                    <select
                                        id="modal-atendimento"
                                        value={atendimentoId}
                                        onChange={(e) => setAtendimentoId(e.target.value)}
                                        className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-855 outline-hidden transition-all focus:border-slate-900 focus:ring-2 focus:ring-slate-900/5 bg-white cursor-pointer"
                                    >
                                        <option value="">Nenhum atendimento vinculado</option>
                                        <option value="new">✨ Gerar Novo Atendimento Automaticamente</option>
                                        {atendimentos.map((atendimento) => (
                                            <option key={atendimento.id} value={atendimento.id}>
                                                {atendimento.titulo} ({formatarData(atendimento.data)})
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* URL do Arquivo PDF */}
                                <div>
                                    <label htmlFor="modal-arquivo-url" className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                                        Link do Arquivo PDF (Anexo) <span className="text-slate-400">(Opcional)</span>
                                    </label>
                                    <input
                                        id="modal-arquivo-url"
                                        type="url"
                                        value={arquivoUrl}
                                        onChange={(e) => setArquivoUrl(e.target.value)}
                                        placeholder="Ex: https://.../arquivo.pdf"
                                        className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-800 outline-hidden transition-all focus:border-slate-900 focus:ring-2 focus:ring-slate-900/5 placeholder-slate-400"
                                        autoComplete="off"
                                    />
                                </div>

                                {/* Despacho Inicial (Apenas para Criação) */}
                                {!selectedOficioForm && (
                                    <div>
                                        <label htmlFor="modal-despacho" className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                                            Despacho / Histórico Inicial <span className="text-slate-400">(Opcional)</span>
                                        </label>
                                        <textarea
                                            id="modal-despacho"
                                            value={descricaoTramitacaoInicial}
                                            onChange={(e) => setDescricaoTramitacaoInicial(e.target.value)}
                                            placeholder="Ex: Documento recebido fisicamente pelo assessor João Silva."
                                            rows={2}
                                            className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-850 outline-hidden transition-all focus:border-slate-900 placeholder-slate-400"
                                        />
                                    </div>
                                )}
                            </div>

                            {/* Footer Modal */}
                            <div className="border-t border-slate-100 bg-slate-50 px-6 py-4 flex items-center justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setModalOpen(false)}
                                    className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition-all hover:bg-slate-100 active:scale-95 cursor-pointer"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-5 py-2 text-sm font-bold text-white transition-all hover:bg-slate-800 active:scale-95 disabled:opacity-50 cursor-pointer shadow-xs"
                                >
                                    {saving && <Loader2 className="h-4.5 w-4.5 animate-spin" />}
                                    {selectedOficioForm ? "Salvar Alterações" : "Protocolar Ofício"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* CONFIRMAÇÃO DE EXCLUSÃO */}
            {deleteConfirmOpen && (
                <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs z-50 flex justify-center items-center">
                    <div
                        className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-200 overflow-hidden mx-4 p-6 animate-in fade-in zoom-in-95 duration-200"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h3 className="text-lg font-black text-slate-900">
                            Confirmar Exclusão do Protocolo
                        </h3>
                        <p className="mt-2 text-sm text-slate-500 font-medium">
                            Tem certeza que deseja excluir o protocolo <strong className="text-slate-800">{oficioToDelete?.numero}</strong>? Todos os históricos de tramitação associados serão excluídos permanentemente.
                        </p>

                        <div className="mt-6 flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => setDeleteConfirmOpen(false)}
                                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition-all hover:bg-slate-100 active:scale-95 cursor-pointer"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={handleExcluir}
                                className="rounded-xl bg-red-650 px-4 py-2 text-sm font-bold text-white transition-all hover:bg-red-700 active:scale-95 cursor-pointer shadow-xs"
                            >
                                Excluir
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Container de Toasts */}
            <ToastContainer toasts={toasts} onRemove={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))} />
        </div>
    );
}
