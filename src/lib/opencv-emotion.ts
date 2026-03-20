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
  smileIntensity: number;
  eyeOpenness: number;
  eyeCount: number;
  expressionVariance: number;
  motionLevel: number;
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
  private loadError: string | null = null;

  async load(): Promise<void> {
    if (this.loaded) return;
    if (this.loadError) throw new Error(this.loadError);

    try {
      console.log("[OpenCV] Waiting for OpenCV.js runtime...");
      await this.waitForOpenCV();
      console.log("[OpenCV] Runtime ready.");

      // Load cascade files into virtual filesystem
      console.log("[OpenCV] Fetching cascade files...");
      await Promise.all([
        this.loadCascade("face", CASCADE_URLS.face),
        this.loadCascade("eye", CASCADE_URLS.eye),
        this.loadCascade("smile", CASCADE_URLS.smile),
      ]);
      console.log("[OpenCV] Cascade files loaded into FS.");

      // Create classifiers
      this.faceCascade = new cv.CascadeClassifier();
      const faceLoaded = this.faceCascade.load("haarcascade_frontalface_default.xml");
      console.log("[OpenCV] Face cascade loaded:", faceLoaded);

      this.eyeCascade = new cv.CascadeClassifier();
      const eyeLoaded = this.eyeCascade.load("haarcascade_eye.xml");
      console.log("[OpenCV] Eye cascade loaded:", eyeLoaded);

      this.smileCascade = new cv.CascadeClassifier();
      const smileLoaded = this.smileCascade.load("haarcascade_smile.xml");
      console.log("[OpenCV] Smile cascade loaded:", smileLoaded);

      if (!faceLoaded) {
        throw new Error("Face cascade classifier failed to load");
      }

      this.loaded = true;
      console.log("[OpenCV] Engine fully initialized.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.loadError = msg;
      console.error("[OpenCV] Load failed:", msg);
      throw err;
    }
  }

  private waitForOpenCV(): Promise<void> {
    return new Promise((resolve, reject) => {
      const check = (attempts: number) => {
        if (typeof cv !== "undefined" && cv.Mat) {
          resolve();
        } else if (attempts > 150) {
          reject(new Error("OpenCV.js failed to load after 15s"));
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
      throw new Error(`Failed to fetch cascade ${name}: ${response.status}`);

    // Load as text — OpenCV.js FS_createDataFile works more reliably with string data
    const text = await response.text();
    const fileName = url.split("/").pop()!;

    try {
      cv.FS_createDataFile("/", fileName, text, true, false, false);
      console.log(`[OpenCV] Wrote ${fileName} to virtual FS (${text.length} bytes)`);
    } catch (err) {
      // File might already exist from a previous load attempt
      console.warn(`[OpenCV] FS_createDataFile ${fileName}:`, err);
    }
  }

  /**
   * Analyze a video frame and return face/emotion features.
   */
  analyzeFrame(video: HTMLVideoElement): FaceAnalysis | null {
    if (!this.loaded || !this.faceCascade) return null;
    if (video.videoWidth === 0 || video.videoHeight === 0) return null;

    this.frameCount++;

    // Capture frame from video
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(video, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    let src: cv.Mat | null = null;
    let gray: cv.Mat | null = null;
    let faces: cv.RectVector | null = null;
    let faceROI: cv.Mat | null = null;

    try {
      src = cv.matFromImageData(imageData);
      gray = new cv.Mat();
      cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
      cv.equalizeHist(gray, gray);

      // Detect faces — use small min size relative to frame
      faces = new cv.RectVector();
      const minFaceSize = Math.max(20, Math.floor(Math.min(video.videoWidth, video.videoHeight) * 0.15));
      this.faceCascade.detectMultiScale(
        gray,
        faces,
        1.1,
        3,
        0,
        new cv.Size(minFaceSize, minFaceSize)
      );

      if (faces.size() === 0) {
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
      faceROI = gray.roi(
        new cv.Rect(faceRect.x, faceRect.y, faceRect.w, faceRect.h)
      );

      const smileResult = this.detectSmile(faceROI, faceRect);
      const eyeResult = this.detectEyes(faceROI, faceRect);
      const expressionVariance = this.computeExpressionVariance(faceROI);
      const motionLevel = this.computeMotion(gray, faceRect);

      // Store previous frame
      if (this.prevGray) this.prevGray.delete();
      this.prevGray = gray.clone();
      this.prevFaceRect = { ...faceRect };

      return {
        faceRect,
        hasSmile: smileResult.detected,
        smileIntensity: smileResult.intensity,
        eyeOpenness: eyeResult.openness,
        eyeCount: eyeResult.count,
        expressionVariance,
        motionLevel,
      };
    } catch (err) {
      console.error("[OpenCV] analyzeFrame error:", err);
      return null;
    } finally {
      // Always clean up OpenCV Mats
      src?.delete();
      gray?.delete();
      faces?.delete();
      faceROI?.delete();
    }
  }

  private detectSmile(
    faceROI: cv.Mat,
    faceRect: { w: number; h: number }
  ): { detected: boolean; intensity: number } {
    if (!this.smileCascade)
      return { detected: false, intensity: 0 };

    let mouthROI: cv.Mat | null = null;
    let smiles: cv.RectVector | null = null;
    try {
      const mouthY = Math.floor(faceRect.h * 0.6);
      const mouthH = faceRect.h - mouthY;
      mouthROI = faceROI.roi(new cv.Rect(0, mouthY, faceRect.w, mouthH));

      smiles = new cv.RectVector();
      this.smileCascade.detectMultiScale(
        mouthROI,
        smiles,
        1.7,
        22,
        0,
        new cv.Size(25, 15)
      );

      const detected = smiles.size() > 0;
      let intensity = 0;
      if (detected) {
        const smile = smiles.get(0);
        intensity = Math.min(1, (smile.width / faceRect.w) * 1.5);
      }
      return { detected, intensity };
    } catch {
      return { detected: false, intensity: 0 };
    } finally {
      mouthROI?.delete();
      smiles?.delete();
    }
  }

  private detectEyes(
    faceROI: cv.Mat,
    faceRect: { w: number; h: number }
  ): { count: number; openness: number } {
    if (!this.eyeCascade) return { count: 0, openness: 0.5 };

    let eyeROI: cv.Mat | null = null;
    let eyes: cv.RectVector | null = null;
    try {
      const eyeH = Math.floor(faceRect.h * 0.6);
      eyeROI = faceROI.roi(new cv.Rect(0, 0, faceRect.w, eyeH));

      eyes = new cv.RectVector();
      this.eyeCascade.detectMultiScale(
        eyeROI,
        eyes,
        1.1,
        5,
        0,
        new cv.Size(15, 15)
      );

      const count = Math.min(eyes.size(), 2);
      let openness = 0.5;
      if (count > 0) {
        let totalHeight = 0;
        for (let i = 0; i < count; i++) {
          totalHeight += eyes.get(i).height;
        }
        openness = Math.min(1, ((totalHeight / count) / faceRect.h) * 5);
      }
      return { count, openness };
    } catch {
      return { count: 0, openness: 0.5 };
    } finally {
      eyeROI?.delete();
      eyes?.delete();
    }
  }

  private computeExpressionVariance(faceROI: cv.Mat): number {
    let mean: cv.Mat | null = null;
    let stddev: cv.Mat | null = null;
    try {
      mean = new cv.Mat();
      stddev = new cv.Mat();
      cv.meanStdDev(faceROI, mean, stddev);

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

      return Math.min(1, Math.max(0, (variance - 25) / 40));
    } catch {
      return 0.5;
    } finally {
      mean?.delete();
      stddev?.delete();
    }
  }

  private computeMotion(
    currentGray: cv.Mat,
    currentFaceRect: { x: number; y: number; w: number; h: number }
  ): number {
    if (!this.prevGray || !this.prevFaceRect) return 0.3;

    let currFace: cv.Mat | null = null;
    let prevResized: cv.Mat | null = null;
    let prevFace: cv.Mat | null = null;
    let diff: cv.Mat | null = null;
    let thresh: cv.Mat | null = null;

    try {
      const posMotion = Math.min(
        1,
        (Math.abs(currentFaceRect.x - this.prevFaceRect.x) +
          Math.abs(currentFaceRect.y - this.prevFaceRect.y)) /
          (currentFaceRect.w * 0.3)
      );

      currFace = currentGray.roi(
        new cv.Rect(currentFaceRect.x, currentFaceRect.y, currentFaceRect.w, currentFaceRect.h)
      );

      prevResized = new cv.Mat();
      cv.resize(this.prevGray, prevResized, new cv.Size(currentGray.cols, currentGray.rows));

      prevFace = prevResized.roi(
        new cv.Rect(currentFaceRect.x, currentFaceRect.y, currentFaceRect.w, currentFaceRect.h)
      );

      diff = new cv.Mat();
      cv.absdiff(currFace, prevFace, diff);

      thresh = new cv.Mat();
      cv.threshold(diff, thresh, 25, 255, cv.THRESH_BINARY);

      const pixelMotion = cv.countNonZero(thresh) / (currentFaceRect.w * currentFaceRect.h);

      return Math.min(1, posMotion * 0.4 + pixelMotion * 2);
    } catch {
      return 0.3;
    } finally {
      currFace?.delete();
      prevResized?.delete();
      prevFace?.delete();
      diff?.delete();
      thresh?.delete();
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

    const stateColors: Record<string, string> = {
      engaged: "#10b981",
      delighted: "#3b82f6",
      confused: "#f59e0b",
      frustrated: "#ef4444",
      bored: "#6b7280",
    };
    const color = stateColors[learningState] || "#6366f1";

    // Mirror the x coordinate since video is mirrored
    const mx = videoWidth - faceRect.x - faceRect.w;

    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;

    // Corner brackets
    const cornerLen = Math.min(faceRect.w, faceRect.h) * 0.2;
    this.drawCorners(ctx, mx, faceRect.y, faceRect.w, faceRect.h, cornerLen);

    // Engagement arc above face
    ctx.shadowBlur = 0;
    const centerX = mx + faceRect.w / 2;
    const centerY = faceRect.y - 12;
    const radius = faceRect.w * 0.3;

    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, Math.PI, 2 * Math.PI, false);
    ctx.strokeStyle = "#333";
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, Math.PI, Math.PI + (engagementScore / 100) * Math.PI, false);
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.fillStyle = color;
    ctx.font = "bold 10px monospace";
    ctx.textAlign = "center";
    ctx.fillText(`${engagementScore}%`, centerX, centerY + 3);
  }

  private drawCorners(
    ctx: CanvasRenderingContext2D,
    x: number, y: number, w: number, h: number, len: number
  ): void {
    ctx.beginPath();
    ctx.moveTo(x, y + len); ctx.lineTo(x, y); ctx.lineTo(x + len, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + w - len, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + len);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y + h - len); ctx.lineTo(x, y + h); ctx.lineTo(x + len, y + h);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + w - len, y + h); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w, y + h - len);
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
