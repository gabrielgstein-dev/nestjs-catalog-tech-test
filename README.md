# Catálogo de produtos — NestJS (Fase 0: skeleton)

Backend em **NestJS + TypeScript (strict)** seguindo Clean/Hexagonal por módulo.
Esta fase entrega o *walking skeleton* — o caminho fino que prova a fiação
ponta a ponta (HTTP → DB → RabbitMQ → consumer → DB) com `correlationId`
propagado em todo o fluxo.

> O domínio (Produto/Categoria/Atributo) **ainda não foi implementado** — vem
> nas próximas fases. O módulo `skeleton` é descartável.

## Stack

- Node 22 LTS · TypeScript 5.6 (strict)
- NestJS 10 · @nestjs/cqrs · @nestjs/terminus
- PostgreSQL 16 + TypeORM 0.3 (migrations, **sem** `synchronize`)
- RabbitMQ 3.13 + `@golevelup/nestjs-rabbitmq`
- `nestjs-pino` + `pino-http` (JSON estruturado, correlationId automático)
- `@nestjs/config` + Joi (validação fail-fast)
- Jest · Testcontainers (Postgres + RabbitMQ) para e2e

## Estrutura

```
src/
├─ main.ts
├─ app.module.ts
├─ modules/
│  ├─ catalog/
│  │  ├─ product/{domain,application,infra,presentation}    # vazio (Fase 1+)
│  │  └─ category/{domain,application,infra,presentation}   # vazio (Fase 1+)
│  ├─ audit/{domain,application,infra,presentation}         # vazio
│  ├─ health/                                               # /health
│  └─ skeleton/                                             # walking skeleton
│     ├─ domain/
│     ├─ application/{commands,queries}
│     ├─ infra/{entities,messaging,repositories}
│     └─ presentation/{http,messaging}
└─ shared/
   ├─ config/       # ConfigModule + Joi schema + AppConfigService
   ├─ domain/
   ├─ application/
   └─ infra/
      ├─ database/  # DataSource CLI + DatabaseModule + migrations/
      ├─ messaging/ # RabbitMQ wiring
      ├─ logging/   # pino + genReqId → correlationId
      └─ http/      # CorrelationIdMiddleware + constants
```

Camadas por módulo: **domain** (puro, sem framework) · **application**
(casos de uso, CQRS) · **infra** (TypeORM, RabbitMQ, repos) · **presentation**
(controllers HTTP e consumers AMQP).

## Variáveis de ambiente

Veja [.env.example](.env.example). Valores são validados no boot pelo Joi —
se faltar alguma chave obrigatória, a app falha rápido.

| Variável            | Default                         | Notas                          |
|---------------------|---------------------------------|--------------------------------|
| `NODE_ENV`          | `development`                   | `development`/`production`/`test`/`staging` |
| `PORT`              | `3000`                          |                                |
| `LOG_LEVEL`         | `info`                          | `fatal`/`error`/`warn`/`info`/`debug`/`trace` |
| `DB_HOST`           | `postgres`                      | hostname do serviço no compose |
| `DB_PORT`           | `5432`                          |                                |
| `DB_USER`           | `catalog`                       |                                |
| `DB_PASSWORD`       | `catalog`                       |                                |
| `DB_NAME`           | `catalog`                       |                                |
| `RABBITMQ_URL`      | `amqp://guest:guest@rabbitmq:5672` |                             |
| `RABBITMQ_EXCHANGE` | `catalog.events`                | topic exchange                 |

## Como subir o ambiente

```bash
cp .env.example .env

# Sobe app (modo dev, watch + log debug) + Postgres + RabbitMQ
docker compose up --build
```

O dev compose (`compose.override.yaml`) faz:
- monta `./src` no container (Nest watch)
- expõe Postgres em `localhost:5432` e RabbitMQ em `localhost:5672`
  (management UI em http://localhost:15672, guest/guest)
- roda `npm run migration:run` antes de iniciar a app

Produção (`compose.prod.yaml`) usa o estágio `production` da imagem (não-root,
sem devDeps, sem volume, restart automático). Stg vs prd só muda
`--env-file`:

```bash
docker compose -f compose.yaml -f compose.prod.yaml --env-file .env.prod up -d

# Rodar migrations em prod (separadamente):
docker compose -f compose.yaml -f compose.prod.yaml run --rm app \
  node ./node_modules/typeorm/cli.js \
  -d dist/shared/infra/database/data-source.js migration:run
```

## Endpoints

- `GET  /health` — terminus check (DB + RabbitMQ). 200 quando ambos UP.
- `POST /skeleton/ping` — corpo `{ "payload": "..." }`. Grava em `skeleton_ping`
  e publica no exchange. Retorna `{ id, correlationId }`.
- `GET  /skeleton/ping/:id` — devolve o ping + o último ack do consumer.

### Prova ponta a ponta

```bash
# 1. Sobe tudo
docker compose up -d

# 2. Confere health
curl -s localhost:3000/health | jq

# 3. Cria um ping com correlationId conhecido
curl -s -X POST localhost:3000/skeleton/ping \
  -H 'content-type: application/json' \
  -H 'x-correlation-id: demo-abc-123' \
  -d '{"payload":"hello world"}' | jq

# 4. Lê o estado (deve trazer ack.status = "processed" em milissegundos)
curl -s localhost:3000/skeleton/ping/<ID-DA-RESPOSTA> | jq

# 5. Olha os logs procurando "demo-abc-123" — vai aparecer em:
#    - log do HTTP (pino-http genReqId)
#    - log do CreatePingHandler (persisted, published)
#    - log do SkeletonConsumer (received, ack persisted)
docker compose logs app | grep demo-abc-123
```

Se você não enviar o header `x-correlation-id`, o `pino-http` gera um UUID
e propaga ele do mesmo jeito.

## Comandos npm

```bash
npm run start:dev        # nest start --watch
npm run build            # compila para ./dist
npm run start:prod       # node dist/main.js
npm run lint             # ESLint + Prettier
npm run typecheck        # tsc --noEmit
npm test                 # Jest unit
npm run test:e2e         # Jest + Testcontainers (Postgres + RabbitMQ reais)
npm run migration:run    # roda migrations no DB configurado
npm run migration:revert # desfaz a última
```

## CI

GitHub Actions ([.github/workflows/ci.yml](.github/workflows/ci.yml)) roda
`lint → typecheck → test → build` em cada push e PR, em Node 22.

## Decisões da Fase 0

- TypeORM `synchronize: false` — schema só via migrations.
- `gen_random_uuid()` via extensão `pgcrypto` (criada na migration).
- O `data-source.ts` é compartilhado: o `DatabaseModule` reusa as `migrations`
  e `entities`; o CLI do TypeORM aponta direto pro arquivo (para gerar/rodar
  migrations).
- A mensageria final será **Transactional Outbox + RabbitMQ** — esta fase só
  prova a conexão e o flow de publish/consume com correlationId.
- Pino com transport `pino-pretty` em dev e JSON puro em prod
  (`NODE_ENV=production`).
