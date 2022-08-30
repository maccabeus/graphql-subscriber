
export interface LogData {
    /** generated fields */
    timestamp: string,
    version: string,
    environment: string
    host: string
    /** user provided fields */
    severity: LogSeverity
    type: LogTypes
    message: string | null,
    data?: any | null
}

export enum LogSeverity {
    EMERGENCY = 0,
    ALERT = 1,
    CRITICAL = 2,
    ERROR = 3,
    WARNING = 4,
    NOTICE = 5,
    INFO = 6,
    DEBUG = 7,
    TRACE = 8
}
export enum LogTypes {
    SYSTEM = "System",
    THREAT = "Threat",
    TRAFFIC = "Traffic",
    CONFIG = "Config",
};

export interface ILogger {
    (severity: LogSeverity, type: LogTypes, message: string, data: any): any
}