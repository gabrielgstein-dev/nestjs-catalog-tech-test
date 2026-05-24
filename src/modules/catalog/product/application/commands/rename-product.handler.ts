import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PRODUCT_REPOSITORY, ProductRepository } from '../../domain/ports/product.repository';
import { ProductId } from '../../domain/value-objects/product-id';
import { ProductName } from '../../domain/value-objects/product-name';
import {
  DOMAIN_EVENT_PUBLISHER,
  DomainEventPublisher,
} from '../../../../../shared/application/domain-event-publisher.port';
import { ProductNotFoundError } from '../errors/product-not-found.error';
import { RenameProductCommand } from './rename-product.command';

@CommandHandler(RenameProductCommand)
export class RenameProductHandler implements ICommandHandler<RenameProductCommand, void> {
  constructor(
    @Inject(PRODUCT_REPOSITORY) private readonly repo: ProductRepository,
    @Inject(DOMAIN_EVENT_PUBLISHER) private readonly publisher: DomainEventPublisher,
  ) {}

  async execute(cmd: RenameProductCommand): Promise<void> {
    const id = ProductId.of(cmd.id);
    const newName = ProductName.of(cmd.newName);

    const product = await this.repo.findById(id);
    if (!product) {
      throw new ProductNotFoundError(id.value);
    }

    product.rename(newName);
    await this.repo.save(product);
    await this.publisher.publish(product.pullDomainEvents());
  }
}
