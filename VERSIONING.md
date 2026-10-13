# Classificacao De Versoes

Este documento define como classificar as versoes do Prisma durante a evolucao do produto.

## Convencao Geral

O projeto pode usar duas leituras de versao:

- **Nome de fase do produto:** usado em comunicacao interna e documentacao executiva.
- **Versao tecnica/tag:** usada em commits, releases e deploys.

Para a primeira publicacao operacional:

- **Nome de fase:** Alpha 1.0.
- **Versao tecnica recomendada:** `v0.1.0-alpha.1`.

Essa separacao evita comunicar estabilidade final antes da hora, sem perder o marco simbolico de primeira Alpha publicada.

## Alpha 1.0

Primeira versao colocada no ar para uso operacional real.

### Objetivo

Validar o Prisma como sistema de controle geral de gabinete politico, reunindo agenda, comunicacao, briefings, oficios, prestacao de contas, auditoria e gestao de acessos.

### Caracteristicas Esperadas

- Fluxos principais funcionando de ponta a ponta.
- Uso real por perfis internos.
- Regras centrais de RBAC e multiunidade ja consideradas.
- UI e textos ainda sujeitos a polimento.
- Funcionalidades novas ainda previstas.
- Possibilidade de ajustes em arquitetura, banco e permissoes.

### O Que Nao Significa

Alpha 1.0 nao significa produto final estavel. Durante esta fase, ainda sao esperados:

- ajustes visuais;
- melhorias de experiencia;
- correcao de inconsistencias;
- refinamento de regras de negocio;
- expansao de modulos;
- endurecimento de seguranca;
- reorganizacao pontual de componentes.

## Beta

Fase posterior a Alpha, quando os fluxos centrais ja tiverem sido testados com usuarios reais e as principais decisoes de produto estiverem mais estaveis.

### Criterios Para Entrar Em Beta

- Fluxos de agenda, comunicacao, briefings, oficios e prestacao de contas validados em operacao.
- Matriz RBAC revisada e coerente entre UI, APIs e banco.
- RLS e isolamento por unidade revisados nas tabelas sensiveis.
- Principais bugs funcionais corrigidos.
- Processo minimo de deploy e rollback documentado.
- Changelog atualizado por marco relevante.

## Stable 1.0

Primeira versao considerada consolidada.

### Criterios Para Stable

- Contratos principais de dados estabilizados.
- Fluxos criticos cobertos por validacao manual ou automatizada.
- Riscos conhecidos documentados ou resolvidos.
- UX principal polida para uso recorrente.
- Processo de release previsivel.
- Politicas de acesso e auditoria revisadas.

## Sugestao De Tags

| Fase | Tag tecnica sugerida | Uso |
| --- | --- | --- |
| Alpha 1.0 inicial | `v0.1.0-alpha.1` | Primeiro deploy operacional |
| Alpha incremental | `v0.1.0-alpha.2`, `v0.1.0-alpha.3` | Correcoes e melhorias ainda na Alpha |
| Beta inicial | `v0.5.0-beta.1` | Inicio de validacao mais estavel |
| Stable 1.0 | `v1.0.0` | Produto consolidado |

## Regras Para Novas Versoes

- Toda mudanca relevante de produto deve entrar no `CHANGELOG.md`.
- Mudancas de banco devem citar a migration SQL relacionada.
- Mudancas de permissao devem citar impacto em cargos, modulos e RLS.
- Mudancas de deploy devem atualizar README, checklist ou documentacao operacional.
- Versoes Alpha podem aceitar mudancas estruturais, mas elas devem ser documentadas.
