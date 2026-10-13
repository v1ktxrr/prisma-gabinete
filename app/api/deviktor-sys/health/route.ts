export const runtime = 'edge';
import { NextResponse } from "next/server";
import { validateDevAccess } from "@/lib/dev-auth";

export async function GET() {
    const { authorized, errorResponse, supabaseAdmin } = await validateDevAccess();
    if (!authorized || !supabaseAdmin) return errorResponse;

    try {
        const healthChecks = [];

        // 1. Supabase Database Ping
        try {
            const start = Date.now();
            const { error } = await supabaseAdmin.from('unidades').select('id').limit(1);
            const latency = Date.now() - start;
            healthChecks.push({
                service: "Supabase Database",
                status: error ? "error" : "ok",
                latency: `${latency}ms`,
                message: error ? error.message : "Conexão estável"
            });
        } catch (e: any) {
            healthChecks.push({ service: "Supabase Database", status: "error", message: e.message });
        }

        // 2. Apify Integration Ping
        try {
            const token = process.env.APIFY_API_TOKEN;
            if (!token) {
                healthChecks.push({
                    service: "Apify (Instagram Scraper)",
                    status: "warning",
                    message: "APIFY_API_TOKEN não configurado no .env"
                });
            } else {
                const start = Date.now();
                const res = await fetch("https://api.apify.com/v2/users/me", {
                    headers: { "Authorization": `Bearer ${token}` }
                });
                const latency = Date.now() - start;
                
                if (res.ok) {
                    healthChecks.push({
                        service: "Apify (Instagram Scraper)",
                        status: "ok",
                        latency: `${latency}ms`,
                        message: "Token válido"
                    });
                } else {
                    healthChecks.push({
                        service: "Apify (Instagram Scraper)",
                        status: "error",
                        latency: `${latency}ms`,
                        message: `Erro de Autenticação (${res.status})`
                    });
                }
            }
        } catch (e: any) {
            healthChecks.push({ service: "Apify (Instagram Scraper)", status: "error", message: e.message });
        }

        return NextResponse.json(healthChecks);
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
