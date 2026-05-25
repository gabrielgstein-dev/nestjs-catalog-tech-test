# ADR-002 — Transactional Outbox + RabbitMQ

Status: Accepted

## Contexto

Toda mutação relevante do agregado precisa **emitir um evento de domínio**
(`catalog.product.created`, `catalog.product.activated`, …) que dispara
auditoria assíncrona. Existe risco real de inconsistência se a mutação
persistir mas o evento não chegar ao broker — e vice-versa: evento emitido
sem a mutação correspondente comprometida no banco. Isso é o "dual-write
problem" clássico.

A operação de auditoria é assíncrona e desacoplada: o produtor (catalog)
não pode bloquear no broker, e o consumidor (audit) precisa receber **todo**
evento, sem duplicação, mesmo com queda temporária da rede ou do broker.

## Decisão

**Transactional Outbox** com **RabbitMQ** como transporte.

- A mutação do agregado **e** o `INSERT` na tabela `outbox` ocorrem na
  **mesma transação SQL** (`UnitOfWork.run` expõe um `EntityManager` via
  `TransactionContext` que o `OutboxEventPublisher` reusa).
- Um **relay** Nest (`OutboxRelay`, `OnModuleInit`) faz polling a cada
  `pollIntervalMs=500ms`, reivindica até `batchSize=50` linhas `PENDING`
  via `SELECT … FOR UPDATE SKIP LOCKED ORDER BY occurred_at ASC` (não
  bloqueia outras instâncias do relay), publica no exchange
  `catalog.events` (tópico) com `persistent: true`, `messageId =
  outbox.id`, header `x-correlation-id`, e marca a linha como
  `PROCESSED`.
- Se a publicação falhar (broker fora, NACK, throw), a linha fica `PENDING`
  e o tick seguinte tenta de novo. **Zero loss** porque a mutação já está
  commitada.

## Consequências

**Positivas**
- Atomicidade real: ou ambos (mutação + linha do outbox) commitam, ou
  nenhum. Provado por [test/messaging-outbox.e2e-spec.ts:90-119](../../test/messaging-outbox.e2e-spec.ts#L90-L119)
  (mutação que viola unique força rollback da linha do outbox).
- Sobrevive a queda do broker: [test/messaging-outbox.e2e-spec.ts:178-228](../../test/messaging-outbox.e2e-spec.ts#L178-L228)
  faz `docker pause` no Rabbit, executa mutação, verifica `outbox.status
  = PENDING`; dá `unpause` e o relay drena e o `audit_log` chega com o
  `correlationId` original.
- `SKIP LOCKED` permite escalar o relay horizontalmente sem coordenação
  manual.
- Encadeamento HTTP → outbox → relay → AMQP → consumer preserva o
  `correlationId` em todo salto, via header AMQP `x-correlation-id`.

**Negativas**
- Latência mínima de auditoria = `pollIntervalMs` (500ms). Para o caso
  de uso atual (auditoria, não notificação em tempo real) está bom; se
  precisar de tempo-real, considerar `LISTEN/NOTIFY` ou push pelo próprio
  publisher.
- Estado adicional no banco (tabela `outbox` cresce até o relay processar
  + um job de housekeeping eventual para arquivar `PROCESSED` antigos).
  Aceitável pelo ganho de garantia.
- Um relay independente é mais código pra manter que `publish` direto.

## Alternativas consideradas

- **Publish direto pós-commit** (`commit → amqp.publish`): se o broker
  estiver fora entre commit e publish, perdemos o evento silenciosamente.
  Inaceitável dado o requisito de auditoria.
- **2-phase commit (XA) entre Postgres e Rabbit**: existe na teoria, mas
  Rabbit moderno não tem suporte estável a XA, e o custo de ferramental
  é maior que do outbox. Rejeitado.
- **Kafka em vez de RabbitMQ**: Kafka traz persistência nativa e replay
  por consumer-group, o que reduziria o papel do outbox. Mas adiciona
  ZK/KRaft, partições, schema registry — peso desproporcional ao
  problema. Rabbit é mais adequado a este escopo. Rejeitado por escala.
- **BullMQ (Redis-based)**: simples, mas mistura semântica de "fila de
  jobs" (retry, scheduling) com "barramento de eventos". Para
  auditoria desacoplada com múltiplos consumidores futuros (lógica fan-out
  por routing key), tópico AMQP é mais natural. Rejeitado.
- **Não emitir evento — gravar audit_log na mesma transação**: torna a
  auditoria 100% acoplada ao caminho de escrita, impede futuros
  consumidores reagindo aos mesmos eventos (busca, projeções, integrações
  externas) e bloqueia a transação por um INSERT extra. Rejeitado.
