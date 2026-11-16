# Décisions d'Architecture (ADR)

## ADR-001 : Couche Unifiée de Gizmos de Scène (`SceneGizmoOverlay`)
- **Date :** 2026-11-16
- **Contexte :** Les gizmos de debug (auparavant limités à un booléen `showColliderDebugGizmos` rendu dans chaque entité) sont indispensables pour régler des comportements dont la portée dépasse la boîte de l'entité (rayons Marionnette `280px`, zones de fuite/balade, cônes `LookAt`, liens parent-enfant).
- **Décision :**
  - Centraliser tous les gizmos dans `<SceneGizmoOverlay />` au niveau du canvas `Scene.tsx` (`z-[45]`, `pointer-events-none`).
  - Structurer `AppSettings.gizmos` avec un mode par catégorie (`'off' | 'edit' | 'play' | 'both'`), un interrupteur maître et un filtre *Entité sélectionnée uniquement*.
  - Exposer ces contrôles dans une section dédiée *Gizmos & Debug Visuel* dans `SettingsPanel.tsx` (et non sur le canvas).
  - Règle pérenne : tout nouveau comportement géométrique ou spatial doit intégrer son rendu gizmo dans `SceneGizmoOverlay` et sa catégorie dans `gizmoConfig`.
- **Conséquences :** Aucun découpage par `clipPath`, rendu uniforme, désactivation sélective selon le mode Édition/Play sans encombrer le canvas.

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
