// public/app.js
let currentSessionId = null;
let isConnected = false;
let pollInterval = null;

// ====== GESTIÓN DE VISTAS ======
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(`${btn.dataset.view}-view`).classList.add('active');
    if (btn.dataset.view === 'sessions') loadSessions();
  });
});

// ====== BOTONES DE CONEXIÓN ======
document.getElementById('init-btn').addEventListener('click', initSession);
document.getElementById('restart-btn').addEventListener('click', restartSession);
document.getElementById('close-btn').addEventListener('click', closeSession);
document.getElementById('refresh-sessions').addEventListener('click', loadSessions);
document.getElementById('send-msg-btn').addEventListener('click', sendMessage);
document.getElementById('send-image-btn').addEventListener('click', sendImage);

// ====== FUNCIONES DE UTILIDAD ======
function showStatus(text, type = "info", elementId = "status") {
  const el = document.getElementById(elementId);
  el.textContent = text;
  el.className = "status " + type;
  el.style.display = "block";
}

function showLoader(message = "Procesando...", loaderId = "loader") {
  document.getElementById("loader-text").textContent = message;
  document.getElementById(loaderId).style.display = "block";
  
  // Ocultar otros elementos en la vista de conexión
  if (loaderId === "loader") {
    document.getElementById("status").style.display = "none";
    document.getElementById("qr-img").style.display = "none";
    document.getElementById("session-controls").style.display = "none";
  }
}

function hideLoader(loaderId = "loader") {
  document.getElementById(loaderId).style.display = "none";
}

// ====== SESIÓN: Iniciar / Reiniciar / Cerrar ======
async function initSession() {
  const sessionId = document.getElementById("sessionId").value?.trim();
  if (!sessionId) return alert("Ingresa un Session ID");
  currentSessionId = sessionId;
  showLoader("Iniciando sesión de WhatsApp...");

  try {
    const res = await fetch("/api/whatsapp/init", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId })
    });
    if (!res.ok) throw new Error("Error al iniciar");
    startPolling();
  } catch (err) {
    hideLoader();
    showStatus(`❌ Error: ${err.message}`, "error");
  }
}

async function restartSession() {
  if (!currentSessionId) return;
  showLoader("Reiniciando sesión...");
  try {
    const res = await fetch("/api/whatsapp/restart", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: currentSessionId })
    });
    if (res.ok) {
      startPolling();
    } else {
      const err = await res.json();
      throw new Error(err.error);
    }
  } catch (err) {
    hideLoader();
    showStatus(`❌ Error: ${err.message}`, "error");
  }
}

async function closeSession() {
  if (!currentSessionId || !confirm("¿Cerrar sesión?")) return;
  showLoader("Cerrando sesión...");
  try {
    const res = await fetch(`/api/whatsapp/session/${currentSessionId}`, { method: "DELETE" });
    if (res.ok) {
      stopPolling();
      currentSessionId = null;
      isConnected = false;
      hideLoader();
      showStatus("Sesión cerrada correctamente.", "info");
      document.getElementById("sessionId").value = "";
      document.getElementById("send-form").style.display = "none";
      document.getElementById("image-form").style.display = "none";
      document.getElementById("send-instructions").style.display = "block";
      document.getElementById("image-instructions").style.display = "block";
    } else {
      throw new Error("Error al cerrar");
    }
  } catch (err) {
    hideLoader();
    showStatus(`❌ Error: ${err.message}`, "error");
  }
}

// ====== POLLING ======
function startPolling() {
  stopPolling();
  pollInterval = setInterval(checkSessionStatus, 3000);
  checkSessionStatus();
}
function stopPolling() {
  if (pollInterval) clearInterval(pollInterval);
}
async function checkSessionStatus() {
  if (!currentSessionId) return;
  try {
    const res = await fetch(`/api/whatsapp/session/${currentSessionId}/qr`);
    const data = await res.json();
    
    if (data.status === "CONNECTED") {
      isConnected = true;
      hideLoader();
      showStatus("✅ ¡Conectado! Puedes enviar mensajes.", "connected");
      document.getElementById("qr-img").style.display = "none";
      document.getElementById("session-controls").style.display = "block";
      
      // Actualizar formularios
      document.getElementById("send-sessionId").value = currentSessionId;
      document.getElementById("image-sessionId").value = currentSessionId;
      document.getElementById("send-instructions").style.display = "none";
      document.getElementById("image-instructions").style.display = "none";
      document.getElementById("send-form").style.display = "block";
      document.getElementById("image-form").style.display = "block";
      
      stopPolling();
    } else if (data.status === "QR_NEEDED") {
      hideLoader();
      showStatus("👇 Escanea este código con WhatsApp", "info");
      document.getElementById("qr-img").src = `/api/whatsapp/session/${currentSessionId}/qr/image?_t=${Date.now()}`;
      document.getElementById("qr-img").style.display = "block";
      document.getElementById("session-controls").style.display = "block";
    } else {
      hideLoader();
      showStatus(`Estado: ${data.status}`, "error");
      document.getElementById("qr-img").style.display = "none";
      document.getElementById("session-controls").style.display = "block";
    }
  } catch (err) {
    console.error("Poll error:", err);
    hideLoader();
    showStatus("❌ Error de conexión", "error");
  }
}

// ====== ENVIAR MENSAJE DE TEXTO ======
async function sendMessage() {
  const phone = document.getElementById("phone").value?.trim();
  const message = document.getElementById("message").value?.trim();
  if (!phone || !message || !currentSessionId) {
    showStatus("Completa todos los campos", "error", "send-status");
    return;
  }

  showLoader("Enviando mensaje...", "send-loader");
  document.getElementById("send-status").style.display = "none";

  try {
    const res = await fetch("/api/whatsapp/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: currentSessionId, phone, message })
    });
    const result = await res.json();
    hideLoader("send-loader");
    if (res.ok) {
      showStatus("✅ ¡Mensaje enviado!", "connected", "send-status");
      document.getElementById("phone").value = "";
      document.getElementById("message").value = "";
    } else {
      showStatus(`❌ ${result.error}`, "error", "send-status");
    }
  } catch (err) {
    hideLoader("send-loader");
    showStatus(`❌ Error: ${err.message}`, "error", "send-status");
  }
}

// ====== ENVIAR IMAGEN ======
async function sendImage() {
  const phone = document.getElementById("image-phone").value?.trim();
  const caption = document.getElementById("image-caption").value?.trim();
  const fileInput = document.getElementById("image-file");
  const file = fileInput.files[0];
  
  if (!phone || !file || !currentSessionId) {
    showStatus("Selecciona un archivo y completa el teléfono", "error", "image-status");
    return;
  }
  
  if (file.size > 16 * 1024 * 1024) {
    showStatus("❌ El archivo debe pesar menos de 16 MB", "error", "image-status");
    return;
  }

  showLoader("Procesando y enviando imagen...", "image-loader");
  document.getElementById("image-status").style.display = "none";

  const reader = new FileReader();
  reader.onload = async () => {
    const base64 = reader.result.split(",")[1];
    const mimeType = file.type || "image/jpeg";
    const filename = file.name;
    
    try {
      const res = await fetch("/api/whatsapp/send-media", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: currentSessionId,
          phone,
          caption,
          base64,
          mimeType,
          filename
        })
      });
      const result = await res.json();
      hideLoader("image-loader");
      if (res.ok) {
        showStatus("✅ ¡Imagen enviada!", "connected", "image-status");
        fileInput.value = "";
        document.getElementById("image-phone").value = "";
        document.getElementById("image-caption").value = "";
      } else {
        showStatus(`❌ ${result.error}`, "error", "image-status");
      }
    } catch (err) {
      hideLoader("image-loader");
      showStatus(`❌ Error: ${err.message}`, "error", "image-status");
    }
  };
  reader.readAsDataURL(file);
}

// ====== SESIONES ======
function formatDate(dateString) {
  // Si no hay fecha, mostrar guion
  if (!dateString) return "—";
  
  // Crear objeto Date
  const date = new Date(dateString);
  
  // Verificar si es una fecha válida
  if (isNaN(date.getTime())) {
    return "Fecha inválida";
  }
  
  // Detectar automáticamente el idioma y país del usuario
    const userLocale = navigator.language; // ej: "es-AR", "es-ES", "en-US"

  return date.toLocaleString(userLocale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

async function loadSessions() {
  const container = document.getElementById("sessions-list");
  try {
    const res = await fetch("/api/whatsapp/sessions");
    const sessions = await res.json();
    
    if (sessions.length === 0) {
      container.innerHTML = "<p>No hay sesiones activas</p>";
      return;
    }
    
    let html = `
      <table>
        <thead>
          <tr>
            <th>Session ID</th>
            <th>Estado</th>
            <th>Última actualización</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
    `;
    
    sessions.forEach(s => {
      const statusClass = 
        s.ses_status === "CONNECTED" ? "status-connected" :
        s.ses_status === "QR_NEEDED" ? "status-qr" : "status-error";
      const statusText = 
        s.ses_status === "CONNECTED" ? "Conectado" :
        s.ses_status === "QR_NEEDED" ? "Esperando QR" : s.ses_status;
      
      html += `
        <tr>
          <td><strong>${s.ses_id}</strong></td>
          <td class="${statusClass}">${statusText}</td>
          <td>${formatDate(s.ses_lastupdated)}</td>
          <td>
            <button class="action-btn close-btn" onclick="closeSessionFromList('${s.ses_id}')">
              ❌ Cerrar
            </button>
          </td>
        </tr>
      `;
    });
    
    html += `</tbody></table>`;
    container.innerHTML = html;
  } catch (err) {
    container.innerHTML = `<p class="status error">Error: ${err.message}</p>`;
  }
}

// ====== CERRAR SESIÓN DESDE LISTA ======
window.closeSessionFromList = async function(sessionId) {
  if (!confirm(`¿Cerrar sesión "${sessionId}"?`)) return;
  showLoader(`Cerrando sesión ${sessionId}...`);
  
  try {
    const res = await fetch(`/api/whatsapp/session/${sessionId}`, { method: "DELETE" });
    if (res.ok) {
      alert("Sesión cerrada");
      loadSessions();
      if (currentSessionId === sessionId) {
        stopPolling();
        currentSessionId = null;
        isConnected = false;
        hideLoader();
        showStatus("Sesión cerrada.", "info");
        document.getElementById("send-form").style.display = "none";
        document.getElementById("image-form").style.display = "none";
        document.getElementById("send-instructions").style.display = "block";
        document.getElementById("image-instructions").style.display = "block";
      }
    } else {
      throw new Error("Error al cerrar");
    }
  } catch (err) {
    hideLoader();
    alert(`Error: ${err.message}`);
  }
};