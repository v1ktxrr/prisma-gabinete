export const runtime = 'edge';
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

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

// DELETE: Exclui permanentemente todos os dados de histórico de localização do próprio usuário (Direito ao Esquecimento - LGPD)
export async function DELETE() {
    try {
        const { supabaseAuth, supabaseAdmin } = await createClients();

        const {
            data: { user },
            error: authError
        } = await supabaseAuth.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: "Sessão expirada ou não autenticada." }, { status: 401 });
        }

        // 1. Excluir o histórico de rotas e coordenadas do banco de dados
        // Usamos o supabaseAuth para a exclusão. A RLS garante que o usuário só consiga deletar o seu próprio histórico.
        const { count, error: deleteError } = await supabaseAuth
            .from("rotas_historico")
            .delete({ count: 'exact' })
            .eq("user_id", user.id);

        if (deleteError) {
            console.error("[LGPD Data Delete] Erro ao excluir dados:", deleteError);
            return NextResponse.json(
                { error: "Erro ao processar a exclusão de seus dados de localização no banco de dados." },
                { status: 500 }
            );
        }

        // 2. Registrar a ação de exclusão na tabela centralizada de logs_auditoria via Admin client
        const { error: logError } = await supabaseAdmin
            .from("logs_auditoria")
            .insert({
                acao: "EXCLUSAO_DADOS_LGPD",
                descricao: `Exclusão total do histórico de localização executada pelo usuário ID ${user.id} em conformidade com a LGPD (Direito ao Esquecimento).`,
                realizado_por: user.id
            });

        if (logError) {
            // Apenas logamos o erro, não impedimos a resposta de sucesso uma vez que a exclusão física dos dados já ocorreu
            console.error("[LGPD Data Delete] Falha ao registrar log de auditoria da exclusão:", logError);
        }

        return NextResponse.json({
            success: true,
            message: "Todos os seus dados de localização e rotas foram permanentemente apagados, em conformidade com a Lei Geral de Proteção de Dados (LGPD).",
            deleted_records_count: count || 0
        }, { status: 200 });

    } catch (error: any) {
        console.error("[LGPD Data Delete] Crash Fatal:", error);
        return NextResponse.json(
            { error: "Erro interno no servidor ao processar a solicitação de privacidade." },
            { status: 500 }
        );
    }
}
