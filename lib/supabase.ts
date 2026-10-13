import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);
export const COMPROVANTES_BUCKET = "comprovantes";

function normalizarNomeArquivo(nomeArquivo: string) {
    return nomeArquivo
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9._-]/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
}

export async function uploadComprovantes(files: File[], registroId: string) {
    const resultados = await Promise.allSettled(
        files.map(async (file, index) => {
            const nomeArquivo = normalizarNomeArquivo(file.name) || `comprovante-${index + 1}`;
            const caminhoArquivo = `${registroId}/${index + 1}-${nomeArquivo}`;
            const { data, error } = await supabase.storage
                .from(COMPROVANTES_BUCKET)
                .upload(caminhoArquivo, file, {
                    cacheControl: "3600",
                    upsert: false,
                    contentType: file.type || undefined,
                });

            if (error) {
                throw error;
            }

            return data.path;
        })
    );

    const uploadedPaths = resultados
        .filter((resultado): resultado is PromiseFulfilledResult<string> => resultado.status === "fulfilled")
        .map((resultado) => resultado.value);

    const falha = resultados.find((resultado) => resultado.status === "rejected");

    if (falha) {
        throw Object.assign(new Error("Falha ao fazer upload dos comprovantes."), {
            uploadedPaths,
            cause: falha.reason,
        });
    }

    return uploadedPaths;
}
