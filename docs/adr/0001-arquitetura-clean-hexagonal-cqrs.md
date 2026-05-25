# ADR-001 — Arquitetura Clean / Hexagonal por módulo + CQRS

Status: Accepted

## Contexto

O enunciado pede um catálogo de produtos com transições de estado de produto
(DRAFT → ACTIVE → ARCHIVED), invariantes de ativação (≥1 categoria, ≥1
atributo, unicidade de nome entre não-arquivados), integridade transacional
da mutação + evento, e auditoria. A complexidade está na **lógica de domínio**,
não no CRUD.

Um service-CRUD plano (controller chama service chama repository, tudo no
mesmo arquivo) resolveria a parte fácil, mas misturaria regra de negócio com
fiação de framework (TypeORM/NestJS) e tornaria o teste de invariantes
dependente de Docker + banco. Também dificultaria distinguir um caso de uso
("ativar produto") de uma consulta ("listar produtos por status").

## Decisão

Adotar **Clean / Hexagonal por módulo + CQRS**, com 4 camadas isoladas em cada
módulo de negócio:

- `domain/` — agregados, value objects, eventos, erros. **Puro** (sem
  `@nestjs/*`, sem `typeorm`, sem `pino`). Invariantes vivem aqui.
- `application/` — use cases na forma de CQRS Command/Query handlers
  (`@nestjs/cqrs`). Conhece apenas **ports** (`PRODUCT_REPOSITORY`,
  `DOMAIN_EVENT_PUBLISHER`, `UNIT_OF_WORK`), nunca implementações.
- `infra/` — adaptadores: repositórios TypeORM, mappers domínio↔persistência,
  publishers AMQP, `OutboxEventPublisher` que implementa o port de domínio.
- `presentation/` — controllers HTTP (`class-validator` no boundary, DTOs,
  Swagger), AMQP consumers.

Dependências apontam só pra dentro: `presentation → application → domain` e
`infra → application + domain`. A regra é verificada por grep em CI e por
testes que rodam o domínio em isolamento total (zero Docker, zero NestJS
container).

## Consequências

**Positivas**
- Domínio testável em milissegundos sem nenhuma infra (269 unit tests rodam
  em ~8s).
- Trocar TypeORM por Prisma, ou Postgres por outro store, é uma mudança
  cirúrgica no adapter — não toca o domínio nem os use cases.
- CQRS dá nomes explícitos a cada intenção (`ActivateProductCommand`,
  `GetProductByIdQuery`), o que casa naturalmente com auditoria e logs de
  ação de negócio.
- Cada decisão de invariante tem um único lugar de moradia (`product.ts`,
  `category.ts`) — auditável e fácil de mutar com Stryker.

**Negativas**
- Mais arquivos: cada caso de uso vira `command + handler + port + adapter`.
  Aceita-se pela clareza — 4 arquivos pequenos > 1 arquivo com tudo.
- O leitor novo precisa entender a topologia uma vez para se localizar.
  Mitigado pela documentação aqui e pela uniformidade entre os módulos.

## Alternativas consideradas

- **Service-CRUD plano (controller → service → repository)**: rápido para
  começar, mas dissolve as invariantes de ativação no meio de chamadas a
  repositórios, transforma o teste do domínio em teste integrado, e força
  o `audit_log` a virar um detalhe lateral do service em vez de uma
  consequência transacional do evento. Rejeitado.
- **Repository pattern só (sem CQRS)**: cobre o domínio, mas perde a
  distinção entre comando (que muta + emite evento) e query (que projeta).
  Numa API com auditoria por intenção de negócio, essa distinção paga aluguel.
  Rejeitado.
- **Event sourcing**: resolveria auditoria "de graça", mas é uma decisão
  arquitetural muito maior do que o problema pede, com custo alto em
  ferramental, snapshots e projeções. Rejeitado por escopo.
