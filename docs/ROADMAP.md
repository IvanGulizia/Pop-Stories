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

## Prochaines Pistes
- [ ] Presets de démarrage / modèles de mini-jeux pré-configurés.
- [ ] Contrôles de parallaxe active sur les calques de décor.
- [ ] Extraction continue des modales volumineuses (`RuleBook.tsx`, `DrawingCanvas.tsx`).

