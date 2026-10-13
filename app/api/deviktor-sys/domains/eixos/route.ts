export const runtime = 'edge';
import { NextResponse } from "next/server";
import { validateDevAccess, logSistema } from "@/lib/dev-auth";

export async function GET() {
    const { authorized, errorResponse, supabaseAdmin } = await validateDevAccess();
    if (!authorized || !supabaseAdmin) return errorResponse;

    try {
        const { data, error } = await supabaseAdmin
            .from("eixos_tematicos")
            .select("*")
            .order("nome", { ascending: true });

        if (error) throw error;
        return NextResponse.json({ eixos: data }, { status: 200 });
    } catch (err: any) {
        console.error("[eixos-get] Erro:", err);
        return NextResponse.json({ error: err.message || "Erro interno" }, { status: 500 });
    }
}

export async function POST(request: Request) {
    const { authorized, errorResponse, supabaseAdmin, user } = await validateDevAccess();
    if (!authorized || !supabaseAdmin) return errorResponse;

    try {
        const body = await request.json();
        const { chave, nome, cor } = body;

        if (!chave || !nome) {
            return NextResponse.json({ error: "Chave e nome são obrigatórios" }, { status: 400 });
        }

        const normalizedChave = chave.trim().toLowerCase().replace(/\s+/g, "_");

        const { data, error } = await supabaseAdmin
            .from("eixos_tematicos")
            .insert({
                chave: normalizedChave,
                nome: nome.trim(),
                cor: cor?.trim() || "#64748b"
            })
            .select()
            .single();

        if (error) throw error;

        await logSistema(
            supabaseAdmin,
            "DOMINIO",
            "INFO",
            `Eixo temático '${nome}' (${normalizedChave}) criado por ${user?.email}`,
            { user_id: user?.id, data: data }
        );

        return NextResponse.json({ eixo: data }, { status: 201 });
    } catch (err: any) {
        console.error("[eixos-post] Erro:", err);
        return NextResponse.json({ error: err.message || "Erro interno" }, { status: 500 });
    }
}
