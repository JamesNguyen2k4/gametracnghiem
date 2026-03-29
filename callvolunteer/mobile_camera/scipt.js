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
  status: document.getElementById("mobileStatus")
};

const state = {
  sessionId: "",
  signaling: null,
  peer: null,
  stream: null,
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
      facingMode: state.facingMode
    },
    audio: false
  });

  state.stream = stream;
  refs.preview.srcObject = stream;
  await refs.preview.play();

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
    } else {
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

initPhoneConnection();