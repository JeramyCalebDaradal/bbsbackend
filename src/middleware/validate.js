/**
 * Generic schema validation middleware.
 * Validates req.body against the provided Zod schema.
 * Returns a generic "Validation failed" error — never leaks schema internals (PL03).
 */
function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const err = new Error("Validation failed");
      err.statusCode = 400;
      err.code = "VALIDATION_ERROR";
      return next(err);
    }
    // Replace with sanitized/coerced data from Zod
    req.body = result.data;
    next();
  };
}

module.exports = { validate };