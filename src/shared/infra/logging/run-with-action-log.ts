import { DomainError } from '../../domain/domain-error';
import { BusinessActionFields, BusinessActionLogger } from './business-action.logger';

export const runWithActionLog = async <T>(
  logger: BusinessActionLogger,
  fields: BusinessActionFields,
  fn: () => Promise<T>,
): Promise<T> => {
  try {
    const result = await fn();
    logger.success(fields);
    return result;
  } catch (err) {
    if (err instanceof DomainError) {
      logger.failure({ ...fields, reason: err.code });
    } else {
      logger.error({ ...fields, reason: 'unexpected_error', err });
    }
    throw err;
  }
};
