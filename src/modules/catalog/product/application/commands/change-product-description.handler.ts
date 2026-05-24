import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PRODUCT_REPOSITORY, ProductRepository } from '../../domain/ports/product.repository';
import { ProductId } from '../../domain/value-objects/product-id';
import { ProductDescription } from '../../domain/value-objects/product-description';
import {
  DOMAIN_EVENT_PUBLISHER,
  DomainEventPublisher,
} from '../../../../../shared/application/domain-event-publisher.port';
import { ProductNotFoundError } from '../errors/product-not-found.error';
import { ChangeProductDescriptionCommand } from './change-product-description.command';

@CommandHandler(ChangeProductDescriptionCommand)
export class ChangeProductDescriptionHandler
  implements ICommandHandler<ChangeProductDescriptionCommand, void>
{
  constructor(
    @Inject(PRODUCT_REPOSITORY) private readonly repo: ProductRepository,
    @Inject(DOMAIN_EVENT_PUBLISHER) private readonly publisher: DomainEventPublisher,
  ) {}

  async execute(cmd: ChangeProductDescriptionCommand): Promise<void> {
    const id = ProductId.of(cmd.id);
    const description = ProductDescription.of(cmd.description);

    const product = await this.repo.findById(id);
    if (!product) {
      throw new ProductNotFoundError(id.value);
    }

    product.changeDescription(description);
    await this.repo.save(product);
    await this.publisher.publish(product.pullDomainEvents());
  }
}
