
import { ILogger, LogSeverity, LogTypes } from "./logger.types";

export const log: ILogger = (severity, type, message, data = null): any => {
    console.log(message);
}
export default log;