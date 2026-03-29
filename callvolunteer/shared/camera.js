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
  
  export function captureFrame(videoEl, canvasEl) {
    const videoWidth = videoEl.videoWidth || videoEl.clientWidth;
    const videoHeight = videoEl.videoHeight || videoEl.clientHeight;
  
    if (!videoWidth || !videoHeight) {
      throw new Error("Không lấy được khung hình từ camera.");
    }
  
    canvasEl.width = videoWidth;
    canvasEl.height = videoHeight;
  
    const ctx = canvasEl.getContext("2d");
    ctx.clearRect(0, 0, videoWidth, videoHeight);
    ctx.drawImage(videoEl, 0, 0, videoWidth, videoHeight);
  
    return {
      width: videoWidth,
      height: videoHeight
    };
  }