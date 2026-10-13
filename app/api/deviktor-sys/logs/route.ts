export const runtime = 'edge';
import { NextResponse } from "next/server";
import { validateDevAccess } from "@/lib/dev-auth";

export async function GET(request: Request) {
    const { authorized, errorResponse, supabaseAdmin } = await validateDevAccess();
    if (!authorized || !supabaseAdmin) return errorResponse;

    try {
        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get("page") || "1");
        const limit = parseInt(searchParams.get("limit") || "20");
        const classe = searchParams.get("classe");
        const nivel = searchParams.get("nivel");
        const search = searchParams.get("search");

        const from = (page - 1) * limit;
        const to = from + limit - 1;

        let query = supabaseAdmin
            .from("logs_sistema")
            .select("*", { count: "exact" });

        if (classe) {
            query = query.eq("classe", classe);
        }
        if (nivel) {
            query = query.eq("nivel", nivel);
        }
        if (search) {
            query = query.or(`mensagem.ilike.%${search}%,classe.ilike.%${search}%,nivel.ilike.%${search}%`);
        }

        const { data, error, count } = await query
            .order("criado_em", { ascending: false })
            .range(from, to);

        if (error) throw error;

        return NextResponse.json({
            logs: data || [],
            total: count || 0,
            page,
            pages: count ? Math.ceil(count / limit) : 1
        }, { status: 200 });
    } catch (err: any) {
        console.error("[logs-get] Erro:", err);
        return NextResponse.json({ error: err.message || "Erro interno" }, { status: 500 });
    }
}
