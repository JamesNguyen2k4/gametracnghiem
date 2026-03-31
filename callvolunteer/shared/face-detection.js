let cvReadyPromise = null;
let detector = null;
let detectorReady = false;
let modelReadyPromise = null;

const MODEL_URL = "../models/face_detection_yunet_2023mar.onnx";
const MODEL_NAME = "face_detection_yunet_2023mar.onnx";

const SCORE_THRESHOLD = 0.75;
const NMS_THRESHOLD = 0.3;
const TOP_K = 5000;

function waitForOpenCv() {
  if (cvReadyPromise) return cvReadyPromise;

  cvReadyPromise = new Promise((resolve, reject) => {
    const start = Date.now();

    const timer = setInterval(() => {
      const cv = window.cv;

      console.log("[waitForOpenCv] cv =", !!cv, "Mat =", typeof cv?.Mat);

      if (cv && typeof cv.Mat === "function") {
        clearInterval(timer);
        resolve(true);
        return;
      }

      if (Date.now() - start > 15000) {
        clearInterval(timer);
        reject(new Error("OpenCV.js không sẵn sàng sau 15 giây."));
      }
    }, 100);
  });

  return cvReadyPromise;
}

async function ensureModelInFs() {
  if (modelReadyPromise) return modelReadyPromise;

  modelReadyPromise = (async () => {
    await waitForOpenCv();
    const cv = window.cv;

    console.log("[YuNet] loading model from URL:", MODEL_URL);

    const response = await fetch(MODEL_URL);
    if (!response.ok) {
      throw new Error(`Không tải được model: HTTP ${response.status}`);
    }

    const bytes = new Uint8Array(await response.arrayBuffer());
    console.log("[YuNet] model bytes =", bytes.length);

    // Xóa file cũ nếu đã tồn tại
    try {
      cv.FS_unlink(`/${MODEL_NAME}`);
    } catch (_) {}

    cv.FS_createDataFile("/", MODEL_NAME, bytes, true, false, false);
    console.log("[YuNet] model written to FS as", MODEL_NAME);

    return MODEL_NAME;
  })();

  return modelReadyPromise;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function mapDetectionRow(data32F, i, imageWidth, imageHeight, index) {
  const x = data32F[i];
  const y = data32F[i + 1];
  const width = data32F[i + 2];
  const height = data32F[i + 3];
  const score = data32F[i + 14];

  if (
    !Number.isFinite(x) ||
    !Number.isFinite(y) ||
    !Number.isFinite(width) ||
    !Number.isFinite(height)
  ) {
    return null;
  }

  if (!Number.isFinite(score) || score < SCORE_THRESHOLD) {
    return null;
  }

  const left = clamp(x, 0, imageWidth - 1);
  const top = clamp(y, 0, imageHeight - 1);
  const right = clamp(x + width, 0, imageWidth - 1);
  const bottom = clamp(y + height, 0, imageHeight - 1);

  const boxWidth = right - left;
  const boxHeight = bottom - top;

  if (boxWidth <= 1 || boxHeight <= 1) {
    return null;
  }

  return {
    id: `face_${index + 1}`,
    label: `Khuôn mặt ${index + 1}`,
    box: {
      x: left,
      y: top,
      width: boxWidth,
      height: boxHeight
    },
    score
  };
}

function explainOpenCvError(cv, err) {
  try {
    if (typeof err === "number" && cv?.exceptionFromPtr) {
      const e = cv.exceptionFromPtr(err);
      return e?.msg || `OpenCV exception ptr: ${err}`;
    }
  } catch (_) {}

  return err?.message || String(err);
}

export async function initFaceDetector() {
  console.log("[YuNet] initFaceDetector start");

  if (detectorReady && detector) {
    console.log("[YuNet] reuse detector");
    return detector;
  }

  await waitForOpenCv();
  const cv = window.cv;

  console.log("[YuNet] OpenCV ready", !!cv);
  console.log("[YuNet] typeof cv.FaceDetectorYN =", typeof cv?.FaceDetectorYN);

  if (!cv?.FaceDetectorYN) {
    throw new Error("OpenCV.js hiện tại chưa hỗ trợ FaceDetectorYN.");
  }

  const modelName = await ensureModelInFs();
  const inputSize = new cv.Size(320, 320);

  try {
    console.log("[YuNet] try constructor with FS model:", modelName);
    detector = new cv.FaceDetectorYN(
      modelName,
      "",
      inputSize,
      SCORE_THRESHOLD,
      NMS_THRESHOLD,
      TOP_K
    );
  } catch (err) {
    const msg = explainOpenCvError(cv, err);
    console.error("[YuNet] constructor failed:", msg);
    throw new Error(`Khởi tạo YuNet thất bại: ${msg}`);
  }

  console.log("[YuNet] detector created", detector);

  detectorReady = true;
  return detector;
}

export async function detectFaces(sourceCanvasEl) {
  console.log("[YuNet] detectFaces start");

  await waitForOpenCv();
  const cv = window.cv;
  const faceDetector = await initFaceDetector();

  let src = null;
  let resized = null;
  let bgr = null;
  let out = null;

  try {
    console.log("[YuNet] before cv.imread");
    src = cv.imread(sourceCanvasEl);
    console.log("[YuNet] after cv.imread", src.cols, src.rows, "channels =", src.channels());

    resized = new cv.Mat();

    const maxWidth = 640;
    if (src.cols > maxWidth) {
      const newHeight = Math.round((src.rows * maxWidth) / src.cols);
      cv.resize(src, resized, new cv.Size(maxWidth, newHeight));
    } else {
      resized = src.clone();
    }

    console.log("[YuNet] resized size", resized.cols, resized.rows, "channels =", resized.channels());

    // Chuyển RGBA -> BGR
    bgr = new cv.Mat();
    if (resized.channels() === 4) {
      cv.cvtColor(resized, bgr, cv.COLOR_RGBA2BGR);
    } else if (resized.channels() === 3) {
      bgr = resized.clone();
    } else if (resized.channels() === 1) {
      cv.cvtColor(resized, bgr, cv.COLOR_GRAY2BGR);
    } else {
      throw new Error(`Số kênh ảnh không hỗ trợ: ${resized.channels()}`);
    }

    console.log("[YuNet] bgr size", bgr.cols, bgr.rows, "channels =", bgr.channels());

    faceDetector.setInputSize(new cv.Size(bgr.cols, bgr.rows));
    console.log("[YuNet] after setInputSize");

    out = new cv.Mat();

    console.log("[YuNet] before detect");
    faceDetector.detect(bgr, out);
    console.log("[YuNet] after detect");

    const faces = [];
    const data = out.data32F || [];
    console.log("[YuNet] output length =", data.length);

    const scaleX = src.cols / resized.cols;
    const scaleY = src.rows / resized.rows;

    for (let i = 0, row = 0; i < data.length; i += 15, row += 1) {
      const scaled = new Float32Array(15);
      scaled.set(data.slice(i, i + 15));

      scaled[0] *= scaleX;
      scaled[1] *= scaleY;
      scaled[2] *= scaleX;
      scaled[3] *= scaleY;

      const face = mapDetectionRow(scaled, 0, src.cols, src.rows, row);
      if (face) faces.push(face);
    }

    console.log("[YuNet] faces parsed =", faces.length);
    return faces;
  } catch (error) {
    console.error("[YuNet] detectFaces error", error);

    let detail = error?.message || String(error);
    try {
      if (typeof error === "number" && cv?.exceptionFromPtr) {
        const e = cv.exceptionFromPtr(error);
        detail = e?.msg || `OpenCV exception ptr: ${error}`;
      }
    } catch (_) {}

    throw new Error(`YuNet detect lỗi: ${detail}`);
  } finally {
    if (src) src.delete();
    if (resized) resized.delete();
    if (bgr) bgr.delete();
    if (out) out.delete();
  }
}