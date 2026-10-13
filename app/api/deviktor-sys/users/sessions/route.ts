export const runtime = 'edge';
import { NextResponse } from "next/server";
import { validateDevAccess, logSistema } from "@/lib/dev-auth";
import { z } from "zod";

const revokeSessionSchema = z.object({
    session_id: z.string().uuid(),
});

export async function GET() {
    try {
        const { authorized, errorResponse, supabaseAdmin } = await validateDevAccess();
        if (!authorized || !supabaseAdmin) return errorResponse;

        const { data, error } = await supabaseAdmin.rpc("obter_sessoes_ativas");
        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json(data);
    } catch (error: any) {
        console.error("[deviktor-sessions GET] Crash Fatal:", error);
        return NextResponse.json({ error: 'Crash na API', message: error.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const { authorized, errorResponse, supabaseAdmin, user } = await validateDevAccess();
        if (!authorized || !supabaseAdmin || !user) return errorResponse;

        const body = await request.json();
        const parsed = revokeSessionSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ error: "Payload inválido", details: parsed.error.format() }, { status: 400 });
        }

        const { session_id } = parsed.data;

        // Executar RPC para revogar a sessão
        const { error } = await supabaseAdmin.rpc("revogar_sessao", { session_id });
        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        // Registrar log
        await logSistema(
            supabaseAdmin,
            "INFRA",
            "WARNING",
            `Sessão revogada pelo mantenedor: ${user.email}`,
            { session_id, dev_email: user.email }
        );

        return NextResponse.json({ success: true, message: "Sessão revogada com sucesso." });
    } catch (error: any) {
        console.error("[deviktor-sessions POST] Crash Fatal:", error);
        return NextResponse.json({ error: 'Crash na API', message: error.message }, { status: 500 });
    }
}
