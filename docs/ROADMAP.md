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
1. **Chantier A — Quick Wins & Ergonomie immédiate** :
   - **Compatibilité iPad / Apple Pencil** : Audit tactile (remplacement/doublon du drag & drop HTML5 galerie→scène, `100dvh`, gestion des gestes sans hover, option détection stylet/pression).
   - **Wiggle sur les traits (Ligne vivante / Squigglevision)** : Option de tremblement procédural par entité / état / tracé (seed déterministe + amplitude + FPS de variation façon *Boiling Lines*) à faible coût CPU.
2. **Chantier B — Fondations Jeu & Scènes** :
   - **Multi-Scènes & Transitions** : `scenes[]` au niveau projet, action `change_scene` (avec effets de fondu/transition), gestion d'état persistant inter-scènes (`gameVariables`).
   - **Sliders Contraints & Corde Élastique (En pause — prêt à démarrer)** : Comportement `slider` + variables de jeu + contrainte/rendu `corde`.
3. **Chantier C — Monde Étendu & Caméra (Prérequis pour véhicules & tir)** :
   - **Caméra 2D & Grand Environnement** : Caméra (`follow`, zoom, bornes, *screen shake*, transitions), culling/optimisation viewport, et activation du `parallaxFactor` déjà présent sur `SceneLayer`.
4. **Chantier D — Animation & Pinceaux Avancés** :
   - **Animation Avancée (ADR-006)** : Keyframes intra-état par calques puis transitions interpolées inter-états.
   - **Brushes Personnalisées** : Moteur de pinceau à empreintes/tampons/pression stylet ou rubans SVG/Canvas optimisés.
5. **Chantier E — Presets Complexes, Prefabs & Refonte UI ("Visual Inspector")** :
   - **Prefabs / Assemblages multi-entités** : Modèles réutilisables composés de plusieurs entités liées (véhicule 2 roues + suspensions, arme + projectile + douille).
   - **Mécanique de Tir & Véhicules Physiques** : Presets dédiés (roues motrices, suspensions ressort/joint, cadence, recul, éjection, impact par type/tag).
   - **Onglet Schéma Visuel & Événements Contextuels (Long terme / Refonte UI)** : Vue schématique interactive dédiée aux presets complexes (`Tir`, `Véhicule`, `Character Controller`) permettant de visualiser ancres/variables et de générer en 1 clic leurs événements contextuels (`On Shoot`, `On Impact`, `On Land`, etc.).
