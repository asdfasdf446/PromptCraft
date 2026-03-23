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
  PointerEventTypes
} from '@babylonjs/core';
import { worldState, UnitState } from '../network/WebSocketClient';

interface Props {
  onUnitClick: (unit: UnitState) => void;
}

export default function BabylonScene(props: Props) {
  let canvas: HTMLCanvasElement;
  let engine: Engine;
  let scene: Scene;
  const unitMeshes = new Map<string, Mesh>();

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

    // Create grid floor
    for (let x = 0; x < 30; x++) {
      for (let z = 0; z < 30; z++) {
        const tile = MeshBuilder.CreatePlane(`tile_${x}_${z}`, { size: 0.95 }, scene);
        tile.position = new Vector3(x, 0, z);
        tile.rotation.x = Math.PI / 2;
        const mat = new StandardMaterial(`tileMat_${x}_${z}`, scene);
        mat.diffuseColor = new Color3(0.2, 0.2, 0.2);
        mat.specularColor = new Color3(0, 0, 0);
        tile.material = mat;
      }
    }

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
    });

    // Handle resize
    window.addEventListener('resize', () => {
      engine.resize();
    });
  });

  createEffect(() => {
    const state = worldState();
    if (!state || !scene) return;

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
        // Create new unit mesh
        mesh = MeshBuilder.CreateBox(`unit_${unit.id}`, { size: 0.8 }, scene);
        const mat = new StandardMaterial(`unitMat_${unit.id}`, scene);

        // Random color per unit
        const hue = parseInt(unit.id.slice(0, 8), 16) % 360;
        const color = Color3.FromHSV(hue, 0.7, 0.9);
        mat.diffuseColor = color;
        mat.specularColor = new Color3(0.2, 0.2, 0.2);
        mesh.material = mat;

        unitMeshes.set(unit.id, mesh);
      }

      // Update position
      mesh.position = new Vector3(unit.x, 0.5, unit.y);
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
