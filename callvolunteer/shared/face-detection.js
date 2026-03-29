let detector = null;
let detectorReady = false;

function getMediaPipeFaceDetectionClass() {
  const FaceDetectionClass = window.FaceDetection;
  if (!FaceDetectionClass) {
    throw new Error("MediaPipe Face Detection chưa được nạp.");
  }
  return FaceDetectionClass;
}

export async function initFaceDetector() {
  if (detectorReady && detector) {
    return detector;
  }

  const FaceDetectionClass = getMediaPipeFaceDetectionClass();

  detector = new FaceDetectionClass({
    locateFile: (file) =>
      `https://cdn.jsdelivr.net/npm/@mediapipe/face_detection@0.4.1646425229/${file}`
  });

  detector.setOptions({
    model: "short",
    minDetectionConfidence: 0.5
  });

  detectorReady = true;
  return detector;
}

function normalizeBoundingBox(detection, imageWidth, imageHeight) {
  const box = detection?.boundingBox || {};

  if (
    typeof box.xCenter === "number" &&
    typeof box.yCenter === "number" &&
    typeof box.width === "number" &&
    typeof box.height === "number"
  ) {
    const width = box.width * imageWidth;
    const height = box.height * imageHeight;
    const x = box.xCenter * imageWidth - width / 2;
    const y = box.yCenter * imageHeight - height / 2;

    return { x, y, width, height };
  }

  if (
    typeof box.xmin === "number" &&
    typeof box.ymin === "number" &&
    typeof box.width === "number" &&
    typeof box.height === "number"
  ) {
    return {
      x: box.xmin * imageWidth,
      y: box.ymin * imageHeight,
      width: box.width * imageWidth,
      height: box.height * imageHeight
    };
  }

  return null;
}

export async function detectFaces(sourceCanvasEl) {
  const instance = await initFaceDetector();

  return new Promise(async (resolve, reject) => {
    try {
      instance.onResults((results) => {
        const detections = Array.isArray(results?.detections)
          ? results.detections
          : [];

        const faces = detections
          .map((detection, index) => {
            const box = normalizeBoundingBox(
              detection,
              sourceCanvasEl.width,
              sourceCanvasEl.height
            );

            if (!box) return null;

            return {
              id: `face_${index + 1}`,
              label: `Khuôn mặt ${index + 1}`,
              box
            };
          })
          .filter(Boolean);

        resolve(faces);
      });

      await instance.send({ image: sourceCanvasEl });
    } catch (error) {
      reject(error);
    }
  });
}