export const runtime = 'edge';
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

const GLOBAL_TIPO_AGENDA = "GLOBAL" as const;

type AgendaPayload = {
    id?: string;
    titulo?: string;
    local?: string | null;
    descricao?: string | null;
    data_inicio?: string | null;
    data_fim?: string | null;
};

type TaskWritePayload = {
    tipo_agenda: typeof GLOBAL_TIPO_AGENDA;
    titulo: string;
    descricao: string | null;
    status: string;
    event_type: string;
    data_inicio: string | null;
    data_fim: string | null;
    registro_status: string;
};

type TaskDbPayload = TaskWritePayload & {
    unidade_id?: string;
    created_by?: string;
};

function hasAgendaWritePermission(modulos: unknown) {
    return Array.isArray(modulos) && modulos.includes("agenda_global_editar");
}

function montarDescricaoOficial(local: string | null | undefined, descricao: string | null | undefined) {
    const partes = [];
    const localTrimmed = local?.trim();
    const descricaoTrimmed = descricao?.trim();

    if (localTrimmed) {
        partes.push(`Local: ${localTrimmed}`);
    }

    if (descricaoTrimmed) {
        partes.push(descricaoTrimmed);
    }

    return partes.join("\n\n") || null;
}

async function persistirTaskComFallback(
    execute: (payload: TaskDbPayload) => Promise<{ error: { message: string } | null }>
    ,
    payloadBase: TaskWritePayload,
    options: {
        unidadeId?: string | null;
        createdBy?: string;
    }
) {
    const payloadPreferencial = {
        ...payloadBase,
        ...(options.unidadeId ? { unidade_id: options.unidadeId } : {}),
        ...(options.createdBy ? { created_by: options.createdBy } : {}),
    };

    const tentativa = await execute(payloadPreferencial);
    if (!tentativa.error) {
        return;
    }

    const mensagem = tentativa.error.message || "";
    if (options.unidadeId && /column .*unidade_id|unidade_id/i.test(mensagem)) {
        const fallbackSemUnidade = await execute({
            ...payloadBase,
            ...(options.createdBy ? { created_by: options.createdBy } : {}),
        });

        if (!fallbackSemUnidade.error) {
            return;
        }

        throw new Error(fallbackSemUnidade.error.message);
    }

    throw new Error(mensagem);
}

export async function POST(request: Request) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
        return NextResponse.json(
            { error: "Configuração do Supabase incompleta." },
            { status: 500 }
        );
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

    try {
        const {
            data: { user },
            error: authError,
        } = await supabaseAuth.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: "Faça login novamente." }, { status: 401 });
        }

        const { data: perfil, error: perfilError } = await supabaseAdmin
            .from("perfis_usuarios")
            .select("id, nome, cargo, unidade_id, modulos_acesso")
            .eq("id", user.id)
            .single();

        if (perfilError || !perfil || !hasAgendaWritePermission(perfil.modulos_acesso)) {
            return NextResponse.json({ error: "Seu perfil não pode editar a pré-agenda." }, { status: 403 });
        }

        let body: AgendaPayload;

        try {
            body = await request.json();
        } catch {
            return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
        }

        const titulo = body.titulo?.trim();
        const dataInicio = body.data_inicio?.trim();

        if (!titulo || !dataInicio) {
            return NextResponse.json(
                { error: "Preencha título e data de início." },
                { status: 400 }
            );
        }

        const nomeLegado = perfil.nome?.trim() || user.email || "Usuario";

        const { error: legacyProfileError } = await supabaseAdmin
            .from("profiles")
            .upsert(
                {
                    id: user.id,
                    nome: nomeLegado,
                    cargo: perfil.cargo ?? null,
                },
                { onConflict: "id" }
            );

        if (legacyProfileError) {
            return NextResponse.json({ error: legacyProfileError.message }, { status: 500 });
        }

        const payloadBase: TaskWritePayload = {
            tipo_agenda: GLOBAL_TIPO_AGENDA,
            titulo,
            descricao: montarDescricaoOficial(body.local, body.descricao),
            status: "pendente",
            event_type: "agenda_oficial",
            data_inicio: dataInicio,
            data_fim: body.data_fim?.trim() || dataInicio,
            registro_status: "ativo",
        };

        if (body.id?.trim()) {
            await persistirTaskComFallback(
                async (payload) => {
                    const { error } = await supabaseAdmin
                        .from("tasks")
                        .update(payload)
                        .eq("id", body.id!.trim());

                    return { error: error ? { message: error.message } : null };
                },
                payloadBase,
                { unidadeId: perfil.unidade_id ?? null }
            );
        } else {
            await persistirTaskComFallback(
                async (payload) => {
                    const { error } = await supabaseAdmin
                        .from("tasks")
                        .insert(payload);

                    return { error: error ? { message: error.message } : null };
                },
                payloadBase,
                { unidadeId: perfil.unidade_id ?? null, createdBy: user.id }
            );
        }

        return NextResponse.json({ success: true }, { status: 200 });
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Não consegui salvar o evento.", details: error instanceof Error ? error.message : String(error) },
            { status: 500 }
        );
    }
}
