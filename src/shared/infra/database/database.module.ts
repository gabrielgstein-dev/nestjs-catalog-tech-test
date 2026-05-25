import { Global, Module } from '@nestjs/common';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { AppConfigService } from '../../config/app-config.service';
import { UNIT_OF_WORK } from '../../application/unit-of-work.port';
import { TypeOrmUnitOfWork } from './typeorm-unit-of-work';
import { dataSourceOptions } from './data-source';

@Global()
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [AppConfigService],
      useFactory: (config: AppConfigService): TypeOrmModuleOptions => ({
        type: 'postgres',
        host: config.database.host,
        port: config.database.port,
        username: config.database.username,
        password: config.database.password,
        database: config.database.database,
        synchronize: false,
        migrationsRun: false,
        autoLoadEntities: true,
        migrations: dataSourceOptions.migrations,
        logging: ['error', 'warn', 'migration'],
        // Be lenient on initial connection — Testcontainers + cold-start in CI can
        // make Postgres reject the first connections after the migration DS closes.
        retryAttempts: 20,
        retryDelay: 1500,
      }),
    }),
  ],
  providers: [{ provide: UNIT_OF_WORK, useClass: TypeOrmUnitOfWork }],
  exports: [UNIT_OF_WORK],
})
export class DatabaseModule {}
