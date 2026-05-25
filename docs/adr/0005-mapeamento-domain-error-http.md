# ADR-005 — Mapeamento DomainError → HTTP: 409 uniforme para conflitos (RFC 9110)

Status: Accepted

## Contexto

Toda regra de negócio falha com uma subclasse de `DomainError` que carrega
um `code` estável (ex.: `product.cannot_be_activated`, `category.duplicate_name`,
`product.archived_is_immutable`, `product.not_found`). O controller HTTP
não pode conhecer essas classes (separação de camadas — [ADR-001](0001-arquitetura-clean-hexagonal-cqrs.md)),
então precisa de um `DomainExceptionFilter` global que mapeie
`DomainError → status HTTP` por convenção, sem if/else por classe concreta.

A escolha **fina** seria mapear cada família de erro pra um código HTTP
diferente: `cannot_be_activated → 422`, `duplicate_* → 409`,
`archived_is_immutable → 409`, `not_found → 404`, etc. Isso dá
granularidade mas força o cliente a aprender uma matriz status×code para
saber o que fazer.

## Decisão

**409 uniforme para todo conflito de estado, 404 só para `*.not_found`,
400 só para falhas do `ValidationPipe` (boundary), 500 para tudo o
mais.** Justificativa direta na **RFC 9110 §15.5.10**:

> The 409 (Conflict) status code indicates that the request could not be
> completed due to a conflict with the current state of the target resource.

Todo erro de domínio que rejeitamos (não pode ativar, já arquivado,
duplicate, can't be own parent, invariante quebrada) **é** "conflict with
the current state of the target resource". A regra é simples:

| Caso | Status |
|---|---|
| `code` termina em `_not_found`          | 404 |
| qualquer outro `DomainError`            | 409 |
| `class-validator` falhou no boundary    | 400 |
| `Error` cru (geralmente VO ao se construir) | 400 |
| qualquer outra exception                | 500 (mensagem genérica em produção) |

Implementação: 9 linhas em [src/shared/infra/http/domain-error-status.ts](../../src/shared/infra/http/domain-error-status.ts)
+ o filter em [src/shared/infra/http/exception-filters/domain-exception.filter.ts](../../src/shared/infra/http/exception-filters/domain-exception.filter.ts).

O body de erro padronizado **sempre** carrega `code` (estável, semver-safe),
`message`, `correlationId` e `path`. O cliente decide a UX com base em
`code`, não em status.

## Consequências

**Positivas**
- Cliente tem **uma única rotina de tratamento de erro** por categoria
  HTTP: 4xx do tipo "input inválido" (400/404) vs. "estado inconsistente
  da regra" (409) vs. "infra" (500).
- O `code` é a fonte de verdade fina; o status é o agrupador grosso.
  Quando uma regra nova entra (ex.: `product.cannot_be_archived`), nada
  no filter precisa mudar — basta o `code` terminar em algo que não
  `_not_found` e cai automaticamente no 409.
- Auditável: todos os 18 e2e de mapeamento de erro
  ([test/catalog-http.e2e-spec.ts](../../test/catalog-http.e2e-spec.ts))
  passam só verificando `statusCode` + `code` no body.

**Negativas**
- Quem espera 422 (Unprocessable Entity) para violações semânticas vai
  precisar reler a doc. Mitigado por esta tabela no README + Swagger
  documenta o 409 em cada rota.
- Toda DomainError de conflito sai como 409 — não dá pra distinguir
  "duplicate" de "archived" só pelo status. Mitigado pelo `code` no
  body, que dá granularidade total.

## Alternativas consideradas

- **422 para violações semânticas, 409 só para concorrência otimista**:
  defensável academicamente, mas a RFC é explícita que 409 também
  abarca "current state". 422 é mais comum em validação de payload
  (que já está coberta por 400 via ValidationPipe). Rejeitado por
  duplicar a categoria sem ganho prático.
- **Mapa código→status maximamente granular**: cliente precisaria aprender
  uma matriz com dezenas de combinações. Rejeitado — viola o princípio
  de menor surpresa para um problema que `code` no body já resolve.
- **Sempre 400 para tudo de domínio**: 400 significa "request malformada".
  Uma tentativa de ativar um produto sem categoria é uma request
  perfeitamente bem formada — o estado é que conflita. Rejeitado.
- **Custom status 4xx (ex.: 419)**: viola spec HTTP, polui proxies/CDNs.
  Rejeitado.
