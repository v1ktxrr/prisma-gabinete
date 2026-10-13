export const runtime = 'edge';
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { z } from "zod";

// Schema de localização (coordenadas numéricas ou endereço higienizado)
const locationValueSchema = z.union([
    z.object({
        lat: z.number().min(-90, "Latitude fora do limite (-90 a 90).").max(90, "Latitude fora do limite (-90 a 90)."),
        lng: z.number().min(-180, "Longitude fora do limite (-180 a 180).").max(180, "Longitude fora do limite (-180 a 180).")
    }),
    z.string()
        .min(3, "Endereço muito curto.")
        .max(150, "Endereço muito longo.")
        .regex(/^[a-zA-Z0-9\s,ºª°.\-\/áéíóúâêôãõçÁÉÍÓÚÂÊÔÃÕÇ]+$/, "O endereço de origem/destino contém caracteres especiais não permitidos.")
]);

const directionsSchema = z.object({
    origin: locationValueSchema,
    destination: locationValueSchema
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
                    // Ignora
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

// Fórmula de Haversine para cálculo de distância em metros (fallback offline/desenvolvimento)
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // Raio da Terra em metros
    const rad = Math.PI / 180;
    const dLat = (lat2 - lat1) * rad;
    const dLon = (lon2 - lon1) * rad;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * rad) * Math.cos(lat2 * rad) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c);
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
        const validation = directionsSchema.safeParse(body);
        if (!validation.success) {
            return NextResponse.json(
                { error: "Dados inválidos", details: validation.error.format() },
                { status: 400 }
            );
        }

        const { origin, destination } = validation.data;
        const mapsApiKey = process.env.GOOGLE_MAPS_SECRET_KEY;

        const formatParam = (val: typeof origin) => {
            if (typeof val === "string") return val;
            return `${val.lat},${val.lng}`;
        };

        // 4. Integração com a API do Google Maps Directions (BFF proxy ocultando a chave do cliente)
        if (!mapsApiKey) {
            console.warn("[BFF Directions] GOOGLE_MAPS_SECRET_KEY não configurada. Executando fallback simulado.");
            
            // Obter coordenadas para cálculo de distância mock
            const lat1 = typeof origin === "string" ? -20.4697 : origin.lat;
            const lon1 = typeof origin === "string" ? -54.6201 : origin.lng;
            const lat2 = typeof destination === "string" ? -22.2238 : destination.lat;
            const lon2 = typeof destination === "string" ? -54.8128 : destination.lng;

            const distanciaMetros = haversineDistance(lat1, lon1, lat2, lon2);
            // Assumindo velocidade média de 80km/h (22.2 m/s) para o tempo de trânsito simulado
            const duracaoSegundos = Math.round(distanciaMetros / 22.2);

            return NextResponse.json({
                routes: [
                    {
                        legs: [
                            {
                                distance: { text: `${(distanciaMetros / 1000).toFixed(1)} km`, value: distanciaMetros },
                                duration: { text: `${Math.round(duracaoSegundos / 60)} min`, value: duracaoSegundos },
                                start_location: { lat: lat1, lng: lon1 },
                                end_location: { lat: lat2, lng: lon2 }
                            }
                        ]
                    }
                ],
                info: "Modo demonstração/mock ativo. Defina GOOGLE_MAPS_SECRET_KEY no servidor para direções reais."
            });
        }

        const response = await fetch(
            `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(formatParam(origin))}&destination=${encodeURIComponent(formatParam(destination))}&key=${mapsApiKey}`
        );

        if (!response.ok) {
            throw new Error(`Erro na API do Google Maps Directions: ${response.statusText}`);
        }

        const data = await response.json();

        if (data.status !== "OK") {
            return NextResponse.json(
                { error: `Google Maps respondeu com status: ${data.status}`, details: data },
                { status: 400 }
            );
        }

        return NextResponse.json(data);

    } catch (error: any) {
        console.error("[BFF Directions] Erro no processamento:", error);
        return NextResponse.json(
            { error: "Erro interno no servidor ao processar cálculo de rota." },
            { status: 500 }
        );
    }
}
