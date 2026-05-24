export enum ProductStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  ARCHIVED = 'ARCHIVED',
}

export function isProductStatus(value: unknown): value is ProductStatus {
  return (
    value === ProductStatus.DRAFT ||
    value === ProductStatus.ACTIVE ||
    value === ProductStatus.ARCHIVED
  );
}
