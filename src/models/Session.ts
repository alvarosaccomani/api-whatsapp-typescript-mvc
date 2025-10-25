// src/models/Session.ts
import { DataTypes, Model, Optional, Sequelize } from "sequelize";
import sequelize from "../config/database";
import { v4 as uuidv4 } from "uuid";

// Atributos obligatorios al crear
interface SessionCreationAttributes extends Optional<SessionAttributes, "ses_uuid" | "ses_lastupdated"> {}

// Atributos del modelo (con nombres de campo reales)
export interface SessionAttributes {
    ses_uuid: string;
    ses_id: string;
    ses_qr?: string;
    ses_status: "INIT" | "QR_NEEDED" | "CONNECTED" | "AUTH_FAILED" | "DISCONNECTED";
    ses_lastupdated: Date;
}

// Modelo de Sequelize
export class Session
    extends Model<SessionAttributes, SessionCreationAttributes>
    implements SessionAttributes
{
    public ses_uuid!: string;
    public ses_id!: string;
    public ses_qr?: string;
    public ses_status!: "INIT" | "QR_NEEDED" | "CONNECTED" | "AUTH_FAILED" | "DISCONNECTED";
    public ses_lastupdated!: Date;
}

// Inicializar el modelo con nombres de columna personalizados
Session.init(
    {
      ses_uuid: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        field: "ses_uuid", // nombre en la base de datos
      },
      ses_id: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        field: "ses_id",
      },
      ses_qr: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: "ses_qr",
      },
      ses_status: {
        type: DataTypes.ENUM("INIT", "QR_NEEDED", "CONNECTED", "AUTH_FAILED", "DISCONNECTED"),
        allowNull: false,
        defaultValue: "INIT",
        field: "ses_status",
      },
      ses_lastupdated: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        field: "ses_lastupdated",
      },
    },
    {
      sequelize,
      modelName: "Session",
      tableName: "ses_sessions", // nombre de la tabla
      timestamps: false,
    }
);

// Sincronizar (solo en desarrollo)
if (process.env.NODE_ENV !== "production") {
    sequelize.sync();
}