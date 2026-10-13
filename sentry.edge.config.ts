import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN,

  // Taxa de amostragem para monitoramento de performance
  tracesSampleRate: 1.0,

  debug: false,
});
