/**
 * OpenCV-based emotion detection engine.
 *
 * Uses Haar cascades for face/eye/smile detection, then classifies
 * learning-relevant emotions from detected features + temporal analysis.
 */

const CASCADE_BASE =
  "https://raw.githubusercontent.com/opencv/opencv/4.x/data/haarcascades";

const CASCADE_URLS = {
  face: `${CASCADE_BASE}/haarcascade_frontalface_default.xml`,
  eye: `${CASCADE_BASE}/haarcascade_eye.xml`,
  smile: `${CASCADE_BASE}/haarcascade_smile.xml`,
};

export interface FaceAnalysis {
  faceRect: { x: number; y: number; w: number; h: number };
  hasSmile: boolean;
  smileIntensity: number; // 0-1
  eyeOpenness: number; // ratio: higher = more open
  eyeCount: number;
  expressionVariance: number; // pixel variance in face region
  motionLevel: number; // 0-1, how much the face moved
}

export class OpenCVEmotionEngine {
  private faceCascade: cv.CascadeClassifier | null = null;
  private eyeCascade: cv.CascadeClassifier | null = null;
  private smileCascade: cv.CascadeClassifier | null = null;
  private prevGray: cv.Mat | null = null;
  private prevFaceRect: { x: number; y: number; w: number; h: number } | null =
    null;
  private frameCount = 0;
  private loaded = false;

  async load(): Promise<void> {
    if (this.loaded) return;

    // Wait for OpenCV to be ready
    await this.waitForOpenCV();

    // Load cascade files
    await Promise.all([
      this.loadCascade("face", CASCADE_URLS.face),
      this.loadCascade("eye", CASCADE_URLS.eye),
      this.loadCascade("smile", CASCADE_URLS.smile),
    ]);

    this.faceCascade = new cv.CascadeClassifier();
    this.faceCascade.load("haarcascade_frontalface_default.xml");

    this.eyeCascade = new cv.CascadeClassifier();
    this.eyeCascade.load("haarcascade_eye.xml");

    this.smileCascade = new cv.CascadeClassifier();
    this.smileCascade.load("haarcascade_smile.xml");

    this.loaded = true;
  }

  private waitForOpenCV(): Promise<void> {
    return new Promise((resolve, reject) => {
      const check = (attempts: number) => {
        if (typeof cv !== "undefined" && cv.Mat) {
          resolve();
        } else if (attempts > 100) {
          reject(new Error("OpenCV failed to load"));
        } else {
          setTimeout(() => check(attempts + 1), 100);
        }
      };
      check(0);
    });
  }

  private async loadCascade(name: string, url: string): Promise<void> {
    const response = await fetch(url);
    if (!response.ok)
      throw new Error(`Failed to fetch cascade: ${name}`);
    const buffer = await response.arrayBuffer();
    const data = new Uint8Array(buffer);

    const fileName = url.split("/").pop()!;
    cv.FS_createDataFile("/", fileName, data, true, false, true);
  }

  /**
   * Analyze a video frame and return face/emotion features.
   */
  analyzeFrame(video: HTMLVideoElement): FaceAnalysis | null {
    if (!this.loaded || !this.faceCascade) return null;

    this.frameCount++;

    // Capture frame from video
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(video, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    const src = cv.matFromImageData(imageData);
    const gray = new cv.Mat();
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    cv.equalizeHist(gray, gray);

    // Detect faces
    const faces = new cv.RectVector();
    this.faceCascade.detectMultiScale(
      gray,
      faces,
      1.1,
      4,
      0,
      new cv.Size(30, 30)
    );

    if (faces.size() === 0) {
      // Cleanup
      src.delete();
      gray.delete();
      faces.delete();
      return null;
    }

    // Use largest face
    let bestFace = faces.get(0);
    for (let i = 1; i < faces.size(); i++) {
      const f = faces.get(i);
      if (f.width * f.height > bestFace.width * bestFace.height) {
        bestFace = f;
      }
    }

    const faceRect = {
      x: bestFace.x,
      y: bestFace.y,
      w: bestFace.width,
      h: bestFace.height,
    };

    // Extract face ROI
    const faceROI = gray.roi(
      new cv.Rect(faceRect.x, faceRect.y, faceRect.w, faceRect.h)
    );

    // --- Smile detection ---
    const smileResult = this.detectSmile(faceROI, faceRect);

    // --- Eye detection ---
    const eyeResult = this.detectEyes(faceROI, faceRect);

    // --- Expression variance (how expressive the face is) ---
    const expressionVariance = this.computeExpressionVariance(faceROI);

    // --- Motion detection ---
    const motionLevel = this.computeMotion(gray, faceRect);

    // Store previous frame
    if (this.prevGray) this.prevGray.delete();
    this.prevGray = gray.clone();
    this.prevFaceRect = { ...faceRect };

    // Cleanup
    src.delete();
    gray.delete();
    faceROI.delete();
    faces.delete();

    return {
      faceRect,
      hasSmile: smileResult.detected,
      smileIntensity: smileResult.intensity,
      eyeOpenness: eyeResult.openness,
      eyeCount: eyeResult.count,
      expressionVariance,
      motionLevel,
    };
  }

  /**
   * Detect smile in the lower half of the face.
   */
  private detectSmile(
    faceROI: cv.Mat,
    faceRect: { w: number; h: number }
  ): { detected: boolean; intensity: number } {
    if (!this.smileCascade)
      return { detected: false, intensity: 0 };

    // Only search in the lower 40% of the face (mouth region)
    const mouthY = Math.floor(faceRect.h * 0.6);
    const mouthH = faceRect.h - mouthY;
    const mouthROI = faceROI.roi(
      new cv.Rect(0, mouthY, faceRect.w, mouthH)
    );

    const smiles = new cv.RectVector();
    this.smileCascade.detectMultiScale(
      mouthROI,
      smiles,
      1.7,
      22,
      0,
      new cv.Size(25, 15)
    );

    const detected = smiles.size() > 0;
    // Intensity based on number of detections (more = more confident) and size
    let intensity = 0;
    if (detected) {
      const smile = smiles.get(0);
      intensity = Math.min(1, (smile.width / faceRect.w) * 1.5);
    }

    mouthROI.delete();
    smiles.delete();

    return { detected, intensity };
  }

  /**
   * Detect eyes in the upper half of the face.
   */
  private detectEyes(
    faceROI: cv.Mat,
    faceRect: { w: number; h: number }
  ): { count: number; openness: number } {
    if (!this.eyeCascade) return { count: 0, openness: 0.5 };

    // Only search in the upper 60% of the face
    const eyeH = Math.floor(faceRect.h * 0.6);
    const eyeROI = faceROI.roi(new cv.Rect(0, 0, faceRect.w, eyeH));

    const eyes = new cv.RectVector();
    this.eyeCascade.detectMultiScale(
      eyeROI,
      eyes,
      1.1,
      5,
      0,
      new cv.Size(20, 20)
    );

    const count = Math.min(eyes.size(), 2);

    // Eye openness: ratio of eye height to face height
    let openness = 0.5;
    if (count > 0) {
      let totalHeight = 0;
      for (let i = 0; i < count; i++) {
        totalHeight += eyes.get(i).height;
      }
      const avgHeight = totalHeight / count;
      openness = Math.min(1, (avgHeight / faceRect.h) * 5);
    }

    eyeROI.delete();
    eyes.delete();

    return { count, openness };
  }

  /**
   * Compute pixel intensity variance in the face region.
   * Higher variance = more expression/texture = more animated face.
   */
  private computeExpressionVariance(faceROI: cv.Mat): number {
    const mean = new cv.Mat();
    const stddev = new cv.Mat();
    cv.meanStdDev(faceROI, mean, stddev);

    // OpenCV.js stores meanStdDev results in data64F (Float64Array)
    let variance = 40;
    try {
      if (stddev.data64F && stddev.data64F.length > 0) {
        variance = stddev.data64F[0];
      } else if (stddev.data32F && stddev.data32F.length > 0) {
        variance = stddev.data32F[0];
      }
    } catch {
      variance = 40;
    }

    mean.delete();
    stddev.delete();

    // Normalize: typical stddev range for a face is 30-60
    return Math.min(1, Math.max(0, (variance - 25) / 40));
  }

  /**
   * Compute motion between frames using frame differencing.
   */
  private computeMotion(
    currentGray: cv.Mat,
    currentFaceRect: { x: number; y: number; w: number; h: number }
  ): number {
    if (!this.prevGray || !this.prevFaceRect) return 0.3;

    try {
      // Position-based motion (how much did the face move?)
      const dx = Math.abs(currentFaceRect.x - this.prevFaceRect.x);
      const dy = Math.abs(currentFaceRect.y - this.prevFaceRect.y);
      const posMotion = Math.min(
        1,
        (dx + dy) / (currentFaceRect.w * 0.3)
      );

      // Pixel-based motion in face region
      const currFace = currentGray.roi(
        new cv.Rect(
          currentFaceRect.x,
          currentFaceRect.y,
          currentFaceRect.w,
          currentFaceRect.h
        )
      );

      // Resize previous gray to match if dimensions differ
      const prevResized = new cv.Mat();
      cv.resize(
        this.prevGray,
        prevResized,
        new cv.Size(currentGray.cols, currentGray.rows)
      );

      const prevFace = prevResized.roi(
        new cv.Rect(
          currentFaceRect.x,
          currentFaceRect.y,
          currentFaceRect.w,
          currentFaceRect.h
        )
      );

      const diff = new cv.Mat();
      cv.absdiff(currFace, prevFace, diff);

      const thresh = new cv.Mat();
      cv.threshold(diff, thresh, 25, 255, cv.THRESH_BINARY);

      const pixelMotion =
        cv.countNonZero(thresh) /
        (currentFaceRect.w * currentFaceRect.h);

      currFace.delete();
      prevFace.delete();
      prevResized.delete();
      diff.delete();
      thresh.delete();

      return Math.min(1, posMotion * 0.4 + pixelMotion * 2);
    } catch {
      return 0.3;
    }
  }

  /**
   * Draw detection overlay on canvas.
   */
  drawOverlay(
    canvas: HTMLCanvasElement,
    analysis: FaceAnalysis,
    videoWidth: number,
    videoHeight: number,
    learningState: string,
    engagementScore: number
  ): void {
    canvas.width = videoWidth;
    canvas.height = videoHeight;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const { faceRect } = analysis;

    // Face rectangle color based on learning state
    const stateColors: Record<string, string> = {
      engaged: "#10b981",
      delighted: "#3b82f6",
      confused: "#f59e0b",
      frustrated: "#ef4444",
      bored: "#6b7280",
    };
    const color = stateColors[learningState] || "#6366f1";

    // Draw face rectangle with rounded corners
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.shadowColor = color;
    ctx.shadowBlur = 10;

    // Mirror the x coordinate since video is mirrored
    const mx = videoWidth - faceRect.x - faceRect.w;

    // Corner lines instead of full rectangle (looks more techy)
    const cornerLen = Math.min(faceRect.w, faceRect.h) * 0.2;
    this.drawCorners(ctx, mx, faceRect.y, faceRect.w, faceRect.h, cornerLen);

    // Engagement arc
    ctx.shadowBlur = 0;
    const centerX = mx + faceRect.w / 2;
    const centerY = faceRect.y - 15;
    const radius = faceRect.w * 0.35;

    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, Math.PI, 2 * Math.PI, false);
    ctx.strokeStyle = "#333";
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.beginPath();
    const endAngle = Math.PI + (engagementScore / 100) * Math.PI;
    ctx.arc(centerX, centerY, radius, Math.PI, endAngle, false);
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.stroke();

    // Score text
    ctx.fillStyle = color;
    ctx.font = "bold 11px monospace";
    ctx.textAlign = "center";
    ctx.fillText(`${engagementScore}%`, centerX, centerY + 4);

    // Smile indicator
    if (analysis.hasSmile) {
      ctx.fillStyle = "#10b981";
      ctx.font = "16px sans-serif";
      ctx.fillText("😊", mx + faceRect.w + 8, faceRect.y + 20);
    }
  }

  private drawCorners(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    len: number
  ): void {
    // Top-left
    ctx.beginPath();
    ctx.moveTo(x, y + len);
    ctx.lineTo(x, y);
    ctx.lineTo(x + len, y);
    ctx.stroke();
    // Top-right
    ctx.beginPath();
    ctx.moveTo(x + w - len, y);
    ctx.lineTo(x + w, y);
    ctx.lineTo(x + w, y + len);
    ctx.stroke();
    // Bottom-left
    ctx.beginPath();
    ctx.moveTo(x, y + h - len);
    ctx.lineTo(x, y + h);
    ctx.lineTo(x + len, y + h);
    ctx.stroke();
    // Bottom-right
    ctx.beginPath();
    ctx.moveTo(x + w - len, y + h);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x + w, y + h - len);
    ctx.stroke();
  }

  destroy(): void {
    this.faceCascade?.delete();
    this.eyeCascade?.delete();
    this.smileCascade?.delete();
    this.prevGray?.delete();
    this.faceCascade = null;
    this.eyeCascade = null;
    this.smileCascade = null;
    this.prevGray = null;
    this.loaded = false;
  }
}
