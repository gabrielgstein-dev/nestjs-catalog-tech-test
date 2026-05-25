# Catálogo de produtos — NestJS

Backend em **NestJS + TypeScript (strict)** seguindo Clean / Hexagonal por módulo,
CQRS, transactional outbox e observabilidade ponta a ponta com `correlationId`.

Status: **Fases 0–6 entregues e verdes** (setup → domínio puro → casos de uso →
persistência → mensageria confiável → observabilidade → API REST + Swagger).
Métricas atuais: **210 unit + 65 e2e ✓**, lint/typecheck/build ✓, `npm audit
--audit-level=high` sem CVEs no caminho de produção.

---

## Stack

- Node 22 LTS · TypeScript 5.6 (strict)
- NestJS 10 · `@nestjs/cqrs` · `@nestjs/terminus` · `@nestjs/swagger`
- PostgreSQL 16 + TypeORM 0.3 (migrations, **sem** `synchronize`)
- RabbitMQ 3.13 + `@golevelup/nestjs-rabbitmq` (outbox + DLQ)
- `nestjs-pino` (JSON estruturado, correlationId automático)
- `class-validator` + `class-transformer` (validação de entrada no boundary)
- `@nestjs/config` + Joi (validação fail-fast de env)
- Jest · Testcontainers (Postgres + RabbitMQ reais nos e2e)

---

## Como rodar

### Dev (auto-reload, volume montado)

```bash
cp .env.example .env
docker compose up --build
```

Sobe app em `:3000`, Postgres em `:5433` (host) → `:5432` (container),
RabbitMQ em `:5672` + management UI `:15672`. Migrations rodam no boot.

### Smoke da imagem prod (isolado, sem conflito de portas)

Útil pra avaliar a imagem multi-stage real (`node dist/main.js`, não-root,
sem ts-node, migrations compiladas) sem mexer em outro Compose stack que
esteja rodando no host:

```bash
docker compose \
  -f docker-compose.yml \
  -f docker-compose.smoke.yml \
  -p catalog-smoke \
  up --build -d
```

Sobe na porta `:3010` (app), `:5434` (postgres), `:5673`/`:15673` (rabbit).
Tear down: `docker compose -p catalog-smoke down -v`.

### Variáveis de ambiente

Validadas no boot pelo Joi — boot falha rápido se algo falta. Ver
[.env.example](.env.example) pro template.

| Variável            | Default                            |
|---------------------|------------------------------------|
| `NODE_ENV`          | `development`                      |
| `PORT`              | `3000`                             |
| `LOG_LEVEL`         | `info`                             |
| `DB_HOST`           | `postgres`                         |
| `DB_PORT`           | `5432`                             |
| `DB_USER`           | `catalog`                          |
| `DB_PASSWORD`       | `catalog`                          |
| `DB_NAME`           | `catalog`                          |
| `RABBITMQ_URL`      | `amqp://guest:guest@rabbitmq:5672` |
| `RABBITMQ_EXCHANGE` | `catalog.events`                   |

---

## Endpoints (Swagger em `/docs`)

### products
| Verb | Path | |
|------|------|---|
| `POST`   | `/products` | cria DRAFT |
| `GET`    | `/products/:id` | consulta |
| `GET`    | `/products?status=&limit=&offset=` | lista paginada |
| `PATCH`  | `/products/:id` | renomeia + altera descrição |
| `POST`   | `/products/:id/activate` | ativa (gates: ≥1 cat, ≥1 attr, nome único) |
| `POST`   | `/products/:id/archive` | arquiva (estado terminal) |
| `POST`   | `/products/:id/categories` body `{categoryId}` | associa categoria |
| `DELETE` | `/products/:id/categories/:categoryId` | remove associação |
| `POST`   | `/products/:id/attributes` body `{key,value}` | adiciona atributo |
| `PATCH`  | `/products/:id/attributes/:key` body `{value}` | atualiza valor |
| `DELETE` | `/products/:id/attributes/:key` | remove atributo |

### categories
| Verb | Path | |
|------|------|---|
| `POST`  | `/categories` body `{name, parentId?}` | cria (nome único global) |
| `GET`   | `/categories/:id` | consulta |
| `GET`   | `/categories?limit=&offset=` | lista paginada |
| `PATCH` | `/categories/:id` body `{name?, parentId?}` | renomeia + muda pai |

### health
| Verb | Path | |
|------|------|---|
| `GET` | `/health` | Postgres ping + RabbitMQ.connected |

### Mapeamento `DomainError` → HTTP

| Faixa | Códigos | Status |
|-------|---------|--------|
| Recurso ausente | `*.not_found`, `*.parent_not_found`, `attribute_key_not_found` | **404** |
| Conflito de estado | `*.duplicate_*`, `*.archived_is_immutable`, `*.cannot_be_activated`, `*.cannot_be_own_parent`, `*.active_invariant_violated`, `*.invalid_state` | **409** |
| Input inválido | ValidationPipe / VO `Error` cru | **400** |
| Inesperado | qualquer outra exception | **500** |

Justificativa 409 vs 422: RFC 9110 define 409 como "conflict with the
**current state of the target resource**" — encaixa em todos os domain errors
(duplicates, archived, can't-be-activated, can't-be-own-parent). Optei por
**uniformidade 409 sobre granularidade**: um único pattern de error handling no
client.

Resposta de erro padronizada:

```json
{
  "statusCode": 409,
  "error": "Conflict",
  "code": "product.cannot_be_activated",
  "message": "Product cannot be activated: at least one category is required",
  "correlationId": "demo-abc-123",
  "timestamp": "2026-05-25T17:14:45.984Z",
  "path": "/products/.../activate"
}
```

`x-correlation-id` também ecoa no header da resposta — fecha a rastreabilidade
ponta a ponta também no caminho de falha.

---

## Fluxo completo (curl)

Após subir o smoke ou o compose padrão:

```bash
CORR=demo-$(date +%s)
BASE=http://localhost:3010   # 3000 no compose padrão

curl -s $BASE/health | jq .

CATEGORY_ID=$(curl -s -X POST $BASE/categories \
  -H "x-correlation-id: $CORR" -H 'content-type: application/json' \
  -d '{"name":"Electronics"}' | jq -r .id)

PRODUCT_ID=$(curl -s -X POST $BASE/products \
  -H "x-correlation-id: $CORR" -H 'content-type: application/json' \
  -d '{"name":"iPhone 15","description":"Apple flagship"}' | jq -r .id)

curl -s -X POST $BASE/products/$PRODUCT_ID/categories \
  -H "x-correlation-id: $CORR" -H 'content-type: application/json' \
  -d "{\"categoryId\":\"$CATEGORY_ID\"}"

curl -s -X POST $BASE/products/$PRODUCT_ID/attributes \
  -H "x-correlation-id: $CORR" -H 'content-type: application/json' \
  -d '{"key":"color","value":"silver"}' | jq .

curl -s -X POST $BASE/products/$PRODUCT_ID/activate \
  -H "x-correlation-id: $CORR"

curl -s $BASE/products/$PRODUCT_ID | jq .
# → status: "ACTIVE", categoryIds: [...], attributes: [{...}]

docker compose -p catalog-smoke logs app | grep $CORR
# → mesmo correlationId atravessa todos os saltos:
#   HTTP handler → outbox.enqueued → outbox.published → audit.event.received → audit.event.persisted
```

---

## Como rodar os testes

```bash
npm test            # 210 unit (jest)
npm run test:e2e    # 65 e2e (Testcontainers — Postgres + RabbitMQ reais)
npm run lint
npm run typecheck
npm run build
```

CI: GitHub Actions ([.github/workflows/ci.yml](.github/workflows/ci.yml))
roda `lint → typecheck → test → build` em Node 22 a cada push/PR.

---

## Estrutura

```
src/
├─ main.ts                                # bootstrap + Swagger + filter global
├─ app.module.ts
├─ modules/
│  ├─ catalog/
│  │  ├─ product/{domain,application,infra,presentation/{http,dtos}}
│  │  └─ category/{domain,application,infra,presentation/{http,dtos}}
│  ├─ audit/                              # consumer + processed-event + audit_log
│  ├─ health/                             # /health (terminus)
│  └─ skeleton/                           # walking skeleton (descartável)
└─ shared/
   ├─ domain/                             # AggregateRoot, DomainEvent, DomainError
   ├─ application/                        # UnitOfWork port, CorrelationContext, TransactionContext
   ├─ config/                             # AppConfigService + Joi schema
   └─ infra/
      ├─ database/                        # DataSource + DatabaseModule + migrations
      ├─ messaging/                       # RabbitMQ wiring
      ├─ outbox/                          # transactional outbox + relay (poller)
      ├─ logging/                         # nestjs-pino + BusinessActionLogger
      └─ http/                            # CorrelationIdMiddleware + DomainExceptionFilter + Swagger bootstrap

test/                                     # e2e specs (supertest + Testcontainers)
```

Camadas por módulo:
- **domain** — puro, sem framework. Sem imports de NestJS/TypeORM/pino.
- **application** — casos de uso (CQRS commands/queries). Sem imports de infra.
- **infra** — TypeORM, RabbitMQ, repositórios, mappers.
- **presentation** — controllers HTTP + DTOs (`class-validator`) + AMQP consumers.

---

## Decisões-chave

### Transactional outbox
Mutação do agregado + linha na tabela `outbox` commitam na **mesma transação**.
Um worker poller ([src/shared/infra/outbox/outbox-relay.service.ts](src/shared/infra/outbox/outbox-relay.service.ts))
claim-and-publica (com `FOR UPDATE SKIP LOCKED`) pro RabbitMQ. Se o broker
estiver fora, o tick falha; nada se perde, o relay tenta de novo. Retry +
DLQ via header `x-attempts` no consumer.

### Consumer idempotente
Tabela `processed_event(event_id, consumer)` com `INSERT … ON CONFLICT DO
NOTHING`. Reentrega não duplica o `audit_log`.

### correlationId end-to-end
HTTP middleware lê/gera `x-correlation-id` → `AsyncLocalStorage` →
`OutboxEventPublisher` grava na linha do outbox → `OutboxRelay` propaga no
header AMQP → `AuditConsumer` lê o header → `audit_log.correlation_id`.
Testado via e2e em [test/observability-correlation.e2e-spec.ts](test/observability-correlation.e2e-spec.ts).

### Logging estruturado por ação de negócio
`BusinessActionLogger` ([src/shared/infra/logging/business-action.logger.ts](src/shared/infra/logging/business-action.logger.ts))
emite `{ action, aggregateType, aggregateId, outcome, reason?, correlationId, ... }`
em todo handler. `runWithActionLog` mapeia `DomainError → outcome=failure
+ reason=err.code`. Domínio **continua puro** (não importa pino).

### Domain pure
- `domain/` sem imports de NestJS/TypeORM/pino — verificado por `grep` ao
  longo das auditorias QA.
- `application/` só conhece ports (`PRODUCT_REPOSITORY`, `DOMAIN_EVENT_PUBLISHER`,
  `UNIT_OF_WORK`), não a implementação.
- Errors de domínio têm `code` estável (ex.: `product.cannot_be_activated`) —
  o `DomainExceptionFilter` mapeia code → HTTP sem o domínio conhecer HTTP.

---

## Comandos npm

```bash
npm run start:dev        # nest start --watch
npm run build            # compila para ./dist
npm run start:prod       # node dist/main.js
npm run lint             # ESLint + Prettier (--max-warnings=0)
npm run typecheck        # tsc --noEmit
npm test                 # Jest unit
npm run test:e2e         # Jest + Testcontainers (Postgres + RabbitMQ reais)
npm run migration:run    # roda migrations no DB configurado
npm run migration:revert # desfaz a última
```

---

## O que vem nas próximas fases

- **Fase 7** — `coverageThreshold` no Jest config (100% domain/application/
  presentation, 80% infra), preencher gaps de cobertura em `audit/`,
  considerar mutation testing.
- **Fase 8** — ADRs (`docs/adr/`) documentando decisões arquiteturais
  detalhadas (outbox, 409 vs 422, correlationId, domain purity), polish
  final do README.
