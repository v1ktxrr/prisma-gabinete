export const runtime = 'edge';
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

// Schema para persistência de trajetos no histórico
const saveRouteSchema = z.object({
    origem: z.string().min(1, "Origem é obrigatória.").max(250, "Origem muito longa."),
    destino: z.string().min(1, "Destino é obrigatório.").max(250, "Destino muito longo."),
    latitude_origem: z.number().min(-90).max(90).optional().nullable(),
    longitude_origem: z.number().min(-180).max(180).optional().nullable(),
    latitude_destino: z.number().min(-90).max(90).optional().nullable(),
    longitude_destino: z.number().min(-180).max(180).optional().nullable(),
    distancia_metros: z.number().int().nonnegative().optional().nullable(),
    duracao_segundos: z.number().int().nonnegative().optional().nullable()
});

async function createClients() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
        throw new Error("Configuração do Supabase incompleta no servidor.");
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
                    // Ignora
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

// GET: Retorna o histórico de rotas do próprio usuário autenticado
export async function GET() {
    try {
        const { supabaseAuth } = await createClients();

        const {
            data: { user },
            error: authError
        } = await supabaseAuth.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: "Sessão expirada ou não autenticada." }, { status: 401 });
        }

        // Consulta usando o cliente autenticado (a RLS garante que o usuário só acessa os próprios registros)
        const { data, error } = await supabaseAuth
            .from("rotas_historico")
            .select("*")
            .order("criado_em", { ascending: false });

        if (error) {
            console.error("[Route History GET] Erro ao buscar dados:", error);
            return NextResponse.json({ error: "Erro ao buscar histórico de rotas." }, { status: 500 });
        }

        return NextResponse.json({ routes: data || [] });

    } catch (error: any) {
        console.error("[Route History GET] Crash Fatal:", error);
        return NextResponse.json({ error: "Erro interno no servidor." }, { status: 500 });
    }
}

// POST: Salva um cálculo de trajeto no histórico do usuário autenticado
export async function POST(request: Request) {
    try {
        const { supabaseAuth, supabaseAdmin } = await createClients();

        const {
            data: { user },
            error: authError
        } = await supabaseAuth.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: "Sessão expirada ou não autenticada." }, { status: 401 });
        }

        let body;
        try {
            body = await request.json();
        } catch {
            return NextResponse.json({ error: "Payload JSON inválido." }, { status: 400 });
        }

        // Validação estrita
        const validation = saveRouteSchema.safeParse(body);
        if (!validation.success) {
            return NextResponse.json(
                { error: "Dados inválidos", details: validation.error.format() },
                { status: 400 }
            );
        }

        const routeData = validation.data;

        // Obter a unidade do perfil do usuário para isolamento multiunidade correto
        const { data: perfil, error: perfilError } = await supabaseAdmin
            .from("perfis_usuarios")
            .select("unidade_id")
            .eq("id", user.id)
            .single();

        if (perfilError || !perfil) {
            console.error("[Route History POST] Perfil do usuário não encontrado:", perfilError);
            return NextResponse.json({ error: "Perfil do usuário não configurado." }, { status: 400 });
        }

        const unidadeId = perfil.unidade_id;

        // Insere o registro atrelando o userId e unidadeId validados no servidor
        const { data, error } = await supabaseAuth
            .from("rotas_historico")
            .insert({
                user_id: user.id,
                unidade_id: unidadeId,
                origem: routeData.origem,
                destino: routeData.destino,
                latitude_origem: routeData.latitude_origem,
                longitude_origem: routeData.longitude_origem,
                latitude_destino: routeData.latitude_destino,
                longitude_destino: routeData.longitude_destino,
                distancia_metros: routeData.distancia_metros,
                duracao_segundos: routeData.duracao_segundos
            })
            .select()
            .single();

        if (error) {
            console.error("[Route History POST] Erro ao salvar histórico:", error);
            return NextResponse.json({ error: "Erro ao salvar histórico de rotas no banco." }, { status: 500 });
        }

        return NextResponse.json({ success: true, data }, { status: 201 });

    } catch (error: any) {
        console.error("[Route History POST] Crash Fatal:", error);
        return NextResponse.json({ error: "Erro interno no servidor." }, { status: 500 });
    }
}
