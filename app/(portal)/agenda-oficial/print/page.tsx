export const runtime = 'edge';
/* eslint-disable @next/next/no-img-element */
import { cookies } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import PrintTrigger from "@/components/briefings/print-trigger";


const LOGO_GABINETE = "/logo-prisma.png";

type PageProps = {
    searchParams: Promise<{
        date?: string;
    }>;
};

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

function formatarDataExtenso(date: Date) {
  const formatted = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);

  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

function formatarHorario(iso: string | null) {
  if (!iso) return "--:--";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "--:--";
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "numeric",
    minute: "2-digit",
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

function hasAgendaOficialReadPermission(modulos: unknown) {
  return (
    Array.isArray(modulos) &&
    (modulos.includes("agenda_global_ver") || modulos.includes("agenda_global_editar"))
  );
}

export default async function AgendaOficialPrintPage({ searchParams }: PageProps) {
    const { date: dateStr } = await searchParams;
    let dateQuery = dateStr;
    if (!dateQuery) {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        dateQuery = tomorrow.toISOString().split("T")[0];
    }
    const selectedDate = new Date(`${dateQuery}T12:00:00`);

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
        throw new Error("Variáveis de ambiente do Supabase ausentes.");
    }

    const cookieStore = await cookies();
    const supabaseAuth = createServerClient(supabaseUrl, supabaseAnonKey, {
        cookies: {
            getAll() {
                return cookieStore.getAll();
            },
            setAll(cookiesToSet) {
                try {
                    cookiesToSet.forEach(({ name, value, options }) => {
                        cookieStore.set(name, value, options);
                    });
                } catch {
                    // Ignora erro de gravação de cookies em contexto GET/Server Component
                }
            },
        },
    });

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    });

    const {
        data: { user },
    } = await supabaseAuth.auth.getUser();

    if (!user) {
        redirect("/login");
    }

    const { data: perfil } = await supabaseAdmin
        .from("perfis_usuarios")
        .select("id, cargo, modulos_acesso, unidade_id")
        .eq("id", user.id)
        .single();

    const isAuthorized =
        perfil &&
        (hasAgendaOficialReadPermission(perfil.modulos_acesso) ||
         perfil.cargo === "chefia" ||
         perfil.cargo === "secretaria" ||
         perfil.cargo === "comunicacao");

    if (!isAuthorized) {
        notFound();
    }

    // Fetch all events
    const { data: eventsRaw, error } = await supabaseAdmin
      .from("tasks")
      .select("*")
      .eq("registro_status", "ativo")
      .eq("tipo_agenda", "GLOBAL")
      .eq("is_agenda_oficial", true)
      .order("data_inicio", { ascending: true });

    if (error) {
      throw error;
    }

    const rows = eventsRaw as AgendaGlobalRow[] ?? [];
    const eventsForDay = rows.filter((e) => mesmoDia(e.data_inicio, selectedDate));

    // Split into Confirmed and Happening
    const oficialConfirmados = eventsForDay.filter((e) => e.event_type === "agenda_oficial");
    const oficialAcontecendo = eventsForDay.filter((e) => e.event_type === "acontecendo");

    // Anniversaries
    const selectedDay = selectedDate.getDate();
    const selectedMonth = selectedDate.getMonth() + 1;
    const { data: bdays, error: bdaysError } = await supabaseAdmin
        .from("aniversariantes")
        .select("nome, cargo, dia, mes, telefone")
        .eq("dia", selectedDay)
        .eq("mes", selectedMonth);

    if (bdaysError) {
        throw bdaysError;
    }

    const aniversariantesDoDia = bdays ?? [];

    const fileDate = dateQuery.replaceAll("/", "-");
    const fileName = `Agenda_Oficial_${fileDate}.pdf`;

    return (
        <div className="min-h-screen bg-slate-100 px-4 py-6 print:bg-white print:p-0">
            <style type="text/css">
                {`
                    .official-agenda-sheet {
                        font-family: Arial, Helvetica, sans-serif;
                        font-size: 11pt;
                        line-height: 1.3;
                    }

                    @media print {
                        @page {
                            size: A4;
                            margin: 15mm 15mm 15mm 15mm;
                        }

                        body {
                            margin: 0;
                            background: white !important;
                            font-family: Arial, Helvetica, sans-serif !important;
                            -webkit-print-color-adjust: exact !important;
                            print-color-adjust: exact !important;
                        }

                        .official-agenda-sheet {
                            width: auto !important;
                            padding: 0 !important;
                            box-shadow: none !important;
                        }
                    }
                `}
            </style>

            {/* Print Header Actions */}
            <div className="mx-auto mb-5 flex w-[210mm] max-w-full items-center justify-between gap-3 print:hidden bg-white/80 backdrop-blur-md border border-slate-200 rounded-2xl p-4 shadow-sm">
                <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                        Visualização de Folha Oficial
                    </p>
                    <h1 className="mt-1 text-base font-bold text-slate-900">Agenda Oficial de {dateQuery}</h1>
                </div>
                <PrintTrigger fileName={fileName} />
            </div>

            {/* Compiled Sheet */}
            <article className="official-agenda-sheet mx-auto w-[210mm] max-w-full bg-white p-[12mm] text-black shadow-sm print:shadow-none min-h-[297mm] flex flex-col justify-between border border-slate-200/50 print:border-none">
                <div className="w-full">
                    {/* Header Timbrado */}
                    <div className="flex flex-col items-center border-b-2 border-slate-950 pb-5 mb-6">
                        <img
                            src={LOGO_GABINETE}
                            alt="Logo do Gabinete"
                            className="h-14 w-auto object-contain mb-3"
                        />
                        <h1 className="text-center text-[13pt] font-black uppercase tracking-tight text-slate-900 leading-snug">
                            GABINETE OFICIAL<br />
                            <span className="text-[11pt] font-bold text-slate-600">AGENDA OFICIAL DO GABINETE</span>
                        </h1>
                    </div>

                    {/* Date Title */}
                    <div className="text-center py-4 bg-slate-50 border border-slate-200 rounded-xl mb-6">
                        <h2 className="text-[13pt] font-extrabold uppercase tracking-wide text-slate-900">
                            {formatarDataExtenso(selectedDate)}
                        </h2>
                    </div>

                    {/* Section 1: Compromissos do Titular (Preto) */}
                    <div className="mb-8">
                        <h3 className="text-[11pt] font-black uppercase tracking-wider text-slate-900 border-b border-slate-350 pb-1 mb-4">
                            ★ COMPROMISSOS CONFIRMADOS (TITULAR)
                        </h3>

                        {oficialConfirmados.length === 0 ? (
                          <p className="text-[10pt] italic text-slate-500 pl-4 py-2">Sem compromissos oficiais confirmados para o titular nesta data.</p>
                        ) : (
                          <div className="flex flex-col gap-4">
                            {oficialConfirmados.map((e) => {
                              const details = extrairDadosOficiais(e.descricao);
                              return (
                                <div key={e.id} className="pl-4 border-l-2 border-slate-900 py-1">
                                  <div className="flex items-center gap-2 font-bold text-[11pt] text-slate-950">
                                    <span className="bg-slate-100 border border-slate-300 rounded px-1.5 py-0.5 text-[9.5pt] font-mono">
                                      {formatarHorario(e.data_inicio)}
                                    </span>
                                    <span>{e.titulo}</span>
                                  </div>
                                  <p className="mt-1 text-[9.5pt] text-slate-700 leading-normal pl-[52px]">
                                    <strong>Local:</strong> {details.local}
                                    {details.descricao && (
                                      <>
                                        <br />
                                        <span className="text-slate-550 italic">{details.descricao}</span>
                                      </>
                                    )}
                                  </p>
                                </div>
                              );
                            })}
                          </div>
                        )}
                    </div>

                    {/* Section 2: Acontecendo (Azul) */}
                    <div className="mb-8">
                        <h3 className="text-[11pt] font-black uppercase tracking-wider text-blue-900 border-b border-blue-200 pb-1 mb-4">
                          📅 AGENDAS ACONTECENDO (EQUIPE / GABINETE)
                        </h3>

                        {oficialAcontecendo.length === 0 ? (
                          <p className="text-[10pt] italic text-slate-500 pl-4 py-2">Nenhum evento acontecendo sem o titular registrado nesta data.</p>
                        ) : (
                          <div className="flex flex-col gap-4">
                            {oficialAcontecendo.map((e) => {
                              const details = extrairDadosOficiais(e.descricao);
                              return (
                                <div key={e.id} className="pl-4 border-l-2 border-blue-600 py-1">
                                  <div className="flex items-center gap-2 font-bold text-[11pt] text-blue-900">
                                    <span className="bg-blue-50 border border-blue-200 rounded px-1.5 py-0.5 text-[9.5pt] font-mono text-blue-700">
                                      {formatarHorario(e.data_inicio)}
                                    </span>
                                    <span>{e.titulo}</span>
                                  </div>
                                  <p className="mt-1 text-[9.5pt] text-slate-700 leading-normal pl-[52px]">
                                    <strong>Local:</strong> {details.local}
                                    {details.descricao && (
                                      <>
                                        <br />
                                        <span className="text-slate-500 italic">{details.descricao}</span>
                                      </>
                                    )}
                                  </p>
                                </div>
                              );
                            })}
                          </div>
                        )}
                    </div>
                </div>

                {/* Section 3: Birthdays (Aniversários) at the bottom */}
                <div className="w-full border-t border-slate-300 pt-5 mt-auto">
                    <h3 className="text-[10pt] font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5 mb-3">
                      🎂 ANIVERSARIANTES DE PARCEIROS E LIDERANÇAS
                    </h3>

                    {aniversariantesDoDia.length === 0 ? (
                      <p className="text-[9.5pt] italic text-slate-500">Nenhum aniversariante registrado para esta data.</p>
                    ) : (
                      <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                        {aniversariantesDoDia.map((a, idx) => (
                          <div key={idx} className="text-[9.5pt]">
                            <strong>{a.nome}</strong> — <span className="text-slate-650">{a.cargo}</span>
                            {a.telefone && <span className="text-slate-500"> — Tel: {a.telefone}</span>}
                          </div>
                        ))}
                      </div>
                    )}
                </div>
            </article>
        </div>
    );
}
