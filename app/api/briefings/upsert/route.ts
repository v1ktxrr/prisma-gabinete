export const runtime = 'edge';
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

type BriefingPayload = {
    id?: string | null;
    tipo_localidade?: string | null;
    agenda_id?: string | null;
    titulo_customizado?: string | null;
    data_customizada?: string | null;
    hora_customizada?: string | null;
    local_customizado?: string | null;
    organizacao?: string | null;
    contato_local?: string | null;
    traje?: string | null;
    apoio_governo_ms?: string | null;
    municipio_id?: string | null;
    autoridades?: unknown;
    cronograma?: unknown;
    blocos_customizados?: unknown;
    contexto_geral?: string | null;
    destaques_ms?: string | null;
    info_confidencial?: string | null;
    status?: "RASCUNHO" | "FINALIZADO" | null;
    atendimento_id?: string | null;
};

type BlocoCustomizado = {
    id: string;
    titulo: string;
    conteudo_html: string;
    sigiloso: boolean;
};

type BriefingMutationPayload = {
    tipo_localidade: "INTERIOR" | "CAPITAL";
    agenda_id: string | null;
    titulo_customizado: string | null;
    data_customizada: string | null;
    hora_customizada: string | null;
    local_customizado: string | null;
    organizacao: string | null;
    contato_local: string | null;
    traje: string | null;
    apoio_governo_ms: string | null;
    municipio_id: string | null;
    autoridades: unknown[];
    cronograma: unknown[];
    blocos_customizados?: BlocoCustomizado[];
    contexto_geral: string | null;
    destaques_ms: string | null;
    info_confidencial: string | null;
    status: "RASCUNHO" | "FINALIZADO";
    atendimento_id?: string | null;
};

function hasBriefingReadPermission(modulos: unknown) {
    if (!Array.isArray(modulos)) {
        return false;
    }

    return (
        modulos.includes("agenda_comunicacao_ver") ||
        modulos.includes("briefing_editar") ||
        modulos.includes("agenda_comunicacao_editar")
    );
}

function hasBriefingWritePermission(modulos: unknown) {
    if (!Array.isArray(modulos)) {
        return false;
    }

    return modulos.includes("briefing_editar") || modulos.includes("agenda_comunicacao_editar");
}

function normalizarListaJson(value: unknown) {
    if (!Array.isArray(value)) {
        return [];
    }

    return value;
}

function gerarBlocosPadraoCompat(body: BriefingPayload) {
    return [
        {
            id: "contexto_geral",
            titulo: "Contexto Geral do Evento",
            conteudo_html: body.contexto_geral?.trim() ? `<p>${body.contexto_geral.trim()}</p>` : "",
            sigiloso: false,
        },
        {
            id: "destaques_ms",
            titulo: "Destaques do MS / Protagonismo",
            conteudo_html: body.destaques_ms?.trim() ? `<p>${body.destaques_ms.trim()}</p>` : "",
            sigiloso: false,
        },
        {
            id: "info_confidencial",
            titulo: "Informações Confidenciais",
            conteudo_html: body.info_confidencial?.trim() ? `<p>${body.info_confidencial.trim()}</p>` : "",
            sigiloso: true,
        },
    ];
}

function normalizarBlocosCustomizados(value: unknown, fallbackBody?: BriefingPayload): BlocoCustomizado[] {
    if (!Array.isArray(value)) {
        return fallbackBody ? gerarBlocosPadraoCompat(fallbackBody) : [];
    }

    const blocos = value
        .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
        .map((item, index) => ({
            id:
                typeof item.id === "string" && item.id.trim().length > 0
                    ? item.id.trim()
                    : `bloco_${index + 1}`,
            titulo:
                typeof item.titulo === "string" && item.titulo.trim().length > 0
                    ? item.titulo.trim()
                    : `Bloco ${index + 1}`,
            conteudo_html: typeof item.conteudo_html === "string" ? item.conteudo_html : "",
            sigiloso: Boolean(item.sigiloso),
        }));

    if (blocos.length > 0) {
        return blocos;
    }

    return fallbackBody ? gerarBlocosPadraoCompat(fallbackBody) : [];
}

function htmlParaTexto(html: string) {
    return html
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/p>/gi, "\n\n")
        .replace(/<li>/gi, "- ")
        .replace(/<\/li>/gi, "\n")
        .replace(/<[^>]*>/g, "")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}

function construirCamposLegados(blocos: BlocoCustomizado[]) {
    const blocoContexto = blocos.find((bloco) => /contexto/i.test(bloco.titulo));
    const blocoDestaques = blocos.find(
        (bloco) =>
            /destaque|protagonismo|informa/i.test(bloco.titulo) &&
            !bloco.sigiloso &&
            bloco.id !== blocoContexto?.id
    );
    const blocosSigilosos = blocos.filter((bloco) => bloco.sigiloso);
    const blocosRestantes = blocos.filter(
        (bloco) => bloco.id !== blocoContexto?.id && bloco.id !== blocoDestaques?.id && !bloco.sigiloso
    );

    const contexto_geral = blocoContexto ? htmlParaTexto(blocoContexto.conteudo_html) || null : null;

    const destaquesLista = [
        blocoDestaques ? htmlParaTexto(blocoDestaques.conteudo_html) : null,
        ...blocosRestantes.map((bloco) => {
            const conteudo = htmlParaTexto(bloco.conteudo_html);
            return conteudo ? `${bloco.titulo}\n${conteudo}` : null;
        }),
    ].filter((item): item is string => Boolean(item && item.trim()));

    const infoSigilosa = blocosSigilosos
        .map((bloco) => {
            const conteudo = htmlParaTexto(bloco.conteudo_html);
            return conteudo ? `${bloco.titulo}\n${conteudo}` : null;
        })
        .filter((item): item is string => Boolean(item && item.trim()))
        .join("\n\n");

    return {
        contexto_geral,
        destaques_ms: destaquesLista.length > 0 ? destaquesLista.join("\n\n") : null,
        info_confidencial: infoSigilosa || null,
    };
}

function normalizarHora(value: string | null | undefined) {
    if (!value?.trim()) return null;
    const trimmed = value.trim();
    return trimmed.length === 5 ? `${trimmed}:00` : trimmed;
}

function normalizarTipoLocalidade(value: string | null | undefined): "INTERIOR" | "CAPITAL" {
    return value === "CAPITAL" ? "CAPITAL" : "INTERIOR";
}

async function createClients() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
        throw new Error("Configuração do Supabase incompleta.");
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

    return { supabaseAuth, supabaseAdmin };
}

export async function POST(request: Request) {
    try {
        let supabaseAuth;
        let supabaseAdmin;

        try {
            ({ supabaseAuth, supabaseAdmin } = await createClients());
        } catch (error) {
            return NextResponse.json(
                { error: error instanceof Error ? error.message : "Configuração do servidor incompleta." },
                { status: 500 }
            );
        }

        const {
            data: { user },
            error: authError,
        } = await supabaseAuth.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: "Faça login novamente." }, { status: 401 });
        }

        const { data: perfil, error: perfilError } = await supabaseAdmin
            .from("perfis_usuarios")
            .select("id, modulos_acesso, unidade_id")
            .eq("id", user.id)
            .single();

        if (perfilError || !perfil || !hasBriefingWritePermission(perfil.modulos_acesso)) {
            return NextResponse.json({ error: "Seu perfil não pode editar briefings." }, { status: 403 });
        }

        let body: BriefingPayload;
        try {
            body = await request.json();
        } catch {
            return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
        }

        const briefingId = body.id?.trim() || null;
        const agendaId = body.agenda_id?.trim() || null;

        if (agendaId) {
            const { data: agenda, error: agendaError } = await supabaseAdmin
                .from("tasks")
                .select("id, tipo_agenda")
                .eq("id", agendaId)
                .eq("tipo_agenda", "GLOBAL")
                .maybeSingle();

            if (agendaError || !agenda) {
                return NextResponse.json({ error: "Evento da agenda não encontrado." }, { status: 404 });
            }
        } else if (
            !body.titulo_customizado?.trim() ||
            !body.data_customizada?.trim() ||
            !body.hora_customizada?.trim() ||
            !body.local_customizado?.trim()
        ) {
            return NextResponse.json(
                { error: "Preencha título, data, horário e local para o briefing independente." },
                { status: 400 }
            );
        }

        if (briefingId) {
            const { data: existente, error: existenteError } = await supabaseAdmin
                .from("briefings")
                .select("id")
                .eq("id", briefingId)
                .single();

            if (existenteError || !existente) {
                return NextResponse.json({ error: "Briefing não encontrado para atualizar." }, { status: 404 });
            }
        }

        const blocosCustomizados = normalizarBlocosCustomizados(body.blocos_customizados, body);
        const camposLegados = construirCamposLegados(blocosCustomizados);

        let resolvedAtendimentoId = body.atendimento_id?.trim() || null;
        if (resolvedAtendimentoId === "new") {
            const title = body.titulo_customizado?.trim() || "Briefing Independente";
            const date = body.data_customizada?.trim() ? new Date(`${body.data_customizada}T${body.hora_customizada || '12:00'}`) : new Date();
            const { data: newAt, error: newAtError } = await supabaseAdmin
                .from("atendimentos")
                .insert({
                    titulo: `Atendimento: ${title}`,
                    status: "aberto",
                    unidade_id: perfil.unidade_id ?? "CG",
                    data: date.toISOString()
                })
                .select("id")
                .single();
            if (newAtError) {
                return NextResponse.json({ error: "Erro ao gerar atendimento automático: " + newAtError.message }, { status: 500 });
            }
            resolvedAtendimentoId = newAt.id;
        }

        const payload: BriefingMutationPayload = {
            tipo_localidade: normalizarTipoLocalidade(body.tipo_localidade),
            agenda_id: agendaId,
            titulo_customizado: agendaId ? null : body.titulo_customizado?.trim() || null,
            data_customizada: agendaId ? null : body.data_customizada?.trim() || null,
            hora_customizada: agendaId ? null : normalizarHora(body.hora_customizada),
            local_customizado: agendaId ? null : body.local_customizado?.trim() || null,
            organizacao: body.organizacao?.trim() || null,
            contato_local: body.contato_local?.trim() || null,
            traje: body.traje?.trim() || null,
            apoio_governo_ms: body.apoio_governo_ms?.trim() || null,
            municipio_id: body.municipio_id?.trim() || null,
            autoridades: normalizarListaJson(body.autoridades),
            cronograma: normalizarListaJson(body.cronograma),
            blocos_customizados: blocosCustomizados,
            contexto_geral: camposLegados.contexto_geral,
            destaques_ms: camposLegados.destaques_ms,
            info_confidencial: camposLegados.info_confidencial,
            status: body.status === "FINALIZADO" ? "FINALIZADO" : "RASCUNHO",
            atendimento_id: resolvedAtendimentoId,
        };

        const mutation = briefingId
            ? supabaseAdmin.from("briefings").update(payload).eq("id", briefingId)
            : agendaId
              ? supabaseAdmin.from("briefings").upsert(payload, { onConflict: "agenda_id" })
              : supabaseAdmin.from("briefings").insert(payload);

        let { data, error } = await mutation.select("*").single();

        if (error && /blocos_customizados|tipo_localidade/i.test(error.message)) {
            const payloadLegado = { ...payload };
            delete payloadLegado.blocos_customizados;
            if (/tipo_localidade/i.test(error.message)) {
                delete (payloadLegado as Partial<BriefingMutationPayload>).tipo_localidade;
            }

            const retryMutation = briefingId
                ? supabaseAdmin.from("briefings").update(payloadLegado).eq("id", briefingId)
                : agendaId
                  ? supabaseAdmin.from("briefings").upsert(payloadLegado, { onConflict: "agenda_id" })
                  : supabaseAdmin.from("briefings").insert(payloadLegado);

            const retry = await retryMutation.select("*").single();
            data = retry.data;
            error = retry.error;
        }

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, briefing: data }, { status: 200 });
    } catch (error: any) {
        console.error("[Briefings POST] Crash Fatal:", error);
        return NextResponse.json({ error: 'Crash na API', message: error.message, stack: error.stack }, { status: 500 });
    }
}

export async function GET(request: Request) {
    try {
        let supabaseAuth;
        let supabaseAdmin;

        try {
            ({ supabaseAuth, supabaseAdmin } = await createClients());
        } catch (error) {
            return NextResponse.json(
                { error: error instanceof Error ? error.message : "Falha de configuração do servidor." },
                { status: 500 }
            );
        }

        const { searchParams } = new URL(request.url);
        const agendaId = searchParams.get("agenda_id")?.trim();
        const briefingId = searchParams.get("briefing_id")?.trim();

        const {
            data: { session },
            error: authError,
        } = await supabaseAuth.auth.getSession();

        const user = session?.user ?? null;

        if (authError || !user) {
            return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
        }

        const { data: perfil, error: perfilError } = await supabaseAdmin
            .from("perfis_usuarios")
            .select("id, modulos_acesso")
            .eq("id", user.id)
            .single();

        if (perfilError || !perfil || !hasBriefingReadPermission(perfil.modulos_acesso)) {
            return NextResponse.json({ error: "Acesso negado para ler briefings." }, { status: 403 });
        }

        if (briefingId) {
            const { data: briefing, error: briefingError } = await supabaseAdmin
                .from("briefings")
                .select("*")
                .eq("id", briefingId)
                .single();

            if (briefingError || !briefing) {
                return NextResponse.json({ error: "Briefing não encontrado." }, { status: 404 });
            }

            let evento = null;
            const briefingAgendaId =
                typeof briefing.agenda_id === "string" && briefing.agenda_id ? briefing.agenda_id : null;

            if (briefingAgendaId) {
                const eventoResult = await supabaseAdmin
                    .from("tasks")
                    .select("id, titulo, descricao, data_inicio, data_fim, tipo_agenda, event_type, tema, registro_status")
                    .eq("id", briefingAgendaId)
                    .eq("tipo_agenda", "GLOBAL")
                    .maybeSingle();

                if (eventoResult.error) {
                    return NextResponse.json({ error: eventoResult.error.message }, { status: 500 });
                }

                evento = eventoResult.data;
            }

            return NextResponse.json(
                {
                    event: evento,
                    briefing: {
                        ...briefing,
                        blocos_customizados: normalizarBlocosCustomizados(
                            (briefing as Record<string, unknown>).blocos_customizados,
                            briefing as BriefingPayload
                        ),
                    },
                },
                { status: 200 }
            );
        }

        if (agendaId) {
            const { data: evento, error: eventoError } = await supabaseAdmin
                .from("tasks")
                .select("id, titulo, descricao, data_inicio, data_fim, tipo_agenda, event_type, tema, registro_status")
                .eq("id", agendaId)
                .eq("tipo_agenda", "GLOBAL")
                .maybeSingle();

            if (eventoError || !evento) {
                return NextResponse.json({ error: "Evento não encontrado." }, { status: 404 });
            }

            const { data: briefing, error: briefingError } = await supabaseAdmin
                .from("briefings")
                .select("*")
                .eq("agenda_id", agendaId)
                .maybeSingle();

            if (briefingError) {
                return NextResponse.json({ error: briefingError.message }, { status: 500 });
            }

            const briefingNormalizado = briefing
                ? {
                      ...briefing,
                      blocos_customizados: normalizarBlocosCustomizados(
                          (briefing as Record<string, unknown>).blocos_customizados,
                          briefing as BriefingPayload
                      ),
                  }
                : null;

            return NextResponse.json({ event: evento, briefing: briefingNormalizado }, { status: 200 });
        }

        const hoje = new Date();
        const inicioJanela = new Date(hoje);
        inicioJanela.setDate(hoje.getDate() - 7);

        const [{ data: eventos, error: eventosError }, { data: briefings, error: briefingsError }] =
            await Promise.all([
                supabaseAdmin
                    .from("tasks")
                    .select("id, titulo, descricao, data_inicio, data_fim, tipo_agenda, event_type, tema, registro_status")
                    .eq("registro_status", "ativo")
                    .eq("tipo_agenda", "GLOBAL")
                    .gte("data_inicio", inicioJanela.toISOString())
                    .order("data_inicio", { ascending: true })
                    .limit(60),
                supabaseAdmin
                    .from("briefings")
                    .select(`
                        id,
                        tipo_localidade,
                        agenda_id,
                        titulo_customizado,
                        data_customizada,
                        hora_customizada,
                        local_customizado,
                        municipio_id,
                        atualizado_em,
                        status,
                        tasks (
                            id,
                            titulo,
                            data_inicio,
                            data_fim,
                            descricao
                        )
                    `)
                    .order("atualizado_em", { ascending: false })
                    .limit(100),
            ]);

        if (eventosError) {
            return NextResponse.json({ error: eventosError.message }, { status: 500 });
        }

        if (briefingsError) {
            return NextResponse.json({ error: briefingsError.message }, { status: 500 });
        }

        return NextResponse.json(
            {
                success: true,
                events: eventos ?? [],
                briefings: briefings ?? [],
            },
            { status: 200 }
        );
    } catch (error: any) {
        console.error("[Briefings GET] Crash Fatal:", error);
        return NextResponse.json({ error: 'Crash na API', message: error.message, stack: error.stack }, { status: 500 });
    }
}
