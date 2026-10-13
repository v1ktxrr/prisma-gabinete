export const runtime = 'edge';
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { MODULOS_ACESSO } from "@/lib/types";
import { sendInviteEmail } from "@/lib/resend";

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
        return [];
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
        console.error("[invite-user] Variáveis de ambiente ausentes no servidor.");
        return NextResponse.json({ error: "Variáveis de ambiente do Supabase ausentes no servidor." }, { status: 500 });
    }

    // Inicialização segura com Service Role (Root access)
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    });

    // 1. Autenticação e RBAC do chamador (Caller validation)
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseAnonKey) {
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
        console.warn("[invite-user] Tentativa de acesso sem autenticação.");
        return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    // Obter cargo do usuário logado
    const { data: perfilLogado, error: erroPerfilLogado } = await supabaseAdmin
        .from("perfis_usuarios")
        .select("cargo, unidade_id")
        .eq("id", usuarioLogado.id)
        .single();

    if (erroPerfilLogado || (perfilLogado?.cargo !== "chefia" && perfilLogado?.cargo !== "super_admin")) {
        console.warn("[invite-user] Permissão negada para o usuário:", usuarioLogado.id);
        return NextResponse.json({ error: "Acesso negado. Apenas chefia ou super_admin podem convidar novos usuários." }, { status: 403 });
    }

    // 2. Leitura e validação dos parâmetros do corpo da requisição
    let body: {
        email?: string;
        nome?: string;
        cargo?: string;
        unidade_id?: string;
        modulos_acesso?: unknown;
    };

    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "JSON inválido no corpo da requisição." }, { status: 400 });
    }

    const email = body.email?.trim().toLowerCase();
    const nome = body.nome?.trim();
    const cargo = body.cargo?.trim();
    const unidadeId = body.unidade_id?.trim();
    const modulosAcesso = normalizarModulos(body.modulos_acesso);

    if (!email || !nome || !cargo || !unidadeId) {
        return NextResponse.json(
            { error: "Campos obrigatórios ausentes: email, nome, cargo, unidade_id." },
            { status: 400 }
        );
    }

    if (!validarCargo(cargo)) {
        return NextResponse.json(
            { error: "Cargo inválido. Cargos permitidos: assessoria, secretaria, comunicacao, chefia ou super_admin." },
            { status: 400 }
        );
    }

    if (!validarUnidade(unidadeId)) {
        return NextResponse.json(
            { error: "Unidade inválida. Unidades permitidas: CG ou DD." },
            { status: 400 }
        );
    }

    // Garantir isolamento por unidade_id se o chamador for do cargo chefia
    if (perfilLogado.cargo === "chefia" && perfilLogado.unidade_id !== unidadeId) {
        console.warn(`[invite-user] Usuário ${usuarioLogado.id} (chefia da unidade ${perfilLogado.unidade_id}) tentou convidar usuário para a unidade ${unidadeId}`);
        return NextResponse.json(
            { error: "Acesso negado. Você só pode convidar usuários para a sua própria unidade." },
            { status: 403 }
        );
    }

    // 3. Determinar redirectTo dinamicamente (Localhost vs Produção)
    const requestUrl = new URL(request.url);
    const origin = requestUrl.origin;
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || origin;
    const redirectTo = `${baseUrl.replace(/\/$/, '')}/login/definir-senha`;

    console.log("[invite-user] Disparando convite Supabase Auth para:", email, "com redirect para:", redirectTo);

    // 4. Gerar link de convite via Supabase Auth
    const { data: dataConvite, error: erroConvite } = await supabaseAdmin.auth.admin.generateLink({
        type: 'invite',
        email,
        options: {
            redirectTo,
            data: {
                name: nome,
                role: cargo,
                unidade_id: unidadeId,
            },
        },
    });

    if (erroConvite || !dataConvite?.user || !dataConvite?.properties?.action_link) {
        console.error("[invite-user] Erro do Supabase Auth no generateLink:", erroConvite);
        
        const status = erroConvite?.status || 400;
        const msg = erroConvite?.message || "";

        if (msg.toLowerCase().includes("already exists") || msg.toLowerCase().includes("já existe")) {
            return NextResponse.json(
                { error: "Este e-mail já está cadastrado no sistema." },
                { status: 400 }
            );
        }

        if (status === 429 || msg.toLowerCase().includes("rate limit") || msg.toLowerCase().includes("too many requests")) {
            return NextResponse.json(
                { error: "Limite de envio de e-mails de convite atingido. Por favor, tente novamente em alguns instantes." },
                { status: 429 }
            );
        }

        return NextResponse.json(
            { error: `Falha ao gerar convite: ${msg || "Erro interno"}` },
            { status: status >= 400 && status < 600 ? status : 500 }
        );
    }

    const userId = dataConvite.user.id;
    const inviteLink = dataConvite.properties.action_link;
    console.log("[invite-user] Convite gerado no Supabase Auth. Novo UserID:", userId);

    // 4.5. Disparar e-mail via Resend
    const { success: successResend, error: erroResend } = await sendInviteEmail({
        email,
        nome,
        inviteLink,
        cargo,
        unidadeId,
    });

    if (!successResend) {
        console.error("[invite-user] Falha ao enviar e-mail pelo Resend:", erroResend);
        
        // Rollback do usuário criado para manter consistência
        await supabaseAdmin.auth.admin.deleteUser(userId);

        return NextResponse.json(
            { error: "Falha ao enviar o e-mail de convite via Resend. O cadastro foi revertido." },
            { status: 500 }
        );
    }

    console.log("[invite-user] E-mail de convite enviado via Resend com sucesso.");

    // 5. Inserir na tabela perfis_usuarios (com ativo = true para marcar como pré-ativo/ativo)
    const { error: erroPersistenciaPerfil } = await supabaseAdmin
        .from("perfis_usuarios")
        .upsert({
            id: userId,
            nome,
            email,
            cargo,
            unidade_id: unidadeId,
            modulos_acesso: modulosAcesso,
            ativo: true, // Garante que consta como ativo/permitido no banco
        }, {
            onConflict: "id",
        });

    if (erroPersistenciaPerfil) {
        console.error("[invite-user] Erro ao persistir perfis_usuarios. Executando rollback...", erroPersistenciaPerfil);
        
        // Rollback do usuário convidado
        await supabaseAdmin.auth.admin.deleteUser(userId);
        
        return NextResponse.json(
            { error: "Convite gerado, mas falhou ao salvar o perfil do usuário no banco local." },
            { status: 500 }
        );
    }

    // 6. Inserir também no profiles (legado) para manter compatibilidade
    const { error: erroPerfilLegado } = await supabaseAdmin
        .from("profiles")
        .upsert({
            id: userId,
            nome,
            cargo,
        }, {
            onConflict: "id"
        });

    if (erroPerfilLegado) {
        console.error("[invite-user] Erro ao persistir perfil legado em profiles. Executando rollback...", erroPerfilLegado);
        
        // Rollback completo
        await supabaseAdmin.from("perfis_usuarios").delete().eq("id", userId);
        await supabaseAdmin.auth.admin.deleteUser(userId);

        return NextResponse.json(
            { error: "Convite gerado, mas falhou ao salvar perfil legado no banco." },
            { status: 500 }
        );
    }

    // 7. Auditoria da ação administrativa
    await supabaseAdmin
        .from("logs_auditoria")
        .insert({
            acao: "CONVITE_USUARIO",
            descricao: `Usuário convidado por e-mail: ${email} (Cargo: ${cargo}, Unidade: ${unidadeId})`,
            realizado_por: usuarioLogado.id,
        });

    return NextResponse.json({ success: true, user: { id: userId, email } }, { status: 200 });
}
