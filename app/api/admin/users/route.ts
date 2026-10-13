export const runtime = 'edge';
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

export async function GET(request: Request) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
        console.log("[list-users] Variaveis de ambiente ausentes.");
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

    try {
        // 1. Obter usuário logado
        const {
            data: { user: usuarioLogado },
            error: erroUsuario,
        } = await supabaseAuth.auth.getUser();

        if (erroUsuario || !usuarioLogado) {
            return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
        }

        // 2. Criar cliente com service role para consultas administrativas
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

        // Validar se tem o módulo para gerenciar usuários ou é super_admin
        const temModuloGerenciar = perfilChamador.modulos_acesso?.includes("usuarios_gerenciar");
        const ehSuperAdmin = perfilChamador.cargo === "super_admin";

        if (!temModuloGerenciar && !ehSuperAdmin) {
            return NextResponse.json({ error: "Acesso negado. Módulo insuficiente." }, { status: 403 });
        }

        // 4. Executar query de listagem
        let query = supabaseAdmin
            .from("perfis_usuarios")
            .select("id, nome, email, cargo, unidade_id, modulos_acesso, ativo");

        // Filtrar por unidade caso não seja super_admin
        if (!ehSuperAdmin) {
            query = query.eq("unidade_id", perfilChamador.unidade_id);
        }

        const { data: perfis, error: erroQuery } = await query;

        if (erroQuery || !perfis) {
            console.error("[list-users] Erro ao buscar perfis_usuarios:", erroQuery);
            return NextResponse.json({ error: "Erro ao buscar integrantes da equipe." }, { status: 500 });
        }

        // 5. Buscar avatares da tabela profiles em paralelo para enriquecer o payload
        const { data: profiles, error: erroProfiles } = await supabaseAdmin
            .from("profiles")
            .select("id, avatar_url");

        const avatarMap = new Map<string, string>();
        if (!erroProfiles && profiles) {
            profiles.forEach((p) => {
                if (p.avatar_url) avatarMap.set(p.id, p.avatar_url);
            });
        }

        // 6. Fazer o merge
        const usersWithAvatar = perfis.map((u) => ({
            ...u,
            avatar_url: avatarMap.get(u.id) || null,
        }));

        return NextResponse.json({ users: usersWithAvatar }, { status: 200 });
    } catch (e: any) {
        console.error("[list-users] Crash:", e);
        return NextResponse.json({ error: "Erro interno no servidor ao listar usuários.", details: e.message || String(e) }, { status: 500 });
    }
}
