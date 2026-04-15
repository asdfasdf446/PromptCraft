import { ArcRotateCamera, Observer, Scene, Vector3 } from '@babylonjs/core';

export interface RtsCameraBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface RtsCameraControllerOptions {
  scene: Scene;
  camera: ArcRotateCamera;
  canvas: HTMLCanvasElement;
  mapBounds?: RtsCameraBounds;
}

const DEFAULT_BOUNDS: RtsCameraBounds = {
  minX: -2,
  maxX: 31,
  minZ: -2,
  maxZ: 31,
};

const MOVEMENT_KEYS = new Set([
  'KeyW',
  'KeyA',
  'KeyS',
  'KeyD',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
]);

export class RtsCameraController {
  private readonly scene: Scene;
  private readonly camera: ArcRotateCamera;
  private readonly canvas: HTMLCanvasElement;
  private readonly bounds: RtsCameraBounds;

  private readonly pressedKeys = new Set<string>();
  private readonly desiredTarget: Vector3;
  private desiredAlpha: number;
  private desiredBeta: number;
  private desiredRadius: number;

  private beforeRenderObserver: Observer<Scene> | null = null;
  private pointerInsideCanvas = false;
  private pointerX = 0;
  private pointerY = 0;
  private rotating = false;
  private suppressClickSelection = false;
  private lastPointerX = 0;
  private lastPointerY = 0;
  private activePointerId: number | null = null;

  private readonly minRadius: number;
  private readonly maxRadius: number;
  private readonly closeBeta: number;
  private readonly farBeta: number;
  private readonly baseKeyboardPanSpeed = 15;
  private readonly baseEdgePanSpeed = 18;
  private readonly edgeThresholdRatio = 0.05;
  private readonly minimumEdgeThreshold = 24;
  private readonly rotationSensitivity = 0.005;
  private readonly zoomStep = 4;
  private readonly smoothing = 12;
  private readonly clickDragThreshold = 4;

  private readonly handleKeyDown = (event: KeyboardEvent) => {
    if (this.isTypingTarget(event.target)) return;
    if (!MOVEMENT_KEYS.has(event.code)) return;
    this.pressedKeys.add(event.code);
    event.preventDefault();
  };

  private readonly handleKeyUp = (event: KeyboardEvent) => {
    this.pressedKeys.delete(event.code);
  };

  private readonly handlePointerEnter = (event: PointerEvent) => {
    this.pointerInsideCanvas = true;
    this.updatePointerPosition(event);
  };

  private readonly handlePointerLeave = () => {
    this.pointerInsideCanvas = false;
    this.rotating = false;
    this.activePointerId = null;
  };

  private readonly handlePointerMove = (event: PointerEvent) => {
    this.updatePointerPosition(event);
    if (!this.rotating) return;

    const deltaX = event.clientX - this.lastPointerX;
    const deltaY = event.clientY - this.lastPointerY;

    if (Math.abs(deltaX) > this.clickDragThreshold || Math.abs(deltaY) > this.clickDragThreshold) {
      this.suppressClickSelection = true;
    }

    this.desiredAlpha -= deltaX * this.rotationSensitivity;
    this.desiredBeta = this.clamp(
      this.desiredBeta + deltaY * this.rotationSensitivity,
      this.camera.lowerBetaLimit ?? this.farBeta,
      this.camera.upperBetaLimit ?? this.closeBeta,
    );

    this.lastPointerX = event.clientX;
    this.lastPointerY = event.clientY;
  };

  private readonly handlePointerDown = (event: PointerEvent) => {
    if (event.button !== 0) return;
    this.rotating = true;
    this.suppressClickSelection = false;
    this.lastPointerX = event.clientX;
    this.lastPointerY = event.clientY;
    this.activePointerId = event.pointerId;
    this.canvas.setPointerCapture(event.pointerId);
  };

  private readonly handlePointerUp = (event: PointerEvent) => {
    if (event.button !== 0) return;
    this.rotating = false;
    if (this.activePointerId === event.pointerId) {
      this.canvas.releasePointerCapture(event.pointerId);
      this.activePointerId = null;
    }
  };

  private readonly handleWheel = (event: WheelEvent) => {
    event.preventDefault();
    const direction = Math.sign(event.deltaY);
    this.desiredRadius = this.clamp(this.desiredRadius + direction * this.zoomStep, this.minRadius, this.maxRadius);
    this.desiredBeta = this.radiusToBeta(this.desiredRadius);
  };

  private readonly handleContextMenu = (event: MouseEvent) => {
    event.preventDefault();
  };

  constructor(options: RtsCameraControllerOptions) {
    this.scene = options.scene;
    this.camera = options.camera;
    this.canvas = options.canvas;
    this.bounds = options.mapBounds ?? DEFAULT_BOUNDS;

    this.minRadius = this.camera.lowerRadiusLimit ?? 12;
    this.maxRadius = this.camera.upperRadiusLimit ?? 80;
    this.closeBeta = this.camera.upperBetaLimit ?? Math.PI / 2.35;
    this.farBeta = this.camera.lowerBetaLimit ?? Math.PI / 4.2;

    this.desiredTarget = this.camera.target.clone();
    this.desiredAlpha = this.camera.alpha;
    this.desiredBeta = this.camera.beta;
    this.desiredRadius = this.camera.radius;

    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    this.canvas.addEventListener('pointerenter', this.handlePointerEnter);
    this.canvas.addEventListener('pointerleave', this.handlePointerLeave);
    this.canvas.addEventListener('pointermove', this.handlePointerMove);
    this.canvas.addEventListener('pointerdown', this.handlePointerDown);
    this.canvas.addEventListener('pointerup', this.handlePointerUp);
    this.canvas.addEventListener('wheel', this.handleWheel, { passive: false });
    this.canvas.addEventListener('contextmenu', this.handleContextMenu);

    this.beforeRenderObserver = this.scene.onBeforeRenderObservable.add(() => {
      this.update();
    });
  }

  shouldSuppressClickSelection() {
    return this.suppressClickSelection;
  }

  consumeClickSuppression() {
    const value = this.suppressClickSelection;
    this.suppressClickSelection = false;
    return value;
  }

  dispose() {
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    this.canvas.removeEventListener('pointerenter', this.handlePointerEnter);
    this.canvas.removeEventListener('pointerleave', this.handlePointerLeave);
    this.canvas.removeEventListener('pointermove', this.handlePointerMove);
    this.canvas.removeEventListener('pointerdown', this.handlePointerDown);
    this.canvas.removeEventListener('pointerup', this.handlePointerUp);
    this.canvas.removeEventListener('wheel', this.handleWheel);
    this.canvas.removeEventListener('contextmenu', this.handleContextMenu);

    if (this.beforeRenderObserver) {
      this.scene.onBeforeRenderObservable.remove(this.beforeRenderObserver);
      this.beforeRenderObserver = null;
    }
  }

  private update() {
    const deltaSeconds = this.scene.getEngine().getDeltaTime() / 1000;
    const movement = this.computeMovementVector();
    if (!movement.equals(Vector3.Zero())) {
      movement.normalize();
      const speedScale = this.clamp(this.desiredRadius / 38, 0.7, 1.8);
      movement.scaleInPlace(this.baseKeyboardPanSpeed * speedScale * deltaSeconds);
      this.desiredTarget.addInPlace(movement);
      this.desiredTarget.x = this.clamp(this.desiredTarget.x, this.bounds.minX, this.bounds.maxX);
      this.desiredTarget.z = this.clamp(this.desiredTarget.z, this.bounds.minZ, this.bounds.maxZ);
    }

    const smoothingFactor = 1 - Math.exp(-this.smoothing * deltaSeconds);
    this.camera.target = Vector3.Lerp(this.camera.target, this.desiredTarget, smoothingFactor);
    this.camera.alpha = this.camera.alpha + this.shortestAngleDelta(this.camera.alpha, this.desiredAlpha) * smoothingFactor;
    this.camera.beta = this.camera.beta + (this.desiredBeta - this.camera.beta) * smoothingFactor;
    this.camera.radius = this.camera.radius + (this.desiredRadius - this.camera.radius) * smoothingFactor;
  }

  private computeMovementVector() {
    const input = Vector3.Zero();

    if (this.pressedKeys.has('KeyW') || this.pressedKeys.has('ArrowUp')) input.z += 1;
    if (this.pressedKeys.has('KeyS') || this.pressedKeys.has('ArrowDown')) input.z -= 1;
    if (this.pressedKeys.has('KeyA') || this.pressedKeys.has('ArrowLeft')) input.x -= 1;
    if (this.pressedKeys.has('KeyD') || this.pressedKeys.has('ArrowRight')) input.x += 1;

    if (this.pointerInsideCanvas) {
      const rect = this.canvas.getBoundingClientRect();
      const thresholdX = Math.max(rect.width * this.edgeThresholdRatio, this.minimumEdgeThreshold);
      const thresholdY = Math.max(rect.height * this.edgeThresholdRatio, this.minimumEdgeThreshold);
      const edgeSpeedScale = this.baseEdgePanSpeed * this.clamp(this.desiredRadius / 38, 0.7, 1.8);

      if (this.pointerX <= thresholdX) input.x -= edgeSpeedScale / this.baseKeyboardPanSpeed;
      if (this.pointerX >= rect.width - thresholdX) input.x += edgeSpeedScale / this.baseKeyboardPanSpeed;
      if (this.pointerY <= thresholdY) input.z += edgeSpeedScale / this.baseKeyboardPanSpeed;
      if (this.pointerY >= rect.height - thresholdY) input.z -= edgeSpeedScale / this.baseKeyboardPanSpeed;
    }

    if (input.equals(Vector3.Zero())) return input;

    const forward = new Vector3(Math.sin(this.desiredAlpha), 0, Math.cos(this.desiredAlpha)).normalize();
    const right = new Vector3(Math.cos(this.desiredAlpha), 0, -Math.sin(this.desiredAlpha)).normalize();
    return right.scale(input.x).addInPlace(forward.scale(input.z));
  }

  private radiusToBeta(radius: number) {
    const t = (radius - this.minRadius) / Math.max(1, this.maxRadius - this.minRadius);
    const eased = t * t * (3 - 2 * t);
    return this.clamp(this.closeBeta + (this.farBeta - this.closeBeta) * eased, this.farBeta, this.closeBeta);
  }

  private updatePointerPosition(event: PointerEvent) {
    const rect = this.canvas.getBoundingClientRect();
    this.pointerX = event.clientX - rect.left;
    this.pointerY = event.clientY - rect.top;
  }

  private shortestAngleDelta(current: number, target: number) {
    let delta = target - current;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;
    return delta;
  }

  private isTypingTarget(target: EventTarget | null) {
    if (!(target instanceof HTMLElement)) return false;
    const tagName = target.tagName;
    return tagName === 'INPUT' || tagName === 'TEXTAREA' || target.isContentEditable;
  }

  private clamp(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value));
  }
}
