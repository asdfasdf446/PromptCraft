import { onMount, onCleanup, createEffect } from 'solid-js';
import {
  Engine,
  Scene,
  ArcRotateCamera,
  HemisphericLight,
  DirectionalLight,
  Vector3,
  MeshBuilder,
  StandardMaterial,
  PBRMaterial,
  Color3,
  Mesh,
  PointerEventTypes,
  DynamicTexture,
  SceneLoader,
  AbstractMesh,
  Animation,
  AnimationGroup,
  Material,
} from '@babylonjs/core';
import '@babylonjs/loaders/glTF';
import { worldState, UnitState, TileState } from '../network/WebSocketClient';
import {
  wireframeMode,
  gridVisible,
  setCurrentDayPhase,
  setCycleProgress,
  type DayPhase
} from './gameState';

interface Props {
  onUnitClick: (unit: UnitState) => void;
}

const tileBaseByKind: Record<TileState['kind'], string> = {
  normal: 'ground_pathOpen.glb',
  fertile: 'ground_grass.glb',
  obstacle: 'water.json',
};

const stackHeight = 1.2;
const moveAnimationFrames = 30;
const moveAnimationFps = 60;
const deathFadeMs = 700;

type EntityRenderRecord = {
  unitId: string;
  root: AbstractMesh;
  descendants: AbstractMesh[];
  animationGroups: AnimationGroup[];
  idleGroups: AnimationGroup[];
  walkGroups: AnimationGroup[];
  yOffset: number;
  prevPosition: { gridX: number; gridY: number; stackLevel: number };
  loadingToken: number;
  dying: boolean;
  deathStartedAt?: number;
  fadeMaterials?: Material[];
};

export default function BabylonScene(props: Props) {
  let canvas: HTMLCanvasElement;
  let engine: Engine;
  let scene: Scene;
  const unitRecords = new Map<string, EntityRenderRecord>();
  const tileMeshes = new Map<string, AbstractMesh>();
  const playerArrow = { mesh: null as Mesh | null };
  const actionIcons = new Map<string, { plane: Mesh; startTime: number }>();
  const borderMeshes: Mesh[] = [];
  const pendingLoads = new Map<string, number>();
  let sunLight: DirectionalLight;

  const getTargetPosition = (gridX: number, gridY: number, stackLevel: number, yOffset: number) => (
    new Vector3(gridX, yOffset + stackLevel * stackHeight, gridY)
  );

  const setMeshNameRecursive = (root: AbstractMesh, unitId: string) => {
    root.name = `unit_${unitId}`;
    for (const child of root.getChildMeshes()) {
      child.name = `unit_${unitId}`;
    }
  };

  const cloneMaterialsForFade = (record: EntityRenderRecord) => {
    const uniqueMaterials = new Map<string, Material>();
    for (const mesh of [record.root, ...record.descendants]) {
      if (!mesh.material) continue;
      const key = mesh.material.uniqueId.toString();
      let cloned = uniqueMaterials.get(key);
      if (!cloned) {
        cloned = mesh.material.clone(`${mesh.material.name || 'unitMat'}_${record.unitId}_fade`);
        if (!cloned) continue;
        uniqueMaterials.set(key, cloned);
      }
      mesh.material = cloned;
    }
    record.fadeMaterials = [...uniqueMaterials.values()];
  };

  const stopAnimationGroups = (groups: AnimationGroup[]) => {
    for (const group of groups) {
      group.stop();
      group.reset();
    }
  };

  const applyIdlePose = (record: EntityRenderRecord) => {
    stopAnimationGroups(record.walkGroups);
    for (const group of record.idleGroups) {
      group.start(false, 1.0, 0, group.to, false);
      group.goToFrame(group.to);
      group.pause();
    }
  };

  const playWalkLoop = (record: EntityRenderRecord) => {
    if (record.walkGroups.length === 0) return;
    stopAnimationGroups(record.idleGroups);
    for (const group of record.walkGroups) {
      if (!group.isPlaying) {
        group.start(true);
      }
    }
  };

  const classifyAnimationGroups = (groups: AnimationGroup[]) => {
    const idleGroups: AnimationGroup[] = [];
    const walkGroups: AnimationGroup[] = [];
    for (const group of groups) {
      const name = group.name.toLowerCase();
      if (name.includes('walk') || name.includes('run') || name.includes('move')) {
        walkGroups.push(group);
      } else if (name.includes('idle') || name.includes('static')) {
        idleGroups.push(group);
      }
    }
    return { idleGroups, walkGroups };
  };

  const disposeUnitRecord = (unitId: string) => {
    const record = unitRecords.get(unitId);
    if (!record) return;
    stopAnimationGroups(record.animationGroups);
    record.root.dispose(false, true);
    record.fadeMaterials?.forEach((material) => material.dispose());
    unitRecords.delete(unitId);
    pendingLoads.delete(unitId);
  };

  const startDeathFade = (unitId: string) => {
    const record = unitRecords.get(unitId);
    if (!record || record.dying) return;
    record.dying = true;
    record.deathStartedAt = Date.now();
    stopAnimationGroups(record.animationGroups);
    cloneMaterialsForFade(record);
  };

  const createFallbackUnit = (unit: UnitState, yOffset = 0.5) => {
    const fallbackMesh = MeshBuilder.CreateBox(`unit_${unit.id}`, { size: 0.8 }, scene);
    fallbackMesh.position = getTargetPosition(unit.grid_x, unit.grid_y, unit.stack_level, yOffset);
    const mat = new StandardMaterial(`unitMat_${unit.id}`, scene);
    mat.diffuseColor = unit.kind === 'food' ? new Color3(0.2, 0.8, 0.2) : new Color3(0.9, 0.7, 0.3);
    fallbackMesh.material = mat;
    return fallbackMesh;
  };

  const createUnitRecord = (unit: UnitState, root: AbstractMesh, animationGroups: AnimationGroup[] = []) => {
    const descendants = root.getChildMeshes();
    setMeshNameRecursive(root, unit.id);
    root.scaling = unit.kind === 'food' ? new Vector3(0.8, 0.8, 0.8) : new Vector3(0.5, 0.5, 0.5);
    root.computeWorldMatrix(true);
    const { min } = root.getHierarchyBoundingVectors(true);
    const yOffset = Math.max(0, -min.y);
    root.position = getTargetPosition(unit.grid_x, unit.grid_y, unit.stack_level, yOffset);
    const { idleGroups, walkGroups } = classifyAnimationGroups(animationGroups);
    const record: EntityRenderRecord = {
      unitId: unit.id,
      root,
      descendants,
      animationGroups,
      idleGroups,
      walkGroups,
      yOffset,
      prevPosition: { gridX: unit.grid_x, gridY: unit.grid_y, stackLevel: unit.stack_level },
      loadingToken: pendingLoads.get(unit.id) ?? 0,
      dying: false,
    };
    unitRecords.set(unit.id, record);
    if (animationGroups.length > 0) {
      applyIdlePose(record);
    }
    return record;
  };

  const resolveModelLocation = (unit: UnitState) => {
    if (unit.kind === 'food') {
      const modelFile = unit.model.replace(/^nature\//, '');
      return { assetFolder: '/assets/models/nature/', assetFile: modelFile };
    }
    const modelPath = unit.model.split('/');
    const modelFile = modelPath.pop() || unit.model;
    const folder = modelPath.length > 0 ? `/assets/models/${modelPath.join('/')}/` : '/assets/models/';
    return { assetFolder: folder, assetFile: modelFile };
  };

  onMount(() => {
    engine = new Engine(canvas, true, { adaptToDeviceRatio: true });
    scene = new Scene(engine);
    scene.clearColor = new Color3(0.1, 0.1, 0.1).toColor4();

    const camera = new ArcRotateCamera('camera', -Math.PI / 2, Math.PI / 4, 50, new Vector3(15, 0, 15), scene);
    camera.attachControl(canvas, true);
    camera.lowerRadiusLimit = 20;
    camera.upperRadiusLimit = 80;
    camera.lowerBetaLimit = 0.1;
    camera.upperBetaLimit = Math.PI / 2.5;

    const light = new HemisphericLight('light', new Vector3(0, 1, 0), scene);
    light.intensity = 0.8;

    sunLight = new DirectionalLight('sunLight', new Vector3(1, -1, 0.5), scene);
    sunLight.intensity = 0.7;
    sunLight.diffuse = new Color3(1, 0.9, 0.7);

    const borderMat = new StandardMaterial('borderMat', scene);
    borderMat.diffuseColor = new Color3(0.1, 0.1, 0.1);
    borderMat.specularColor = new Color3(0, 0, 0);

    for (let x = 0; x < 30; x++) {
      for (let z = 0; z < 30; z++) {
        if (x < 29) {
          const vBorder = MeshBuilder.CreatePlane(`vborder_${x}_${z}`, { width: 0.05, height: 1 }, scene);
          vBorder.position = new Vector3(x + 0.5, 0.01, z);
          vBorder.rotation.x = Math.PI / 2;
          vBorder.material = borderMat;
          borderMeshes.push(vBorder);
        }
        if (z < 29) {
          const hBorder = MeshBuilder.CreatePlane(`hborder_${x}_${z}`, { width: 1, height: 0.05 }, scene);
          hBorder.position = new Vector3(x, 0.01, z + 0.5);
          hBorder.rotation.x = Math.PI / 2;
          hBorder.material = borderMat;
          borderMeshes.push(hBorder);
        }
      }
    }

    const createDirectionMarker = (text: string, position: Vector3, color: Color3) => {
      const marker = MeshBuilder.CreateBox(`marker_${text}`, { width: 2, height: 0.5, depth: 2 }, scene);
      marker.position = position;
      const mat = new StandardMaterial(`markerMat_${text}`, scene);
      mat.diffuseColor = color;
      mat.emissiveColor = color.scale(0.3);
      marker.material = mat;

      const plane = MeshBuilder.CreatePlane(`label_${text}`, { width: 5, height: 2 }, scene);
      plane.position = new Vector3(position.x, position.y + 1.5, position.z);
      plane.billboardMode = Mesh.BILLBOARDMODE_ALL;

      const texture = new DynamicTexture(`labelTexture_${text}`, { width: 1024, height: 256 }, scene);
      const textMat = new StandardMaterial(`labelMat_${text}`, scene);
      textMat.diffuseTexture = texture;
      textMat.emissiveColor = new Color3(1, 1, 1);
      textMat.backFaceCulling = false;
      plane.material = textMat;

      const ctx = texture.getContext();
      ctx.fillStyle = 'white';
      ctx.font = 'bold 100px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text.toUpperCase(), 512, 128);
      texture.update();
    };

    createDirectionMarker('North (Up)', new Vector3(15, 0.3, -3), new Color3(0.3, 0.5, 1));
    createDirectionMarker('South (Down)', new Vector3(15, 0.3, 33), new Color3(1, 0.3, 0.3));
    createDirectionMarker('West (Left)', new Vector3(-3, 0.3, 15), new Color3(0.3, 1, 0.5));
    createDirectionMarker('East (Right)', new Vector3(33, 0.3, 15), new Color3(1, 1, 0.3));

    scene.onPointerObservable.add((pointerInfo) => {
      if (pointerInfo.type === PointerEventTypes.POINTERDOWN) {
        const pickResult = scene.pick(scene.pointerX, scene.pointerY);
        if (pickResult.hit && pickResult.pickedMesh) {
          const meshName = pickResult.pickedMesh.name;
          if (meshName.startsWith('unit_')) {
            const unitId = meshName.replace('unit_', '');
            const unit = worldState()?.units.find(u => u.id === unitId);
            if (unit) props.onUnitClick(unit);
          }
        }
      }
    });

    scene.registerBeforeRender(() => {
      if (playerArrow.mesh) {
        playerArrow.mesh.position.y = 2.5 + Math.sin(Date.now() / 1000 * 2) * 0.2;
      }

      const now = Date.now();
      for (const [unitId, record] of unitRecords.entries()) {
        if (!record.dying || record.deathStartedAt == null || !record.fadeMaterials) continue;
        const elapsed = now - record.deathStartedAt;
        const alpha = Math.max(0, 1 - (elapsed / deathFadeMs));
        for (const material of record.fadeMaterials) {
          if ('alpha' in material) {
            (material as StandardMaterial | PBRMaterial).alpha = alpha;
          }
        }
        if (elapsed >= deathFadeMs) {
          disposeUnitRecord(unitId);
        }
      }
    });

    engine.runRenderLoop(() => {
      scene.render();
      const cycleTime = 180;
      const time = Date.now() / 1000;
      const phase = (time % cycleTime) / cycleTime;
      setCycleProgress(phase);
      const sunAngle = phase * Math.PI * 2 - Math.PI / 2;
      const sunHeight = Math.sin(sunAngle);
      const sunHorizontal = Math.cos(sunAngle);
      sunLight.direction = new Vector3(sunHorizontal, -Math.abs(sunHeight) - 0.3, 0.5).normalize();

      const kfMidnight  = { i: 0.15, dr: 0.2, dg: 0.2,  db: 0.4,  sr: 0.05, sg: 0.05, sb: 0.15 };
      const kfMorning   = { i: 0.8,  dr: 1.0, dg: 0.95, db: 0.9,  sr: 0.5,  sg: 0.7,  sb: 1.0  };
      const kfAfternoon = { i: 0.8,  dr: 1.0, dg: 0.95, db: 0.9,  sr: 0.4,  sg: 0.6,  sb: 1.0  };
      const kfEvening   = { i: 0.2,  dr: 1.0, dg: 0.2,  db: 0.05, sr: 0.1,  sg: 0.05, sb: 0.05 };
      type Kf = typeof kfMidnight;
      const lerpKf = (a: Kf, b: Kf, t: number): Kf => ({
        i:  a.i  + (b.i  - a.i)  * t,
        dr: a.dr + (b.dr - a.dr) * t,
        dg: a.dg + (b.dg - a.dg) * t,
        db: a.db + (b.db - a.db) * t,
        sr: a.sr + (b.sr - a.sr) * t,
        sg: a.sg + (b.sg - a.sg) * t,
        sb: a.sb + (b.sb - a.sb) * t,
      });

      let kf: Kf;
      let currentPhase: DayPhase;
      if (phase < 0.25) {
        currentPhase = 'morning';
        kf = lerpKf(kfMidnight, kfMorning, phase * 4);
      } else if (phase < 0.5) {
        currentPhase = 'afternoon';
        kf = lerpKf(kfMorning, kfAfternoon, (phase - 0.25) * 4);
      } else if (phase < 0.75) {
        currentPhase = 'evening';
        kf = lerpKf(kfAfternoon, kfEvening, (phase - 0.5) * 4);
      } else {
        currentPhase = 'midnight';
        kf = lerpKf(kfEvening, kfMidnight, (phase - 0.75) * 4);
      }

      sunLight.diffuse = new Color3(kf.dr, kf.dg, kf.db);
      sunLight.intensity = kf.i;
      scene.clearColor = new Color3(kf.sr, kf.sg, kf.sb).toColor4();
      setCurrentDayPhase(currentPhase);

      if ((window as any).__setDebugFps) {
        (window as any).__setDebugFps(Math.round(engine.getFps()));
      }

      const now = Date.now();
      for (const [id, icon] of actionIcons.entries()) {
        const elapsed = (now - icon.startTime) / 1000;
        if (elapsed >= 3) {
          icon.plane.dispose();
          actionIcons.delete(id);
        } else if (icon.plane.material) {
          (icon.plane.material as StandardMaterial).alpha = 1 - (elapsed / 3);
        }
      }
    });

    window.addEventListener('resize', () => engine.resize());
  });

  createEffect(() => {
    if (!scene) return;
    const enabled = wireframeMode();
    scene.materials.forEach((mat) => {
      if (mat instanceof StandardMaterial || mat instanceof PBRMaterial) {
        mat.wireframe = enabled;
      }
    });
    for (const record of unitRecords.values()) {
      const unit = worldState()?.units.find(u => u.id === record.unitId);
      if (unit?.kind === 'obstacle') {
        record.root.isVisible = enabled;
      }
    }
  });

  createEffect(() => {
    const visible = gridVisible();
    borderMeshes.forEach(mesh => { mesh.isVisible = visible; });
  });

  createEffect(() => {
    const state = worldState();
    if (!state || !scene || !Array.isArray(state.tiles) || !Array.isArray(state.units)) return;

    const tileKeys = new Set(state.tiles.map(tile => `${tile.grid_x}_${tile.grid_y}`));
    for (const [key, mesh] of tileMeshes.entries()) {
      if (!tileKeys.has(key)) {
        mesh.dispose();
        tileMeshes.delete(key);
      }
    }

    for (const tile of state.tiles) {
      const key = `${tile.grid_x}_${tile.grid_y}`;
      if (tileMeshes.has(key)) continue;

      const model = tileBaseByKind[tile.kind];
      if (model.endsWith('.glb')) {
        SceneLoader.ImportMesh('', '/assets/models/nature/', model, scene, (meshes) => {
          if (meshes.length > 0) {
            const root = meshes[0];
            root.name = `tile_${key}`;
            root.position = new Vector3(tile.grid_x, 0, tile.grid_y);
            tileMeshes.set(key, root);
          }
        });
      } else {
        const tileMesh = MeshBuilder.CreateGround(`tile_${key}`, { width: 1, height: 1 }, scene);
        tileMesh.position = new Vector3(tile.grid_x, 0, tile.grid_y);
        const mat = new StandardMaterial(`tilemat_${key}`, scene);
        mat.diffuseColor = tile.kind === 'obstacle' ? new Color3(0.1, 0.3, 0.8) : tile.kind === 'fertile' ? new Color3(0.2, 0.6, 0.2) : new Color3(0.45, 0.3, 0.15);
        tileMesh.material = mat;
        tileMeshes.set(key, tileMesh);
      }
    }

    const currentUnitIds = new Set(state.units.map(u => u.id));
    for (const unitId of state.deaths?.map((death) => death.unit_id) ?? []) {
      startDeathFade(unitId);
    }
    for (const [id, record] of unitRecords.entries()) {
      if (!currentUnitIds.has(id) && !record.dying) {
        disposeUnitRecord(id);
      }
    }

    for (const unit of state.units) {
      let record = unitRecords.get(unit.id);
      const targetPosition = getTargetPosition(unit.grid_x, unit.grid_y, unit.stack_level, record?.yOffset ?? 0.5);
      if (!record) {
        if (unit.kind === 'obstacle') {
          const obstacleMesh = MeshBuilder.CreateBox(`unit_${unit.id}`, { size: 0.9 }, scene);
          obstacleMesh.position = targetPosition;
          const mat = new StandardMaterial(`unitMat_${unit.id}`, scene);
          mat.diffuseColor = new Color3(0.6, 0.6, 0.6);
          mat.wireframe = true;
          obstacleMesh.material = mat;
          obstacleMesh.isVisible = wireframeMode();
          record = createUnitRecord(unit, obstacleMesh);
          record.yOffset = 0.5;
          record.root.position = getTargetPosition(unit.grid_x, unit.grid_y, unit.stack_level, record.yOffset);
          continue;
        }

        const token = (pendingLoads.get(unit.id) ?? 0) + 1;
        pendingLoads.set(unit.id, token);
        const { assetFolder, assetFile } = resolveModelLocation(unit);
        SceneLoader.ImportMesh('', assetFolder, assetFile, scene, (meshes, _particleSystems, _skeletons, animationGroups) => {
          if ((pendingLoads.get(unit.id) ?? 0) !== token || unitRecords.has(unit.id)) {
            meshes.forEach((mesh) => mesh.dispose(false, true));
            animationGroups?.forEach((group) => group.dispose());
            return;
          }
          if (meshes.length === 0) return;
          createUnitRecord(unit, meshes[0], animationGroups ?? []);
        }, undefined, () => {
          if ((pendingLoads.get(unit.id) ?? 0) !== token || unitRecords.has(unit.id)) {
            return;
          }
          console.warn(`[BabylonScene] Failed to load model for ${unit.id}: ${assetFolder}${assetFile}`);
          createUnitRecord(unit, createFallbackUnit(unit));
        });
        continue;
      }

      if (record.dying) {
        continue;
      }

      record.root.isVisible = unit.kind !== 'obstacle' || wireframeMode();
      const startPos = getTargetPosition(record.prevPosition.gridX, record.prevPosition.gridY, record.prevPosition.stackLevel, record.yOffset);
      const endPos = getTargetPosition(unit.grid_x, unit.grid_y, unit.stack_level, record.yOffset);
      if (!startPos.equals(endPos)) {
        playWalkLoop(record);
        const posAnim = new Animation(`moveAnim_${unit.id}`, 'position', moveAnimationFps, Animation.ANIMATIONTYPE_VECTOR3, Animation.ANIMATIONLOOPMODE_CONSTANT);
        posAnim.setKeys([{ frame: 0, value: startPos }, { frame: moveAnimationFrames, value: endPos }]);
        record.root.animations = [posAnim];
        const animatable = scene.beginAnimation(record.root, 0, moveAnimationFrames, false, 1.0);
        animatable.onAnimationEnd = () => {
          const latest = unitRecords.get(unit.id);
          if (latest && !latest.dying) {
            latest.root.position = endPos.clone();
            applyIdlePose(latest);
          }
        };
      } else if (record.animationGroups.length > 0) {
        applyIdlePose(record);
      }
      record.prevPosition = { gridX: unit.grid_x, gridY: unit.grid_y, stackLevel: unit.stack_level };
    }

    const myUnitId = sessionStorage.getItem('myUnitId');
    if (myUnitId) {
      const myUnit = state.units.find(u => u.id === myUnitId && u.kind === 'player');
      if (myUnit) {
        if (!playerArrow.mesh) {
          playerArrow.mesh = MeshBuilder.CreateCylinder('playerArrow', { diameterTop: 0.4, diameterBottom: 0, height: 0.6, tessellation: 8 }, scene);
          const arrowMat = new StandardMaterial('playerArrowMat', scene);
          arrowMat.diffuseColor = new Color3(1, 1, 0);
          arrowMat.emissiveColor = new Color3(1, 1, 0).scale(0.5);
          playerArrow.mesh.material = arrowMat;
        }
        const playerRecord = unitRecords.get(myUnit.id);
        const playerYOffset = playerRecord?.yOffset ?? 0.5;
        playerArrow.mesh.position.x = myUnit.grid_x;
        playerArrow.mesh.position.y = playerYOffset + myUnit.stack_level * stackHeight + 2;
        playerArrow.mesh.position.z = myUnit.grid_y;
      } else if (playerArrow.mesh) {
        playerArrow.mesh.dispose();
        playerArrow.mesh = null;
      }
    }

    if (state.actions && state.actions.length > 0) {
      for (const action of state.actions) {
        const iconId = `${action.unit_id}_${Date.now()}`;
        const plane = MeshBuilder.CreatePlane(iconId, { width: 1, height: 1 }, scene);
        plane.position = new Vector3(action.target_x, 1.5 + action.target_stack_level * stackHeight, action.target_y);
        plane.billboardMode = Mesh.BILLBOARDMODE_ALL;
        const texture = new DynamicTexture(`iconTexture_${iconId}`, { width: 256, height: 256 }, scene);
        const mat = new StandardMaterial(`iconMat_${iconId}`, scene);
        mat.diffuseTexture = texture;
        mat.emissiveColor = new Color3(1, 1, 1);
        mat.useAlphaFromDiffuseTexture = true;
        plane.material = mat;
        const ctx = texture.getContext();
        ctx.clearRect(0, 0, 256, 256);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.beginPath();
        ctx.arc(128, 128, 100, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 8;
        ctx.stroke();
        ctx.font = 'bold 120px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#333';
        ctx.fillText('💬', 128, 128);
        texture.update();
        actionIcons.set(iconId, { plane, startTime: Date.now() });
      }
    }
  });

  onCleanup(() => {
    engine.dispose();
  });

  return (
    <canvas
      ref={canvas!}
      style={{ width: '100%', height: '100%', display: 'block', outline: 'none' }}
    />
  );
}
