'use strict';

/**
 * Zod validation middleware.
 *
 * Every route validates body, query and params. On success the parsed values
 * replace the raw values, so controllers never need to coerce strings again.
 *
 * Debugging tip: a 400 with error=VALIDATION_FAILED lists each failing path.
 * `path` uses dots (for example "body.email") so it maps directly to the request.
 */

function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse({
      body: req.body,
      query: req.query,
      params: req.params,
    });

    if (!result.success) {
      return res.status(400).json({
        error: 'VALIDATION_FAILED',
        details: result.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
          code: issue.code,
        })),
      });
    }

    req.body = result.data.body;

    // Express 4/5 expose req.query as a getter without a setter. A plain
    // `req.query = ...` is silently ignored in non-strict mode, so parsed
    // defaults would never reach controllers. defineProperty replaces the
    // getter for this request only.
    Object.defineProperty(req, 'query', {
      value: result.data.query,
      writable: true,
      configurable: true,
      enumerable: true,
    });

    req.params = result.data.params;
    return next();
  };
}

module.exports = validate;
