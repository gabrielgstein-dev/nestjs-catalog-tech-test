# ADR-003 — Consumer idempotente (inbox/dedupe) + retry + DLQ

Status: Accepted

## Contexto

[ADR-002](0002-transactional-outbox-rabbitmq.md) garante **at-least-once
delivery** entre o produtor e o broker: o relay republica até a publicação
ser aceita. Isso implica que o consumer **pode receber o mesmo evento mais
de uma vez** — reentrega do Rabbit após NACK, reentrega após reconexão,
republish pelo próprio consumer no caminho de retry.

O `audit_log` precisa ter **exatamente uma linha por evento**, ou as
consultas de auditoria viram inúteis. Também precisamos isolar falhas
permanentes ("poison message" — payload malformado, bug do handler) para
elas não bloquearem o stream nem ficarem em loop infinito.

## Decisão

**Inbox / dedupe table** + **retry com cap** + **DLQ explícita**.

- Tabela `processed_event(event_id, consumer, processed_at)` com PK
  composta `(event_id, consumer)`. O `ProcessDomainEventUseCase` faz
  `INSERT INTO processed_event … ON CONFLICT DO NOTHING RETURNING event_id`
  como **primeira** operação da sua transação. Se a linha já existia,
  o `RETURNING` vem vazio, o use case retorna `{ recorded: false }` e
  o `audit_log` **não é tocado**. Reentrega → idempotência total.
- Se o `useCase.execute` lançar (erro de banco, payload válido mas
  inesperado), o `AuditConsumer` decide: se `x-attempts < AUDIT_MAX_ATTEMPTS
  (=5)`, **republica a mesma mensagem** no mesmo exchange com
  `x-attempts` incrementado (backoff implícito pelo round-trip do broker
  + a próxima entrega). Se `x-attempts >= MAX`, **re-throw** — o
  `@golevelup/nestjs-rabbitmq` faz NACK sem requeue, e o `x-dead-letter-
  exchange` da fila roteia para `audit.events.dlq`.
- Mensagens malformadas (sem `event_id`, sem `aggregateId`, etc.) são
  **rejeitadas imediatamente** (throw → DLQ) sem retry — não vão melhorar
  com tentativas.

## Consequências

**Positivas**
- Idempotência provada: [test/messaging-outbox.e2e-spec.ts:122-176](../../test/messaging-outbox.e2e-spec.ts#L122-L176)
  republica o mesmo `event_id` 3 vezes e verifica que `audit_log` tem
  exatamente 1 linha e `processed_event` tem 1 marker.
- DLQ provada: [test/messaging-outbox.e2e-spec.ts:231-268](../../test/messaging-outbox.e2e-spec.ts#L231-L268)
  força falha permanente no use case e verifica a mensagem em
  `audit.events.dlq` após 5 tentativas com `x-attempts >= 4`.
- Poison messages ficam contidas — operação consegue inspecionar a DLQ,
  corrigir o consumer/payload, e fazer shovel de volta pra fila principal.
- `processed_event` é uma tabela de log append-only com volume modesto
  (1 linha por evento por consumer); rotação posterior é trivial.

**Negativas**
- Uma transação extra (a do consumer) por evento. Em troca da garantia
  exatamente-uma-vez no `audit_log`, aceitável.
- Retry implícito pelo broker (não há backoff exponencial real). Para
  carga atual e para falhas transientes curtas (broker reconectando)
  funciona; se aparecer um caso de uso com falhas longas + custosas,
  trocar pelo `delayed-message-exchange` do Rabbit ou plugin de retry.
- A presença de DLQ exige acompanhamento operacional. Hoje não há alerta
  automatizado — fica documentado como follow-up.

## Alternativas consideradas

- **Sem dedupe explícito, contar com `messageId` + `auto-ack` cuidadoso**:
  frágil; qualquer reconexão durante o handler causa duplicata. Rejeitado.
- **Lock distribuído por `event_id` (Redis)**: adiciona dependência
  externa e ainda não dá idempotência forte (a janela entre lock e
  insert no `audit_log` permite duplicar se o lock cair). Rejeitado.
- **Constraint UNIQUE em `audit_log.event_id`**: funciona como rede de
  segurança final, mas faz o caminho normal lançar exception em cada
  reentrega — caro e poluído nos logs. A inbox separada é mais explícita
  sobre intenção: "esse evento já foi processado, pule".
- **Retry com backoff exponencial via plugin**: melhor em padrões com
  failure modes diversos. Para uma fila com um único consumer e falhas
  raras, o NACK + republish é suficiente. Pode evoluir.
