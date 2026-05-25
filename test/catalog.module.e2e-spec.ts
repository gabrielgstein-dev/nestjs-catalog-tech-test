/**
 * CRÍTICO 3 — DI wire
 *
 * Verifica que o Nest container consegue resolver os tokens PRODUCT_REPOSITORY
 * e CATEGORY_REPOSITORY exportados pelo CatalogModule em runtime.
 *
 * Usa TypeOrmModule.forRoot direto (sem DatabaseModule / AppConfigService) para
 * evitar dependência de variáveis de ambiente no CI.
 */
import { Global, Module } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { join } from 'node:path';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { CatalogModule } from '../src/modules/catalog/catalog.module';
import { CATEGORY_REPOSITORY } from '../src/modules/catalog/category/domain/ports/category.repository';
import { PRODUCT_REPOSITORY } from '../src/modules/catalog/product/domain/ports/product.repository';
import { CategoryRepositoryTypeOrm } from '../src/modules/catalog/category/infra/repositories/category.repository.typeorm';
import { ProductRepositoryTypeOrm } from '../src/modules/catalog/product/infra/repositories/product.repository.typeorm';
import { DOMAIN_EVENT_PUBLISHER } from '../src/shared/application/domain-event-publisher.port';
import { UNIT_OF_WORK } from '../src/shared/application/unit-of-work.port';
import { InMemoryDomainEventPublisher } from '../src/shared/application/__test-fixtures__/in-memory-domain-event-publisher';
import { PassThroughUnitOfWork } from '../src/shared/application/__test-fixtures__/pass-through-unit-of-work';

@Global()
@Module({
  providers: [
    { provide: DOMAIN_EVENT_PUBLISHER, useClass: InMemoryDomainEventPublisher },
    { provide: UNIT_OF_WORK, useClass: PassThroughUnitOfWork },
  ],
  exports: [DOMAIN_EVENT_PUBLISHER, UNIT_OF_WORK],
})
class CatalogTestStubs {}

jest.setTimeout(180_000);

describe('CatalogModule DI wire (integration)', () => {
  let postgres: StartedPostgreSqlContainer;
  let module: TestingModule;

  beforeAll(async () => {
    postgres = await new PostgreSqlContainer('postgres:16-alpine')
      .withDatabase('catalog')
      .withUsername('catalog')
      .withPassword('catalog')
      .start();

    module = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'postgres',
          host: postgres.getHost(),
          port: postgres.getMappedPort(5432),
          username: postgres.getUsername(),
          password: postgres.getPassword(),
          database: postgres.getDatabase(),
          autoLoadEntities: true,
          synchronize: false,
          migrationsRun: false,
          entities: [join(__dirname, '../src/modules/**/infra/entities/*.entity.ts')],
          logging: false,
        }),
        CatalogTestStubs,
        CatalogModule,
      ],
    }).compile();
  });

  afterAll(async () => {
    await module?.close();
    await postgres?.stop();
  });

  it('resolves CATEGORY_REPOSITORY token as CategoryRepositoryTypeOrm', () => {
    const repo = module.get(CATEGORY_REPOSITORY);
    expect(repo).toBeInstanceOf(CategoryRepositoryTypeOrm);
  });

  it('resolves PRODUCT_REPOSITORY token as ProductRepositoryTypeOrm', () => {
    const repo = module.get(PRODUCT_REPOSITORY);
    expect(repo).toBeInstanceOf(ProductRepositoryTypeOrm);
  });
});
