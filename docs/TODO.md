# Backlog & Suivi Technique (`TODO`)

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

## En Pause / Planifié pour plus tard (Chantier Interpolation — ADR-006)
- [ ] **Phase Anim 1 — Intra-État par Calques** : Keyframes transform (`pos`, `rotation`, `scale`, `opacity`) par calque + bouton « Isoler sur un nouveau calque » (compatible futur morphing de traits)
- [ ] **Phase Anim 2 — Inter-États par Calques** : Switch `Instantané / Interpolé` + durée/courbe/`Exit Time` + aperçu direct `État A ➔ État B`
- [ ] **Phase Anim 3 — Traits libres (Intra & Inter-États)** : Morphing de tracés libres avec repères de sens (`Début ➔ Fin`) et appariement visuel
- [ ] **Phase Anim 4 — Vue Graphe d'États (optionnel)** : Visualisation nodale branchée sur les mêmes transitions

## À venir (Pistes futures)
- [ ] Option utilitaire « Créer un Pivot / Conteneur vide » dans la galerie d'entités (entité invisible servant de parent final pour grouper des objets sans corps graphique)
- [ ] Enrichir les gizmos interactifs (poignées directement manipulables sur le canvas en Édition pour ajuster `maxAngle` ou `wandering.radius` à la souris si besoin)
- [ ] Presets de démarrage multi-parties (Marionnette avec Tête + Yeux déjà parentés)
