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

        // Directorio persistente para las sesiones (dentro del contenedor)
        const authPath = path.join(__dirname, "../../.wwebjs_auth");

        // Configuración del cliente
        this.client = new Client({
            authStrategy: new LocalAuth({
                clientId: sessionId,
                dataPath: authPath,
            }),
            puppeteer: {
                headless: true,
                executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || "/usr/bin/chromium",
                args: [
                    "--no-sandbox",
                    "--disable-setuid-sandbox",
                    "--disable-dev-shm-usage",
                    "--disable-gpu",
                    "--disable-extensions",
                    "--disable-background-timer-throttling",
                    "--disable-renderer-backgrounding",
                    "--disable-software-rasterizer",
                    "--mute-audio",
                    "--hide-scrollbars",
                    "--no-first-run",
                    "--no-zygote",
                    "--disable-infobars",
                    "--disable-notifications",
                    "--disable-features=site-per-process,TranslateUI,BlinkGenPropertyTrees",
                    `--user-data-dir=${chromiumProfileDir}`,
                ],
                timeout: 60000,
            },
            takeoverTimeoutMs: 120000,
        });

        // Estado inicial
        this.upsertSession("INIT");

        // Inicializar cliente con control de errores
        try {
            console.log(`🚀 Inicializando sesión WhatsApp (${sessionId})...`);
            this.client.initialize();
        } catch (error) {
            console.error(`❌ Error al inicializar WhatsApp (${sessionId}):`, error);
            setTimeout(() => {
                console.log(`♻️ Reintentando inicialización de sesión ${sessionId} en 10 segundos...`);
                WhatsAppService.closeSession(sessionId);
            }, 10000);
        }

        // Reinicio automático cada 24h
        const maintenanceTimeout = setTimeout(() => {
            console.log(`🔄 Reiniciando sesión ${sessionId} por mantenimiento`);
            WhatsAppService.closeSession(sessionId);
        }, 24 * 60 * 60 * 1000);

        this.client.on("disconnected", () => clearTimeout(maintenanceTimeout));

        // Eventos del cliente
        this.client.on("ready", () => {
            this.status = "CONNECTED";
            this.upsertSession("CONNECTED");
            console.log(`✅ Sesión ${sessionId} conectada`);
        });

        this.client.on("auth_failure", () => {
            this.status = "AUTH_FAILED";
            this.upsertSession("AUTH_FAILED");
            console.warn(`⚠️ Fallo de autenticación en sesión ${sessionId}`);
        });

        this.client.on("qr", (qr) => {
            this.status = "QR_NEEDED";
            this.upsertSession("QR_NEEDED", qr);
            console.log(`📱 Escanea el QR para sesión ${sessionId}`);
        });

        this.client.on("disconnected", () => {
            this.status = "DISCONNECTED";
            this.upsertSession("DISCONNECTED");
            console.log(`🔌 Sesión ${sessionId} desconectada`);
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
        if (this.status !== "CONNECTED") throw new Error("SESSION_NOT_READY");
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
        if (this.status !== "CONNECTED") throw new Error("SESSION_NOT_READY");

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