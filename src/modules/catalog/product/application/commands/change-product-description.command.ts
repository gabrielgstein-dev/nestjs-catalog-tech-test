export class ChangeProductDescriptionCommand {
  constructor(
    public readonly id: string,
    public readonly description: string | null,
  ) {}
}
