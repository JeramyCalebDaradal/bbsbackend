const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");

const { notFound } = require("./middleware/notFound");
const { errorHandler } = require("./middleware/errorHandler");
const { apiRouter } = require("./routes");

const PRODUCTION_CORS_ORIGINS = ["https://bbsdev.qzz.io"];
const DEVELOPMENT_CORS_ORIGINS = [
  "https://bbsdev.qzz.io",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];
const ALLOWED_CORS_METHODS = ["GET", "POST", "PUT", "DELETE", "OPTIONS"];
const ALLOWED_CORS_HEADERS = ["Authorization", "Content-Type"];
const ALLOWED_CORS_HEADERS_LOWER = new Set(ALLOWED_CORS_HEADERS.map((header) => header.toLowerCase()));

function validateCorsOrigin(origin) {
  if (origin === "null" || origin.includes("*")) return false;
  try {
    const parsed = new URL(origin);
    return (
      (parsed.protocol === "https:" || parsed.protocol === "http:") &&
      parsed.origin === origin &&
      parsed.pathname === "/" &&
      !parsed.search &&
      !parsed.hash
    );
  } catch {
    return false;
  }
}

function getAllowedCorsOrigins() {
  const configured = String(process.env.CORS_ORIGIN || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  const defaults = process.env.NODE_ENV === "production" ? PRODUCTION_CORS_ORIGINS : DEVELOPMENT_CORS_ORIGINS;
  const origins = configured.length ? configured : defaults;
  for (const origin of origins) {
    if (!validateCorsOrigin(origin)) {
      throw new Error(`Invalid CORS origin: ${origin}`);
    }
  }
  return new Set(origins);
}

function createCorsOptions() {
  const allowedOrigins = getAllowedCorsOrigins();
  return {
    origin(origin, callback) {
      if (!origin) return callback(null, false);
      if (allowedOrigins.has(origin)) return callback(null, true);
      return callback(null, false);
    },
    credentials: false,
    methods: ALLOWED_CORS_METHODS,
    allowedHeaders: ALLOWED_CORS_HEADERS,
    optionsSuccessStatus: 204,
    maxAge: 600,
  };
}

function createApp() {
  const app = express();
  const allowedOrigins = getAllowedCorsOrigins();

  app.disable("x-powered-by");

  app.use(helmet());
  app.use((req, res, next) => {
    const origin = req.get("Origin");
    if (!origin) return next();
    if (!allowedOrigins.has(origin)) {
      return res.status(403).json({ error: { code: "CORS_ORIGIN_DENIED", message: "Origin not allowed" } });
    }
    if (req.method === "OPTIONS") {
      const requestedMethod = String(req.get("Access-Control-Request-Method") || "").toUpperCase();
      if (!ALLOWED_CORS_METHODS.includes(requestedMethod)) {
        return res.status(403).json({ error: { code: "CORS_METHOD_DENIED", message: "Method not allowed" } });
      }
      const requestedHeaders = String(req.get("Access-Control-Request-Headers") || "")
        .split(",")
        .map((header) => header.trim().toLowerCase())
        .filter(Boolean);
      if (requestedHeaders.some((header) => !ALLOWED_CORS_HEADERS_LOWER.has(header))) {
        return res.status(403).json({ error: { code: "CORS_HEADERS_DENIED", message: "Headers not allowed" } });
      }
    }
    return next();
  });
  app.use(cors(createCorsOptions()));
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());
  app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

  app.get("/health", (req, res) => {
    res.status(200).json({ ok: true });
  });

  app.use("/api/v1", apiRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
