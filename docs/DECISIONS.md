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

## ADR-008 : Curseur Chrome Sans Scintillement, Pick Spawn sur Scène & `Matter.Constraint` Rotatif
- **Date :** 2026-11-17
- **Décisions :**
  - **Curseur Custom 60/120 FPS (`CursorContext.tsx`)** : Ne jamais stocker les coordonnées `pointermove` dans un `useState` React ni laisser coexister des classes `cursor-pointer` / `cursor-grab` sur les entités lorsque le curseur custom est actif ; appliquer directement `transform: translate3d(...)` sur la ref DOM et masquer le curseur natif via une règle globale PNG 1×1 transparent (`.atelier-cursor-hidden`).
  - **Pick Spawn Direct sur Canvas (`useSceneStore.ts` + `App.tsx`)** : Conserver `<RuleBook />` monté (masqué en CSS `hidden` pendant `spawnCanvasPick !== null`) afin que la sélection de coordonnées sur le canvas réel préserve intégralement l'état local des modales et de l'assistant.
  - **`physics_joint` (`matterPhysicsEngine.ts`)** : `Matter.Constraint.solve` conserve `pointB` en repère monde tourné et ne le réoriente que via `bodyB.angle - constraint.angleB`. Tout recalcul de l'attache doit donc appliquer `rotateVector(localPointB, body.angle)` et synchroniser `angleB = body.angle` pour éviter que le corps ne reste figé sous l'ancre.

## ADR-009 : Joint Physique Angulaire (Butées, 2e Angle de Freinage, Ressort) & Point d'Attache Unifié (`jointChildPivot`)
- **Date :** 2026-11-18
- **Décisions :**
  - **Pivot d'attache local sans déplacement visuel (`parentingHelpers.ts` + `pivotHelpers.ts`)** : Introduire `ParentOffset.jointChildPivot` au plus haut niveau de priorité de `resolveRawPivot` (juste sous l'override runtime/Jiggle) avec plage `[-4, 5]` pour permettre des pivots même hors boîte (orbitaux). Placer ou glisser le pin sur la scène met à jour simultanément `(parentOffset.x, parentOffset.y, jointChildPivot)` via `computeParentOffsetFromWorldPin`, préservant la position visuelle des entités déjà disposées (même tournées).
  - **Résolution angulaire par sous-pas (`jointAngularSolver.ts` + `matterPhysicsEngine.ts`)** : Appliquer le ressort angulaire, l'amortissement et le 2e angle de freinage doux (`jointBrakeAngle` / `jointBrakeStrength`) en pré-pas sur la vélocité angulaire Verlet, puis imposer la butée dure `[minAngle, maxAngle]` en post-pas en faisant pivoter le corps rigide exactement autour du pin monde afin d'éviter toute dérive linéaire aux butées, tout en couplant `bodyA` pour les chaînes multi-maillons dynamiques `A → B → C`.

## ADR-010 : Saisie Physique Précise, Pivot de Balancement & Rupture Sans Recréation de Corps
- **Date :** 2026-11-18
- **Décisions :**
  - **Contrainte ressort Matter.js (`mouseGrabConstraints`) plutôt que déplacement cinématique** : Lorsque `precisePhysicsGrab` est actif sur une entité à physique dynamique (`physics`, `physics_joint`, ou `spring+collideWithWorld`), le drag contourne Framer Motion et pilote un `Matter.Constraint` de longueur nulle au point local cliqué, préservant la rotation sous gravité, les collisions décor et la traction réelle sur les joints.
  - **Réancrage visuel & signature corps stable à la rupture (`brokenJointDynamicIds`)** : Enlever `attachMode` et `collideWithWorld` de `bodySignatures` (déjà reflétés par `isStatic`/`isSensor`) et conserver les entités détachées par rupture dans `brokenJointDynamicIds` garantit que `detachEntity` ne détruit ni ne recrée le `Matter.Body`, préservant ainsi l'élan angulaire, la prise en main active et la chute gravitaire immédiate.

## ADR-011 : Registre Unifié `gameVariables`, Priorité `slider > draggable` & `sliderSolver` Pur
- **Date :** 2026-11-19
- **Contexte :** Introduire des variables numériques globales exploitables à la fois par les règles (`RuleBook`), le `slider` contraint et le `stroke_wiggle` modulé, sans casser la rétrocompatibilité des règles `score` existantes ni entrer en conflit avec `draggable` / `interactive_puppet`.
- **Décisions :**
  - **Synchronisation bidirectionnelle `'score'` ↔ `gameScore`** : `initialGameVariables` (`{ score: 0 }` par défaut) et `gameVariables` coexistent avec `gameScore` et `add_score`. Toute lecture ou écriture sur `'score'` (via `set_variable`, `add_score`, `setGameVariable`, `batchSetGameVariables` ou `reset`) maintient `gameScore` et `gameVariables.score` strictement synchronisés.
  - **Priorité stricte `slider` dans `isEntityDraggable`** : Lorsqu'un comportement `slider` actif est présent, `useEntityPointerInteraction` et `matterPhysicsEngine` routent le drag vers `sliderSolver` (en contournant le drag libre et Framer Motion `throwable`), supprimant tout conflit d'entrée souris.
  - **Solveur pur `sliderSolver.ts` + rendu Play découplé** : Toute la cinématique 1D/2D (projection sur rail, bornes, crantage strict/magnétique, ressort de rappel et mapping `outputMin..outputMax`) est isolée en fonctions pures testables, tandis que `Scene.tsx` / `SceneGizmoOverlay.tsx` gèrent le rendu du rail en Play (`showTrackInPlay`) et Édition (`sliders`).

## ADR-012 : Portail Temporel des Déclencheurs (`triggerGate.ts`) & Synchronisation Multi-Scènes Rétrocompatible
- **Date :** 2026-11-20
- **Contexte :** Introduire des limites universelles (`1×`, `N×`, cooldown, délai initial, front montant) sur tous les déclencheurs et permettre des projets multi-scènes sans réécrire les composants consommateurs (`Scene.tsx`, `Inspector.tsx`, `RuleBook.tsx`, `matterPhysicsEngine.ts`).
- **Décisions :**
  - **Portail pur hors store (`triggerGate.ts`)** : Centraliser `ruleFireCounts`, `ruleLastFireTimestamps`, `ruleConditionWasTrue` et `playSessionStartedAt` dans un module dédié réinitialisé à chaque lancement Play, Stop/Reset et changement de scène en Play, garantissant une sémantique uniforme entre tous les événements (y compris `collision` et `state_change`).
  - **Synchronisation bidirectionnelle `scenes[]` ↔ champs racine du store** : Conserver `entities`, `entityOrder`, `rules`, `folders`, `layerGroups` et `backgroundColor` à la racine du store pour la scène active tout en les synchronisant dans `scenes[]` via `syncActiveSceneIntoScenes`. L'import legacy mono-scène s'encapsule automatiquement en `scene-1`.
  - **Conservation des `gameVariables` inter-scènes + restauration de scène initiale au Stop** : En Play, `changeSceneInPlay` réinitialise Matter.js, particules, timers et compteurs de règles de la nouvelle scène tout en préservant `gameVariables`/`gameScore` ; au retour en Édition, la scène de départ (`snapshotActiveSceneId`) et les entités initiales (`snapshotScenes`) sont restaurées tout en préservant les règles éditées pendant le jeu.

## ADR-013 : Caméra 2D 60 FPS sans Re-Render React, Parallaxe par Calque & Transitions Étendues
- **Date :** 2026-11-20
- **Contexte :** Introduire un monde plus grand que le viewport, le suivi caméra, le zoom, le *Screen Shake* et la parallaxe multi-calques (`parallaxFactor`) tout en préservant une fluidité 60 FPS constante et une rétrocompatibilité totale avec les scènes 1:1 existantes.
- **Décisions :**
  - **Runtime caméra impératif (`cameraSolver.ts` + `cameraRuntime.ts`) & Transform DOM directe** : En Mode Play, le contrôleur caméra tourne à 60 FPS dans la boucle `requestAnimationFrame` de `Scene.tsx` et applique `transform` directement via refs DOM sur la couche caméra, la grille monde, chaque calque décor (`computeLayerParallaxTransform`) et `<ParticleCanvasOverlay />` sans déclencher de `setState` React par frame.
  - **Espace Monde Unifié pour la Physique & Conversions Pointeur** : Les murs Matter.js, le culling viewport (`isEntityVisibleInCameraViewport`), le spawn aléatoire et les règles `boundary` utilisent `resolveWorldBounds(sceneBounds, camera)`, tandis que `screenToWorldPoint` / `worldToScreenPoint` assurent une précision au pixel près des clics, drags, colliders tournés et captures sur canvas même sous zoom et pan.
  - **Rétrocompatibilité par défaut** : Toute scène sans configuration explicite reste en `worldMode: 'viewport'` (`camera: (0, 0, zoom=1)`), les calques de fond créés restent à `parallaxFactor: 0` (fixes) et les calques décor/entités à `1`, garantissant un comportement strictement identique aux projets existants.

## ADR-014 : Collisions Directionnelles Carrées, `rotate_drag` Pur & Transition Push par Instantané
- **Date :** 2026-11-20
- **Contexte :** Enrichir le gameplay plateforme/arcade et l'ergonomie sans régression (détection de face sur collision carrée, plateformes traversables par le bas, cadran rotatif au drag, transition de scène *Push* poussant réellement l'ancienne scène).
- **Décisions :**
  - **Solveurs purs isolés (`patrolSolver.ts`, `rotateDragSolver.ts`, `collisionHelpers.ts`)** : Conserver toute la logique mathématique de patrouille (1D symétrique/aller simple, waypoints, sondage du vide `detectLedgesAheadFromSolids`), de cadran rotatif au drag (circulaire déplié sans saut `±180°`, linéaire X/Y, ressort/crans) et de détection directionnelle AABB (`detectSquareCollisionSide` par profondeur de pénétration et pré-positionnement) en fonctions pures testables hors Matter.js.
  - **Cache d'instantané DOM léger (`transitionSnapshotCache.ts`)** : Capturer une vignette/instantané visuel de la scène sortante juste avant `changeSceneInPlay` afin que les transitions `push_left / push_right / push_up / push_down` animent simultanément la scène sortante poussée et la scène entrante sans maintenir deux instances du moteur physique en parallèle.
  - **Identification interne stable, libellés propres** : Les IDs internes restent inchangés tandis que la création et les sélecteurs n'ajoutent plus de suffixe `#N` automatique ni n'exposent de types techniques bruts (`custom_*`) dans l'interface.

## ADR-015 : Modèle Prefab vs Instance Séparée pour les Doublons (Décision Différée)
- **Date :** 2026-11-21
- **Statut :** En attente (Vague ultérieure)
- **Contexte :** Plusieurs instances d'un même type d'entité sur une scène partagent actuellement un nom et un halo discret dans la hiérarchie/scène, mais la question de savoir si l'édition d'une instance doit modifier toutes les instances du modèle (*Prefab*) ou rester purement locale mérite une réflexion dédiée pour ne pas créer de confusion avec le système d'*overrides par État* (`behaviorOverrides`, `parentOffsetOverride`).
- **Orientation pressentie (Solution 2) :** Modèle *Prefab partagé par défaut* avec possibilité de *surcharge locale à 1 niveau* sur une instance précise, tout en gardant l'UX suffisamment légère pour ne jamais mélanger surcharge d'instance et surcharge d'état.
- **Décision :** Conserver le comportement actuel (entités éditées indépendamment + duplication indépendante dans la galerie) jusqu'à conception dédiée de l'UX Prefab/Instance.

## ADR-016 : Animation Pilotée Parametric-First (`drivenAnimationSolver`) & Action Compagnon `control_animation`
- **Date :** 2026-11-23
- **Contexte :** Permettre d'animer une entité directement selon une grandeur continue ou des passages discrets (proximité, variable, vitesse, santé, collision par étape type presse à jus ou maintien), tout en restant compatible avec les futurs calques/keyframes (ADR-006) et sans obliger à dupliquer 4 états visuels dans le `RuleBook`.
- **Décisions :**
  - **Solveur pur isolé (`drivenAnimationSolver.ts`) + Runtime `runtimeAnimFrameIndex` / `runtimeAnimScale|Rotation|Opacity`** : Tout calcul de progression `[0..1]`, de cliquet irréversible, de courbe et d'interpolation reste purement fonctionnel ; en Play, `CustomShape` suspend son `setInterval` FPS interne dès que `runtimeAnimFrameIndex !== undefined`, tandis que le mode Édition et les flipbooks classiques restent strictement inchangés.
  - **Détection de collision analytique en repli (`getEntityWorldColliderBounds`)** : Les entités `Draggable` sans composant `Physics` ne génèrent pas de paires de collision Matter.js ; `stepMatterPhysics` vérifie donc les paires physiques puis complète par test géométrique AABB/cercle afin qu'un objet glissé à la souris déclenche immédiatement `collision_step` / `collision_hold` contre un capteur `trigger_only`.
  - **Compagnon RuleBook `control_animation`** : Fournir un contrôle impératif unifié (`set_frame`, `step_frame`, `set_progress`, `reset`) via `controlEntityAnimationRuntime` et mise à jour immédiate du store dans `ruleExecutionEngine.ts`, utilisable autant sur les animations pilotées que sur les flipbooks ordinaires.
