"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CalendarDays,
  Clock,
  Loader2,
  MapPin,
  Plus,
  Printer,
  RefreshCw,
  User,
  CheckCircle,
  X,
  Cake
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { usePermissions } from "@/hooks/usePermissions";

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
  is_agenda_oficial?: boolean;
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
  tipo_agenda: string;
  is_agenda_oficial: boolean;
};

// Birthdays are fetched from DB in Phase 3

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

function mapAgendaGlobalRow(row: AgendaGlobalRow): AgendaGlobalEvent {
  const dadosOficiais = extrairDadosOficiais(row.descricao);

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
    tipo_agenda: row.tipo_agenda,
    is_agenda_oficial: row.is_agenda_oficial ?? false
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

function formatarDataLonga(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric"
  }).format(date);
}

function mesmoDia(eventoStart: string | null, referencia: Date) {
  if (!eventoStart) return false;
  const data = new Date(eventoStart);
  return (
    data.getFullYear() === referencia.getFullYear() &&
    data.getMonth() === referencia.getMonth() &&
    data.getDate() === referencia.getDate()
  );
}

export default function AgendaOficialView() {
  const { user, profile } = useAuth();
  const { hasModule, unidadeId } = usePermissions();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [eventos, setEventos] = useState<AgendaGlobalEvent[]>([]);
  const [aniversariantes, setAniversariantes] = useState<{ nome: string; cargo: string | null; dia: number; mes: number }[]>([]);
  const [dataSelecionadaStr, setDataSelecionadaStr] = useState(() => {
    // Tomorrow as default
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split("T")[0];
  });
  const [feedback, setFeedback] = useState<string | null>(null);
  const [dragOverZone, setDragOverZone] = useState<"inbox" | "confirmados" | "acontecendo" | null>(null);
  const [draggedCardId, setDraggedCardId] = useState<string | null>(null);

  // Modal State
  const [modalAberto, setModalAberto] = useState(false);
  const [novoTitulo, setNovoTitulo] = useState("");
  const [novoLocal, setNovoLocal] = useState("");
  const [novaDescricao, setNovaDescricao] = useState("");
  const [novaHora, setNovaHora] = useState("09:00");
  const [novoTipo, setNovoTipo] = useState<"agenda_oficial" | "acontecendo">("agenda_oficial");
  const [salvando, setSalvando] = useState(false);

  const dataSelecionada = new Date(`${dataSelecionadaStr}T12:00:00`);

  const carregarEventos = useCallback(async () => {
    if (!user) {
      setEventos([]);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.
        from("tasks").
        select(`
          id, titulo, descricao, data_inicio, data_fim, status, tipo_agenda, event_type, tema, created_by, post_url, registro_status, is_agenda_oficial
        `).
        eq("registro_status", "ativo").
        eq("tipo_agenda", "GLOBAL").
        order("data_inicio", { ascending: true });

      if (error) throw error;

      const { data: bdays, error: bdaysError } = await supabase
        .from("aniversariantes")
        .select("nome, cargo, dia, mes");

      if (bdaysError) throw bdaysError;

      const rows = data as AgendaGlobalRow[] ?? [];
      const mapped = rows.map(mapAgendaGlobalRow);
      setEventos(mapped);
      setAniversariantes(bdays ?? []);
    } catch (err) {
      console.error("[AgendaOficial] Falha ao carregar eventos:", err);
      setFeedback("Não foi possível carregar os compromissos.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  const canEdit =
    hasModule("agenda_global_editar") ||
    profile?.cargo === "chefia" ||
    profile?.cargo === "secretaria";

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void carregarEventos();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [carregarEventos]);

  // Filter events for the selected date
  const eventosDoDia = eventos.filter((e) => mesmoDia(e.start, dataSelecionada));

  // Split into unconfirmed (Pré-Agenda) and confirmed (Oficial / Acontecendo)
  const preAgendaPendentes = eventosDoDia.filter((e) => !e.is_agenda_oficial);
  
  const oficialConfirmados = eventosDoDia.filter(
    (e) => e.is_agenda_oficial && e.event_type === "agenda_oficial"
  );
  
  const oficialAcontecendo = eventosDoDia.filter(
    (e) => e.is_agenda_oficial && e.event_type === "acontecendo"
  );

  // Anniversaries for the day
  const aniversariantesDoDia = aniversariantes.filter(
    (a) => a.dia === dataSelecionada.getDate() && a.mes === (dataSelecionada.getMonth() + 1)
  );

  // Confirm event from Pre-Agenda
  const confirmarEvento = async (eventoId: string) => {
    try {
      const eventoAtual = eventos.find(e => e.id === eventoId);
      const novoTipo = (eventoAtual?.event_type === "acontecendo") ? "acontecendo" : "agenda_oficial";

      const { error } = await supabase.
        from("tasks").
        update({
          is_agenda_oficial: true,
          status: "publicado", // Published in the official feed
          event_type: novoTipo
        }).
        eq("id", eventoId);

      if (error) throw error;

      setFeedback("Compromisso confirmado na Agenda Oficial!");
      setTimeout(() => setFeedback(null), 3000);
      await carregarEventos();
    } catch (err) {
      console.error("[AgendaOficial] Erro ao confirmar evento:", err);
      setFeedback("Erro ao confirmar compromisso.");
    }
  };

  // Remove event from Official Agenda
  const desconfirmarEvento = async (eventoId: string) => {
    try {
      const { error } = await supabase.
        from("tasks").
        update({
          is_agenda_oficial: false,
          status: "pendente"
        }).
        eq("id", eventoId);

      if (error) throw error;

      setFeedback("Compromisso removido da Agenda Oficial.");
      setTimeout(() => setFeedback(null), 3000);
      await carregarEventos();
    } catch (err) {
      console.error("[AgendaOficial] Erro ao desconfirmar evento:", err);
      setFeedback("Erro ao remover compromisso.");
    }
  };

  // Drag and drop event type and confirmation update
  const alterarTipoEvento = async (eventoId: string, novoTipo: "agenda_oficial" | "acontecendo") => {
    try {
      const { error } = await supabase.
        from("tasks").
        update({
          is_agenda_oficial: true,
          status: "publicado",
          event_type: novoTipo
        }).
        eq("id", eventoId);

      if (error) throw error;
      setFeedback(novoTipo === "agenda_oficial" ? "Compromisso confirmado na Agenda Oficial!" : "Compromisso movido para Acontecendo.");
      setTimeout(() => setFeedback(null), 3000);
      void carregarEventos();
    } catch (err) {
      console.error("[AgendaOficial] Falha ao alterar tipo de evento:", err);
      setFeedback("Não foi possível alterar o tipo de evento.");
    }
  };

  // Insert a new event directly to the Official Agenda
  const salvarNovoEvento = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novoTitulo.trim()) return;

    setSalvando(true);
    try {
      const dataInicio = `${dataSelecionadaStr}T${novaHora}:00.000Z`;

      // Build the description putting 'Local: ...' at the top if provided
      const partesDesc = [];
      if (novoLocal.trim()) {
        partesDesc.push(`Local: ${novoLocal.trim()}`);
      }
      if (novaDescricao.trim()) {
        partesDesc.push(novaDescricao.trim());
      }
      const descricaoFinal = partesDesc.join("\n\n") || null;

      const { error } = await supabase.from("tasks").insert({
        titulo: novoTitulo.trim(),
        descricao: descricaoFinal,
        event_type: novoTipo,
        status: "publicado", // Direct insert is confirmed/published
        is_agenda_oficial: true,
        tipo_agenda: "GLOBAL",
        unidade_id: unidadeId ?? "CG",
        registro_status: "ativo",
        data_inicio: dataInicio,
        data_fim: dataInicio,
        created_by: user?.id
      });

      if (error) throw error;

      setFeedback("Evento inserido diretamente na Agenda Oficial!");
      setTimeout(() => setFeedback(null), 3000);
      setModalAberto(false);
      setNovoTitulo("");
      setNovoLocal("");
      setNovaDescricao("");
      setNovaHora("09:00");
      setNovoTipo("agenda_oficial");
      await carregarEventos();
    } catch (err) {
      console.error("[AgendaOficial] Erro ao inserir evento:", err);
      setFeedback("Erro ao salvar o compromisso.");
    } finally {
      setSalvando(false);
    }
  };

  const handlePrint = () => {
    window.open(`/agenda-oficial/print?date=${dataSelecionadaStr}`, "_blank");
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(15,76,129,0.06),_transparent_40%),linear-gradient(180deg,#f8fafc_0%,#f1f5f9_100%)] pb-12">
      {feedback && (
        <div className="fixed right-5 top-5 z-[100] rounded-2xl border border-emerald-200 bg-white/95 px-4 py-3 text-sm font-semibold text-emerald-700 shadow-xl backdrop-blur-md animate-in fade-in slide-in-from-top-4 duration-300">
          {feedback}
        </div>
      )}

      {/* Header */}
      <header className="border-b border-slate-200/80 bg-white/80 backdrop-blur-xl">
        <div className="w-full flex flex-col gap-4 px-4 py-5 md:flex-row md:items-center md:justify-between md:px-6 lg:px-8">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-slate-400">
                Gabinete Virtual
              </p>
              <span className="inline-flex items-center rounded-full bg-slate-900 border border-slate-950 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white">
                Cockpit de Fechamento
              </span>
            </div>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
              Agenda Oficial
            </h1>
            <p className="mt-1 max-w-2xl text-xs sm:text-sm text-slate-500 leading-relaxed">
              Consolide a agenda oficial do dia seguinte. Confirme convites, insira agendas acontecendo e exporte a folha final.
            </p>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => {
                setRefreshing(true);
                void carregarEventos();
              }}
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-250 bg-white px-3.5 text-xs font-bold text-slate-750 hover:bg-slate-50 active:scale-95 transition-all cursor-pointer focus:outline-none"
            >
              <RefreshCw className={`h-3.5 w-3.5 text-slate-400 ${refreshing ? "animate-spin" : ""}`} />
              Atualizar
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-250 bg-white px-3.5 text-xs font-bold text-slate-750 hover:bg-slate-50 active:scale-95 transition-all cursor-pointer focus:outline-none"
            >
              <Printer className="h-3.5 w-3.5 text-slate-400" />
              Imprimir Agenda
            </button>

            {canEdit && (
              <button
                type="button"
                onClick={() => setModalAberto(true)}
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-slate-950 px-4 text-xs font-bold text-white hover:bg-slate-900 active:scale-[0.98] transition-all cursor-pointer focus:outline-none"
              >
                <Plus className="h-3.5 w-3.5" />
                Inserir Direto
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Date Selector & Cockpit Grid */}
      <main className="w-full px-4 mt-6 md:px-6 lg:px-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-slate-200/60 bg-white/70 p-4 shadow-sm backdrop-blur-md mb-6">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-slate-500" />
            <span className="text-sm font-bold text-slate-800">Compilação para:</span>
            <input
              type="date"
              value={dataSelecionadaStr}
              onChange={(e) => {
                setDataSelecionadaStr(e.target.value);
                setLoading(true);
                setTimeout(() => setLoading(false), 300);
              }}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-950 focus:border-transparent"
            />
          </div>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400 sm:text-right">
            {formatarDataLonga(dataSelecionada)}
          </p>
        </div>

        {loading ? (
          <div className="flex h-96 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Left Column: Inbox / Pré-Agenda (Invites / Pendentes) */}
            <section
              onDragOver={(e) => {
                if (canEdit) e.preventDefault();
              }}
              onDragEnter={() => {
                if (canEdit) setDragOverZone("inbox");
              }}
              onDragLeave={() => {
                setDragOverZone(null);
              }}
              onDrop={async (e) => {
                setDragOverZone(null);
                if (!canEdit) return;
                const id = e.dataTransfer.getData("text/plain");
                if (id) {
                  await desconfirmarEvento(id);
                }
              }}
              className={`lg:col-span-5 rounded-2xl border p-5 shadow-sm transition-all duration-300 ${
                dragOverZone === "inbox"
                  ? "border-indigo-400 bg-indigo-50/20 scale-[1.01] shadow-md ring-2 ring-indigo-400/20"
                  : "border-slate-200/80 bg-white"
              }`}
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                <h2 className="text-sm font-black uppercase tracking-wider text-slate-400 flex items-center gap-2">
                  <CalendarDays className="h-4 w-4" />
                  Inbox / Pré-Agenda
                </h2>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600">
                  {preAgendaPendentes.length}
                </span>
              </div>

              {preAgendaPendentes.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="rounded-2xl bg-slate-50 p-4 text-slate-400">
                    <CheckCircle className="h-8 w-8" />
                  </div>
                  <h3 className="mt-4 text-sm font-bold text-slate-700">Nenhuma pendência</h3>
                  <p className="mt-1 text-xs text-slate-400 max-w-xs leading-relaxed">
                    Não há convites pendentes de confirmação na Pré-Agenda para esta data.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {preAgendaPendentes.map((e) => (
                    <div
                      key={e.id}
                      draggable={canEdit}
                      onDragStart={(evt) => {
                        if (canEdit) {
                          setDraggedCardId(e.id);
                          evt.dataTransfer.setData("text/plain", e.id);
                        }
                      }}
                      onDragEnd={() => {
                        setDraggedCardId(null);
                        setDragOverZone(null);
                      }}
                      className={`group relative flex flex-col justify-between rounded-xl border p-4 hover:bg-slate-50 transition-all duration-300 ${
                        draggedCardId === e.id
                          ? "border-dashed border-indigo-350 bg-indigo-50/40 opacity-40 scale-95 shadow-inner"
                          : "border-slate-150 bg-white/50"
                      } ${
                        canEdit ? "cursor-grab active:cursor-grabbing" : ""
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-600">
                            Convite
                          </span>
                          <span className="flex items-center gap-1 text-[10px] font-bold text-slate-400">
                            <Clock className="h-3 w-3" />
                            {formatarHorario(e.start)}
                          </span>
                        </div>
                        <h4 className="mt-2 text-sm font-bold text-slate-900 leading-snug">
                          {e.title}
                        </h4>
                        <div className="mt-2 flex items-start gap-1 text-slate-500">
                          <MapPin className="h-3 w-3 shrink-0 mt-0.5 text-slate-400" />
                          <p className="text-[11px] truncate">{e.local}</p>
                        </div>
                      </div>
                      {canEdit && (
                        <div className="mt-4 border-t border-slate-100 pt-3 flex justify-end">
                          <button
                            type="button"
                            onClick={() => void confirmarEvento(e.id)}
                            className="inline-flex h-8 items-center justify-center gap-1 rounded-lg bg-slate-950 px-3 text-[10px] font-bold text-white hover:bg-slate-900 transition-all cursor-pointer"
                          >
                            Confirmar na Oficial
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Right Column: Agenda Oficial Consolidada */}
            <section className="lg:col-span-7 flex flex-col gap-6">
              {/* Confirmed Agendas */}
              <div
                onDragOver={(e) => {
                  if (canEdit) e.preventDefault();
                }}
                onDragEnter={() => {
                  if (canEdit) setDragOverZone("confirmados");
                }}
                onDragLeave={() => {
                  setDragOverZone(null);
                }}
                onDrop={async (e) => {
                  setDragOverZone(null);
                  if (!canEdit) return;
                  const id = e.dataTransfer.getData("text/plain");
                  if (id) {
                    await alterarTipoEvento(id, "agenda_oficial");
                  }
                }}
                className={`rounded-2xl border p-5 shadow-sm transition-all duration-300 ${
                  dragOverZone === "confirmados"
                    ? "border-slate-800 bg-slate-50 scale-[1.01] shadow-md ring-2 ring-slate-800/10"
                    : "border-slate-200/80 bg-white"
                }`}
              >
                <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                  <h2 className="text-sm font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
                    <User className="h-4 w-4 text-slate-700" />
                    Agendas Confirmadas (Preto)
                  </h2>
                  <span className="rounded-full bg-slate-950 px-2 py-0.5 text-xs font-bold text-white">
                    {oficialConfirmados.length}
                  </span>
                </div>

                {oficialConfirmados.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center text-slate-400">
                    <CalendarDays className="h-8 w-8 text-slate-300" />
                    <p className="mt-3 text-xs">Nenhuma agenda confirmada para esta data.</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {oficialConfirmados.map((item) => (
                      <div
                        key={item.id}
                        draggable={canEdit}
                        onDragStart={(e) => {
                          if (canEdit) {
                            setDraggedCardId(item.id);
                            e.dataTransfer.setData("text/plain", item.id);
                          }
                        }}
                        onDragEnd={() => {
                          setDraggedCardId(null);
                          setDragOverZone(null);
                        }}
                        className={`group flex items-start justify-between rounded-xl border p-4 text-white transition-all duration-300 ${
                          draggedCardId === item.id
                            ? "border-dashed border-slate-700 bg-slate-900/50 opacity-40 scale-95 shadow-inner"
                            : "border-slate-900 bg-slate-950 hover:bg-slate-900 shadow-sm"
                        } ${
                          canEdit ? "cursor-grab active:cursor-grabbing" : ""
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] font-extrabold uppercase tracking-widest text-indigo-400">
                              Confirmado
                            </span>
                            <span className="flex items-center gap-1 text-[10px] font-bold text-slate-400">
                              <Clock className="h-3 w-3" />
                              {formatarHorario(item.start)}
                            </span>
                          </div>
                          <h4 className="mt-1.5 text-sm font-extrabold leading-snug">{item.title}</h4>
                          <div className="mt-2 flex items-start gap-1 text-slate-400">
                            <MapPin className="h-3 w-3 shrink-0 mt-0.5 text-slate-500" />
                            <p className="text-[11px] truncate">{item.local}</p>
                          </div>
                        </div>
                        {canEdit && (
                          <button
                            type="button"
                            onClick={() => void desconfirmarEvento(item.id)}
                            className="ml-3 rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white transition-all cursor-pointer"
                            title="Remover da Agenda Oficial"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Acontecendo (Happening) Agendas */}
              <div
                onDragOver={(e) => {
                  if (canEdit) e.preventDefault();
                }}
                onDragEnter={() => {
                  if (canEdit) setDragOverZone("acontecendo");
                }}
                onDragLeave={() => {
                  setDragOverZone(null);
                }}
                onDrop={async (e) => {
                  setDragOverZone(null);
                  if (!canEdit) return;
                  const id = e.dataTransfer.getData("text/plain");
                  if (id) {
                    await alterarTipoEvento(id, "acontecendo");
                  }
                }}
                className={`rounded-2xl border p-5 shadow-sm transition-all duration-300 ${
                  dragOverZone === "acontecendo"
                    ? "border-blue-400 bg-blue-50/20 scale-[1.01] shadow-md ring-2 ring-blue-400/20"
                    : "border-slate-200/80 bg-white"
                }`}
              >
                <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                  <h2 className="text-sm font-black uppercase tracking-wider text-blue-800 flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 text-blue-600" />
                    Agendas Acontecendo (Azul)
                  </h2>
                  <span className="rounded-full bg-blue-50 border border-blue-200 px-2 py-0.5 text-xs font-bold text-blue-700">
                    {oficialAcontecendo.length}
                  </span>
                </div>

                {oficialAcontecendo.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center text-slate-400">
                    <CalendarDays className="h-8 w-8 text-slate-300" />
                    <p className="mt-3 text-xs">Nenhum evento acontecendo sem o titular registrado.</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {oficialAcontecendo.map((item) => (
                      <div
                        key={item.id}
                        draggable={canEdit}
                        onDragStart={(e) => {
                          if (canEdit) {
                            setDraggedCardId(item.id);
                            e.dataTransfer.setData("text/plain", item.id);
                          }
                        }}
                        onDragEnd={() => {
                          setDraggedCardId(null);
                          setDragOverZone(null);
                        }}
                        className={`group flex items-start justify-between rounded-xl border p-4 text-blue-900 transition-all duration-300 ${
                          draggedCardId === item.id
                            ? "border-dashed border-blue-300 bg-blue-50/30 opacity-40 scale-95 shadow-inner"
                            : "border-blue-200 bg-blue-50/50 hover:bg-blue-50"
                        } ${
                          canEdit ? "cursor-grab active:cursor-grabbing" : ""
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] font-extrabold uppercase tracking-widest text-blue-600">
                              Acontecendo (Sem Titular)
                            </span>
                            <span className="flex items-center gap-1 text-[10px] font-bold text-blue-500">
                              <Clock className="h-3 w-3" />
                              {formatarHorario(item.start)}
                            </span>
                          </div>
                          <h4 className="mt-1.5 text-sm font-extrabold leading-snug">{item.title}</h4>
                          <div className="mt-2 flex items-start gap-1 text-blue-800/80">
                            <MapPin className="h-3 w-3 shrink-0 mt-0.5 text-blue-400" />
                            <p className="text-[11px] truncate">{item.local}</p>
                          </div>
                        </div>
                        {canEdit && (
                          <button
                            type="button"
                            onClick={() => void desconfirmarEvento(item.id)}
                            className="ml-3 rounded-lg p-1 text-blue-400 hover:bg-blue-100 hover:text-blue-700 transition-all cursor-pointer"
                            title="Remover"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Birthdays (Aniversários) */}
              <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                  <h2 className="text-sm font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
                    <Cake className="h-4 w-4 text-pink-500 animate-bounce" />
                    Aniversariantes do Dia
                  </h2>
                  <span className="rounded-full bg-pink-50 border border-pink-200 px-2 py-0.5 text-xs font-bold text-pink-700">
                    {aniversariantesDoDia.length}
                  </span>
                </div>

                {aniversariantesDoDia.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center text-slate-400">
                    <Cake className="h-6 w-6 text-slate-350" />
                    <p className="mt-2 text-xs">Nenhum aniversariante registrado para este dia.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {aniversariantesDoDia.map((a, idx) => (
                      <div key={idx} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-pink-50 text-pink-600">
                          <Cake className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-850">{a.nome}</p>
                          <p className="text-[11px] text-slate-500 font-medium">{a.cargo}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          </div>
        )}
      </main>

      {/* Quick Insert Modal */}
      {modalAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-md">
          <div className="w-full max-w-lg overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="border-b border-slate-100 bg-slate-50/50 px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">Inserir Evento Oficial</h3>
                <p className="text-xs text-slate-500">Adicione diretamente na folha consolidada de fechamento.</p>
              </div>
              <button
                type="button"
                onClick={() => setModalAberto(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={salvarNovoEvento} className="p-6 flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-800">Tipo de Agenda</label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <button
                    type="button"
                    onClick={() => setNovoTipo("agenda_oficial")}
                    className={`rounded-xl border py-2.5 text-center text-xs font-extrabold transition-all cursor-pointer ${
                      novoTipo === "agenda_oficial"
                        ? "bg-slate-950 border-slate-950 text-white"
                        : "bg-white border-slate-200 text-slate-650 hover:bg-slate-50"
                    }`}
                  >
                    🔴 Oficial (Presença do Vice)
                  </button>
                  <button
                    type="button"
                    onClick={() => setNovoTipo("acontecendo")}
                    className={`rounded-xl border py-2.5 text-center text-xs font-extrabold transition-all cursor-pointer ${
                      novoTipo === "acontecendo"
                        ? "bg-blue-600 border-blue-600 text-white"
                        : "bg-white border-slate-200 text-slate-650 hover:bg-slate-50"
                    }`}
                  >
                    🔵 Acontecendo (Sem Vice)
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label htmlFor="modal-titulo" className="text-xs font-bold text-slate-800">Título</label>
                <input
                  id="modal-titulo"
                  type="text"
                  required
                  value={novoTitulo}
                  onChange={(e) => setNovoTitulo(e.target.value)}
                  placeholder="Ex: Cerimônia de Abertura da Expogrande"
                  className="rounded-xl border border-slate-200 px-3.5 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-950 focus:border-transparent"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label htmlFor="modal-data" className="text-xs font-bold text-slate-800">Data</label>
                  <input
                    id="modal-data"
                    type="date"
                    disabled
                    value={dataSelecionadaStr}
                    className="rounded-xl border border-slate-100 bg-slate-50 px-3.5 py-2 text-sm text-slate-450 focus:outline-none"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor="modal-hora" className="text-xs font-bold text-slate-800">Horário</label>
                  <input
                    id="modal-hora"
                    type="time"
                    required
                    value={novaHora}
                    onChange={(e) => setNovaHora(e.target.value)}
                    className="rounded-xl border border-slate-200 px-3.5 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-950 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label htmlFor="modal-local" className="text-xs font-bold text-slate-800">Local</label>
                <input
                  id="modal-local"
                  type="text"
                  value={novoLocal}
                  onChange={(e) => setNovoLocal(e.target.value)}
                  placeholder="Ex: Centro de Convenções Rubens Gil de Camillo"
                  className="rounded-xl border border-slate-200 px-3.5 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-950 focus:border-transparent"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label htmlFor="modal-descricao" className="text-xs font-bold text-slate-800">Descrição / Notas</label>
                <textarea
                  id="modal-descricao"
                  rows={3}
                  value={novaDescricao}
                  onChange={(e) => setNovaDescricao(e.target.value)}
                  placeholder="Informações adicionais importantes..."
                  className="rounded-xl border border-slate-200 px-3.5 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-950 focus:border-transparent resize-none"
                />
              </div>

              <div className="border-t border-slate-100 pt-4 mt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalAberto(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-650 hover:bg-slate-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvando}
                  className="inline-flex items-center justify-center rounded-xl bg-slate-950 px-4 py-2.5 text-xs font-bold text-white hover:bg-slate-900 active:scale-95 transition-all disabled:opacity-60 cursor-pointer"
                >
                  {salvando && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
                  Salvar Compromisso
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
