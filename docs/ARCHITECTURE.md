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
1. **Renderer & Studio Vectoriel Unifié :** Moteur partagé (`utils/vectorDrawing.ts`, `utils/floodFill.ts`) pilotant identiquement l'atelier d'entités/états (`DrawingCanvas` + sous-modules `components/drawing/*`, `FullScreenDrawingModal` + dock `components/timeline/*`, `CreateEntityModal`) et les calques de scène WYSIWYG (`Scene`, `DrawingToolsPanel`), avec calques (`DrawingLayers`) et Timeline Easy Frame par Frame (`frames`, `frameRate`, `animationLoop`).
2. **Interaction System (`hooks/useEntityPointerInteraction.ts`) :** Hook partagé gérant le drag à la souris avec échantillonnage de vélocité pour l'inertie de lâcher, le redimensionnement, la délégation parent (`dragDelegationRegistry`), `ignorePointer`, les clics et le survol de manière uniforme entre `CustomShape`, `Apple` et `Plant`.
3. **Moteur Physique 2D (Matter.js) & Solveurs Modulaires (`matterPhysicsEngine.ts`, `utils/physics/*`) :** Simulation réaliste de corps rigides avec sous-stepping `<= 16.666 ms`, gestion de la gravité, impulsion de choc solide, friction, restitution et capteurs fantômes (`isTrigger` / `isSensor`), appuyée sur des modules purs testés sous Vitest (`behaviorResolution.ts`, `lookAtSolver.ts`, `hierarchyPhysicsSync.ts`, `colliderLayerPhysics.ts`, `pivotHelpers.ts`, `springJiggleSolver.ts`). Les contraintes d'attachement élastique (`spring` / `physics_joint`) et les oscillations rotationnelles (`jiggle`) opèrent autour du pivot effectif (`entity.pivot` / `state.pivot` / `jiggle.pivotOverride`).
4. **Moteur de Comportements (ECS) & UI Modulaire (`components/behaviors/*`) :** Comportements configurables au niveau entité et surchargeables par état (`getEffectiveBehaviors`), édités via `BehaviorManager` et ses sous-modules par domaine (`HitboxColliderCard`, `AddBehaviorModal`, `PhysicsAndCoreBehaviorControls`, `MovementAndAIBehaviorControls`, `VisualAndSurvivalBehaviorControls`, `InteractivePuppetControls`, `JiggleBehaviorControls`).
5. **Store, Rule Engine & RuleBook Modulaire (`store/useSceneStore.ts`, `storeDefaults.ts`, `parentingHelpers.ts`, `collisionHelpers.ts`, `ruleExecutionEngine.ts`, `components/RuleBook.tsx`, `components/rulebook/*`) :** Écoute les déclencheurs (collisions, clics, survols, chronos, touches clavier, seuils de score, changements d'état) et exécute les chaînes d'actions séquentielles via un pont découplé sans import circulaire, couvert par la suite `src/__tests__/*`, avec éditeur Storyboard modulaire (`RuleCreationWizardModal` + `WizardStep1/2/3`, `RuleSlotEditModal` + `RuleSubjectTargetModal` / `RuleEventModal` / `RuleActionModal`, `RuleActionSummaryBadge`).
6. **Système Unifié de Gizmos de Scène (`SceneGizmoOverlay` + `AppSettings.gizmos`) :**
   - **Règle d'architecture durable :** Tous les gizmos visuels (hitbox, calques colliders, liens parent-enfant & pivots, cônes `LookAt`, orbites de pupille, rayons `InteractivePuppet`, zones IA, vecteurs vitesse, émetteurs de particules, ressorts & cônes `Jiggle`) doivent être rendus dans la couche SVG mondiale dédiée `<SceneGizmoOverlay />` (`pointer-events-none`) superposée au canvas dans `Scene.tsx`. Ils ne doivent **jamais** être confinés à l'intérieur des conteneurs d'entités (qui subissent des `clipPath` et des dimensions bornées).
   - **Paramétrage centralisé :** Chaque catégorie de gizmo est déclarée dans `GizmoCategoryId` et pilotée depuis la section dédiée *Gizmos & Debug Visuel* de `SettingsPanel.tsx` avec 4 modes (`off` | `edit` | `play` | `both` — défaut `'edit'`) + option *Entité sélectionnée uniquement*. Tout futur comportement spatial ou géométrique ajouté à l'application doit déclarer son gizmo dans cette couche.
7. **Hiérarchie & Délégation Hitbox :**
   - Fidèle au modèle unifié *« Tout est une Entité »*, les composants principaux restent portés par l'entité racine (« parent final ») plutôt que sur un conteneur Groupe abstrait.
   - Chaque entité (notamment un enfant attaché via `parentId`) dispose dans sa carte *Hitbox & Collider* de modes dédiés (`colliderMode: 'default' | 'trigger_only' | 'disabled'`, `pointerDelegation: 'self' | 'parent' | 'root_parent'`, `ignorePointer`) permettant de désactiver sa physique tout en déléguant la saisie souris/drag vers le parent final en mode Play, ou d'opter pour un mode d'attache `spring` / `physics_joint` avec `collideWithWorld` contre murs, sols et objets tiers.
