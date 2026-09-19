export type Plane = {
  id: string;
  position: [number, number, number];
  rotation: [number, number, number];
  extent: [number, number];
};

type PlaneCallback = (plane: Plane) => void;
type FrameCallback = (pose: { position: [number, number, number]; rotation: [number, number, number, number] }) => void;

export class ARSession {
  private _running = false;
  private planeCallbacks: PlaneCallback[] = [];
  private frameCallbacks: FrameCallback[] = [];

  get running(): boolean {
    return this._running;
  }

  start(): void {
    this._running = true;
  }

  stop(): void {
    this._running = false;
  }

  placeAnchor(_position: [number, number, number]): void {
    if (!this._running) return;
  }

  onPlaneDetected(callback: PlaneCallback): () => void {
    this.planeCallbacks.push(callback);
    return () => {
      this.planeCallbacks = this.planeCallbacks.filter((cb) => cb !== callback);
    };
  }

  onFrame(callback: FrameCallback): () => void {
    this.frameCallbacks.push(callback);
    return () => {
      this.frameCallbacks = this.frameCallbacks.filter((cb) => cb !== callback);
    };
  }

  handlePlaneUpdate(plane: Plane): void {
    if (!this._running) return;
    this.planeCallbacks.forEach((cb) => cb(plane));
  }

  handleFrameUpdate(pose: { position: [number, number, number]; rotation: [number, number, number, number] }): void {
    if (!this._running) return;
    this.frameCallbacks.forEach((cb) => cb(pose));
  }
}
