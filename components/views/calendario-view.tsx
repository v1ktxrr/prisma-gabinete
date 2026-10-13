"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import listPlugin from "@fullcalendar/list";
import interactionPlugin from "@fullcalendar/interaction";
import { EventInput, EventDropArg, DateSelectArg, EventClickArg, EventHoveringArg } from "@fullcalendar/core";
import {
    Loader2,
    AlertCircle,
    Clock,
    CheckCircle,
    BarChart3,
    RefreshCw,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { usePermissions } from "@/hooks/usePermissions";
import { useAppStore } from "@/lib/store";
import TaskModal from "@/components/task-modal";
import PageHeader from "@/components/page-header";
import { CalendarioEvent, TaskMetrics } from "@/lib/types";
import { eventosMS2026, EventoEstrategico } from "@/src/data/calendarioEstrategicoMS";

interface CalendarioViewProps {
    mode?: "communication" | "global";
}

/* ============================================================
   Event Type → Cor (Mapeamento de Tipos de Evento)
   ============================================================ */
const GLOBAL_EVENT_COLORS = {
    agenda_oficial: { bg: "#ea580c", text: "#fff7ed", label: "Agenda Oficial" }, // Orange/Red
    aniversario_cidade: { bg: "#2563eb", text: "#eff6ff", label: "Aniversário da Cidade" }, // Blue
    data_comemorativa: { bg: "#9333ea", text: "#f3e8ff", label: "Data Comemorativa" }, // Purple
    diversos: { bg: "#eab308", text: "#fefce8", label: "Diversos" }, // Yellow
};

const COMMS_EVENT_COLORS = {
    agenda_oficial: { bg: "#db2777", text: "#fdf2f8", label: "Pauta Oficial" }, // Pink/Rose
    aniversario_cidade: { bg: "#0d9488", text: "#f0fdfa", label: "Eventos MS" }, // Teal
    data_comemorativa: { bg: "#8b5cf6", text: "#f5f3ff", label: "Data Comemorativa" }, // Violet
    diversos: { bg: "#d97706", text: "#fffbeb", label: "Diversos / Outros" }, // Amber/Orange
};

interface TaskRow {
    id: string;
    titulo: string;
    descricao: string | null;
    status: string;
    tipo_agenda: "GLOBAL" | "COMUNICACAO" | null;
    event_type: string | null;
    data_inicio: string | null;
    data_fim: string | null;
    post_url: string | null;
    metrics_snapshot?: TaskMetrics | null;
    tema: string | null;
    created_by?: string | null;
    captacao_by?: string | null;
    edicao_by?: string | null;
    texto_by?: string | null;
    publicacao_by?: string | null;
    formato_midia?: string | null;
    eixo_tematico?: string | null;
    municipio_id?: string | null;
    municipio_ids?: string[] | null;
}

function mapTaskToCalendarEvent(task: TaskRow) {
    return {
        id: task.id,
        title: task.titulo,
        start: task.data_inicio,
        end: task.data_fim,
        status: task.status,
        tipo_agenda: task.tipo_agenda || undefined,
        event_type: task.event_type || undefined,
        descricao: task.descricao,
        post_url: task.post_url || undefined,
        metrics_snapshot: task.metrics_snapshot,
        tema: task.tema || undefined,
        created_by: task.created_by || undefined,
        captacao_by: task.captacao_by || undefined,
        edicao_by: task.edicao_by || undefined,
        texto_by: task.texto_by || undefined,
        publicacao_by: task.publicacao_by || undefined,
        formato_midia: task.formato_midia || undefined,
        eixo_tematico: task.eixo_tematico || undefined,
        municipio_id: task.municipio_id || undefined,
        municipio_ids: task.municipio_ids || undefined,
    };
}

/* ============================================================
   Componente View SPA: CalendarioView
   ============================================================ */
export default function CalendarioView({ mode = "communication" }: CalendarioViewProps) {
    const { user, profile } = useAuth();
    const { unidadeId, hasModule } = usePermissions();
    const { eventsCache, setEventsCache, setLastSynced, setOfflineMode, isOfflineMode, atualizarDataPauta, hiddenStaticEvents, esconderEventoEstatico, taskModalOpen, taskModalData, openTaskModal, closeTaskModal } = useAppStore();

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [statusFilter, setStatusFilter] = useState<'todos' | 'pendente' | 'publicado'>('todos');
    const [mesAtual, setMesAtual] = useState<Date>(new Date());
    const isGlobalAgenda = mode === "global";
    const tipoAgendaAtual = isGlobalAgenda ? "GLOBAL" : "COMUNICACAO";
    const canCreateGlobalEvent = hasModule("agenda_global_editar");
    const canCheckInGlobalEvent = hasModule("agenda_global_presenca");
    const canViewCommunicationBriefing = hasModule("agenda_comunicacao_ver");
    const canEditCommunicationEvent = hasModule("agenda_comunicacao_editar");
    const canEdit = (loading || isOfflineMode) ? false : (isGlobalAgenda ? canCreateGlobalEvent : canEditCommunicationEvent);

    const EVENT_COLORS = useMemo(() => {
        return isGlobalAgenda ? GLOBAL_EVENT_COLORS : COMMS_EVENT_COLORS;
    }, [isGlobalAgenda]);

    const getEventColor = useCallback((eventType: string | undefined) => {
        return EVENT_COLORS[eventType as keyof typeof EVENT_COLORS || "agenda_oficial"] || EVENT_COLORS["agenda_oficial"];
    }, [EVENT_COLORS]);

    // Filtros de categoria (toggles)
    const [filtrosAtivos, setFiltrosAtivos] = useState<string[]>(() =>
        Object.keys(isGlobalAgenda ? GLOBAL_EVENT_COLORS : COMMS_EVENT_COLORS)
    );

    useEffect(() => {
        const timeoutId = window.setTimeout(() => {
            setFiltrosAtivos(Object.keys(isGlobalAgenda ? GLOBAL_EVENT_COLORS : COMMS_EVENT_COLORS));
        }, 0);

        return () => window.clearTimeout(timeoutId);
    }, [isGlobalAgenda]);

    const toggleFiltro = useCallback((key: string) => {
        setFiltrosAtivos(prev =>
            prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
        );
    }, []);

    // Toast state
    const [toast, setToast] = useState<{ show: boolean, message: string }>({ show: false, message: '' });

    const showToast = (message: string) => {
        setToast({ show: true, message });
        setTimeout(() => setToast({ show: false, message: '' }), 4000);
    };

    // Tooltip Tático state
    interface TooltipData {
        title: string;
        tema?: string;
        status?: string;
        event_type?: string;
        descricao?: string;
    }
    const [tooltip, setTooltip] = useState<{ show: boolean; x: number; y: number; data: TooltipData | null }>({
        show: false, x: 0, y: 0, data: null,
    });

    const handleEventMouseEnter = useCallback((info: EventHoveringArg) => {
        const { clientX, clientY } = info.jsEvent;
        const ep = info.event.extendedProps;
        setTooltip({
            show: true,
            x: clientX + 15,
            y: clientY + 15,
            data: {
                title: info.event.title,
                tema: ep.tema,
                status: ep.status,
                event_type: ep.event_type,
                descricao: ep.descricao,
            },
        });
    }, []);

    const handleEventMouseLeave = useCallback(() => {
        setTooltip({ show: false, x: 0, y: 0, data: null });
    }, []);

    const events = useMemo(() => {
        if (eventsCache.length > 0) {
            let filteredCache: CalendarioEvent[] = eventsCache.filter(
                (ev) => ev.tipo_agenda === tipoAgendaAtual
            );
            if (statusFilter !== 'todos') {
                filteredCache = filteredCache.filter((ev) => ev.status === statusFilter);
            }

            const mappedDinamic: EventInput[] = filteredCache.map((ev) => {
                const color = getEventColor(ev.event_type || undefined);
                const isActive = ev.status === 'publicado'; // Mapeamento da regra de concluído

                let bgColor = color.bg;
                let txtColor = color.text;
                let borderColor = "transparent";

                if (!isGlobalAgenda) {
                    if (isActive) {
                        bgColor = "#d1fae5"; // bg-green-100
                        txtColor = "#065f46"; // text-green-800
                        borderColor = "#a7f3d0"; // border-green-200
                    } else {
                        bgColor = "#f1f5f9"; // bg-slate-100
                        txtColor = "#475569"; // text-slate-650
                        borderColor = "#e2e8f0"; // border-slate-200
                    }
                } else {
                    if (isActive) {
                        bgColor = '#22c55e';
                        txtColor = '#ffffff';
                        borderColor = '#16a34a';
                    }
                }

                return {
                    id: ev.id,
                    title: ev.title,
                    start: ev.start || undefined,
                    end: ev.end || undefined,
                    backgroundColor: bgColor,
                    textColor: txtColor,
                    borderColor: borderColor,
                    editable: true,
                    extendedProps: {
                        status: ev.status,
                        event_type: ev.event_type,
                        descricao: ev.descricao,
                        tema: ev.tema,
                        post_url: ev.post_url,
                        isStatic: false,
                        originalColorBg: color.bg,
                        rank: 1, // Higher priority
                        captacao_by: ev.captacao_by,
                        edicao_by: ev.edicao_by,
                        texto_by: ev.texto_by,
                        publicacao_by: ev.publicacao_by,
                        formato_midia: ev.formato_midia,
                        eixo_tematico: ev.eixo_tematico,
                        municipio_id: ev.municipio_id,
                        municipio_ids: ev.municipio_ids,
                    },
                };
            });

            // Map static events
            const mappedStatic: EventInput[] = eventosMS2026.filter(ev => !hiddenStaticEvents.includes(ev.id)).map((ev: EventoEstrategico) => {
                const event_type = ev.type === 'Aniversário da Cidade' ? 'aniversario_cidade' : 'data_comemorativa';
                const color = getEventColor(event_type);

                let bgColor = color.bg;
                let txtColor = color.text;
                let borderColor = "transparent";

                if (!isGlobalAgenda) {
                    bgColor = "#f1f5f9"; // bg-slate-100
                    txtColor = "#475569"; // text-slate-650
                    borderColor = "#e2e8f0"; // border-slate-200
                }

                return {
                    id: ev.id,
                    title: ev.title,
                    start: ev.date,
                    allDay: true,
                    editable: true,
                    backgroundColor: bgColor,
                    textColor: txtColor,
                    borderColor: borderColor,
                    extendedProps: {
                        status: 'pendente',
                        event_type: event_type,
                        descricao: ev.type,
                        post_url: '',
                        isStatic: true,
                        rank: 2 // Lower priority / Fundo do dia
                    }
                };
            });

            // Combine both - filtering out static events ONLY if user strictly chooses "publicado"
            // Since they are now "pendente", they shouldn't show up in "publicado" view.
            const finalStatic = (statusFilter === 'todos' || statusFilter === 'pendente') ? mappedStatic : [];
            return [...mappedDinamic, ...finalStatic];
        }

        // Even if no dynamic events, we should display static events
        if (statusFilter === 'todos' || statusFilter === 'pendente') {
            const mappedStatic: EventInput[] = eventosMS2026.filter(ev => !hiddenStaticEvents.includes(ev.id)).map((ev: EventoEstrategico) => {
                const event_type = ev.type === 'Aniversário da Cidade' ? 'aniversario_cidade' : 'data_comemorativa';
                const color = getEventColor(event_type);

                let bgColor = color.bg;
                let txtColor = color.text;
                let borderColor = "transparent";

                if (!isGlobalAgenda) {
                    bgColor = "#f1f5f9"; // bg-slate-100
                    txtColor = "#475569"; // text-slate-650
                    borderColor = "#e2e8f0"; // border-slate-200
                }

                return {
                    id: ev.id,
                    title: ev.title,
                    start: ev.date,
                    allDay: true,
                    editable: true,
                    backgroundColor: bgColor,
                    textColor: txtColor,
                    borderColor: borderColor,
                    extendedProps: {
                        status: 'pendente',
                        event_type: event_type,
                        descricao: ev.type,
                        post_url: '',
                        isStatic: true,
                        rank: 2
                    }
                };
            });
            return mappedStatic;
        }

        return [];
    }, [eventsCache, hiddenStaticEvents, statusFilter, tipoAgendaAtual, getEventColor]);

    /* --------------------------------------------------------
       Fetch events from tasks (Tratamento Offline)
       -------------------------------------------------------- */
    const fetchEvents = useCallback(async () => {
        if (!user || !unidadeId) return;

        setLoading(true);

        try {
            let query = supabase
                .from("tasks")
                .select("id, titulo, descricao, status, tipo_agenda, event_type, data_inicio, data_fim, post_url, metrics_snapshot, tema, created_by, captacao_by, edicao_by, texto_by, publicacao_by, formato_midia, eixo_tematico, municipio_id, municipio_ids, atendimento_id")
                .eq("registro_status", "ativo")
                .eq("tipo_agenda", tipoAgendaAtual);

            if (isGlobalAgenda) {
                query = query.eq("unidade_id", unidadeId);
            }

            const { data, error: sbError } = await query
                .order("data_inicio", { ascending: true })
                .limit(5000);

            if (sbError) throw sbError;

            // Sucesso! Temos internet e pegamos os dados reais.
            setEventsCache(((data as TaskRow[] | null) ?? []).map(mapTaskToCalendarEvent));
            setLastSynced(Date.now());
            setOfflineMode(false);
            setError(null);

        } catch (err) {
            console.error("Erro ao buscar eventos (Offline Mode):", err);
            // Falhou: Cai pro modo Offline.
            setOfflineMode(true);
            setError("Você está offline. Mostro os dados salvos localmente.");
        } finally {
            setLoading(false);
        }
    }, [isGlobalAgenda, setEventsCache, setLastSynced, setOfflineMode, tipoAgendaAtual, unidadeId, user]);

    useEffect(() => {
        if (!user || !unidadeId) return;

        const timeoutId = window.setTimeout(() => {
            void fetchEvents();
        }, 0);

        return () => window.clearTimeout(timeoutId);
    }, [user, unidadeId, fetchEvents]);

    /* --------------------------------------------------------
       FullCalendar handlers
       -------------------------------------------------------- */

    const handleDateSelect = (selectInfo: DateSelectArg) => {
        if (isOfflineMode) {
            alert("Criação desativada no modo offline.");
            return;
        }
        openTaskModal({
            titulo: "",
            descricao: "",
            status: "pendente",
            event_type: "agenda_oficial",
            data_inicio: selectInfo.startStr,
            tipo_agenda: tipoAgendaAtual,
        });
        selectInfo.view.calendar.unselect();
    };

    const handleEventClick = (clickInfo: EventClickArg) => {
        const event = clickInfo.event;

        if (isOfflineMode) {
            alert("Edição desativada no modo offline.");
            return;
        }

        const isStatic = event.extendedProps?.isStatic;

        openTaskModal({
            id: isStatic ? undefined : event.id,
            staticEventId: isStatic ? event.id : undefined,
            titulo: event.title,
            descricao: event.extendedProps.descricao || "",
            status: isStatic ? "pendente" : (event.extendedProps.status || "pendente"),
            event_type: event.extendedProps.event_type || "agenda_oficial",
            tema: event.extendedProps.tema || "",
            data_inicio: event.startStr,
            post_url: isStatic ? "" : (event.extendedProps.post_url || ""),
            tipo_agenda: tipoAgendaAtual,
            captacao_by: isStatic ? null : event.extendedProps.captacao_by,
            edicao_by: isStatic ? null : event.extendedProps.edicao_by,
            texto_by: isStatic ? null : event.extendedProps.texto_by,
            publicacao_by: isStatic ? null : event.extendedProps.publicacao_by,
            formato_midia: isStatic ? null : event.extendedProps.formato_midia,
            eixo_tematico: isStatic ? null : event.extendedProps.eixo_tematico,
            municipio_id: isStatic ? null : event.extendedProps.municipio_id,
            municipio_ids: isStatic ? [] : (event.extendedProps.municipio_ids || []),
        });
    };

    const handleEventDrop = async (dropInfo: EventDropArg) => {
        const { event } = dropInfo;

        if (isOfflineMode) {
            alert("Ação desativada no modo offline.");
            dropInfo.revert();
            return;
        }

        if (event.extendedProps?.isStatic) {
            const formatLocal = (d?: Date | null) => {
                if (!d) return null;
                const pad = (n: number) => n.toString().padStart(2, "0");
                return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
            };

            const novaDataInicio = formatLocal(event.start);
            const novaDataFim = event.end ? formatLocal(event.end) : formatLocal(event.start);

            try {
                const { error: insertErr } = await supabase
                    .from("tasks")
                    .insert({
                        titulo: event.title,
                        descricao: event.extendedProps.descricao || event.title,
                        status: "pendente",
                        tipo_agenda: tipoAgendaAtual,
                        event_type: event.extendedProps.event_type || 'diversos',
                        data_inicio: novaDataInicio,
                        data_fim: novaDataFim,
                        created_by: user?.id,
                    });

                if (insertErr) {
                    dropInfo.revert();
                    console.error("Erro ao converter evento fixo:", insertErr);
                } else {
                    esconderEventoEstatico(event.id);
                    showToast("Data atualizada.");
                    fetchEvents();
                }
            } catch {
                dropInfo.revert();
            }
            return;
        }

        const formatLocal = (d?: Date | null) => {
            if (!d) return null;
            const pad = (n: number) => n.toString().padStart(2, "0");
            return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
        };

        const novaDataInicio = formatLocal(event.start);
        const novaDataFim = event.end ? formatLocal(event.end) : formatLocal(event.start);

        // Atualização Otimista no State (Zustand + IndexedDB)
        atualizarDataPauta(event.id, novaDataInicio || "", novaDataFim || "");

        try {
            const { error: updateErr } = await supabase
                .from("tasks")
                .update({
                    data_inicio: novaDataInicio,
                    data_fim: novaDataFim,
                })
                .eq("id", event.id);

            if (updateErr) {
                dropInfo.revert();
                console.error("Erro ao mover evento:", updateErr);
                // Pode disparar outro toast de error aqui se quiser
            } else {
                showToast("Data atualizada.");
                fetchEvents();
            }
        } catch {
            dropInfo.revert();
        }
    };

    // Calculate pending events for the CURRENT month in view
    const pendenciasDoMes = events.filter(e => {
        if (e.extendedProps?.status !== "pendente") return false;
        if (!e.start) return false;

        const eventDate = new Date(e.start as string);
        return eventDate.getMonth() === mesAtual.getMonth() &&
            eventDate.getFullYear() === mesAtual.getFullYear();
    });

    // Stats for Communication Banner (Count only active dynamic comms events)
    const stats = useMemo(() => {
        const commsEvents = eventsCache.filter(ev => ev.tipo_agenda === tipoAgendaAtual);
        const published = commsEvents.filter(ev => ev.status === 'publicado').length;
        const pending = commsEvents.filter(ev => ev.status === 'pendente').length;
        return { published, pending };
    }, [eventsCache, tipoAgendaAtual]);

    return (
        <div className={`flex min-h-screen flex-col bg-background relative ${!isGlobalAgenda ? "theme-comunicacao bg-violet-50/10" : ""}`}>
            {toast.show && (
                <div className="fixed bottom-6 right-6 z-[99999] bg-green-50 text-green-700 border border-green-200 px-5 py-4 rounded-xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.3)] flex items-center gap-3 animate-in slide-in-from-bottom-5">
                    <CheckCircle className="w-5 h-5 text-green-600 drop-shadow-sm" />
                    <span className="text-[15px] font-bold tracking-tight">{toast.message}</span>
                </div>
            )}

            {!isGlobalAgenda && (
                <PageHeader
                    preTitle="Agenda de Comunicação"
                    title="Atividades de Comunicação"
                    description="Planejamento estratégico de pautas, eventos institucionais e publicações."
                    badges={
                        <>
                            <span className="inline-flex items-center rounded-full bg-violet-50 border border-violet-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-violet-700">
                                Planejamento
                            </span>
                            {isOfflineMode ? (
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-700 animate-pulse">
                                    <span className="h-1.5 w-1.5 rounded-full bg-amber-505" />
                                    Modo Offline
                                </span>
                            ) : (
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-700">
                                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-505" />
                                    Online
                                </span>
                            )}
                        </>
                    }
                >
                    <Link
                        href="/agenda-comunicacao/relatorios"
                        className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-700 hover:bg-slate-50 hover:text-slate-955 hover:border-slate-350 active:scale-95 transition-all focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2 cursor-pointer"
                    >
                        <BarChart3 className="h-3.5 w-3.5 text-slate-450" />
                        Relatórios
                    </Link>

                    <button
                        type="button"
                        onClick={() => {
                            void fetchEvents();
                        }}
                        className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-700 hover:bg-slate-50 hover:text-slate-955 hover:border-slate-350 active:scale-95 transition-all focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2 cursor-pointer"
                    >
                        <RefreshCw className={`h-3.5 w-3.5 text-slate-450 ${loading ? "animate-spin" : ""}`} />
                        Atualizar
                    </button>

                    {canEdit && (
                        <button
                            type="button"
                            onClick={() => {
                                if (isOfflineMode) {
                                    alert("Criação desativada no modo offline.");
                                    return;
                                }
                                openTaskModal({
                                    titulo: "",
                                    descricao: "",
                                    status: "pendente",
                                    event_type: "agenda_oficial",
                                    data_inicio: new Date().toISOString().split("T")[0],
                                    tipo_agenda: tipoAgendaAtual,
                                });
                            }}
                            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-violet-600 hover:bg-violet-750 px-5 text-xs font-bold text-white shadow-md shadow-violet-500/10 active:scale-95 transition-all focus:outline-none focus:ring-2 focus:ring-violet-600 focus:ring-offset-2 cursor-pointer"
                        >
                            + Nova pauta
                        </button>
                    )}
                </PageHeader>
            )}

            <main className="mx-auto w-full max-w-7xl flex-1 px-3 py-4 md:px-6 md:py-6 overflow-hidden">
                <div className="flex flex-col lg:flex-row gap-6 h-full w-full">

                    {/* Left Sidebar (Desktop Only for some parts, or stacked on Mobile) */}
                    <div className="w-full lg:w-80 shrink-0 flex flex-col gap-5">

                        {/* 1. CTA Central de Agendamento (Somente se for Global, na Comms está no cabeçalho) */}
                        {canEdit && isGlobalAgenda && (
                            <button
                                onClick={() => {
                                    if (isOfflineMode) {
                                        alert("Criação desativada no modo offline.");
                                        return;
                                    }
                                    openTaskModal({
                                        titulo: "",
                                        descricao: "",
                                        status: "pendente",
                                        event_type: "agenda_oficial",
                                        data_inicio: new Date().toISOString().split("T")[0],
                                        tipo_agenda: tipoAgendaAtual,
                                    });
                                }}
                                className="w-full rounded-2xl py-3.5 text-sm font-bold shadow-sm transition-all active:scale-[0.98] flex items-center justify-center gap-2 bg-primary text-primary-foreground hover:bg-primary-hover"
                            >
                                    + Novo evento
                            </button>
                        )}

                        {isGlobalAgenda && canViewCommunicationBriefing && (
                            <button
                                type="button"
                                className="w-full rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-left shadow-sm transition-all hover:border-sky-300 hover:bg-sky-100/70"
                            >
                                <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">
                                    Briefing de comunicação
                                </span>
                                <span className="mt-1 block text-sm font-semibold text-slate-800">
                                    Abrir briefings ligados ao evento
                                </span>
                            </button>
                        )}

                        {/* 2. Radar de Pendências */}
                        <div className="flex flex-col gap-3 mt-2">
                            <h3 className="font-display text-sm font-bold text-foreground px-1">
                                Pendências ({mesAtual.toLocaleDateString("pt-BR", { month: "long" })})
                            </h3>

                            {pendenciasDoMes.length === 0 ? (
                                <div className="rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
                                    <CheckCircle className="mx-auto h-8 w-8 text-secondary mb-2 opacity-80" />
                                    <p className="text-sm font-medium text-foreground">Sem pendências</p>
                                    <p className="text-xs text-muted-foreground mt-1">Nada para tratar agora.</p>
                                </div>
                            ) : (
                                <div className="flex flex-col gap-2">
                                    {pendenciasDoMes
                                        .slice(0, 4)
                                        .map((ev, idx) => (
                                            <div
                                                key={ev.id || idx}
                                                className={`rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition-all hover:shadow-md ${
                                                    isGlobalAgenda
                                                        ? "hover:border-primary/30"
                                                        : "hover:border-violet-500/30"
                                                }`}
                                            >
                                                <div
                                                    onClick={() => {
                                                        if (isOfflineMode) return;
                                                        const isStatic = ev.extendedProps?.isStatic;
                                                        openTaskModal({
                                                            id: isStatic ? undefined : ev.id,
                                                            staticEventId: isStatic ? ev.id : undefined,
                                                            titulo: ev.title as string,
                                                            descricao: ev.extendedProps?.descricao || "",
                                                            status: isStatic ? "pendente" : (ev.extendedProps?.status || "pendente"),
                                                            event_type: ev.extendedProps?.event_type || "agenda_oficial",
                                                            data_inicio: ev.start as string,
                                                            post_url: isStatic ? "" : (ev.extendedProps?.post_url || ""),
                                                            tipo_agenda: tipoAgendaAtual,
                                                            captacao_by: isStatic ? null : ev.extendedProps?.captacao_by,
                                                            edicao_by: isStatic ? null : ev.extendedProps?.edicao_by,
                                                            texto_by: isStatic ? null : ev.extendedProps?.texto_by,
                                                            publicacao_by: isStatic ? null : ev.extendedProps?.publicacao_by,
                                                            formato_midia: isStatic ? null : ev.extendedProps?.formato_midia,
                                                            eixo_tematico: isStatic ? null : ev.extendedProps?.eixo_tematico,
                                                            municipio_id: isStatic ? null : ev.extendedProps?.municipio_id,
                                                            municipio_ids: isStatic ? [] : (ev.extendedProps?.municipio_ids || []),
                                                        });
                                                    }}
                                                    className="group flex cursor-pointer items-start gap-3 w-full overflow-hidden"
                                                >
                                                    <span
                                                        className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full border ${ev.extendedProps?.status === 'publicado' ? 'bg-green-500 border-green-600' : 'border-transparent'}`}
                                                        style={ev.extendedProps?.status !== 'publicado' ? { backgroundColor: ev.backgroundColor } : undefined}
                                                    />
                                                    <div className="flex min-w-0 flex-1 flex-col pr-1">
                                                        <span className={`truncate text-sm font-bold text-slate-800 transition-colors ${
                                                            isGlobalAgenda
                                                                ? "group-hover:text-primary"
                                                                : "group-hover:text-violet-600"
                                                        }`}>
                                                            {ev.title}
                                                        </span>
                                                        <span className="text-xs text-slate-500 mt-0.5">
                                                            {ev.start ? new Date(ev.start as string).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }) : "Sem data"}
                                                        </span>
                                                    </div>
                                                </div>

                                                {isGlobalAgenda && canCheckInGlobalEvent && (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            if (isOfflineMode) return;
                                                            openTaskModal({
                                                                id: ev.id,
                                                                titulo: ev.title as string,
                                                                descricao: ev.extendedProps?.descricao || "",
                                                                status: ev.extendedProps?.status || "pendente",
                                                                event_type: ev.extendedProps?.event_type || "agenda_oficial",
                                                                data_inicio: ev.start as string,
                                                                post_url: ev.extendedProps?.post_url || "",
                                                                tipo_agenda: tipoAgendaAtual,
                                                                captacao_by: ev.extendedProps?.captacao_by,
                                                                edicao_by: ev.extendedProps?.edicao_by,
                                                                texto_by: ev.extendedProps?.texto_by,
                                                                publicacao_by: ev.extendedProps?.publicacao_by,
                                                                formato_midia: ev.extendedProps?.formato_midia,
                                                                eixo_tematico: ev.extendedProps?.eixo_tematico,
                                                                municipio_id: ev.extendedProps?.municipio_id,
                                                                municipio_ids: ev.extendedProps?.municipio_ids || [],
                                                            });
                                                        }}
                                                        className="mt-3 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition-all hover:border-emerald-300 hover:bg-emerald-100"
                                                    >
                                                        Registrar presença
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                </div>
                            )}
                        </div>

                    </div>

                    {/* Right Column (Calendar Area) */}
                    <div className="flex-1 flex flex-col min-w-0">

                        {/* Top Filters Block */}
                        <div className="mb-4 flex flex-col md:flex-row items-center justify-between gap-4 rounded-2xl border border-border bg-card p-3 shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-700 delay-150 fill-mode-both">

                            {/* Tipos (Bolinhas Coloridas) */}
                            <div className="flex flex-row flex-wrap items-center gap-2 px-1 max-w-full">
                                <span className="text-[10px] whitespace-nowrap font-bold uppercase tracking-widest text-muted-foreground mr-1">TIPO:</span>
                                {Object.entries(EVENT_COLORS).map(([key, { bg, label }]) => {
                                    const isActive = filtrosAtivos.includes(key);
                                    return (
                                        <button
                                            key={key}
                                            onClick={() => toggleFiltro(key)}
                                            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all duration-200 cursor-pointer select-none active:scale-95 ${
                                                isActive
                                                    ? isGlobalAgenda
                                                        ? 'bg-white text-slate-800 shadow-sm border border-slate-200'
                                                        : 'bg-white text-slate-800 shadow-sm border border-violet-200 ring-1 ring-violet-100/50'
                                                    : 'bg-slate-100 text-slate-400 border border-transparent opacity-50 hover:opacity-75'
                                            }`}
                                        >
                                            <span
                                                className={`h-2 w-2 rounded-full shrink-0 transition-opacity ${isActive ? '' : 'opacity-40'}`}
                                                style={{ backgroundColor: bg }}
                                            />
                                            {label}
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Statuses (Segmented Control) */}
                            <div className="inline-flex items-center p-1 bg-slate-100 rounded-full border border-slate-200/50">
                                <button
                                    onClick={() => setStatusFilter("todos")}
                                    className={`px-4 py-1.5 text-sm font-medium rounded-full transition-all duration-300 ease-out active:scale-95 ${
                                        statusFilter === 'todos'
                                            ? isGlobalAgenda
                                                ? 'bg-white text-slate-900 shadow-sm'
                                                : 'bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-sm'
                                            : 'text-slate-500 bg-transparent hover:text-slate-700'
                                    }`}
                                >
                                    Todos
                                </button>
                                <button
                                    onClick={() => setStatusFilter("pendente")}
                                    className={`px-4 py-1.5 text-sm font-medium rounded-full transition-all duration-300 ease-out active:scale-95 ${
                                        statusFilter === 'pendente'
                                            ? isGlobalAgenda
                                                ? 'bg-white text-slate-900 shadow-sm'
                                                : 'bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-sm'
                                            : 'text-slate-500 bg-transparent hover:text-slate-700'
                                    }`}
                                >
                                    Pendente
                                </button>
                                <button
                                    onClick={() => setStatusFilter("publicado")}
                                    className={`px-4 py-1.5 text-sm font-medium rounded-full transition-all duration-300 ease-out active:scale-95 ${
                                        statusFilter === 'publicado'
                                            ? isGlobalAgenda
                                                ? 'bg-white text-slate-900 shadow-sm'
                                                : 'bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-sm'
                                            : 'text-slate-500 bg-transparent hover:text-slate-700'
                                    }`}
                                >
                                    Publicado
                                </button>
                            </div>
                        </div>

                        {/* Estado de erro/offline */}
                        {error && (
                            <div className="mb-4 flex items-center gap-3 rounded-xl border border-yellow-600/20 dark:border-yellow-500/20 bg-yellow-500/10 px-4 py-3">
                                <AlertCircle className="h-4 w-4 shrink-0 text-yellow-600 dark:text-yellow-500" />
                                <p className="text-sm text-yellow-700 dark:text-yellow-200">{error}</p>
                                <button
                                    onClick={fetchEvents}
                                    className="ml-auto text-xs font-medium text-yellow-600 dark:text-yellow-400 hover:text-yellow-800 dark:hover:text-yellow-300"
                                >
                                    Tentar de novo
                                </button>
                            </div>
                        )}

                        {/* Loading overlay - only if no cache */}
                        {loading && events.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-24">
                                <Loader2 className={`h-8 w-8 animate-spin ${isGlobalAgenda ? "text-primary" : "text-violet-600"}`} />
                                <p className="mt-3 text-sm text-muted-foreground">
                                    Carregando agenda
                                </p>
                            </div>
                        )}

                        {/* Calendário */}
                        <div
                            className={`flex-1 overflow-visible rounded-3xl border border-border bg-card p-3 shadow-sm md:p-5 ${(loading && events.length === 0) ? "hidden" : ""}`}
                        >
                            <FullCalendar
                                plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
                                initialView="dayGridMonth"
                                headerToolbar={{
                                    left: "prev,next today",
                                    center: "title",
                                    right: "dayGridMonth,timeGridWeek,listWeek",
                                }}
                                datesSet={(arg) => {
                                    setMesAtual(arg.view.currentStart);
                                }}
                                locale="pt-br"
                                events={events.filter(ev => {
                                    const eventType = ev.extendedProps?.event_type;
                                    return !eventType || filtrosAtivos.includes(eventType);
                                })}
                                contentHeight="auto"
                                dayMaxEvents={3}
                                navLinks
                                nowIndicator
                                stickyHeaderDates
                                eventOrder="extendedProps.rank,start,-duration,allDay,title"
                                /* ---- Interaction ---- */
                                selectable={canEdit}
                                select={canEdit ? handleDateSelect : undefined}
                                eventClick={handleEventClick}
                                editable={canEdit}
                                droppable={canEdit}
                                eventStartEditable={canEdit}
                                dragScroll={canEdit}
                                eventDrop={canEdit ? handleEventDrop : undefined}
                                eventResizableFromStart={canEdit}
                                eventResize={canEdit ? handleEventDrop as unknown as (arg: { event: EventDropArg["event"]; revert: () => void }) => void : undefined}
                                /* ---- Tooltip Tático ---- */
                                eventMouseEnter={handleEventMouseEnter}
                                eventMouseLeave={handleEventMouseLeave}
                                /* ---- Labels ---- */
                                buttonText={{
                                    today: "Hoje",
                                    month: "Mês",
                                    week: "Semana",
                                    list: "Lista",
                                }}
                                moreLinkText={(num) => `+${num} mais`}
                                noEventsText="Sem eventos neste período"
                                eventDisplay="block"
                                eventContent={(arg) => {
                                    const status = arg.event.extendedProps.status;
                                    const isListView = arg.view.type === 'listWeek';
                                    const titleColor = isListView ? '#0f172a' : arg.event.textColor;

                                    return (
                                        <div className="flex w-full items-center gap-1.5 overflow-hidden px-1 py-0.5">
                                            <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center">
                                                {status === "pendente" ? (
                                                    <Clock className="h-3.5 w-3.5 opacity-60" style={{ color: titleColor }} />
                                                ) : (
                                                    <CheckCircle className={`h-3.5 w-3.5 ${isGlobalAgenda ? 'text-white' : 'text-emerald-600'} opacity-100`} />
                                                )}
                                            </span>
                                            <span className="truncate text-xs font-bold tracking-wide" style={{ color: titleColor }}>
                                                {arg.event.title}
                                            </span>
                                        </div>
                                    );
                                }}
                                eventTimeFormat={{
                                    hour: "2-digit",
                                    minute: "2-digit",
                                    hour12: false,
                                }}
                            />
                        </div>

                        {/* Footer info */}
                        <div className="mt-4 mb-2 flex items-center justify-center gap-1 text-xs text-muted-foreground">
                            <span>
                                {events.length} {events.length === 1 ? "evento" : "eventos"} no
                                calendário
                            </span>
                        </div>
                    </div>
                </div>
            </main>

            {/* Tooltip Tático */}
            {tooltip.show && tooltip.data && (
                <div
                    className="fixed z-[9999] pointer-events-none bg-white text-slate-800 p-4 rounded-xl shadow-[0_8px_30px_-4px_rgba(0,0,0,0.15)] w-72 flex flex-col gap-2 border border-slate-200 animate-in fade-in zoom-in-95 duration-150"
                    style={{ top: tooltip.y, left: tooltip.x }}
                >
                    <h4 className="font-bold text-sm leading-tight text-slate-900">{tooltip.data.title}</h4>

                    {/* Tema */}
                    {tooltip.data.tema && (
                        <span className="inline-flex w-fit items-center px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-700 uppercase tracking-wider">
                            {tooltip.data.tema}
                        </span>
                    )}

                    {/* Linha divisória sutil */}
                    <div className="h-px w-full bg-slate-200 my-1" />

                    {/* Status & Tipo */}
                    <div className="flex flex-col gap-1 text-xs text-slate-600">
                        <p>
                            <span className="font-semibold text-slate-500">Status: </span>
                            <span className={`font-semibold ${tooltip.data.status === 'publicado' ? 'text-green-600' : 'text-amber-600'
                                }`}>
                                {tooltip.data.status === 'publicado' ? 'Publicado' : 'Pendente'}
                            </span>
                        </p>
                        {tooltip.data.event_type && (
                            <p>
                                <span className="font-semibold text-slate-500">Tipo: </span>
                                {EVENT_COLORS[tooltip.data.event_type as keyof typeof EVENT_COLORS]?.label || tooltip.data.event_type}
                            </p>
                        )}
                        {tooltip.data.descricao && (
                            <p className="text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                                {tooltip.data.descricao}
                            </p>
                        )}
                    </div>
                </div>
            )}

            {/* Task Modal */}
            {user && taskModalOpen && (
                <TaskModal
                    key={taskModalData?.id ?? "__new__"}
                    open={taskModalOpen}
                    onClose={closeTaskModal}
                    onSaved={fetchEvents}
                    initialData={taskModalData}
                    userId={user.id}
                    userName={profile?.nome}
                    isAdmin={profile?.is_admin ?? false}
                    onUpdateStore={fetchEvents}
                    canEdit={canEdit}
                    canCheckIn={isGlobalAgenda && canCheckInGlobalEvent}
                    canViewBriefing={isGlobalAgenda && canViewCommunicationBriefing}
                    tipoAgenda={tipoAgendaAtual}
                    onStaticEventConverted={(staticId) => {
                        esconderEventoEstatico(staticId);
                    }}
                />
            )}
        </div>
    );
}
