"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
    CalendarClock,
    ChevronRight,
    Download,
    FilePenLine,
    Files,
    Loader2,
    Plus,
    Search,
    Sparkles,
    X,
    FileText,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { usePermissions } from "@/hooks/usePermissions";
import dynamic from "next/dynamic";
import {
    BlocoCustomizado,
    BriefingFormValues,
    TipoLocalidade,
    getDefaultContentBlocks,
    getEmptyBriefingValues,
} from "@/components/briefings/briefing-types";
import { ToastContainer, ToastState } from "@/components/agenda-shared";

const BriefingForm = dynamic(() => import("@/components/briefings/briefing-form"), {
    ssr: false,
    loading: () => (
        <div className="flex items-center justify-center p-8 border border-dashed border-slate-200 bg-white rounded-2xl">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            <span className="ml-2 text-sm text-slate-500 font-semibold">Carregando editor...</span>
        </div>
    ),
});

type EventSummary = {
    id: string;
    titulo: string;
    descricao: string | null;
    data_inicio: string | null;
    data_fim: string | null;
    event_type: string | null;
    tema: string | null;
    registro_status: string;
};

type BriefingRecord = {
    id?: string;
    tipo_localidade: TipoLocalidade | null;
    agenda_id: string | null;
    municipio_id?: string | null;
    titulo_customizado: string | null;
    data_customizada: string | null;
    hora_customizada: string | null;
    local_customizado: string | null;
    organizacao: string | null;
    contato_local: string | null;
    traje: string | null;
    apoio_governo_ms: string | null;
    autoridades: unknown;
    cronograma: unknown;
    blocos_customizados?: unknown;
    contexto_geral: string | null;
    destaques_ms: string | null;
    info_confidencial: string | null;
    atualizado_em?: string | null;
    status: "RASCUNHO" | "FINALIZADO";
    atendimento_id?: string | null;
    tasks?: {
        id: string;
        titulo: string;
        data_inicio: string | null;
        data_fim: string | null;
        descricao: string | null;
    } | null;
};

type SelectionState =
    | { type: "agenda"; agendaId: string }
    | { type: "independente"; briefingId: string | null }
    | null;

type EventFilter = "dia" | "semana" | "mes";

function formatarDataHora(iso: string | null) {
    if (!iso) return "Sem data definida";

    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "Sem data definida";

    return new Intl.DateTimeFormat("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    }).format(date);
}

function formatarDataCustomizada(data: string | null, hora: string | null) {
    if (!data) return "Sem data definida";

    if (!hora) {
        return new Intl.DateTimeFormat("pt-BR", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
        }).format(new Date(`${data}T00:00:00`));
    }

    return formatarDataHora(`${data}T${hora}`);
}

function EmptyList({
    message,
    onAction,
    actionText,
}: {
    message: string;
    onAction?: () => void;
    actionText?: string;
}) {
    return (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 px-4 py-10 text-center">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-white text-slate-400 shadow-[0_1px_3px_rgba(0,0,0,0.02)] ring-1 ring-slate-100">
                <FileText className="h-5 w-5" />
            </div>
            <p className="mt-3 text-xs font-semibold text-slate-500">
                {message}
            </p>
            {onAction && actionText && (
                <button
                    type="button"
                    onClick={onAction}
                    className="mt-4 inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition-all hover:bg-slate-50 hover:border-slate-350 active:scale-95 cursor-pointer"
                >
                    {actionText}
                </button>
            )}
        </div>
    );
}

function normalizarBriefing(briefing: BriefingRecord | null | undefined): BriefingFormValues {
    if (!briefing) return getEmptyBriefingValues();

    const fallback = getDefaultContentBlocks();
    const blocosCustomizados = Array.isArray(briefing.blocos_customizados)
        ? briefing.blocos_customizados.map((item, index) => {
              const bloco = item as Record<string, unknown>;
              return {
                  id: typeof bloco.id === "string" && bloco.id.trim().length > 0 ? bloco.id.trim() : `bloco_${index + 1}`,
                  titulo: typeof bloco.titulo === "string" && bloco.titulo.trim().length > 0 ? bloco.titulo.trim() : `Bloco ${index + 1}`,
                  conteudo_html: typeof bloco.conteudo_html === "string" ? bloco.conteudo_html : "",
                  sigiloso: Boolean(bloco.sigiloso),
              };
          })
        : fallback.map((bloco) => {
              if (/contexto/i.test(bloco.titulo)) {
                  return {
                      ...bloco,
                      conteudo_html: briefing.contexto_geral
                          ? `<p>${briefing.contexto_geral.replace(/\n/g, "</p><p>")}</p>`
                          : "",
                  };
              }

              if (/destaques|protagonismo/i.test(bloco.titulo)) {
                  return {
                      ...bloco,
                      conteudo_html: briefing.destaques_ms
                          ? `<p>${briefing.destaques_ms.replace(/\n/g, "</p><p>")}</p>`
                          : "",
                  };
              }

              if (bloco.sigiloso) {
                  return {
                      ...bloco,
                      conteudo_html: briefing.info_confidencial
                          ? `<p>${briefing.info_confidencial.replace(/\n/g, "</p><p>")}</p>`
                          : "",
                  };
              }

              return bloco;
          });

    return {
        tipo_localidade: briefing.tipo_localidade === "CAPITAL" ? "CAPITAL" : "INTERIOR",
        titulo_customizado: briefing.titulo_customizado || "",
        data_customizada: briefing.data_customizada || "",
        hora_customizada: briefing.hora_customizada ? briefing.hora_customizada.slice(0, 5) : "",
        local_customizado: briefing.local_customizado || "",
        municipio_id: briefing.municipio_id || null,
        organizacao: briefing.organizacao || "",
        contato_local: briefing.contato_local || "",
        traje: briefing.traje || "",
        apoio_governo_ms: briefing.apoio_governo_ms || "",
        autoridades: Array.isArray(briefing.autoridades)
            ? briefing.autoridades.map((item) => {
                  const aut = item as Record<string, unknown>;
                  return {
                      nome: typeof aut.nome === "string" ? aut.nome : "",
                      cargo: typeof aut.cargo === "string" ? aut.cargo : "",
                  };
              })
            : [],
        cronograma: Array.isArray(briefing.cronograma)
            ? briefing.cronograma.map((item) => {
                  const cron = item as Record<string, unknown>;
                  return {
                      horario: typeof cron.horario === "string" ? cron.horario : "",
                      acao: typeof cron.acao === "string" ? cron.acao : "",
                  };
              })
            : [],
        blocos_customizados: blocosCustomizados as BlocoCustomizado[],
        status: briefing.status === "FINALIZADO" ? "FINALIZADO" : "RASCUNHO",
        atendimento_id: briefing.atendimento_id || null,
    };
}

function getBriefingTitle(briefing: BriefingRecord) {
    if (briefing.agenda_id && briefing.tasks) {
        return briefing.tasks.titulo || "Sem título";
    }
    return briefing.titulo_customizado || "Sem título";
}

function getBriefingDate(briefing: BriefingRecord) {
    if (briefing.agenda_id && briefing.tasks) {
        return formatarDataHora(briefing.tasks.data_inicio);
    }
    return formatarDataCustomizada(briefing.data_customizada, briefing.hora_customizada);
}

function getBriefingLocation(briefing: BriefingRecord) {
    return briefing.local_customizado || "Sem local cadastrado";
}

function isSameDay(base: Date, target: Date) {
    return (
        base.getFullYear() === target.getFullYear() &&
        base.getMonth() === target.getMonth() &&
        base.getDate() === target.getDate()
    );
}

function isWithinCurrentWeek(base: Date, target: Date) {
    const startOfWeek = new Date(base);
    const dayOfWeek = startOfWeek.getDay();
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    startOfWeek.setDate(startOfWeek.getDate() + diffToMonday);
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(endOfWeek.getDate() + 7);

    return target >= startOfWeek && target < endOfWeek;
}

function isWithinCurrentMonth(base: Date, target: Date) {
    return (
        base.getFullYear() === target.getFullYear() &&
        base.getMonth() === target.getMonth()
    );
}

export default function BriefingsPage() {
    const router = useRouter();
    const { user } = useAuth();
    const { loading, hasModule } = usePermissions();
    const [toasts, setToasts] = useState<ToastState[]>([]);
    const [events, setEvents] = useState<EventSummary[]>([]);
    const [briefings, setBriefings] = useState<BriefingRecord[]>([]);
    const [loadingEvents, setLoadingEvents] = useState(true);
    const [selection, setSelection] = useState<SelectionState>(null);
    const [selectedEvent, setSelectedEvent] = useState<EventSummary | null>(null);
    const [currentBriefingId, setCurrentBriefingId] = useState<string | null>(null);
    const [formValues, setFormValues] = useState<BriefingFormValues>(getEmptyBriefingValues());
    const [loadingBriefing, setLoadingBriefing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [generatingPdf, setGeneratingPdf] = useState(false);
    const [createModalOpen, setCreateModalOpen] = useState(false);
    const [createMode, setCreateMode] = useState<"agenda" | "independente" | null>(null);
    const [pendingAgendaId, setPendingAgendaId] = useState<string>("");
    const [eventFilter, setEventFilter] = useState<EventFilter>("semana");
    const [activeTab, setActiveTab] = useState<"rascunhos" | "finalizados" | "pautas">("rascunhos");
    const [searchQuery, setSearchQuery] = useState("");

    const canWrite = hasModule("briefing_editar") || hasModule("agenda_comunicacao_editar");
    const canView = hasModule("agenda_comunicacao_ver") || canWrite;

    const drafts = useMemo(() => briefings.filter((b) => b.status === "RASCUNHO"), [briefings]);
    const finalized = useMemo(() => briefings.filter((b) => b.status === "FINALIZADO"), [briefings]);
    const pendingEvents = useMemo(() => events.filter((e) => !briefings.some((b) => b.agenda_id === e.id)), [events, briefings]);

    const filteredDrafts = useMemo(() => {
        return drafts.filter((b) => {
            const title = getBriefingTitle(b);
            const local = getBriefingLocation(b);
            return (
                title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                local.toLowerCase().includes(searchQuery.toLowerCase())
            );
        });
    }, [drafts, searchQuery]);

    const filteredFinalized = useMemo(() => {
        return finalized.filter((b) => {
            const title = getBriefingTitle(b);
            const local = getBriefingLocation(b);
            return (
                title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                local.toLowerCase().includes(searchQuery.toLowerCase())
            );
        });
    }, [finalized, searchQuery]);

    const filteredPendingEvents = useMemo(() => {
        const now = new Date();
        return pendingEvents.filter((event) => {
            if (!event.data_inicio) return false;

            const startDate = new Date(event.data_inicio);
            if (Number.isNaN(startDate.getTime())) return false;

            let matchesDate = true;
            if (eventFilter === "dia") {
                matchesDate = isSameDay(now, startDate);
            } else if (eventFilter === "semana") {
                matchesDate = isWithinCurrentWeek(now, startDate);
            } else if (eventFilter === "mes") {
                matchesDate = isWithinCurrentMonth(now, startDate);
            }

            if (!matchesDate) return false;

            const title = event.titulo || "";
            const desc = event.descricao || "";
            return (
                title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                desc.toLowerCase().includes(searchQuery.toLowerCase())
            );
        });
    }, [pendingEvents, searchQuery, eventFilter]);

    const effectivePendingAgendaId = useMemo(() => {
        if (pendingEvents.some((event) => event.id === pendingAgendaId)) {
            return pendingAgendaId;
        }
        return pendingEvents[0]?.id ?? "";
    }, [pendingEvents, pendingAgendaId]);

    const addToast = useCallback((message: string, type: "success" | "error") => {
        const id = Date.now();
        setToasts((prev) => [...prev, { id, message, type }]);
        window.setTimeout(() => {
            setToasts((prev) => prev.filter((toast) => toast.id !== id));
        }, 4000);
    }, []);

    const fetchOverview = useCallback(async () => {
        setLoadingEvents(true);
        try {
            const response = await fetch("/api/briefings/upsert", { method: "GET" });
            const payload = (await response.json()) as {
                error?: string;
                events?: EventSummary[];
                briefings?: BriefingRecord[];
            };

            if (!response.ok) {
                throw new Error(payload.error || "Não consegui carregar os briefings.");
            }

            const eventos = payload.events ?? [];
            const briefingsLista = payload.briefings ?? [];
            setEvents(eventos);
            setBriefings(briefingsLista);

            if (!pendingAgendaId && eventos.length > 0) {
                setPendingAgendaId(eventos[0].id);
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : "Erro ao carregar briefings.";
            addToast(message, "error");
        } finally {
            setLoadingEvents(false);
        }
    }, [addToast, pendingAgendaId]);

    useEffect(() => {
        if (!loading && !user) {
            router.replace("/login");
        }
    }, [loading, router, user]);

    useEffect(() => {
        if (!user || !canView) return;
        const timer = window.setTimeout(() => {
            void fetchOverview();
        }, 0);

        return () => window.clearTimeout(timer);
    }, [canView, fetchOverview, user]);

    useEffect(() => {
        if (!selection) return;
        if (selection.type === "independente" && !selection.briefingId) return;

        const fetchBriefing = async () => {
            setLoadingBriefing(true);
            try {
                const params =
                    selection.type === "agenda"
                        ? `agenda_id=${selection.agendaId}`
                        : `briefing_id=${selection.briefingId}`;

                const response = await fetch(`/api/briefings/upsert?${params}`, {
                    method: "GET",
                });
                const payload = (await response.json()) as {
                    error?: string;
                    event?: EventSummary | null;
                    briefing?: BriefingRecord | null;
                };

                if (!response.ok) {
                    throw new Error(payload.error || "Não consegui carregar o briefing.");
                }

                setSelectedEvent(payload.event ?? null);
                setCurrentBriefingId(payload.briefing?.id ?? null);
                setFormValues(normalizarBriefing(payload.briefing));
            } catch (error) {
                const message = error instanceof Error ? error.message : "Erro ao carregar briefing.";
                setSelectedEvent(null);
                setCurrentBriefingId(null);
                setFormValues(getEmptyBriefingValues());
                addToast(message, "error");
            } finally {
                setLoadingBriefing(false);
            }
        };

        void fetchBriefing();
    }, [addToast, selection]);

    const selectedIndependent = useMemo(
        () =>
            selection?.type === "independente" && selection.briefingId
                ? briefings.find((briefing) => briefing.id === selection.briefingId) ?? null
                : null,
        [briefings, selection]
    );

    const handleSubmit = async () => {
        const isIndependent = selection?.type === "independente";

        if (!selection) {
            addToast("Escolha como deseja criar ou abrir um briefing.", "error");
            return;
        }

        if (!isIndependent && selection.type === "agenda" && !selection.agendaId) {
            addToast("Selecione um evento antes de salvar.", "error");
            return;
        }

        if (
            isIndependent &&
            (!formValues.titulo_customizado.trim() ||
                !formValues.data_customizada ||
                !formValues.hora_customizada ||
                !formValues.local_customizado.trim())
        ) {
            addToast("Preencha título, data, horário e local do briefing independente.", "error");
            return;
        }

        setSaving(true);
        try {
            const response = await fetch("/api/briefings/upsert", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    id: currentBriefingId,
                    agenda_id: selection.type === "agenda" ? selection.agendaId : null,
                    ...formValues,
                }),
            });

            const payload = (await response.json()) as {
                error?: string;
                success?: boolean;
                briefing?: BriefingRecord;
            };

            if (!response.ok || !payload.success || !payload.briefing) {
                throw new Error(payload.error || "Não consegui salvar o briefing.");
            }

            const briefingSalvo = payload.briefing;
            setCurrentBriefingId(briefingSalvo.id ?? null);
            setFormValues(normalizarBriefing(briefingSalvo));

            if (briefingSalvo.id) {
                if (briefingSalvo.agenda_id) {
                    setSelection({ type: "agenda", agendaId: briefingSalvo.agenda_id });
                } else {
                    setSelection({ type: "independente", briefingId: briefingSalvo.id });
                }
            }

            addToast("Briefing salvo com sucesso.", "success");
            await fetchOverview();
        } catch (error) {
            const message = error instanceof Error ? error.message : "Erro ao salvar briefing.";
            addToast(message, "error");
        } finally {
            setSaving(false);
        }
    };

    const openCreateModal = () => {
        setCreateModalOpen(true);
        setCreateMode(null);
        setPendingAgendaId(pendingEvents[0]?.id ?? "");
    };

    const confirmarBriefingAgenda = () => {
        if (!effectivePendingAgendaId) {
            addToast("Selecione um evento para criar o briefing.", "error");
            return;
        }
        setCreateModalOpen(false);
        setCreateMode(null);
        setSelection({ type: "agenda", agendaId: effectivePendingAgendaId });
    };

    const iniciarBriefingIndependente = () => {
        setCreateModalOpen(false);
        setCreateMode(null);
        setLoadingBriefing(false);
        setSelectedEvent(null);
        setCurrentBriefingId(null);
        setFormValues(getEmptyBriefingValues());
        setSelection({ type: "independente", briefingId: null });
    };

    if (loading || !user) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-background">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!canView) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-background px-4">
                <div className="max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
                    <h1 className="text-xl font-bold text-slate-800">Sem acesso</h1>
                    <p className="mt-2 text-sm leading-relaxed text-slate-500">
                        Seu perfil não pode abrir o módulo de briefings.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(15,76,129,0.08),_transparent_34%),linear-gradient(180deg,#f8fafc_0%,#eef3f8_100%)]">
            <main className="mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-8">
                {/* Painel Superior / Header */}
                <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_24px_60px_-36px_rgba(15,23,42,0.35)]">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                        <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                                Módulo Operacional
                            </p>
                            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
                                Painel de Briefings
                            </h1>
                            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
                                Elabore documentos de briefing para subsidiar agendas públicas e políticas do Gabinete, organizando informações gerais e sigilosas.
                            </p>
                        </div>

                        {canWrite && (
                            <button
                                type="button"
                                onClick={openCreateModal}
                                className="inline-flex items-center gap-2 rounded-2xl bg-primary px-5 py-3.5 text-sm font-bold text-white transition-all hover:bg-primary-hover active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                            >
                                <Plus className="h-4 w-4" />
                                Novo Briefing
                            </button>
                        )}
                    </div>
                </section>

                <section className="mt-6 grid gap-6 xl:grid-cols-[365px_minmax(0,1fr)]">
                    {/* Sidebar de Abas e Busca */}
                    <aside className="space-y-6">
                        <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
                            {/* Campo de Busca */}
                            <div className="relative mb-4">
                                <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Buscar briefing ou pauta..."
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-10 py-2.5 text-sm text-slate-800 outline-none transition-all focus:border-slate-900 focus:bg-white focus:ring-2 focus:ring-slate-900/5"
                                />
                                {searchQuery && (
                                    <button
                                        type="button"
                                        onClick={() => setSearchQuery("")}
                                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                        aria-label="Limpar busca"
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                )}
                            </div>

                            {/* Tab Switcher */}
                            <div className="mb-4 flex rounded-2xl border border-slate-100 bg-slate-50 p-1">
                                {[
                                    { id: "rascunhos", label: "Rascunhos", count: drafts.length, colorClass: "bg-amber-100 text-amber-800" },
                                    { id: "finalizados", label: "Finalizados", count: finalized.length, colorClass: "bg-emerald-100 text-emerald-800" },
                                    { id: "pautas", label: "Pautas", count: pendingEvents.length, colorClass: "bg-sky-100 text-sky-800" },
                                ].map((tab) => {
                                    const active = activeTab === tab.id;
                                    return (
                                        <button
                                            key={tab.id}
                                            type="button"
                                            onClick={() => setActiveTab(tab.id as any)}
                                            className={`flex-1 flex flex-col items-center justify-center rounded-xl py-2 px-1 text-center transition-all ${
                                                active
                                                    ? "bg-slate-900 text-white shadow-sm"
                                                    : "text-slate-500 hover:bg-slate-100 hover:text-slate-950"
                                            }`}
                                        >
                                            <span className="text-[10px] font-extrabold uppercase tracking-wider">{tab.label}</span>
                                            <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-extrabold ${active ? "bg-white/20 text-white" : tab.colorClass}`}>
                                                {tab.count}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>

                            {/* List Content */}
                            {loadingEvents ? (
                                <div className="flex items-center justify-center py-12">
                                    <Loader2 className="h-6 w-6 animate-spin text-slate-450" />
                                </div>
                            ) : (
                                <div className="space-y-3 max-h-[640px] overflow-y-auto pr-1">
                                    {activeTab === "rascunhos" && (
                                        <>
                                            {filteredDrafts.map((briefing) => {
                                                const active = selection?.type === "independente"
                                                    ? selection.briefingId === briefing.id
                                                    : selection?.type === "agenda" && selection.agendaId === briefing.agenda_id;

                                                const localidadeLabel = briefing.tipo_localidade === "CAPITAL" ? "Capital" : "Interior";
                                                const localidadeColor = briefing.tipo_localidade === "CAPITAL"
                                                    ? "bg-sky-50/70 text-sky-750 border-sky-200"
                                                    : "bg-indigo-50/70 text-indigo-750 border-indigo-200";

                                                return (
                                                    <button
                                                        key={briefing.id}
                                                        type="button"
                                                        onClick={() => {
                                                            if (briefing.agenda_id) {
                                                                setSelection({ type: "agenda", agendaId: briefing.agenda_id });
                                                            } else {
                                                                setSelection({ type: "independente", briefingId: briefing.id ?? null });
                                                            }
                                                        }}
                                                        className={`group relative w-full overflow-hidden rounded-2xl border px-4 py-4 text-left transition-all duration-200 cursor-pointer ${
                                                            active
                                                                ? "border-amber-500 bg-amber-50/10 text-slate-950 shadow-sm"
                                                                : "border-slate-200 bg-white text-slate-800 hover:border-slate-350 hover:bg-slate-50/50"
                                                        }`}
                                                    >
                                                        {/* Color accent line */}
                                                        <div className="absolute bottom-0 left-0 top-0 w-1 bg-amber-500" />

                                                        <div className="flex items-start justify-between gap-3 pl-1">
                                                            <div className="min-w-0 flex-1">
                                                                <div className="flex flex-wrap gap-1.5 items-center">
                                                                    <span className="rounded-md border border-amber-200 bg-amber-50/70 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-amber-800">
                                                                        Rascunho
                                                                    </span>
                                                                    <span className={`rounded-md border px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider ${localidadeColor}`}>
                                                                        {localidadeLabel}
                                                                    </span>
                                                                </div>

                                                                <h3 className="mt-2.5 text-sm font-extrabold leading-snug text-slate-900 group-hover:text-amber-800 transition-colors truncate">
                                                                    {getBriefingTitle(briefing)}
                                                                </h3>
                                                                <p className="mt-1.5 text-xs font-semibold text-slate-500">
                                                                    {getBriefingDate(briefing)}
                                                                </p>
                                                                <p className="mt-0.5 text-xs text-slate-400 truncate">
                                                                    {getBriefingLocation(briefing)}
                                                                </p>
                                                            </div>
                                                            <div className="flex flex-col items-center gap-2 shrink-0">
                                                                {briefing.id && (
                                                                    <Link
                                                                        href={`/briefings/${briefing.id}/print`}
                                                                        target="_blank"
                                                                        onClick={(e) => e.stopPropagation()}
                                                                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-all hover:bg-slate-50 hover:text-slate-900 active:scale-95 focus:outline-none focus:ring-2 focus:ring-slate-900"
                                                                        title="Abrir PDF"
                                                                    >
                                                                        <Download className="h-3.5 w-3.5" />
                                                                    </Link>
                                                                )}
                                                                <ChevronRight className="h-4 w-4 text-slate-350 transition-transform duration-200 group-hover:translate-x-0.5" />
                                                            </div>
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                            {filteredDrafts.length === 0 && (
                                                <EmptyList message="Nenhum rascunho encontrado." />
                                            )}
                                        </>
                                    )}

                                    {activeTab === "finalizados" && (
                                        <>
                                            {filteredFinalized.map((briefing) => {
                                                const active = selection?.type === "independente"
                                                    ? selection.briefingId === briefing.id
                                                    : selection?.type === "agenda" && selection.agendaId === briefing.agenda_id;

                                                const localidadeLabel = briefing.tipo_localidade === "CAPITAL" ? "Capital" : "Interior";
                                                const localidadeColor = briefing.tipo_localidade === "CAPITAL"
                                                    ? "bg-sky-50/70 text-sky-750 border-sky-200"
                                                    : "bg-indigo-50/70 text-indigo-750 border-indigo-200";

                                                return (
                                                    <button
                                                        key={briefing.id}
                                                        type="button"
                                                        onClick={() => {
                                                            if (briefing.agenda_id) {
                                                                setSelection({ type: "agenda", agendaId: briefing.agenda_id });
                                                            } else {
                                                                setSelection({ type: "independente", briefingId: briefing.id ?? null });
                                                            }
                                                        }}
                                                        className={`group relative w-full overflow-hidden rounded-2xl border px-4 py-4 text-left transition-all duration-200 cursor-pointer ${
                                                            active
                                                                ? "border-emerald-500 bg-emerald-50/10 text-slate-950 shadow-sm"
                                                                : "border-slate-200 bg-white text-slate-800 hover:border-slate-350 hover:bg-slate-50/50"
                                                        }`}
                                                    >
                                                        {/* Color accent line */}
                                                        <div className="absolute bottom-0 left-0 top-0 w-1 bg-emerald-500" />

                                                        <div className="flex items-start justify-between gap-3 pl-1">
                                                            <div className="min-w-0 flex-1">
                                                                <div className="flex flex-wrap gap-1.5 items-center">
                                                                    <span className="rounded-md border border-emerald-250 bg-emerald-55/70 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-emerald-800">
                                                                        Finalizado
                                                                    </span>
                                                                    <span className={`rounded-md border px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider ${localidadeColor}`}>
                                                                        {localidadeLabel}
                                                                    </span>
                                                                </div>

                                                                <h3 className="mt-2.5 text-sm font-extrabold leading-snug text-slate-900 group-hover:text-emerald-800 transition-colors truncate">
                                                                    {getBriefingTitle(briefing)}
                                                                </h3>
                                                                <p className="mt-1.5 text-xs font-semibold text-slate-500">
                                                                    {getBriefingDate(briefing)}
                                                                </p>
                                                                <p className="mt-0.5 text-xs text-slate-400 truncate">
                                                                    {getBriefingLocation(briefing)}
                                                                </p>
                                                            </div>
                                                            <div className="flex flex-col items-center gap-2 shrink-0">
                                                                {briefing.id && (
                                                                    <Link
                                                                        href={`/briefings/${briefing.id}/print`}
                                                                        target="_blank"
                                                                        onClick={(e) => e.stopPropagation()}
                                                                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-all hover:bg-slate-50 hover:text-slate-900 active:scale-95 focus:outline-none focus:ring-2 focus:ring-slate-900"
                                                                        title="Abrir PDF"
                                                                    >
                                                                        <Download className="h-3.5 w-3.5" />
                                                                    </Link>
                                                                )}
                                                                <ChevronRight className="h-4 w-4 text-slate-350 transition-transform duration-200 group-hover:translate-x-0.5" />
                                                            </div>
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                            {filteredFinalized.length === 0 && (
                                                <EmptyList message="Nenhum briefing finalizado encontrado." />
                                            )}
                                        </>
                                    )}

                                    {activeTab === "pautas" && (
                                        <div className="space-y-4">
                                            {/* Filtro do calendário local para pautas */}
                                            <div className="flex rounded-xl border border-slate-200 bg-slate-50 p-1">
                                                {[
                                                    { value: "dia", label: "Dia" },
                                                    { value: "semana", label: "Semana" },
                                                    { value: "mes", label: "Mês" },
                                                ].map((option) => {
                                                    const active = eventFilter === option.value;
                                                    return (
                                                        <button
                                                            key={option.value}
                                                            type="button"
                                                            onClick={() => setEventFilter(option.value as EventFilter)}
                                                            className={`flex-1 rounded-lg py-1.5 text-[10px] font-extrabold uppercase tracking-wider transition-all cursor-pointer ${
                                                                active
                                                                    ? "bg-slate-900 text-white shadow-sm"
                                                                    : "text-slate-500 hover:text-slate-800"
                                                            }`}
                                                        >
                                                            {option.label}
                                                        </button>
                                                    );
                                                })}
                                            </div>

                                            <div className="space-y-2">
                                                {filteredPendingEvents.map((event) => {
                                                    const active = selection?.type === "agenda" && selection.agendaId === event.id;
                                                    return (
                                                        <button
                                                            key={event.id}
                                                            type="button"
                                                            onClick={() => setSelection({ type: "agenda", agendaId: event.id })}
                                                            className={`group relative w-full overflow-hidden rounded-2xl border px-4 py-4 text-left transition-all duration-200 cursor-pointer ${
                                                                active
                                                                    ? "border-sky-500 bg-sky-50/10 text-slate-950 shadow-sm"
                                                                    : "border-slate-200 bg-white text-slate-800 hover:border-slate-350 hover:bg-slate-50/50"
                                                            }`}
                                                        >
                                                            <div className="absolute bottom-0 left-0 top-0 w-1 bg-sky-500" />
                                                            <div className="flex items-start justify-between gap-3 pl-1">
                                                                <div className="min-w-0 flex-1">
                                                                    <span className="rounded-md border border-sky-200 bg-sky-50/70 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-sky-850">
                                                                        Sem Briefing
                                                                    </span>
                                                                    <h3 className="mt-2.5 text-sm font-extrabold leading-snug text-slate-900 group-hover:text-sky-800 transition-colors truncate">
                                                                        {event.titulo}
                                                                    </h3>
                                                                    <p className="mt-1.5 text-xs font-semibold text-slate-500">
                                                                        {formatarDataHora(event.data_inicio)}
                                                                    </p>
                                                                </div>
                                                                <ChevronRight className="mt-1.5 h-4 w-4 shrink-0 text-slate-350 transition-transform duration-200 group-hover:translate-x-0.5" />
                                                            </div>
                                                        </button>
                                                    );
                                                })}
                                                {filteredPendingEvents.length === 0 && (
                                                    <EmptyList message="Nenhuma pauta pendente neste período." />
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </aside>

                    {/* Área Central / Visualização do Briefing */}
                    <section className="space-y-5">
                        {selection ? (
                            <>
                                <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
                                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                                        <div className="flex items-start gap-3">
                                            <div className="rounded-2xl bg-slate-900 p-2 text-white">
                                                <FilePenLine className="h-5 w-5" />
                                            </div>
                                            <div>
                                                <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-slate-500">
                                                    {selection.type === "agenda"
                                                        ? "Briefing de Agenda Oficial"
                                                        : "Briefing Livre / Independente"}
                                                </p>
                                                <h2 className="mt-1 text-xl font-bold text-slate-900 leading-tight">
                                                    {selection.type === "agenda"
                                                        ? selectedEvent?.titulo || "Evento da agenda"
                                                        : selectedIndependent?.titulo_customizado || "Novo Briefing Livre"}
                                                </h2>
                                                <p className="mt-2 text-xs font-semibold text-slate-500">
                                                    {selection.type === "agenda"
                                                        ? formatarDataHora(selectedEvent?.data_inicio ?? null)
                                                        : formatarDataCustomizada(
                                                              selectedIndependent?.data_customizada ?? formValues.data_customizada,
                                                              selectedIndependent?.hora_customizada ?? formValues.hora_customizada
                                                          )}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2 self-end sm:self-start">
                                            {currentBriefingId && (
                                                <Link
                                                    href={`/briefings/${currentBriefingId}/print`}
                                                    target="_blank"
                                                    onClick={() => {
                                                        setGeneratingPdf(true);
                                                        window.setTimeout(() => setGeneratingPdf(false), 1200);
                                                    }}
                                                    className={`inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 transition-all hover:border-slate-300 hover:bg-slate-50 ${loadingBriefing ? "pointer-events-none opacity-60" : ""}`}
                                                >
                                                    {generatingPdf ? (
                                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                    ) : (
                                                        <Download className="h-3.5 w-3.5" />
                                                    )}
                                                    {generatingPdf ? "Gerando PDF..." : "Abrir PDF"}
                                                </Link>
                                            )}

                                            <button
                                                type="button"
                                                onClick={() => setSelection(null)}
                                                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-bold text-slate-600 transition-all hover:border-slate-350 hover:bg-slate-100"
                                            >
                                                <X className="h-3.5 w-3.5" />
                                                Fechar
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {loadingBriefing ? (
                                    <div className="flex min-h-[320px] items-center justify-center rounded-[24px] border border-slate-200 bg-white shadow-sm">
                                        <Loader2 className="h-7 w-7 animate-spin text-slate-400" />
                                    </div>
                                ) : (
                                    <BriefingForm
                                        mode={selection.type}
                                        linkedEvent={selectedEvent}
                                        values={formValues}
                                        onChange={setFormValues}
                                        onSubmit={handleSubmit}
                                        loading={saving}
                                        disabled={!canWrite}
                                    />
                                )}

                                {!canWrite && (
                                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                                        Seu perfil possui permissão apenas de leitura neste módulo.
                                    </div>
                                )}
                            </>
                        ) : (
                            /* Painel de Controle Estatístico / Insights */
                            <div className="space-y-6">
                                {/* Welcome Card */}
                                <div className="relative overflow-hidden rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
                                    <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-slate-50 opacity-50" />
                                    <div className="relative z-10 flex items-start gap-4">
                                        <div className="rounded-2xl bg-slate-900 p-3 text-white">
                                            <Sparkles className="h-6 w-6 text-amber-400" />
                                        </div>
                                        <div>
                                            <h2 className="text-xl font-bold text-slate-900">Painel de Controle de Briefings</h2>
                                            <p className="mt-2 text-sm leading-relaxed text-slate-500">
                                                Selecione um briefing existente na lista à esquerda para visualizá-lo ou editá-lo, ou crie um novo. Acompanhe abaixo o progresso de elaboração dos briefings para os próximos eventos da agenda.
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Stats Grid */}
                                <div className="grid gap-4 sm:grid-cols-3">
                                    {/* Card Rascunhos */}
                                    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:shadow-md">
                                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-600">Rascunhos</span>
                                        <div className="mt-2 flex items-baseline gap-2">
                                            <span className="text-3xl font-extrabold text-slate-950">{drafts.length}</span>
                                            <span className="text-xs text-slate-400">em andamento</span>
                                        </div>
                                    </div>
                                    {/* Card Finalizados */}
                                    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:shadow-md">
                                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-600">Finalizados</span>
                                        <div className="mt-2 flex items-baseline gap-2">
                                            <span className="text-3xl font-extrabold text-slate-950">{finalized.length}</span>
                                            <span className="text-xs text-slate-400">prontos para PDF</span>
                                        </div>
                                    </div>
                                    {/* Card Pautas Pendentes */}
                                    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:shadow-md">
                                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-sky-600">Pautas Pendentes</span>
                                        <div className="mt-2 flex items-baseline gap-2">
                                            <span className="text-3xl font-extrabold text-slate-950">{pendingEvents.length}</span>
                                            <span className="text-xs text-slate-400 font-semibold">sem briefing</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Próximas Pautas sem Briefing */}
                                <div className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
                                    <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400">Próximos compromissos sem briefing</h3>
                                    <p className="mt-1 text-xs text-slate-400">Selecione uma pauta abaixo para iniciar a elaboração do briefing correspondente.</p>

                                    <div className="mt-4 divide-y divide-slate-100">
                                        {pendingEvents.slice(0, 5).map((event) => (
                                            <div key={event.id} className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
                                                <div className="min-w-0 flex-1">
                                                    <span className="inline-block rounded bg-sky-50 px-2 py-0.5 text-[9px] font-extrabold tracking-wider text-sky-700 uppercase">
                                                        {formatarDataHora(event.data_inicio)}
                                                    </span>
                                                    <h4 className="mt-2 text-sm font-bold text-slate-800 truncate">{event.titulo}</h4>
                                                    {event.descricao && (
                                                        <p className="mt-1 text-xs text-slate-400 truncate max-w-xl">{event.descricao.replace(/local\s*:/i, "Local:").split("\n")[0]}</p>
                                                    )}
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => setSelection({ type: "agenda", agendaId: event.id })}
                                                    className="inline-flex items-center gap-1.5 self-start rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white transition-all hover:bg-primary-hover active:scale-[0.97] focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                                                >
                                                    Criar Briefing
                                                    <ChevronRight className="h-3.5 w-3.5" />
                                                </button>
                                            </div>
                                        ))}
                                        {pendingEvents.length === 0 && (
                                            <div className="py-8 text-center text-sm text-slate-400">
                                                Todos os compromissos agendados já possuem briefings associados! 🎉
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </section>
                </section>
            </main>

            {createModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 backdrop-blur-[2px]">
                    <div className="w-full max-w-2xl rounded-[28px] border border-slate-200 bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                                    Novo Documento
                                </p>
                                <h2 className="mt-2 text-2xl font-bold text-slate-900">
                                    Escolha como criar o briefing
                                </h2>
                                <p className="mt-2 text-sm leading-7 text-slate-500">
                                    Associe o briefing a uma pauta existente da agenda global ou crie um briefing livre independente.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    setCreateModalOpen(false);
                                    setCreateMode(null);
                                }}
                                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition-all hover:bg-slate-50"
                                aria-label="Fechar modal"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        <div className="mt-6 grid gap-4 md:grid-cols-2">
                            <button
                                type="button"
                                onClick={() => setCreateMode("agenda")}
                                className={`rounded-3xl border px-5 py-5 text-left transition-all ${
                                    createMode === "agenda"
                                        ? "border-slate-900 bg-slate-900 text-white shadow-md"
                                        : "border-slate-200 bg-slate-50 text-slate-900 hover:border-slate-300 hover:bg-white"
                                }`}
                            >
                                <CalendarClock className={`h-5 w-5 ${createMode === "agenda" ? "text-white" : "text-slate-650"}`} />
                                <h3 className="mt-4 text-base font-bold">Vincular a evento da agenda</h3>
                                <p className={`mt-2 text-sm leading-6 ${createMode === "agenda" ? "text-white/75" : "text-slate-500"}`}>
                                    Associa o briefing a um compromisso oficial, herdando data, hora e título automaticamente.
                                </p>
                            </button>

                            <button
                                type="button"
                                onClick={() => setCreateMode("independente")}
                                className={`rounded-3xl border px-5 py-5 text-left transition-all ${
                                    createMode === "independente"
                                        ? "border-slate-900 bg-slate-900 text-white shadow-md"
                                        : "border-slate-200 bg-slate-50 text-slate-900 hover:border-slate-300 hover:bg-white"
                                }`}
                            >
                                <Files className={`h-5 w-5 ${createMode === "independente" ? "text-white" : "text-slate-650"}`} />
                                <h3 className="mt-4 text-base font-bold">Criar briefing livre</h3>
                                <p className={`mt-2 text-sm leading-6 ${createMode === "independente" ? "text-white/75" : "text-slate-500"}`}>
                                    Cria um briefing autônomo sem vinculação com a agenda global para agendas extras.
                                </p>
                            </button>
                        </div>

                        {createMode === "agenda" && (
                            <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 p-5">
                                <label className="block">
                                    <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                                        Selecione o compromisso
                                    </span>
                                    <select
                                        value={effectivePendingAgendaId}
                                        onChange={(event) => setPendingAgendaId(event.target.value)}
                                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-sm text-slate-800 outline-none transition-all focus:border-slate-900 focus:ring-2 focus:ring-slate-900/5"
                                    >
                                        <option value="">Selecione uma pauta pendente</option>
                                        {pendingEvents.map((event) => (
                                            <option key={event.id} value={event.id}>
                                                {event.titulo} · {formatarDataHora(event.data_inicio)}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                            </div>
                        )}

                        <div className="mt-6 flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => {
                                    setCreateModalOpen(false);
                                    setCreateMode(null);
                                }}
                                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition-all hover:bg-slate-50"
                            >
                                Cancelar
                            </button>
                            {createMode === "agenda" ? (
                                <button
                                    type="button"
                                    onClick={confirmarBriefingAgenda}
                                    className="rounded-2xl bg-primary px-5 py-3 text-sm font-bold text-white transition-all hover:bg-primary-hover active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                                >
                                    Abrir Formulário
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    onClick={iniciarBriefingIndependente}
                                    disabled={createMode !== "independente"}
                                    className="rounded-2xl bg-primary px-5 py-3 text-sm font-bold text-white transition-all hover:bg-primary-hover active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    Criar Briefing Livre
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <ToastContainer
                toasts={toasts}
                onRemove={(id) => setToasts((prev) => prev.filter((toast) => toast.id !== id))}
            />
        </div>
    );
}
