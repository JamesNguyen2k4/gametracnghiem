export async function startCamera(videoEl) {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("Trình duyệt không hỗ trợ camera.");
    }
  
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: "user"
      },
      audio: false
    });
  
    videoEl.srcObject = stream;
    await videoEl.play();
    return stream;
  }
  
  export function stopCamera(videoEl, stream) {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }
  
    videoEl.pause();
    videoEl.srcObject = null;
  }
  
  export function captureFrame(videoEl, canvasEl, options = {}) {
    const {
      rotation = 0,
      mirror = false
    } = options;
  
    const videoWidth = videoEl.videoWidth || videoEl.clientWidth;
    const videoHeight = videoEl.videoHeight || videoEl.clientHeight;
  
    if (!videoWidth || !videoHeight) {
      throw new Error("Không lấy được khung hình từ camera.");
    }
  
    const normalizedRotation = ((rotation % 360) + 360) % 360;
    const swapSides = normalizedRotation === 90 || normalizedRotation === 270;
  
    canvasEl.width = swapSides ? videoHeight : videoWidth;
    canvasEl.height = swapSides ? videoWidth : videoHeight;
  
    const ctx = canvasEl.getContext("2d");
    ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
  
    ctx.save();
  
    // Xoay canvas trước
    if (normalizedRotation === 90) {
      ctx.translate(canvasEl.width, 0);
      ctx.rotate(Math.PI / 2);
    } else if (normalizedRotation === 180) {
      ctx.translate(canvasEl.width, canvasEl.height);
      ctx.rotate(Math.PI);
    } else if (normalizedRotation === 270) {
      ctx.translate(0, canvasEl.height);
      ctx.rotate(-Math.PI / 2);
    }
  
    // Mirror nếu cần
    if (mirror) {
      ctx.translate(videoWidth, 0);
      ctx.scale(-1, 1);
    }
  
    ctx.drawImage(videoEl, 0, 0, videoWidth, videoHeight);
    ctx.restore();
  
    return {
      width: canvasEl.width,
      height: canvasEl.height
    };
  }