export class CreateCategoryCommand {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly parentId: string | null = null,
  ) {}
}
