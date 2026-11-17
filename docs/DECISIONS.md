# Décisions d'Architecture (ADR)

## ADR-001 : Couche Unifiée de Gizmos de Scène (`SceneGizmoOverlay`)
- **Date :** 2026-11-16
- **Contexte :** Les gizmos de debug (auparavant limités à un booléen `showColliderDebugGizmos` rendu dans chaque entité) sont indispensables pour régler des comportements dont la portée dépasse la boîte de l'entité (rayons Marionnette `280px`, zones de fuite/balade, cônes `LookAt`, liens parent-enfant).
- **Décision :**
  - Centraliser tous les gizmos dans `<SceneGizmoOverlay />` au niveau du canvas `Scene.tsx` (`z-[45]`, `pointer-events-none`).
  - Structurer `AppSettings.gizmos` avec un mode par catégorie (`'off' | 'edit' | 'play' | 'both'`, défaut `'edit'`), un interrupteur maître et un filtre *Entité sélectionnée uniquement*.
  - Exposer ces contrôles dans une section dédiée *Gizmos & Debug Visuel* dans `SettingsPanel.tsx` (et non sur le canvas).
  - Règle pérenne : tout nouveau comportement géométrique ou spatial doit intégrer son rendu gizmo dans `SceneGizmoOverlay` et sa catégorie dans `gizmoConfig`.
- **Conséquences :** Aucun découpage par `clipPath`, rendu uniforme, désactivation sélective selon le mode Édition/Play sans encombrer le canvas ni la vue de jeu par défaut.

## ADR-002 : Composition Hiérarchique sur l'Entité « Parent Final » vs Objet Groupe
- **Date :** 2026-11-16
- **Contexte :** Lors de la création de marionnettes multi-parties (Corps → Tête → Œil → Pupille), faut-il déplacer les composants vers un objet « Groupe » ou les conserver sur l'entité racine ?
- **Décision :** Conserver les composants sur une **Entité** (« parent final » / racine), et non créer un type `Group` parallèle porteur de composants.
- **Raisons :** L'ensemble des systèmes (Matter.js, RuleBook, overrides d'états, tags) repose sur le modèle unifié `Entity`. Compléter cela par une délégation d'interaction sur la hitbox des enfants (`pointerDelegation: 'parent' | 'root_parent'`) offre la même ergonomie qu'un groupe sans dupliquer le moteur.

## ADR-003 : Hitbox Désactivable & Délégation Pointeur/Drag
- **Date :** 2026-11-16
- **Décision :** Ajouter `colliderMode` (`default` | `trigger_only` | `disabled`), `pointerDelegation` (`self` | `parent` | `root_parent`) et `ignorePointer` sur `Entity`.
- **Comportement :** En Mode Édition, chaque enfant reste sélectionnable et manipulable individuellement sur le canvas. En Mode Play, `pointerDelegation` transmet le drag Framer Motion (`dragDelegationRegistry`), le survol et les clics à l'ancêtre cible, et `colliderMode === 'disabled'` supprime le corps Matter.js et les détections de collision.

## ADR-004 : Flip Contextuel dans `LookAt`
- **Date :** 2026-11-16
- **Décision :** Ajouter `flipMode: 'none' | 'flipX'`, `facingDirection: 'right' | 'left'` et `flipDeadzone` (px) à `LookAtBehaviorConfig`, avec un gizmo de secteur angulaire (`±maxAngle`) et d'axe de base. Permet à une tête ou un personnage de se retourner proprement sans jamais pivoter la tête à l'envers.

## ADR-005 : Refactorisation progressive par Lots (Sans régression)
- **Date :** 2026-11-16
- **Décision :**
  - Unifier toute la logique de pointeur/drag/resize/délégation des entités dans `src/hooks/useEntityPointerInteraction.ts` (Lot A), tout en conservant `Apple.tsx` et `Plant.tsx` discrètement pour rétrocompatibilité sans qu'aucun module cœur n'en dépende.
  - Découper les grands composants UI par domaine (`src/components/behaviors/*` pour `BehaviorManager.tsx` en Lot B), avant de mener d'autres lots similaires (`RuleBook`, `useSceneStore`, `matterPhysicsEngine`) et une future phase dédiée aux interpolations intra-état / inter-états.

## ADR-006 : Stratégie Progressive pour les Interpolations & Timeline Avancée (Chantier Différé)
- **Date :** 2026-11-17
- **Statut :** Planifié / En attente (autres priorités fonctionnelles à traiter d'abord)
- **Contexte :** Besoin d'apporter de la fluidité organique (à la manière de `Plant`) aux entités dessinées (`CustomShape`), sans alourdir le workflow rapide ni créer une usine à gaz autour du morphing de traits libres (appariement de tracés, sens début/fin, nombre de points).
- **Décision d'Architecture Progressive :**
  1. **Préserver la Timeline Easy intacte** : Les états utilisant le mode *Frame par Frame* (`frames`) conservent leur comportement et des transitions d'état instantanées par défaut.
  2. **Modèle de données basé d'abord sur les Calques (Layers) — compatible futur Morphing & Graphe** :
     - **Étape 1 (Intra-État — Timeline Avancée par Calques)** : Keyframes temporelles animant `position`, `rotation`, `scale`, `pivot` et `opacity` par `layerId` (avec courbes `easing`), accompagnées d'une action rapide pour isoler une sélection sur un nouveau calque sans imposer « 1 trait = 1 calque ».
     - **Étape 2 (Inter-États — Transitions par Calques)** : Bouton explicite `Instantané | Interpolé` sur les transitions d'états (avec durée, courbe et option type *Exit Time*), appariement par calque de même nom/ID, et lecteur de prévisualisation directe `État A ➔ État B` sans imposer un éditeur de graphe complet.
     - **Étape 3 (Plus tard, optionnel — Morphing de Traits Libres)** : Extension compatible sur les mêmes keyframes/transitions avec indicateurs visuels de sens du trait (`Début ➔ Fin`) et appariement explicite des tracés.
     - **Étape 4 (Optionnel — Vue Graphe State Machine)** : Surcouche visuelle facultative s'appuyant sur le même modèle de transitions.

## ADR-007 : Séparation Damping/Ressort (Translation) vs Jiggle (Rotation sur Pivot) & Pivot Multi-Niveaux WYSIWYG
- **Date :** 2026-11-17
- **Contexte :** Distinguer proprement le suivi souple par ressort/damping (tête qui suit avec retard et laisse max, membres semi-ragdoll pouvant collisionner avec le décor) de l'oscillation rotative secondaire autour d'un point d'ancrage (`Jiggle` + léger squash & stretch façon *MudBun*), tout en restant 100 % compatible avec `LookAt`, `FlipX`, `InteractivePuppet` et la physique Matter.js.
- **Décision :**
  - **Pivot multi-niveaux (`pivotHelpers.ts`)** : Priorité explicite `pivotOverride` (composant Jiggle) > `state.pivot` > `entity.pivot` > `{ x: 0.5, y: 0.5 }`, modifiable visuellement dans l'Atelier de dessin (`DrawingCanvasPivotOverlay` / `DrawingPivotSection`) et dans l'Inspecteur.
  - **Ressort translationnel sur les liens existants** : Extension de `ParentOffset` (`attachmentMode: 'rigid' | 'spring' | 'physics_joint'`, `collideWithWorld`) et `FollowBehaviorConfig` (`followMode: 'constant_speed' | 'spring'`) afin de couvrir à la fois les attaches parents élastiques, les joints physiques contre murs/sols/objets (sans auto-collision parent via groupe négatif) et les objets suiveurs autonomes.
  - **Composant dédié `jiggle`** : Calcul rotationnel additif (`runtimeJiggleAngle`, `runtimeScaleX`, `runtimeScaleY`) indépendant de la rotation de base (`LookAt` / état), garantissant zéro conflit lors de la composition.

