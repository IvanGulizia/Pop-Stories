# Roadmap & Prototypes

Ce projet suit un développement itératif structuré pour garder une expérience fluide et modulaire.

## Prototypes Fondateurs (Complétés)
- [x] **Prototype 0–4** : Scène interactive, éditeur d'états, RuleBook visuel (`Quand [Événement] -> Alors [Action]`), moteur physique Matter.js & comportements modulaires, atelier de dessin vectoriel & flipbook par état.

## Phases Récentes & Architecture Active
- [x] **Physique, Colliders & Audio Studio (Phases 10.12–10.20)** : Calques Colliders `#tags`, Flipbook frame par frame, Sound Studio FX, Character Controller (`Idle/Move/Jump/Fall/Land`), Composant `Santé & Dégâts`, Auto-Save local IndexedDB.
- [x] **Outils Éditeur & Comportements Avancés (Phase 10.21)** :
  - [x] Inspecteur repliable pour le Parenting.
  - [x] Système centralisé de Gizmos de scène (7 catégories configurables `Off / Édit / Play / Les 2` dans les Paramètres).
  - [x] Modes de Hitbox (`default / trigger_only / disabled`) & délégation souris Parent/Racine (`pointerDelegation`, `ignorePointer`).
  - [x] `LookAt` avec retournement contextuel (`flipX`), sens d'origine, zone morte et gizmo cône `±maxAngle`.
  - [x] Délais complets de retour à la normale sur *Marionnette Interactive* (`hoverReturnDelay`, `swingReturnDelay`, `shakeHoldDuration`, `dragOverReturnDelay`).

- [x] **Refactorisation Préparatoire Complète (Phases 10.22–10.25)** :
  - [x] Lots A–E : Hook pointeur unifié, modularisation `BehaviorManager`, `DrawingCanvas`, `FullScreenDrawingModal`/`timeline`, `useSceneStore`, `matterPhysicsEngine`, `RuleBook` + suite Vitest (`15 tests`).

## Chantiers à Planifier & Feuille de Route Proposée
- [x] **Stabilisation dessin, flip, curseurs & zone de spawn (Phase 10.33)** : Undo/Redo timeline par frame, flip Character Controller, curseur neutre hors clic/drag, zone aléatoire de spawn.

### Ordre d'exécution recommandé (du plus simple / autonome aux chantiers structurants)
1. **Chantier A — Quick Wins & Ergonomie immédiate (Complété — Phase 10.34)** :
   - [x] **Compatibilité iPad / Apple Pencil** : Drag & drop `PointerEvent` galerie→scène + mode tactile *Placer*, `100dvh`, blocage callout iOS, et mode *Stylet seul* (`stylusOnlyDrawing`).
   - [x] **Wiggle sur les traits (Ligne vivante / Squigglevision)** : Comportement `stroke_wiggle` avec pré-calcul déterministe en cache (`2–6` variantes à `1–24 Hz`) à coût CPU quasi nul.
2. **Chantier B — Fondations Jeu & Scènes** :
   - [x] **Vague 2A — Wiggle++, Variables de jeu (`gameVariables`) & Comportement `slider` contraint (Complété — Phase 10.35)** : `segmentStep`, `verticalScale`, `endpointStability`, `seed`, liaisons `gameVariables`, tiroir Variables & action `set_variable` dans le `RuleBook`, rail 1D / zone 2D / disque, drag direct vs ressort, crantage strict/magnétique, retour élastique.
   - [x] **Vague 2B — Multi-Scènes & Transitions (Complété — Phase 10.36)** : `scenes[]` au niveau projet, barre de scènes, action `change_scene` (`none`, `fade`, `slide_left`, `slide_right`, `iris`), conservation de `gameVariables` inter-scènes et limites/délais universels sur les événements.
   - [ ] **Corde Élastique & Line Renderer SVG** : Contrainte souple (tension/balancement) + tracé SVG dynamique entre ancres (phase dédiée à suivre).
3. **Chantier C — Monde Étendu, Caméra & Vague Intermédiaire (Complété — Phases 10.37–10.38)** :
   - [x] **Caméra 2D, Grand Environnement, Zoom, Screen Shake & Parallaxe (`cameraSolver.ts`, `cameraRuntime.ts`, `SceneCameraModal.tsx`)** : Monde étendu paramétrable par scène, suivi caméra (`follow`, smoothing, deadzone, axes, bornes), zoom `0.25×–3×`, *Screen Shake* et actions caméra dans le `RuleBook`, HUD navigation dans la barre supérieure, activation du `parallaxFactor` (`0–1.5`) sur `SceneLayer`, 16 transitions de scènes dont *Fondu au blanc* et *Push (4 directions)*.
   - [x] **Vague Intermédiaire Ergonomie & Gameplay (Phase 10.38)** : Focus auto au Play, séparation Monde vs Cadre (`boundarySpace`), Patrol 2.0 (symétrique corrigé, aller simple, multi-points, murs, détection du vide), collisions directionnelles carrées (`RuleBook`, `Santé` type Goomba, `oneWayPlatform`), cadran rotatif au drag `rotate_drag`, Santé à 0 PV → scène avec délai, capture touche clavier en direct, calques colorés fermés par défaut, noms d'entités épurés et déclencheur `camera_follow`.
4. **Chantier D — Animation & Pinceaux Avancés** :
   - **Animation Avancée (ADR-006)** : Keyframes intra-état par calques puis transitions interpolées inter-états.
   - **Brushes Personnalisées** : Moteur de pinceau à empreintes/tampons/pression stylet ou rubans SVG/Canvas optimisés.
5. **Chantier E — Presets Complexes, Prefabs & Refonte UI ("Visual Inspector")** :
   - **Prefabs / Assemblages multi-entités** : Modèles réutilisables composés de plusieurs entités liées (véhicule 2 roues + suspensions, arme + projectile + douille).
   - **Mécanique de Tir & Véhicules Physiques** : Presets dédiés (roues motrices, suspensions ressort/joint, cadence, recul, éjection, impact par type/tag).
   - **Onglet Schéma Visuel & Événements Contextuels (Long terme / Refonte UI)** : Vue schématique interactive dédiée aux presets complexes (`Tir`, `Véhicule`, `Character Controller`) permettant de visualiser ancres/variables et de générer en 1 clic leurs événements contextuels (`On Shoot`, `On Impact`, `On Land`, etc.).
