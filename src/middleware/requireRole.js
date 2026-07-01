/**
 * Role-based authorization middleware.
 * Requires req.userRole to be set by requireAuth first.
 */
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.userRole) {
      const err = new Error("Forbidden");
      err.statusCode = 403;
      err.code = "FORBIDDEN";
      return next(err);
    }
    if (!allowedRoles.includes(req.userRole)) {
      const err = new Error("Forbidden");
      err.statusCode = 403;
      err.code = "FORBIDDEN";
      return next(err);
    }
    next();
  };
}

module.exports = { requireRole };