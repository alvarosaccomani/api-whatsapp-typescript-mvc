// src/services/WhatsAppService.ts
import { Client, LocalAuth, MessageMedia } from "whatsapp-web.js";
import * as fs from "fs";
import * as path from "path";
import { Session } from "../models/Session";

interface SendMessageInput {
    phone: string;
    message: string;
}

interface SendMediaMessageInput {
    phone: string;
    caption?: string;
    url?: string;
    filePath?: string;
    base64?: string;
    mimeType?: string;
    filename?: string;
}

class WhatsAppService {
    private static instances: Map<string, WhatsAppService> = new Map();

    private client: Client;
    private sessionId: string;
    private status: string = "INIT";

    private constructor(sessionId: string) {
        this.sessionId = sessionId;

        // Directorio temporal único para Chromium
        const chromiumProfileDir = `/tmp/chromium_profile_${sessionId}_${Date.now()}`;
        if (!fs.existsSync(chromiumProfileDir)) {
            fs.mkdirSync(chromiumProfileDir, { recursive: true });
        }

        // Directorio persistente para las sesiones (montado como volumen)
        const authPath = path.join(__dirname, "../../.wwebjs_auth");

        this.client = new Client({
            authStrategy: new LocalAuth({
                clientId: sessionId,
                dataPath: authPath,
            }),
            puppeteer: {
                headless: true,
                executablePath:
                    process.env.PUPPETEER_EXECUTABLE_PATH || "/usr/bin/chromium",
                args: [
                    "--no-sandbox",
                    "--disable-setuid-sandbox",
                    "--disable-dev-shm-usage",
                    "--disable-extensions",
                    "--disable-gpu",
                    "--single-process",
                    "--no-zygote",
                    "--no-first-run",
                    "--disable-background-timer-throttling",
                    "--disable-renderer-backgrounding",
                    "--disable-software-rasterizer",
                    "--disable-infobars",
                    "--disable-features=VizDisplayCompositor",
                    `--user-data-dir=${chromiumProfileDir}` // 👈 Perfil único
                ],
            },
            takeoverTimeoutMs: 120000,
        });

        // Reinicio automático cada 24 horas (opcional)
        const maintenanceTimeout = setTimeout(() => {
            console.log(`🔄 Reiniciando sesión ${sessionId} por mantenimiento`);
            WhatsAppService.closeSession(sessionId);
        }, 24 * 60 * 60 * 1000);

        this.client.on("disconnected", () => clearTimeout(maintenanceTimeout));

        // Guardar estado inicial en la base
        this.upsertSession("INIT");

        // Inicializar cliente
        this.client.initialize();

        this.client.on("ready", () => {
            this.status = "CONNECTED";
            this.upsertSession("CONNECTED");
            console.log(`✅ Sesión ${sessionId} conectada`);
        });

        this.client.on("auth_failure", () => {
            this.status = "AUTH_FAILED";
            this.upsertSession("AUTH_FAILED");
        });

        this.client.on("qr", (qr) => {
            this.status = "QR_NEEDED";
            this.upsertSession("QR_NEEDED", qr);
        });

        this.client.on("disconnected", () => {
            this.status = "DISCONNECTED";
            this.upsertSession("DISCONNECTED");
        });
    }

    private async upsertSession(
        status: "INIT" | "QR_NEEDED" | "CONNECTED" | "AUTH_FAILED" | "DISCONNECTED",
        qr?: string
    ) {
        await Session.upsert({
            ses_id: this.sessionId,
            ses_qr: qr,
            ses_status: status,
            ses_lastupdated: new Date(),
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

    public async sendMediaMessage({
        phone,
        caption = "",
        url,
        filePath,
        base64,
        mimeType = "image/jpeg",
        filename = "image.jpg",
    }: SendMediaMessageInput) {
        if (this.status !== "CONNECTED") {
            throw new Error("SESSION_NOT_READY");
        }

        let media: MessageMedia;

        if (base64) {
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

    public static async closeSession(sessionId: string): Promise<void> {
        const instance = WhatsAppService.instances.get(sessionId);
        if (instance) {
            try {
                await instance.client.destroy();
            } catch (err) {
                console.warn(`Error al destruir cliente ${sessionId}:`, err);
            }
            WhatsAppService.instances.delete(sessionId);
        }

        await Session.update(
            { ses_status: "DISCONNECTED", ses_lastupdated: new Date() },
            { where: { ses_id: sessionId } }
        );
    }
}

export default WhatsAppService;