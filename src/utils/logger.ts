import winston from 'winston'
import { config } from '../config/config'

const { combine, timestamp, errors, json, colorize, printf } = winston.format

// Custom format for console output
const consoleFormat = printf(({ level, message, timestamp, stack }) => {
  return `${timestamp} [${level}]: ${stack || message}`
})

export const logger = winston.createLogger({
  level: config.log.level,
  format: combine(
    timestamp(),
    errors({ stack: true }),
    json(),
  ),
  defaultMeta: { service: 'commerce-base-plugin' },
  transports: [
    // Write all logs to console in development
    new winston.transports.Console({
      format: combine(
        colorize(),
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        consoleFormat,
      ),
    }),
  ],
})

// Add file transport in production
if (config.nodeEnv === 'production') {
  logger.add(
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
  )

  logger.add(
    new winston.transports.File({
      filename: config.log.file,
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
  )
}

export default logger
