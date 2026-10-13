export const runtime = 'edge';
import { NextResponse } from "next/server";
import { validateDevAccess, logSistema } from "@/lib/dev-auth";

export async function GET() {
    const { authorized, errorResponse, supabaseAdmin } = await validateDevAccess();
    if (!authorized || !supabaseAdmin) return errorResponse;

    try {
        const { data, error } = await supabaseAdmin
            .from("formatos_midia")
            .select("*")
            .order("nome", { ascending: true });

        if (error) throw error;
        return NextResponse.json({ formatos: data }, { status: 200 });
    } catch (err: any) {
        console.error("[formatos-get] Erro:", err);
        return NextResponse.json({ error: err.message || "Erro interno" }, { status: 500 });
    }
}

export async function POST(request: Request) {
    const { authorized, errorResponse, supabaseAdmin, user } = await validateDevAccess();
    if (!authorized || !supabaseAdmin) return errorResponse;

    try {
        const body = await request.json();
        const { chave, nome } = body;

        if (!chave || !nome) {
            return NextResponse.json({ error: "Chave e nome são obrigatórios" }, { status: 400 });
        }

        const normalizedChave = chave.trim().toLowerCase().replace(/\s+/g, "_");

        const { data, error } = await supabaseAdmin
            .from("formatos_midia")
            .insert({
                chave: normalizedChave,
                nome: nome.trim()
            })
            .select()
            .single();

        if (error) throw error;

        await logSistema(
            supabaseAdmin,
            "DOMINIO",
            "INFO",
            `Formato de mídia '${nome}' (${normalizedChave}) criado por ${user?.email}`,
            { user_id: user?.id, data: data }
        );

        return NextResponse.json({ formato: data }, { status: 201 });
    } catch (err: any) {
        console.error("[formatos-post] Erro:", err);
        return NextResponse.json({ error: err.message || "Erro interno" }, { status: 500 });
    }
}
