import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PRODUCT_REPOSITORY, ProductRepository } from '../../domain/ports/product.repository';
import { ProductId } from '../../domain/value-objects/product-id';
import {
  DOMAIN_EVENT_PUBLISHER,
  DomainEventPublisher,
} from '../../../../../shared/application/domain-event-publisher.port';
import { UNIT_OF_WORK, UnitOfWork } from '../../../../../shared/application/unit-of-work.port';
import { BusinessActionLogger } from '../../../../../shared/infra/logging/business-action.logger';
import { runWithActionLog } from '../../../../../shared/infra/logging/run-with-action-log';
import { ProductNotFoundError } from '../errors/product-not-found.error';
import { RemoveAttributeCommand } from './remove-attribute.command';

@CommandHandler(RemoveAttributeCommand)
export class RemoveAttributeHandler implements ICommandHandler<RemoveAttributeCommand, void> {
  constructor(
    @Inject(PRODUCT_REPOSITORY) private readonly repo: ProductRepository,
    @Inject(DOMAIN_EVENT_PUBLISHER) private readonly publisher: DomainEventPublisher,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    private readonly log: BusinessActionLogger,
  ) {}

  async execute(cmd: RemoveAttributeCommand): Promise<void> {
    const id = ProductId.of(cmd.productId);
    await runWithActionLog(
      this.log,
      {
        action: 'catalog.product.attribute_removed',
        aggregateType: 'catalog.product',
        aggregateId: id.value,
        productId: id.value,
        attributeKey: cmd.key,
      },
      () =>
        this.uow.run(async () => {
          const product = await this.repo.findById(id);
          if (!product) {
            throw new ProductNotFoundError(id.value);
          }

          product.removeAttribute(cmd.key);
          await this.repo.save(product);
          await this.publisher.publish(product.pullDomainEvents());
        }),
    );
  }
}
