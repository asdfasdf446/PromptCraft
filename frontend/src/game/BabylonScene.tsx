import { onMount, onCleanup, createEffect } from 'solid-js';
import {
  Engine,
  Scene,
  ArcRotateCamera,
  HemisphericLight,
  Vector3,
  MeshBuilder,
  StandardMaterial,
  Color3,
  Mesh,
  PointerEventTypes,
  DynamicTexture,
  SceneLoader,
  AbstractMesh
} from '@babylonjs/core';
import '@babylonjs/loaders/glTF';
import { worldState, UnitState } from '../network/WebSocketClient';

interface Props {
  onUnitClick: (unit: UnitState) => void;
}

export default function BabylonScene(props: Props) {
  let canvas: HTMLCanvasElement;
  let engine: Engine;
  let scene: Scene;
  const unitMeshes = new Map<string, AbstractMesh>();
  const playerArrow = { mesh: null as Mesh | null };
  const actionIcons = new Map<string, { plane: Mesh; startTime: number }>();

  onMount(() => {
    // Initialize engine and scene
    engine = new Engine(canvas, true, { adaptToDeviceRatio: true });
    scene = new Scene(engine);
    scene.clearColor = new Color3(0.1, 0.1, 0.1).toColor4();

    // Camera (top-down view)
    const camera = new ArcRotateCamera(
      'camera',
      -Math.PI / 2,
      Math.PI / 4,
      50,
      new Vector3(15, 0, 15),
      scene
    );
    camera.attachControl(canvas, true);
    camera.lowerRadiusLimit = 20;
    camera.upperRadiusLimit = 80;
    camera.lowerBetaLimit = 0.1;
    camera.upperBetaLimit = Math.PI / 2.5;

    // Light
    const light = new HemisphericLight('light', new Vector3(0, 1, 0), scene);
    light.intensity = 0.8;

    // Tile selection function for terrain variety
    const tileModels = [
      { model: "ground_grass.glb", weight: 70 },
      { model: "ground_pathOpen.glb", weight: 10 },
      { model: "rock_smallA.glb", weight: 2 },
      { model: "rock_smallB.glb", weight: 2 },
      { model: "plant_bushSmall.glb", weight: 5 },
      { model: "flower_yellowA.glb", weight: 3 },
      { model: "flower_redA.glb", weight: 3 },
      { model: "flower_purpleA.glb", weight: 3 },
    ];

    const selectTileModel = (x: number, z: number): string => {
      const seed = x * 31 + z * 17;
      const random = (Math.abs(Math.sin(seed)) * 10000) % 100;

      let cumulative = 0;
      for (const tile of tileModels) {
        cumulative += tile.weight;
        if (random < cumulative) return tile.model;
      }
      return "ground_grass.glb";
    };

    // Create border material (shared for all borders)
    const borderMat = new StandardMaterial("borderMat", scene);
    borderMat.diffuseColor = new Color3(0.1, 0.1, 0.1);
    borderMat.specularColor = new Color3(0, 0, 0);

    // Create grid floor with 3D tiles and borders
    for (let x = 0; x < 30; x++) {
      for (let z = 0; z < 30; z++) {
        const tileModel = selectTileModel(x, z);
        SceneLoader.ImportMesh("", "/assets/models/nature/", tileModel, scene,
          (meshes) => {
            if (meshes.length > 0) {
              const tile = meshes[0];
              tile.name = `tile_${x}_${z}`;
              tile.position = new Vector3(x, 0, z);
              tile.scaling = new Vector3(1, 1, 1);
            }
          }
        );

        // Add vertical border (right edge of cell)
        if (x < 29) {
          const vBorder = MeshBuilder.CreatePlane(`vborder_${x}_${z}`,
            { width: 0.05, height: 1 }, scene);
          vBorder.position = new Vector3(x + 0.5, 0.01, z);
          vBorder.rotation.x = Math.PI / 2;
          vBorder.material = borderMat;
        }

        // Add horizontal border (bottom edge of cell)
        if (z < 29) {
          const hBorder = MeshBuilder.CreatePlane(`hborder_${x}_${z}`,
            { width: 1, height: 0.05 }, scene);
          hBorder.position = new Vector3(x, 0.01, z + 0.5);
          hBorder.rotation.x = Math.PI / 2;
          hBorder.material = borderMat;
        }
      }
    }

    // Create compass markers outside the grid
    const createDirectionMarker = (text: string, position: Vector3, color: Color3) => {
      const marker = MeshBuilder.CreateBox(`marker_${text}`, { width: 2, height: 0.5, depth: 2 }, scene);
      marker.position = position;
      const mat = new StandardMaterial(`markerMat_${text}`, scene);
      mat.diffuseColor = color;
      mat.emissiveColor = color.scale(0.3);
      marker.material = mat;

      // Add text label with larger texture
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

    // North (negative Z) - Blue
    createDirectionMarker('North (Up)', new Vector3(15, 0.3, -3), new Color3(0.3, 0.5, 1));
    // South (positive Z) - Red
    createDirectionMarker('South (Down)', new Vector3(15, 0.3, 33), new Color3(1, 0.3, 0.3));
    // West (negative X) - Green
    createDirectionMarker('West (Left)', new Vector3(-3, 0.3, 15), new Color3(0.3, 1, 0.5));
    // East (positive X) - Yellow
    createDirectionMarker('East (Right)', new Vector3(33, 0.3, 15), new Color3(1, 1, 0.3));

    // Pointer events for unit clicking
    scene.onPointerObservable.add((pointerInfo) => {
      if (pointerInfo.type === PointerEventTypes.POINTERDOWN) {
        const pickResult = scene.pick(scene.pointerX, scene.pointerY);
        if (pickResult.hit && pickResult.pickedMesh) {
          const meshName = pickResult.pickedMesh.name;
          if (meshName.startsWith('unit_')) {
            const unitId = meshName.replace('unit_', '');
            const unit = worldState()?.units.find(u => u.id === unitId);
            if (unit) {
              props.onUnitClick(unit);
            }
          }
        }
      }
    });

    // Render loop
    engine.runRenderLoop(() => {
      scene.render();

      // Update action icons (fade out after 3 seconds)
      const now = Date.now();
      for (const [id, icon] of actionIcons.entries()) {
        const elapsed = (now - icon.startTime) / 1000;
        if (elapsed >= 3) {
          icon.plane.dispose();
          actionIcons.delete(id);
        } else {
          // Fade out
          const alpha = 1 - (elapsed / 3);
          if (icon.plane.material) {
            (icon.plane.material as StandardMaterial).alpha = alpha;
          }
        }
      }
    });

    // Handle resize
    window.addEventListener('resize', () => {
      engine.resize();
    });
  });

  createEffect(() => {
    const state = worldState();
    if (!state || !scene) return;

    const myUnitId = localStorage.getItem('myUnitId');

    // Update units
    const currentUnitIds = new Set(state.units.map(u => u.id));

    // Remove dead units
    for (const [id, mesh] of unitMeshes.entries()) {
      if (!currentUnitIds.has(id)) {
        mesh.dispose();
        unitMeshes.delete(id);
      }
    }

    // Add/update units
    for (const unit of state.units) {
      let mesh = unitMeshes.get(unit.id);

      if (!mesh) {
        // Load 3D model for new unit
        // Extract directory and filename from model path for correct texture resolution
        const modelPath = unit.model.split('/');
        const modelFile = modelPath.pop() || unit.model;
        const basePath = `/assets/models/${modelPath.join('/')}/`;

        SceneLoader.ImportMesh("", basePath, modelFile, scene,
          (meshes) => {
            if (meshes.length > 0) {
              const rootMesh = meshes[0];
              rootMesh.name = `unit_${unit.id}`;
              rootMesh.position = new Vector3(unit.x, 0.5, unit.y);
              rootMesh.scaling = new Vector3(0.5, 0.5, 0.5);
              unitMeshes.set(unit.id, rootMesh);
            }
          },
          undefined,
          (scene, message, exception) => {
            // Fallback to colored box if model fails to load
            console.warn(`Failed to load model ${unit.model}, using fallback box:`, message);
            const fallbackMesh = MeshBuilder.CreateBox(`unit_${unit.id}`, { size: 0.8 }, scene);
            fallbackMesh.position = new Vector3(unit.x, 0.5, unit.y);

            const mat = new StandardMaterial(`unitMat_${unit.id}`, scene);
            const hue = parseInt(unit.id.slice(0, 8), 16) % 360;
            const color = Color3.FromHSV(hue, 0.7, 0.9);
            mat.diffuseColor = color;
            mat.specularColor = new Color3(0.2, 0.2, 0.2);
            fallbackMesh.material = mat;

            unitMeshes.set(unit.id, fallbackMesh);
          }
        );
      } else {
        // Update position for existing mesh
        mesh.position = new Vector3(unit.x, 0.5, unit.y);
      }
    }

    // Update player arrow indicator
    if (myUnitId) {
      const myUnit = state.units.find(u => u.id === myUnitId);

      if (myUnit) {
        if (!playerArrow.mesh) {
          // Create arrow indicator (cone pointing down)
          playerArrow.mesh = MeshBuilder.CreateCylinder('playerArrow', {
            diameterTop: 0,
            diameterBottom: 0.4,
            height: 0.6,
            tessellation: 8
          }, scene);

          const arrowMat = new StandardMaterial('playerArrowMat', scene);
          arrowMat.diffuseColor = new Color3(1, 1, 0); // Yellow
          arrowMat.emissiveColor = new Color3(1, 1, 0).scale(0.5);
          playerArrow.mesh.material = arrowMat;
        }

        // Position arrow above player's unit with bobbing animation
        const time = Date.now() / 1000;
        const bobOffset = Math.sin(time * 2) * 0.2;
        playerArrow.mesh.position = new Vector3(myUnit.x, 2.5 + bobOffset, myUnit.y);
      } else if (playerArrow.mesh) {
        // Remove arrow if player unit doesn't exist
        playerArrow.mesh.dispose();
        playerArrow.mesh = null;
      }
    }

    // Handle action events
    if (state.actions && state.actions.length > 0) {
      for (const action of state.actions) {
        const iconId = `${action.unit_id}_${Date.now()}`;

        // Create floating icon
        const plane = MeshBuilder.CreatePlane(iconId, { width: 1, height: 1 }, scene);
        plane.position = new Vector3(action.x, 1.5, action.y);
        plane.billboardMode = Mesh.BILLBOARDMODE_ALL;

        const texture = new DynamicTexture(`iconTexture_${iconId}`, { width: 256, height: 256 }, scene);
        const mat = new StandardMaterial(`iconMat_${iconId}`, scene);
        mat.diffuseTexture = texture;
        mat.emissiveColor = new Color3(1, 1, 1);
        mat.useAlphaFromDiffuseTexture = true;
        plane.material = mat;

        const ctx = texture.getContext();
        ctx.font = 'bold 180px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🗨', 128, 128);
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
      style={{
        width: '100%',
        height: '100%',
        display: 'block',
        outline: 'none'
      }}
    />
  );
}
