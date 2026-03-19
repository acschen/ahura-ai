/* eslint-disable @typescript-eslint/no-explicit-any */

// Minimal OpenCV.js type declarations for our usage
declare namespace cv {
  class Mat {
    constructor();
    constructor(rows: number, cols: number, type: number);
    constructor(rows: number, cols: number, type: number, scalar: Scalar);
    rows: number;
    cols: number;
    data: Uint8Array;
    data32F: Float32Array;
    data64F: Float64Array;
    delete(): void;
    roi(rect: Rect): Mat;
    clone(): Mat;
    size(): Size;
    type(): number;
    channels(): number;
    isContinuous(): boolean;
    ucharPtr(row: number, col?: number): Uint8Array;
  }

  class MatVector {
    constructor();
    size(): number;
    get(index: number): Mat;
    delete(): void;
  }

  class Rect {
    constructor();
    constructor(x: number, y: number, width: number, height: number);
    x: number;
    y: number;
    width: number;
    height: number;
  }

  class RectVector {
    constructor();
    size(): number;
    get(index: number): Rect;
    delete(): void;
  }

  class Size {
    constructor();
    constructor(width: number, height: number);
    width: number;
    height: number;
  }

  class Scalar {
    constructor(v0: number, v1?: number, v2?: number, v3?: number);
  }

  class Point {
    constructor(x: number, y: number);
    x: number;
    y: number;
  }

  class CascadeClassifier {
    constructor();
    load(path: string): boolean;
    detectMultiScale(
      image: Mat,
      objects: RectVector,
      scaleFactor?: number,
      minNeighbors?: number,
      flags?: number,
      minSize?: Size,
      maxSize?: Size
    ): void;
    delete(): void;
  }

  function imread(canvas: HTMLCanvasElement | HTMLImageElement): Mat;
  function imshow(canvas: HTMLCanvasElement | string, mat: Mat): void;
  function cvtColor(src: Mat, dst: Mat, code: number): void;
  function equalizeHist(src: Mat, dst: Mat): void;
  function resize(
    src: Mat,
    dst: Mat,
    dsize: Size,
    fx?: number,
    fy?: number,
    interpolation?: number
  ): void;
  function rectangle(
    img: Mat,
    pt1: Point,
    pt2: Point,
    color: Scalar,
    thickness?: number,
    lineType?: number
  ): void;
  function putText(
    img: Mat,
    text: string,
    org: Point,
    fontFace: number,
    fontScale: number,
    color: Scalar,
    thickness?: number,
    lineType?: number
  ): void;
  function absdiff(src1: Mat, src2: Mat, dst: Mat): void;
  function threshold(
    src: Mat,
    dst: Mat,
    thresh: number,
    maxval: number,
    type: number
  ): void;
  function countNonZero(src: Mat): number;
  function calcHist(
    images: MatVector,
    channels: number[],
    mask: Mat,
    hist: Mat,
    histSize: number[],
    ranges: number[],
    accumulate?: boolean
  ): void;
  function normalize(
    src: Mat,
    dst: Mat,
    alpha: number,
    beta: number,
    normType: number
  ): void;
  function meanStdDev(
    src: Mat,
    mean: Mat,
    stddev: Mat,
    mask?: Mat
  ): void;
  function GaussianBlur(
    src: Mat,
    dst: Mat,
    ksize: Size,
    sigmaX: number,
    sigmaY?: number
  ): void;
  function Sobel(
    src: Mat,
    dst: Mat,
    ddepth: number,
    dx: number,
    dy: number,
    ksize?: number
  ): void;
  function Laplacian(
    src: Mat,
    dst: Mat,
    ddepth: number,
    ksize?: number
  ): void;
  function split(src: Mat, mv: MatVector): void;
  function addWeighted(
    src1: Mat,
    alpha: number,
    src2: Mat,
    beta: number,
    gamma: number,
    dst: Mat
  ): void;

  function FS_createDataFile(
    parent: string,
    name: string,
    data: string | ArrayBuffer | Uint8Array,
    canRead: boolean,
    canWrite: boolean,
    canOwn?: boolean
  ): void;

  const COLOR_RGBA2GRAY: number;
  const COLOR_GRAY2RGBA: number;
  const COLOR_RGBA2BGR: number;
  const COLOR_BGR2GRAY: number;
  const CV_8U: number;
  const CV_8UC1: number;
  const CV_8UC4: number;
  const CV_32F: number;
  const CV_64F: number;
  const THRESH_BINARY: number;
  const NORM_MINMAX: number;
  const FONT_HERSHEY_SIMPLEX: number;
  const FONT_HERSHEY_DUPLEX: number;
  const LINE_AA: number;
  const INTER_LINEAR: number;
  const INTER_AREA: number;

  function matFromImageData(imageData: ImageData): Mat;
  function matFromArray(
    rows: number,
    cols: number,
    type: number,
    array: number[] | Uint8Array | Float32Array
  ): Mat;

  let onRuntimeInitialized: () => void;
}

interface Window {
  cv: typeof cv;
}

declare module "*.xml" {
  const content: string;
  export default content;
}
