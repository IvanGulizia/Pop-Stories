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

## En Pause / Planifié pour plus tard (Chantier Sliders & Corde Élastique)
- [ ] **Comportement `slider` contraint + Variables de jeu (`gameVariables`)** :
  - Modes géométriques : Rail linéaire orientable (1D : longueur px + angle), Zone 2D libre (rectangle ou disque), puis Arc/Cadran rotatif.
  - Drag physique (ressort vers la souris avec inertie/rebond) vs Drag direct au pixel près (prioritaire sur `draggable`).
  - Crantage (continu ou N crans stricts / magnétiques) + Retour élastique (`none` vs `spring_return` configuré).
  - Sortie exploitable dans le `RuleBook` (`slider_x`, `slider_y`, `cran_actuel`, déclencheur sur changement de valeur/cran).
- [ ] **Comportement `corde` / Corde élastique + Line Renderer SVG** :
  - Contrainte physique souple (distance max / élasticité, tirage vers le bas avec résistance pour interrupteur/lampe ou balancement).
  - Couche de rendu SVG dédiée (segment tendu / caténaire / élastique dynamique entre deux ancres).

## En Pause / Planifié pour plus tard (Chantier Interpolation — ADR-006)
- [ ] **Phase Anim 1 — Intra-État par Calques** : Keyframes transform (`pos`, `rotation`, `scale`, `opacity`) par calque + bouton « Isoler sur un nouveau calque » (compatible futur morphing de traits)
- [ ] **Phase Anim 2 — Inter-États par Calques** : Switch `Instantané / Interpolé` + durée/courbe/`Exit Time` + aperçu direct `État A ➔ État B`
- [ ] **Phase Anim 3 — Traits libres (Intra & Inter-États)** : Morphing de tracés libres avec repères de sens (`Début ➔ Fin`) et appariement visuel
- [ ] **Phase Anim 4 — Vue Graphe d'États (optionnel)** : Visualisation nodale branchée sur les mêmes transitions

## À venir (Pistes futures & Chantiers Planifiés)
- [ ] **Wiggle sur les traits ("Boiling Lines")** : Tremblement vectoriel paramétrable (amplitude, fréquence/FPS 4–12 Hz, niveau de détail, par comportement ou propriété d'état/calque) avec cache de frames pour coût CPU quasi nul.
- [ ] **Compatibilité iPad / Stylet (Apple Pencil)** : Fallback tactile du drag & drop galerie → scène, viewport `100dvh` / `safe-area`, gestes tactiles sans dépendance au `hover`, et support optionnel de la pression/inclinaison du stylet (`e.pointerType === 'pen'`).
- [ ] **Multi-Scènes & Transitions** : Gestionnaire de plusieurs scènes dans le projet, règle/action `Changer de scène` avec transition visuelle (fondu, glissement, iris) et variables persistantes entre scènes.
- [ ] **Caméra 2D, Grand Environnement & Parallaxe** : Monde étendu au-delà du viewport, suivi caméra (smooth follow + deadzone + look-ahead), zoom dynamique, *Screen Shake* / effets caméra, et activation réelle de `SceneLayer.parallaxFactor`.
- [ ] **Brushes Personnalisées** : Système de brosses avancées (texture/tampon, modulation épaisseur/pression stylet, rendu optimisé) selon cahier des charges utilisateur à définir.
- [ ] **Prefabs & Véhicules Physiques (2 roues + suspensions)** : Assemblage multi-entités réutilisable et spawnable d'un bloc (châssis + 2 roues motrices + suspensions `physics_joint`/ressort + comportement conduite clavier + inclinaison en vol).
- [ ] **Mécanique de Tir + Onglet Schéma Visuel de Presets & Refonte UI (Long terme)** :
  - Preset/Comportement Tir (point de sortie canon, recul, flash, éjection de douille, cadence, type de projectile, effets d'impact globaux ou par cible/tag).
  - **Onglet Schéma Visuel dédiée aux Presets Complexes** (à côté du Canvas / RuleBook) : schéma interactif illustrant visuellement les ancres, variables et raccourcis de création d'événements contextuels (`On Shoot`, `On Impact`, `On Land`, etc.), à intégrer lors d'une future refonte UI.
- [ ] Option utilitaire « Créer un Pivot / Conteneur vide » dans la galerie d'entités (entité invisible servant de parent final pour grouper des objets sans corps graphique).
- [ ] Enrichir les gizmos interactifs (poignées directement manipulables sur le canvas en Édition pour ajuster `maxAngle` ou `wandering.radius` à la souris si besoin).
- [ ] Presets de démarrage multi-parties (Marionnette avec Tête + Yeux déjà parentés).
