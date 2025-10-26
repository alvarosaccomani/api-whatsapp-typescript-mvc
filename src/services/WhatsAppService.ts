import { Client, LocalAuth, MessageMedia } from "whatsapp-web.js";
import * as fs from "fs";
import { existsSync } from "fs";
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

        // ✅ Carpeta temporal única para el perfil de Chromium
        const chromiumProfileDir = `/tmp/chromium_profile_${sessionId}_${Date.now()}`;
        fs.mkdirSync(chromiumProfileDir, { recursive: true });

        // ✅ Carpeta persistente de autenticación (dentro del contenedor)
        const authPath = "/app/.wwebjs_auth";

        // ✅ Configuración del cliente optimizada para Docker
        this.client = new Client({
            authStrategy: new LocalAuth({
                clientId: sessionId,
                dataPath: authPath,
            }),
            puppeteer: {
                headless: true,
                executablePath:
                    process.env.PUPPETEER_EXECUTABLE_PATH ||
                    (existsSync("/usr/bin/chromium-browser")
                        ? "/usr/bin/chromium-browser"
                        : "/usr/bin/chromium"),
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
                    "--single-process",
                    `--user-data-dir=${chromiumProfileDir}`,
                ],
                timeout: 60000,
            },
            takeoverTimeoutMs: 120000,
        });

        // Guardar estado inicial
        this.upsertSession("INIT");

        // Inicializar cliente con control de errores
        this.initializeClient();

        // Reinicio automático cada 24h (buen mantenimiento)
        const maintenanceTimeout = setTimeout(() => {
            console.log(`🔄 Reiniciando sesión ${sessionId} por mantenimiento`);
            WhatsAppService.closeSession(sessionId);
        }, 24 * 60 * 60 * 1000);

        this.client.on("disconnected", () => clearTimeout(maintenanceTimeout));

        // ==============================
        // EVENTOS DEL CLIENTE
        // ==============================

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
            console.log(`📱 Escaneá el QR para sesión ${sessionId}`);
        });

        this.client.on("disconnected", () => {
            this.status = "DISCONNECTED";
            this.upsertSession("DISCONNECTED");
            console.log(`🔌 Sesión ${sessionId} desconectada`);
        });
    }

    /**
     * Inicializa el cliente con reintentos automáticos
     */
    private async initializeClient() {
        try {
            console.log(`🚀 Inicializando sesión WhatsApp (${this.sessionId})...`);
            await this.client.initialize();
        } catch (error: any) {
            console.error(`❌ Error al inicializar WhatsApp (${this.sessionId}):`, error.message);
            console.log(`♻️ Reintentando inicialización de sesión ${this.sessionId} en 10 segundos...`);
            setTimeout(() => {
                WhatsAppService.closeSession(this.sessionId);
            }, 10000);
        }
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

    /**
     * Retorna o crea una instancia de sesión
     */
    public static getInstance(sessionId: string): WhatsAppService {
        if (!WhatsAppService.instances.has(sessionId)) {
            WhatsAppService.instances.set(sessionId, new WhatsAppService(sessionId));
        }
        return WhatsAppService.instances.get(sessionId)!;
    }

    /**
     * Enviar mensaje de texto
     */
    public async sendMessage({ phone, message }: SendMessageInput) {
        if (this.status !== "CONNECTED") throw new Error("SESSION_NOT_READY");
        const response = await this.client.sendMessage(`${phone}@c.us`, message);
        return { id: response.id.id };
    }

    /**
     * Enviar mensaje multimedia
     */
    public async sendMediaMessage({
        phone,
        caption = "",
        url,
        filePath,
        base64,
        mimeType = "image/jpeg",
        filename = "file.jpg",
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

    /**
     * Detección automática de tipo MIME
     */
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

    /**
     * Cierra sesión y limpia recursos
     */
    public static async closeSession(sessionId: string): Promise<void> {
        const instance = WhatsAppService.instances.get(sessionId);
        if (instance) {
            try {
                await instance.client.destroy();
                console.log(`🧹 Cliente ${sessionId} destruido correctamente.`);
            } catch (err) {
                console.warn(`⚠️ Error al destruir cliente ${sessionId}:`, err);
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