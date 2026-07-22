/**
 * Generic schema validation middleware.
 * Validates req.body against the provided Zod schema.
 * Returns a generic "Validation failed" error — never leaks schema internals (PL03).
 */
function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      // Log the actual Zod issues so we can debug (never leaked to the client)
      const issues = result.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message} (received: ${typeof i.input !== "undefined" ? JSON.stringify(i.input).slice(0, 200) : "undefined"})`)
        .join(" | ");
      process.stderr.write(
        `${new Date().toISOString()} VALIDATION_ERROR ${req.method} ${req.originalUrl} issues="${issues}"\n`
      );

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