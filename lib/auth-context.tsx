"use client";

import {
    createContext,
    useContext,
    useEffect,
    useRef,
    useState,
    useCallback,
    ReactNode,
} from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";

/* ============================================================
   Tipos
   ============================================================ */

/** Cargos definidos na tabela perfis_usuarios */
export type CargoUsuario = "assessoria" | "secretaria" | "comunicacao" | "chefia" | "super_admin";
export type UnidadeUsuario = "CG" | "DD";

export interface Profile {
    id: string;
    nome: string;
    cargo: CargoUsuario | null;
    unidade_id?: UnidadeUsuario | null;
    modulos_acesso?: string[] | null;
    // Campos legados mantidos para compatibilidade com header e perfil-view
    avatar_url?: string | null;
    is_admin?: boolean;
}

interface AuthContextType {
    user: User | null;
    profile: Profile | null;
    session: Session | null;
    loading: boolean;         // auth session loading
    profileLoading: boolean;  // perfis_usuarios fetch loading
    signOut: () => Promise<void>;
    refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    profile: null,
    session: null,
    loading: true,
    profileLoading: true,
    signOut: async () => { },
    refreshProfile: async () => { },
});

export const useAuth = () => useContext(AuthContext);

/* ============================================================
   Provider
   ============================================================ */
export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<Profile | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(true);
    // ↓ Estado SEPARADO para o fetch de perfil — evita a race condition
    const [profileLoading, setProfileLoading] = useState(true);
    const currentUserIdRef = useRef<string | null>(null);
    const hasResolvedProfileRef = useRef(false);

    const fetchProfile = useCallback(async (userId: string, options?: { blockUi?: boolean }) => {
        const blockUi = options?.blockUi ?? true;

        if (blockUi) {
            setProfileLoading(true);  // bloqueia renderização apenas quando ainda não temos o perfil resolvido
        }

        try {
            // OTIMIZAÇÃO: as duas queries são independentes entre si — rodamos em paralelo
            // com Promise.all, economizando o RTT completo da segunda query (~150–200ms no login).
            const [perfisResult, profilesResult] = await Promise.all([
                supabase
                    .from("perfis_usuarios")
                    .select("id, nome, cargo, unidade_id, modulos_acesso")
                    .eq("id", userId)
                    .single(),
                supabase
                    .from("profiles")
                    .select("avatar_url")
                    .eq("id", userId)
                    .single(),
            ]);

            const { data: perfisData, error } = perfisResult;

            if (error) {
                console.error("[AuthContext] Erro ao buscar perfil_usuarios:", error);
            }

            const avatarUrl: string | null = perfisResult.error
                ? null
                : (profilesResult.data?.avatar_url ?? null);

            if (perfisData) {
                const mergedProfile: Profile = {
                    ...perfisData,
                    avatar_url: avatarUrl,
                } as Profile;
                console.log("[AuthContext] Perfil carregado:", mergedProfile);
                setProfile(mergedProfile);
            } else {
                console.warn("[AuthContext] Nenhum perfil encontrado para o usuário:", userId);
                setProfile(null);
            }
            hasResolvedProfileRef.current = true;
        } catch (err) {
            console.error("[AuthContext] Exceção ao buscar perfil:", err);
        } finally {
            if (blockUi) {
                setProfileLoading(false); // libera somente após cargo confirmado
            }
        }
    }, []);

    const refreshProfile = useCallback(async () => {
        if (user) await fetchProfile(user.id);
    }, [user, fetchProfile]);

    useEffect(() => {
        // Sessão inicial — lê o cookie já existente
        // Blindagem contra refresh token inválido/expirado (AuthApiError)
        supabase.auth.getSession().then(({ data: { session: s }, error }) => {
            if (error) {
                // Token corrompido ou expirado → limpa tudo silenciosamente
                console.warn("[AuthContext] Sessão inválida, limpando:", error.message);
                supabase.auth.signOut().finally(() => {
                    setSession(null);
                    setUser(null);
                    setProfile(null);
                    setLoading(false);
                    setProfileLoading(false);
                });
                return;
            }
            setSession(s);
            setUser(s?.user ?? null);
            if (s?.user) {
                currentUserIdRef.current = s.user.id;
                fetchProfile(s.user.id, { blockUi: true }).finally(() => setLoading(false));
            } else {
                setLoading(false);
                setProfileLoading(false);
                currentUserIdRef.current = null;
                hasResolvedProfileRef.current = false;
            }
        });

        // Listener pós-login / pós-logout
        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_, s) => {
            setSession(s);
            setUser(s?.user ?? null);
            if (s?.user) {
                const isSameUser = currentUserIdRef.current === s.user.id;
                const shouldBlockUi =
                    !hasResolvedProfileRef.current ||
                    !isSameUser;

                currentUserIdRef.current = s.user.id;
                void fetchProfile(s.user.id, { blockUi: shouldBlockUi });
            } else {
                setProfile(null);
                setProfileLoading(false);
                currentUserIdRef.current = null;
                hasResolvedProfileRef.current = false;
            }
        });

        return () => subscription.unsubscribe();
    }, [fetchProfile]);

    const signOut = useCallback(async () => {
        try {
            await supabase.auth.signOut();
        } finally {
            setUser(null);
            setProfile(null);
            setSession(null);
            setProfileLoading(false);
            currentUserIdRef.current = null;
            hasResolvedProfileRef.current = false;
        }
    }, []);

    return (
        <AuthContext.Provider
            value={{ user, profile, session, loading, profileLoading, signOut, refreshProfile }}
        >
            {children}
        </AuthContext.Provider>
    );
}
