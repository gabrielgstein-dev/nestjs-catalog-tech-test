export interface ErrorResponse {
  statusCode: number;
  error: string;
  message: string | string[];
  code?: string;
  correlationId?: string;
  timestamp: string;
  path: string;
}
