import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Category } from '../../domain/category';
import { CATEGORY_REPOSITORY, CategoryRepository } from '../../domain/ports/category.repository';
import { CategoryId } from '../../domain/value-objects/category-id';
import { CategoryName } from '../../domain/value-objects/category-name';
import {
  DOMAIN_EVENT_PUBLISHER,
  DomainEventPublisher,
} from '../../../../../shared/application/domain-event-publisher.port';
import { DuplicateCategoryNameError } from '../errors/duplicate-category-name.error';
import { ParentCategoryNotFoundError } from '../errors/parent-category-not-found.error';
import { CreateCategoryCommand } from './create-category.command';

export interface CreateCategoryResult {
  id: string;
}

@CommandHandler(CreateCategoryCommand)
export class CreateCategoryHandler
  implements ICommandHandler<CreateCategoryCommand, CreateCategoryResult>
{
  constructor(
    @Inject(CATEGORY_REPOSITORY) private readonly repo: CategoryRepository,
    @Inject(DOMAIN_EVENT_PUBLISHER) private readonly publisher: DomainEventPublisher,
  ) {}

  async execute(cmd: CreateCategoryCommand): Promise<CreateCategoryResult> {
    const id = CategoryId.of(cmd.id);
    const name = CategoryName.of(cmd.name);
    const parentId = cmd.parentId ? CategoryId.of(cmd.parentId) : null;

    if (parentId) {
      const parentExists = await this.repo.existsById(parentId);
      if (!parentExists) {
        throw new ParentCategoryNotFoundError(parentId.value);
      }
    }

    const nameTaken = await this.repo.existsByName(name);
    if (nameTaken) {
      throw new DuplicateCategoryNameError(name.value);
    }

    const category = Category.create({ id, name, parentId });
    await this.repo.save(category);
    await this.publisher.publish(category.pullDomainEvents());

    return { id: id.value };
  }
}
