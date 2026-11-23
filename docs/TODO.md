# Backlog & Suivi Technique (`TODO`)

## Étape Intermédiaire 5 — Animation Pilotée façon Kitty / Draco (Complétée)
- [x] **Comportement `driven_animation` (`drivenAnimationSolver.ts`)** : 6 sources (`proximity`, `variable`, `collision_step`, `collision_hold`, `speed`, `health`), modes `reversible` vs `irreversible` (cliquet), courbes, `clamp | loop | ping_pong`, transformations visuelles (`driveVisualTransform`), sorties vers `gameVariables` et événements de fin (`triggerStateOnCompleteId`, `destroyOnComplete`).
- [x] **Gizmos Liens Causaux (`drivenAnim`)** : Courbes source → cible, anneaux de portée et badges d'avancement dans `SceneGizmoOverlay` + réglage dans `SettingsPanel` / `gizmoHelpers`.
- [x] **Compagnon RuleBook `control_animation`** : Contrôle direct des frames (`set_frame`, `step_frame`, `set_progress`, `reset`) dans `ControlAnimationConfigEditor`, modales/assistant `RuleBook` et `ruleExecutionEngine`.

## Étape Intermédiaire 4 (Complétée)
- [x] **#1 Sauvegardes** : Écrasement direct en 1 clic sans demande de confirmation dans `ProjectSlotsModal`.
- [x] **#2 & #3 UX Overrides & Terminologie** : Carte `Parenting & Attachement` alignée sur `BehaviorManager` (bannière unifiée + surbrillance ambre) et remplacement général de « surcharge » par « override ».
- [x] **#4 Nouveau Projet** : Désactivation automatique du mode dessin sur calque (`selectedLayerId: null` dans `clearProject`).
- [x] **#5 Piste B — Épingle au monde cassable (`worldPin`)** : Contrainte souple Matter.js sur `PhysicsBehaviorConfig` utilisable par override d'état (fixation/résistance au drag sur parent racine, arrachement avec événement `joint_break` + état après rupture, ré-épinglage au retour et gizmos dédiés).
- [x] **#6 Compatibilité `Jiggle` + `Joint Physique`** : Encart explicatif dans `JiggleBehaviorControls` lorsque l'entité utilise `physics_joint`.

## Vague Intermédiaire 3 (3A, 3B, 3C — Complétée)
- [x] **3A — Correctifs & UX (`#1, #2, #3, #4, #7`)** : Flip instantané sur demi-tour `Patrol`, cascade hiérarchique Scène + `enabledScope` sur `set_entity_enabled`, overlay collider/pivot au-dessus du tracé, correction sauvegarde trait particule perso, mémorisation plié/déplié des comportements (`expandedBehaviorCards`).
- [x] **3B — Particules & Collision Patrouille (`#5, #6, #11`)** : Direction d'émission (`angle | facing | toward_target | away_target | mouse`), émission temporisée en jet continu ou multi-salves (`particleEmitDuration`, `particleEmitRate`, `particleBurstInterval`, `particleBurstCount`), et `turnOnCollision` filtrable sur `Patrol`.
- [x] **3C — Snap 2.0 (`#8, #9, #10, #12`)** : Ancres `pivot` & `custom_canvas` avec placement/glisser direct sur le canvas, mode `Réceptacle` intégré avec `maxCapacity`, champ magnétique d'approche (`magnetEnabled`, `magnetRadius`, `magnetForce`, `approachingStateId`), et mode `parent_physics_joint` avec réglages de joint et `Break Joint`.

## Vague Intermédiaire 2 (Sous-phases A → D)
- [x] **Sous-phase A — Quick Wins UI, Ergonomie & Santé** :
  - `HealthBehaviorConfig.blinkOnDamage` (désactivé par défaut) + création/dessin 1-clic des états Santé (`Blessé` / `Mort`)
  - Suppression de la barre flottante sur le canvas en dessin de calque + bouton `Valider` et actions contextuelles dans `DrawingToolsPanel`
  - Renommage inline par instance (`SceneHierarchyList`) + halo discret entre instances du même modèle (`EntitySiblingHalo`)
  - Duplication indépendante d'entité dans la galerie (`duplicateCustomArchetype`)
- [x] **Sous-phase B — Saisie numérique libre, Impulsion, Désactivation complète & Parenting/État** :
  - Saisie numérique libre sans garde-fou au clic (avec accès à `0`, décimales fines et valeurs élevées ex. ressort angulaire > 400) + distinction `limitMaxDistance` `0 px` strict vs `Libre`
  - Bouton **Désactiver/Activer** séparé de *Masquer/Afficher* (`Entity.disabled`) + action RuleBook `set_entity_enabled`
  - Action RuleBook `apply_impulse` (Force / Impulsion paramétrable linéaire & angulaire)
  - Paramétrage du parentage/joint dans l'action RuleBook *Parenter* (`AttachParentConfigEditor`) + override `parentOffsetOverride` par État (`resolveEffectiveParentOffset`)
- [x] **Sous-phase C — Studio Particules Avancé, Collection & Spawn Relatif** :
  - Ranges aléatoires Min/Max, mono-couleur vs dégradé, drag/opacité/taille de fin/spin, durée d'émetteur finie, boucle, bursts initiaux/périodiques et formes d'émission (`point`, `circle`, `box`)
  - Collection locale de particules (projet + inter-projets IndexedDB) avec sprites vectoriels embarqués/remappés
  - Spawn particules relatif à une entité (ancres, offsets locaux, rotation/`flipX`), coordonnées exactes, position souris live ou point d'événement
- [x] **Sous-phase D — Ratio Caméra Play (sans bandes noires), Tri Cartes d'Action & Snap/Aimant** :
  - Ratio caméra dédié au Play (`playAspectRatio`) avec cadrage d'aperçu en Édition sans bandes noires
  - Drag & drop de réorganisation des cartes d'actions individuelles dans une règle (`RuleBook`)
  - Comportement Snap / Aimant + événements/actions compagnons (`snap` enter/exit, `snap_to`, `unsnap`)
- [ ] **Décision en attente (#17) — Duplicata / Prefabs vs Overrides d'Instance (gardé pour plus tard)** : Orientation vers la **Solution 2** (Prefab partagé permettant de modifier les comportements de toutes les instances partagées tout en autorisant une surcharge à 1 niveau par instance), **à condition** de garder l'interface et la lecture des états parfaitement légères sans confusion entre surcharge d'instance et surcharge d'état.

## En cours / Récent
- [x] Système global de Gizmos sur scène (`SceneGizmoOverlay`) + section Settings dédiée
- [x] Hitbox : mode physique (`default` / `trigger_only` / `disabled`) + délégation de clic/drag au parent + `ignorePointer`
- [x] `LookAt` : retournement contextuel (`flipX`), sens d'origine (`facingDirection`), zone morte et gizmo cône d'angle
- [x] `InteractivePuppet` : sliders dédiés pour les délais de maintien et retours à la normale (`swingReturnDelay`, `shakeHoldDuration`, `hoverReturnDelay`, `dragOverReturnDelay`)
- [x] Inspecteur : section *Parenting & Attachement* repliable
- [x] Refactorisation Lots A à E (`RuleBook`, `BehaviorManager`, `DrawingCanvas`, `useSceneStore`, `matterPhysicsEngine`) + Vitest
- [x] Pivot WYSIWYG multi-niveaux (Entité / État / Jiggle) dans l'Atelier de dessin & l'Inspecteur
- [x] Parenting & Follow élastiques (`spring`, `physics_joint`, `collideWithWorld`) + Composant `jiggle` & Gizmos `springsAndJiggle`
- [x] Finitions Dessin/Gizmos (ordre palette, pivot masqué par défaut, verrous collider/pivot, suppression libellé box/circle), rotation directe canvas, suivi continu en drag, chaînes Jiggle + angle de départ (`initialAngleOffset`), calibration `physics_joint` & 3 scènes de test chargeables

## Complété récemment — Vague 2A & Wiggle++ (Phase 10.35)
- [x] **Wiggle++ (`StrokeWiggleBehaviorConfig`)** : `segmentStep`, `verticalScale`, `endpointStability`, `seed` + modulation live via `gameVariables`.
- [x] **Comportement `slider` contraint + Variables de jeu (`gameVariables`)** :
  - Modes géométriques : Rail linéaire orientable (1D : longueur px + angle), Zone 2D libre (rectangle ou disque). *(Optionnel plus tard : Arc/Cadran rotatif).*
  - Drag physique (ressort vers la souris avec inertie/rebond) vs Drag direct au pixel près (prioritaire sur `draggable`).
  - Crantage (continu ou N crans stricts / magnétiques) + Retour élastique (`none` vs `spring_return` configuré).
  - Sortie exploitable dans le `RuleBook` (`outputVariableX`, `outputVariableY`, `outputStepVariable`, déclencheur `'threshold'` / `'on_change'`, action `set_variable`, tiroir Variables).

## Complété récemment — Limites Universelles & Vague 2B Multi-Scènes (Phase 10.36)
- [x] **Limites, Cooldown, Délais & Front Montant universels (`triggerGate.ts`, `TriggerLimitsSection.tsx`)** : `triggerMaxCount` (`∞` / `1×` / `N×`), `triggerCooldownSec`, `triggerStartDelaySec`, `triggerRequireReset` (*1× par passage*) sur tous les événements + exécution `'state_change'`.
- [x] **Multi-Scènes & Transitions (`ProjectScene[]`, `App.tsx`, `Scene.tsx`, `RuleBook`)** : Onglets de scènes, fond par scène, action `change_scene` (`none`, `fade`, `slide_left`, `slide_right`, `iris`), conservation de `gameVariables` inter-scènes.

## Complété récemment — Vague 3 : Caméra 2D, Monde Étendu, Parallaxe & 12 Transitions (Phase 10.37)
- [x] **12 Transitions de Scènes** : Ajout de *Fondu au blanc* (`fade_white`), *Glissé haut/bas*, *Iris blanc*, *Balayage*, *Rideau* et *Zoom + Fondu*.
- [x] **Caméra 2D, Monde Étendu, Zoom, Screen Shake & Parallaxe** : Config par scène (`SceneCameraModal`), suivi smooth/deadzone/bornes, HUD navigation Édition, `parallaxFactor` actif sur les calques décor, particules/pointeur/physique en espace monde et action RuleBook `camera_action`.

## Complété récemment — Vague Intermédiaire Ergonomie & Gameplay (Phase 10.38)
- [x] **HUD Caméra en barre supérieure + Auto-focus Canvas au Play + Noms propres sans `#N` ni IDs bruts**.
- [x] **Monde vs Cadre (`boundarySpace`) + Transitions `push_left / push_right / push_up / push_down`**.
- [x] **Patrol 2.0 (`patrolSolver.ts`)** : Correctif aller-retour symétrique, aller simple, multi-points (coordonnées/entités), demi-tour sur mur & détection du vide (`detectLedges`).
- [x] **Collisions directionnelles carrées** : Filtres `RuleBook`, vulnérabilité par face & immunité stomp (`Health`), et `oneWayPlatform`.
- [x] **Comportement `rotate_drag` (`rotateDragSolver.ts`)**, **Santé = 0 PV → Scène** (avec délai), **Capture clavier live**, **Calques fermés/colorés par défaut** et **Déclencheur + Action rapide `camera_follow`**.

## En Pause / Planifié pour plus tard (Corde Élastique & Vague 2B)
- [ ] **Comportement `corde` / Corde élastique + Line Renderer SVG** :
  - Contrainte physique souple (distance max / élasticité, tirage vers le bas avec résistance pour interrupteur/lampe ou balancement).
  - Couche de rendu SVG dédiée (segment tendu / caténaire / élastique dynamique entre deux ancres).

## En Pause / Planifié pour plus tard (Chantier Interpolation — ADR-006)
- [ ] **Phase Anim 1 — Intra-État par Calques** : Keyframes transform (`pos`, `rotation`, `scale`, `opacity`) par calque + bouton « Isoler sur un nouveau calque » (compatible futur morphing de traits)
- [ ] **Phase Anim 2 — Inter-États par Calques** : Switch `Instantané / Interpolé` + durée/courbe/`Exit Time` + aperçu direct `État A ➔ État B`
- [ ] **Phase Anim 3 — Traits libres (Intra & Inter-États)** : Morphing de tracés libres avec repères de sens (`Début ➔ Fin`) et appariement visuel
- [ ] **Phase Anim 4 — Vue Graphe d'États (optionnel)** : Visualisation nodale branchée sur les mêmes transitions

## À venir (Pistes futures & Chantiers Planifiés)
- [x] **Wiggle sur les traits ("Boiling Lines")** : Comportement `stroke_wiggle` avec amplitude, fréquence `1–24 Hz`, finesse, aperçu Édition et cache de variantes déterministes.
- [x] **Compatibilité iPad / Stylet (Base)** : Drag `PointerEvent` galerie → scène + bouton *Placer*, `h-dvh` / `safe-area`, et mode *Stylet seul* (`stylusOnlyDrawing`, rejet paume). *(Pression/inclinaison Apple Pencil à coupler avec les Brushes personnalisées).*
- [x] **Multi-Scènes & Transitions** : Gestionnaire de plusieurs scènes dans le projet, règle/action `Changer de scène` avec transition visuelle (`12` variantes dont *Fondu au blanc*) et variables persistantes entre scènes.
- [x] **Caméra 2D, Grand Environnement & Parallaxe** : Monde étendu au-delà du viewport, suivi caméra (smooth follow + deadzone + axes), zoom dynamique, *Screen Shake* / effets caméra, et activation réelle de `SceneLayer.parallaxFactor`.
- [ ] **Brushes Personnalisées** : Système de brosses avancées (texture/tampon, modulation épaisseur/pression stylet, rendu optimisé) selon cahier des charges utilisateur à définir.
- [ ] **Prefabs & Véhicules Physiques (2 roues + suspensions)** : Assemblage multi-entités réutilisable et spawnable d'un bloc (châssis + 2 roues motrices + suspensions `physics_joint`/ressort + comportement conduite clavier + inclinaison en vol).
- [ ] **Mécanique de Tir + Onglet Schéma Visuel de Presets & Refonte UI (Long terme)** :
  - Preset/Comportement Tir (point de sortie canon, recul, flash, éjection de douille, cadence, type de projectile, effets d'impact globaux ou par cible/tag).
  - **Onglet Schéma Visuel dédiée aux Presets Complexes** (à côté du Canvas / RuleBook) : schéma interactif illustrant visuellement les ancres, variables et raccourcis de création d'événements contextuels (`On Shoot`, `On Impact`, `On Land`, etc.), à intégrer lors d'une future refonte UI.
- [ ] Option utilitaire « Créer un Pivot / Conteneur vide » dans la galerie d'entités (entité invisible servant de parent final pour grouper des objets sans corps graphique).
- [ ] Enrichir les gizmos interactifs (poignées directement manipulables sur le canvas en Édition pour ajuster `maxAngle` ou `wandering.radius` à la souris si besoin).
- [ ] Presets de démarrage multi-parties (Marionnette avec Tête + Yeux déjà parentés).
