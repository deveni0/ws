import { AnyMessageContent, WASocket } from '@whiskeysockets/baileys';
import { z } from 'zod';

declare const OwnerSchema: z.ZodObject<{
    lid: z.ZodString;
    jid: z.ZodString;
    name: z.ZodOptional<z.ZodString>;
}, z.core.$strict>;
type Owner = z.infer<typeof OwnerSchema>;
declare const BotConfigSchema: z.ZodObject<{
    phoneNumber: z.ZodString;
    namebot: z.ZodOptional<z.ZodString>;
    fromMe: z.ZodDefault<z.ZodNullable<z.ZodBoolean>>;
    sessionPath: z.ZodDefault<z.ZodString>;
    autoReconnect: z.ZodDefault<z.ZodBoolean>;
    reconnectDelay: z.ZodDefault<z.ZodNumber>;
    maxReconnectAttempts: z.ZodDefault<z.ZodNumber>;
    showLogs: z.ZodDefault<z.ZodBoolean>;
    printQR: z.ZodDefault<z.ZodBoolean>;
    markOnline: z.ZodDefault<z.ZodBoolean>;
    browser: z.ZodDefault<z.ZodString>;
    syncHistory: z.ZodDefault<z.ZodBoolean>;
    autoRead: z.ZodDefault<z.ZodBoolean>;
    linkPreview: z.ZodDefault<z.ZodBoolean>;
    owners: z.ZodDefault<z.ZodArray<z.ZodObject<{
        lid: z.ZodString;
        jid: z.ZodString;
        name: z.ZodOptional<z.ZodString>;
    }, z.core.$strict>>>;
    commandsPath: z.ZodDefault<z.ZodString>;
    prefix: z.ZodDefault<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
    onConnected: z.ZodOptional<z.ZodFunction<z.core.$ZodFunctionArgs, z.core.$ZodFunctionOut>>;
    onDisconnected: z.ZodOptional<z.ZodFunction<z.core.$ZodFunctionArgs, z.core.$ZodFunctionOut>>;
    onError: z.ZodOptional<z.ZodCustom<(error: Error) => void, (error: Error) => void>>;
}, z.core.$strict>;
type BotConfig = z.infer<typeof BotConfigSchema>;
declare const MessageSchema: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    body: z.ZodString;
    text: z.ZodString;
    from: z.ZodString;
    name: z.ZodOptional<z.ZodString>;
    pushName: z.ZodOptional<z.ZodString>;
    timestamp: z.ZodDate;
    isGroup: z.ZodBoolean;
    isOwner: z.ZodBoolean;
    isAdmin: z.ZodBoolean;
    isBotAdmin: z.ZodBoolean;
    fromMe: z.ZodBoolean;
    key: z.ZodOptional<z.ZodAny>;
    message: z.ZodOptional<z.ZodAny>;
    raw: z.ZodAny;
    args: z.ZodOptional<z.ZodArray<z.ZodString>>;
    command: z.ZodOptional<z.ZodString>;
    prefix: z.ZodOptional<z.ZodString>;
    sender: z.ZodString;
    chat: z.ZodString;
    reply: z.ZodCustom<(text: string, options?: Partial<AnyMessageContent>) => Promise<any>, (text: string, options?: Partial<AnyMessageContent>) => Promise<any>>;
    react: z.ZodCustom<(emoji: string) => Promise<any>, (emoji: string) => Promise<any>>;
    lid2jid: z.ZodOptional<z.ZodCustom<(i: string, id: string) => Promise<any>, (i: string, id: string) => Promise<any>>>;
    jid2lid: z.ZodOptional<z.ZodCustom<(i: string, id: string) => Promise<any>, (i: string, id: string) => Promise<any>>>;
    delete: z.ZodCustom<() => Promise<any>, () => Promise<any>>;
    download: z.ZodCustom<() => Promise<Buffer | null>, () => Promise<Buffer | null>>;
    forward: z.ZodCustom<(jid: string, options?: Partial<AnyMessageContent>) => Promise<any>, (jid: string, options?: Partial<AnyMessageContent>) => Promise<any>>;
    typing: z.ZodCustom<(duration?: number) => Promise<void>, (duration?: number) => Promise<void>>;
    recording: z.ZodCustom<(duration?: number) => Promise<void>, (duration?: number) => Promise<void>>;
}, z.core.$strict>;
type Message = z.infer<typeof MessageSchema>;
declare const GroupEventSchema: z.ZodObject<{
    id: z.ZodString;
    chat: z.ZodString;
    userUrl: z.ZodOptional<z.ZodString>;
    participants: z.ZodArray<z.ZodString>;
    action: z.ZodEnum<{
        add: "add";
        remove: "remove";
        promote: "promote";
        demote: "demote";
    }>;
    author: z.ZodOptional<z.ZodString>;
    authorUrl: z.ZodOptional<z.ZodString>;
    timestamp: z.ZodDate;
}, z.core.$strict>;
type GroupEvent = z.infer<typeof GroupEventSchema>;
declare const CommandContextSchema: z.ZodObject<{
    conn: z.ZodAny;
    text: z.ZodString;
    args: z.ZodArray<z.ZodString>;
    command: z.ZodString;
    prefix: z.ZodString;
    bot: z.ZodAny;
}, z.core.$strict>;
type CommandContext = z.infer<typeof CommandContextSchema>;
type Handler$1 = (message: Message, context: CommandContext, bot: any) => Promise<any>;
declare const CommandOptionsSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    command: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
    aliases: z.ZodOptional<z.ZodArray<z.ZodString>>;
    description: z.ZodOptional<z.ZodString>;
    category: z.ZodOptional<z.ZodString>;
    usage: z.ZodOptional<z.ZodString>;
    cooldown: z.ZodOptional<z.ZodNumber>;
    ownerOnly: z.ZodOptional<z.ZodBoolean>;
    groupOnly: z.ZodOptional<z.ZodBoolean>;
    privateOnly: z.ZodOptional<z.ZodBoolean>;
    botAdmin: z.ZodOptional<z.ZodBoolean>;
    disabled: z.ZodOptional<z.ZodBoolean>;
    usePrefix: z.ZodOptional<z.ZodBoolean>;
    before: z.ZodOptional<z.ZodCustom<Handler$1, Handler$1>>;
    after: z.ZodOptional<z.ZodCustom<Handler$1, Handler$1>>;
    execute: z.ZodOptional<z.ZodCustom<(message: Message, context: CommandContext, bot: any) => Promise<any>, (message: Message, context: CommandContext, bot: any) => Promise<any>>>;
}, z.core.$catchall<z.ZodAny>>;
type CommandOptions = z.infer<typeof CommandOptionsSchema>;
interface MessageHandler {
    (msg: Message): Promise<string | null | void | any>;
}
interface AccessHandler {
    (msg: Message, checkType: string, ...args: any[]): any;
}
interface GroupEventHandler {
    (ctx: any, event: GroupEvent, eventType: string): any;
}

type Handler = (msg: Message, ctx: any, bot?: any) => Promise<boolean | void>;
type Middleware = (msg: Message, next: () => Promise<void>) => Promise<void>;
declare class CommandSystem {
    private registry;
    private middleware;
    private executor;
    private loader;
    private watcher;
    private beforeHandlers;
    private afterHandlers;
    private bot;
    constructor(bot?: any);
    setBot(bot: any): void;
    register(command: CommandOptions | Function): void;
    unregister(commandName: string): boolean;
    before(handler: Handler): void;
    after(handler: Handler): void;
    use(middleware: Middleware): void;
    findCommand(name: string): CommandOptions | undefined;
    getCommandsByCategory(category?: string): CommandOptions[];
    getAllCategories(): string[];
    getAll(): CommandOptions[];
    processMessage(msg: Message, ctx: any, config: any): Promise<boolean>;
    private runBeforeHandlers;
    private runAfterHandlers;
    private getCommandNames;
    loadFile(filePath: string): Promise<void>;
    loadDirectory(commandsPath: string): Promise<void>;
    startWatching(commandsPath: string): void;
    stopWatcher(): void;
    private handleFileChange;
    private reloadFile;
    private unloadFile;
    private resolvePath;
    clearCooldowns(userId?: string): void;
    getStats(): {
        middlewares: number;
        beforeHandlers: number;
        afterHandlers: number;
        total: number;
        categories: number;
        files: number;
    };
    abortUserCommands(userId: string): void;
    destroy(): void;
}

declare class WhatsAppBot {
    sock: WASocket | null;
    private sockBaileys;
    scrapy: {
        test: (url: string) => Promise<any>;
    };
    config: BotConfig;
    commandSystem: CommandSystem;
    private handlers;
    private userAccessHandler;
    private userGroupEventHandler;
    private reconnectTimeout;
    private reconnectAttempts;
    private isRunning;
    private maxReconnectAttempts;
    private credsSaver;
    private eventHandlers;
    constructor(config: BotConfig);
    private setupExit;
    onCommandAccess(handler: AccessHandler): void;
    onGroupEvent(handler: GroupEventHandler): void;
    onMessage(handler: MessageHandler): void;
    onBeforeCommand(handler: (msg: Message) => Promise<boolean | void>): void;
    onAfterCommand(handler: (msg: Message, data: any) => Promise<void>): void;
    cmdControl(msg: Message, checkType: string, ...args: any[]): Promise<void>;
    private groupControl;
    start(force?: boolean): Promise<void>;
    private setupEvents;
    private scheduleReconnect;
    restart(force?: boolean): Promise<void>;
    stop(): Promise<void>;
    cleanup: () => Promise<void>;
    registerCommand(command: any): void;
    unregisterCommand(commandName: string): boolean;
    getCommand(commandName: string): any;
    getAllCommands(): any[];
    useMiddleware(middleware: any): void;
    clearCooldowns(): void;
    getOwners(): Owner[];
    isConnected(): boolean;
}
declare const createWhatsAppBot: (config: BotConfig) => WhatsAppBot;

export { WhatsAppBot, createWhatsAppBot };
