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
1. **Renderer :** Affiche les SVG en fonction de l'état courant. Utilise `motion` pour animer les changements.
2. **Interaction System :** Gère le drag, les clics.
3. **Rule Engine (Minimal) :** Écoute les événements (ex: `onCollision`, `onClick`) et déclenche les actions d'état (`changeState`).
