// src/controllers/WhatsAppController.ts
import { Request, Response } from "express";
import WhatsAppService from "../services/WhatsAppService";
import { Session } from "../models/Session";
import qr from "qr-image";

// Interfaz para la lista
interface SessionListItem {
    ses_uuid: string;
    ses_id: string;
    ses_status: string;
    ses_lastupdated: Date;
    ses_isConnected: boolean;
}

export class WhatsAppController {
    static async initSession(req: Request, res: Response) {
        const { sessionId } = req.body;
        if (!sessionId || typeof sessionId !== "string") {
            return res.status(400).json({ error: "sessionId es obligatorio" });
        }

        try {
            WhatsAppService.getInstance(sessionId);
            await Session.upsert({
                ses_id: sessionId,
                ses_status: "INIT",
                ses_lastupdated: new Date(),
            });
            res.json({ success: true, message: "Sesión iniciada", sessionId });
        } catch (error: any) {
            console.error("Error al iniciar sesión:", error);
            res.status(500).json({ error: error.message });
        }
    }

    static async sendMessage(req: Request, res: Response) {
        const { phone, message, sessionId } = req.body;
        if (!sessionId || !phone || !message) {
            return res.status(400).json({ error: "Faltan parámetros" });
        }

        try {
            const service = WhatsAppService.getInstance(sessionId);
            const result = await service.sendMessage({ phone, message });
            res.json({ success: true, whatsapp: result });
        } catch (error: any) {
            res.status(400).json({ error: error.message });
        }
    }

    static async sendMediaMessage(req: Request, res: Response) {
        const { sessionId, phone, caption = "", url, filePath, base64, mimeType = "image/jpeg", filename = "image.jpg" } = req.body;

        if (!sessionId || !phone) {
            return res.status(400).json({ error: "sessionId y phone son obligatorios" });
        }

        if (!url && !filePath && !base64) {
            return res.status(400).json({ error: "Se requiere 'url', 'filePath' o 'base64'" });
        }

        try {
            let cleanBase64 = base64;
            if (base64 && base64.includes(",")) {
                cleanBase64 = base64.split(",")[1];
            }

            const service = WhatsAppService.getInstance(sessionId);
            const result = await service.sendMediaMessage({
                phone,
                caption,
                url,
                filePath,
                base64: cleanBase64,
                mimeType,
                filename,
            });

            res.json({ success: true, whatsapp: result });
        } catch (error: any) {
            console.error("Error al enviar media:", error);
            res.status(400).json({ error: error.message });
        }
    }

    static async getQr(req: Request, res: Response) {
        const { sessionId } = req.params;
        const session = await Session.findOne({ where: { ses_id: sessionId } });

        if (!session) {
            return res.status(404).json({ error: "Sesión no encontrada" });
        }

        if (session.ses_status === "QR_NEEDED") {
            return res.json({
                qr: session.ses_qr,
                status: session.ses_status,
                sessionId: session.ses_id,
                lastUpdated: session.ses_lastupdated,
            });
        }

        return res.json({
            status: session.ses_status,
            message: "QR no disponible",
        });
    }

    static async getQrImage(req: Request, res: Response) {
        const { sessionId } = req.params;
        const session = await Session.findOne({ where: { ses_id: sessionId } });

        if (!session || session.ses_status !== "QR_NEEDED") {
            return res.status(404).json({ error: "QR no disponible" });
        }

        try {
            const qrSvg = qr.imageSync(session.ses_qr!, { type: "svg", margin: 4 });
            res.setHeader("Content-Type", "image/svg+xml");
            res.send(qrSvg);
        } catch (err) {
            res.status(500).json({ error: "Error al generar QR" });
        }
    }

    static async listSessions(_req: Request, res: Response) {
        try {
            const sessions = await Session.findAll();
            const list: SessionListItem[] = [];
            for (const s of sessions) {
                list.push({
                    ses_uuid: s.ses_uuid,
                    ses_id: s.ses_id,
                    ses_status: s.ses_status,
                    ses_lastupdated: s.ses_lastupdated,
                    ses_isConnected: s.ses_status === "CONNECTED",
                });
            }
            res.json(list);
        } catch (error: any) {
            console.error("Error al listar sesiones:", error);
            res.status(500).json({ error: "Error interno" });
        }
    }

    static async closeSession(req: Request, res: Response) {
        const { sessionId } = req.params;
        if (!sessionId) {
            return res.status(400).json({ error: "sessionId es obligatorio" });
        }

        try {
            await WhatsAppService.closeSession(sessionId);
            res.json({ success: true, message: "Sesión cerrada" });
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }

    static async restartSession(req: Request, res: Response) {
        const { sessionId } = req.body;
        if (!sessionId) {
            return res.status(400).json({ error: "sessionId es obligatorio" });
            }

        try {
            await WhatsAppService.closeSession(sessionId);
            WhatsAppService.getInstance(sessionId);
            await Session.upsert({
                ses_id: sessionId,
                ses_status: "INIT",
                ses_lastupdated: new Date(),
            });
            res.json({ success: true, message: "Sesión reiniciada" });
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }
}