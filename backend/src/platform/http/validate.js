const { ValidationError } = require('../errors');

const PARTS = ['params', 'query', 'body'];

/**
 * Validate req.params, req.query and req.body against zod schemas before the
 * handler runs. Failures become a 400 VALIDATION_FAILED with one entry per
 * problem (path prefixed by the part, e.g. "body.vehicleId"). On success the
 * parsed values replace the originals.
 *
 * @param {{ params?: import('zod').ZodType, query?: import('zod').ZodType, body?: import('zod').ZodType }} schemas
 * @returns {import('express').RequestHandler}
 */
function validate(schemas) {
  return (req, res, next) => {
    const details = [];
    const parsed = {};
    for (const part of PARTS) {
      if (!schemas[part]) continue;
      const result = schemas[part].safeParse(req[part] ?? {});
      if (result.success) parsed[part] = result.data;
      else {
        result.error.issues.forEach((issue) => {
          details.push({ path: [part, ...issue.path].join('.'), message: issue.message });
        });
      }
    }
    if (details.length) {
      const [first] = details;
      return next(new ValidationError(`${first.path.replace(/^\w+\./, '')}: ${first.message}`, { details }));
    }
    Object.assign(req, parsed);
    return next();
  };
}

module.exports = { validate };
