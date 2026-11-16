# Backlog & Suivi Technique (`TODO`)

## En cours / Récent
- [x] Système global de Gizmos sur scène (`SceneGizmoOverlay`) + section Settings dédiée
- [x] Hitbox : mode physique (`default` / `trigger_only` / `disabled`) + délégation de clic/drag au parent + `ignorePointer`
- [x] `LookAt` : retournement contextuel (`flipX`), sens d'origine (`facingDirection`), zone morte et gizmo cône d'angle
- [x] `InteractivePuppet` : sliders dédiés pour les délais de maintien et retours à la normale (`swingReturnDelay`, `shakeHoldDuration`, `hoverReturnDelay`, `dragOverReturnDelay`)
- [x] Inspecteur : section *Parenting & Attachement* repliable

## À venir (Pistes futures)
- [ ] Option utilitaire « Créer un Pivot / Conteneur vide » dans la galerie d'entités (entité invisible servant de parent final pour grouper des objets sans corps graphique)
- [ ] Enrichir les gizmos interactifs (poignées directement manipulables sur le canvas en Édition pour ajuster `maxAngle` ou `wandering.radius` à la souris si besoin)
- [ ] Presets de démarrage multi-parties (Marionnette avec Tête + Yeux déjà parentés)
