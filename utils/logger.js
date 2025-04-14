import { createLogger, format, transports } from "winston";

const isProduction = process.env.NODE_ENV === "production";

const loggerTransports = [
  new transports.Console({
    level: "info", // Only show info and above in console by default
  }),
];

// Only add file transport if not running on Vercel
if (!process.env.VERCEL) {
  loggerTransports.push(
    new transports.File({ filename: "logs/query_api.log", level: "info" })
  );
}

const logger = createLogger({
  level: process.env.LOG_LEVEL || (isProduction ? "info" : "info"),
  format: format.combine(
    format.timestamp(),
    format.errors({ stack: true }),
    format.splat(),
    isProduction
      ? format.json()
      : format.combine(format.colorize(), format.simple())
  ),
  transports: loggerTransports,
  exitOnError: false,
});

export default logger;
