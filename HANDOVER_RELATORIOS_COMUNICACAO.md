# Handover Técnica: Filtros Temporais, Sincronização de Métricas e Design Split Card nos Relatórios de Comunicação

Este documento descreve detalhadamente as alterações, arquiteturas e soluções implementadas na tela de relatórios de comunicação em `/app/agenda-comunicacao/relatorios/page.tsx` durante esta sessão de engenharia e UI/UX.

---

## 1. Escopo das Alterações
Foram solucionados gargalos críticos de carregamento de dados, implementada a funcionalidade de sincronização manual de métricas integrada a APIs externas de forma resiliente, e redesenhada a experiência visual dos cards para atender a padrões corporativos e de alta acessibilidade.

---

## 2. Detalhes de Implementação

### A. Correção da Query e Filtros do Supabase (`buscarTasks`)
* **Problema**: As publicações da agenda de comunicação não eram carregadas na tela, exibindo zero resultados.
* **Diagnóstico**: A query realizava filtros nas colunas `.gte("data_publicacao", ...)` e `.lte("data_publicacao", ...)`. Contudo, por padrão no Supabase do projeto, a coluna `data_publicacao` permanece `null` para pautas de comunicação, as quais usam `data_inicio` como o timestamp oficial da veiculação.
* **Solução**: Alterada a query para buscar, filtrar e ordenar utilizando a coluna `data_inicio`. 
* **Resultado**: As tarefas agora carregam instantaneamente no filtro do período correspondente (por exemplo, exibindo os 18 posts existentes de Maio/2026 ao selecionar "Mês Passado").

### B. Integração de Gatilhos de Sincronização Manual
Conectamos a Edge Function `sync-instagram` (responsável por mesclar dados oficiais da API do Facebook Graph com dados de scrapers do Apify para contornar limitações da Meta e extrair visualizações de Reels/Vídeos) diretamente no frontend:

1. **Atualização Individual (Cards)**:
   * Ícone `RefreshCw` adicionado ao rodapé direito de cada card.
   * Controles de clique com `e.preventDefault()` e `e.stopPropagation()` para atualizar as métricas sem disparar a navegação do card para o link externo.
   * Feedback visual individual via estado `syncingTasks[taskId]`.
2. **Atualização Global em Fila Sequencial (Anti-Block/Rate-Limit)**:
   * Botão **"Atualizar Métricas Visíveis"** adicionado ao cabeçalho.
   * Filtra todas as postagens visíveis da aba/busca atual que possuem link do Instagram e as processa sequencialmente usando um loop `for...of` com `await`.
   * Evita requisições paralelas concorrentes que poderiam causar bloqueio por rate-limiting ou captchas nas nossas credenciais do Apify.
   * Exibe progresso dinâmico no texto do botão (Ex: *"Atualizando 3 de 15..."*).
3. **Atualização Reativa do Estado**:
   * Ao final de cada chamada de sincronização bem-sucedida, o estado local do array `tasks` é atualizado ao vivo com o novo `metrics_snapshot` retornado da função, recalculando instantaneamente os números nos cards e nos gráficos (Donut/Stacked Bar) da tela.

### C. Refatoração Visual: Arquitetura "Split Card"
Para solucionar problemas graves de contraste e legibilidade causados por textos brancos flutuando sobre fotografias variadas (antigo layout estilo pôster), redesenhamos o card de postagens sob a arquitetura de **Card Dividido (Split Card)**:

1. **Metade Superior (Proporção Exata 4:5)**:
   * Contêiner de imagem travado em `aspect-[4/5] w-full shrink-0 relative`.
   * Imagem enquadrada com `object-cover object-top` para preservar e priorizar rostos na parte superior da composição de fotos de eventos.
   * **Pílulas de autoria pessoal ("Minhas Contribuições")** de Captação, Edição, Texto ou Publicação flutuam sobre o canto superior esquerdo com cores e **fundos sólidos fortes** de alto contraste (`text-white bg-teal-600`, `bg-indigo-650`, etc.) e sombra para legibilidade incondicional sobre qualquer imagem.
2. **Metade Inferior (Conteúdo Sólido)**:
   * Contêiner de cor branca sólida (`bg-white`) com bordas arredondadas e elevação suave moderna: `shadow-[0_4px_20px_rgba(0,0,0,0.05)] hover:shadow-lg transition-all duration-300`.
   * **Hierarquia Visual**:
     * Data e Nome do Autor posicionados no cabeçalho em cinza/violeta discretos.
     * Título de alta legibilidade (`text-slate-800 font-extrabold`) e descrição cinza médio (`text-slate-500`) centralizados.
     * Badges de Eixo e Formato alinhados no corpo.
     * Rodapé com métricas remapeadas em cores de alto contraste e botão de atualização integrado, divididos por uma borda superior suave (`border-slate-100`).

---

## 3. Arquivos Modificados
* [app/agenda-comunicacao/relatorios/page.tsx](app/agenda-comunicacao/relatorios/page.tsx) — Refatoração de query, lógica de sincronização individual e global, e estilização Split Card.

---

## 4. Verificação de Saúde e Qualidade
* A compilação local de produção com TypeScript (`npm run build`) está **completamente íntegra e sem erros**.
* As consultas SQL de validação de massa de dados mostram comportamento coerente com os filtros dinâmicos estabelecidos.
