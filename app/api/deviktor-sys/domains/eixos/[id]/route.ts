export const runtime = 'edge';
import { NextResponse } from "next/server";
import { validateDevAccess, logSistema } from "@/lib/dev-auth";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const { authorized, errorResponse, supabaseAdmin, user } = await validateDevAccess();
    if (!authorized || !supabaseAdmin) return errorResponse;

    try {
        const body = await request.json();
        const { nome, cor } = body;

        if (!nome) {
            return NextResponse.json({ error: "Nome é obrigatório" }, { status: 400 });
        }

        const { data: oldData } = await supabaseAdmin
            .from("eixos_tematicos")
            .select("*")
            .eq("id", id)
            .single();

        const { data, error } = await supabaseAdmin
            .from("eixos_tematicos")
            .update({
                nome: nome.trim(),
                cor: cor?.trim() || "#64748b",
                atualizado_em: new Date().toISOString()
            })
            .eq("id", id)
            .select()
            .single();

        if (error) throw error;

        await logSistema(
            supabaseAdmin,
            "DOMINIO",
            "INFO",
            `Eixo temático '${nome}' atualizado por ${user?.email}`,
            { user_id: user?.id, old: oldData, new: data }
        );

        return NextResponse.json({ eixo: data }, { status: 200 });
    } catch (err: any) {
        console.error("[eixos-put] Erro:", err);
        return NextResponse.json({ error: err.message || "Erro interno" }, { status: 500 });
    }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const { authorized, errorResponse, supabaseAdmin, user } = await validateDevAccess();
    if (!authorized || !supabaseAdmin) return errorResponse;

    try {
        const { data: oldData, error: getError } = await supabaseAdmin
            .from("eixos_tematicos")
            .select("*")
            .eq("id", id)
            .single();

        if (getError || !oldData) {
            return NextResponse.json({ error: "Eixo não encontrado" }, { status: 404 });
        }

        const { error } = await supabaseAdmin
            .from("eixos_tematicos")
            .delete()
            .eq("id", id);

        if (error) throw error;

        await logSistema(
            supabaseAdmin,
            "DOMINIO",
            "WARNING",
            `Eixo temático '${oldData.nome}' (${oldData.chave}) DELETADO por ${user?.email}`,
            { user_id: user?.id, deleted: oldData }
        );

        return NextResponse.json({ success: true }, { status: 200 });
    } catch (err: any) {
        console.error("[eixos-delete] Erro:", err);
        return NextResponse.json({ error: err.message || "Erro interno" }, { status: 500 });
    }
}
