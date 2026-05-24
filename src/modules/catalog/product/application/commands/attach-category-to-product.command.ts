export class AttachCategoryToProductCommand {
  constructor(
    public readonly productId: string,
    public readonly categoryId: string,
  ) {}
}
