import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { CATEGORY_REPOSITORY, CategoryRepository } from '../../domain/ports/category.repository';
import { CategoryId } from '../../domain/value-objects/category-id';
import {
  DOMAIN_EVENT_PUBLISHER,
  DomainEventPublisher,
} from '../../../../../shared/application/domain-event-publisher.port';
import { UNIT_OF_WORK, UnitOfWork } from '../../../../../shared/application/unit-of-work.port';
import { BusinessActionLogger } from '../../../../../shared/infra/logging/business-action.logger';
import { runWithActionLog } from '../../../../../shared/infra/logging/run-with-action-log';
import { CategoryNotFoundError } from '../errors/category-not-found.error';
import { ParentCategoryNotFoundError } from '../errors/parent-category-not-found.error';
import { ChangeCategoryParentCommand } from './change-category-parent.command';

@CommandHandler(ChangeCategoryParentCommand)
export class ChangeCategoryParentHandler
  implements ICommandHandler<ChangeCategoryParentCommand, void>
{
  constructor(
    @Inject(CATEGORY_REPOSITORY) private readonly repo: CategoryRepository,
    @Inject(DOMAIN_EVENT_PUBLISHER) private readonly publisher: DomainEventPublisher,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    private readonly log: BusinessActionLogger,
  ) {}

  async execute(cmd: ChangeCategoryParentCommand): Promise<void> {
    const id = CategoryId.of(cmd.id);
    await runWithActionLog(
      this.log,
      {
        action: 'catalog.category.parent_changed',
        aggregateType: 'catalog.category',
        aggregateId: id.value,
        categoryId: id.value,
      },
      () =>
        this.uow.run(async () => {
          const newParentId = cmd.newParentId ? CategoryId.of(cmd.newParentId) : null;

          const category = await this.repo.findById(id);
          if (!category) {
            throw new CategoryNotFoundError(id.value);
          }

          if (newParentId) {
            const parentExists = await this.repo.existsById(newParentId);
            if (!parentExists) {
              throw new ParentCategoryNotFoundError(newParentId.value);
            }
          }

          category.changeParent(newParentId);
          await this.repo.save(category);
          await this.publisher.publish(category.pullDomainEvents());
        }),
    );
  }
}
