# ADR-004 — Unicidade do nome de produto: gate de ativação + partial unique index

Status: Accepted

## Contexto

O enunciado afirma "nome do produto é único". Interpretado literalmente como
UNIQUE global em `product.name`, isso quebra dois cenários legítimos:

1. **Dois rascunhos com o mesmo nome são válidos**: durante curadoria, dois
   editores podem ter, simultaneamente, um "iPhone 15" em `DRAFT` até
   decidirem qual versão publicar.
2. **Reaproveitar nome de produto arquivado**: depois que uma versão é
   arquivada (`ARCHIVED`), o nome volta a estar disponível para uma versão
   nova.

Por outro lado, **dois produtos `ACTIVE` com o mesmo nome são realmente
inaceitáveis** — daria conflito direto no catálogo do cliente final. E
existe uma **race window** entre duas chamadas concorrentes de `/activate`
ativando produtos homônimos.

## Decisão

Unicidade do nome **scope-limitada a `status = 'ACTIVE'`**, enforced em
duas camadas:

1. **Gate de aplicação** no `ActivateProductHandler`:
   `repo.existsOtherWithSameNameExcludingArchived(name, id)` — se outro
   produto não-arquivado já tem o mesmo nome, lança
   `ProductCannotBeActivatedError('name_taken')` → HTTP 409. Esse é o
   caminho que produz mensagem de erro útil para o cliente.
2. **Partial unique index no banco** ([migration
   1716552100000-CatalogTables.ts:42-45](../../src/shared/infra/database/migrations/1716552100000-CatalogTables.ts#L42-L45)):

   ```sql
   CREATE UNIQUE INDEX uq_product_name_active
     ON product (name) WHERE status = 'ACTIVE';
   ```

   Esse índice é a **rede de segurança contra a race** entre duas
   ativações simultâneas que passariam pelo gate de aplicação ao mesmo
   tempo. A segunda transação que tenta `COMMIT` recebe violação de
   unicidade e o evento + a outbox da segunda também são desfeitos
   (atomicidade do [ADR-002](0002-transactional-outbox-rabbitmq.md)).

Sem UNIQUE global em `product.name`. `DRAFT` homônimos: permitidos.
`ARCHIVED` libera o nome.

## Consequências

**Positivas**
- O cliente HTTP recebe um erro **explicado** (`product.cannot_be_activated`
  com reason `name_taken`) no caminho normal, em vez de uma constraint
  violation crua.
- Sob concorrência, o índice parcial garante invariante mesmo se duas
  ativações cruzarem o gate de aplicação ao mesmo tempo.
- O custo do índice é proporcional só à fatia `ACTIVE` (a maioria do
  catálogo em estado terminal não pesa no índice).

**Negativas**
- A regra "nome único" tem **dois lugares**: handler e migration. Quem
  alterar a semântica precisa lembrar de tocar os dois. Mitigado pelo
  e2e que cruza concorrência ([test/catalog-http.e2e-spec.ts](../../test/catalog-http.e2e-spec.ts)
  ativa o teste de unicidade no fluxo completo) e pelo ADR como
  documentação canônica.
- Violação do índice no caminho de race é uma exception crua no log do
  Postgres; mapeada por TypeORM como erro de driver — não tão bonita
  quanto a do gate de aplicação. Considerado aceitável porque é o caso
  raro (não-feliz).

## Alternativas consideradas

- **UNIQUE global em `product.name`**: simples, mas proíbe dois DRAFTs
  homônimos e bloqueia reuso após arquivamento. Rejeitado — viola o
  modelo de negócio que o enunciado descreve.
- **Só gate de aplicação, sem índice**: deixa janela de race entre
  ativações simultâneas. Rejeitado — invariante crítica precisa de
  defesa-em-profundidade no banco.
- **Lock pessimista no Postgres (`SELECT … FOR UPDATE` no nome)**:
  bloqueia a tabela inteira (não há linha-com-nome-X até a ativação),
  custoso e não combina bem com a transação curta do handler. Partial
  index é mais barato e mais declarativo. Rejeitado.
- **Unicidade case-insensitive (`LOWER(name)`)**: simplifica UX (não
  permite "iPhone" e "iphone" ativos juntos), mas o enunciado não pediu
  e adiciona surpresa para o usuário da API. Deixado de fora;
  reconsiderar se vier requisito.
