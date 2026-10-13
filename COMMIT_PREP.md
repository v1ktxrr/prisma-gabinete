# Preparação Para Commit

Use este checklist antes de criar um commit no `prisma-app`.

## 1. Segurança

- Confirme que arquivos sensíveis não estão versionados:
  - `.env`
  - `.env.local`
  - chaves e certificados (`*.key`, `*.p12`, `*.pfx`, etc.)
- Confirme que `.agent/` continua no `.gitignore`.
- Rode:

```bash
git ls-files '.env*'
git ls-files | rg '\.key$|\.p12$|\.pfx$|\.crt$|\.cer$|\.der$|\.jks$|\.keystore$'
```

O resultado deve vir vazio.

## 2. Limpeza de Artefatos Locais

- Não commite arquivos temporários de execução:
  - `err.txt`
  - `out.txt`
  - `pid.txt`
  - `temp-next/`
- Confirme que não há lock residual do Git:

```bash
rm -f .git/index.lock
rm -f .git/HEAD.lock
rm -f .git/refs/heads/main.lock
```

## 3. Validação Técnica

- Instale dependências, se necessário:

```bash
npm install
```

- Rode o lint:

```bash
npx eslint app/agenda/page.tsx app/visao-geral/page.tsx app/login/page.tsx app/page.tsx components/agenda-shared.tsx lib/auth-context.tsx middleware.ts
```

- Rode o build local:

```bash
npm run build
```

- Se o deploy alvo for Cloudflare Pages, valide também:

```bash
npm run cloudflare-build
```

## 4. Revisão Funcional Mínima

- Validar login.
- Validar RBAC:
  - `chefe_gabinete`
  - `assessor`
  - `comunicacao`
  - usuário sem cargo
- Validar CRUD em `/agenda` e `/visao-geral`.
- Validar exclusão real no Supabase.
- Validar filtros analíticos do chefe.

## 5. Preparação do Commit

- Verifique o estado da árvore:

```bash
git status
```

- Adicione os arquivos:

```bash
git add .
```

- Revise o que será commitado:

```bash
git diff --cached --stat
git diff --cached
```

- Crie um commit semântico:

```bash
git commit -m "feat: descreva a entrega"
```

## 6. Push

```bash
git push origin main
```

## 7. Observações Deste Projeto

- O porteiro de autenticação está em `middleware.ts`.
- Para este projeto no Cloudflare/Next 16, o runtime atual do middleware deve permanecer:

```ts
export const runtime = "experimental-edge";
```

- Não alterar esquema do Supabase sem instrução explícita.
- Não alterar RBAC/roteamento sem autorização explícita.
