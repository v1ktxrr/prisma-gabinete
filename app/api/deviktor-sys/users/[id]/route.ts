export const runtime = 'edge';
import { NextResponse } from "next/server";
import { validateDevAccess, logSistema } from "@/lib/dev-auth";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const { authorized, errorResponse, supabaseAdmin, user } = await validateDevAccess();
    if (!authorized || !supabaseAdmin) return errorResponse;

    try {
        const body = await request.json();
        const { password, nome, cargo, unidade_id, modulos, celular } = body;

        if (password) {
            const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(id, {
                password
            });
            if (authError) {
                return NextResponse.json({ error: authError.message }, { status: 500 });
            }
        }

        const payload: any = {};
        if (nome !== undefined) payload.nome = nome;
        if (cargo !== undefined) payload.cargo = cargo;
        if (unidade_id !== undefined) payload.unidade_id = unidade_id;
        if (modulos !== undefined) payload.modulos_acesso = modulos;
        if (celular !== undefined) payload.celular = celular;

        if (Object.keys(payload).length > 0) {
            const { error: profileError } = await supabaseAdmin
                .from("perfis_usuarios")
                .update(payload)
                .eq("id", id);

            if (profileError) {
                return NextResponse.json({ error: profileError.message }, { status: 500 });
            }
        }

        await logSistema(
            supabaseAdmin,
            "ROOT_USERS",
            "INFO",
            `Usuário ID '${id}' editado pelo Cockpit Root.`,
            { target_id: id, updates: Object.keys(payload), dev_email: user?.email }
        );

        return NextResponse.json({ success: true });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const { authorized, errorResponse, supabaseAdmin, user } = await validateDevAccess();
    if (!authorized || !supabaseAdmin) return errorResponse;

    try {
        const { error } = await supabaseAdmin.auth.admin.deleteUser(id);

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        await supabaseAdmin.from("perfis_usuarios").delete().eq("id", id);

        await logSistema(
            supabaseAdmin,
            "ROOT_USERS",
            "WARNING",
            `Usuário ID '${id}' deletado pelo Cockpit Root.`,
            { target_id: id, dev_email: user?.email }
        );

        return NextResponse.json({ success: true });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
