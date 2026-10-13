import * as Sentry from "@sentry/nextjs";
import { NextResponse } from "next/server";

/**
 * Wrapper global para tratamento de erros em Route Handlers do Next.js.
 * Captura exceções silenciosas de status 500 e as envia para o Sentry.
 */
export function withErrorHandling(
  handler: (request: Request, context: any) => Promise<Response>
) {
  return async (request: Request, context: any) => {
    try {
      return await handler(request, context);
    } catch (error) {
      console.error("[Global API Error Wrapper]:", error);

      // Reportar a exceção não tratada ao Sentry
      Sentry.captureException(error);

      return NextResponse.json(
        { error: "Erro interno do servidor." },
        { status: 500 }
      );
    }
  };
}
