// Helper client-side para realizar requisições seguras para as APIs de Mapas (BFF) e LGPD
// Evita expor chaves de API do Google/Mapbox e valida dados antes de chamar o servidor.

export interface LocationCoordinate {
    lat: number;
    lng: number;
}

export type MapLocationInput = string | LocationCoordinate;

export interface RouteHistoryItem {
    id: string;
    user_id: string;
    unidade_id: string;
    origem: string;
    destino: string;
    latitude_origem: number | null;
    longitude_origem: number | null;
    latitude_destino: number | null;
    longitude_destino: number | null;
    distancia_metros: number | null;
    duracao_segundos: number | null;
    criado_em: string;
}

export interface GeocodeResult {
    location?: LocationCoordinate;
    error?: string;
    info?: string;
}

export interface DirectionsResult {
    routes?: unknown[];
    error?: string;
    info?: string;
}

/**
 * Realiza geocodificação de um endereço textual enviando a consulta ao BFF.
 */
export async function geocodeAddress(address: string): Promise<GeocodeResult> {
    try {
        const response = await fetch("/api/maps/geocode", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ address }),
        });

        const data = await response.json();
        if (!response.ok) {
            return { error: (data as { error?: string }).error || "Erro ao consultar serviço de geocodificação." };
        }

        return data as GeocodeResult;
    } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error("[api-maps.ts] Erro em geocodeAddress:", err);
        return { error: errorMessage || "Erro de rede ao buscar geocodificação." };
    }
}

/**
 * Obtém direções de rota e distância entre origem e destino enviando a consulta ao BFF.
 */
export async function getDirections(
    origin: MapLocationInput,
    destination: MapLocationInput
): Promise<DirectionsResult> {
    try {
        const response = await fetch("/api/maps/directions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ origin, destination }),
        });

        const data = await response.json();
        if (!response.ok) {
            return { error: (data as { error?: string }).error || "Erro ao calcular trajeto." };
        }

        return data as DirectionsResult;
    } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error("[api-maps.ts] Erro em getDirections:", err);
        return { error: errorMessage || "Erro de rede ao calcular rota." };
    }
}

/**
 * Busca o histórico de buscas de rotas do próprio usuário autenticado.
 */
export async function fetchRouteHistory(): Promise<{ routes?: RouteHistoryItem[]; error?: string }> {
    try {
        const response = await fetch("/api/users/me/routes", {
            method: "GET",
        });

        const data = await response.json();
        if (!response.ok) {
            return { error: (data as { error?: string }).error || "Erro ao buscar histórico de rotas." };
        }

        return data as { routes?: RouteHistoryItem[]; error?: string };
    } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error("[api-maps.ts] Erro em fetchRouteHistory:", err);
        return { error: errorMessage || "Erro de rede ao obter histórico." };
    }
}

/**
 * Salva um cálculo de trajeto no histórico pessoal do usuário autenticado no banco.
 */
export async function saveRouteHistory(routeData: {
    origem: string;
    destino: string;
    latitude_origem?: number | null;
    longitude_origem?: number | null;
    latitude_destino?: number | null;
    longitude_destino?: number | null;
    distancia_metros?: number | null;
    duracao_segundos?: number | null;
}): Promise<{ success: boolean; data?: RouteHistoryItem; error?: string }> {
    try {
        const response = await fetch("/api/users/me/routes", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(routeData),
        });

        const data = await response.json();
        if (!response.ok) {
            return { success: false, error: (data as { error?: string }).error || "Erro ao registrar histórico no banco." };
        }

        return { success: true, data: (data as { data?: RouteHistoryItem }).data };
    } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error("[api-maps.ts] Erro em saveRouteHistory:", err);
        return { success: false, error: errorMessage || "Erro de rede ao persistir histórico." };
    }
}

/**
 * Apaga permanentemente todos os registros de rotas e coordenadas do usuário (LGPD Direito ao Esquecimento).
 */
export async function deleteMyData(): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
        const response = await fetch("/api/users/me/data", {
            method: "DELETE",
        });

        const data = await response.json();
        if (!response.ok) {
            return { success: false, error: (data as { error?: string }).error || "Erro ao processar remoção dos dados." };
        }

        return { success: true, message: (data as { message?: string }).message };
    } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error("[api-maps.ts] Erro em deleteMyData:", err);
        return { success: false, error: errorMessage || "Erro de rede ao solicitar exclusão LGPD." };
    }
}
