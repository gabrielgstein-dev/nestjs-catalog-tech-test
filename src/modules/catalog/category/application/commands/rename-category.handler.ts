import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { CATEGORY_REPOSITORY, CategoryRepository } from '../../domain/ports/category.repository';
import { CategoryId } from '../../domain/value-objects/category-id';
import { CategoryName } from '../../domain/value-objects/category-name';
import {
  DOMAIN_EVENT_PUBLISHER,
  DomainEventPublisher,
} from '../../../../../shared/application/domain-event-publisher.port';
import { UNIT_OF_WORK, UnitOfWork } from '../../../../../shared/application/unit-of-work.port';
import { BusinessActionLogger } from '../../../../../shared/infra/logging/business-action.logger';
import { runWithActionLog } from '../../../../../shared/infra/logging/run-with-action-log';
import { CategoryNotFoundError } from '../errors/category-not-found.error';
import { DuplicateCategoryNameError } from '../errors/duplicate-category-name.error';
import { RenameCategoryCommand } from './rename-category.command';

@CommandHandler(RenameCategoryCommand)
export class RenameCategoryHandler implements ICommandHandler<RenameCategoryCommand, void> {
  constructor(
    @Inject(CATEGORY_REPOSITORY) private readonly repo: CategoryRepository,
    @Inject(DOMAIN_EVENT_PUBLISHER) private readonly publisher: DomainEventPublisher,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    private readonly log: BusinessActionLogger,
  ) {}

  async execute(cmd: RenameCategoryCommand): Promise<void> {
    const id = CategoryId.of(cmd.id);
    await runWithActionLog(
      this.log,
      {
        action: 'catalog.category.renamed',
        aggregateType: 'catalog.category',
        aggregateId: id.value,
        categoryId: id.value,
      },
      () =>
        this.uow.run(async () => {
          const newName = CategoryName.of(cmd.newName);

          const category = await this.repo.findById(id);
          if (!category) {
            throw new CategoryNotFoundError(id.value);
          }

          if (category.name.equals(newName)) {
            return;
          }

          const nameTaken = await this.repo.existsByName(newName, id);
          if (nameTaken) {
            throw new DuplicateCategoryNameError(newName.value);
          }

          category.rename(newName);
          await this.repo.save(category);
          await this.publisher.publish(category.pullDomainEvents());
        }),
    );
  }
}
