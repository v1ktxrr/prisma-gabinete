"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useUserRole, CARGO_HOME } from "@/hooks/useUserRole";

export default function AppController() {
    const { user, loading: authLoading, signOut } = useAuth();
    const { cargo, isLoadingRole } = useUserRole();
    const router = useRouter();

    useEffect(() => {
        if (!authLoading && !user) {
            router.replace("/login");
        }
    }, [user, authLoading, router]);

    useEffect(() => {
        if (!authLoading && !isLoadingRole && user && cargo) {
            router.replace(CARGO_HOME[cargo]);
        }
    }, [authLoading, isLoadingRole, user, cargo, router]);

    if (authLoading || isLoadingRole || !user) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-background">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (cargo === null) {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4 text-center">
                <div className="rounded-2xl border border-red-200 bg-red-50 p-6 shadow-sm">
                    <h2 className="mb-2 text-lg font-bold text-red-800">Erro de Perfil</h2>
                    <p className="text-sm text-red-600">
                        Cargo não encontrado. Contate o administrador.
                    </p>
                    <button
                        onClick={async () => {
                            try {
                                await signOut();
                            } finally {
                                router.replace("/login");
                            }
                        }}
                        className="mt-4 rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white"
                    >
                        Voltar para Login
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-background">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
    );
}
