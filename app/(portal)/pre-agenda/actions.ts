"use server";

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

type SyncAgendaResult =
    | {
          success: true;
          syncedCount: number;
      }
    | {
          success: false;
          error: string;
      };

const GLOBAL_TIPO_AGENDA = "GLOBAL" as const;

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

export async function syncGoogleAgendaAction(): Promise<SyncAgendaResult> {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const appsScriptUrl = process.env.GOOGLE_APPS_SCRIPT_URL;

    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
        return {
            success: false,
            error: "Configuração do Supabase incompleta.",
        };
    }

    if (!appsScriptUrl) {
        return {
            success: false,
            error: "Google Apps Script não configurado.",
        };
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
        error: authError,
    } = await supabaseAuth.auth.getUser();

    if (authError || !user) {
        return {
            success: false,
            error: "Faça login novamente.",
        };
    }

    const { data: perfil, error: perfilError } = await supabaseAdmin
        .from("perfis_usuarios")
        .select("id, nome, cargo, unidade_id, modulos_acesso")
        .eq("id", user.id)
        .single();

    if (perfilError || !perfil || !hasAgendaWritePermission(perfil.modulos_acesso)) {
        return {
            success: false,
            error: "Seu perfil não pode sincronizar a pré-agenda.",
        };
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
        return {
            success: false,
            error: legacyProfileError.message,
        };
    }

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
    } catch {
        return {
            success: false,
            error: "Não consegui conectar ao Google Apps Script.",
        };
    }

    if (!response.ok) {
        return {
            success: false,
            error: `Não consegui consultar a agenda externa (${response.status}).`,
        };
    }

    let payload: unknown;

    try {
        payload = await response.json();
    } catch {
        return {
            success: false,
            error: "O endpoint da agenda não retornou JSON válido.",
        };
    }

    if (!Array.isArray(payload)) {
        return {
            success: false,
            error: "O endpoint da agenda retornou um formato inesperado.",
        };
    }

    const agora = Date.now();
    const eventosFuturos = payload
        .map(normalizarEventoGoogle)
        .filter((evento): evento is GoogleAgendaEvent => Boolean(evento))
        .filter((evento) => {
            const timestamp = new Date(evento.data_hora_inicio).getTime();
            return !Number.isNaN(timestamp) && timestamp >= agora;
        });

    if (eventosFuturos.length === 0) {
        return {
            success: true,
            syncedCount: 0,
        };
    }

    const linhas = eventosFuturos.map((evento) => ({
        google_event_id: evento.id,
        unidade_id: perfil.unidade_id ?? "CG",
        tipo_agenda: GLOBAL_TIPO_AGENDA,
        titulo: evento.titulo,
        descricao: montarDescricaoOficial(evento.local, evento.descricao),
        status: "pendente",
        event_type: "agenda_oficial",
        data_inicio: evento.data_hora_inicio,
        data_fim: evento.data_hora_inicio,
        registro_status: "ativo",
        created_by: user.id,
    }));

    const { error: upsertError } = await supabaseAdmin
        .from("tasks")
        .upsert(linhas, {
            onConflict: "google_event_id,unidade_id",
            ignoreDuplicates: false,
        });

    if (upsertError) {
        return {
            success: false,
            error: upsertError.message,
        };
    }

    return {
        success: true,
        syncedCount: linhas.length,
    };
}
