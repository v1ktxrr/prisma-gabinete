export const runtime = 'edge';
/* eslint-disable @next/next/no-img-element */
import { cookies } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import PrintTrigger from "@/components/briefings/print-trigger";


const LOGO_GABINETE = "/logo-prisma.png";

const BRIEFING_THEMES = {
    INTERIOR: {
        frame: "#6f8f3d",
        header: "#eef4e4",
        strip: "#eef4e4",
        title: "#111827",
        locality: "#4a5f27",
        city: "#1f4e83",
    },
    CAPITAL: {
        frame: "#548DD4",
        header: "#C6D9F1",
        strip: "#DBE5F1",
        title: "#1F497D",
        locality: "#3C78D8",
        city: "#1F497D",
    },
} as const;

type PageProps = {
    params: Promise<{
        id: string;
    }>;
};

type BlocoCustomizado = {
    id: string;
    titulo: string;
    conteudo_html: string;
    sigiloso: boolean;
};

type BriefingRecord = Record<string, unknown> & {
    tipo_localidade?: string | null;
    agenda_id?: string | null;
    titulo_customizado?: string | null;
    data_customizada?: string | null;
    hora_customizada?: string | null;
    local_customizado?: string | null;
    traje?: string | null;
    organizacao?: string | null;
    contato_local?: string | null;
    apoio_governo_ms?: string | null;
};

function hasBriefingReadPermission(modulos: unknown) {
    return (
        Array.isArray(modulos) &&
        (modulos.includes("agenda_comunicacao_ver") ||
            modulos.includes("briefing_editar") ||
            modulos.includes("agenda_comunicacao_editar"))
    );
}

function formatarDataExtenso(iso: string | null) {
    if (!iso) return "Data nao informada";
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "Data nao informada";

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

function slugifyFileName(value: string) {
    return value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .slice(0, 80);
}

function extrairDadosOficiais(descricao: string | null) {
    if (!descricao) {
        return {
            local: "Local nao informado",
        };
    }

    const linhas = descricao
        .split("\n")
        .map((linha) => linha.trim())
        .filter(Boolean);

    const linhaComLocal = linhas.find((linha) => /^local\s*:/i.test(linha));
    const local = linhaComLocal
        ? linhaComLocal.replace(/^local\s*:/i, "").trim() || "Local nao informado"
        : "Local nao informado";

    return { local };
}

function normalizarBlocos(briefing: BriefingRecord | null): BlocoCustomizado[] {
    if (!briefing) return [];

    if (Array.isArray(briefing.blocos_customizados)) {
        return briefing.blocos_customizados.map((item, index) => {
            const bloco = item as Record<string, unknown>;
            return {
                id: typeof bloco.id === "string" ? bloco.id : `bloco_${index + 1}`,
                titulo: typeof bloco.titulo === "string" ? bloco.titulo : `Bloco ${index + 1}`,
                conteudo_html: typeof bloco.conteudo_html === "string" ? bloco.conteudo_html : "",
                sigiloso: Boolean(bloco.sigiloso),
            };
        });
    }

    return [
        {
            id: "contexto_geral",
            titulo: "Contexto Geral do Evento",
            conteudo_html:
                typeof briefing.contexto_geral === "string" && briefing.contexto_geral.trim()
                    ? `<p>${briefing.contexto_geral.trim()}</p>`
                    : "",
            sigiloso: false,
        },
        {
            id: "destaques_ms",
            titulo: "Destaques do MS / Protagonismo",
            conteudo_html:
                typeof briefing.destaques_ms === "string" && briefing.destaques_ms.trim()
                    ? `<p>${briefing.destaques_ms.trim()}</p>`
                    : "",
            sigiloso: false,
        },
        {
            id: "info_confidencial",
            titulo: "Informações Confidenciais",
            conteudo_html:
                typeof briefing.info_confidencial === "string" && briefing.info_confidencial.trim()
                    ? `<p>${briefing.info_confidencial.trim()}</p>`
                    : "",
            sigiloso: true,
        },
    ];
}

function inferirCidade(local: string) {
    const upper = local.toUpperCase();
    if (upper.includes("DOURADOS")) return "DOURADOS";
    if (upper.includes("CAMPO GRANDE")) return "CAMPO GRANDE";

    const partes = local
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);

    const ultimaParte = partes.at(-1);
    return ultimaParte ? ultimaParte.toUpperCase() : "MATO GROSSO DO SUL";
}

function montarDataHoraCustomizada(data: string | null | undefined, hora: string | null | undefined) {
    if (!data) return null;
    const horaNormalizada = hora ? hora.slice(0, 8) : "00:00:00";
    return `${data}T${horaNormalizada}`;
}

function normalizarTipoLocalidade(value: string | null | undefined): keyof typeof BRIEFING_THEMES {
    return value === "CAPITAL" ? "CAPITAL" : "INTERIOR";
}

export default async function BriefingPrintPage({ params }: PageProps) {
    const { id } = await params;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
        throw new Error("Variaveis de ambiente do Supabase ausentes.");
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
        .select("id, modulos_acesso")
        .eq("id", user.id)
        .single();

    if (!perfil || !hasBriefingReadPermission(perfil.modulos_acesso)) {
        notFound();
    }

    const { data: briefingRaw, error: briefingError } = await supabaseAdmin
        .from("briefings")
        .select("*, municipios(nome)")
        .eq("id", id)
        .single();

    if (briefingError || !briefingRaw) {
        notFound();
    }

    const briefing = briefingRaw as BriefingRecord;
    const agendaId =
        typeof briefing.agenda_id === "string" && briefing.agenda_id.trim().length > 0
            ? briefing.agenda_id
            : null;

    const evento = agendaId
        ? (
              await supabaseAdmin
                  .from("tasks")
                  .select("id, titulo, descricao, data_inicio, tipo_agenda, municipios(nome)")
                  .eq("id", agendaId)
                  .eq("tipo_agenda", "GLOBAL")
                  .maybeSingle()
          ).data
        : null;

    if (agendaId && !evento) {
        notFound();
    }

    const dataHoraBase = evento?.data_inicio ?? montarDataHoraCustomizada(briefing.data_customizada, briefing.hora_customizada);
    const localBase = evento ? extrairDadosOficiais(evento.descricao).local : briefing.local_customizado || "Local nao informado";
    const tituloBase = evento?.titulo || briefing.titulo_customizado || "Briefing sem título";
    const cidadeNome =
        (evento as any)?.municipios?.nome ||
        (briefingRaw as any)?.municipios?.nome ||
        inferirCidade(localBase);
    const cidade = cidadeNome.toUpperCase();
    const tipoLocalidade = normalizarTipoLocalidade(briefing.tipo_localidade);
    const theme = BRIEFING_THEMES[tipoLocalidade];
    const cidadeHeader = tipoLocalidade === "CAPITAL" && !cidade.includes("/") ? `${cidade} / MS` : cidade;
    const blocos = normalizarBlocos(briefing);
    const blocosPublicos = blocos.filter(
        (bloco) => !bloco.sigiloso && bloco.conteudo_html.replace(/<[^>]*>/g, "").trim().length > 0
    );
    const blocosSigilosos = blocos.filter(
        (bloco) => bloco.sigiloso && bloco.conteudo_html.replace(/<[^>]*>/g, "").trim().length > 0
    );
    const autoridades = Array.isArray(briefing.autoridades) ? (briefing.autoridades as unknown[]) : [];
    const cronograma = Array.isArray(briefing.cronograma) ? (briefing.cronograma as unknown[]) : [];

    const fileDate = dataHoraBase
        ? new Intl.DateTimeFormat("pt-BR").format(new Date(dataHoraBase)).replaceAll("/", "-")
        : new Intl.DateTimeFormat("pt-BR").format(new Date()).replaceAll("/", "-");
    const fileName = `Briefing_${fileDate}_${slugifyFileName(tituloBase)}.pdf`;

    return (
        <div className="min-h-screen bg-slate-100 px-4 py-6 print:bg-white print:p-0">
            <style type="text/css">
                {`
                    .official-briefing-page {
                        font-family: Arial, Helvetica, sans-serif;
                        font-size: 11pt;
                        line-height: 1.24;
                    }

                    .official-briefing-page p {
                        margin: 0 0 11pt 0;
                    }

                    .official-briefing-page ul {
                        list-style: none;
                        margin: 3pt 0 0 0;
                        padding: 0;
                    }

                    .official-briefing-page li {
                        margin: 0 0 1pt 0;
                    }

                    .official-briefing-page .roteiro li::before {
                        content: "- ";
                    }

                    .briefing-html {
                        font-family: Arial, Helvetica, sans-serif;
                        font-size: 11pt;
                        line-height: 1.24;
                    }

                    .briefing-html p {
                        margin: 0 0 11pt 0;
                    }

                    .briefing-html h1,
                    .briefing-html h2,
                    .briefing-html h3 {
                        margin: 14pt 0 8pt 0;
                        font-size: 11pt;
                        font-weight: 700;
                    }

                    .briefing-html ul {
                        list-style: none;
                        margin: 3pt 0 11pt 0;
                        padding: 0;
                    }

                    .briefing-html ul li::before {
                        content: "- ";
                    }

                    .briefing-html ol {
                        margin: 3pt 0 11pt 20pt;
                        padding: 0;
                    }

                    .briefing-html img {
                        display: block;
                        max-width: 100%;
                        height: auto;
                        margin: 12pt 0 2pt 0;
                    }

                    .briefing-html figcaption,
                    .briefing-html em.image-caption {
                        display: block;
                        margin-top: 2pt;
                        font-style: italic;
                        font-size: 10pt;
                    }

                    @media print {
                        @page {
                            size: A4;
                            margin: 10mm 12mm 14mm 12mm;
                        }

                        body {
                            margin: 0;
                            background: white !important;
                            font-family: Arial, Helvetica, sans-serif !important;
                            font-size: 11pt !important;
                            line-height: 1.24 !important;
                            -webkit-print-color-adjust: exact !important;
                            print-color-adjust: exact !important;
                        }

                        .print-page-frame {
                            display: block !important;
                            position: fixed;
                            top: 0;
                            right: 0;
                            bottom: 0;
                            left: 0;
                            border: 1.2pt solid ${theme.frame};
                            pointer-events: none;
                            z-index: 9999;
                        }

                        .official-briefing-page {
                            width: auto !important;
                            padding: 0 !important;
                            box-shadow: none !important;
                        }

                        .page-content {
                            padding: 0 3mm;
                        }
                    }
                `}
            </style>

            <div className="mx-auto mb-5 flex w-[210mm] max-w-full items-center justify-between gap-3 print:hidden">
                <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                        Visualização de Impressão
                    </p>
                    <h1 className="mt-1 text-xl font-bold text-slate-900">{tituloBase}</h1>
                </div>
                <PrintTrigger fileName={fileName} />
            </div>

            <div className="print-page-frame hidden" />

            <article className="official-briefing-page mx-auto w-[210mm] max-w-full bg-white p-[10mm] text-black shadow-sm print:shadow-none">
                <div className="mb-4 text-right text-[14pt] font-bold uppercase" style={{ color: theme.locality }}>
                    {tipoLocalidade}
                </div>

                <div className="border print:border-0" style={{ borderColor: theme.frame }}>
                    <div className="w-full">
                        <div
                            className="grid min-h-[31mm] grid-cols-[58mm_1fr] items-center border-b px-[4mm] py-[4mm]"
                            style={{ backgroundColor: theme.header, borderColor: theme.frame }}
                        >
                            <div className="flex items-center justify-start">
                                <img
                                    src={LOGO_GABINETE}
                                    alt="Logo do Gabinete"
                                    className="h-auto w-[42mm] max-w-full object-contain"
                                />
                            </div>

                            <h1
                                className="text-center text-[15pt] font-bold uppercase leading-[1.15]"
                                style={{ color: theme.title }}
                            >
                                BRIEFING DE AGENDA OFICIAL<br />
                                GABINETE INSTITUCIONAL
                            </h1>
                        </div>

                        <div
                            className="border-b py-[1.5mm] text-center text-[12pt] italic"
                            style={{ borderColor: theme.frame }}
                        >
                            {formatarDataExtenso(dataHoraBase)}
                        </div>

                        <div
                            className="border-b py-[5mm] text-center"
                            style={{ borderColor: theme.frame }}
                        >
                            <div className="text-[14pt] font-bold uppercase" style={{ color: theme.city }}>
                                {cidadeHeader}
                            </div>
                            <div className="mt-[5mm] text-[14pt] text-red-600">
                                <strong>Traje:</strong>{" "}
                                {typeof briefing.traje === "string" && briefing.traje ? briefing.traje : "Nao informado"}
                            </div>
                        </div>

                        <div
                            className="border-b px-[3mm] py-[1mm] text-[12pt] font-bold leading-[1.15]"
                            style={{ backgroundColor: theme.strip, borderColor: theme.frame }}
                        >
                            {formatarHorario(dataHoraBase)} - {tituloBase}
                        </div>
                    </div>

                    <main className="page-content px-[3mm] py-[5mm]">
                        <section>
                            <p>
                                <strong>Organização:</strong>{" "}
                                {typeof briefing.organizacao === "string" && briefing.organizacao
                                    ? briefing.organizacao
                                    : "Nao informado"}
                            </p>
                            <p>
                                <strong>Local:</strong> {localBase}
                            </p>
                            <p>
                                <strong>Contato:</strong>{" "}
                                {typeof briefing.contato_local === "string" && briefing.contato_local
                                    ? briefing.contato_local
                                    : "Nao informado"}
                            </p>
                            {typeof briefing.apoio_governo_ms === "string" && briefing.apoio_governo_ms && (
                                <p>
                                    <strong>Apoio Institucional:</strong> {briefing.apoio_governo_ms}
                                </p>
                            )}
                        </section>

                        {autoridades.length > 0 && (
                            <section className="mt-[7mm]">
                                <p className="font-bold">Autoridades previstas:</p>
                                <ul>
                                    {autoridades.map((item, index) => {
                                        const autoridade = item as Record<string, unknown>;
                                        const nome =
                                            typeof autoridade.nome === "string" && autoridade.nome
                                                ? autoridade.nome
                                                : "Sem nome";
                                        const cargo =
                                            typeof autoridade.cargo === "string" && autoridade.cargo
                                                ? autoridade.cargo
                                                : "Sem cargo";

                                        return (
                                            <li key={`${nome}-${index}`}>
                                                <u>{nome}</u>, {cargo}
                                            </li>
                                        );
                                    })}
                                </ul>
                            </section>
                        )}

                        {cronograma.length > 0 && (
                            <section className="mt-[8mm]">
                                <p className="font-bold">Roteiro do cerimonial:</p>
                                <ul className="roteiro">
                                    {cronograma.map((item, index) => {
                                        const etapa = item as Record<string, unknown>;
                                        const horario =
                                            typeof etapa.horario === "string" && etapa.horario
                                                ? etapa.horario
                                                : "--:--";
                                        const acao =
                                            typeof etapa.acao === "string" && etapa.acao
                                                ? etapa.acao
                                                : "Sem acao cadastrada";

                                        return (
                                            <li key={`${horario}-${index}`}>
                                                {horario !== "--:--" ? `${horario} - ` : ""}
                                                {acao}
                                            </li>
                                        );
                                    })}
                                </ul>
                            </section>
                        )}
                    </main>

                    {blocosPublicos.length > 0 && (
                        <section>
                            <div
                                className="border-y px-[3mm] py-[1mm] text-[12pt] font-bold uppercase"
                                style={{ backgroundColor: theme.strip, borderColor: theme.frame }}
                            >
                                INFORMAÇÕES
                            </div>
                            <div className="page-content px-[3mm] py-[5mm]">
                                {blocosPublicos.map((bloco, index) => (
                                    <div key={bloco.id}>
                                        {index > 0 && <p className="font-bold">{bloco.titulo}</p>}
                                        <div
                                            className="briefing-html"
                                            dangerouslySetInnerHTML={{ __html: bloco.conteudo_html }}
                                        />
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                    {blocosSigilosos.length > 0 && (
                        <section>
                            <div
                                className="border-y px-[3mm] py-[1mm] text-[12pt] font-bold uppercase text-red-600"
                                style={{ backgroundColor: theme.strip, borderColor: theme.frame }}
                            >
                                DOCUMENTO RESERVADO / SIGILOSO
                            </div>
                            <div className="page-content px-[3mm] py-[5mm]">
                                {blocosSigilosos.map((bloco) => (
                                    <div key={bloco.id}>
                                        <p className="font-bold italic">{bloco.titulo}</p>
                                        <div
                                            className="briefing-html text-red-600"
                                            dangerouslySetInnerHTML={{ __html: bloco.conteudo_html }}
                                        />
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}
                </div>
            </article>
        </div>
    );
}
