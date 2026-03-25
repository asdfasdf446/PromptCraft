#!/usr/bin/env python3
"""
GLB Analysis Script
Parses .glb files and generates JSON documentation files.

Usage:
    python analyze_glb.py                    # Analyze all models in frontend/public/assets/models/
    python analyze_glb.py path/to/file.glb   # Analyze single file
    python analyze_glb.py path/to/directory  # Analyze directory
"""

import struct
import json
import os
import sys
import math
from pathlib import Path


def parse_glb(glb_path):
    """Parse a GLB file and extract metadata."""
    with open(glb_path, 'rb') as f:
        data = f.read()

    # Parse header (12 bytes)
    magic, version, length = struct.unpack_from('<III', data, 0)
    if magic != 0x46546C67:  # 'glTF' in little-endian
        raise ValueError(f"Not a valid GLB file: {glb_path}")

    # Parse chunks
    offset = 12
    json_data = None

    while offset < length:
        chunk_length, chunk_type = struct.unpack_from('<II', data, offset)
        offset += 8
        chunk_data = data[offset:offset + chunk_length]
        offset += chunk_length

        if chunk_type == 0x4E4F534A:  # JSON chunk ('JSON' in ASCII)
            json_data = json.loads(chunk_data.decode('utf-8').rstrip('\x00'))
            break

    if json_data is None:
        raise ValueError(f"No JSON chunk found in: {glb_path}")

    # Basic metadata
    total_buffer_length = sum(b.get('byteLength', 0) for b in json_data.get('buffers', []))
    num_nodes = len(json_data.get('nodes', []))
    num_meshes = len(json_data.get('meshes', []))
    num_materials = len(json_data.get('materials', []))
    num_animations = len(json_data.get('animations', []))

    # Extract animation names
    animation_names = []
    for i, anim in enumerate(json_data.get('animations', [])):
        name = anim.get('name', f'animation_{i}')
        animation_names.append(name)

    # Find global minimum Y value from POSITION accessors
    global_min_y = math.inf
    has_position_data = False

    for mesh in json_data.get('meshes', []):
        for primitive in mesh.get('primitives', []):
            attrs = primitive.get('attributes', {})
            if 'POSITION' in attrs:
                has_position_data = True
                accessor_idx = attrs['POSITION']
                accessor = json_data['accessors'][accessor_idx]
                if 'min' in accessor and len(accessor['min']) > 1:
                    current_min_y = accessor['min'][1]  # Y is index 1
                    if current_min_y < global_min_y:
                        global_min_y = current_min_y

    # Calculate Y-axis offset
    if not has_position_data:
        y_offset = "ANOMALY: No POSITION data found"
        global_min_y_value = None
    else:
        y_offset = -global_min_y if global_min_y != math.inf else 0
        global_min_y_value = global_min_y if global_min_y != math.inf else None

    return {
        "file": os.path.basename(glb_path),
        "metadata": {
            "total_buffer_length": total_buffer_length,
            "num_nodes": num_nodes,
            "num_meshes": num_meshes,
            "num_materials": num_materials,
            "num_animations": num_animations,
            "animation_names": animation_names
        },
        "geometry": {
            "global_min_y": global_min_y_value,
            "y_axis_offset": y_offset
        }
    }


def analyze_directory(directory):
    """Analyze all GLB files in a directory."""
    directory = Path(directory)
    glb_files = list(directory.glob('*.glb'))

    if not glb_files:
        print(f"No .glb files found in {directory}")
        return

    print(f"\nAnalyzing {len(glb_files)} .glb files in {directory}...")
    print("=" * 80)

    for glb_path in sorted(glb_files):
        try:
            result = parse_glb(glb_path)

            # Save JSON documentation
            json_path = glb_path.with_suffix('.json')
            with open(json_path, 'w') as f:
                json.dump(result, f, indent=2)

            print(f"✓ {glb_path.name}")
            print(f"  → {json_path.name}")
            print(f"  Nodes: {result['metadata']['num_nodes']}, "
                  f"Meshes: {result['metadata']['num_meshes']}, "
                  f"Materials: {result['metadata']['num_materials']}, "
                  f"Animations: {result['metadata']['num_animations']}")

            if result['metadata']['animation_names']:
                print(f"  Animation clips: {', '.join(result['metadata']['animation_names'])}")

            print(f"  Y-axis offset: {result['geometry']['y_axis_offset']}")
            print()

        except Exception as e:
            print(f"✗ {glb_path.name}: {e}\n")


def main():
    if len(sys.argv) < 2:
        # Default: analyze all model directories
        script_dir = Path(__file__).parent
        base_dir = script_dir.parent / 'frontend' / 'public' / 'assets' / 'models'

        if not base_dir.exists():
            print(f"Error: Models directory not found at {base_dir}")
            print(f"Usage: {sys.argv[0]} [glb_file_or_directory]")
            sys.exit(1)

        for subdir in ['animals', 'nature']:
            dir_path = base_dir / subdir
            if dir_path.exists():
                analyze_directory(dir_path)
    else:
        path = Path(sys.argv[1])
        if path.is_dir():
            analyze_directory(path)
        elif path.is_file() and path.suffix == '.glb':
            result = parse_glb(path)
            json_path = path.with_suffix('.json')
            with open(json_path, 'w') as f:
                json.dump(result, f, indent=2)
            print(json.dumps(result, indent=2))
        else:
            print(f"Error: {path} is not a valid .glb file or directory")
            print(f"Usage: {sys.argv[0]} [glb_file_or_directory]")
            sys.exit(1)


if __name__ == '__main__':
    main()
