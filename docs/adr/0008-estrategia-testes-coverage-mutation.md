# ADR-008 — Estratégia de testes: thresholds por camada + mutation no domínio

Status: Accepted

## Contexto

Uma suíte pode estar **verde** mas ainda assim ser inútil — testes que
replicam a implementação para inflar cobertura, asserts vazios, mocks
sobre mocks. O sinal certo não é "% de linhas executadas", e sim "se eu
quebrar a lógica, algum teste falha".

Também há tensão entre velocidade (unit puro, sem Docker) e fidelidade
(integração real com Postgres + RabbitMQ). Não dá pra ter os dois no
mesmo runner sem alguém pagar — runs unit lentas matam o loop de TDD;
runs e2e levam minutos.

Por fim, `npm audit` puxa CVEs de devDependencies que **nunca entram no
runtime de produção**. Tratá-las como bloqueante consome tempo e força
upgrades breaking sem ganho real de risco.

## Decisão

**Três decisões combinadas**:

### 1. Suítes separadas por projeto Jest

`package.json#jest.projects` define dois projects: `unit` e `e2e`. O
runner default escolhe por `--selectProjects`:
- `npm test` → unit only (~8s, sem Docker).
- `npm run test:e2e` → e2e only (Testcontainers, Postgres + Rabbit reais).
- `npm run test:cov:all` → ambos com **coverage combinado** + gating.

### 2. Coverage thresholds por camada (gating real)

Definidos em `package.json#jest.coverageThreshold`:

| Camada | stmt / branch / func / line | Racional |
|---|---|---|
| `**/domain/**`         | 100/100/100/100 | puro, crítico, sem desculpa |
| `**/application/**`    |  95/ 90/ 95/ 95 | use cases — alguns branches defensivos triviais |
| `**/presentation/**`   |  90/ 85/ 90/ 90 | controllers misturam guard de framework |
| `shared/infra/**`      |  80/ 75/ 80/ 80 | relay, exception filter, wiring AMQP |
| `global`               |  85/ 80/ 85/ 85 | rede de segurança |

Excluídos do `collectCoverageFrom`: `*.module.ts`, `*.entity.ts`,
`*.dto.ts`, migrations, `main.ts`, `data-source.ts`, walking-skeleton.
Cobrir fiação não dá sinal de bug — gastá-lo no que importa.

### 3. Mutation testing apenas no domínio

`stryker.conf.json` mira só `**/domain/**` (mais `shared/domain/`).
Score atual: **80.10%** (Product 93.75%, Category 100%, shared/domain 100%).
Survivors restantes são StringLiteral em mensagens de erro — não
pinamos texto, então são falsos positivos aceitos. Stryker fica DENTRO
da definição de "alta confiança no domínio", não como meta para infra.

### 4. CVEs dev-only documentadas como deferred

`testcontainers 10 → 12` foi resolvido (limpa undici/dockerode/tar-fs).
3 HIGH restantes (`@nestjs/cli` + transitivos `glob`, `picomatch`,
`webpack`) são devDependencies usadas apenas em `nest build`/schematics.
A imagem de produção ([ADR-007](0007-docker-compose-multi-stage.md))
copia só `prod-deps` + `dist` — nenhum desses pacotes entra no runtime.
Upgrade para `@nestjs/cli 11` é breaking (Angular 19 schematics) sem
ganho de risco em prod. **Adiado conscientemente**, documentado aqui.

## Consequências

**Positivas**
- Loop de TDD rápido: unit em ~8s é compatível com salvar e rodar.
- Gating real: `test:cov:all` falha se a cobertura cair abaixo do
  threshold (provado quando os primeiros valores eram 82% e Jest abortou).
- Mutation score 80%+ no domínio prova que os unit tests "matam"
  mutações reais — não são fachada.
- Audit baseline transparente: 7 HIGH → 3 HIGH, e os 3 restantes têm
  justificativa escrita.

**Negativas**
- Dois runners Jest (unit + e2e) precisam de configuração separada
  (projects). Aceitável pelo ganho de speed/separation.
- Não fazer mutation em infra esconde possíveis fachadas lá. Aceito
  por escopo — o sinal mais alto está no domínio.
- 3 HIGH em `npm audit` continuam aparecendo. Quem rodar o comando
  sem contexto vai se assustar. Mitigado pela documentação aqui +
  README §8 (checklist), e por estarem no fechamento da entrega.

## Alternativas consideradas

- **Um único runner com unit+e2e juntos**: `npm test` levaria minutos
  e quebraria o loop curto. Rejeitado.
- **100% global de cobertura**: incentiva testes-fachada (teste que só
  invoca o método pra contar linha). Rejeitado por princípio — mutation
  > cobertura.
- **Mutation em todo o codebase**: ~10× mais lento, sinal diluído. A
  marginalia de infra é mais bem coberta por e2e do que por mutants.
  Rejeitado.
- **Forçar upgrade `@nestjs/cli` para zerar o `npm audit`**: introduz
  breaking changes em `nest build` para corrigir CVEs que não chegam
  ao runtime. Trade-off ruim. Rejeitado.
- **Property-based testing (fast-check)** no domínio: ferramenta forte
  para invariantes; útil em VOs e agregados. Considerado pra evolução
  futura; mutation + unit example-based já dão sinal alto pro escopo
  atual.
