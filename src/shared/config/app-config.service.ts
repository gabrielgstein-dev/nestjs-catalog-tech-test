import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AppConfigService {
  constructor(private readonly config: ConfigService) {}

  get nodeEnv(): string {
    return this.config.getOrThrow<string>('NODE_ENV');
  }

  get port(): number {
    return Number(this.config.getOrThrow<number>('PORT'));
  }

  get logLevel(): string {
    return this.config.getOrThrow<string>('LOG_LEVEL');
  }

  get database() {
    return {
      host: this.config.getOrThrow<string>('DB_HOST'),
      port: Number(this.config.getOrThrow<number>('DB_PORT')),
      username: this.config.getOrThrow<string>('DB_USER'),
      password: this.config.getOrThrow<string>('DB_PASSWORD'),
      database: this.config.getOrThrow<string>('DB_NAME'),
    };
  }

  get rabbitmq() {
    return {
      url: this.config.getOrThrow<string>('RABBITMQ_URL'),
      exchange: this.config.getOrThrow<string>('RABBITMQ_EXCHANGE'),
    };
  }
}
