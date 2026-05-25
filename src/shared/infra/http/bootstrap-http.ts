import { INestApplication, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppConfigService } from '../../config/app-config.service';
import { DomainExceptionFilter } from './exception-filters/domain-exception.filter';

export function configureHttpApp(app: INestApplication): void {
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );

  let configService: AppConfigService | undefined;
  try {
    configService = app.get(AppConfigService);
  } catch {
    configService = undefined;
  }
  app.useGlobalFilters(new DomainExceptionFilter(configService));
}

export function mountSwagger(app: INestApplication): void {
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Catalog API')
    .setDescription(
      'Catálogo de produtos — NestJS + CQRS + DDD/Clean/Hexagonal. ' +
        'Erros de domínio retornam 409 (Conflict). Recursos ausentes retornam 404. ' +
        'Payload inválido retorna 400. Toda resposta inclui o header x-correlation-id.',
    )
    .setVersion('0.1.0')
    .addTag('categories')
    .addTag('products')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);
}
