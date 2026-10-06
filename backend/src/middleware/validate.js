import { ZodError } from 'zod';
import { validationError } from '../utils/AppError.js';

export function zodDetails(error) {
  return error.issues.map((issue) => ({ field: issue.path.join('.'), message: issue.message }));
}

/*
  validate(schema) - parses req.body with a zod schema and replaces it
  with the parsed result, so a handler only ever sees fields the schema
  defines, with the types it defines. Unknown fields are dropped: a
  client cannot set `role`, `status`, an owner id or any other field by
  adding it to the request.
*/
export function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body ?? {});
    if (!result.success) return next(validationError(zodDetails(result.error)));
    req.body = result.data;
    return next();
  };
}

export function parseOrThrow(schema, value) {
  try {
    return schema.parse(value);
  } catch (error) {
    if (error instanceof ZodError) throw validationError(zodDetails(error));
    throw error;
  }
}
