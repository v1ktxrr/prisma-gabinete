export const runtime = 'edge';
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { MODULOS_ACESSO } from "@/lib/types";

type CargoConvite = "assessoria" | "secretaria" | "comunicacao" | "chefia" | "super_admin";
type UnidadeId = "CG" | "DD";
const MODULOS_PERMITIDOS = new Set<string>(MODULOS_ACESSO);

function validarCargo(cargo: string): cargo is CargoConvite {
    return cargo === "assessoria" || cargo === "secretaria" || cargo === "comunicacao" || cargo === "chefia" || cargo === "super_admin";
}

function validarUnidade(unidadeId: string): unidadeId is UnidadeId {
    return unidadeId === "CG" || unidadeId === "DD";
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

export async function POST(request: Request) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
        console.log("[create-user] Variaveis de ambiente ausentes.", {
            hasSupabaseUrl: Boolean(supabaseUrl),
            hasSupabaseServiceKey: Boolean(supabaseServiceKey),
        });
        return NextResponse.json({ error: "Variáveis de ambiente do Supabase ausentes no servidor." }, { status: 500 });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    });

    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseAnonKey) {
        console.log("[create-user] NEXT_PUBLIC_SUPABASE_ANON_KEY ausente.");
        return NextResponse.json({ error: "NEXT_PUBLIC_SUPABASE_ANON_KEY ausente no servidor." }, { status: 500 });
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

    const {
        data: { user: usuarioLogado },
        error: erroUsuario,
    } = await supabaseAuth.auth.getUser();

    if (erroUsuario || !usuarioLogado) {
        console.log("[create-user] Falha ao obter usuario autenticado.", {
            erroUsuario,
            hasUser: Boolean(usuarioLogado),
        });
        return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    console.log("[create-user] Usuario autenticado identificado.", {
        callerUserId: usuarioLogado.id,
        callerEmail: usuarioLogado.email,
    });

    const { data: perfil, error: erroPerfil } = await supabaseAdmin
        .from("perfis_usuarios")
        .select("cargo, unidade_id")
        .eq("id", usuarioLogado.id)
        .single();

    if (erroPerfil || (perfil?.cargo !== "chefia" && perfil?.cargo !== "super_admin")) {
        console.log("[create-user] Falha na validacao de cargo.", {
            callerUserId: usuarioLogado.id,
            perfil,
            erroPerfil,
        });
        return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }

    let body: {
        email?: string;
        senha?: string;
        nome?: string;
        cargo?: string;
        unidade_id?: string;
        modulos_acesso?: unknown;
    };

    try {
        body = await request.json();
    } catch {
        console.log("[create-user] JSON invalido no corpo da requisicao.");
        return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
    }

    const email = body.email?.trim().toLowerCase();
    const senha = body.senha?.trim();
    const nome = body.nome?.trim();
    const cargo = body.cargo?.trim();
    const unidadeId = body.unidade_id?.trim();
    const modulosAcesso = normalizarModulos(body.modulos_acesso);

    console.log("[create-user] Payload recebido.", {
        email,
        nome,
        cargo,
        unidadeId,
        modulosAcesso,
        hasSenha: Boolean(senha),
    });

    if (!email || !senha || !nome || !cargo || !unidadeId || !modulosAcesso) {
        console.log("[create-user] Campos obrigatorios ausentes.", {
            email,
            nome,
            cargo,
            unidadeId,
            modulosAcesso,
            hasSenha: Boolean(senha),
        });
        return NextResponse.json(
            { error: "Campos obrigatórios: email, senha, nome, cargo, unidade_id e modulos_acesso." },
            { status: 400 }
        );
    }

    if (!validarCargo(cargo)) {
        console.log("[create-user] Cargo invalido recebido.", { cargo });
        return NextResponse.json(
            { error: "Cargo inválido. Use: assessoria, secretaria, comunicacao, chefia ou super_admin." },
            { status: 400 }
        );
    }

    if (!validarUnidade(unidadeId)) {
        console.log("[create-user] Unidade invalida recebida.", { unidadeId });
        return NextResponse.json(
            { error: "Unidade inválida. Use: CG ou DD." },
            { status: 400 }
        );
    }

    if (perfil?.cargo === "chefia" && perfil.unidade_id !== unidadeId) {
        console.log("[create-user] Chefia tentando criar usuario em outra unidade.", {
            callerUnidade: perfil.unidade_id,
            targetUnidade: unidadeId,
        });
        return NextResponse.json(
            { error: "Acesso negado. Você só pode convidar usuários para a sua própria unidade." },
            { status: 403 }
        );
    }

    if (modulosAcesso.length === 0) {
        console.log("[create-user] Nenhum modulo valido recebido.", { modulosAcesso });
        return NextResponse.json(
            { error: "Selecione ao menos um módulo de acesso válido." },
            { status: 400 }
        );
    }

    const { data, error: erroCriacaoUsuario } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: senha,
        email_confirm: true,
        user_metadata: {
            full_name: nome,
            cargo,
            unidade_id: unidadeId,
            modulos_acesso: modulosAcesso,
            ativo: true,
        },
    });

    if (erroCriacaoUsuario || !data.user) {
        console.log("[create-user] Falha no admin.createUser.", {
            email,
            erroCriacaoUsuario,
            data,
        });
        return NextResponse.json(
            { error: erroCriacaoUsuario?.message ?? "Não foi possível criar o usuário." },
            { status: 400 }
        );
    }

    const userId = data.user.id;

    console.log("[create-user] Usuario criado no Auth.", {
        userId,
        email,
    });

    const { data: perfilPersistido, error: erroPersistenciaPerfil } = await supabaseAdmin
        .from("perfis_usuarios")
        .upsert({
            id: userId,
            nome,
            email,
            cargo,
            unidade_id: unidadeId,
            modulos_acesso: modulosAcesso,
            ativo: true,
        }, {
            onConflict: "id",
        })
        .select("id, nome, email, cargo, unidade_id, modulos_acesso, ativo")
        .single();

    if (erroPersistenciaPerfil) {
        console.log("[create-user] Falha ao persistir perfil em perfis_usuarios.", {
            userId,
            payload: { id: userId, nome, cargo, unidade_id: unidadeId, modulos_acesso: modulosAcesso },
            erroPersistenciaPerfil,
        });

        const { error: erroDeleteUser } = await supabaseAdmin.auth.admin.deleteUser(userId);
        console.log("[create-user] Rollback de usuario no Auth executado.", {
            userId,
            erroDeleteUser,
        });

        return NextResponse.json(
            { error: "Usuário criado, mas falhou ao salvar perfil." },
            { status: 500 }
        );
    }

    console.log("[create-user] Perfil persistido com sucesso.", {
        userId,
        perfilPersistido,
    });

    const { error: erroPerfilLegado } = await supabaseAdmin
        .from("profiles")
        .upsert(
            {
                id: userId,
                nome,
                cargo,
            },
            { onConflict: "id" }
        );

    if (erroPerfilLegado) {
        console.log("[create-user] Falha ao persistir perfil legado em profiles.", {
            userId,
            payload: { id: userId, nome, cargo },
            erroPerfilLegado,
        });

        const { error: erroDeleteUser } = await supabaseAdmin.auth.admin.deleteUser(userId);
        console.log("[create-user] Rollback de usuario no Auth apos falha em profiles.", {
            userId,
            erroDeleteUser,
        });

        return NextResponse.json(
            { error: "Usuario criado, mas falhou ao salvar perfil legado." },
            { status: 500 }
        );
    }

    const { error: erroAuditoria } = await supabaseAdmin
        .from("logs_auditoria")
        .insert({
            acao: "CRIACAO_USUARIO",
            descricao: `O Chefe de Gabinete criou o perfil para o email ${email}`,
            realizado_por: usuarioLogado.id,
        });

    if (erroAuditoria) {
        console.log("[create-user] Falha ao registrar auditoria da criacao de usuario.", {
            callerUserId: usuarioLogado.id,
            createdUserId: userId,
            email,
            erroAuditoria,
        });

        return NextResponse.json(
            { error: "Usuário criado, mas falhou ao registrar auditoria." },
            { status: 500 }
        );
    }

    console.log("[create-user] Auditoria registrada com sucesso.", {
        callerUserId: usuarioLogado.id,
        createdUserId: userId,
        email,
    });

    return NextResponse.json({ success: true }, { status: 200 });
}
