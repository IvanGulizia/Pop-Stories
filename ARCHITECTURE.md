# ARCHITECTURE

This document describes the *currently implemented* architecture.

## IMPLEMENTED
- **Framework**: React 18, Vite, TypeScript.
- **Styling**: Tailwind CSS.
- **State Management**: Zustand (`useSceneStore`).
- **Layout Architecture**:
  - Top navigation bar (`App.tsx`) with mode toggles (Édition vs Play), creation trigger, rulebook drawer trigger, inspector toggle, and scene clear.
  - Immersive full-canvas workspace (`Scene.tsx`) with empty state prompt.
  - Retractable side-drawer for the Entity Inspector (`Inspector.tsx`).
  - Bottom slide-over drawer for the RuleBook (`RuleBook.tsx`) with category filters.
- **Entity System**: 
  - Flat dictionary of entities keyed by `EntityId`.
  - Hardcoded predefined entity types: `plant`, `apple`.
  - Custom vector entities: `custom` holding structured `VectorPath[]` array.
  - Each entity has `states` (dictionary of `EntityState` containing visual properties like color, scale, rotation, stemHeight, vectorPaths, etc.).
- **Rule Engine**:
  - Global RuleBook (`DynamicRule` array in the store).
  - Triggers: `collision` (AABB bounding box) and `click` / pointer events.
  - Trigger Phases: `enter`, `stay`, `release`, `click`, `mouse_down`, `mouse_up`.
  - Selectors: `type`, `tag`, `instance` filtering for both subject and target.
  - Actions: `change_state`, `toggle_draggable`, `delete_entity`, `spawn_entity`, `play_sound`.
- **Canvas / Drawing**:
  - Interactive 100% SVG Vector Editor (`DrawingCanvas`) capturing path strokes (`VectorPath[]`), vector shape primitives (circle, square, star), stroke width, colors, and path eraser.
  - 100% Vector rendering in scene entities (`CustomShape`).
- **Drag & Drop**:
  - Handled via `motion/react` (Framer Motion) on individual entity components.
  - Temporary position evaluation during drag for collision triggers.

## PLANNED / EXPERIMENTAL (Not fully implemented)
- **Vector morphing / SVG interpolation**: Interpolating paths between different states of the same entity.
- **Advanced 2D Physics**: Gravity, mass, bouncing, friction.
