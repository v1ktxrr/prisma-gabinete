[ public.briefings ]
│
▼ (atendimento_id)
[ public.tasks ] ──┼──► [ public.atendimentos ] ◄── [ public.oficios ]
(Agenda/Pautas)   │          (HUB CENTRAL)                 │
│                                        ▼
│                            [ public.oficios_historico ]
│                               (Linha do Tempo/Logs)


### Camadas do Sistema

1. **Camada de Apresentação (Frontend):**
   - Next.js 16.1.6 (App Router) com React 19.
   - Tailwind CSS 4 para estilização com Design System minimalista focado em produtividade (tons de `slate/zinc` para interfaces administrativas, cores de destaque restritas a CTAs primários).
   - Gerenciamento de estado local e cache offline via **Zustand** persistido no navegador com **IndexedDB** (`idb-keyval`) especificamente na rota `/agenda-comunicacao`.

2. **Camada de Abstração e Rotas (Backend):**
   - Execução distribuída em Edge Runtimes (`middleware.ts` e rotas criticas de API).
   - Integração externa via chamadas estruturadas de API:
     - Sincronização de Agenda com o Google via URL intermediária de Apps Script (`GOOGLE_APPS_SCRIPT_URL`).
     - Integração de métricas de rede social via Meta Graph API e Apify Actor na Edge Function `sync-instagram`.

3. **Camada de Dados e Persistência (BaaS):**
   - **Supabase** substituindo conceitualmente qualquer ORM local (o nome do sistema é Prisma, mas a persistência real é estritamente Supabase PostgreSQL).
   - Armazenamento de arquivos estruturado em Buckets:
     - `comprovantes`: Privado (acesso via Signed URLs por assessores e chefia).
     - `thumbnails`: Público (imagens de pautas de comunicação).
