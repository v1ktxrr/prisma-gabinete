export const runtime = 'edge';
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

type GoogleAgendaEvent = {
    id: string;
    titulo: string;
    local: string;
    descricao: string;
    data_hora_inicio: string;
};

const GLOBAL_TIPO_AGENDA = "GLOBAL" as const;

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

function normalizarEventoGoogle(evento: unknown): GoogleAgendaEvent | null {
    if (!evento || typeof evento !== "object") {
        return null;
    }

    const raw = evento as Record<string, unknown>;
    const id = typeof raw.id === "string" ? raw.id.trim() : "";
    const titulo = typeof raw.titulo === "string" ? raw.titulo.trim() : "";
    const dataHoraInicio =
        typeof raw.data_hora_inicio === "string" ? raw.data_hora_inicio.trim() : "";

    if (!id || !titulo || !dataHoraInicio) {
        return null;
    }

    return {
        id,
        titulo,
        local: typeof raw.local === "string" ? raw.local.trim() : "",
        descricao: typeof raw.descricao === "string" ? raw.descricao.trim() : "",
        data_hora_inicio: dataHoraInicio,
    };
}

async function handleSync(request: Request) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const appsScriptUrl = process.env.GOOGLE_APPS_SCRIPT_URL;

    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
        return NextResponse.json(
            { error: "Configuração do Supabase incompleta." },
            { status: 500 }
        );
    }

    if (!appsScriptUrl) {
        return NextResponse.json(
            { error: "Google Apps Script não configurado." },
            { status: 500 }
        );
    }

    // 1. Verificar autenticação administrativa (Bearer Token)
    const authHeader = request.headers.get("authorization");
    let isAuthorized = false;
    let explicitUnidadeId: string | null = null;
    let userId: string | null = null;

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    });

    if (authHeader && authHeader.startsWith("Bearer ")) {
        const token = authHeader.substring(7);
        if (token === serviceRoleKey) {
            isAuthorized = true;
        }
    }

    // 2. Fallback para autenticação baseada em sessão de usuário logado
    if (!isAuthorized) {
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
                        // Ignora erro
                    }
                },
            },
        });

        const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
        if (user && !authError) {
            const { data: perfil } = await supabaseAdmin
                .from("perfis_usuarios")
                .select("unidade_id, modulos_acesso")
                .eq("id", user.id)
                .single();

            if (perfil && Array.isArray(perfil.modulos_acesso) && perfil.modulos_acesso.includes("agenda_global_editar")) {
                isAuthorized = true;
                explicitUnidadeId = perfil.unidade_id ?? "CG";
                userId = user.id;
            }
        }
    }

    if (!isAuthorized) {
        return NextResponse.json({ error: "Acesso não autorizado." }, { status: 401 });
    }

    // 3. Determinar quais unidades serão sincronizadas
    let unitsToSync: string[] = [];
    const { searchParams } = new URL(request.url);
    const paramUnidade = searchParams.get("unidade_id");

    if (paramUnidade) {
        const normalizedParam = paramUnidade.toUpperCase();
        if (normalizedParam !== "CG" && normalizedParam !== "DD") {
            return NextResponse.json({ error: "Unidade inválida. Use 'CG' ou 'DD'." }, { status: 400 });
        }
        unitsToSync = [normalizedParam];
    } else if (explicitUnidadeId) {
        // Se for um usuário autenticado, sincroniza apenas para a unidade dele
        unitsToSync = [explicitUnidadeId];
    } else {
        // Se for uma chamada externa do Cron administrativo, sincroniza para todas as unidades ativas
        const { data: activeUnits, error: unitsError } = await supabaseAdmin
            .from("unidades")
            .select("id")
            .eq("status", "ativo");

        if (unitsError || !activeUnits || activeUnits.length === 0) {
            unitsToSync = ["CG", "DD"]; // Fallback padrão
        } else {
            unitsToSync = activeUnits.map((u) => u.id.toUpperCase());
        }
    }

    // 4. Buscar eventos da agenda do Google
    let response: Response;
    try {
        response = await fetch(appsScriptUrl, {
            method: "GET",
            redirect: "follow",
            cache: "no-store",
            headers: {
                Accept: "application/json",
            },
        });
    } catch (err: any) {
        return NextResponse.json(
            { error: "Não consegui conectar ao Google Apps Script.", details: err.message },
            { status: 502 }
        );
    }

    if (!response.ok) {
        return NextResponse.json(
            { error: `Não consegui consultar a agenda externa (${response.status}).` },
            { status: 502 }
        );
    }

    let payload: unknown;
    try {
        payload = await response.json();
    } catch {
        return NextResponse.json(
            { error: "O endpoint da agenda não retornou JSON válido." },
            { status: 502 }
        );
    }

    if (!Array.isArray(payload)) {
        return NextResponse.json(
            { error: "O endpoint da agenda retornou um formato inesperado." },
            { status: 502 }
        );
    }

    // Normalizar e filtrar apenas eventos futuros
    const agora = Date.now();
    const eventosFuturos = payload
        .map(normalizarEventoGoogle)
        .filter((evento): evento is GoogleAgendaEvent => Boolean(evento))
        .filter((evento) => {
            const timestamp = new Date(evento.data_hora_inicio).getTime();
            return !Number.isNaN(timestamp) && timestamp >= agora;
        });

    if (eventosFuturos.length === 0) {
        return NextResponse.json({
            success: true,
            syncedCount: 0,
            unitsSynced: unitsToSync,
            message: "Nenhum evento futuro encontrado no calendário para sincronizar."
        });
    }

    let totalSynced = 0;
    const errors: string[] = [];

    // 5. Executar upsert para cada unidade identificada
    for (const unit of unitsToSync) {
        const linhas = eventosFuturos.map((evento) => ({
            google_event_id: evento.id,
            unidade_id: unit,
            tipo_agenda: GLOBAL_TIPO_AGENDA,
            titulo: evento.titulo,
            descricao: montarDescricaoOficial(evento.local, evento.descricao),
            status: "pendente",
            event_type: "agenda_oficial",
            data_inicio: evento.data_hora_inicio,
            data_fim: evento.data_hora_inicio,
            registro_status: "ativo",
            created_by: userId || null,
        }));

        const { error: upsertError } = await supabaseAdmin
            .from("tasks")
            .upsert(linhas, {
                onConflict: "google_event_id,unidade_id",
                ignoreDuplicates: false,
            });

        if (upsertError) {
            errors.push(`Erro na unidade ${unit}: ${upsertError.message}`);
        } else {
            totalSynced += linhas.length;
        }
    }

    if (errors.length > 0 && totalSynced === 0) {
        return NextResponse.json(
            { error: "Erro ao salvar os compromissos no banco de dados.", details: errors },
            { status: 500 }
        );
    }

    return NextResponse.json({
        success: true,
        syncedCount: totalSynced,
        unitsSynced: unitsToSync,
        warnings: errors.length > 0 ? errors : undefined,
    });
}

export async function GET(request: Request) {
    return handleSync(request);
}

export async function POST(request: Request) {
    return handleSync(request);
}
