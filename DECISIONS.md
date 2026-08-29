# DECISIONS

## Decision 001
Date: 2026-08-09
### Decision
Use entity-oriented composition with flat states rather than complex inheritance.
### Why
Keeps the system understandable, flexible, and easy to map to a JSON state for the Rule Engine.
### Status
VALIDATED

## Decision 002
Date: 2026-08-09
### Decision
Use Zustand for a centralized scene state manager.
### Why
Simplifies the communication between the Canvas/Scene, the Inspector, and the RuleBook without deep prop drilling.
### Status
VALIDATED

## Decision 003
Date: 2026-08-09
### Decision
Implement Rule Engine triggers based on `subject` and `target` matching via `type`, `tag`, or `instance`.
### Why
Allows for scalable, systemic rules (e.g., "All apples affect all plants") without creating rules for every single instance.
### Status
VALIDATED

## Decision 004
Date: 2026-08-09
### Decision
Use 100% vector drawing representations (SVG path commands `VectorPath[]`) for custom shapes and drawn entities.
### Why
Enables vector path manipulation, smooth rendering, future state interpolation/morphing, and vector collision properties.
### Status
VALIDATED
