export class CreatePingCommand {
  constructor(
    public readonly payload: string,
    public readonly correlationId: string,
  ) {}
}
