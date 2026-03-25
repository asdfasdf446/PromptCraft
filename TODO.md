English Translation
1. Debug Tools Wireframe Mode Fix
Currently, toggling Wireframe Mode only affects the direction indicators and the overhead arrow, leaving the character model unaffected. Update the logic so that the character's .glb model materials synchronously switch to wireframe rendering when this mode is enabled.

2. Character Movement Animation & Smooth Rotation Optimization

Animation Looping: The movement animation currently plays once, causing the character to slide stiffly if the movement action is still in progress. Modify this to loop the walk/move animation continuously until the destination is reached.

Smooth Turning: Eliminate instant translation when changing directions. Implement a smooth rotation transition around the vertical axis so the character naturally turns to face the new direction before moving forward.

3. Character Altitude/Grounding Correction
The character model is currently floating above the ground. Inspect and fix the model's origin positioning or bounding box calculation logic to ensure the bottom of the mesh rests naturally on the ground plane.

4. Day/Night Lighting Cycle Optimization
Extend the full lighting cycle duration from 30 seconds to 3 minutes. Improve the color interpolation algorithm to eliminate any sudden color shifts, ensuring a completely smooth and seamless transition throughout the cycle.

5. Self-Character Overhead Indicator (Arrow) Optimization

Orientation Fix: Invert the overhead cone indicator so the tip points downward (pointing at the character) instead of upward.

Breathing Animation: Fix the current jagged/teleporting vertical movement. Implement a smooth mathematical curve (e.g., a sine wave) to create a fluid, natural up-and-down "breathing" hover animation.
