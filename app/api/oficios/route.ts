export const runtime = 'edge';
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

type PerfilOficios = {
    cargo: string | null;
    unidade_id: string | null;
    modulos_acesso: unknown;
};

function normalizarModulos(modulos: unknown) {
    return Array.isArray(modulos)
        ? modulos.filter((modulo): modulo is string => typeof modulo === "string")
        : [];
}

function temAcessoOficios(perfil: PerfilOficios, permissao: "ver" | "tramitar") {
    if (perfil.cargo === "chefia") {
        return true;
    }

    const modulos = normalizarModulos(perfil.modulos_acesso);

    if (permissao === "ver") {
        return modulos.includes("oficios_ver") || modulos.includes("oficios_tramitar");
    }

    return modulos.includes("oficios_tramitar");
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

// GET: Retorna a lista de ofícios da unidade do usuário, ou um ofício específico com seu histórico de tramitação
export async function GET(request: Request) {
    let supabaseAuth;
    let supabaseAdmin;

    try {
        ({ supabaseAuth, supabaseAdmin } = await createClients());
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Falha na configuração do servidor." },
            { status: 500 }
        );
    }

    try {
        // OTIMIZAÇÃO (GET): usa getSession() para ler o usuário do JWT local.
        // O middleware já garantiu a validade do token antes deste handler ser chamado.
        // Evita uma segunda chamada de rede ao Supabase (~150–250ms por request).
        const {
            data: { session },
            error: authError,
        } = await supabaseAuth.auth.getSession();

        const user = session?.user ?? null;

        if (authError || !user) {
            return NextResponse.json({ error: "Sessão expirada ou não autenticada." }, { status: 401 });
        }

        // Obter perfil do usuário
        const { data: perfil, error: perfilError } = await supabaseAdmin
            .from("perfis_usuarios")
            .select("cargo, unidade_id, modulos_acesso")
            .eq("id", user.id)
            .single();

        if (perfilError || !perfil || !perfil.unidade_id) {
            return NextResponse.json({ error: "Perfil do usuário não encontrado ou sem unidade configurada." }, { status: 403 });
        }

        if (!temAcessoOficios(perfil, "ver")) {
            return NextResponse.json({ error: "Acesso negado ao módulo de ofícios." }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const oficioId = searchParams.get("id")?.trim();

        // Se um ID específico foi solicitado, retorna o ofício E o histórico de tramitação
        if (oficioId) {
        const [{ data: oficio, error: oficioError }, { data: historico, error: historicoError }] =
            await Promise.all([
                supabaseAdmin
                    .from("oficios")
                    .select(`
                        *,
                        atendimentos (
                            id,
                            titulo
                        )
                    `)
                    .eq("id", oficioId)
                    .eq("unidade_id", perfil.unidade_id)
                    .maybeSingle(),
                supabaseAdmin
                    .from("oficios_historico")
                    .select(`
                        *,
                        profiles:realizado_por (
                            nome,
                            cargo
                        )
                    `)
                    .eq("oficio_id", oficioId)
                    .order("criado_em", { ascending: false })
            ]);

        if (oficioError) {
            return NextResponse.json({ error: oficioError.message }, { status: 500 });
        }

        if (historicoError) {
            return NextResponse.json({ error: historicoError.message }, { status: 500 });
        }

        if (!oficio) {
            return NextResponse.json({ error: "Ofício não encontrado ou sem permissão de acesso." }, { status: 404 });
        }

        return NextResponse.json({ oficio, historico: historico ?? [] }, { status: 200 });
    }

    // Caso contrário, busca a lista completa da unidade + lista de atendimentos
    const [{ data: oficios, error: oficiosError }, { data: atendimentos, error: atendimentosError }] =
        await Promise.all([
            supabaseAdmin
                .from("oficios")
                .select(`
                    *,
                    atendimentos (
                        id,
                        titulo
                    )
                `)
                .eq("unidade_id", perfil.unidade_id)
                .order("criado_em", { ascending: false }),
            supabaseAdmin
                .from("atendimentos")
                .select("id, titulo, status, data, criado_em")
                .eq("unidade_id", perfil.unidade_id)
                .order("criado_em", { ascending: false })
        ]);

    if (oficiosError) {
        return NextResponse.json({ error: oficiosError.message }, { status: 500 });
    }

    if (atendimentosError) {
        return NextResponse.json({ error: atendimentosError.message }, { status: 500 });
    }

    return NextResponse.json({
        oficios: oficios ?? [],
        atendimentos: atendimentos ?? []
    }, { status: 200 });
    } catch (e: any) {
        console.error("[Oficios GET] Crash:", e);
        return NextResponse.json({ error: "Erro interno no servidor", details: e.message || String(e) }, { status: 500 });
    }
}

// POST: Cria ou edita um ofício com injeção segura de unidade_id e created_by, registrando histórico de tramitação
export async function POST(request: Request) {
    let supabaseAuth;
    let supabaseAdmin;

    try {
        ({ supabaseAuth, supabaseAdmin } = await createClients());
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Falha na configuração do servidor." },
            { status: 500 }
        );
    }

    try {
        // SEGURANÇA (POST): mantém getUser() para verificação de token em tempo real contra revogação.
        // Mutações em um ERP governamental exigem garantia de que a sessão ainda está ativa no servidor.
        const {
            data: { user },
            error: authError,
        } = await supabaseAuth.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: "Sessão expirada ou não autenticada." }, { status: 401 });
        }

        // Obter perfil do usuário logado
        const { data: perfil, error: perfilError } = await supabaseAdmin
            .from("perfis_usuarios")
            .select("cargo, unidade_id, modulos_acesso")
            .eq("id", user.id)
            .single();

        if (perfilError || !perfil || !perfil.unidade_id) {
            return NextResponse.json({ error: "Perfil do usuário não encontrado ou sem unidade configurada." }, { status: 403 });
        }

        if (!temAcessoOficios(perfil, "tramitar")) {
            return NextResponse.json({ error: "Acesso negado para tramitar ofícios." }, { status: 403 });
        }

        let body;
        try {
            body = await request.json();
        } catch {
            return NextResponse.json({ error: "JSON de entrada inválido." }, { status: 400 });
        }

        const {
            id,
            atendimento_id,
            numero,
            titulo,
            destinatario,
            status,
            data_emissao,
            prazo_resposta,
            data_recebimento,
            arquivo_url,
            // Campos opcionais para customizar a tramitação
            acao_tramitacao,
            descricao_tramitacao
        } = body;

        // Validações básicas obrigatórias
        if (!numero?.trim() || !titulo?.trim() || !destinatario?.trim() || !status || !data_emissao) {
            return NextResponse.json({ error: "Os campos número, título, destinatário, status e data de emissão são obrigatórios." }, { status: 400 });
        }

        // Validar status permitido
        const statusPermitidos = ["pendente", "em_analise", "encaminhado", "concluido", "arquivado"];
        if (!statusPermitidos.includes(status)) {
            return NextResponse.json({ error: "Status inválido." }, { status: 400 });
        }

        // Validar se o atendimento pertence à mesma unidade, se vinculado
        if (atendimento_id) {
            const { data: atendimento, error: atendimentoError } = await supabaseAdmin
                .from("atendimentos")
                .select("id")
                .eq("id", atendimento_id)
                .eq("unidade_id", perfil.unidade_id)
                .maybeSingle();

            if (atendimentoError || !atendimento) {
                return NextResponse.json({ error: "O atendimento vinculado não existe ou pertence a outra unidade." }, { status: 400 });
            }
        }

        const payload = {
            numero: numero.trim(),
            titulo: titulo.trim(),
            destinatario: destinatario.trim(),
            status,
            data_emissao,
            prazo_resposta: prazo_resposta || null,
            data_recebimento: data_recebimento || null,
            atendimento_id: atendimento_id || null,
            arquivo_url: arquivo_url || null,
        };

        if (id) {
            // Modo Edição (UPDATE): Garantir que pertence à mesma unidade do usuário logado
            const { data: existente, error: existenteError } = await supabaseAdmin
                .from("oficios")
                .select("id, status, destinatario")
                .eq("id", id)
                .eq("unidade_id", perfil.unidade_id)
                .maybeSingle();

            if (existenteError || !existente) {
                return NextResponse.json({ error: "Ofício não encontrado ou sem permissão de edição." }, { status: 404 });
            }

            const { data: oficioAtualizado, error: updateError } = await supabaseAdmin
                .from("oficios")
                .update(payload)
                .eq("id", id)
                .select(`
                    *,
                    atendimentos (
                        id,
                        titulo
                    )
                `)
                .single();

            if (updateError) {
                return NextResponse.json({ error: updateError.message }, { status: 500 });
            }

            // --- HISTÓRICO DE TRAMITAÇÃO AUTOMÁTICO ---
            let acaoHistorico = acao_tramitacao || "status_alterado";
            let descHistorico = descricao_tramitacao || "";

            if (!descricao_tramitacao) {
                if (existente.status !== status) {
                    descHistorico = `Status alterado de "${existente.status}" para "${status}".`;
                    acaoHistorico = "status_alterado";
                } else if (existente.destinatario !== destinatario) {
                    descHistorico = `Documento reencaminhado. Novo destinatário: ${destinatario}.`;
                    acaoHistorico = "encaminhado";
                } else {
                    descHistorico = "Dados cadastrais do documento atualizados.";
                    acaoHistorico = "status_alterado";
                }
            }

            await supabaseAdmin
                .from("oficios_historico")
                .insert({
                    oficio_id: id,
                    acao: acaoHistorico,
                    descricao: descHistorico,
                    realizado_por: user.id
                });

            return NextResponse.json({ success: true, oficio: oficioAtualizado }, { status: 200 });
        } else {
            // Modo Criação (INSERT): Injetar unidade_id do perfil e created_by
            const insertPayload = {
                ...payload,
                unidade_id: perfil.unidade_id,
                created_by: user.id
            };

            const { data: novoOficio, error: insertError } = await supabaseAdmin
                .from("oficios")
                .insert(insertPayload)
                .select(`
                    *,
                    atendimentos (
                        id,
                        titulo
                    )
                `)
                .single();

            if (insertError) {
                return NextResponse.json({ error: insertError.message }, { status: 500 });
            }

            // --- REGISTRO DE ENTRADA NO PROTOCOLO ---
            await supabaseAdmin
                .from("oficios_historico")
                .insert({
                    oficio_id: novoOficio.id,
                    acao: "recebido",
                    descricao: descricao_tramitacao || "Documento recebido e protocolado no gabinete.",
                    realizado_por: user.id
                });

            return NextResponse.json({ success: true, oficio: novoOficio }, { status: 201 });
        }
    } catch (e: any) {
        console.error("[Oficios POST] Crash:", e);
        return NextResponse.json({ error: "Erro interno no servidor", details: e.message || String(e) }, { status: 500 });
    }
}

// DELETE: Exclui um ofício, verificando unidade
export async function DELETE(request: Request) {
    let supabaseAuth;
    let supabaseAdmin;

    try {
        ({ supabaseAuth, supabaseAdmin } = await createClients());
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Falha na configuração do servidor." },
            { status: 500 }
        );
    }

    try {
        // SEGURANÇA (DELETE): mantém getUser() para verificação de token em tempo real contra revogação.
        // Operações destrutivas exigem validação no servidor do Supabase.
        const {
            data: { user },
            error: authError,
        } = await supabaseAuth.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: "Sessão expirada ou não autenticada." }, { status: 401 });
        }

        const { data: perfil, error: perfilError } = await supabaseAdmin
            .from("perfis_usuarios")
            .select("cargo, unidade_id, modulos_acesso")
            .eq("id", user.id)
            .single();

        if (perfilError || !perfil || !perfil.unidade_id) {
            return NextResponse.json({ error: "Perfil do usuário não encontrado ou sem unidade configurada." }, { status: 403 });
        }

        if (!temAcessoOficios(perfil, "tramitar")) {
            return NextResponse.json({ error: "Acesso negado para excluir ofícios." }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const id = searchParams.get("id")?.trim();

        if (!id) {
            return NextResponse.json({ error: "ID do ofício é obrigatório para exclusão." }, { status: 400 });
        }

        // Exclusão protegida pelo ID e unidade_id
        const { data: excluido, error: deleteError } = await supabaseAdmin
            .from("oficios")
            .delete()
            .eq("id", id)
            .eq("unidade_id", perfil.unidade_id)
            .select("id");

        if (deleteError) {
            return NextResponse.json({ error: deleteError.message }, { status: 500 });
        }

        if (!excluido || excluido.length === 0) {
            return NextResponse.json({ error: "Ofício não encontrado ou sem permissão de exclusão." }, { status: 404 });
        }

        return NextResponse.json({ success: true }, { status: 200 });
    } catch (e: any) {
        console.error("[Oficios DELETE] Crash:", e);
        return NextResponse.json({ error: "Erro interno no servidor ao excluir ofício", details: e.message || String(e) }, { status: 500 });
    }
}
