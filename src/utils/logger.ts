import path from "path";
import dailyRoateFile from "winston-daily-rotate-file"
import { createLogger, format, transports } from "winston";

export const logger = createLogger({
    format: format.combine(
        format.timestamp({ format: "YYYY-MM-DD HH:mm:ss.SSS" }),
        format.printf(
            (info) =>
            `[${info.level}] - ${info.message} ${info.timestamp}`
        )
    ),
    transports: [new transports.Console(), new dailyRoateFile({
        filename: path.join(process.cwd(), `logs/%DATE%.log`),
        datePattern: 'YYYY-MM-DD',
    })]
});

