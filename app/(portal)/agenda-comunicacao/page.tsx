"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { usePermissions } from "@/hooks/usePermissions";
import CalendarioView from "@/components/views/calendario-view";

export default function AgendaComunicacaoPage() {
    const router = useRouter();
    const { user } = useAuth();
    const { loading, hasModule } = usePermissions();

    useEffect(() => {
        if (!loading && !user) {
            router.replace("/login");
        }
    }, [loading, router, user]);

    if (loading || !user) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-background">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!hasModule("agenda_comunicacao_ver") && !hasModule("agenda_comunicacao_editar")) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-background px-4">
                <div className="max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
                    <h1 className="text-xl font-bold text-slate-800">Sem acesso</h1>
                    <p className="mt-2 text-sm leading-relaxed text-slate-500">
                        Seu perfil não tem acesso à agenda de comunicação.
                    </p>
                </div>
            </div>
        );
    }

    return <CalendarioView mode="communication" />;
}
