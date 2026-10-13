export const runtime = 'edge';
import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const limit = Math.max(1, Math.min(100, parseInt(searchParams.get("limit") ?? "50", 10)));

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
        return NextResponse.json({ error: "Variáveis de ambiente ausentes no servidor." }, { status: 500 });
    }

    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseAnonKey) {
        return NextResponse.json({ error: "NEXT_PUBLIC_SUPABASE_ANON_KEY ausente." }, { status: 500 });
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

    // 1. Obter usuário logado
    const {
        data: { user: usuarioLogado },
        error: erroUsuario,
    } = await supabaseAuth.auth.getUser();

    if (erroUsuario || !usuarioLogado) {
        return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    // 2. Criar cliente administrativo
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    });

    // 3. Obter o perfil do chamador
    const { data: perfilChamador, error: erroPerfil } = await supabaseAdmin
        .from("perfis_usuarios")
        .select("cargo, unidade_id, modulos_acesso, ativo")
        .eq("id", usuarioLogado.id)
        .single();

    if (erroPerfil || !perfilChamador || !perfilChamador.ativo) {
        return NextResponse.json({ error: "Acesso negado. Perfil inativo ou inexistente." }, { status: 403 });
    }

    const temModuloGerenciar = perfilChamador.modulos_acesso?.includes("usuarios_gerenciar");
    const ehSuperAdmin = perfilChamador.cargo === "super_admin";

    if (!temModuloGerenciar && !ehSuperAdmin) {
        return NextResponse.json({ error: "Acesso negado. Permissão insuficiente." }, { status: 403 });
    }

    // 4. Se não for super_admin, obter IDs de todos os usuários pertencentes à mesma unidade para filtrar os logs
    let idsFiltro: string[] = [];
    if (!ehSuperAdmin) {
        const { data: perfisUnidade, error: erroPerfisUnidade } = await supabaseAdmin
            .from("perfis_usuarios")
            .select("id")
            .eq("unidade_id", perfilChamador.unidade_id);

        if (erroPerfisUnidade || !perfisUnidade) {
            console.error("[list-logs] Erro ao buscar perfis da unidade:", erroPerfisUnidade);
            return NextResponse.json({ error: "Erro ao resolver escopo da unidade." }, { status: 500 });
        }
        idsFiltro = perfisUnidade.map((p) => p.id);
    }

    // 5. Query total de registros
    let countQuery = supabaseAdmin
        .from("logs_auditoria")
        .select("id", { count: "exact", head: true });

    if (!ehSuperAdmin) {
        countQuery = countQuery.in("realizado_por", idsFiltro);
    }
    const { count, error: erroCount } = await countQuery;

    if (erroCount) {
        console.error("[list-logs] Erro ao contar logs:", erroCount);
        return NextResponse.json({ error: "Erro ao buscar logs." }, { status: 500 });
    }

    // 6. Query principal de logs paginada
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabaseAdmin
        .from("logs_auditoria")
        .select("id, acao, descricao, realizado_por, criado_em")
        .order("criado_em", { ascending: false })
        .range(from, to);

    if (!ehSuperAdmin) {
        query = query.in("realizado_por", idsFiltro);
    }

    const { data: logs, error: erroQuery } = await query;

    if (erroQuery || !logs) {
        console.error("[list-logs] Erro ao buscar logs:", erroQuery);
        return NextResponse.json({ error: "Erro ao buscar logs." }, { status: 500 });
    }

    // 7. Enriquecer os logs com nomes e e-mails dos executores
    const uniqueRealizadoPorIds = Array.from(new Set(logs.map((l) => l.realizado_por).filter(Boolean)));
    const { data: perfisExecutores, error: erroExecutores } = await supabaseAdmin
        .from("perfis_usuarios")
        .select("id, nome, email")
        .in("id", uniqueRealizadoPorIds);

    const executorMap = new Map<string, { nome: string; email: string }>();
    if (!erroExecutores && perfisExecutores) {
        perfisExecutores.forEach((p) => {
            executorMap.set(p.id, { nome: p.nome, email: p.email || "" });
        });
    }

    const enrichedLogs = logs.map((l) => ({
        ...l,
        realizado_por_nome: executorMap.get(l.realizado_por)?.nome || "Desconhecido",
        realizado_por_email: executorMap.get(l.realizado_por)?.email || "",
    }));

    return NextResponse.json(
        {
            logs: enrichedLogs,
            total: count || 0,
            page,
            limit,
            pages: Math.ceil((count || 0) / limit),
        },
        { status: 200 }
    );
}
