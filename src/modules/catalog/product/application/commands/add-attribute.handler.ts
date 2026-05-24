import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PRODUCT_REPOSITORY, ProductRepository } from '../../domain/ports/product.repository';
import { ProductId } from '../../domain/value-objects/product-id';
import { Attribute } from '../../domain/value-objects/attribute';
import {
  DOMAIN_EVENT_PUBLISHER,
  DomainEventPublisher,
} from '../../../../../shared/application/domain-event-publisher.port';
import { ProductNotFoundError } from '../errors/product-not-found.error';
import { AddAttributeCommand } from './add-attribute.command';

@CommandHandler(AddAttributeCommand)
export class AddAttributeHandler implements ICommandHandler<AddAttributeCommand, void> {
  constructor(
    @Inject(PRODUCT_REPOSITORY) private readonly repo: ProductRepository,
    @Inject(DOMAIN_EVENT_PUBLISHER) private readonly publisher: DomainEventPublisher,
  ) {}

  async execute(cmd: AddAttributeCommand): Promise<void> {
    const id = ProductId.of(cmd.productId);
    const attribute = Attribute.of(cmd.key, cmd.value);

    const product = await this.repo.findById(id);
    if (!product) {
      throw new ProductNotFoundError(id.value);
    }

    product.addAttribute(attribute);
    await this.repo.save(product);
    await this.publisher.publish(product.pullDomainEvents());
  }
}
