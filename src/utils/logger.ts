import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.colorize(),
    winston.format.printf(({ level, message }) => {
      return `[+] ${level}: ${message}`;
    }),
  ),
  transports: [new winston.transports.Console()],
});

export { logger };
