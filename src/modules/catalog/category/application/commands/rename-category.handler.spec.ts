import { RenameCategoryHandler } from './rename-category.handler';
import { RenameCategoryCommand } from './rename-category.command';
import { InMemoryCategoryRepository } from '../__test-fixtures__/in-memory-category.repository';
import { InMemoryDomainEventPublisher } from '../../../../../shared/application/__test-fixtures__/in-memory-domain-event-publisher';
import { PassThroughUnitOfWork } from '../../../../../shared/application/__test-fixtures__/pass-through-unit-of-work';
import { silentBusinessActionLogger } from '../../../../../shared/infra/logging/__test-fixtures__/silent-business-action-logger';
import { Category } from '../../domain/category';
import { CategoryId } from '../../domain/value-objects/category-id';
import { CategoryName } from '../../domain/value-objects/category-name';
import { CategoryUpdated } from '../../domain/events/category-updated.event';
import { CategoryNotFoundError } from '../errors/category-not-found.error';
import { DuplicateCategoryNameError } from '../errors/duplicate-category-name.error';

const seedCategory = (repo: InMemoryCategoryRepository, id: string, name: string) => {
  repo.seed(
    Category.rehydrate({
      id: CategoryId.of(id),
      name: CategoryName.of(name),
      parentId: null,
    }),
  );
};

const build = () => {
  const repo = new InMemoryCategoryRepository();
  const publisher = new InMemoryDomainEventPublisher();
  return {
    repo,
    publisher,
    handler: new RenameCategoryHandler(
      repo,
      publisher,
      new PassThroughUnitOfWork(),
      silentBusinessActionLogger(),
    ),
  };
};

describe('RenameCategoryHandler', () => {
  it('renames an existing category and publishes CategoryUpdated', async () => {
    const { handler, repo, publisher } = build();
    seedCategory(repo, 'c1', 'Old');

    await handler.execute(new RenameCategoryCommand('c1', 'New'));

    const saved = await repo.findById(CategoryId.of('c1'));
    expect(saved?.name.value).toBe('New');
    expect(publisher.byName(CategoryUpdated.EVENT_NAME)).toHaveLength(1);
  });

  it('throws CategoryNotFoundError when the category does not exist', async () => {
    const { handler } = build();

    await expect(
      handler.execute(new RenameCategoryCommand('missing', 'New')),
    ).rejects.toBeInstanceOf(CategoryNotFoundError);
  });

  it('is a no-op when renamed to the same value (no save, no publish)', async () => {
    const { handler, repo, publisher } = build();
    seedCategory(repo, 'c1', 'Same');
    const saveSpy = jest.spyOn(repo, 'save');

    await handler.execute(new RenameCategoryCommand('c1', 'Same'));

    expect(saveSpy).not.toHaveBeenCalled();
    expect(publisher.published).toHaveLength(0);
  });

  it('rejects when the new name is taken by another category', async () => {
    const { handler, repo } = build();
    seedCategory(repo, 'c1', 'Original');
    seedCategory(repo, 'c2', 'Taken');

    await expect(handler.execute(new RenameCategoryCommand('c1', 'Taken'))).rejects.toBeInstanceOf(
      DuplicateCategoryNameError,
    );
  });

  it('allows renaming to the SAME entity own name (excludes self from uniqueness check)', async () => {
    const { handler, repo } = build();
    seedCategory(repo, 'c1', 'Same');
    seedCategory(repo, 'c2', 'Other');

    await expect(handler.execute(new RenameCategoryCommand('c1', 'Same'))).resolves.toBeUndefined();
  });
});
