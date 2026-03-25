# PromptCraft Asset Catalog

Complete catalog of 3D models used in PromptCraft.

---

## Character Models (15 Animals)

All character models are located in `/assets/models/animals/` and share a common texture file.

| Model File | Animal | Notes |
|------------|--------|-------|
| `animal-bunny.glb` | Bunny | Small, cute rabbit |
| `animal-cat.glb` | Cat | Domestic cat |
| `animal-caterpillar.glb` | Caterpillar | Segmented insect |
| `animal-chick.glb` | Chick | Baby chicken |
| `animal-cow.glb` | Cow | Farm animal |
| `animal-dog.glb` | Dog | Domestic dog |
| `animal-elephant.glb` | Elephant | Large mammal with trunk |
| `animal-fish.glb` | Fish | Aquatic creature |
| `animal-giraffe.glb` | Giraffe | Long-necked mammal |
| `animal-hog.glb` | Hog | Wild pig |
| `animal-lion.glb` | Lion | Big cat |
| `animal-monkey.glb` | Monkey | Primate |
| `animal-parrot.glb` | Parrot | Colorful bird |
| `animal-pig.glb` | Pig | Farm pig |
| `animal-tiger.glb` | Tiger | Striped big cat |

### Texture Requirements

- **Shared texture**: `animals/Textures/colormap.png`
- All animal models reference this single texture file
- Must be present for models to render correctly
- Fallback: Colored box if texture fails to load

### Model Assignment

- Backend assigns random animal model on spawn
- Uses duplication minimization algorithm
- First 15 players get unique animals
- After 15, cycles through least-used models

---

## Terrain Models (329 Nature Assets)

All terrain models are located in `/assets/models/nature/`. Used for procedural terrain generation.

### Currently Used in Terrain Generation

| Model File | Weight | Usage |
|------------|--------|-------|
| `ground_grass.glb` | 70% | Base terrain |
| `ground_pathOpen.glb` | 10% | Walkways |
| `rock_smallA.glb` | 2% | Small obstacles |
| `rock_smallB.glb` | 2% | Small obstacles |
| `plant_bushSmall.glb` | 5% | Vegetation |
| `flower_yellowA.glb` | 3% | Decoration |
| `flower_redA.glb` | 3% | Decoration |
| `flower_purpleA.glb` | 3% | Decoration |

### Available Categories

The nature asset pack includes 329 models across these categories:

- **Ground tiles**: grass, paths, dirt, sand, snow
- **Rocks**: small, medium, large, tall stones
- **Trees**: oak, pine, palm, various sizes and seasons
- **Plants**: bushes, flowers, grass clumps
- **Stumps**: tree stumps, logs
- **Structures**: tents, fences, bridges
- **Decorations**: mushrooms, crystals, signs

### Adding Terrain Variety

To add more terrain types, edit `BabylonScene.tsx`:

```typescript
const tileModels = [
  { model: "ground_grass.glb", weight: 70 },
  { model: "tree_small.glb", weight: 5 },  // Add new model
  // ... adjust weights to total 100
];
```

---

## Model Specifications

### Format

- **File format**: `.glb` (GLTF binary)
- **Coordinate system**: Y-up (Babylon.js standard)
- **Units**: 1 unit ≈ 1 grid cell

### Character Models

- **Scale**: 0.5x in-game (scaled down from original)
- **Position**: Elevated to y=0.5 (above terrain)
- **Poly count**: Low-poly (< 5000 triangles)
- **Textures**: Single shared colormap

### Terrain Models

- **Scale**: 1x (original size)
- **Position**: y=0 (ground level)
- **Poly count**: Very low-poly (< 1000 triangles)
- **Textures**: Embedded or separate

---

## Adding New Models

### Character Models

1. **Prepare model**:
   - Export as `.glb` format
   - Ensure textures are in `Textures/` subdirectory or embedded
   - Test in Babylon.js Sandbox: https://sandbox.babylonjs.com/

2. **Add to project**:
   ```bash
   cp new-animal.glb frontend/public/assets/models/animals/
   ```

3. **Update backend** (`backend/game/world.go`):
   ```go
   var availableModels = []string{
       // ... existing models ...
       "animals/new-animal.glb",
   }
   ```

4. **Document**:
   - Add row to table above
   - Update count in `README.md`

### Terrain Models

1. **Prepare model**:
   - Export as `.glb` format
   - Keep poly count low (< 1000 triangles)
   - Test in Babylon.js Sandbox

2. **Add to project**:
   ```bash
   cp new-terrain.glb frontend/public/assets/models/nature/
   ```

3. **Update frontend** (`frontend/src/game/BabylonScene.tsx`):
   ```typescript
   const tileModels = [
       // ... existing tiles ...
       { model: "new-terrain.glb", weight: 5 },
   ];
   ```

4. **Document**:
   - Add to "Currently Used" table above

---

## Model Sources

The current model pack is from Kenney's Nature Kit:
- https://kenney.nl/assets/nature-kit
- License: CC0 (Public Domain)

Animal models are from Kenney's Animal Pack:
- https://kenney.nl/assets/animal-pack
- License: CC0 (Public Domain)

---

## Texture Resolution

### How Babylon.js Resolves Textures

When loading a `.glb` file, embedded texture references (e.g., `Textures/colormap.png`) are resolved relative to the `basePath` parameter in `SceneLoader.ImportMesh()`.

**Correct usage**:
```typescript
const modelPath = "animals/animal-cat.glb".split('/');
const modelFile = modelPath.pop();  // "animal-cat.glb"
const basePath = `/assets/models/${modelPath.join('/')}/`;  // "/assets/models/animals/"

SceneLoader.ImportMesh("", basePath, modelFile, scene, ...);
// Textures resolve to: /assets/models/animals/Textures/colormap.png ✓
```

**Incorrect usage**:
```typescript
SceneLoader.ImportMesh("", "/assets/models/", "animals/animal-cat.glb", scene, ...);
// Textures resolve to: /assets/models/Textures/colormap.png ✗ (404)
```

---

## Performance Considerations

- **Model caching**: Babylon.js caches loaded models automatically
- **Mesh instancing**: Not currently used (each unit has unique mesh)
- **LOD**: Not implemented (models are already low-poly)
- **Texture atlasing**: Single shared texture for all animals

### Optimization Opportunities

1. **Mesh instancing**: Reuse same mesh for units with same model
2. **Texture atlasing**: Combine terrain textures into single atlas
3. **Frustum culling**: Babylon.js handles automatically
4. **Occlusion culling**: Not needed (top-down view, no occlusion)

---

## Troubleshooting

### Models Not Loading

**Symptom**: Colored boxes instead of 3D models

**Causes**:
1. Missing `.glb` file → Check file exists in `public/assets/models/`
2. Missing texture → Check `Textures/colormap.png` exists
3. Incorrect base path → Verify path extraction logic in `BabylonScene.tsx`
4. CORS issue → Ensure dev server serves assets correctly

**Debug**:
```javascript
// Check browser console for:
// "Failed to load model X, using fallback box: <error message>"
// "GET http://.../ Textures/colormap.png 404 (Not Found)"
```

### Texture 404 Errors

**Symptom**: Console shows `404 Not Found` for `Textures/colormap.png`

**Fix**: Ensure base path includes model subdirectory:
```typescript
// ✓ Correct
const basePath = `/assets/models/animals/`;

// ✗ Wrong
const basePath = `/assets/models/`;
```

### Models Too Large/Small

**Fix**: Adjust scaling in `BabylonScene.tsx`:
```typescript
rootMesh.scaling = new Vector3(0.5, 0.5, 0.5);  // Character models
tile.scaling = new Vector3(1, 1, 1);  // Terrain tiles
```

---

## See Also

- [ARCHITECTURE.md](../ARCHITECTURE.md) - Model loading implementation details
- [CONTRIBUTING.md](../CONTRIBUTING.md) - How to add new models
- [frontend/README.md](README.md) - Frontend architecture
