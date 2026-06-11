function errorHandler(err, req, res, next) {
  const status = Number(err?.statusCode || err?.status || 500);
  const message =
    status >= 500
      ? "Internal server error"
      : err?.message || "Request failed";

  if (status >= 500) {
    process.stderr.write(
      `${new Date().toISOString()} error ${req.method} ${req.originalUrl}\n` +
        `${err?.stack || err}\n`
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

