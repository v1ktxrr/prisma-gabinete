export const runtime = 'edge';
import { NextResponse } from "next/server";
import { validateDevAccess, logSistema } from "@/lib/dev-auth";

export async function POST(request: Request) {
    const { authorized, errorResponse, supabaseAdmin, user } = await validateDevAccess();
    if (!authorized || !supabaseAdmin) return errorResponse;

    try {
        const body = await request.json();
        const { action } = body;

        if (!action) {
            return NextResponse.json({ error: "Ação é obrigatória" }, { status: 400 });
        }

        if (action === "sync_instagram_post") {
            const { task_id, post_url } = body;
            if (!task_id || !post_url) {
                return NextResponse.json({ error: "task_id e post_url são obrigatórios" }, { status: 400 });
            }

            await logSistema(
                supabaseAdmin,
                "INFRA",
                "INFO",
                `Sincronização manual do post ${post_url} iniciada por ${user?.email}`,
                { task_id, post_url, triggered_by: user?.id }
            );

            // Invoca a edge function no Supabase
            const { data, error } = await supabaseAdmin.functions.invoke("sync-instagram", {
                body: { task_id, post_url }
            });

            if (error) {
                await logSistema(
                    supabaseAdmin,
                    "INFRA",
                    "ERROR",
                    `Falha na sincronização manual do post ${task_id}: ${error.message || error}`,
                    { task_id, post_url, error }
                );
                return NextResponse.json({ error: error.message || "Erro na Edge Function" }, { status: 500 });
            }

            if (data && !data.success) {
                await logSistema(
                    supabaseAdmin,
                    "INFRA",
                    "WARNING",
                    `Função de sync retornou aviso para o post ${task_id}: ${data.error || data.message}`,
                    { task_id, post_url, data }
                );
                return NextResponse.json({ success: false, message: data.message || data.error }, { status: 200 });
            }

            await logSistema(
                supabaseAdmin,
                "INFRA",
                "INFO",
                `Sincronização manual do post ${task_id} concluída com sucesso.`,
                { task_id, post_url, response: data }
            );

            return NextResponse.json({ success: true, data }, { status: 200 });
        } 
        
        else if (action === "cleanup_ghost_users") {
            await logSistema(
                supabaseAdmin,
                "INFRA",
                "INFO",
                `Limpeza de usuários fantasmas iniciada por ${user?.email}`,
                { triggered_by: user?.id }
            );

            // 1. Obter usuários fantasmas (sem perfil correspondente e criados há mais de 10 min)
            const { data: ghosts, error: erroGhosts } = await supabaseAdmin.rpc("obter_usuarios_fantasmas");

            if (erroGhosts) {
                await logSistema(
                    supabaseAdmin,
                    "INFRA",
                    "ERROR",
                    `Falha ao obter usuários fantasmas no banco: ${erroGhosts.message}`,
                    { error: erroGhosts }
                );
                return NextResponse.json({ error: `Erro de banco: ${erroGhosts.message}` }, { status: 500 });
            }

            const ghostList = ghosts || [];
            if (ghostList.length === 0) {
                await logSistema(
                    supabaseAdmin,
                    "INFRA",
                    "INFO",
                    `Nenhum usuário fantasma detectado na base.`,
                    {}
                );
                return NextResponse.json({ success: true, message: "Nenhum usuário fantasma encontrado.", deleted_count: 0 }, { status: 200 });
            }

            // 2. Excluir cada um no Auth Admin API
            const deleted = [];
            const failed = [];

            for (const ghost of ghostList) {
                const { error: erroDelete } = await supabaseAdmin.auth.admin.deleteUser(ghost.id);
                if (erroDelete) {
                    failed.push({ id: ghost.id, email: ghost.email, error: erroDelete.message });
                } else {
                    deleted.push({ id: ghost.id, email: ghost.email });
                }
            }

            const level = failed.length > 0 ? "WARNING" : "INFO";
            await logSistema(
                supabaseAdmin,
                "INFRA",
                level,
                `Limpeza concluída. ${deleted.length} excluídos, ${failed.length} falhas.`,
                { deleted, failed }
            );

            return NextResponse.json({
                success: true,
                deleted_count: deleted.length,
                failed_count: failed.length,
                deleted,
                failed
            }, { status: 200 });
        } 
        
        else {
            return NextResponse.json({ error: "Ação não suportada" }, { status: 400 });
        }
    } catch (err: any) {
        console.error("[triggers] Erro:", err);
        return NextResponse.json({ error: err.message || "Erro interno" }, { status: 500 });
    }
}
