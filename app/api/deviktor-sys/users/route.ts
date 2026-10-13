export const runtime = 'edge';
import { NextResponse } from "next/server";
import { validateDevAccess, logSistema } from "@/lib/dev-auth";
import { sendInviteEmail } from "@/lib/resend";

export async function GET() {
    try {
        const { authorized, errorResponse, supabaseAdmin } = await validateDevAccess();
        if (!authorized || !supabaseAdmin) return errorResponse;

        const { data: { users }, error: authError } = await supabaseAdmin.auth.admin.listUsers();
        
        if (authError) {
            return NextResponse.json({ error: authError.message }, { status: 500 });
        }

        const { data: profiles, error: profilesError } = await supabaseAdmin
            .from("perfis_usuarios")
            .select("*");

        if (profilesError) {
            return NextResponse.json({ error: profilesError.message }, { status: 500 });
        }

        const mergedUsers = users.map((user: any) => {
            const profile = profiles.find((p: any) => p.id === user.id) || {};
            return {
                id: user.id,
                email: user.email,
                created_at: user.created_at,
                last_sign_in_at: user.last_sign_in_at,
                ...profile,
                modulos: profile.modulos_acesso || [] // Mapear modulos_acesso para modulos para compatibilidade com o frontend
            };
        });

        return NextResponse.json(mergedUsers);
    } catch (error: any) {
        console.error("[deviktor-users GET] Crash Fatal:", error);
        return NextResponse.json({ error: 'Crash na API', message: error.message, stack: error.stack }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const { authorized, errorResponse, supabaseAdmin, user } = await validateDevAccess();
        if (!authorized || !supabaseAdmin) return errorResponse;

        const body = await request.json();
        const { email, password, nome, cargo, unidade_id, modulos, convidar } = body;

        if (!email || !nome || !cargo || !unidade_id) {
            return NextResponse.json({ error: "Campos obrigatórios ausentes." }, { status: 400 });
        }

        if (!convidar && !password) {
            return NextResponse.json({ error: "Senha é obrigatória para criação direta." }, { status: 400 });
        }

        let newUserId: string;

        if (convidar) {
            // Determinar redirectTo dinamicamente (Localhost vs Produção)
            const requestUrl = new URL(request.url);
            const origin = requestUrl.origin;
            const baseUrl = process.env.NEXT_PUBLIC_APP_URL || origin;
            const redirectTo = `${baseUrl.replace(/\/$/, '')}/login/definir-senha`;

            const { data: authData, error: authError } = await supabaseAdmin.auth.admin.generateLink({
                type: 'invite',
                email,
                options: {
                    redirectTo,
                    data: {
                        name: nome,
                        role: cargo,
                        unidade_id,
                    },
                },
            });

            if (authError || !authData?.user || !authData?.properties?.action_link) {
                return NextResponse.json({ error: authError?.message || "Erro ao gerar link de convite no Supabase Auth." }, { status: 500 });
            }

            const inviteLink = authData.properties.action_link;
            newUserId = authData.user.id;

            // Disparar e-mail de convite usando Resend
            const { success: successResend, error: erroResend } = await sendInviteEmail({
                email,
                nome,
                inviteLink,
                cargo,
                unidadeId: unidade_id,
            });

            if (!successResend) {
                console.error("[deviktor-users] Falha no disparo do e-mail via Resend:", erroResend);
                // Rollback do usuário criado
                await supabaseAdmin.auth.admin.deleteUser(newUserId);
                return NextResponse.json({ error: "Falha ao enviar e-mail de convite via Resend. A operação foi revertida." }, { status: 500 });
            }
        } else {
            // Criar usuário diretamente (sem e-mail de confirmação, confirmando o e-mail na hora)
            const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
                email,
                password,
                email_confirm: true,
                user_metadata: {
                    full_name: nome,
                    cargo,
                    unidade_id,
                }
            });

            if (authError || !authData.user) {
                return NextResponse.json({ error: authError?.message || "Erro ao criar usuário no Auth." }, { status: 500 });
            }
            newUserId = authData.user.id;
        }

        // Inserir perfil local na tabela perfis_usuarios (usando modulos_acesso correto e marcando como ativo)
        const { error: profileError } = await supabaseAdmin
            .from("perfis_usuarios")
            .insert({
                id: newUserId,
                nome,
                cargo,
                unidade_id,
                modulos_acesso: modulos || [], // Correção da coluna do banco
                email,
                ativo: true
            });

        if (profileError) {
            await supabaseAdmin.auth.admin.deleteUser(newUserId);
            return NextResponse.json({ error: profileError.message }, { status: 500 });
        }

        // Também salvar na tabela profiles legada para manter compatibilidade
        await supabaseAdmin
            .from("profiles")
            .insert({
                id: newUserId,
                nome,
                cargo,
            });

        await logSistema(
            supabaseAdmin,
            "ROOT_USERS",
            "INFO",
            convidar
                ? `Convite de acesso enviado para '${email}' pelo Cockpit Root.`
                : `Usuário '${email}' criado diretamente (com senha) pelo Cockpit Root.`,
            { target_email: email, target_id: newUserId, dev_email: user?.email }
        );

        return NextResponse.json({ success: true, id: newUserId });
    } catch (error: any) {
        console.error("[deviktor-users POST] Crash Fatal:", error);
        return NextResponse.json({ error: 'Crash na API', message: error.message, stack: error.stack }, { status: 500 });
    }
}
