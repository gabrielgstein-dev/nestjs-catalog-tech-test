import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { wasFieldSent } from '../../../../../shared/infra/http/raw-body';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { randomUUID } from 'node:crypto';
import { CreateCategoryCommand } from '../../application/commands/create-category.command';
import { CreateCategoryResult } from '../../application/commands/create-category.handler';
import { RenameCategoryCommand } from '../../application/commands/rename-category.command';
import { ChangeCategoryParentCommand } from '../../application/commands/change-category-parent.command';
import { GetCategoryByIdQuery } from '../../application/queries/get-category-by-id.query';
import { CategoryView } from '../../application/queries/get-category-by-id.handler';
import { ListCategoriesQuery } from '../../application/queries/list-categories.query';
import { PagedCategoryView } from '../../application/queries/list-categories.handler';
import { CreateCategoryDto } from './dtos/create-category.dto';
import { UpdateCategoryDto } from './dtos/update-category.dto';
import { CategoryResponseDto } from './dtos/category-response.dto';

@ApiTags('categories')
@Controller('categories')
export class CategoryController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: 'Create a category. Name is globally unique.' })
  @ApiCreatedResponse({ type: CategoryResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid payload or invalid name.' })
  @ApiConflictResponse({ description: 'Category name already exists, or self-parent attempted.' })
  @ApiNotFoundResponse({ description: 'Parent category does not exist.' })
  async create(@Body() dto: CreateCategoryDto): Promise<CategoryResponseDto> {
    const id = randomUUID();
    const result = await this.commandBus.execute<CreateCategoryCommand, CreateCategoryResult>(
      new CreateCategoryCommand(id, dto.name, dto.parentId ?? null),
    );
    return this.getOne(result.id);
  }

  @Patch(':id')
  @HttpCode(200)
  @ApiOperation({ summary: 'Update category name and/or parent.' })
  @ApiOkResponse({ type: CategoryResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid payload.' })
  @ApiNotFoundResponse({ description: 'Category or new parent not found.' })
  @ApiConflictResponse({ description: 'Duplicate name or self-parent attempted.' })
  async update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateCategoryDto,
    @Req() req: Request,
  ): Promise<CategoryResponseDto> {
    // Drive partial-PATCH semantics from the raw body, not from the transformed
    // DTO instance — see src/shared/infra/http/raw-body.ts for the why.
    if (wasFieldSent(req.body, 'name')) {
      await this.commandBus.execute(new RenameCategoryCommand(id, dto.name as string));
    }
    if (wasFieldSent(req.body, 'parentId')) {
      await this.commandBus.execute(new ChangeCategoryParentCommand(id, dto.parentId ?? null));
    }
    return this.getOne(id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single category by id.' })
  @ApiOkResponse({ type: CategoryResponseDto })
  @ApiNotFoundResponse({ description: 'Category not found.' })
  async getOne(@Param('id', new ParseUUIDPipe()) id: string): Promise<CategoryResponseDto> {
    const view = await this.queryBus.execute<GetCategoryByIdQuery, CategoryView>(
      new GetCategoryByIdQuery(id),
    );
    return view;
  }

  @Get()
  @ApiOperation({ summary: 'List categories (ordered by name).' })
  @ApiOkResponse({ description: 'Paged category list.' })
  async list(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ): Promise<PagedCategoryView> {
    const l = limit !== undefined ? Number(limit) : 50;
    const o = offset !== undefined ? Number(offset) : 0;
    return this.queryBus.execute(
      new ListCategoriesQuery(Number.isFinite(l) ? l : 50, Number.isFinite(o) ? o : 0),
    );
  }
}
