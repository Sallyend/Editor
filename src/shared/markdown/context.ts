import type { TagRecord } from '../tag-record.js';
import type { RawTag } from '../raw-tag.js';
import type { NamespaceDatabaseView, DatabaseView } from '../interfaces/database.js';
import type { Database } from '../database.js';

export abstract class Logger {
    info(context: Context, message: string): void {
        this.log('info', context, message);
    }
    warn(context: Context, message: string): void {
        this.log('warn', context, message);
    }
    error(context: Context, message: string): void {
        this.log('error', context, message);
    }
    protected abstract log(logger: keyof Logger, context: Context, message: string): void;

    static buildMessage(logger: keyof Logger, context: Context, message: string): string {
        const l = context.line ? `L${context.line}:` : '';
        const r = context.raw ?? '<unknown raw>';
        return `${context.namespace.name}:${l}${r}: ${message}`;
    }

    static default: Logger = new (class DefaultLogger extends Logger {
        protected log(logger: keyof Logger, context: Context, message: string): void {
            console[logger](Logger.buildMessage(logger, context, message));
        }
    })();
}

export class Context {
    static readonly fake: Context = new Context(undefined as unknown as TagRecord);
    constructor(tag: TagRecord, raw?: RawTag, logger?: Logger);
    constructor(namespace: NamespaceDatabaseView, raw?: RawTag, logger?: Logger);
    constructor(root: TagRecord | NamespaceDatabaseView, raw?: RawTag, logger?: Logger) {
        if (root == null) return;
        this.raw = raw;
        const nsv = root as NamespaceDatabaseView;
        if (typeof nsv.database == 'object' && typeof nsv.name == 'string' && typeof nsv.size == 'number') {
            this.namespace = nsv;
        } else {
            const tag = root as TagRecord;
            this.namespace = tag.namespace;
            this.tag = tag;
        }
        this.database = this.namespace.database;
        this.logger = logger;
    }
    database!: DatabaseView;
    namespace!: NamespaceDatabaseView;
    raw?: RawTag;
    tag?: TagRecord;
    line?: number;
    logger?: Logger;
    private get _logger(): Logger {
        return this.logger ?? (this.database as Database)?.logger ?? Logger.default;
    }
    info(message: string): void {
        this._logger.info(this, message);
    }
    warn(message: string): void {
        this._logger.warn(this, message);
    }
    error(message: string): void {
        this._logger.error(this, message);
    }
}
