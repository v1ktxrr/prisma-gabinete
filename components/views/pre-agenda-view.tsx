"use client";

import { startTransition, useCallback, useEffect, useMemo, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import ptBrLocale from "@fullcalendar/core/locales/pt-br";
import type { EventClickArg, EventInput } from "@fullcalendar/core";
import {
  ArrowRight,
  CalendarDays,
  Clock3,
  Loader2,
  MapPin,
  PencilLine,
  RefreshCw,
  ShieldCheck,
  X,
  Search,
  Check,
  Trash2 } from
"lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { usePermissions } from "@/hooks/usePermissions";
import CreateEventModal, {
  AgendaEventFormData } from
"@/components/agenda/create-event-modal";
import CRMAlertBanner from "@/components/ui/crm-alert-banner";


type AgendaGlobalRow = {
  id: string;
  titulo: string;
  descricao: string | null;
  data_inicio: string | null;
  data_fim: string | null;
  status: string;
  tipo_agenda: string;
  event_type: string | null;
  tema: string | null;
  created_by: string | null;
  post_url: string | null;
  registro_status: string;
  task_assignments?: {user_id: string;activity_type: string;}[];
  is_agenda_oficial?: boolean;
  municipio_id?: string | null;
};

type AgendaGlobalEvent = {
  id: string;
  title: string;
  start: string | null;
  end: string | null;
  local: string;
  descricao: string | null;
  status: string;
  event_type: string | null;
  tema: string | null;
  created_by: string | null;
  post_url: string | null;
  tipo_agenda: string;
  checkedIn?: boolean;
  is_agenda_oficial: boolean;
  municipio_id: string | null;
};

function extrairDadosOficiais(descricao: string | null) {
  if (!descricao) {
    return {
      local: "Local não informado",
      descricao: null
    };
  }

  const linhas = descricao.
  split("\n").
  map((linha) => linha.trim()).
  filter(Boolean);

  const linhaComLocal = linhas.find((linha) => /^local\s*:/i.test(linha));
  const local = linhaComLocal ?
  linhaComLocal.replace(/^local\s*:/i, "").trim() || "Local não informado" :
  "Local não informado";
  const descricaoSemLocal = linhas.
  filter((linha) => !/^local\s*:/i.test(linha)).
  join("\n\n").
  trim();

  return {
    local,
    descricao: descricaoSemLocal || null
  };
}

function formatarHorario(iso: string | null) {
  if (!iso) return "Horário não informado";

  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return "Horário não informado";

  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(data);
}

function formatarDataLonga(iso: string | null) {
  if (!iso) return "Data não informada";

  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return "Data não informada";

  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric"
  }).format(data);
}

function getMapsSearchUrl(local: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(local)}`;
}

function mesmoDia(evento: AgendaGlobalEvent, referencia: Date) {
  if (!evento.start) return false;

  const data = new Date(evento.start);
  return (
    data.getFullYear() === referencia.getFullYear() &&
    data.getMonth() === referencia.getMonth() &&
    data.getDate() === referencia.getDate());

}

function toAgendaFormData(evento: AgendaGlobalEvent): AgendaEventFormData {
  return {
    id: evento.id,
    titulo: evento.title,
    local: evento.local,
    descricao: evento.descricao || "",
    data_inicio: evento.start || "",
    data_fim: evento.end || ""
  };
}

function mapAgendaGlobalRow(row: AgendaGlobalRow, currentUserId?: string): AgendaGlobalEvent {
  const dadosOficiais = extrairDadosOficiais(row.descricao);

  const checkedIn = currentUserId && row.task_assignments ?
  row.task_assignments.some((assign) => assign.user_id === currentUserId && assign.activity_type === 'captacao') :
  false;

  return {
    id: row.id,
    title: row.titulo,
    start: row.data_inicio,
    end: row.data_fim,
    local: dadosOficiais.local,
    descricao: dadosOficiais.descricao,
    status: row.status,
    event_type: row.event_type,
    tema: row.tema,
    created_by: row.created_by,
    post_url: row.post_url,
    tipo_agenda: row.tipo_agenda,
    checkedIn,
    is_agenda_oficial: row.is_agenda_oficial ?? false,
    municipio_id: row.municipio_id ?? null
  };
}

function obterDataFimExibicao(startStr: string | null, endStr: string | null): string | undefined {
  if (!startStr) return undefined;
  if (!endStr || startStr === endStr) {
    const start = new Date(startStr);
    if (Number.isNaN(start.getTime())) return undefined;

    // Check if startStr has time component (e.g. contains 'T' or ':')
    const hasTime = startStr.includes("T") || startStr.includes(":");
    if (hasTime) {
      // Add 1 hour
      const end = new Date(start.getTime() + 60 * 60 * 1000);
      return end.toISOString();
    }
  }
  return endStr || undefined;
}

const isEventFuture = (startStr: string | null) => {
  if (!startStr) return false;
  return new Date(startStr) > new Date();
};

const BRAND_INDIGO_COLOR = {
  bg: "bg-indigo-50/70",
  border: "border-indigo-100",
  text: "text-indigo-650",
  bgHex: "#eef2ff",
  borderHex: "#cbd5e1",
  textHex: "#165cfb",
  label: "Compromisso"
};

function getEventColor(evento?: {event_type: string | null;status: string;}) {
  return BRAND_INDIGO_COLOR;
}

function DetalhesEventoModal({
  evento,
  canCheckIn,
  canEdit,
  canViewBriefing,
  checkInLoading,
  deleteLoading,
  isSecretariaOuChefia,
  toggleLoading,
  onToggleAgendaOficial,
  onClose,
  onCheckIn,
  onEdit,
  onDelete,
  onBridgeToCommunication
}: {evento: AgendaGlobalEvent;canCheckIn: boolean;canEdit: boolean;canViewBriefing: boolean;checkInLoading: boolean;deleteLoading: boolean;isSecretariaOuChefia: boolean;toggleLoading: boolean;onToggleAgendaOficial: (valor: boolean) => Promise<void>;onClose: () => void;onCheckIn: () => Promise<void>;onEdit: () => void;onDelete: () => Promise<void>;onBridgeToCommunication: () => void;}) {
  const color = getEventColor(evento);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-md">
            <div className="w-full max-w-xl overflow-hidden rounded-[32px] border border-slate-200/85 bg-white shadow-[0_25px_80px_-30px_rgba(15,23,42,0.45)] animate-in fade-in zoom-in-95 duration-200">
                <div className="border-b border-slate-100 bg-slate-50/50 px-6 py-5">
                    <div className="flex items-start justify-between gap-4">
                        <div className="space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="text-[10px] font-extrabold uppercase tracking-[0.24em] text-slate-400">
                                    Pré-Agenda
                                </span>
                                <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider ${
                evento.status === 'publicado' ?
                'bg-emerald-50 text-emerald-800 border-emerald-200/60' :
                'bg-amber-50 text-amber-800 border-amber-200/60'}`
                }>
                                    {evento.status === 'publicado' ? 'Confirmado' : 'Pendente'}
                                </span>
                                {evento.is_agenda_oficial &&
                <span className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-amber-800 shadow-sm animate-pulse">
                                        ★ Agenda Oficial do Titular
                                    </span>
                }
                            </div>
                            <h2 className="text-xl font-bold tracking-tight text-slate-900 leading-snug">
                                {evento.title}
                            </h2>
                        </div>
                        <button
              type="button"
              onClick={onClose}
              className="rounded-full p-2 text-slate-400 transition-all hover:bg-slate-150 hover:text-slate-700 cursor-pointer active:scale-95">
              
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                </div>

                <div className="space-y-6 px-6 py-6">
                    <div className="grid gap-3 rounded-2xl border border-slate-100 bg-slate-50/40 p-4 sm:grid-cols-2">
                        <div className="rounded-xl bg-white p-3.5 border border-slate-200/50 shadow-sm">
                            <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">
                                Horário
                            </span>
                            <p className="mt-1.5 flex items-center gap-2 text-sm font-semibold text-slate-800">
                                <Clock3 className="h-4 w-4 text-indigo-500" />
                                {formatarHorario(evento.start)}
                            </p>
                        </div>
                        <div className="rounded-xl bg-white p-3.5 border border-slate-200/50 shadow-sm">
                            <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">
                                Local
                            </span>
                            {evento.local && evento.local !== "Local não informado" ?
              <a
                href={getMapsSearchUrl(evento.local)}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1.5 inline-flex items-center gap-2 text-sm font-semibold text-sky-700 transition-all hover:text-sky-850 hover:underline">
                
                                    <MapPin className="h-4 w-4 text-sky-600" />
                                    {evento.local}
                                </a> :

              <p className="mt-1.5 flex items-center gap-2 text-sm font-medium text-slate-500">
                                    <MapPin className="h-4 w-4 text-slate-400" />
                                    Local não informado
                                </p>
              }
                        </div>
                    </div>

                    {evento.tema &&
          <div className="rounded-2xl border border-slate-200/60 bg-white p-4">
                            <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">
                                Tema do Compromisso
                            </span>
                            <p className="mt-1 text-sm font-semibold text-slate-800">
                                {evento.tema}
                            </p>
                        </div>
          }

                    <div className="rounded-2xl border border-slate-200/60 bg-white p-4">
                        <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">
                            Informações oficiais
                        </span>
                        <p className="mt-2 text-sm leading-relaxed text-slate-650 whitespace-pre-line">
                            {evento.descricao || "Sem informações adicionais."}
                        </p>
                    </div>

                    {evento.municipio_id && (
                        <CRMAlertBanner municipioId={evento.municipio_id} />
                    )}

                    {isSecretariaOuChefia &&
          <div className="flex items-center justify-between rounded-2xl border border-indigo-100 bg-indigo-50/30 p-4 shadow-sm">
                            <div className="space-y-0.5">
                                <label htmlFor="toggle-agenda-oficial" className="text-xs font-bold text-slate-800">
                                    Confirmar na Agenda Oficial
                                </label>
                                <p className="text-[11px] text-slate-500 leading-normal">
                                    Define este evento como oficial e visível nos destaques do Titular.
                                </p>
                            </div>
                            <button
              id="toggle-agenda-oficial"
              type="button"
              disabled={toggleLoading}
              onClick={() => void onToggleAgendaOficial(!evento.is_agenda_oficial)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2 disabled:opacity-50 ${
              evento.is_agenda_oficial ? "bg-indigo-600" : "bg-slate-200"}`
              }
              role="switch"
              aria-checked={evento.is_agenda_oficial}>
              
                                <span
                aria-hidden="true"
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                evento.is_agenda_oficial ? "translate-x-5" : "translate-x-0"}`
                } />
              
                            </button>
                        </div>
          }

                    <div className="flex flex-col gap-4 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
                        <div className="text-xs text-slate-400">
                            Data: <span className="font-bold text-slate-600 capitalize">
                                {formatarDataLonga(evento.start)}
                            </span>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            {canEdit &&
              <button
                type="button"
                disabled={deleteLoading}
                onClick={onDelete}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-red-250 bg-red-50 px-4 text-sm font-bold text-red-650 hover:bg-red-100 hover:text-red-750 active:scale-[0.98] transition-all focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60">
                                    {deleteLoading ? (
                                      <Loader2 className="h-4 w-4 animate-spin text-red-500" />
                                    ) : (
                                      <Trash2 className="h-4 w-4" />
                                    )}
                                    Excluir
                                </button>
              }
                            {canEdit &&
              <button
                type="button"
                onClick={onEdit}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-600 hover:bg-slate-50 hover:text-slate-900 active:scale-[0.98] transition-all focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2 cursor-pointer">
                
                                    <PencilLine className="h-4 w-4" />
                                    Editar
                                </button>
              }
                            {canViewBriefing &&
              <button
                type="button"
                onClick={onBridgeToCommunication}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-sky-150 bg-sky-50 px-4 text-sm font-bold text-sky-750 hover:bg-sky-100 active:scale-[0.98] transition-all focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 cursor-pointer">
                
                                    <ArrowRight className="h-4 w-4" />
                                    Briefing
                                </button>
              }
                            {canCheckIn &&
              <button
                type="button"
                onClick={() => void onCheckIn()}
                disabled={checkInLoading || isEventFuture(evento.start)}
                className={`inline-flex h-10 items-center justify-center gap-2 rounded-xl px-5 text-sm font-bold shadow-sm disabled:cursor-not-allowed disabled:opacity-60 active:scale-[0.98] transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 cursor-pointer ${
                isEventFuture(evento.start) ?
                "bg-slate-100 border border-slate-200 text-slate-400 focus:ring-slate-200 cursor-not-allowed opacity-50" :
                evento.checkedIn ?
                "bg-emerald-700 hover:bg-emerald-800 text-white focus:ring-emerald-700" :
                "bg-slate-100 hover:bg-slate-200 text-slate-700 focus:ring-slate-400"}`
                }>
                
                                    {checkInLoading ?
                <Loader2 className="h-4 w-4 animate-spin" /> :
                evento.checkedIn && !isEventFuture(evento.start) ?
                <Check className="h-4 w-4" /> :

                <ShieldCheck className="h-4 w-4" />
                }
                                    {isEventFuture(evento.start) ?
                "Presença indisponível" :
                evento.checkedIn ?
                "Presença confirmada" :
                "Registrar presença"}
                                </button>
              }
                        </div>
                    </div>
                </div>
            </div>
        </div>);

}

export default function PreAgendaView() {
  const { user, profile } = useAuth();
  const { hasModule } = usePermissions();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncingGoogle, setSyncingGoogle] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [eventos, setEventos] = useState<AgendaGlobalEvent[]>([]);
  const [dataSelecionada, setDataSelecionada] = useState(() => new Date());
  const [eventoSelecionado, setEventoSelecionado] = useState<AgendaGlobalEvent | null>(null);
  const [editorAberto, setEditorAberto] = useState(false);
  const [eventoEmEdicao, setEventoEmEdicao] = useState<AgendaEventFormData | undefined>(undefined);
  const [checkInLoading, setCheckInLoading] = useState(false);
  const [toggleLoading, setToggleLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<'todos' | 'presenca' | 'oficial'>('todos');
  const [searchQuery, setSearchQuery] = useState("");

  // Tooltip state
  const [tooltip, setTooltip] = useState<{
    evento: AgendaGlobalEvent;
    x: number;
    y: number;
  } | null>(null);

  // Sidebar inline check-in loading state
  const [checkInEventLoadingId, setCheckInEventLoadingId] = useState<string | null>(null);

  const canEdit = hasModule("agenda_global_editar");
  const canCheckIn = hasModule("agenda_global_presenca");
  const canViewBriefing = hasModule("agenda_comunicacao_ver");

  const carregarEventos = useCallback(async () => {
    if (!user) {
      setEventos([]);
      setLoading(false);
      return;
    }

    setError(null);

    try {
      const { data, error: eventosError } = await supabase.
      from("tasks").
      select(`
                    id, titulo, descricao, data_inicio, data_fim, status, tipo_agenda, event_type, tema, created_by, post_url, registro_status, is_agenda_oficial, municipio_id,
                    task_assignments(user_id, activity_type)
                `).
      eq("registro_status", "ativo").
      eq("tipo_agenda", "GLOBAL").
      order("data_inicio", { ascending: true }).
      limit(1000);

      if (eventosError) {
        throw eventosError;
      }

      const rows = data as AgendaGlobalRow[] | null ?? [];
      const agendaGlobal = rows.map((row) => mapAgendaGlobalRow(row, user?.id));

      setEventos(agendaGlobal);
    } catch (err) {
       console.error("[PreAgenda] Falha ao buscar eventos:", err);
      setError("Não consegui carregar a pré-agenda compartilhada.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void carregarEventos();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [carregarEventos]);

  // Sincronização automática silenciosa da agenda em segundo plano ao abrir a página
  useEffect(() => {
    if (user && canEdit) {
      const now = Date.now();
      const lastSync = sessionStorage.getItem("last_pre_agenda_sync");
      // Executa no máximo uma vez a cada 5 minutos por sessão/aba de navegação
      if (!lastSync || now - parseInt(lastSync, 10) > 5 * 60 * 1000) {
        sessionStorage.setItem("last_pre_agenda_sync", now.toString());
        fetch("/api/pre-agenda/sync")
          .then((res) => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res.json();
          })
          .then((result) => {
            if (result.success && result.syncedCount > 0) {
              void carregarEventos();
            }
          })
          .catch((err) => {
            console.error("[PreAgenda] Erro na sincronização automática em segundo plano:", err);
          });
      }
    }
  }, [user, canEdit, carregarEventos]);

  useEffect(() => {
    if (!feedback) return;

    const timeoutId = window.setTimeout(() => setFeedback(null), 3500);
    return () => window.clearTimeout(timeoutId);
  }, [feedback]);

  const eventosFiltrados = useMemo(() => {
    return eventos.filter((e) => {
      const matchesSearch =
      e.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.local.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (e.descricao || "").toLowerCase().includes(searchQuery.toLowerCase());

      let matchesFilter = true;
      if (statusFilter === "presenca") {
        matchesFilter = !!e.checkedIn;
      } else if (statusFilter === "oficial") {
        matchesFilter = !!e.is_agenda_oficial;
      }

      return matchesSearch && matchesFilter;
    });
  }, [eventos, statusFilter, searchQuery]);

  const eventosCalendar = useMemo<EventInput[]>(
    () =>
    eventosFiltrados.map((evento) => {
      const color = getEventColor(evento);
      const hasCheckedIn = evento.checkedIn;
      const isOficial = evento.is_agenda_oficial;

      let backgroundColor = color.bgHex;
      let borderColor = color.borderHex;
      let textColor = color.textHex;

      if (hasCheckedIn) {
        backgroundColor = "#f0fdf4";
        borderColor = "#34d399";
        textColor = "#065f46";
      } else if (!isOficial) {
        backgroundColor = "#f8fafc";
        borderColor = "#cbd5e1";
        textColor = "#64748b";
      } else {
        backgroundColor = "#4f46e5";
        borderColor = "#3730a3";
        textColor = "#ffffff";
      }

      return {
        id: evento.id,
        title: evento.title,
        start: evento.start || undefined,
        end: obterDataFimExibicao(evento.start, evento.end),
        backgroundColor,
        borderColor,
        textColor,
        extendedProps: {
          ...evento,
          color
        }
      };
    }),
    [eventosFiltrados]
  );

  const eventosDoDia = useMemo(
    () =>
    eventosFiltrados.
    filter((evento) => mesmoDia(evento, dataSelecionada)).
    sort((a, b) => (a.start || "").localeCompare(b.start || "")),
    [dataSelecionada, eventosFiltrados]
  );

  const abrirCriacao = () => {
    setEventoEmEdicao(undefined);
    setEditorAberto(true);
  };

  const abrirEdicao = (evento: AgendaGlobalEvent) => {
    setEventoEmEdicao(toAgendaFormData(evento));
    setEditorAberto(true);
  };

  const registrarCheckIn = async () => {
    if (!user || !eventoSelecionado) return;

    setCheckInLoading(true);
    try {
      if (eventoSelecionado.checkedIn) {
        // Remove presence
        const { error: deleteError } = await supabase.
        from("task_assignments").
        delete().
        eq("task_id", eventoSelecionado.id).
        eq("user_id", user.id).
        eq("activity_type", "captacao");

        if (deleteError) throw deleteError;

        setFeedback("Presença removida.");
        setEventoSelecionado((prev) => prev ? { ...prev, checkedIn: false } : null);
      } else {
        // Add presence
        const { error: deleteError } = await supabase.
        from("task_assignments").
        delete().
        eq("task_id", eventoSelecionado.id).
        eq("user_id", user.id).
        eq("activity_type", "captacao");

        if (deleteError) throw deleteError;

        const { error: insertError } = await supabase.
        from("task_assignments").
        insert({
          task_id: eventoSelecionado.id,
          user_id: user.id,
          name: profile?.nome || null,
          activity_type: "captacao"
        });

        if (insertError) throw insertError;

        setFeedback("Presença registrada.");
        setEventoSelecionado((prev) => prev ? { ...prev, checkedIn: true } : null);
      }
      await carregarEventos();
    } catch (err) {
      console.error("[AgendaGlobal] Falha ao alternar check-in:", err);
      setFeedback("Não consegui alterar a presença.");
    } finally {
      setCheckInLoading(false);
    }
  };

  const handleToggleAgendaOficial = async (eventoId: string, novoValor: boolean) => {
    if (!user) return;

    setToggleLoading(true);
    try {
      const { error: updateError } = await supabase.
      from("tasks").
      update({ is_agenda_oficial: novoValor }).
      eq("id", eventoId);

      if (updateError) throw updateError;

      setFeedback(novoValor ? "Confirmado na Agenda Oficial do Titular." : "Removido da Agenda Oficial.");

      if (eventoSelecionado && eventoSelecionado.id === eventoId) {
        setEventoSelecionado((prev) => prev ? { ...prev, is_agenda_oficial: novoValor } : null);
      }

      await carregarEventos();
    } catch (err) {
      console.error("[AgendaGlobal] Falha ao alternar Agenda Oficial:", err);
      setFeedback("Não foi possível alterar o status da Agenda Oficial.");
    } finally {
      setToggleLoading(false);
    }
  };

  const handleExcluirEvento = async (eventoId: string) => {
    if (!window.confirm("Tem certeza que deseja excluir este evento da pré-agenda?")) {
      return;
    }

    setDeleteLoading(true);
    try {
      const { error: deleteError } = await supabase
        .from("tasks")
        .delete()
        .eq("id", eventoId);

      if (deleteError) throw deleteError;

      setFeedback("Evento excluído da pré-agenda com sucesso.");
      setEventoSelecionado(null);
      await carregarEventos();
    } catch (err) {
      console.error("[PreAgenda] Falha ao excluir evento:", err);
      setFeedback("Não foi possível excluir o evento.");
    } finally {
      setDeleteLoading(false);
    }
  };

  // Inline check-in directly from the sidebar card
  const handleInlineCheckIn = async (evento: AgendaGlobalEvent, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent opening details modal
    if (!user) return;

    setCheckInEventLoadingId(evento.id);
    try {
      if (evento.checkedIn) {
        // Remove presence
        const { error: deleteError } = await supabase.
        from("task_assignments").
        delete().
        eq("task_id", evento.id).
        eq("user_id", user.id).
        eq("activity_type", "captacao");

        if (deleteError) throw deleteError;

        setFeedback("Presença removida com sucesso.");
      } else {
        // Add presence
        const { error: deleteError } = await supabase.
        from("task_assignments").
        delete().
        eq("task_id", evento.id).
        eq("user_id", user.id).
        eq("activity_type", "captacao");

        if (deleteError) throw deleteError;

        const { error: insertError } = await supabase.
        from("task_assignments").
        insert({
          task_id: evento.id,
          user_id: user.id,
          name: profile?.nome || null,
          activity_type: "captacao"
        });

        if (insertError) throw insertError;

        setFeedback("Check-in registrado com sucesso.");
      }
      await carregarEventos();
    } catch (err) {
      console.error("[AgendaGlobal] Falha ao alternar check-in rápido:", err);
      setFeedback("Não consegui alterar a presença.");
    } finally {
      setCheckInEventLoadingId(null);
    }
  };

  const irParaAgendaComunicacao = () => {
    window.location.href = "/briefings";
  };

  const sincronizarAgendaGoogle = () => {
    setSyncingGoogle(true);
    fetch("/api/pre-agenda/sync")
      .then(async (res) => {
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `Erro HTTP ${res.status}`);
        }
        return res.json();
      })
      .then(async (result) => {
        if (!result.success) {
          setFeedback(result.error || "Erro na sincronização.");
          return;
        }

        setLoading(true);
        await carregarEventos();
        setFeedback(
          result.syncedCount === 1 ?
          "1 evento sincronizado." :
          `${result.syncedCount} eventos sincronizados.`
        );
      })
      .catch((err) => {
        console.error("[PreAgenda] Erro ao sincronizar:", err);
        setFeedback(err instanceof Error ? err.message : "Não consegui sincronizar a agenda do Google.");
      })
      .finally(() => {
        setSyncingGoogle(false);
      });
  };

  let tooltipLeft = tooltip ? tooltip.x : 0;
  if (tooltip && typeof window !== "undefined") {
    const margin = 160;
    if (tooltipLeft < margin) tooltipLeft = margin;
    if (tooltipLeft > window.innerWidth - margin) tooltipLeft = window.innerWidth - margin;
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(15,76,129,0.06),_transparent_40%),linear-gradient(180deg,#f8fafc_0%,#f1f5f9_100%)]">
            {feedback &&
      <div className="fixed right-5 top-5 z-[100] rounded-2xl border border-emerald-200 bg-white/95 px-4 py-3 text-sm font-semibold text-emerald-700 shadow-xl backdrop-blur-md animate-in fade-in slide-in-from-top-4 duration-300">
                    {feedback}
                </div>
      }

            <header className="border-b border-slate-200/80 bg-white/80 backdrop-blur-xl">
                <div className="w-full flex flex-col gap-4 px-4 py-5 md:flex-row md:items-center md:justify-between md:px-6 lg:px-8">
                    <div>
                        <div className="flex flex-wrap items-center gap-2">
                            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-slate-400">
                                Pré-Agenda
                            </p>
                            <span className="inline-flex items-center rounded-full bg-indigo-50 border border-indigo-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-indigo-600">
                                Compartilhada
                            </span>
                        </div>
                        <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
                            Pré-Agenda
                        </h1>
                        <p className="mt-1 max-w-2xl text-xs sm:text-sm text-slate-500 leading-relaxed">
                            Visualização limpa para acompanhar compromissos, deslocamentos e cobertura de campo.
                        </p>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                        <button
              type="button"
              onClick={() => {
                setRefreshing(true);
                setLoading(true);
                void carregarEventos();
              }}
              className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-slate-250 bg-white px-3 text-[11px] font-bold text-slate-750 hover:bg-slate-50 hover:text-slate-955 hover:border-slate-350 active:scale-95 transition-all focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2 cursor-pointer">
              
                            <RefreshCw className={`h-3 w-3 text-slate-400 ${refreshing ? "animate-spin" : ""}`} />
                            Atualizar
                        </button>
                        {canEdit &&
            <button
              type="button"
              onClick={sincronizarAgendaGoogle}
              disabled={syncingGoogle}
              className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-slate-250 bg-white px-3 text-[11px] font-bold text-slate-755 hover:bg-slate-50 hover:text-slate-955 hover:border-slate-350 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 transition-all focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2 cursor-pointer">
              
                                {syncingGoogle ?
              <Loader2 className="h-3 w-3 animate-spin text-slate-400" /> :

              <RefreshCw className="h-3 w-3 text-slate-450" />
              }
                                {syncingGoogle ? "Sincronizando..." : "Sincronizar Google"}
                            </button>
            }
                        {canEdit &&
            <button
              type="button"
              onClick={abrirCriacao}
              className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 text-[11px] font-bold text-white hover:bg-primary-hover active:scale-95 transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 cursor-pointer">
              
                                <CalendarDays className="h-3 w-3 text-white" />
                                Nova Pauta
                            </button>
            }
                    </div>
                </div>
            </header>

            <main className="w-full gap-6 px-4 py-6 md:px-6 lg:px-8 flex flex-col">
                <section className="overflow-hidden rounded-[30px] border border-slate-200/80 bg-white p-4 shadow-[0_18px_50px_-30px_rgba(15,23,42,0.2)] md:p-6 flex flex-col gap-4">
                    {/* Horizontal Filter Bar */}
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4">
                        {/* Search Input */}
                        <div className="relative flex-1 max-w-md">
                            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                            <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar compromisso ou local..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-10 py-2.5 text-xs text-slate-800 outline-none transition-all focus:border-slate-900 focus:bg-white focus:ring-2 focus:ring-slate-900/5" />
              
                            {searchQuery &&
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-655"
                aria-label="Limpar busca">
                
                                    <X className="h-4 w-4" />
                                </button>
              }
                        </div>

                        {/* Status Filter Segmented Control */}
                        <div className="flex rounded-xl border border-slate-100 bg-slate-50 p-1">
                            {[
              { id: "todos", label: "Todos" },
              { id: "presenca", label: "Estive presente" },
              { id: "oficial", label: "Agenda Oficial" }].
              map((tab) => {
                const active = statusFilter === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setStatusFilter(tab.id as typeof statusFilter)}
                    className={`rounded-lg py-1.5 px-3.5 text-[10px] font-extrabold uppercase tracking-wider transition-all cursor-pointer focus:outline-none ${
                    active ?
                    "bg-slate-900 text-white shadow-sm" :
                    "text-slate-500 hover:bg-slate-100 hover:text-slate-950"}`
                    }>
                    
                                        {tab.label}
                                    </button>);

              })}
                        </div>
                    </div>

                    <div className="relative">
                        {loading ?
            <div className="flex min-h-[520px] items-center justify-center">
                                <Loader2 className="h-8 w-8 animate-spin text-slate-350" />
                            </div> :

            <FullCalendar
              plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
              locale={ptBrLocale}
              initialView="dayGridMonth"
              headerToolbar={{
                left: "prev,next today",
                center: "title",
                right: "dayGridMonth,timeGridWeek"
              }}
              buttonText={{
                today: "Hoje",
                month: "Mês",
                week: "Semana"
              }}
              events={eventosCalendar}
              height="auto"
              dateClick={(arg) => setDataSelecionada(arg.date)}
              eventClick={(arg: EventClickArg) => {
                const evento = arg.event.extendedProps as AgendaGlobalEvent;
                setEventoSelecionado(evento);
              }}
              datesSet={(arg) => {
                if (arg.view.currentStart) {
                  setDataSelecionada(arg.view.currentStart);
                }
              }}
              eventMouseEnter={(info) => {
                const rect = info.el.getBoundingClientRect();
                setTooltip({
                  evento: info.event.extendedProps as AgendaGlobalEvent,
                  x: rect.left + rect.width / 2,
                  y: rect.top - 8
                });
              }}
              eventMouseLeave={() => {
                setTooltip(null);
              }}
              eventClassNames={(arg) => {
                const isOficial = arg.event.extendedProps.is_agenda_oficial;
                return isOficial ? "fc-event-oficial" : "fc-event-inbox";
              }}
              eventContent={(arg) => {
                const checkedIn = arg.event.extendedProps.checkedIn;
                const isOficial = arg.event.extendedProps.is_agenda_oficial;
                return (
                  <div className="truncate px-1.5 py-0.5 text-[11px] font-semibold tracking-wide flex items-center justify-between gap-1 w-full">
                                            <span className="truncate flex items-center gap-1">
                                                {isOficial &&
                      <span className="text-amber-500 font-bold drop-shadow-sm shrink-0">★</span>
                      }
                                                <span className="truncate">
                                                    {arg.timeText ? `${arg.timeText} ` : ""}
                                                    {arg.event.title}
                                                </span>
                                            </span>
                                            {checkedIn &&
                    <Check className="h-3 w-3 shrink-0" />
                    }
                                        </div>);

              }}
              dayMaxEvents={3}
              fixedWeekCount={false}
              eventDisplay="block"
              noEventsText="Sem compromissos" />

            }
                    </div>

                    {error &&
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-750">
                            {error}
                        </div>
          }
                </section>

                






















































































































        
            </main>

            {eventoSelecionado &&
      <DetalhesEventoModal
        evento={eventoSelecionado}
        canCheckIn={canCheckIn}
        canEdit={canEdit}
        canViewBriefing={canViewBriefing}
        checkInLoading={checkInLoading}
        deleteLoading={deleteLoading}
        isSecretariaOuChefia={profile?.cargo === "secretaria" || profile?.cargo === "chefia"}
        toggleLoading={toggleLoading}
        onToggleAgendaOficial={(valor) => handleToggleAgendaOficial(eventoSelecionado.id, valor)}
        onClose={() => setEventoSelecionado(null)}
        onCheckIn={registrarCheckIn}
        onEdit={() => {
          abrirEdicao(eventoSelecionado);
          setEventoSelecionado(null);
        }}
        onDelete={() => handleExcluirEvento(eventoSelecionado.id)}
        onBridgeToCommunication={irParaAgendaComunicacao} />

      }

            {user && editorAberto &&
      <CreateEventModal
        key={eventoEmEdicao?.id ?? "__global-new__"}
        open={editorAberto}
        onClose={() => {
          setEditorAberto(false);
          setEventoEmEdicao(undefined);
        }}
        onSaved={async (message) => {
          setEditorAberto(false);
          setEventoEmEdicao(undefined);
          setLoading(true);
          await carregarEventos();
          setFeedback(message);
        }}
        initialData={eventoEmEdicao}
        canEdit
        tipoAgenda="GLOBAL" />

      }

            {/* Custom styling injected to keep fullcalendar premium */}
            <style>{`
                .fc .fc-button-primary {
                    background-color: #ffffff !important;
                    color: #334155 !important;
                    border: 1px solid #e2e8f0 !important;
                    border-radius: 12px !important;
                    font-size: 0.75rem !important;
                    font-weight: 600 !important;
                    padding: 0.5rem 0.875rem !important;
                    height: 2.25rem !important;
                    display: inline-flex !important;
                    align-items: center !important;
                    justify-content: center !important;
                    transition: all 150ms cubic-bezier(0.4, 0, 0.2, 1) !important;
                    box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.02) !important;
                }
                .fc .fc-button-primary:hover {
                    background-color: #f8fafc !important;
                    border-color: #cbd5e1 !important;
                    color: #0f172a !important;
                }
                .fc .fc-button-active, .fc .fc-button-primary:active {
                    background-color: #f1f5f9 !important;
                    border-color: #cbd5e1 !important;
                    color: #0f172a !important;
                    box-shadow: inset 0 1px 2px 0 rgba(0, 0, 0, 0.05) !important;
                }
                .fc-theme-standard td, .fc-theme-standard th {
                    border-color: #f1f5f9 !important;
                }
                .fc .fc-col-header-cell-cushion {
                    font-size: 0.7rem !important;
                    font-weight: 700 !important;
                    text-transform: uppercase !important;
                    letter-spacing: 0.05em !important;
                    color: #64748b !important;
                    padding: 8px 4px !important;
                    text-decoration: none !important;
                }
                .fc-daygrid-day-number {
                    font-size: 0.75rem !important;
                    font-weight: 600 !important;
                    color: #64748b !important;
                    padding: 4px 6px !important;
                    text-decoration: none !important;
                }
                .fc-day-today {
                    background-color: rgba(99, 102, 241, 0.03) !important;
                }
                .fc-day-today .fc-daygrid-day-number {
                    color: #4f46e5 !important;
                    font-weight: 700 !important;
                }
                .fc-event {
                    border-radius: 8px !important;
                    margin: 1px 4px !important;
                    padding: 1px 2px !important;
                    box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.02) !important;
                    cursor: pointer !important;
                    transition: transform 100ms ease, box-shadow 100ms ease !important;
                }
                .fc-event:hover {
                    transform: translateY(-0.5px) !important;
                    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05) !important;
                }
                .fc-event-inbox {
                    border-style: dashed !important;
                    border-width: 1.5px !important;
                    opacity: 0.8 !important;
                }
                .fc-event-oficial {
                    border-style: solid !important;
                    border-width: 2px !important;
                    box-shadow: 0 4px 6px -1px rgba(99, 102, 241, 0.15), 0 2px 4px -2px rgba(99, 102, 241, 0.15) !important;
                }
            `}</style>

            {/* Custom Tooltip render */}
            {tooltip &&
      <div
        style={{
          position: "fixed",
          left: `${tooltipLeft}px`,
          top: `${tooltip.y}px`,
          transform: "translate(-50%, -100%)"
        }}
        className="z-[99] w-72 pointer-events-none rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xl transition-all duration-200 ease-out animate-in fade-in zoom-in-95">
        
                    <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            {formatarHorario(tooltip.evento.start)}
                        </span>
                    </div>
                    <h4 className="mt-2 text-sm font-bold text-slate-900 line-clamp-2">
                        {tooltip.evento.title}
                    </h4>
                    {tooltip.evento.tema &&
        <p className="mt-1 text-[11px] text-slate-500">
                            Tema: <span className="font-semibold text-slate-700">{tooltip.evento.tema}</span>
                        </p>
        }
                    {tooltip.evento.local && tooltip.evento.local !== "Local não informado" &&
        <p className="mt-2 flex items-center gap-1 text-[11px] font-semibold text-sky-700">
                            <MapPin className="h-3 w-3 text-slate-400" />
                            {tooltip.evento.local}
                        </p>
        }
                    {tooltip.evento.descricao &&
        <p className="mt-2 border-t border-slate-100 pt-2 text-[11px] leading-relaxed text-slate-500 line-clamp-3">
                            {tooltip.evento.descricao}
                        </p>
        }
                </div>
      }
        </div>);

}