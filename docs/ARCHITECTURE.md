# Architecture Initiale

## Principes
Privilégier une architecture simple, modulaire et évolutive. Ne pas sur-architecturer avant d'en avoir le besoin.

## Stack Recommandée pour le MVP
- **Moteur de Rendu :** React DOM + SVG. Parfait pour la manipulation vectorielle simple et la sérialisation.
- **Animation / Interpolation :** `motion` (Framer Motion). Gère nativement les transitions d'états, le drag, et l'interpolation fluide des propriétés (scale, rotate, color).
- **Gestion d'État (Scene Graph) :** React State / Context (évoluera vers Zustand si les performances ou la complexité l'exigent).

## Modèle de Données (Conception)

```typescript
type EntityId = string;
type StateId = string;

interface Scene {
  entities: Record<EntityId, Entity>;
}

interface Entity {
  id: EntityId;
  name: string;
  position: { x: number, y: number };
  
  // États exclusifs
  currentStateId: StateId;
  states: Record<StateId, EntityState>;
  
  // Comportements injectés (Composition)
  behaviors: Behavior[];
  
  // Règles spécifiques à l'entité
  rules: Rule[];
}

interface EntityState {
  id: StateId;
  name: string;
  visual: SVGVisualData; // Les tracés, couleurs, etc.
  rules: Rule[]; // Règles actives uniquement dans cet état
}

// Brique logique : Quand [Condition] -> Alors [Action]
interface Rule {
  trigger: EventTrigger;
  action: Action;
}
```

## Systèmes
1. **Renderer & Studio Vectoriel Unifié :** Moteur partagé (`utils/vectorDrawing.ts`, `utils/floodFill.ts`) pilotant identiquement l'atelier d'entités/états (`DrawingCanvas`, `FullScreenDrawingModal`, `CreateEntityModal`) et les calques de scène WYSIWYG (`Scene`, `DrawingToolsPanel`), avec calques (`DrawingLayers`) et Timeline Easy Frame par Frame (`frames`, `frameRate`, `animationLoop`).
2. **Interaction System :** Gère le drag à la souris avec échantillonnage de vélocité pour l'inertie de lâcher, les clics et le survol.
3. **Moteur Physique 2D (Matter.js) :** Simulation réaliste de corps rigides (`matterPhysicsEngine.ts`) avec sous-stepping `<= 16.666 ms`, gestion de la gravité, impulsion de choc solide, friction, restitution et capteurs fantômes (`isTrigger` / `isSensor`).
4. **Moteur de Comportements (ECS) :** Comportements configurables au niveau entité et surchargeables par état (`getEffectiveBehaviors`) : contrôles joueur (avec liaisons d'états visuels et garde-fou non-écrasant), santé/dégâts, patrouille, balade aléatoire, fuite, visée, suivi, vitesse continue, bordures, émetteur de particules et déplaçable.
5. **Rule Engine :** Écoute les déclencheurs (collisions, clics, survols, chronos, touches clavier, seuils de score, changements d'état) et exécute les chaînes d'actions séquentielles.
