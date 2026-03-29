import {
    startCamera,
    stopCamera,
    captureFrame
  } from "../shared/camera.js";
  import {
    initFaceDetector,
    detectFaces
  } from "../shared/face-detection.js";
  import { pickRandomFace } from "../shared/random-picker.js";
  import { createSignalingChannel } from "../shared/signaling.js";
  import {
    createPeerConnection,
    createAnswer,
    setRemoteDescription,
    addIceCandidate,
    closePeerConnection
  } from "../shared/remote-camera.js";
  import {
    setStatus,
    updateButtons,
    syncCanvasSize,
    clearOverlay,
    drawFaceBoxes,
    renderFacesList,
    showResult,
    clearResult,
    logMessage,
    flashCapture,
    cropFaceToCanvas,
    openFacePopup,
    closeFacePopup
  } from "../shared/ui.js";
  
  const state = {
    cameraMode: "local",
    cameraOn: false,
    captured: false,
    faces: [],
    selectedFaceId: null,
    captureCount: 0,
    stream: null,
    remoteStream: null,
    sessionId: "",
    signaling: null,
    peer: null,
    phoneConnected: false
  };
  
  const refs = {
    video: document.getElementById("cameraVideo"),
    capturedCanvas: document.getElementById("capturedCanvas"),
    detectionCanvas: document.getElementById("detectionCanvas"),
    cameraPlaceholder: document.getElementById("cameraPlaceholder"),
    flashEffect: document.getElementById("flashEffect"),
    statusDot: document.getElementById("statusDot"),
    statusText: document.getElementById("statusText"),
    statPeople: document.getElementById("statPeople"),
    statCaptures: document.getElementById("statCaptures"),
    peopleList: document.getElementById("peopleList"),
    resultName: document.getElementById("resultName"),
    resultNote: document.getElementById("resultNote"),
    logArea: document.getElementById("logArea"),
    btnOpen: document.getElementById("btnOpen"),
    btnCapture: document.getElementById("btnCapture"),
    btnRetake: document.getElementById("btnRetake"),
    btnRandom: document.getElementById("btnRandom"),
    btnStop: document.getElementById("btnStop"),
    useLocalCameraBtn: document.getElementById("useLocalCameraBtn"),
    usePhoneCameraBtn: document.getElementById("usePhoneCameraBtn"),
    phoneConnectPanel: document.getElementById("phoneConnectPanel"),
    sessionCodeText: document.getElementById("sessionCodeText"),
    sessionLinkText: document.getElementById("sessionLinkText"),
    phoneConnectStatus: document.getElementById("phoneConnectStatus"),
    facePopupOverlay: document.getElementById("facePopupOverlay"),
    facePopupClose: document.getElementById("facePopupClose"),
    facePopupName: document.getElementById("facePopupName"),
    facePopupCanvas: document.getElementById("facePopupCanvas"),
    copySessionBtn: document.getElementById("copySessionBtn"),
    copySessionLinkBtn: document.getElementById("copySessionLinkBtn"),
    sessionQrImage: document.getElementById("sessionQrImage"),
    backDashboardBtn: document.getElementById("backDashboardBtn"),
  };
  function goBackDashboard() {
    window.location.href = "../../dashboard/index.html";
  }
  function createSessionId(length = 6) {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let result = "";
    for (let i = 0; i < length; i += 1) {
      result += chars[Math.floor(Math.random() * chars.length)];
    }
    return result;
  }
  function getPhoneJoinUrl(sessionId) {
    return `${window.location.origin}${window.location.pathname.replace(
      "/dashboard_volunteer/index.html",
      `/mobile_camera/index.html?session=${sessionId}`
    )}`;
  }
  
  function buildQrImageUrl(text) {
    return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(text)}`;
  }
  
  async function copyToClipboard(text, successMessage) {
    try {
      await navigator.clipboard.writeText(text);
      logMessage(refs.logArea, successMessage);
    } catch (error) {
      logMessage(refs.logArea, `Copy thất bại: ${error.message}`);
    }
  }
  function syncStats() {
    refs.statPeople.textContent = String(state.faces.length);
    refs.statCaptures.textContent = String(state.captureCount);
  }
  
  function renderAll() {
    syncStats();
    updateButtons(
      {
        cameraOn: state.cameraOn,
        captured: state.captured,
        faces: state.faces
      },
      refs
    );
  
    renderFacesList({
      container: refs.peopleList,
      faces: state.faces,
      selectedFaceId: state.selectedFaceId
    });
  
    drawFaceBoxes({
      canvas: refs.detectionCanvas,
      faces: state.faces,
      selectedFaceId: state.selectedFaceId
    });
  }
  
  function clearCurrentDetection() {
    state.faces = [];
    state.selectedFaceId = null;
    clearResult(refs);
    closeFacePopup(refs);
    clearOverlay(refs.detectionCanvas);
    renderAll();
  }
  
  async function cleanupPhoneMode() {
    try {
      if (state.peer) {
        closePeerConnection(state.peer);
        state.peer = null;
      }
  
      if (state.signaling) {
        await state.signaling.unsubscribe();
        state.signaling = null;
      }
  
      state.remoteStream = null;
      state.sessionId = "";
      state.phoneConnected = false;
  
      refs.phoneConnectPanel.classList.add("hidden");
      refs.sessionCodeText.textContent = "----";
      refs.sessionLinkText.textContent = "";
      refs.phoneConnectStatus.textContent = "Đang chờ điện thoại kết nối...";
      refs.sessionQrImage.src = "";
      refs.sessionQrImage.classList.add("hidden");
    } catch (error) {
      console.warn("cleanupPhoneMode error:", error);
    }
  }
  
  async function cleanupLocalStream() {
    if (state.stream) {
      stopCamera(refs.video, state.stream);
      state.stream = null;
    }
  }
  
  async function switchToLocalMode() {
    if (state.cameraMode === "phone") {
      await cleanupPhoneMode();
    }
  
    state.cameraMode = "local";
    state.cameraOn = false;
    state.captured = false;
    state.faces = [];
    state.selectedFaceId = null;
  
    refs.video.classList.remove("active");
    refs.cameraPlaceholder.classList.remove("hidden");
    refs.capturedCanvas.classList.remove("active");
  
    const capturedCtx = refs.capturedCanvas.getContext("2d");
    capturedCtx.clearRect(0, 0, refs.capturedCanvas.width, refs.capturedCanvas.height);
    clearOverlay(refs.detectionCanvas);
  
    setStatus(refs, "Đã chuyển sang webcam máy tính", "idle");
    logMessage(refs.logArea, "Đã chọn chế độ webcam máy tính");
    renderAll();
  }
  
  async function handleLaptopSignal(message) {
    if (!message || message.from === "laptop") return;
  
    try {
      if (message.type === "offer") {
        await setRemoteDescription(state.peer, message.payload.sdp);
        const answer = await createAnswer(state.peer);
  
        await state.signaling.send({
          type: "answer",
          from: "laptop",
          payload: { sdp: answer }
        });
  
        refs.phoneConnectStatus.textContent = "Đã gửi phản hồi kết nối";
        return;
      }
  
      if (message.type === "candidate") {
        await addIceCandidate(state.peer, message.payload.candidate);
      }
    } catch (error) {
      refs.phoneConnectStatus.textContent = `Lỗi kết nối: ${error.message}`;
      logMessage(refs.logArea, `Lỗi signaling: ${error.message}`);
    }
  }
  
  async function switchToPhoneMode() {
    await cleanupLocalStream();
    await cleanupPhoneMode();
  
    state.cameraMode = "phone";
    state.cameraOn = false;
    state.captured = false;
    state.faces = [];
    state.selectedFaceId = null;
    state.sessionId = createSessionId();
  
    refs.phoneConnectPanel.classList.remove("hidden");
    refs.sessionCodeText.textContent = state.sessionId;
  
    const joinUrl = getPhoneJoinUrl(state.sessionId);
  
    refs.sessionLinkText.textContent = joinUrl;
    refs.sessionQrImage.src = buildQrImageUrl(joinUrl);
    refs.sessionQrImage.classList.remove("hidden");
  
    refs.phoneConnectStatus.textContent = "Đang chờ điện thoại kết nối...";
    logMessage(refs.logArea, `Đã tạo phiên điện thoại: ${state.sessionId}`);
  
    state.signaling = createSignalingChannel(
      window.supabaseClient,
      state.sessionId,
      handleLaptopSignal
    );
  
    await state.signaling.subscribe();
  
    state.peer = createPeerConnection({
      onIceCandidate: async (candidate) => {
        if (!state.signaling) return;
        await state.signaling.send({
          type: "candidate",
          from: "laptop",
          payload: { candidate }
        });
      },
      onRemoteStream: async (stream) => {
        state.remoteStream = stream;
        state.stream = stream;
        refs.video.srcObject = stream;
        await refs.video.play();
  
        state.cameraOn = true;
        state.phoneConnected = true;
  
        refs.video.classList.add("active");
        refs.cameraPlaceholder.classList.add("hidden");
        refs.phoneConnectStatus.textContent = "Điện thoại đã kết nối";
        setStatus(refs, "Đang dùng camera điện thoại", "live");
        logMessage(refs.logArea, "Điện thoại đã kết nối thành công");
        renderAll();
      }
    });
  
    setStatus(refs, "Đang chờ camera điện thoại...", "idle");
    renderAll();
  }
  
  async function handleOpenCamera() {
    if (state.cameraMode !== "local") {
      logMessage(refs.logArea, "Hãy chọn 'Webcam máy tính' nếu muốn mở camera trực tiếp trên laptop");
      return;
    }
  
    try {
      state.stream = await startCamera(refs.video);
      state.cameraOn = true;
      state.captured = false;
  
      refs.video.classList.add("active");
      refs.cameraPlaceholder.classList.add("hidden");
      refs.capturedCanvas.classList.remove("active");
  
      setStatus(refs, "Camera đang hoạt động", "live");
      logMessage(refs.logArea, "Đã mở camera máy tính");
      renderAll();
    } catch (error) {
      setStatus(refs, "Không thể mở camera", "idle");
      logMessage(refs.logArea, `Mở camera thất bại: ${error.message}`);
    }
  }
  
  async function handleCapture() {
    if (!state.cameraOn) return;
  
    try {
      clearCurrentDetection();
      flashCapture(refs.flashEffect);
  
      captureFrame(refs.video, refs.capturedCanvas);
      syncCanvasSize(refs.capturedCanvas, refs.detectionCanvas);
  
      refs.capturedCanvas.classList.add("active");
  
      state.captured = true;
      state.captureCount += 1;
  
      setStatus(refs, "Đang nhận diện khuôn mặt...", "captured");
      logMessage(refs.logArea, "Đã chụp ảnh");
  
      const faces = await detectFaces(refs.capturedCanvas);
  
      state.faces = faces.map((face, index) => ({
        ...face,
        label: `Khuôn mặt ${index + 1}`
      }));
  
      if (state.faces.length > 0) {
        setStatus(refs, `Phát hiện ${state.faces.length} khuôn mặt`, "captured");
        logMessage(refs.logArea, `Phát hiện ${state.faces.length} khuôn mặt`);
      } else {
        setStatus(refs, "Không phát hiện khuôn mặt nào", "captured");
        logMessage(refs.logArea, "Không phát hiện khuôn mặt nào");
      }
  
      renderAll();
    } catch (error) {
      setStatus(refs, "Nhận diện thất bại", "captured");
      logMessage(refs.logArea, `Nhận diện thất bại: ${error.message}`);
    }
  }
  
  function handleRetake() {
    state.captured = false;
    state.faces = [];
    state.selectedFaceId = null;
  
    const capturedCtx = refs.capturedCanvas.getContext("2d");
    capturedCtx.clearRect(0, 0, refs.capturedCanvas.width, refs.capturedCanvas.height);
  
    refs.capturedCanvas.classList.remove("active");
    clearOverlay(refs.detectionCanvas);
    clearResult(refs);
    closeFacePopup(refs);
  
    setStatus(
      refs,
      state.cameraMode === "phone" ? "Đang dùng camera điện thoại" : "Camera đang hoạt động",
      "live"
    );
    logMessage(refs.logArea, "Đã xóa kết quả cũ, sẵn sàng chụp lại");
  
    renderAll();
  }
  
  async function handleStopCamera() {
    if (state.cameraMode === "local") {
      await cleanupLocalStream();
    } else {
      await cleanupPhoneMode();
      refs.video.pause();
      refs.video.srcObject = null;
    }
  
    state.cameraOn = false;
    state.captured = false;
    state.stream = null;
    state.faces = [];
    state.selectedFaceId = null;
  
    refs.video.classList.remove("active");
    refs.cameraPlaceholder.classList.remove("hidden");
    refs.capturedCanvas.classList.remove("active");
  
    const capturedCtx = refs.capturedCanvas.getContext("2d");
    capturedCtx.clearRect(0, 0, refs.capturedCanvas.width, refs.capturedCanvas.height);
    clearOverlay(refs.detectionCanvas);
  
    clearResult(refs);
    closeFacePopup(refs);
    setStatus(refs, "Camera đã tắt", "idle");
    logMessage(refs.logArea, "Đã dừng camera");
    renderAll();
  }
  
  function handleRandomPick() {
    if (!state.faces.length) return;
  
    const picked = pickRandomFace(state.faces);
    if (!picked) return;
  
    state.selectedFaceId = picked.face.id;
  
    showResult(refs, picked.face.label, "Được chọn từ ảnh vừa chụp");
    cropFaceToCanvas(refs.capturedCanvas, picked.face, refs.facePopupCanvas);
    openFacePopup(refs, picked.face.label);
  
    logMessage(refs.logArea, `Đã chọn ${picked.face.label}`);
    renderAll();
  }
  
  async function bootstrap() {
    try {
      await initFaceDetector();
      logMessage(refs.logArea, "Đã nạp bộ nhận diện khuôn mặt");
    } catch (error) {
      logMessage(refs.logArea, `Không nạp được MediaPipe: ${error.message}`);
    }
    refs.copySessionBtn?.addEventListener("click", async () => {
        if (!state.sessionId) return;
        await copyToClipboard(state.sessionId, `Đã copy mã phiên: ${state.sessionId}`);
      });
    
      refs.copySessionLinkBtn?.addEventListener("click", async () => {
        if (!state.sessionId) return;
        const joinUrl = getPhoneJoinUrl(state.sessionId);
        await copyToClipboard(joinUrl, "Đã copy link kết nối điện thoại");
      });
    refs.useLocalCameraBtn.addEventListener("click", switchToLocalMode);
    refs.usePhoneCameraBtn.addEventListener("click", switchToPhoneMode);
  
    refs.btnOpen.addEventListener("click", handleOpenCamera);
    refs.btnCapture.addEventListener("click", handleCapture);
    refs.btnRetake.addEventListener("click", handleRetake);
    refs.btnStop.addEventListener("click", handleStopCamera);
    refs.btnRandom.addEventListener("click", handleRandomPick);
    refs.backDashboardBtn?.addEventListener("click", goBackDashboard);
    refs.facePopupClose.addEventListener("click", () => closeFacePopup(refs));
    refs.facePopupOverlay.addEventListener("click", (event) => {
      if (event.target === refs.facePopupOverlay) {
        closeFacePopup(refs);
      }
    });
  
    renderAll();
  }
  
  window.addEventListener("beforeunload", async () => {
    try {
      await cleanupLocalStream();
      await cleanupPhoneMode();
    } catch (_) {}
  });
  
  bootstrap();