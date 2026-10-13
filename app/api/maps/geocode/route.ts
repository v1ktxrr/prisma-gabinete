export const runtime = 'edge';
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { z } from "zod";

// Schema para validação rigorosa (Prevenção de Injeção SQL/NoSQL e dados inválidos)
const geocodeSchema = z.object({
    address: z.string()
        .min(3, "O endereço deve conter pelo menos 3 caracteres.")
        .max(150, "O endereço deve conter no máximo 150 caracteres.")
        // Aceita letras (incluindo acentuação em português), números, espaços, vírgulas, hífens, pontos, barras e símbolos comuns de endereço (º, ª, °)
        .regex(/^[a-zA-Z0-9\s,ºª°.\-\/áéíóúâêôãõçÁÉÍÓÚÂÊÔÃÕÇ]+$/, "O endereço contém caracteres especiais não permitidos.")
});

async function getAuthenticatedUser() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error("Configuração do Supabase incompleta no servidor.");
    }

    const cookieStore = await cookies();
    const supabaseAuth = createServerClient(supabaseUrl, supabaseAnonKey, {
        cookies: {
            getAll() {
                return cookieStore.getAll();
            },
            setAll(cookiesToSet) {
                try {
                    cookiesToSet.forEach(({ name, value, options }) => {
                        cookieStore.set(name, value, options);
                    });
                } catch {
                    // Ignora em rotas do tipo edge/middleware
                }
            },
        },
    });

    const {
        data: { user },
        error,
    } = await supabaseAuth.auth.getUser();

    if (error || !user) {
        return null;
    }

    return user;
}

export async function POST(request: Request) {
    try {
        // 1. Autenticação JWT obrigatória via Supabase Auth
        const user = await getAuthenticatedUser();
        if (!user) {
            return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
        }

        // 2. Leitura do payload
        let body;
        try {
            body = await request.json();
        } catch {
            return NextResponse.json({ error: "Payload JSON inválido." }, { status: 400 });
        }

        // 3. Validação estrita com Zod (Prevenção de Injeção)
        const validation = geocodeSchema.safeParse(body);
        if (!validation.success) {
            return NextResponse.json(
                { error: "Dados inválidos", details: validation.error.format() },
                { status: 400 }
            );
        }

        const { address } = validation.data;
        const mapsApiKey = process.env.GOOGLE_MAPS_SECRET_KEY;

        // 4. Integração com a API do Google Maps (BFF proxy ocultando a chave do cliente)
        if (!mapsApiKey) {
            console.warn("[BFF Geocode] GOOGLE_MAPS_SECRET_KEY não configurada. Executando fallback simulado.");
            
            // Simulação geopolítica inteligente para MS (Campo Grande / Dourados) para testes sem cobrança
            let mockLocation = { lat: -20.4697, lng: -54.6201 }; // Campo Grande (Centro)
            if (address.toLowerCase().includes("dourados")) {
                mockLocation = { lat: -22.2238, lng: -54.8128 }; // Dourados (Centro)
            }
            
            return NextResponse.json({
                location: mockLocation,
                info: "Modo demonstração/mock ativo. Defina GOOGLE_MAPS_SECRET_KEY no servidor para geocodificação real."
            });
        }

        const response = await fetch(
            `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${mapsApiKey}`
        );

        if (!response.ok) {
            throw new Error(`Erro na API do Google Maps: ${response.statusText}`);
        }

        const data = await response.json();

        if (data.status !== "OK") {
            return NextResponse.json(
                { error: `Google Maps respondeu com status: ${data.status}`, details: data },
                { status: 400 }
            );
        }

        const location = data.results[0]?.geometry?.location;

        return NextResponse.json({ location });

    } catch (error: any) {
        console.error("[BFF Geocode] Erro no processamento:", error);
        return NextResponse.json(
            { error: "Erro interno no servidor ao processar geocodificação." },
            { status: 500 }
        );
    }
}
