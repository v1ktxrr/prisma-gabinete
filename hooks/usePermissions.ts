"use client";

import { useAuth } from "@/lib/auth-context";
import { useCallback, useMemo } from "react";

export function usePermissions() {
    const { user, profile, loading, profileLoading } = useAuth();

    const modulosAcesso = useMemo(() => {
        return Array.isArray(profile?.modulos_acesso) ? profile.modulos_acesso : [];
    }, [profile?.modulos_acesso]);

    const hasModule = useCallback((tag: string) => {
        // Papéis (cargo) de chefia, secretaria e assessoria ganham acesso de visualização à Agenda Global
        if (tag === "agenda_global_ver") {
            if (profile?.cargo === "chefia" || profile?.cargo === "secretaria" || profile?.cargo === "assessoria") {
                return true;
            }
        }

        // Papéis de secretaria e assessoria ganham acesso à marcação de presença na Agenda Global
        if (tag === "agenda_global_presenca") {
            if (profile?.cargo === "secretaria" || profile?.cargo === "assessoria" || profile?.cargo === "chefia") {
                return true;
            }
        }

        // Se o módulo solicitado for de visualização (_ver), e o usuário tiver a permissão de edição correspondente (_editar), concede acesso
        if (tag.endsWith("_ver")) {
            const moduloBase = tag.substring(0, tag.length - 4);
            if (modulosAcesso.includes(`${moduloBase}_editar`)) {
                return true;
            }
        }

        return modulosAcesso.includes(tag);
    }, [profile?.cargo, modulosAcesso]);

    return {
        user,
        profile,
        unidadeId: profile?.unidade_id ?? null,
        modulosAcesso,
        hasModule,
        loading: loading || profileLoading,
    };
}
