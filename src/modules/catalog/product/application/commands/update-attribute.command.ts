export class UpdateAttributeCommand {
  constructor(
    public readonly productId: string,
    public readonly key: string,
    public readonly value: string,
  ) {}
}
