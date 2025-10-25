// src/services/WhatsAppService.ts
import { Client, LocalAuth, MessageMedia } from "whatsapp-web.js";
import * as fs from "fs";
import * as path from "path";
import { SessionModel } from "../models/Session";

interface SendMessageInput {
  phone: string;
  message: string;
}

class WhatsAppService {
    private static instances: Map<string, WhatsAppService> = new Map();

    private client: Client;
    private sessionId: string;
    private status: string = "INIT";

    private constructor(sessionId: string) {
        this.sessionId = sessionId;
        this.client = new Client({
            authStrategy: new LocalAuth({ clientId: sessionId }),
            puppeteer: { headless: true },
        });

        // Inicializar en DB
        SessionModel.findOneAndUpdate(
            { id: sessionId },
            { status: "INIT", lastUpdated: new Date() },
            { upsert: true, setDefaultsOnInsert: true }
        ).exec();

        this.client.initialize();

        this.client.on("ready", () => {
            this.status = "CONNECTED";
            SessionModel.updateOne({ id: sessionId }, { status: "CONNECTED", lastUpdated: new Date() }).exec();
            console.log(`✅ Sesión ${sessionId} conectada`);
        });

        this.client.on("auth_failure", () => {
            this.status = "AUTH_FAILED";
            SessionModel.updateOne({ id: sessionId }, { status: "AUTH_FAILED", lastUpdated: new Date() }).exec();
        });

        this.client.on("qr", (qr) => {
            this.status = "QR_NEEDED";
            SessionModel.updateOne(
                { id: sessionId },
                { qr, status: "QR_NEEDED", lastUpdated: new Date() }
            ).exec();
        });

        this.client.on("disconnected", () => {
            this.status = "DISCONNECTED";
            SessionModel.updateOne({ id: sessionId }, { status: "DISCONNECTED", lastUpdated: new Date() }).exec();
        });
    }

    public static getInstance(sessionId: string): WhatsAppService {
        if (!WhatsAppService.instances.has(sessionId)) {
        WhatsAppService.instances.set(sessionId, new WhatsAppService(sessionId));
        }
        return WhatsAppService.instances.get(sessionId)!;
    }

    public async sendMessage({ phone, message }: SendMessageInput) {
        if (this.status !== "CONNECTED") {
        throw new Error("SESSION_NOT_READY");
        }
        const response = await this.client.sendMessage(`${phone}@c.us`, message);
        return { id: response.id.id };
    }

    public getStatus(): string {
        return this.status;
    }

    public static async closeSession(sessionId: string): Promise<void> {
        const instance = WhatsAppService.instances.get(sessionId);
        if (instance) {
            try {
            await instance.client.destroy(); // Cierra WhatsApp Web
            } catch (err) {
            console.warn(`Error al destruir cliente ${sessionId}:`, err);
            }
            WhatsAppService.instances.delete(sessionId);
        }

        // Actualizar estado en DB
        await SessionModel.updateOne(
            { id: sessionId },
            { status: "DISCONNECTED", lastUpdated: new Date() }
        );
    }

    public async sendMediaMessage({
        phone,
        caption = "",
        url,
        filePath,
        base64,      // ✅ Nuevo parámetro
        mimeType = "image/jpeg", // requerido si usas base64
        filename = "image.jpg"
    }: {
        phone: string;
        caption?: string;
        url?: string;
        filePath?: string;
        base64?: string;         // ✅ base64 string
        mimeType?: string;       // ej: "image/png", "image/jpeg"
        filename?: string;
    }) {
        if (this.status !== "CONNECTED") {
            throw new Error("SESSION_NOT_READY");
        }

        let media: MessageMedia;

        if (base64) {
            // ✅ Usar base64 directamente
            media = new MessageMedia(mimeType, base64, filename);
        } else if (url) {
            media = await MessageMedia.fromUrl(url);
        } else if (filePath) {
            const detectedMimeType = this.getMimeType(filePath);
            const data = fs.readFileSync(filePath).toString("base64");
            const name = path.basename(filePath);
            media = new MessageMedia(detectedMimeType, data, name);
        } else {
            throw new Error("Se requiere 'url', 'filePath' o 'base64'");
        }

        const chatId = `${phone}@c.us`;
        const response = await this.client.sendMessage(chatId, media, { caption });
        return { id: response.id.id };
    }

    private getMimeType(filename: string): string {
        const ext = path.extname(filename).toLowerCase();
        const mimeTypes: Record<string, string> = {
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".png": "image/png",
            ".gif": "image/gif",
            ".pdf": "application/pdf",
            ".mp4": "video/mp4",
            ".mp3": "audio/mpeg",
        };
        return mimeTypes[ext] || "application/octet-stream";
    }
}

export default WhatsAppService;