import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function validateDevAccess() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
        return { 
            authorized: false, 
            errorResponse: NextResponse.json({ error: "Configuração ausente" }, { status: 500 }), 
            supabaseAdmin: null,
            user: null
        };
    }

    try {
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
            return { 
                authorized: false, 
                errorResponse: NextResponse.json({ error: "Not Found" }, { status: 404 }), 
                supabaseAdmin: null,
                user: null
            };
        }

        const devEmails = (process.env.DEV_EMAILS || "")
            .split(",")
            .map((email) => email.trim().toLowerCase())
            .filter(Boolean);

        const userEmail = usuarioLogado.email?.toLowerCase();
        if (!userEmail || !devEmails.includes(userEmail)) {
            return { 
                authorized: false, 
                errorResponse: NextResponse.json({ error: "Not Found" }, { status: 404 }), 
                supabaseAdmin: null,
                user: null
            };
        }

        // Validação de MFA (AAL2 obrigatório)
        const bypassMfa = process.env.DEV_BYPASS_MFA === "true";
        if (!bypassMfa) {
            const { data: mfaData, error: mfaError } = await supabaseAuth.auth.mfa.getAuthenticatorAssuranceLevel();
            if (mfaError || !mfaData || mfaData.currentLevel !== "aal2") {
                return {
                    authorized: false,
                    errorResponse: NextResponse.json(
                        { error: "MFA_REQUIRED", message: "Autenticação multifator (AAL2) obrigatória para o mantenedor." },
                        { status: 403 }
                    ),
                    supabaseAdmin: null,
                    user: usuarioLogado
                };
            }
        }

        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
            auth: {
                autoRefreshToken: false,
                persistSession: false,
            },
        });

        return { authorized: true, errorResponse: null, supabaseAdmin, user: usuarioLogado };
    } catch (e: any) {
        console.error("[dev-auth] Crash Fatal:", e);
        return { 
            authorized: false, 
            errorResponse: NextResponse.json({ error: "Falha Interna", details: e.message || String(e) }, { status: 500 }), 
            supabaseAdmin: null,
            user: null
        };
    }
}

export async function logSistema(supabaseAdmin: any, classe: string, nivel: string, mensagem: string, detalhes: any = {}) {
    try {
        const { error } = await supabaseAdmin.from("logs_sistema").insert({
            classe,
            nivel,
            mensagem,
            detalhes
        });
        if (error) {
            console.error("Erro ao gravar log_sistema no Supabase:", error);
        }
    } catch (e) {
        console.error("Erro fatal ao gravar log_sistema:", e);
    }
}
