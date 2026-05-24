export class RenameProductCommand {
  constructor(
    public readonly id: string,
    public readonly newName: string,
  ) {}
}
