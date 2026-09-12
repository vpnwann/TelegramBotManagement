export function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    error: `Route not found: ${req.method} ${req.originalUrl}`,
  });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  console.error("[error]", err);

  const status = err.statusCode || 500;
  const message = err.telegram?.description || err.message || "Internal server error";

  res.status(status).json({
    success: false,
    error: message,
  });
}

export default { notFoundHandler, errorHandler };
