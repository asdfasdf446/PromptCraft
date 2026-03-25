Now that you have understood the structure and background of this project, I need you to upgrade the following content. First, I will inform you of the current status of this game. You need to check if the corresponding code matches what I have described. Then, I will tell you my expected upgrade goals. Finally, based on some hints, such as the general paths of the files that need to be modified and the tools to be used, I will leave a "Completion Status" list. Note that this is for you to fill in. You need to answer whether it is completed and how you completed it.

## Scripts
1. Add Scripts Directory：
	- Current State: The root directory lacks a dedicated folder for scripts.
	- Optimization Goal: Create an empty directory in the root (e.g., `/scripts`) to store common utility scripts.
	- Hint: None.
	- Completion Status:
2. Develop and Execute GLB Analysis Script：
	- Current State：`.glb` models are stored in the frontend public assets folder without accompanying documentation (e.g., bounding boxes, animation lists), making collaboration between technical artists and frontend developers difficult. 
	- Optimization Goal：
		- Write a `.glb` parsing script in the scripts directory.
		- Execute this script to automatically generate corresponding JSON documentation files in the same directory as each `.glb` file
	- Hint: Reference the pseudo-code for core data to extract: basic metadata (total Buffer length, node/mesh/material/animation counts), the global minimum Y-value of the geometric bounding box, and the Y-axis offset value (if no POSITION data exists, mark as an anomaly; otherwise, use the negated global minimum Y-value).
```
Input: GLB file path (glb_path) 
Process: Analysis and Interpretation of GLB (glb_path): 
// 1. File loading and unpacking
gltf_object = Load GLB file and parse the internal JSON data block (glb_path) 
// 2. Basic Metadata Statistics
Total Buffer Length = Sum of byteLength of gltf_ object.buffers
Number of Nodes = Length of gltf_ object.nodes
Number of Meshes = Length of gltf_ object.meshes
Number of Materials = Length of gltf_ object.materials
Number of Animations = Length of gltf_ object.animations 
// 3. Extraction of extreme values of the geometric bounding box (calculation of core coordinates)
Global minimum Y value = Positive infinity 
Iterate over each mesh in gltf_ object.meshes:
Iterate over each primitive in mesh.primitives:
If the primitive contains the POSITION attribute: 
// Find the corresponding data accessor through the index
Accessor index = primitive.attributes.POSITION
Accessor = gltf_object.accessors[accessor index] 
// The min array in the accessor records the minimum coordinates [X, Y, Z] of the bounding box of this graphic element.
// Index 1 corresponds to the Y-axis.
The current lowest Y value of the graphic element = accessor.min[1] 
If the lowest Y-coordinate of the current graphic element is less than the global lowest Y-coordinate:
Set the global lowest Y-coordinate to the lowest Y-coordinate of the current graphic element. 
// 4. Calculate the compensation value
If the global minimum Y value is equal to positive infinity:
Y-axis compensation value = Exception (POSITION data not found)
Otherwise:
Y-axis compensation value = Inverse (global minimum Y value) 
// 5. Output Results
Format and generate the analysis report (metadata statistics, global minimum Y value, Y-axis compensation value)
Save the report to a local file
Print the report in the terminal 
Completion process
```

## Frontend
1. UI Architecture Optimization:
	- Current State: The underlying logic for the current UI (System Clock, player status) is unclear.
	- Optimization Goal: Evaluate the existing UI implementation. If it relies on custom, hand-written logic, refactor it to use a mature, standard UI library. If it already uses built-in logic from a robust library, leave it unchanged.
	- Hint: Evaluate first, then execute
	- Completion Status:
2. Implement Debug Status Bar:
	- Current State: The interface currently only features player status, a system clock, and a bottom command input bar.
	- Optimization Goal: Add a new interactive "Debug Status Bar" with the following checkboxes:  
		- Wireframe Mode: Toggles model textures off to display geometric wireframes, used for positioning and scaling. 
		- Grid Helper: Toggles the visibility of the checkerboard-like ground grid (currently visible by default). 
		- Performance Monitor: Displays current memory usage, FPS, and client-server communication latency.
	- Hint: Add other standard, toggleable visual debug tools based on industry practices as needed. 
	- Completion Status:

## Art & Lighting:
1. Implement Day/Night Cycle:
	- Current State: The world background is currently pure black. 
	- Optimization Goal: Introduce a directional light (sunlight) and a day/night cycle system. Set the cycle to 30 seconds per rotation, divided into four phases: Morning (6:00-12:00), Afternoon (12:00-18:00), Evening (18:00-24:00), and Midnight (0:00-6:00). Integrate these states into the System Clock.
	- Hint: None. 
	- Completion Status:

## Modeling & Animation
1. Optimize Character Animations and Speech Bubbles
	- Current State: 
		- Character movement is instantaneous with no transition.
		- Characters lack animations and appear rigid.
		- Action-triggered speech bubbles have a rendering bug (displaying as black bubbles without text). 
	- Optimization Goal: 
		- Fix Bubble Bug: Inspect the logic generating bubbles for corresponding actions and fix the missing text bug. 
		- Smooth Movement and Rotation: Implement character turning and a 2-second smooth translation for movement (a 2-second animation fits safely within the 5-second System Clock interval). 
		- Animation State Machine: Trigger corresponding animations for specific actions (e.g., call `walk` for movement, `attack` for attacking). If a model lacks the target animation clip, default to a static pose and output a Warning log. 
	- Hint: Utilize the data from the previously generated GLB JSON documentation. For future scalability, consider encapsulating the character binding and animation logic into a separate file.
	- Completion Status:

