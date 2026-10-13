export const runtime = 'edge';
import { NextResponse } from "next/server";
import { validateDevAccess, logSistema } from "@/lib/dev-auth";

export async function GET() {
    const { authorized, errorResponse, supabaseAdmin } = await validateDevAccess();
    if (!authorized || !supabaseAdmin) return errorResponse;

    try {
        const { data: unidades, error } = await supabaseAdmin
            .from("unidades")
            .select("*")
            .order("nome");

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        // Fetch counts from perfis_usuarios
        const { data: perfis, error: perfisError } = await supabaseAdmin
            .from("perfis_usuarios")
            .select("unidade_id");

        if (perfisError) {
            return NextResponse.json({ error: perfisError.message }, { status: 500 });
        }

        // Count users per unit
        const userCounts = perfis.reduce((acc: Record<string, number>, p: any) => {
            if (p.unidade_id) {
                const uid = p.unidade_id.toLowerCase();
                acc[uid] = (acc[uid] || 0) + 1;
            }
            return acc;
        }, {});

        const result = unidades.map((u: any) => ({
            ...u,
            users_count: userCounts[u.id.toLowerCase()] || 0
        }));

        return NextResponse.json(result);
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    const { authorized, errorResponse, supabaseAdmin, user } = await validateDevAccess();
    if (!authorized || !supabaseAdmin) return errorResponse;

    try {
        const body = await request.json();
        const { id, nome, status } = body;

        if (!id) {
            return NextResponse.json({ error: "ID da unidade é obrigatório." }, { status: 400 });
        }

        const payload: any = {};
        if (nome !== undefined) payload.nome = nome;
        if (status !== undefined) payload.status = status;

        if (Object.keys(payload).length > 0) {
            const { error } = await supabaseAdmin
                .from("unidades")
                .update(payload)
                .eq("id", id);

            if (error) {
                return NextResponse.json({ error: error.message }, { status: 500 });
            }

            await logSistema(
                supabaseAdmin,
                "TENANT_MGT",
                status === "suspenso" ? "WARNING" : "INFO",
                `Unidade '${id}' atualizada (Status: ${status}).`,
                { unidade_id: id, updates: payload, dev_email: user?.email }
            );
        }

        return NextResponse.json({ success: true });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    const { authorized, errorResponse, supabaseAdmin, user } = await validateDevAccess();
    if (!authorized || !supabaseAdmin) return errorResponse;

    try {
        const body = await request.json();
        const { id, nome } = body;

        if (!id || !nome) {
            return NextResponse.json({ error: "ID e nome da unidade são obrigatórios." }, { status: 400 });
        }

        const { error } = await supabaseAdmin
            .from("unidades")
            .insert({
                id: id.toLowerCase().trim(),
                nome: nome.trim(),
                status: "ativo"
            });

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        await logSistema(
            supabaseAdmin,
            "TENANT_MGT",
            "INFO",
            `Unidade '${id}' criada.`,
            { unidade_id: id, nome, dev_email: user?.email }
        );

        return NextResponse.json({ success: true });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
