/**
 * Whitelist of error codes whose messages are safe to send to the client.
 * All other 4xx messages are genericized to prevent information leakage (PL03).
 */
const SAFE_ERROR_CODES = new Set([
  "NOT_FOUND",
  "SLUG_EXISTS",
  "RATE_LIMITED",
  "FORBIDDEN",
  "UNAUTHORIZED",
  "TOKEN_EXPIRED",
  "INVALID_CREDENTIALS",
  "VALIDATION_ERROR",
]);

const STATUS_MESSAGES = {
  400: "Request failed",
  401: "Unauthorized",
  403: "Forbidden",
  404: "Not found",
  409: "Conflict",
  429: "Too many requests",
};

function errorHandler(err, req, res, next) {
  const status = Number(err?.statusCode || err?.status || 500);

  let message;
  if (status >= 500) {
    message = "Internal server error";
    process.stderr.write(
      `${new Date().toISOString()} error ${req.method} ${req.originalUrl}\n` +
        `${err?.stack || err}\n`
    );
  } else if (SAFE_ERROR_CODES.has(err?.code)) {
    message = err?.message || STATUS_MESSAGES[status] || "Request failed";
  } else {
    // Log the actual error server-side but send a generic message to the client
    message = STATUS_MESSAGES[status] || "Request failed";
    process.stderr.write(
      `${new Date().toISOString()} 4xx ${req.method} ${req.originalUrl} code=${err?.code} message="${err?.message}"\n`
    );
  }

  res.status(status).json({
    error: {
      code: err?.code || "ERROR",
      message,
    },
  });
}

module.exports = { errorHandler };

