import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Product } from '../../domain/product';
import { PRODUCT_REPOSITORY, ProductRepository } from '../../domain/ports/product.repository';
import { ProductId } from '../../domain/value-objects/product-id';
import { ProductName } from '../../domain/value-objects/product-name';
import { ProductDescription } from '../../domain/value-objects/product-description';
import {
  DOMAIN_EVENT_PUBLISHER,
  DomainEventPublisher,
} from '../../../../../shared/application/domain-event-publisher.port';
import { UNIT_OF_WORK, UnitOfWork } from '../../../../../shared/application/unit-of-work.port';
import { BusinessActionLogger } from '../../../../../shared/infra/logging/business-action.logger';
import { runWithActionLog } from '../../../../../shared/infra/logging/run-with-action-log';
import { CreateProductCommand } from './create-product.command';

export interface CreateProductResult {
  id: string;
}

@CommandHandler(CreateProductCommand)
export class CreateProductHandler
  implements ICommandHandler<CreateProductCommand, CreateProductResult>
{
  constructor(
    @Inject(PRODUCT_REPOSITORY) private readonly repo: ProductRepository,
    @Inject(DOMAIN_EVENT_PUBLISHER) private readonly publisher: DomainEventPublisher,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    private readonly log: BusinessActionLogger,
  ) {}

  async execute(cmd: CreateProductCommand): Promise<CreateProductResult> {
    const id = ProductId.of(cmd.id);
    return runWithActionLog(
      this.log,
      {
        action: 'catalog.product.created',
        aggregateType: 'catalog.product',
        aggregateId: id.value,
        productId: id.value,
      },
      () =>
        this.uow.run(async () => {
          const name = ProductName.of(cmd.name);
          const description = ProductDescription.of(cmd.description);

          const product = Product.create({ id, name, description });
          await this.repo.save(product);
          await this.publisher.publish(product.pullDomainEvents());

          return { id: id.value };
        }),
    );
  }
}
