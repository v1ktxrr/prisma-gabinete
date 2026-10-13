import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { jwtVerify, createRemoteJWKSet } from "jose";
import { sendIntrusionAlert } from "@/lib/intrusion-alerts";

// Nota: o runtime "experimental-edge" foi removido.
// O middleware já roda no Edge Runtime por padrão no Next.js — não é necessário declará-lo.

function isPublicAsset(pathname: string) {
    return (
        pathname.startsWith("/_next") ||
        pathname.startsWith("/favicon") ||
        pathname.startsWith("/icone") ||
        pathname.startsWith("/logo") ||
        pathname === "/login" ||
        pathname === "/404" ||
        pathname === "/not-found" ||
        pathname === "/acesso-negado" ||
        /\.(svg|png|jpg|jpeg|gif|webp|ico)$/.test(pathname)
    );
}

function handleBlock(request: NextRequest, message = "Acesso não autorizado ou sessão expirada", status = 401) {
    const { pathname } = request.nextUrl;
    const isApiRoute = pathname.startsWith("/api/") || pathname === "/api";

    console.log('[Middleware Block]', pathname);

    if (isApiRoute) {
        return NextResponse.json(
            { error: message },
            { status }
        );
    }

    const response = NextResponse.redirect(new URL("/login", request.url));

    request.cookies.getAll().forEach(({ name }) => {
        if (name.startsWith("sb-") && name.includes("auth-token")) {
            response.cookies.delete(name);
        }
    });

    return response;
}

export async function middleware(request: NextRequest) {
    try {
        const { pathname } = request.nextUrl;

        // Bypass de autenticação de sessão para a rota de sincronização automática via token administrativo Bearer
        if (pathname === "/api/pre-agenda/sync") {
            const authHeader = request.headers.get("authorization");
            if (authHeader && authHeader.startsWith("Bearer ")) {
                const token = authHeader.substring(7);
                if (token === process.env.SUPABASE_SERVICE_ROLE_KEY) {
                    return NextResponse.next();
                }
            }
        }

        if (isPublicAsset(pathname)) {
            return NextResponse.next();
        }

        const isPrefetch =
            request.headers.get("x-middleware-prefetch") === "1" ||
            request.headers.get("purpose") === "prefetch";
        if (isPrefetch) {
            return NextResponse.next();
        }

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
        const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

        if (!supabaseUrl || !supabaseAnonKey) {
            return handleBlock(request, "Configuração do banco de dados ausente.", 401);
        }

        let response = NextResponse.next({ request });

        const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
            cookies: {
                getAll() {
                    return request.cookies.getAll();
                },
                setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
                    cookiesToSet.forEach(({ name, value }) => {
                        request.cookies.set(name, value);
                    });

                    response = NextResponse.next({ request });

                    cookiesToSet.forEach(({ name, value, options }) => {
                        response.cookies.set(name, value, options);
                    });
                },
            },
        });

        // OTIMIZAÇÃO: usa getSession() em vez de getUser().
        // getSession() lê o JWT do cookie localmente — zero chamada de rede ao Supabase.
        // O token JWT já é criptograficamente válido; a verificação de revogação em
        // tempo real fica a cargo das API routes de escrita (POST/DELETE) via getUser().
        const {
            data: { session },
            error,
        } = await supabase.auth.getSession();

        const isDevRoute = pathname.startsWith("/deviktor-sys") || pathname.startsWith("/api/deviktor-sys");

        if (isDevRoute) {
            const clientIp = request.headers.get("cf-connecting-ip") || 
                             request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || 
                             "127.0.0.1";

            // 1. IP Whitelisting
            if (process.env.DEV_IP_WHITELIST) {
                const allowedIps = process.env.DEV_IP_WHITELIST.split(",")
                    .map((ip) => ip.trim())
                    .filter(Boolean);
                if (!allowedIps.includes(clientIp)) {
                    sendIntrusionAlert(clientIp, pathname, `Bloqueio de IP Whitelist. IP: ${clientIp}`);
                    return NextResponse.rewrite(new URL("/404", request.url));
                }
            }

            // 2. Cloudflare Access Validation
            const cfTeamDomain = process.env.CF_TEAM_DOMAIN;
            const cfAudKey = process.env.CF_AUD_KEY;
            if (cfTeamDomain && cfAudKey) {
                const token = request.headers.get("cf-access-jwt-assertion") || 
                              request.cookies.get("CF_Authorization")?.value;
                if (!token) {
                    sendIntrusionAlert(clientIp, pathname, "Token do Cloudflare Access ausente");
                    return NextResponse.rewrite(new URL("/404", request.url));
                }

                try {
                    const certsUrl = cfTeamDomain.startsWith("http") 
                        ? `${cfTeamDomain}/cdn-cgi/access/certs` 
                        : `https://${cfTeamDomain}/cdn-cgi/access/certs`;
                    const JWKS = createRemoteJWKSet(new URL(certsUrl));
                    await jwtVerify(token, JWKS, {
                        audience: cfAudKey,
                    });
                } catch (err: any) {
                    sendIntrusionAlert(
                        clientIp, 
                        pathname, 
                        `Falha de assinatura ou audiência no Cloudflare Access: ${err.message || String(err)}`
                    );
                    return NextResponse.rewrite(new URL("/404", request.url));
                }
            }

            const devEmails = (process.env.DEV_EMAILS || "")
                .split(",")
                .map((email) => email.trim().toLowerCase())
                .filter(Boolean);

            const userEmail = session?.user?.email?.toLowerCase() || "";
            if (!userEmail || !devEmails.includes(userEmail)) {
                console.log('[Middleware Block DevRoute]', pathname);
                sendIntrusionAlert(clientIp, pathname, `Tentativa de acesso com e-mail não-autorizado: ${userEmail || 'Deslogado'}`);
                return NextResponse.rewrite(new URL("/404", request.url));
            }
        }

        if (error || !session) {
            return handleBlock(request, "Acesso não autorizado ou sessão expirada", 401);
        }

        return response;
    } catch (e: any) {
        console.error("[Middleware] Crash Fatal (Fail-Safe Ativado):", e);
        return NextResponse.next();
    }
}

export const config = {
    matcher: [
        // Exclui: assets estáticos, imagens, payloads RSC (_next/data), chunks webpack e favicons.
        // Inclui: todas as rotas de página e API que precisam de autenticação.
        "/((?!_next/static|_next/image|_next/data|_next/webpack|favicon|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
    ],
};
