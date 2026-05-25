# Architecture Decision Records

Decisões arquiteturais do catálogo, formato curto: **Contexto / Decisão /
Consequências / Alternativas consideradas**. Cada ADR cabe numa tela e é
imutável depois de aceito — se uma decisão for revertida, escrevemos um
novo ADR que a supersede.

| # | Decisão | Status |
|---|---|---|
| [001](0001-arquitetura-clean-hexagonal-cqrs.md)            | Clean / Hexagonal por módulo + CQRS                                     | Accepted |
| [002](0002-transactional-outbox-rabbitmq.md)               | Transactional Outbox + RabbitMQ                                          | Accepted |
| [003](0003-consumer-idempotente-retry-dlq.md)              | Consumer idempotente (inbox/dedupe) + retry + DLQ                        | Accepted |
| [004](0004-unicidade-nome-produto.md)                      | Unicidade do nome de produto: gate de ativação + partial unique index    | Accepted |
| [005](0005-mapeamento-domain-error-http.md)                | DomainError → HTTP: 409 uniforme p/ conflitos (RFC 9110)                 | Accepted |
| [006](0006-observabilidade-logs-estruturados.md)           | Observabilidade: pino estruturado + correlationId; log ≠ audit_log       | Accepted |
| [007](0007-docker-compose-multi-stage.md)                  | Docker Compose base + overlays por ambiente; Dockerfile multi-stage      | Accepted |
| [008](0008-estrategia-testes-coverage-mutation.md)         | Estratégia de testes: thresholds por camada + mutation no domínio        | Accepted |
