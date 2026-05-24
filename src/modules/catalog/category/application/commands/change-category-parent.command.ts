export class ChangeCategoryParentCommand {
  constructor(
    public readonly id: string,
    public readonly newParentId: string | null,
  ) {}
}
