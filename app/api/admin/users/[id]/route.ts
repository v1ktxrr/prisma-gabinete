export const runtime = 'edge';
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { MODULOS_ACESSO } from "@/lib/types";

type CargoUsuario = "assessoria" | "secretaria" | "comunicacao" | "chefia" | "super_admin";
const MODULOS_PERMITIDOS = new Set<string>(MODULOS_ACESSO);

function validarCargo(cargo: string): cargo is CargoUsuario {
    return cargo === "assessoria" || cargo === "secretaria" || cargo === "comunicacao" || cargo === "chefia" || cargo === "super_admin";
}

function normalizarModulos(modulos: unknown) {
    if (!Array.isArray(modulos)) {
        return null;
    }

    const filtrados = modulos
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter((item) => item.length > 0 && MODULOS_PERMITIDOS.has(item));

    return Array.from(new Set(filtrados));
}

export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id: targetId } = await params;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
        console.log("[update-user] Variaveis de ambiente ausentes.");
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

    // 1. Obter usuário logado (administrador chamador)
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

    // 3. Buscar perfil do chamador
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

    // 4. Buscar o perfil do usuário alvo
    const { data: perfilAlvo, error: erroAlvo } = await supabaseAdmin
        .from("perfis_usuarios")
        .select("id, nome, cargo, unidade_id, email, modulos_acesso, ativo")
        .eq("id", targetId)
        .single();

    if (erroAlvo || !perfilAlvo) {
        console.log("[update-user] Perfil alvo nao encontrado.", { targetId, erroAlvo });
        return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });
    }

    // Validar se o administrador logado tem permissão sobre a unidade do alvo
    if (!ehSuperAdmin && perfilAlvo.unidade_id !== perfilChamador.unidade_id) {
        console.log("[update-user] Admin tentou editar usuario de outra unidade.", {
            callerUnidade: perfilChamador.unidade_id,
            targetUnidade: perfilAlvo.unidade_id,
        });
        return NextResponse.json({ error: "Acesso negado. Você só pode gerenciar usuários de sua própria unidade." }, { status: 403 });
    }

    // 5. Parsear e validar corpo da requisição
    let body: {
        nome?: string;
        cargo?: string;
        modulos_acesso?: unknown;
        ativo?: boolean;
        senha?: string;
    };

    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
    }

    const nome = body.nome?.trim() ?? perfilAlvo.nome;
    const cargo = body.cargo?.trim() ?? perfilAlvo.cargo;
    const modulosAcesso = body.modulos_acesso !== undefined ? normalizarModulos(body.modulos_acesso) : perfilAlvo.modulos_acesso;
    const ativo = body.ativo !== undefined ? Boolean(body.ativo) : perfilAlvo.ativo;
    const senha = body.senha?.trim();

    if (!validarCargo(cargo)) {
        return NextResponse.json({ error: "Cargo inválido." }, { status: 400 });
    }

    if (!modulosAcesso) {
        return NextResponse.json({ error: "Estrutura de módulos inválida." }, { status: 400 });
    }

    // Evitar que admins comuns promovam usuários a super_admin ou removam super_admin de alguém
    if (!ehSuperAdmin && (cargo === "super_admin" || perfilAlvo.cargo === "super_admin")) {
        return NextResponse.json({ error: "Acesso negado. Apenas o Super Admin pode criar ou editar outros Super Admins." }, { status: 403 });
    }

    console.log("[update-user] Atualizando usuario no Auth e Banco.", {
        targetId,
        nome,
        cargo,
        ativo,
        hasSenha: Boolean(senha),
    });

    // 6. Atualizar usuário no Supabase Auth (metadata, senha e banimento se inativo)
    const updateAuthParams: any = {
        user_metadata: {
            full_name: nome,
            cargo,
            unidade_id: perfilAlvo.unidade_id,
            modulos_acesso: modulosAcesso,
            ativo,
        },
    };

    if (senha) {
        updateAuthParams.password = senha;
    }

    // Soft Lock Impl: Se ativo = false, setamos ban_duration como permanente ('none'). Se ativo = true, liberamos ('0s')
    updateAuthParams.ban_duration = ativo ? "0s" : "none";

    const { data: userAuth, error: erroAuth } = await supabaseAdmin.auth.admin.updateUserById(
        targetId,
        updateAuthParams
    );

    if (erroAuth) {
        console.error("[update-user] Erro ao atualizar no Supabase Auth:", erroAuth);
        return NextResponse.json({ error: erroAuth.message }, { status: 400 });
    }

    // 7. Atualizar no banco: perfis_usuarios
    const { error: erroPerfisDb } = await supabaseAdmin
        .from("perfis_usuarios")
        .update({
            nome,
            cargo,
            modulos_acesso: modulosAcesso,
            ativo,
        })
        .eq("id", targetId);

    if (erroPerfisDb) {
        console.error("[update-user] Erro ao salvar perfis_usuarios:", erroPerfisDb);
        return NextResponse.json({ error: "Erro ao salvar perfil no banco." }, { status: 500 });
    }

    // 8. Atualizar no banco legado: profiles
    const { error: erroProfilesDb } = await supabaseAdmin
        .from("profiles")
        .update({
            nome,
            cargo,
        })
        .eq("id", targetId);

    if (erroProfilesDb) {
        console.error("[update-user] Erro ao salvar profiles:", erroProfilesDb);
        // Não falhamos a requisição por causa da tabela legada, mas logamos
    }

    // 9. Registrar auditoria
    const acaoAuditoria = perfilAlvo.ativo !== ativo
        ? (ativo ? "ATIVACAO_USUARIO" : "DESATIVACAO_USUARIO")
        : "ATUALIZACAO_USUARIO";

    const descAuditoria = perfilAlvo.ativo !== ativo
        ? `O Admin alterou status do usuario ${perfilAlvo.email} para ${ativo ? 'ATIVO' : 'INATIVO'}`
        : `O Admin alterou os dados cadastrais do usuario ${perfilAlvo.email}`;

    await supabaseAdmin
        .from("logs_auditoria")
        .insert({
            acao: acaoAuditoria,
            descricao: descAuditoria,
            realizado_por: usuarioLogado.id,
        });

    return NextResponse.json({ success: true }, { status: 200 });
}
