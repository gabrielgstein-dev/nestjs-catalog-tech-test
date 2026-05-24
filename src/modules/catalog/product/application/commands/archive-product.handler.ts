import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PRODUCT_REPOSITORY, ProductRepository } from '../../domain/ports/product.repository';
import { ProductId } from '../../domain/value-objects/product-id';
import {
  DOMAIN_EVENT_PUBLISHER,
  DomainEventPublisher,
} from '../../../../../shared/application/domain-event-publisher.port';
import { ProductNotFoundError } from '../errors/product-not-found.error';
import { ArchiveProductCommand } from './archive-product.command';

@CommandHandler(ArchiveProductCommand)
export class ArchiveProductHandler implements ICommandHandler<ArchiveProductCommand, void> {
  constructor(
    @Inject(PRODUCT_REPOSITORY) private readonly repo: ProductRepository,
    @Inject(DOMAIN_EVENT_PUBLISHER) private readonly publisher: DomainEventPublisher,
  ) {}

  async execute(cmd: ArchiveProductCommand): Promise<void> {
    const id = ProductId.of(cmd.id);

    const product = await this.repo.findById(id);
    if (!product) {
      throw new ProductNotFoundError(id.value);
    }

    product.archive();
    await this.repo.save(product);
    await this.publisher.publish(product.pullDomainEvents());
  }
}
