export class DetachCategoryFromProductCommand {
  constructor(
    public readonly productId: string,
    public readonly categoryId: string,
  ) {}
}
