export const runtime = 'edge';
import { NextResponse } from "next/server";
import { validateDevAccess, logSistema } from "@/lib/dev-auth";

export async function GET() {
    const { authorized, errorResponse, supabaseAdmin } = await validateDevAccess();
    if (!authorized || !supabaseAdmin) return errorResponse;

    try {
        const { data, error } = await supabaseAdmin
            .from("configuracoes_sistema")
            .select("*")
            .order("chave");

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json(data);
    } catch (err: any) {
        console.error("[configs-get] Erro:", err);
        return NextResponse.json({ error: err.message || "Erro interno" }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    const { authorized, errorResponse, supabaseAdmin, user } = await validateDevAccess();
    if (!authorized || !supabaseAdmin) return errorResponse;

    try {
        const body = await request.json();
        const { chave, valor, descricao } = body;

        if (!chave || valor === undefined) {
            return NextResponse.json({ error: "Campos obrigatórios ausentes." }, { status: 400 });
        }

        const payload: any = { chave, valor, atualizado_em: new Date().toISOString() };
        if (descricao !== undefined) payload.descricao = descricao;

        const { data, error } = await supabaseAdmin
            .from("configuracoes_sistema")
            .upsert(payload)
            .select()
            .single();

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        await logSistema(
            supabaseAdmin,
            "FEATURE_FLAGS",
            "INFO",
            `Configuração '${chave}' atualizada.`,
            { chave, valor, dev_email: user?.email }
        );

        return NextResponse.json(data);
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    const { authorized, errorResponse, supabaseAdmin, user } = await validateDevAccess();
    if (!authorized || !supabaseAdmin) return errorResponse;

    try {
        const { searchParams } = new URL(request.url);
        const chave = searchParams.get("chave");

        if (!chave) {
            return NextResponse.json({ error: "Chave não informada." }, { status: 400 });
        }

        const { error } = await supabaseAdmin
            .from("configuracoes_sistema")
            .delete()
            .eq("chave", chave);

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        await logSistema(
            supabaseAdmin,
            "FEATURE_FLAGS",
            "WARNING",
            `Configuração '${chave}' removida.`,
            { chave, dev_email: user?.email }
        );

        return NextResponse.json({ success: true });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
