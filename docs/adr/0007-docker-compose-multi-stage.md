# ADR-007 — Docker Compose: base + overlays por ambiente; Dockerfile multi-stage

Status: Accepted

## Contexto

O projeto tem três modos de uso reais:

- **Dev local**: auto-reload, volume montado no `src/`, `npm run start:dev`,
  Postgres exposto no host pra o IDE se conectar.
- **Imagem de produção**: `node dist/main.js`, sem `ts-node`, sem `nest`,
  rodando como usuário não-root, com `restart: unless-stopped`.
- **Smoke isolado**: imagem de produção rodando em portas remapeadas, sem
  colidir com o ambiente dev do usuário, com volumes próprios — pra avaliar
  a entrega num ambiente pristina.

Cada modo precisa de **build target diferente**, **command diferente**,
**ports diferentes**, mas o resto (rede, volumes, healthcheck do Postgres
e Rabbit, env vars padrão) é idêntico.

## Decisão

**Compose base (`docker-compose.yml`) + overlays por modo**. Aproveitamos
a convenção do Docker Compose: ao rodar `docker compose up`, o
`docker-compose.override.yml` é **auto-loaded** e mergeado sobre o base.
Listar arquivos explicitamente com `-f` **desativa** o auto-load.

```
docker-compose.yml          ← serviços + rede + volumes + healthchecks (compartilhados)
docker-compose.override.yml ← dev (auto-loaded por padrão): target=dev, volumes em src/, ports 3000/5433
docker-compose.prod.yml     ← prod: target=production, restart=unless-stopped, command=node dist/main.js
docker-compose.smoke.yml    ← smoke: target=production, ports remapeadas (3010/5434/5673/15673)
```

Uso real:

```bash
# dev (auto override)
docker compose up --build

# prod local
docker compose -f docker-compose.yml -f docker-compose.prod.yml up --build

# smoke isolado (NÃO carrega override.yml dev)
docker compose -p catalog-smoke \
  -f docker-compose.yml -f docker-compose.smoke.yml \
  up --build -d
```

**`Dockerfile` multi-stage** com 4 stages:
- `base` — Node 22-alpine + usuário `nestjs:nodejs` não-root.
- `build` — instala deps full + roda `nest build` → produz `dist/`.
- `dev` — deps full + monta `src/` via volume (override).
- `prod-deps` — só `npm ci --omit=dev` + `cache clean`.
- `production` — copia `prod-deps/node_modules` + `build/dist` + roda como `nestjs:nodejs` com `node dist/main.js`.

A imagem final NÃO carrega `ts-node`, `@nestjs/cli`, `webpack`, ou nada do
toolchain — esse é o motivo de os 3 HIGH CVEs restantes (em `@nestjs/cli`
+ transitivos) **não chegarem ao runtime** (ver [ADR-008](0008-estrategia-testes-coverage-mutation.md)).

## Consequências

**Positivas**
- Zero duplicação entre modos — o que muda fica no overlay; o resto vem
  do base.
- Tempo de boot do zero ao `/health` 200: ~15–20s (medido no smoke,
  máquina pristina).
- Imagem de produção é a menor possível (só prod-deps + dist + `package.json`),
  reduz superfície de ataque.
- `depends_on: condition: service_healthy` no app força ordem real (não
  só `service_started`) — postgres e rabbit têm healthcheck próprio
  (pg_isready / rabbitmq-diagnostics check_running). Provado pelo
  smoke: `postgres Healthy → rabbitmq Healthy → app Starting`.

**Negativas**
- O auto-load do `override.yml` é uma **pegadinha** para quem chega novo:
  rodar `docker compose -f docker-compose.yml -f docker-compose.prod.yml up`
  parece simples, mas se a pessoa esquecer o `-f docker-compose.yml`, o
  Compose carrega o override sozinho. Mitigado pelo README explicitar os
  comandos completos.
- Migrations rodam no boot do app dev (via `npm run migration:run`) e
  no entrypoint do prod (via `node ./node_modules/typeorm/cli.js ...`).
  Dois caminhos, mas o `data-source.ts` é único, então não há
  divergência de schema.

## Alternativas consideradas

- **Um compose por ambiente, sem base compartilhado** (`docker-compose.dev.yml`
  + `docker-compose.prod.yml`, cada um completo). Mais explícito, mas
  duplica services / network / volumes / healthcheck — qualquer ajuste
  vira diff em vários arquivos. Rejeitado.
- **Compose com perfis (`profiles:`)**: ajuda quando se quer ligar/desligar
  serviços (ex.: subir só Postgres), mas não substitui overlay quando o
  que muda é configuração do MESMO serviço (target, command, ports).
  Não atende; rejeitado.
- **Dockerfile single-stage**: imagem maior, com `ts-node` e toolchain no
  runtime, mais CVEs expostos. Rejeitado.
- **Subir app no host + Postgres/Rabbit no Docker**: ok pra desenvolver,
  mas o entregável precisa ser "clone e `docker compose up`" — single
  command. Rejeitado para entrega.
