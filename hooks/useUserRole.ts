import { useAuth, CargoUsuario } from "@/lib/auth-context";

/** Mapa de cargo → rota home do usuário */
export const CARGO_HOME: Record<CargoUsuario, string> = {
    comunicacao:    "/dashboard",
    assessoria:     "/dashboard",
    secretaria:     "/dashboard",
    chefia:         "/dashboard",
    super_admin:    "/admin",
};

/**
 * Hook que expõe o cargo do usuário logado e helpers de RBAC.
 * isLoadingRole é true enquanto o fetch de perfis_usuarios não terminou —
 * nunca confundir com authLoading (que cobre só a sessão JWT).
 */
export function useUserRole() {
    const { profile, loading: authLoading, profileLoading } = useAuth();

    const cargo = profile?.cargo ?? null;

    // Loading total = auth ainda buscando sessão OU perfil ainda sendo buscado
    const isLoadingRole = authLoading || profileLoading;

    return {
        cargo,
        loading: isLoadingRole,      // alias legado
        isLoadingRole,               // nome semântico claro

        // Helpers booleanos para guards de UI
        isChefe:       cargo === "chefia",
        isComunicacao: cargo === "comunicacao",
        isAssessor:    cargo === "assessoria",

        // Rota home baseada no cargo (fallback para login se sem cargo)
        homeRoute: cargo ? CARGO_HOME[cargo] : "/login",

        /** Verifica se o usuário tem permissão para uma lista de cargos */
        temAcesso: (cargosPermitidos: CargoUsuario[]) =>
            cargo !== null && cargosPermitidos.includes(cargo),
    };
}
