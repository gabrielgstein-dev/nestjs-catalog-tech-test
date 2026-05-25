import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { randomUUID } from 'node:crypto';
import { CreateProductCommand } from '../../application/commands/create-product.command';
import { CreateProductResult } from '../../application/commands/create-product.handler';
import { RenameProductCommand } from '../../application/commands/rename-product.command';
import { ChangeProductDescriptionCommand } from '../../application/commands/change-product-description.command';
import { ActivateProductCommand } from '../../application/commands/activate-product.command';
import { ArchiveProductCommand } from '../../application/commands/archive-product.command';
import { AttachCategoryToProductCommand } from '../../application/commands/attach-category-to-product.command';
import { DetachCategoryFromProductCommand } from '../../application/commands/detach-category-from-product.command';
import { AddAttributeCommand } from '../../application/commands/add-attribute.command';
import { UpdateAttributeCommand } from '../../application/commands/update-attribute.command';
import { RemoveAttributeCommand } from '../../application/commands/remove-attribute.command';
import { GetProductByIdQuery } from '../../application/queries/get-product-by-id.query';
import { ProductView } from '../../application/queries/get-product-by-id.handler';
import { ListProductsQuery } from '../../application/queries/list-products.query';
import { PagedProductView } from '../../application/queries/list-products.handler';
import { ProductStatus, isProductStatus } from '../../domain/value-objects/product-status';
import { CreateProductDto } from './dtos/create-product.dto';
import { UpdateProductDto } from './dtos/update-product.dto';
import { AddAttributeDto } from './dtos/add-attribute.dto';
import { UpdateAttributeDto } from './dtos/update-attribute.dto';
import { AttachCategoryDto } from './dtos/attach-category.dto';
import { ProductResponseDto } from './dtos/product-response.dto';

@ApiTags('products')
@Controller('products')
export class ProductController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: 'Create a product. Born in DRAFT status.' })
  @ApiCreatedResponse({ type: ProductResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid payload.' })
  async create(@Body() dto: CreateProductDto): Promise<ProductResponseDto> {
    const id = randomUUID();
    const result = await this.commandBus.execute<CreateProductCommand, CreateProductResult>(
      new CreateProductCommand(id, dto.name, dto.description ?? null),
    );
    return this.getOne(result.id);
  }

  @Patch(':id')
  @HttpCode(200)
  @ApiOperation({
    summary:
      'Update product. When ARCHIVED only `description` is allowed; any other field returns 409.',
  })
  @ApiOkResponse({ type: ProductResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid payload.' })
  @ApiNotFoundResponse({ description: 'Product not found.' })
  @ApiConflictResponse({ description: 'Domain rule violated (e.g. archived rename).' })
  async update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateProductDto,
  ): Promise<ProductResponseDto> {
    if (dto.name !== undefined) {
      await this.commandBus.execute(new RenameProductCommand(id, dto.name));
    }
    if (Object.prototype.hasOwnProperty.call(dto, 'description')) {
      await this.commandBus.execute(
        new ChangeProductDescriptionCommand(id, dto.description ?? null),
      );
    }
    return this.getOne(id);
  }

  @Post(':id/activate')
  @HttpCode(204)
  @ApiOperation({
    summary:
      'Activate a product. Requires >=1 category, >=1 attribute, and unique name among non-archived products.',
  })
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ description: 'Product not found.' })
  @ApiConflictResponse({ description: 'Activation pre-conditions not met.' })
  async activate(@Param('id', new ParseUUIDPipe()) id: string): Promise<void> {
    await this.commandBus.execute(new ActivateProductCommand(id));
  }

  @Post(':id/archive')
  @HttpCode(204)
  @ApiOperation({ summary: 'Archive a product (terminal state).' })
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ description: 'Product not found.' })
  @ApiConflictResponse({ description: 'Already archived.' })
  async archive(@Param('id', new ParseUUIDPipe()) id: string): Promise<void> {
    await this.commandBus.execute(new ArchiveProductCommand(id));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a product by id.' })
  @ApiOkResponse({ type: ProductResponseDto })
  @ApiNotFoundResponse({ description: 'Product not found.' })
  async getOne(@Param('id', new ParseUUIDPipe()) id: string): Promise<ProductResponseDto> {
    const view = await this.queryBus.execute<GetProductByIdQuery, ProductView>(
      new GetProductByIdQuery(id),
    );
    return view;
  }

  @Get()
  @ApiOperation({ summary: 'List products (ordered by name).' })
  @ApiOkResponse({ description: 'Paged product list.' })
  @ApiQuery({ name: 'status', required: false, enum: ProductStatus })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  async list(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('status') status?: string,
  ): Promise<PagedProductView> {
    const l = limit !== undefined ? Number(limit) : 50;
    const o = offset !== undefined ? Number(offset) : 0;
    const s = status && isProductStatus(status) ? status : null;
    return this.queryBus.execute(
      new ListProductsQuery(Number.isFinite(l) ? l : 50, Number.isFinite(o) ? o : 0, s),
    );
  }

  @Post(':id/categories')
  @HttpCode(204)
  @ApiOperation({ summary: 'Attach a category to the product.' })
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ description: 'Product or category not found.' })
  @ApiConflictResponse({ description: 'Cannot attach (e.g. archived product).' })
  async attachCategory(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: AttachCategoryDto,
  ): Promise<void> {
    await this.commandBus.execute(new AttachCategoryToProductCommand(id, dto.categoryId));
  }

  @Delete(':id/categories/:categoryId')
  @HttpCode(204)
  @ApiOperation({ summary: 'Detach a category from the product.' })
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ description: 'Product not found.' })
  @ApiConflictResponse({
    description: 'Cannot detach (e.g. archived or removing last category of an active product).',
  })
  async detachCategory(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('categoryId', new ParseUUIDPipe()) categoryId: string,
  ): Promise<void> {
    await this.commandBus.execute(new DetachCategoryFromProductCommand(id, categoryId));
  }

  @Post(':id/attributes')
  @HttpCode(201)
  @ApiOperation({ summary: 'Add an attribute. Key must be unique on this product.' })
  @ApiCreatedResponse({ type: ProductResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid key/value.' })
  @ApiNotFoundResponse({ description: 'Product not found.' })
  @ApiConflictResponse({ description: 'Duplicate key or archived product.' })
  async addAttribute(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: AddAttributeDto,
  ): Promise<ProductResponseDto> {
    await this.commandBus.execute(new AddAttributeCommand(id, dto.key, dto.value));
    return this.getOne(id);
  }

  @Patch(':id/attributes/:key')
  @HttpCode(200)
  @ApiOperation({ summary: 'Update an attribute value by key.' })
  @ApiOkResponse({ type: ProductResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid value.' })
  @ApiNotFoundResponse({ description: 'Product not found.' })
  @ApiConflictResponse({ description: 'Attribute key not found or archived product.' })
  async updateAttribute(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('key') key: string,
    @Body() dto: UpdateAttributeDto,
  ): Promise<ProductResponseDto> {
    await this.commandBus.execute(new UpdateAttributeCommand(id, key, dto.value));
    return this.getOne(id);
  }

  @Delete(':id/attributes/:key')
  @HttpCode(204)
  @ApiOperation({ summary: 'Remove an attribute by key.' })
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ description: 'Product not found.' })
  @ApiConflictResponse({
    description: 'Archived product or removing the last attribute of an active product.',
  })
  async removeAttribute(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('key') key: string,
  ): Promise<void> {
    await this.commandBus.execute(new RemoveAttributeCommand(id, key));
  }
}
