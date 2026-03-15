import pino from 'pino';
import config from './config.js';

/**
 * Pino logger instance configured per environment.
 */
const logger = pino({
  level: config.logLevel,
  transport: config.isDevelopment()
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      }
    : undefined,
});

export default logger;
