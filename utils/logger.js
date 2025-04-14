import { createLogger, format, transports } from "winston";

const isProduction = process.env.NODE_ENV === "production";

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
  transports: [
    new transports.Console({
      level: "info", // Only show info and above in console by default
    }),
    new transports.File({ filename: "logs/query_api.log", level: "info" }),
    // You can add file or remote transports here if needed
  ],
  exitOnError: false,
});

export default logger;
