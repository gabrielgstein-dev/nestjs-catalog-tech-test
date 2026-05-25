# ADR-006 — Observabilidade: pino estruturado + correlationId; log ≠ audit_log

Status: Accepted

## Contexto

O enunciado pede **logs estruturados** e **rastreabilidade ponta a ponta**
(do request HTTP até o consumer de auditoria). Stack visual (Grafana,
Loki, ELK) está **fora do escopo** — o enunciado não pede e setá-la pra
um teste técnico polui o foco. O time precisa de algo que (a) seja JSON
parseável por qualquer agente de log e (b) deixe claro **o que** aconteceu
em cada salto, com **qual** correlationId, com **qual** outcome.

Existe também uma confusão recorrente entre `audit_log` (tabela de domínio,
imutável, fonte de verdade para auditoria de negócio) e log de aplicação
(stream JSON pro stdout). Eles **não** são a mesma coisa e não devem
substituir um ao outro.

## Decisão

**`nestjs-pino`** para logs estruturados JSON em stdout (level controlável
por `LOG_LEVEL`), com **três pilares**:

1. **`CorrelationIdMiddleware`** ([src/shared/infra/http/correlation-id.middleware.ts](../../src/shared/infra/http/correlation-id.middleware.ts))
   lê `x-correlation-id` do request (ou gera um `randomUUID` se ausente),
   ecoa no response header, e o coloca num `AsyncLocalStorage`
   (`CorrelationContext`). Toda async chain dentro do request enxerga
   o mesmo `correlationId`.
2. **`BusinessActionLogger`** ([src/shared/infra/logging/business-action.logger.ts](../../src/shared/infra/logging/business-action.logger.ts))
   é um wrapper sobre `pino` que **força um envelope estável** em todo
   log de ação de negócio: `{ action, aggregateType, aggregateId,
   outcome, reason?, correlationId, ...extra }`. `runWithActionLog`
   ([src/shared/infra/logging/run-with-action-log.ts](../../src/shared/infra/logging/run-with-action-log.ts))
   embrulha um handler e mapeia `DomainError → outcome=failure +
   reason=err.code`. O domínio segue puro — só a application chama o logger.
3. **Propagação ponta a ponta**: o `OutboxEventPublisher` grava o
   `correlationId` na linha do outbox; o `OutboxRelay` o promove a header
   AMQP (`x-correlation-id`); o `AuditConsumer` o lê e o passa de volta
   pro logger escopado, e grava em `audit_log.correlation_id`. **Mesmo
   id em todos os saltos**, provado por
   [test/observability-correlation.e2e-spec.ts](../../test/observability-correlation.e2e-spec.ts).

**`audit_log` ≠ log de aplicação**: o primeiro é uma tabela com schema
fechado, imutável, com `event_id` (idempotente), `aggregate_*`,
`event_type`, `payload jsonb`, `correlation_id` e `occurred_at` — é a
**fonte de verdade do que aconteceu no negócio**. O log de aplicação é
volátil, granular, e existe pra debug e operação.

## Consequências

**Positivas**
- Operação grep-friendly: `docker compose logs app | grep <correlationId>`
  basta para reconstruir um fluxo inteiro (provado no smoke).
- Cada `action` é uma string-key estável (`catalog.product.activated`,
  `messaging.outbox.published`, `audit.event.persisted`) — fácil de
  agregar em qualquer stack visual depois.
- `outcome=success|failure` + `reason=err.code` em falhas dá métrica de
  negócio sem regex no message: contar falhas de `product.cannot_be_activated`
  por minuto vira `level:warn AND action:catalog.product.activated AND
  outcome:failure`.
- Domínio continua puro: `BusinessActionLogger` é injetado apenas em
  handlers da application; o agregado nunca conhece `pino`.

**Negativas**
- Verbosidade do envelope. Aceita pra ter consistência — campo opcional
  perdido vira regex frágil; campo padronizado é navegável.
- Sem stack visual: review de logs em desenvolvimento depende do
  `pino-pretty` (dev) ou de `grep | jq` (prod). Adequado ao escopo,
  evolui pra Loki/Grafana se a operação crescer.

## Alternativas consideradas

- **Adicionar Grafana/Loki/Promtail ao Compose**: agrega valor real em
  produção, mas inflam o docker-compose e o tempo de boot, e o enunciado
  só pede "logs estruturados". Rejeitado por escopo; deixado como
  evolução natural.
- **Apenas log do request (pino-http) sem `BusinessActionLogger`**: dá
  HTTP-acesso, não dá ação-de-negócio. Sem o envelope canônico, agregação
  posterior por `action` vira parsing de strings. Rejeitado.
- **Substituir `audit_log` por logs estruturados**: log de aplicação não
  é fonte de verdade — pode ser dropado, redacted, rotacionado. Uma
  consulta "que mudanças sofreu o produto X" precisa de tabela transacional,
  não de busca em arquivos. Rejeitado.
- **OpenTelemetry / traces distribuídos**: dá mais que `correlationId`
  (spans, latência por hop). Vale para um sistema com vários serviços;
  aqui temos um único processo + relay + consumer no mesmo binário, e
  o ganho não justifica o ferramental. Reconsiderar quando virar
  poliglota.
