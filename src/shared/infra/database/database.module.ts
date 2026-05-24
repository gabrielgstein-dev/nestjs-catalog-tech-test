import { Module } from '@nestjs/common';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { AppConfigService } from '../../config/app-config.service';
import { dataSourceOptions } from './data-source';

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
      }),
    }),
  ],
})
export class DatabaseModule {}
