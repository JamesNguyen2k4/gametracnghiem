import { createSignalingChannel } from "../shared/signaling.js";
import {
  createPeerConnection,
  addLocalStream,
  createOffer,
  setRemoteDescription,
  addIceCandidate,
  closePeerConnection
} from "../shared/remote-camera.js";

const refs = {
  preview: document.getElementById("mobilePreview"),
  sessionText: document.getElementById("mobileSessionText"),
  startBtn: document.getElementById("startPhoneCameraBtn"),
  switchBtn: document.getElementById("switchCameraBtn"),
  status: document.getElementById("mobileStatus"),
  rotateBtn: document.getElementById("rotatePhoneBtn")
};

const state = {
  sessionId: "",
  signaling: null,
  peer: null,
  stream: null,
  manualRotation: 0,
  facingMode: "environment"
};

function setMobileStatus(text) {
  refs.status.textContent = text;
  console.log("[mobile status]", text);
}

function getSessionId() {
  const params = new URLSearchParams(window.location.search);
  return (params.get("session") || "").trim().toUpperCase();
}
function getRotationDegrees() {
  return state.manualRotation;
}
async function sendOrientationUpdate() {
  if (!state.signaling) return;

  const rotation = getRotationDegrees();

  try {
    await state.signaling.send({
      type: "orientation",
      from: "phone",
      payload: { rotation }
    });
    console.log("[mobile] sent orientation:", rotation);
  } catch (error) {
    console.warn("[mobile] send orientation failed:", error);
  }
}
async function boostSenderBitrate(pc) {
  if (!pc) return;

  const senders = pc.getSenders().filter((sender) => sender.track && sender.track.kind === "video");

  for (const sender of senders) {
    try {
      const params = sender.getParameters();
      if (!params.encodings || !params.encodings.length) {
        params.encodings = [{}];
      }

      params.encodings[0].maxBitrate = 2500000;
      params.encodings[0].scaleResolutionDownBy = 1.0;
      params.encodings[0].maxFramerate = 30;

      await sender.setParameters(params);
    } catch (error) {
      console.warn("boostSenderBitrate error:", error);
    }
  }
}

async function startPhoneCamera() {
  if (!window.isSecureContext) {
    throw new Error("Trang này chưa chạy trong HTTPS hoặc secure context.");
  }

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new Error("Trình duyệt không hỗ trợ truy cập camera.");
  }

  if (state.stream) {
    state.stream.getTracks().forEach((track) => track.stop());
    state.stream = null;
  }

  const stream = await navigator.mediaDevices.getUserMedia({
    video: {
      facingMode: state.facingMode,
      width: { ideal: 1920, max: 1920 },
      height: { ideal: 1080, max: 1080 },
      frameRate: { ideal: 30, max: 30 }
    },
    audio: false
  });

  state.stream = stream;
  refs.preview.srcObject = stream;
  await refs.preview.play();

  const track = stream.getVideoTracks()[0];
  if (track) {
    console.log("camera settings:", track.getSettings());
    track.contentHint = "detail";
  }

  setMobileStatus("Camera đã bật");
}

async function ensurePeerConnection() {
  if (state.peer) {
    closePeerConnection(state.peer);
    state.peer = null;
  }

  state.peer = createPeerConnection({
    onIceCandidate: async (candidate) => {
      if (!state.signaling) return;

      await state.signaling.send({
        type: "candidate",
        from: "phone",
        payload: { candidate }
      });
    }
  });

  if (state.stream) {
    await addLocalStream(state.peer, state.stream);
    await boostSenderBitrate(state.peer);
  }
}

async function handlePhoneSignal(message) {
  if (!message || message.from === "phone") return;

  try {
    if (message.type === "answer") {
      await setRemoteDescription(state.peer, message.payload.sdp);
      setMobileStatus("Đã kết nối với máy tính");
      return;
    }

    if (message.type === "candidate") {
      await addIceCandidate(state.peer, message.payload.candidate);
    }
  } catch (error) {
    console.error("handlePhoneSignal error:", error);
    setMobileStatus(`Lỗi signaling: ${error.message}`);
  }
}
refs.rotateBtn?.addEventListener("click", async () => {
  state.manualRotation = (state.manualRotation + 90) % 360;
  setMobileStatus(`Góc xoay hiện tại: ${state.manualRotation}°`);
  await sendOrientationUpdate();
});
async function initPhoneConnection() {
  state.sessionId = getSessionId();
  refs.sessionText.textContent = state.sessionId || "----";

  if (!state.sessionId) {
    setMobileStatus("Thiếu mã phiên. Hãy mở đúng link từ máy tính.");
    refs.startBtn.disabled = true;
    refs.switchBtn.disabled = true;
    return;
  }

  if (!window.supabaseClient) {
    setMobileStatus("Thiếu cấu hình Supabase trên điện thoại.");
    refs.startBtn.disabled = true;
    refs.switchBtn.disabled = true;
    return;
  }

  state.signaling = createSignalingChannel(
    window.supabaseClient,
    state.sessionId,
    handlePhoneSignal
  );

  await state.signaling.subscribe();
  setMobileStatus("Đã vào phiên, hãy bấm Bật camera");
}

async function connectPhoneToLaptop() {
  await ensurePeerConnection();

  const offer = await createOffer(state.peer);

  await state.signaling.send({
    type: "offer",
    from: "phone",
    payload: { sdp: offer }
  });

  await sendOrientationUpdate();

  setMobileStatus("Đã gửi yêu cầu kết nối tới máy tính");
}

refs.startBtn.addEventListener("click", async () => {
  try {
    refs.startBtn.disabled = true;
    setMobileStatus("Đang bật camera...");

    await startPhoneCamera();
    await connectPhoneToLaptop();

    refs.startBtn.disabled = false;
  } catch (error) {
    console.error("start camera error:", error);
    refs.startBtn.disabled = false;
    setMobileStatus(`Không bật được camera: ${error.message}`);
  }
});

refs.switchBtn.addEventListener("click", async () => {
  try {
    state.facingMode =
      state.facingMode === "environment" ? "user" : "environment";

    setMobileStatus("Đang đổi camera...");
    await startPhoneCamera();

    if (state.peer) {
      await connectPhoneToLaptop();
      await sendOrientationUpdate();
    } else {
      await sendOrientationUpdate();
      setMobileStatus("Đã đổi camera");
    }
  } catch (error) {
    console.error("switch camera error:", error);
    setMobileStatus(`Không đổi được camera: ${error.message}`);
  }
});

window.addEventListener("beforeunload", async () => {
  try {
    if (state.stream) {
      state.stream.getTracks().forEach((track) => track.stop());
    }
    if (state.peer) {
      closePeerConnection(state.peer);
    }
    if (state.signaling) {
      await state.signaling.unsubscribe();
    }
  } catch (_) {}
});
window.addEventListener("orientationchange", () => {
  sendOrientationUpdate();
});

window.screen?.orientation?.addEventListener?.("change", () => {
  sendOrientationUpdate();
});
initPhoneConnection();