import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PRODUCT_REPOSITORY, ProductRepository } from '../../domain/ports/product.repository';
import { ProductId } from '../../domain/value-objects/product-id';
import { CategoryId } from '../../../category/domain/value-objects/category-id';
import {
  DOMAIN_EVENT_PUBLISHER,
  DomainEventPublisher,
} from '../../../../../shared/application/domain-event-publisher.port';
import { UNIT_OF_WORK, UnitOfWork } from '../../../../../shared/application/unit-of-work.port';
import { BusinessActionLogger } from '../../../../../shared/infra/logging/business-action.logger';
import { runWithActionLog } from '../../../../../shared/infra/logging/run-with-action-log';
import { ProductNotFoundError } from '../errors/product-not-found.error';
import { DetachCategoryFromProductCommand } from './detach-category-from-product.command';

@CommandHandler(DetachCategoryFromProductCommand)
export class DetachCategoryFromProductHandler
  implements ICommandHandler<DetachCategoryFromProductCommand, void>
{
  constructor(
    @Inject(PRODUCT_REPOSITORY) private readonly products: ProductRepository,
    @Inject(DOMAIN_EVENT_PUBLISHER) private readonly publisher: DomainEventPublisher,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    private readonly log: BusinessActionLogger,
  ) {}

  async execute(cmd: DetachCategoryFromProductCommand): Promise<void> {
    const productId = ProductId.of(cmd.productId);
    const categoryId = CategoryId.of(cmd.categoryId);
    await runWithActionLog(
      this.log,
      {
        action: 'catalog.product.category_detached',
        aggregateType: 'catalog.product',
        aggregateId: productId.value,
        productId: productId.value,
        categoryId: categoryId.value,
      },
      () =>
        this.uow.run(async () => {
          const product = await this.products.findById(productId);
          if (!product) {
            throw new ProductNotFoundError(productId.value);
          }

          product.detachCategory(categoryId);
          await this.products.save(product);
          await this.publisher.publish(product.pullDomainEvents());
        }),
    );
  }
}
