export class RenameCategoryCommand {
  constructor(
    public readonly id: string,
    public readonly newName: string,
  ) {}
}
