import { HttpStatus } from '@nestjs/common';

export const domainErrorToHttpStatus = (code: string): HttpStatus => {
  if (code.endsWith('not_found')) {
    return HttpStatus.NOT_FOUND;
  }
  return HttpStatus.CONFLICT;
};
