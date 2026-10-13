"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
    Loader2, Plus, SearchX, AlertCircle, Trash2, Edit,
    ChevronDown, Calendar, Mail, FileText, Layers, Briefcase,
    Link2, Link2Off, X, ChevronRight, AlertTriangle, ArrowRight, MapPin
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { useUserRole } from "@/hooks/useUserRole";
import { usePermissions } from "@/hooks/usePermissions";
import { Atendimento, Demanda } from "@/lib/types";
import MunicipioAutocomplete from "@/components/ui/municipio-autocomplete";
import CRMAlertBanner from "@/components/ui/crm-alert-banner";

interface ToastState {
    id: number;
    message: string;
    type: "success" | "error";
}

interface TimelineItem {
    id: string;
    tipo: 'oficio' | 'task' | 'briefing';
    titulo: string;
    subtitulo: string;
    data: string;
    status: string;
}

function formatStatus(status: string) {
    switch (status) {
        case "aberto": return "Aberto";
        case "em_andamento": return "Em Andamento";
        case "concluido": return "Concluído";
        case "arquivado": return "Arquivado";
        default: return status;
    }
}

export default function AtendimentosPage() {
    const { user, loading: authLoading } = useAuth();
    const { cargo, loading: roleLoading } = useUserRole();
    const { hasModule, unidadeId } = usePermissions();
    const router = useRouter();

    const [atendimentos, setAtendimentos] = useState<Atendimento[]>([]);
    const [selecionado, setSelecionado] = useState<Atendimento | null>(null);
    const [pesquisa, setPesquisa] = useState("");
    const [filtroStatus, setFiltroStatus] = useState("todos");
    const [carregando, setCarregando] = useState(true);

    // Timeline do caso selecionado
    const [timelineItems, setTimelineItems] = useState<TimelineItem[]>([]);
    const [carregandoTimeline, setCarregandoTimeline] = useState(false);

    // Modal CRUD Atendimento
    const [modalAberto, setModalAberto] = useState(false);
    const [paraEditar, setParaEditar] = useState<Atendimento | null>(null);
    const [titulo, setTitulo] = useState("");
    const [dataCaso, setDataCaso] = useState("");
    const [statusCaso, setStatusCaso] = useState<'aberto' | 'em_andamento' | 'concluido' | 'arquivado'>('aberto');
    const [municipioId, setMunicipioId] = useState<string | null>(null);
    const [salvando, setSalvando] = useState(false);

    // Modal Associação (Link)
    const [modalLinkAberto, setModalLinkAberto] = useState(false);
    const [tipoLink, setTipoLink] = useState<'oficio' | 'task' | 'briefing'>('oficio');
    const [itensDisponiveis, setItensDisponiveis] = useState<any[]>([]);
    const [carregandoDisponiveis, setCarregandoDisponiveis] = useState(false);
    const [itemParaVincular, setItemParaVincular] = useState("");
    const [vinculandoItem, setVinculandoItem] = useState(false);

    const [toasts, setToasts] = useState<ToastState[]>([]);
    const isLoading = authLoading || roleLoading;

    // Sub-abas do detalhe
    const [detailTab, setDetailTab] = useState<"timeline" | "demandas">("timeline");

    // Listagem de demandas
    const [demandas, setDemandas] = useState<Demanda[]>([]);
    const [carregandoDemandas, setCarregandoDemandas] = useState(false);

    // Alertas por cidade (CRM)
    const [alertasCidade, setAlertasCidade] = useState(0);
    const [alertasModal, setAlertasModal] = useState(0);

    // Modal CRUD Demanda
    const [modalDemandaAberto, setModalDemandaAberto] = useState(false);
    const [demandaSolicitante, setDemandaSolicitante] = useState("");
    const [demandaDescricao, setDemandaDescricao] = useState("");
    const [demandaMunicipioId, setDemandaMunicipioId] = useState<string | null>(null);
    const [salvandoDemanda, setSalvandoDemanda] = useState(false);

    /* ---- Toast helpers ---- */
    const addToast = useCallback((message: string, type: "success" | "error") => {
        const id = Date.now();
        setToasts((prev) => [...prev, { id, message, type }]);
        setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== id));
        }, 3000);
    }, []);

    const removeToast = (id: number) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    };

    /* ---- Buscar Atendimentos ---- */
    const buscarAtendimentos = useCallback(async (reselectId?: string) => {
        setCarregando(true);
        try {
            const { data, error } = await supabase
                .from("atendimentos")
                .select("*, municipios(nome)")
                .eq("unidade_id", unidadeId ?? "CG")
                .order("criado_em", { ascending: false });
            if (error) throw error;
            const list = (data as Atendimento[]) || [];
            setAtendimentos(list);

            const activeId = reselectId || selecionado?.id;
            if (activeId) {
                const found = list.find(a => a.id === activeId);
                if (found) {
                    setSelecionado(found);
                } else {
                    setSelecionado(null);
                }
            }
        } catch (err: any) {
            console.error("Erro ao buscar atendimentos:", err);
            addToast("Erro ao carregar lista de atendimentos.", "error");
        } finally {
            setCarregando(false);
        }
    }, [unidadeId, selecionado, addToast]);

    /* ---- Buscar Timeline do Caso Selecionado ---- */
    const buscarTimeline = useCallback(async (atendimentoId: string) => {
        setCarregandoTimeline(true);
        try {
            // 1. Buscar Tasks
            const { data: tasks, error: tasksError } = await supabase
                .from("tasks")
                .select("id, titulo, data_inicio, event_type, status")
                .eq("atendimento_id", atendimentoId);
            if (tasksError) throw tasksError;

            // 2. Buscar Oficios
            const { data: oficios, error: oficiosError } = await supabase
                .from("oficios")
                .select("id, numero, destinatario, status, data_emissao, titulo")
                .eq("atendimento_id", atendimentoId);
            if (oficiosError) throw oficiosError;

            // 3. Buscar Briefings
            const { data: briefings, error: briefingsError } = await supabase
                .from("briefings")
                .select("id, organizacao, criado_em, titulo_customizado, data_customizada")
                .eq("atendimento_id", atendimentoId);
            if (briefingsError) throw briefingsError;

            // Converter em itens unificados
            const items: TimelineItem[] = [];

            tasks?.forEach(t => {
                items.push({
                    id: t.id,
                    tipo: 'task',
                    titulo: t.titulo,
                    subtitulo: `Compromisso (${t.event_type === 'agenda_oficial' ? 'Agenda Titular' : t.event_type === 'acontecendo' ? 'Agenda Gabinete' : t.event_type})`,
                    data: t.data_inicio || new Date().toISOString(),
                    status: t.status
                });
            });

            oficios?.forEach(o => {
                items.push({
                    id: o.id,
                    tipo: 'oficio',
                    titulo: o.titulo || `Ofício Nº ${o.numero}`,
                    subtitulo: `Destinatário: ${o.destinatario}`,
                    data: o.data_emissao,
                    status: o.status
                });
            });

            briefings?.forEach(b => {
                items.push({
                    id: b.id,
                    tipo: 'briefing',
                    titulo: b.titulo_customizado || `Briefing - ${b.organizacao}`,
                    subtitulo: `Organização: ${b.organizacao}`,
                    data: b.data_customizada || b.criado_em,
                    status: 'finalizado'
                });
            });

            // Ordenar por data decrescente (mais recente primeiro)
            items.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
            setTimelineItems(items);
        } catch (err: any) {
            console.error("Erro ao buscar timeline:", err);
            addToast("Não foi possível carregar a linha do tempo do caso.", "error");
        } finally {
            setCarregandoTimeline(false);
        }
    }, [addToast]);

    const buscarAlertasCidade = useCallback(async (cidadeId: string | null) => {
        if (!cidadeId) {
            setAlertasCidade(0);
            return;
        }
        try {
            const { count, error } = await supabase
                .from("demandas")
                .select("*", { count: "exact", head: true })
                .eq("municipio_id", cidadeId)
                .eq("status", "em_andamento")
                .eq("unidade_id", unidadeId ?? "CG");
            if (error) throw error;
            setAlertasCidade(count || 0);
        } catch (err) {
            console.error("Erro ao buscar alertas da cidade:", err);
            setAlertasCidade(0);
        }
    }, [unidadeId]);

    const buscarDemandas = useCallback(async (atendimentoId: string) => {
        setCarregandoDemandas(true);
        try {
            const { data, error } = await supabase
                .from("demandas")
                .select("*, municipios(nome)")
                .eq("atendimento_id", atendimentoId)
                .order("criado_em", { ascending: false });
            if (error) throw error;
            setDemandas((data as Demanda[]) || []);
        } catch (err) {
            console.error("Erro ao buscar demandas:", err);
            addToast("Não foi possível carregar as demandas.", "error");
        } finally {
            setCarregandoDemandas(false);
        }
    }, [addToast]);

    useEffect(() => {
        if (!isLoading && user && unidadeId) {
            void buscarAtendimentos();
        }
    }, [user, isLoading, unidadeId]);

    useEffect(() => {
        if (selecionado) {
            void buscarTimeline(selecionado.id);
            void buscarDemandas(selecionado.id);
            setDetailTab("timeline");
            if (selecionado.municipio_id) {
                void buscarAlertasCidade(selecionado.municipio_id);
            } else {
                setAlertasCidade(0);
            }
        } else {
            setTimelineItems([]);
            setDemandas([]);
            setAlertasCidade(0);
        }
    }, [selecionado, buscarTimeline, buscarDemandas, buscarAlertasCidade]);

    useEffect(() => {
        if (modalAberto && municipioId) {
            const fetchAlertasModal = async () => {
                try {
                    const { count } = await supabase
                        .from("demandas")
                        .select("*", { count: "exact", head: true })
                        .eq("municipio_id", municipioId)
                        .eq("status", "em_andamento")
                        .eq("unidade_id", unidadeId ?? "CG");
                    setAlertasModal(count || 0);
                } catch (err) {
                    setAlertasModal(0);
                }
            };
            void fetchAlertasModal();
        } else {
            setAlertasModal(0);
        }
    }, [modalAberto, municipioId, unidadeId]);

    /* ---- Filtered cases ---- */
    const atendimentosFiltrados = useMemo(() => {
        return atendimentos.filter(a => {
            const matchesSearch = a.titulo.toLowerCase().includes(pesquisa.toLowerCase());
            const matchesStatus = filtroStatus === 'todos' || a.status === filtroStatus;
            return matchesSearch && matchesStatus;
        });
    }, [atendimentos, pesquisa, filtroStatus]);

    /* ---- CRUD Actions ---- */
    const abrirCriar = () => {
        setParaEditar(null);
        setTitulo("");
        setDataCaso(new Date().toISOString().slice(0, 10));
        setStatusCaso("aberto");
        setMunicipioId(null);
        setModalAberto(true);
    };

    const abrirEditar = (a: Atendimento) => {
        setParaEditar(a);
        setTitulo(a.titulo);
        setDataCaso(new Date(a.data).toISOString().slice(0, 10));
        setStatusCaso(a.status);
        setMunicipioId(a.municipio_id || null);
        setModalAberto(true);
    };

    const salvarAtendimento = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!titulo.trim() || !dataCaso) return;
        setSalvando(true);

        try {
            if (paraEditar) {
                // Update
                const { error } = await supabase
                    .from("atendimentos")
                    .update({
                        titulo: titulo.trim(),
                        data: new Date(dataCaso).toISOString(),
                        status: statusCaso,
                        municipio_id: municipioId
                    })
                    .eq("id", paraEditar.id);
                if (error) throw error;
                addToast("Atendimento atualizado com sucesso!", "success");
                await buscarAtendimentos(paraEditar.id);
            } else {
                // Insert
                const { data, error } = await supabase
                    .from("atendimentos")
                    .insert({
                        titulo: titulo.trim(),
                        data: new Date(dataCaso).toISOString(),
                        status: statusCaso,
                        unidade_id: unidadeId ?? "CG",
                        municipio_id: municipioId
                    })
                    .select("*, municipios(nome)");
                if (error) throw error;
                addToast("Atendimento cadastrado com sucesso!", "success");
                const newObj = data?.[0] as Atendimento;
                setSelecionado(newObj);
                await buscarAtendimentos(newObj?.id);
            }
            setModalAberto(false);
        } catch (err: any) {
            console.error("Erro ao salvar atendimento:", err);
            addToast(err.message || "Erro ao salvar atendimento.", "error");
        } finally {
            setSalvando(false);
        }
    };

    const excluirAtendimento = async (id: string) => {
        if (!confirm("Tem certeza que deseja excluir este atendimento? Todos os vínculos com ofícios, pautas e briefings serão desassociados (mas os itens originais não serão apagados).")) return;
        try {
            const { error } = await supabase
                .from("atendimentos")
                .delete()
                .eq("id", id);
            if (error) throw error;

            addToast("Atendimento excluído com sucesso!", "success");
            setSelecionado(null);
            await buscarAtendimentos();
        } catch (err: any) {
            console.error("Erro ao excluir atendimento:", err);
            addToast("Erro ao excluir atendimento.", "error");
        }
    };

    const atualizarStatusAtendimento = async (status: 'aberto' | 'em_andamento' | 'concluido' | 'arquivado') => {
        if (!selecionado) return;
        try {
            const { error } = await supabase
                .from("atendimentos")
                .update({ status })
                .eq("id", selecionado.id);
            if (error) throw error;

            addToast("Status do caso atualizado!", "success");
            setAtendimentos(prev => prev.map(a => a.id === selecionado.id ? { ...a, status } : a));
            setSelecionado(prev => prev ? { ...prev, status } : null);
        } catch (err: any) {
            console.error("Erro ao atualizar status:", err);
            addToast("Falha ao atualizar status.", "error");
        }
    };

    /* ---- Linking/Unlinking Spokes ---- */
    const abrirModalLink = async (tipo: 'oficio' | 'task' | 'briefing') => {
        setTipoLink(tipo);
        setModalLinkAberto(true);
        setCarregandoDisponiveis(true);
        setItemParaVincular("");
        try {
            if (tipo === 'oficio') {
                const { data, error } = await supabase
                    .from("oficios")
                    .select("id, numero, titulo, destinatario")
                    .eq("unidade_id", unidadeId ?? "CG")
                    .is("atendimento_id", null);
                if (error) throw error;
                setItensDisponiveis(data || []);
            } else if (tipo === 'task') {
                const { data, error } = await supabase
                    .from("tasks")
                    .select("id, titulo, data_inicio")
                    .eq("unidade_id", unidadeId ?? "CG")
                    .is("atendimento_id", null);
                if (error) throw error;
                setItensDisponiveis(data || []);
            } else if (tipo === 'briefing') {
                const { data, error } = await supabase
                    .from("briefings")
                    .select(`
                        id,
                        organizacao,
                        titulo_customizado,
                        agenda_id,
                        tasks!agenda_id (
                            unidade_id
                        )
                    `)
                    .is("atendimento_id", null);
                if (error) throw error;

                // Filtrar client-side para garantir unidade
                const filtrados = (data || []).filter((b: any) => {
                    return !b.tasks || b.tasks.unidade_id === (unidadeId ?? "CG");
                });
                setItensDisponiveis(filtrados);
            }
        } catch (err: any) {
            console.error("Erro ao carregar itens para link:", err);
            addToast("Não foi possível carregar os itens não vinculados.", "error");
        } finally {
            setCarregandoDisponiveis(false);
        }
    };

    const vincularSpoke = async () => {
        if (!itemParaVincular || !selecionado) return;
        setVinculandoItem(true);
        try {
            let error;
            if (tipoLink === 'oficio') {
                const { error: err } = await supabase
                    .from("oficios")
                    .update({ atendimento_id: selecionado.id })
                    .eq("id", itemParaVincular);
                error = err;
            } else if (tipoLink === 'task') {
                const { error: err } = await supabase
                    .from("tasks")
                    .update({ atendimento_id: selecionado.id })
                    .eq("id", itemParaVincular);
                error = err;
            } else if (tipoLink === 'briefing') {
                const { error: err } = await supabase
                    .from("briefings")
                    .update({ atendimento_id: selecionado.id })
                    .eq("id", itemParaVincular);
                error = err;
            }

            if (error) throw error;

            addToast("Vínculo estabelecido com sucesso!", "success");
            setModalLinkAberto(false);
            setItemParaVincular("");
            await buscarTimeline(selecionado.id);
        } catch (err: any) {
            console.error("Erro ao vincular item:", err);
            addToast(err.message || "Erro ao estabelecer vínculo.", "error");
        } finally {
            setVinculandoItem(false);
        }
    };

    const desvincularSpoke = async (itemId: string, tipo: 'oficio' | 'task' | 'briefing') => {
        if (!selecionado) return;
        if (!confirm("Tem certeza que deseja desvincular este item deste caso?")) return;
        try {
            let error;
            if (tipo === 'oficio') {
                const { error: err } = await supabase
                    .from("oficios")
                    .update({ atendimento_id: null })
                    .eq("id", itemId);
                error = err;
            } else if (tipo === 'task') {
                const { error: err } = await supabase
                    .from("tasks")
                    .update({ atendimento_id: null })
                    .eq("id", itemId);
                error = err;
            } else if (tipo === 'briefing') {
                const { error: err } = await supabase
                    .from("briefings")
                    .update({ atendimento_id: null })
                    .eq("id", itemId);
                error = err;
            }

            if (error) throw error;

            addToast("Item desvinculado com sucesso!", "success");
            await buscarTimeline(selecionado.id);
        } catch (err: any) {
            console.error("Erro ao desvincular item:", err);
            addToast("Erro ao desvincular o item.", "error");
        }
    };

    const abrirCriarDemanda = () => {
        setDemandaSolicitante("");
        setDemandaDescricao("");
        setDemandaMunicipioId(selecionado?.municipio_id || null);
        setModalDemandaAberto(true);
    };

    const salvarDemanda = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selecionado || !demandaSolicitante.trim() || !demandaDescricao.trim() || !demandaMunicipioId) {
            addToast("Preencha todos os campos obrigatórios.", "error");
            return;
        }
        setSalvandoDemanda(true);
        try {
            const { error } = await supabase
                .from("demandas")
                .insert({
                    atendimento_id: selecionado.id,
                    municipio_id: demandaMunicipioId,
                    solicitante: demandaSolicitante.trim(),
                    descricao: demandaDescricao.trim(),
                    status: "em_andamento",
                    unidade_id: unidadeId ?? "CG"
                });
            if (error) throw error;
            addToast("Demanda cadastrada com sucesso!", "success");
            setModalDemandaAberto(false);
            await buscarDemandas(selecionado.id);
            if (selecionado.municipio_id) {
                await buscarAlertasCidade(selecionado.municipio_id);
            }
        } catch (err: any) {
            console.error("Erro ao salvar demanda:", err);
            addToast(err.message || "Erro ao cadastrar demanda.", "error");
        } finally {
            setSalvandoDemanda(false);
        }
    };

    const excluirDemanda = async (id: string) => {
        if (!confirm("Tem certeza que deseja excluir esta demanda?")) return;
        try {
            const { error } = await supabase
                .from("demandas")
                .delete()
                .eq("id", id);
            if (error) throw error;
            addToast("Demanda excluída com sucesso!", "success");
            if (selecionado) {
                await buscarDemandas(selecionado.id);
                if (selecionado.municipio_id) {
                    await buscarAlertasCidade(selecionado.municipio_id);
                }
            }
        } catch (err) {
            console.error("Erro ao excluir demanda:", err);
            addToast("Erro ao excluir demanda.", "error");
        }
    };

    const atualizarStatusDemanda = async (id: string, status: 'em_andamento' | 'entregue' | 'negado') => {
        try {
            const { error } = await supabase
                .from("demandas")
                .update({ status })
                .eq("id", id);
            if (error) throw error;
            addToast("Status da demanda atualizado!", "success");
            setDemandas(prev => prev.map(d => d.id === id ? { ...d, status } : d));
            if (selecionado?.municipio_id) {
                await buscarAlertasCidade(selecionado.municipio_id);
            }
        } catch (err) {
            console.error("Erro ao atualizar status da demanda:", err);
            addToast("Falha ao atualizar status da demanda.", "error");
        }
    };

    if (isLoading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-50">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col">
            <main className="flex-1 mx-auto w-full max-w-6xl px-4 py-6 md:px-6 lg:px-8">
                
                {/* Page Header */}
                <div className="border-b border-slate-200/80 bg-white/80 backdrop-blur-xl rounded-3xl shadow-sm mb-6 p-6 md:p-8">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="inline-flex items-center rounded-full bg-slate-100 border border-slate-200 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-650">
                                    Casos & demandas
                                </span>
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 border border-blue-100 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-blue-700">
                                    Hub Central
                                </span>
                            </div>
                            <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-900 md:text-4xl">
                                Hub de Atendimentos
                            </h1>
                            <p className="mt-2 max-w-2xl text-xs sm:text-sm text-slate-500 leading-relaxed font-semibold">
                                Gerencie casos políticos e integre a linha do tempo de ofícios, briefings e atividades de gabinete.
                            </p>
                        </div>

                        <div className="shrink-0">
                            <button
                                type="button"
                                onClick={abrirCriar}
                                className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-white transition-all hover:bg-primary-hover hover:shadow-lg hover:shadow-primary/20 active:scale-98 shadow-sm cursor-pointer"
                            >
                                <Plus className="h-4 w-4" />
                                Novo Atendimento
                            </button>
                        </div>
                    </div>
                </div>

                {/* Master-Detail Layout */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[550px]">
                    
                    {/* Master Panel (Left) */}
                    <div className="lg:col-span-4 flex flex-col gap-4">
                        {/* Search & Filters */}
                        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
                            <div className="relative">
                                <input
                                    type="text"
                                    placeholder="Buscar atendimento..."
                                    value={pesquisa}
                                    onChange={(e) => setPesquisa(e.target.value)}
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-10 pr-4 py-2 text-xs font-semibold text-slate-700 outline-none transition-all focus:border-slate-450 focus:bg-white focus:ring-4 focus:ring-slate-100/50"
                                />
                                <SearchX className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                            </div>

                            <div className="relative">
                                <select
                                    value={filtroStatus}
                                    onChange={(e) => setFiltroStatus(e.target.value)}
                                    className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2 pr-10 text-xs font-semibold text-slate-700 outline-none transition-all focus:border-slate-450 focus:bg-white focus:ring-4 focus:ring-slate-100/50"
                                >
                                    <option value="todos">Todos os status</option>
                                    <option value="aberto">Aberto</option>
                                    <option value="em_andamento">Em Andamento</option>
                                    <option value="concluido">Concluído</option>
                                    <option value="arquivado">Arquivado</option>
                                </select>
                                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                            </div>
                        </div>

                        {/* List of cases */}
                        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden flex-1 max-h-[480px] overflow-y-auto">
                            <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Atendimentos cadastrados</span>
                                <span className="rounded-full bg-slate-100 border border-slate-200 px-2 py-0.5 text-[9px] font-bold text-slate-600">
                                    {atendimentosFiltrados.length}
                                </span>
                            </div>

                            {carregando ? (
                                <div className="p-8 text-center flex flex-col items-center justify-center gap-2">
                                    <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                                    <span className="text-xs text-slate-500 font-semibold">Carregando lista...</span>
                                </div>
                            ) : atendimentosFiltrados.length === 0 ? (
                                <div className="p-12 text-center flex flex-col items-center justify-center gap-2">
                                    <Layers className="h-8 w-8 text-slate-300" />
                                    <span className="text-xs text-slate-450 font-bold">Nenhum caso encontrado</span>
                                </div>
                            ) : (
                                <div className="divide-y divide-slate-100">
                                    {atendimentosFiltrados.map((a) => {
                                        const isSelected = selecionado?.id === a.id;
                                        return (
                                            <button
                                                key={a.id}
                                                onClick={() => setSelecionado(a)}
                                                className={`w-full text-left p-4 transition-all flex items-center justify-between group cursor-pointer ${
                                                    isSelected ? "bg-slate-900 text-white" : "hover:bg-slate-50 text-slate-800"
                                                }`}
                                            >
                                                <div className="min-w-0 pr-3">
                                                    <h3 className={`text-xs font-bold truncate ${isSelected ? "text-white" : "text-slate-900"}`}>
                                                        {a.titulo}
                                                    </h3>
                                                    <span className={`text-[10px] block mt-1 font-semibold ${isSelected ? "text-slate-300" : "text-slate-500"}`}>
                                                        {new Date(a.data).toLocaleDateString('pt-BR')}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2 shrink-0">
                                                    <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                                                        a.status === 'aberto' ? (isSelected ? 'bg-blue-600 text-white border border-blue-500' : 'bg-blue-50 text-blue-700 border border-blue-200') :
                                                        a.status === 'em_andamento' ? (isSelected ? 'bg-amber-600 text-white border border-amber-500' : 'bg-amber-50 text-amber-700 border border-amber-200') :
                                                        a.status === 'concluido' ? (isSelected ? 'bg-emerald-600 text-white border border-emerald-500' : 'bg-emerald-50 text-emerald-700 border border-emerald-200') :
                                                        (isSelected ? 'bg-slate-800 text-white border border-slate-700' : 'bg-slate-100 text-slate-650 border border-slate-200')
                                                    }`}>
                                                        {formatStatus(a.status)}
                                                    </span>
                                                    <ChevronRight className={`h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5 ${isSelected ? "text-white/70" : "text-slate-450"}`} />
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Detail Panel (Right) */}
                    <div className="lg:col-span-8 flex flex-col">
                        {selecionado ? (
                            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm flex flex-col flex-1 overflow-hidden">
                                
                                {/* Case Details Header */}
                                <div className="p-6 border-b border-slate-100 bg-slate-50/30 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2.5">
                                            <h2 className="text-lg font-black text-slate-900 truncate">
                                                {selecionado.titulo}
                                            </h2>
                                            <button
                                                onClick={() => abrirEditar(selecionado)}
                                                className="rounded-lg p-1 text-slate-450 hover:bg-slate-100 hover:text-slate-800 cursor-pointer shrink-0 transition-colors"
                                                title="Editar caso"
                                            >
                                                <Edit className="h-3.5 w-3.5" />
                                            </button>
                                        </div>
                                        <div className="flex items-center gap-3 mt-1 text-xs font-semibold text-slate-500">
                                            <span>
                                                Abertura do Caso: {new Date(selecionado.data).toLocaleDateString('pt-BR')}
                                            </span>
                                            {selecionado.municipios?.nome && (
                                                <>
                                                    <span className="text-slate-300">•</span>
                                                    <span className="flex items-center gap-1 text-slate-650">
                                                        <MapPin className="h-3 w-3 text-slate-400" />
                                                        {selecionado.municipios.nome}
                                                    </span>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3 shrink-0">
                                        {/* Status quick select */}
                                        <div className="relative">
                                            <select
                                                value={selecionado.status}
                                                onChange={(e) => atualizarStatusAtendimento(e.target.value as any)}
                                                className={`appearance-none rounded-xl border px-3.5 py-1.5 pr-8 text-xs font-bold uppercase tracking-wider outline-none transition-all cursor-pointer ${
                                                    selecionado.status === 'aberto' ? 'bg-blue-50 border-blue-200 text-blue-700' :
                                                    selecionado.status === 'em_andamento' ? 'bg-amber-50 border-amber-200 text-amber-700' :
                                                    selecionado.status === 'concluido' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' :
                                                    'bg-slate-100 border-slate-200 text-slate-650'
                                                }`}
                                            >
                                                <option value="aberto">Aberto</option>
                                                <option value="em_andamento">Em Andamento</option>
                                                <option value="concluido">Concluído</option>
                                                <option value="arquivado">Arquivado</option>
                                            </select>
                                            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-current pointer-events-none" />
                                        </div>

                                        <button
                                            onClick={() => excluirAtendimento(selecionado.id)}
                                            className="rounded-xl border border-red-200 bg-red-50 p-2.5 text-xs font-bold text-red-650 hover:bg-red-100 cursor-pointer transition-colors"
                                            title="Excluir Atendimento"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </div>
                                </div>
                                <CRMAlertBanner
                                    municipioId={selecionado.municipio_id}
                                    className="mx-6 mt-4"
                                    refreshKey={alertasCidade}
                                />

                                {/* Navigation Tabs */}
                                <div className="border-b border-slate-100 flex items-center px-6 mt-2">
                                    <button
                                        type="button"
                                        onClick={() => setDetailTab("timeline")}
                                        className={`px-4 py-3 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                                            detailTab === "timeline"
                                                ? "border-slate-900 text-slate-900"
                                                : "border-transparent text-slate-400 hover:text-slate-700"
                                        }`}
                                    >
                                        Linha do Tempo ({timelineItems.length})
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setDetailTab("demandas")}
                                        className={`px-4 py-3 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                                            detailTab === "demandas"
                                                ? "border-slate-900 text-slate-900"
                                                : "border-transparent text-slate-400 hover:text-slate-700"
                                        }`}
                                    >
                                        Demandas ({demandas.length})
                                    </button>
                                </div>

                                {/* Dynamic Chronological Timeline / Demandas */}
                                <div className="p-6 flex-1 overflow-y-auto max-h-[380px] bg-slate-50/10">
                                    {detailTab === "timeline" ? (
                                        <>
                                            <div className="mb-4 flex items-center justify-between">
                                                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Linha do Tempo do Caso</h3>
                                                <span className="text-[10px] font-bold text-slate-455 italic">Novos à esquerda / recentes primeiro</span>
                                            </div>

                                            {carregandoTimeline ? (
                                                <div className="py-12 text-center flex flex-col items-center justify-center gap-2">
                                                    <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                                                    <span className="text-xs text-slate-500 font-semibold">Carregando timeline...</span>
                                                </div>
                                            ) : timelineItems.length === 0 ? (
                                                <div className="rounded-2xl border-2 border-dashed border-slate-200 p-8 text-center flex flex-col items-center justify-center gap-3">
                                                    <Layers className="h-8 w-8 text-slate-300" />
                                                    <div>
                                                        <h4 className="text-xs font-bold text-slate-800">Sem atividades associadas</h4>
                                                        <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                                                            Use a barra inferior para vincular ofícios, pautas ou briefings a este caso e gerenciar a linha do tempo.
                                                        </p>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="relative border-l border-slate-200 ml-4 pl-6 space-y-6">
                                                    {timelineItems.map((item) => (
                                                        <div key={item.id} className="relative group">
                                                            
                                                            {/* Dot icon */}
                                                            <span className={`absolute -left-10 top-0.5 flex h-7 w-7 items-center justify-center rounded-full border shadow-xs ${
                                                                item.tipo === 'oficio' ? 'bg-amber-50 border-amber-200 text-amber-700' :
                                                                item.tipo === 'task' ? 'bg-blue-50 border-blue-200 text-blue-700' :
                                                                'bg-violet-50 border-violet-200 text-violet-700'
                                                            }`}>
                                                                {item.tipo === 'oficio' && <Mail className="h-3.5 w-3.5" />}
                                                                {item.tipo === 'task' && <Calendar className="h-3.5 w-3.5" />}
                                                                {item.tipo === 'briefing' && <FileText className="h-3.5 w-3.5" />}
                                                            </span>

                                                            {/* Card */}
                                                            <div className="rounded-2xl border border-slate-150 bg-white p-4 shadow-2xs hover:shadow-xs transition-shadow flex items-start justify-between gap-4">
                                                                <div className="min-w-0">
                                                                    <div className="flex items-center gap-2">
                                                                        <span className={`rounded-full px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider ${
                                                                            item.tipo === 'oficio' ? 'bg-amber-50 border border-amber-200 text-amber-700' :
                                                                            item.tipo === 'task' ? 'bg-blue-50 border border-blue-200 text-blue-700' :
                                                                            'bg-violet-50 border-violet-200 text-violet-700'
                                                                        }`}>
                                                                            {item.tipo === 'oficio' ? 'Ofício' : item.tipo === 'task' ? 'Agenda' : 'Briefing'}
                                                                        </span>
                                                                        <span className="text-[10px] font-bold text-slate-455">
                                                                            {new Date(item.data).toLocaleDateString('pt-BR')}
                                                                        </span>
                                                                    </div>
                                                                    <h4 className="text-xs font-bold text-slate-800 mt-1.5">
                                                                        {item.titulo}
                                                                    </h4>
                                                                    <p className="text-[11px] font-semibold text-slate-500 mt-1">
                                                                        {item.subtitulo}
                                                                    </p>
                                                                </div>

                                                                <button
                                                                    onClick={() => desvincularSpoke(item.id, item.tipo)}
                                                                    className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-650 cursor-pointer transition-colors"
                                                                    title="Desvincular do Atendimento"
                                                                >
                                                                    <Link2Off className="h-4 w-4" />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </>
                                    ) : (
                                        <div className="space-y-4">
                                            <div className="flex items-center justify-between">
                                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Demandas e Promessas</span>
                                                <button
                                                    type="button"
                                                    onClick={abrirCriarDemanda}
                                                    className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-bold text-white hover:bg-slate-800 transition-all cursor-pointer shadow-sm hover:shadow-lg active:scale-98"
                                                >
                                                    <Plus className="h-3.5 w-3.5" />
                                                    Nova Demanda
                                                </button>
                                            </div>

                                            {carregandoDemandas ? (
                                                <div className="py-12 text-center flex flex-col items-center justify-center gap-2">
                                                    <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                                                    <span className="text-xs text-slate-500 font-semibold">Carregando demandas...</span>
                                                </div>
                                            ) : demandas.length === 0 ? (
                                                <div className="rounded-2xl border-2 border-dashed border-slate-200 p-8 text-center flex flex-col items-center justify-center gap-3 bg-white">
                                                    <Briefcase className="h-8 w-8 text-slate-300" />
                                                    <div>
                                                        <h4 className="text-xs font-bold text-slate-800">Sem demandas cadastradas</h4>
                                                        <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                                                            Registre os pedidos, promessas e demandas políticas do interior vinculados a este atendimento.
                                                        </p>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="space-y-3">
                                                    {demandas.map((d) => (
                                                        <div key={d.id} className="rounded-2xl border border-slate-150 bg-white p-4 shadow-2xs hover:shadow-xs transition-all flex flex-col gap-3">
                                                            <div className="flex items-start justify-between gap-4">
                                                                <div className="min-w-0 flex-1">
                                                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-450 bg-slate-50 border border-slate-150 rounded-full px-2.5 py-0.5">
                                                                        <MapPin className="h-3 w-3 text-slate-400" />
                                                                        {d.municipios?.nome || "Sem município"}
                                                                    </span>
                                                                    <h4 className="text-xs font-extrabold text-slate-900 mt-2">
                                                                        Solicitante: {d.solicitante}
                                                                    </h4>
                                                                    <p className="text-xs font-semibold text-slate-650 mt-1.5 leading-relaxed whitespace-pre-line bg-slate-50/50 p-2.5 rounded-xl border border-slate-100">
                                                                        {d.descricao}
                                                                    </p>
                                                                </div>

                                                                <button
                                                                    onClick={() => excluirDemanda(d.id)}
                                                                    className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-650 cursor-pointer transition-colors"
                                                                    title="Excluir Demanda"
                                                                >
                                                                    <Trash2 className="h-4 w-4" />
                                                                </button>
                                                            </div>

                                                            <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                                                                <span className="text-[10px] font-bold text-slate-400">
                                                                    Criado em {new Date(d.criado_em).toLocaleDateString('pt-BR')}
                                                                </span>
                                                                <div className="relative">
                                                                    <select
                                                                        value={d.status}
                                                                        onChange={(e) => atualizarStatusDemanda(d.id, e.target.value as any)}
                                                                        className={`appearance-none rounded-xl border px-3 py-1 pr-8 text-[10px] font-bold uppercase tracking-wider outline-none transition-all cursor-pointer ${
                                                                            d.status === 'em_andamento' ? 'bg-amber-50 border-amber-200 text-amber-700' :
                                                                            d.status === 'entregue' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' :
                                                                            'bg-red-50 border-red-200 text-red-700'
                                                                        }`}
                                                                    >
                                                                        <option value="em_andamento">Em Andamento</option>
                                                                        <option value="entregue">Entregue</option>
                                                                        <option value="negado">Negado</option>
                                                                    </select>
                                                                    <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-current pointer-events-none" />
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Association Controls Bar */}
                                {detailTab === "timeline" && (
                                    <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex flex-wrap items-center justify-between gap-3 shrink-0">
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-455">
                                            Associar ao caso:
                                        </span>
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <button
                                                type="button"
                                                onClick={() => abrirModalLink('oficio')}
                                                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 hover:text-slate-900 cursor-pointer shadow-2xs transition-colors"
                                            >
                                                <Plus className="h-3.5 w-3.5" />
                                                Ofício
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => abrirModalLink('task')}
                                                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 hover:text-slate-900 cursor-pointer shadow-2xs transition-colors"
                                            >
                                                <Plus className="h-3.5 w-3.5" />
                                                Compromisso
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => abrirModalLink('briefing')}
                                                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 hover:text-slate-900 cursor-pointer shadow-2xs transition-colors"
                                            >
                                                <Plus className="h-3.5 w-3.5" />
                                                Briefing
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            /* Detail Empty State */
                            <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white shadow-sm flex flex-col items-center justify-center text-center p-12 flex-1">
                                <div className="rounded-2xl bg-slate-50 p-4 border border-slate-200 mb-4 animate-bounce">
                                    <Layers className="h-10 w-10 text-slate-400" />
                                </div>
                                <h3 className="text-sm font-bold text-slate-800">
                                    Nenhum Atendimento Selecionado
                                </h3>
                                <p className="text-xs text-slate-500 max-w-sm mt-2 leading-relaxed font-semibold">
                                    Selecione um caso de atendimento na barra lateral esquerda para visualizar sua linha do tempo ou cadastre uma nova demanda política no botão superior.
                                </p>
                            </div>
                        )}
                    </div>

                </div>

            </main>

            {/* Modal CRUD Atendimento */}
            {modalAberto && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-xs animate-in fade-in duration-200">
                    <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-xl animate-in zoom-in-95 duration-200 flex flex-col">
                        <div className="mb-4">
                            <h3 className="text-lg font-black text-slate-900">
                                {paraEditar ? "Editar Atendimento" : "Novo Atendimento"}
                            </h3>
                            <p className="text-xs text-slate-500 mt-1">
                                Insira os dados principais deste caso ou demanda política.
                            </p>
                        </div>

                        <form onSubmit={salvarAtendimento} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                                    Título / Descrição Curta
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={titulo}
                                    onChange={(e) => setTitulo(e.target.value)}
                                    placeholder="Ex: Pavimentação Asfáltica - Ponta Porã"
                                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-slate-450 focus:ring-4 focus:ring-slate-100/50"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                                    Município
                                </label>
                                <MunicipioAutocomplete
                                    value={municipioId}
                                    onChange={(id) => setMunicipioId(id)}
                                    placeholder="Selecione o município associado (opcional)..."
                                />
                            </div>

                            {alertasModal > 0 && (
                                <div className="rounded-xl bg-amber-50 border border-amber-200 p-3.5 flex gap-2 animate-in fade-in duration-200">
                                    <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                                    <p className="text-xs text-amber-700 font-semibold leading-relaxed">
                                        Atenção: Existem {alertasModal} {alertasModal === 1 ? 'demanda pendente' : 'demandas pendentes'} neste município.
                                    </p>
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                                        Data de Abertura
                                    </label>
                                    <input
                                        type="date"
                                        required
                                        value={dataCaso}
                                        onChange={(e) => setDataCaso(e.target.value)}
                                        className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-850 outline-none focus:border-slate-450 focus:ring-4 focus:ring-slate-100/50"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                                        Status Inicial
                                    </label>
                                    <div className="relative">
                                        <select
                                            value={statusCaso}
                                            onChange={(e) => setStatusCaso(e.target.value as any)}
                                            className="w-full appearance-none rounded-xl border border-slate-200 bg-white px-3.5 py-2 pr-8 text-xs font-semibold text-slate-700 outline-none focus:border-slate-450 focus:ring-4 focus:ring-slate-100/50"
                                        >
                                            <option value="aberto">Aberto</option>
                                            <option value="em_andamento">Em Andamento</option>
                                            <option value="concluido">Concluído</option>
                                            <option value="arquivado">Arquivado</option>
                                        </select>
                                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 mt-6">
                                <button
                                    type="button"
                                    onClick={() => setModalAberto(false)}
                                    className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-500 hover:bg-slate-50 hover:text-slate-800 cursor-pointer"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={salvando}
                                    className="rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                                >
                                    {salvando && <Loader2 className="h-3 w-3 animate-spin" />}
                                    Salvar
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal de Associação (Link) */}
            {modalLinkAberto && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-xs animate-in fade-in duration-200">
                    <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-xl animate-in zoom-in-95 duration-200 flex flex-col">
                        <div className="mb-4">
                            <h3 className="text-lg font-black text-slate-900">
                                Vincular {tipoLink === 'oficio' ? 'Ofício' : tipoLink === 'task' ? 'Compromisso' : 'Briefing'}
                            </h3>
                            <p className="text-xs text-slate-500 mt-1">
                                Selecione um item da lista que esteja sem caso vinculado.
                            </p>
                        </div>

                        <div className="space-y-4">
                            {carregandoDisponiveis ? (
                                <div className="py-8 text-center flex flex-col items-center justify-center gap-2">
                                    <Loader2 className="h-6 w-6 animate-spin text-slate-455" />
                                    <span className="text-xs text-slate-500 font-semibold">Buscando itens não vinculados...</span>
                                </div>
                            ) : itensDisponiveis.length === 0 ? (
                                <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 flex gap-2">
                                    <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                                    <div>
                                        <h4 className="text-xs font-bold text-amber-800 uppercase tracking-wider">Aviso</h4>
                                        <p className="text-xs text-amber-700 mt-1 leading-relaxed">
                                            Não há nenhum {tipoLink === 'oficio' ? 'ofício' : tipoLink === 'task' ? 'compromisso' : 'briefing'} disponível sem vínculo atual no gabinete.
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                                        Escolha o item
                                    </label>
                                    <div className="relative">
                                        <select
                                            value={itemParaVincular}
                                            onChange={(e) => setItemParaVincular(e.target.value)}
                                            className="w-full appearance-none rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 pr-8 text-xs font-semibold text-slate-700 outline-none focus:border-slate-450 focus:ring-4 focus:ring-slate-100/50"
                                        >
                                            <option value="">Selecione um item...</option>
                                            {itensDisponiveis.map((item) => (
                                                <option key={item.id} value={item.id}>
                                                    {tipoLink === 'oficio' ? `${item.titulo || 'Ofício'} (Nº ${item.numero} - ${item.destinatario})` :
                                                     tipoLink === 'task' ? `${item.titulo} (${new Date(item.data_inicio).toLocaleDateString('pt-BR')})` :
                                                     `${item.titulo_customizado || 'Briefing'} (${item.organizacao})`}
                                                </option>
                                            ))}
                                        </select>
                                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                                    </div>
                                </div>
                            )}

                            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 mt-6">
                                <button
                                    type="button"
                                    onClick={() => setModalLinkAberto(false)}
                                    className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-500 hover:bg-slate-50 hover:text-slate-800 cursor-pointer"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="button"
                                    onClick={vincularSpoke}
                                    disabled={!itemParaVincular || vinculandoItem}
                                    className="rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                                >
                                    {vinculandoItem && <Loader2 className="h-3 w-3 animate-spin" />}
                                    Vincular Item
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal CRUD Demanda */}
            {modalDemandaAberto && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-xs animate-in fade-in duration-200">
                    <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-xl animate-in zoom-in-95 duration-200 flex flex-col">
                        <div className="mb-4">
                            <h3 className="text-lg font-black text-slate-900">
                                Nova Demanda / Promessa
                            </h3>
                            <p className="text-xs text-slate-500 mt-1">
                                Cadastre um pedido ou promessa política vinculada a este atendimento.
                            </p>
                        </div>

                        <form onSubmit={salvarDemanda} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                                    Solicitante
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={demandaSolicitante}
                                    onChange={(e) => setDemandaSolicitante(e.target.value)}
                                    placeholder="Ex: Prefeito Alan Guedes"
                                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-slate-450 focus:ring-4 focus:ring-slate-100/50"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                                    Pedido / Descrição da Promessa
                                </label>
                                <textarea
                                    required
                                    rows={4}
                                    value={demandaDescricao}
                                    onChange={(e) => setDemandaDescricao(e.target.value)}
                                    placeholder="Descreva o pedido, compromisso ou promessa..."
                                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-slate-450 focus:ring-4 focus:ring-slate-100/50 resize-none"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                                    Município
                                </label>
                                <MunicipioAutocomplete
                                    value={demandaMunicipioId}
                                    onChange={(id) => setDemandaMunicipioId(id)}
                                    placeholder="Selecione o município da demanda..."
                                    required
                                />
                            </div>

                            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 mt-6">
                                <button
                                    type="button"
                                    onClick={() => setModalDemandaAberto(false)}
                                    className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-500 hover:bg-slate-50 hover:text-slate-800 cursor-pointer"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={salvandoDemanda}
                                    className="rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                                >
                                    {salvandoDemanda && <Loader2 className="h-3 w-3 animate-spin" />}
                                    Salvar Demanda
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Global toast container */}
            <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
                {toasts.map((toast) => (
                    <div
                        key={toast.id}
                        onClick={() => removeToast(toast.id)}
                        className={`flex items-center gap-2.5 rounded-2xl px-4 py-3 text-xs font-bold text-white shadow-lg transition-all animate-in fade-in slide-in-from-bottom-2 duration-300 cursor-pointer ${
                            toast.type === "success" ? "bg-slate-900" : "bg-red-600"
                        }`}
                    >
                        <span>{toast.message}</span>
                    </div>
                ))}
            </div>

        </div>
    );
}
