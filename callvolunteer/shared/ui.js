export function setStatus(refs, text, mode = "idle") {
    refs.statusText.textContent = text;
    refs.statusDot.className = "dot";
  
    if (mode === "live") {
      refs.statusDot.classList.add("live");
    }
  
    if (mode === "captured") {
      refs.statusDot.classList.add("captured");
    }
  }
  
  export function updateButtons(state, refs) {
    refs.btnOpen.disabled = state.cameraMode === "phone" || state.cameraOn;
    refs.btnCapture.disabled = !state.cameraOn;
    refs.btnRetake.disabled = !state.captured;
    refs.btnRandom.disabled = state.faces.length === 0;
    refs.btnStop.disabled = !state.cameraOn;
  }
  
  export function syncCanvasSize(sourceCanvas, overlayCanvas) {
    overlayCanvas.width = sourceCanvas.width;
    overlayCanvas.height = sourceCanvas.height;
  }
  
  export function clearOverlay(canvas) {
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  
  export function drawFaceBoxes({ canvas, faces, selectedFaceId = null }) {
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  
    faces.forEach((face) => {
      const selected = face.id === selectedFaceId;
      const { x, y, width, height } = face.box;
  
      ctx.save();
      ctx.strokeStyle = selected ? "#ef4444" : "#fbbf24";
      ctx.lineWidth = selected ? 3 : 2;
      ctx.shadowColor = selected ? "#ef4444" : "#fbbf24";
      ctx.shadowBlur = selected ? 22 : 10;
      ctx.strokeRect(x, y, width, height);
      ctx.restore();
  
      const labelText = face.label;
      ctx.font = '600 12px Inter, sans-serif';
      const textWidth = ctx.measureText(labelText).width;
      ctx.fillStyle = selected ? "rgba(239,68,68,0.94)" : "rgba(251,191,36,0.94)";
      ctx.fillRect(x, Math.max(0, y - 22), textWidth + 14, 20);
      ctx.fillStyle = selected ? "#ffffff" : "#111827";
      ctx.fillText(labelText, x + 7, Math.max(14, y - 8));
    });
  }
  
  export function renderFacesList({ container, faces, selectedFaceId = null }) {
    if (!faces.length) {
      container.innerHTML = `
        <div class="empty-state">
          Chưa phát hiện khuôn mặt nào.<br />
          Hãy chụp ảnh để bắt đầu.
        </div>
      `;
      return;
    }
  
    container.innerHTML = "";
  
    faces.forEach((face, index) => {
      const item = document.createElement("div");
      item.className = `person-item${face.id === selectedFaceId ? " selected" : ""}`;
      item.innerHTML = `
        <div class="avatar">${index + 1}</div>
        <div class="p-main">
          <div class="p-name">${face.label}</div>
          <div class="p-sub">Phát hiện từ ảnh vừa chụp</div>
        </div>
      `;
      container.appendChild(item);
    });
  }
  
  export function showResult(refs, label, note = "Đã random thành công") {
    refs.resultName.textContent = label;
    refs.resultNote.textContent = note;
  }
  
  export function clearResult(refs) {
    refs.resultName.textContent = "—";
    refs.resultNote.textContent = "Sẵn sàng random";
  }
  
  export function logMessage(logArea, message) {
    const now = new Date();
    const time = now.toTimeString().slice(0, 5);
  
    const entry = document.createElement("div");
    entry.className = "log-entry";
    entry.innerHTML = `<span class="log-time">[${time}]</span>${message}`;
  
    logArea.prepend(entry);
  
    if (logArea.children.length > 30) {
      logArea.lastElementChild.remove();
    }
  }
  
  export function flashCapture(flashEl) {
    flashEl.classList.remove("flash");
    void flashEl.offsetWidth;
    flashEl.classList.add("flash");
  }
  
  export function cropFaceToCanvas(sourceCanvas, face, targetCanvas) {
    const { x, y, width, height } = face.box;
  
    // Padding lớn hơn để lấy cả đầu + vai
    const paddingX = width * 1.2;
    const paddingTop = height * 1.1;
    const paddingBottom = height * 0.9;
  
    let sx = Math.max(0, x - paddingX);
    let sy = Math.max(0, y - paddingTop);
    let sw = Math.min(sourceCanvas.width - sx, width + paddingX * 2);
    let sh = Math.min(sourceCanvas.height - sy, height + paddingTop + paddingBottom);
  
    // Cố định kích thước popup canvas
    const targetWidth = 420;
    const targetHeight = 260;
  
    targetCanvas.width = targetWidth;
    targetCanvas.height = targetHeight;
  
    const ctx = targetCanvas.getContext("2d");
    ctx.clearRect(0, 0, targetWidth, targetHeight);
  
    // nền tối cho đẹp
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, targetWidth, targetHeight);
  
    // scale để ảnh crop luôn to nhất có thể trong popup
    const scale = Math.min(targetWidth / sw, targetHeight / sh);
  
    const drawWidth = sw * scale;
    const drawHeight = sh * scale;
  
    const dx = (targetWidth - drawWidth) / 2;
    const dy = (targetHeight - drawHeight) / 2;
  
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
  
    ctx.drawImage(
      sourceCanvas,
      sx,
      sy,
      sw,
      sh,
      dx,
      dy,
      drawWidth,
      drawHeight
    );
  }
  
  export function openFacePopup(refs, label) {
    refs.facePopupName.textContent = label;
    refs.facePopupOverlay.classList.remove("hidden");
  }
  
  export function closeFacePopup(refs) {
    refs.facePopupOverlay.classList.add("hidden");
  }