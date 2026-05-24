import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Req } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { Request } from 'express';
import { CreatePingCommand } from '../../application/commands/create-ping.command';
import { CreatePingResult } from '../../application/commands/create-ping.handler';
import { GetPingQuery } from '../../application/queries/get-ping.query';
import { PingState } from '../../application/queries/get-ping.handler';

interface CreatePingBody {
  payload?: string;
}

@Controller('skeleton/ping')
export class SkeletonController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Post()
  @HttpCode(201)
  async create(@Body() body: CreatePingBody, @Req() req: Request): Promise<CreatePingResult> {
    const correlationId = (req as Request & { id: string }).id;
    const payload = body?.payload?.trim() || 'ping';
    return this.commandBus.execute(new CreatePingCommand(payload, correlationId));
  }

  @Get(':id')
  async get(@Param('id', new ParseUUIDPipe()) id: string): Promise<PingState> {
    return this.queryBus.execute(new GetPingQuery(id));
  }
}
