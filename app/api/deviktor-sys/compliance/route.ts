export const runtime = 'edge';
import { NextResponse } from "next/server";
import { validateDevAccess, logSistema } from "@/lib/dev-auth";
import { z } from "zod";

const complianceSchema = z.object({
    action: z.enum(["export", "anonymize", "hard_delete"]),
    user_id: z.string().uuid(),
});

// Helper de criptografia Web Crypto API para hash SHA-256 (compatível com Edge e Node.js)
async function sha256(text: string, salt: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(text + salt);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function POST(request: Request) {
    try {
        const { authorized, errorResponse, supabaseAdmin, user } = await validateDevAccess();
        if (!authorized || !supabaseAdmin || !user) return errorResponse;

        const body = await request.json();
        const parsed = complianceSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ error: "Payload inválido", details: parsed.error.format() }, { status: 400 });
        }

        const { action, user_id } = parsed.data;

        if (action === "export") {
            // export: Colete perfis, assignments de tarefas, relatórios de agenda e logs de auditoria do usuário
            const [
                profileRes,
                legacyProfileRes,
                taskAssignmentsRes,
                tasksRes,
                relatoriosRes,
                oficiosHistoricoRes,
                oficiosRes,
                logsAuditoriaRes
            ] = await Promise.all([
                supabaseAdmin.from("perfis_usuarios").select("*").eq("id", user_id).maybeSingle(),
                supabaseAdmin.from("profiles").select("*").eq("id", user_id).maybeSingle(),
                supabaseAdmin.from("task_assignments").select("*").eq("user_id", user_id),
                supabaseAdmin.from("tasks").select("*").eq("created_by", user_id),
                supabaseAdmin.from("relatorios_agenda").select("*").eq("user_id", user_id),
                supabaseAdmin.from("oficios_historico").select("*").eq("realizado_por", user_id),
                supabaseAdmin.from("oficios").select("*").eq("created_by", user_id),
                supabaseAdmin.from("logs_auditoria").select("*").eq("realizado_por", user_id)
            ]);

            const exportData = {
                exported_at: new Date().toISOString(),
                user_id,
                perfis_usuarios: profileRes.data || null,
                profiles: legacyProfileRes.data || null,
                task_assignments: taskAssignmentsRes.data || [],
                tasks: tasksRes.data || [],
                relatorios_agenda: relatoriosRes.data || [],
                oficios_historico: oficiosHistoricoRes.data || [],
                oficios: oficiosRes.data || [],
                logs_auditoria: logsAuditoriaRes.data || []
            };

            await logSistema(
                supabaseAdmin,
                "COMPLIANCE",
                "INFO",
                `Exportação de dados LGPD solicitada para o usuário ${user_id} por ${user.email}`,
                { user_id, dev_email: user.email }
            );

            return NextResponse.json({ success: true, data: exportData });
        }

        if (action === "anonymize") {
            // anonymize: Aplique um hash irreversível SHA-256 com salt dinâmico sobre nome, e-mail e telefone
            const { data: profile } = await supabaseAdmin.from("perfis_usuarios").select("*").eq("id", user_id).maybeSingle();
            const { data: legacyProfile } = await supabaseAdmin.from("profiles").select("*").eq("id", user_id).maybeSingle();

            const salt = crypto.randomUUID();
            const nomeOriginal = profile?.nome || legacyProfile?.nome || "Nome Desconhecido";
            const emailOriginal = profile?.email || "";
            const telefoneOriginal = profile?.telefone || "";

            const anonNome = await sha256(nomeOriginal, salt);
            const anonEmail = emailOriginal ? `${(await sha256(emailOriginal, salt)).substring(0, 20)}@anonymized.local` : `${crypto.randomUUID()}@anonymized.local`;
            const anonTelefone = telefoneOriginal ? await sha256(telefoneOriginal, salt) : null;

            // 1. Atualizar perfil unificado
            const { error: errorPerfis } = await supabaseAdmin
                .from("perfis_usuarios")
                .update({
                    nome: `Anon-${anonNome.substring(0, 8)}`,
                    email: anonEmail,
                    telefone: anonTelefone,
                    modulos_acesso: [], // Limpa módulos de acesso
                    ativo: false, // Desativa o acesso
                })
                .eq("id", user_id);

            if (errorPerfis) {
                return NextResponse.json({ error: "Erro ao anonimizar perfis_usuarios: " + errorPerfis.message }, { status: 500 });
            }

            // 2. Atualizar perfil legado
            const { error: errorProfiles } = await supabaseAdmin
                .from("profiles")
                .update({
                    nome: `Anon-${anonNome.substring(0, 8)}`,
                })
                .eq("id", user_id);

            if (errorProfiles) {
                console.error("Erro ao atualizar profiles legado:", errorProfiles);
            }

            // 3. Atualizar e banir no auth.users
            const { error: errorAuth } = await supabaseAdmin.auth.admin.updateUserById(user_id, {
                email: anonEmail,
                email_confirm: true,
                ban_duration: '87600h', // Banir por 10 anos
            });

            if (errorAuth) {
                return NextResponse.json({ error: "Erro ao banir usuário no Auth: " + errorAuth.message }, { status: 500 });
            }

            await logSistema(
                supabaseAdmin,
                "COMPLIANCE",
                "WARNING",
                `Anonimização LGPD executada para o usuário ${user_id} por ${user.email}`,
                { user_id, dev_email: user.email }
            );

            return NextResponse.json({ success: true, message: "Usuário anonimizado com sucesso." });
        }

        if (action === "hard_delete") {
            // hard_delete: Exclua em cascata registros operacionais e elimine conta definitiva
            
            // 1. Deletar tabelas filhas/operacionais
            await supabaseAdmin.from("task_assignments").delete().eq("user_id", user_id);
            await supabaseAdmin.from("tasks").delete().eq("created_by", user_id);
            await supabaseAdmin.from("relatorios_agenda").delete().eq("user_id", user_id);
            await supabaseAdmin.from("oficios_historico").delete().eq("realizado_por", user_id);
            await supabaseAdmin.from("oficios").delete().eq("created_by", user_id);
            await supabaseAdmin.from("logs_auditoria").delete().eq("realizado_por", user_id);

            // 2. Deletar perfis locais
            await supabaseAdmin.from("perfis_usuarios").delete().eq("id", user_id);
            await supabaseAdmin.from("profiles").delete().eq("id", user_id);

            // 3. Excluir conta do Auth
            const { error: errorAuthDelete } = await supabaseAdmin.auth.admin.deleteUser(user_id);
            if (errorAuthDelete) {
                return NextResponse.json({ error: "Erro ao remover usuário do Auth: " + errorAuthDelete.message }, { status: 500 });
            }

            await logSistema(
                supabaseAdmin,
                "COMPLIANCE",
                "WARNING",
                `Exclusão definitiva (Hard Delete) de conta executada para o ID ${user_id} por ${user.email}`,
                { user_id, dev_email: user.email }
            );

            return NextResponse.json({ success: true, message: "Usuário excluído permanentemente com sucesso." });
        }

        return NextResponse.json({ error: "Ação não suportada" }, { status: 400 });
    } catch (error: any) {
        console.error("[deviktor-compliance] Crash Fatal:", error);
        return NextResponse.json({ error: 'Crash na API', message: error.message }, { status: 500 });
    }
}
