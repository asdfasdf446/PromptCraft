import { Observer, Scene, UniversalCamera, Vector3 } from '@babylonjs/core';

const MOVEMENT_KEYS = new Set([
  'KeyW',
  'KeyA',
  'KeyS',
  'KeyD',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Space',
  'ControlLeft',
  'ControlRight',
]);

export interface SpectatorFlyCameraOptions {
  scene: Scene;
  canvas: HTMLCanvasElement;
  position?: Vector3;
  speed?: number;
  sensitivity?: number;
  ellipsoid?: Vector3;
}

export class SpectatorFlyCamera {
  readonly camera: UniversalCamera;

  private readonly scene: Scene;
  private readonly canvas: HTMLCanvasElement;
  private readonly pressedKeys = new Set<string>();
  private readonly speed: number;
  private readonly sensitivity: number;
  private beforeRenderObserver: Observer<Scene> | null = null;
  private yaw: number;
  private pitch: number;
  private pointerLocked = false;

  private readonly handleKeyDown = (event: KeyboardEvent) => {
    if (this.isTypingTarget(event.target)) return;
    if (!MOVEMENT_KEYS.has(event.code)) return;
    this.pressedKeys.add(event.code);
    event.preventDefault();
  };

  private readonly handleKeyUp = (event: KeyboardEvent) => {
    this.pressedKeys.delete(event.code);
  };

  private readonly handleCanvasClick = () => {
    if (document.pointerLockElement === this.canvas) return;
    this.canvas.requestPointerLock();
  };

  private readonly handlePointerLockChange = () => {
    this.pointerLocked = document.pointerLockElement === this.canvas;
  };

  private readonly handleMouseMove = (event: MouseEvent) => {
    if (!this.pointerLocked) return;
    this.yaw += event.movementX * this.sensitivity;
    this.pitch += event.movementY * this.sensitivity;
    this.pitch = this.clamp(this.pitch, -1.45, 1.45);
    this.camera.rotation.x = this.pitch;
    this.camera.rotation.y = this.yaw;
  };

  private readonly handleContextMenu = (event: MouseEvent) => {
    event.preventDefault();
  };

  constructor(options: SpectatorFlyCameraOptions) {
    this.scene = options.scene;
    this.canvas = options.canvas;
    this.speed = options.speed ?? 3;
    this.sensitivity = options.sensitivity ?? 0.002;

    this.camera = new UniversalCamera('spectatorFlyCamera', options.position ?? new Vector3(15, 4, 24), this.scene);
    this.camera.rotation.x = -0.25;
    this.camera.rotation.y = Math.PI;
    this.camera.checkCollisions = true;
    this.camera.applyGravity = false;
    this.camera.ellipsoid = options.ellipsoid ?? new Vector3(0.4, 0.9, 0.4);
    this.scene.activeCamera = this.camera;

    this.yaw = this.camera.rotation.y;
    this.pitch = this.camera.rotation.x;

    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    this.canvas.addEventListener('click', this.handleCanvasClick);
    this.canvas.addEventListener('contextmenu', this.handleContextMenu);
    document.addEventListener('pointerlockchange', this.handlePointerLockChange);
    document.addEventListener('mousemove', this.handleMouseMove);

    this.beforeRenderObserver = this.scene.onBeforeRenderObservable.add(() => {
      this.update();
    });
  }

  dispose() {
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    this.canvas.removeEventListener('click', this.handleCanvasClick);
    this.canvas.removeEventListener('contextmenu', this.handleContextMenu);
    document.removeEventListener('pointerlockchange', this.handlePointerLockChange);
    document.removeEventListener('mousemove', this.handleMouseMove);

    if (document.pointerLockElement === this.canvas) {
      document.exitPointerLock();
    }

    if (this.beforeRenderObserver) {
      this.scene.onBeforeRenderObservable.remove(this.beforeRenderObserver);
      this.beforeRenderObserver = null;
    }
  }

  private update() {
    const deltaSeconds = this.scene.getEngine().getDeltaTime() / 1000;
    const movement = this.computeMovementVector();
    if (movement.lengthSquared() === 0) return;

    movement.normalize().scaleInPlace(this.speed * deltaSeconds);
    this.camera.cameraDirection.addInPlace(movement);
  }

  private computeMovementVector() {
    const forward = this.camera.getDirection(Vector3.Forward()).setAll(0);
    forward.x = Math.sin(this.yaw);
    forward.z = Math.cos(this.yaw);
    forward.normalize();

    const right = new Vector3(forward.z, 0, -forward.x).normalize();
    const direction = Vector3.Zero();

    if (this.pressedKeys.has('KeyW') || this.pressedKeys.has('ArrowUp')) direction.addInPlace(forward);
    if (this.pressedKeys.has('KeyS') || this.pressedKeys.has('ArrowDown')) direction.subtractInPlace(forward);
    if (this.pressedKeys.has('KeyA') || this.pressedKeys.has('ArrowLeft')) direction.subtractInPlace(right);
    if (this.pressedKeys.has('KeyD') || this.pressedKeys.has('ArrowRight')) direction.addInPlace(right);
    if (this.pressedKeys.has('Space')) direction.y += 1;
    if (this.pressedKeys.has('ControlLeft') || this.pressedKeys.has('ControlRight')) direction.y -= 1;

    return direction;
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
