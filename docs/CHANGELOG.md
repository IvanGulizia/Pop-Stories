## [Phase 10.13] - 2026-11-13
### Ajouté & Corrigé
- **Calibrage Physique Matter.js & Roulement sur Calques Colliders (`matterPhysicsEngine.ts` / `BehaviorManager.tsx`)** :
  - Suppression de l'inversion erronée de friction (`1 - friction`) sur les entités et les calques colliders : l'adhérence (`0 = glace`, `1 = gomme`) permet désormais aux balles circulaires de rouler naturellement sur les pentes et sols tracés.
  - Ajout de chanfreins (`chamfer`) sur les segments de polylignes des calques colliders pour éviter les blocages aux jonctions de segments, et synchronisation dynamique à chaud de `friction`, `frictionStatic`, `frictionAir` et `mass`.
  - Élargissement des plages de curseurs dans `BehaviorManager.tsx` (`Gravité -2000..2000`, `Masse 0.1..50`, `Adhérence 0..1`, `Rebond 0..1.2`) + ajout du paramètre **Résistance de l'air (`frictionAir` `0..0.25`)**.
- **Sound Studio Enrichi (`SoundRecorderModal.tsx` / `audioEditor.ts`)** :
  - Décodage Web Audio (`decodeAudioData`), forme d'onde interactive sur `<canvas>` avec poignées déplaçables, **Découpe (Trim)** début/fin, **Fade In / Fade Out**, **Enveloppe ADSR** (*Attack, Decay, Sustain, Release*), **Gain** et **Vitesse / Pitch** avec courbe d'enveloppe superposée en temps réel.
  - Aperçu fidèle via `AudioBufferSourceNode` + `GainNode` et encodage hors-ligne `OfflineAudioContext` vers WAV 16-bit PCM tout en conservant `rawDataUrl` et `editParams` pour permettre la réédition non-destructive depuis *"Mes Sons"*.
- **Nommage du fichier à l'Export (`SettingsPanel.tsx`)** :
  - Fenêtre modale dédiée permettant de nommer librement le fichier `.json` avant téléchargement lors de l'export de projet ou de pack de curseurs.
- **Duplication d'État (`useSceneStore.ts` / `Inspector.tsx`)** :
  - Action `duplicateStateInEntity` clonant tracés, calques, échelle, rotation, collider et `behaviorOverrides`, accessible via un bouton dédié sur chaque carte d'état dans l'Inspecteur.
- **Correction Opacité des Calques de Dessin (`CreateEntityModal.tsx` / `CustomShape.tsx` / `EntityMiniPreview.tsx` / `Inspector.tsx` / `DrawingToolsPanel.tsx`)** :
  - Conservation complète de `drawingLayers` à la création d'entité (`onLayersChange`), rendu respectant `layer.opacity` et `layer.visible` sur le canvas principal et dans les aperçus miniatures sans fuite entre états, et ajout d'un curseur d'opacité dans `DrawingToolsPanel.tsx` pour les calques de décor/colliders.
- **Nouveau Comportement `Fuir (Flee)` (`matterPhysicsEngine.ts` / `BehaviorManager.tsx`)** :
  - Comportement autonome configurable s'éloignant de la souris, d'une entité, du type ou du `#tag` le plus proche dans un rayon de détection donné (`0 = fuite permanente`), avec mode `2D libre` ou `Horizontal`, accélération, damping et `Flip horizontal`.
- **Éditeur & Testeur Interactif de Particules (`ParticleEditorModal.tsx`)** :
  - Atelier visuel temps réel 60 FPS partageant exactement le moteur `particleSystem.ts` (`createParticlePool`), avec scène de test cliquable/glissable, thèmes de fond (*Nuit / Grille / Clair*), mode auto ou salve, 6 présets rapides, dessin de particules personnalisées et intégration directe dans `BehaviorManager` (`particle_emitter`) et `RuleBook` (`emit_particles`).

## [Phase 10.12] - 2026-11-13
### Ajouté & Corrigé
- **Écran d'accueil au démarrage (`Scene.tsx` / `App.tsx`)** :
  - L'écran d'accueil centré sur la création de la première entité s'affiche désormais immédiatement au démarrage lorsque le projet est vide (sans ouverture forcée du modal).
  - Masquage temporaire des boutons de lancement de la scène démo sur les écrans d'accueil et catalogues vides.
- **Calques Colliders de Décor précis avec `#Tags` intégrés (`SceneLayer` role `'collider'`)** :
  - Ajout d'un groupe natif *« Colliders de Décor (Murs / Sols) »* dans `SceneLayerManager.tsx` et d'une section dédiée dans `DrawingToolsPanel.tsx` : tags de détection (`#sol`, `#mur`, `#lave`…), mode Obstacle Solide vs Capteur/Trigger traversable, visibilité en mode Play, adhérence et rebond.
  - Génération de corps statiques Matter.js fidèles aux tracés dans `matterPhysicsEngine.ts` (rectangles, cercles, lignes et polylignes libres décimées en capsules segmentées `Body.create({ parts })`, sans englobant rectangulaire grossier) et détection segment-par-segment (`checkEntityAgainstColliderLayer`) prise en compte dans les déclencheurs `on_collision` par `#Tag` ou `🌐 Tous les objets` avec position exacte d'impact.
- **Rendu 100 % WYSIWYG des Calques en coordonnées Monde (`coordinateSpace: 'world'`)** :
  - Suppression de l'étirement `viewBox="0 0 200 200" preserveAspectRatio="none"` sur `renderLayerSvg` et `DirectCanvasDrawingOverlay` : les nouveaux calques utilisent un repère exact `1 unité SVG = 1 pixel CSS` sans aucune déformation selon le ratio du canvas ou la largeur des panneaux latéraux (préparé pour le futur déplacement de caméra), tout en conservant une rétrocompatibilité pour d'éventuels anciens calques `legacy_200`.
- **Épuration de l'interface de dessin sur calque** :
  - Suppression du badge flottant *« Dessin Direct / Terminer »* sur le canvas ainsi que du bandeau d'en-tête *« Fermer »* dans `DrawingToolsPanel.tsx` ; la sélection/désélection directe du calque dans la pile suffit.
- **Paramètres d'Accélération & Damping / Inertie sur tous les comportements de mouvement** :
  - Ajout des curseurs **Accélération (Réactivité)** et **Inertie / Glisse (Damping)** dans `BehaviorManager.tsx` et application physique douce axe par axe (`approachAxisVelocity`) dans `matterPhysicsEngine.ts` pour `constant_velocity`, `keyboard_control`, `patrol`, `wandering`, `move_to` et `follow`.
- **Correction de la boucle/scintillement en Collision + Changement d'état + Auto-remise / Exit** :
  - Ajout de l'option **« Collider commun entre les états »** (`sharedCollider` + `colliderReferenceStateId`) dans l'Inspecteur (`Inspector.tsx`) et `collider.ts` pour verrouiller la géométrie de collision d'une entité même lorsque l'apparence change d'état.
  - Ajout d'un garde anti-scintillement dans `useSceneStore.ts` (`lastOverlapPosA` / `lastOverlapPosB` dans `handleCollisionPair`) : si un changement d'état modifie le collider en place (`déplacement < 2.5px`) et provoque une micro-perte de chevauchement instantanée, le contact reste maintenu sans déclencher de faux événement `Exit` ni d'auto-remise en boucle.
  - Suppression du double/triple appel à `evaluateRules()` par frame entre `App.tsx` et `Scene.tsx`.

## [Phase 10.11] - 2026-11-12
### Corrigé & Ajouté
- **Mode `🌐 Tous les objets` (`SelectionMode = 'any'`) & Sujet explicite sur les Bords de Scène** :
  - Ajout du mode de sélection `'any'` (*« 🌐 Tous les objets »*) dans `src/types/index.ts`, `useSceneStore.ts` (`matchesEntityFilter`) et `RuleBook.tsx` (onglet dédié dans l'assistant de création, la modale d'édition, le filtrage et l'affichage sur les cartes du Storyboard) pour les déclencheurs Sujet et Cible (collisions, proximité, bords, etc.).
  - Retrait de `'boundary'` de `isGlobalTrigger` dans `RuleBook.tsx` : les règles « Toucher le bord » conservent ou permettent désormais de choisir explicitement un Sujet précis (par Type, `#Tag`, Instance ou `🌐 Tous objets`), tout en initialisant par défaut `subjectMode: 'any'` lorsqu'on passe par l'entrée rapide *Événement Global → Bord de Scène*.
- **Détection exacte des Bords de Scène & Adaptation dynamique au redimensionnement du Canvas** :
  - Remplacement de la détection sur boîte fixe `256×256` (+ marge `15px`) par les limites réelles du collider (`getEntityWorldColliderBounds` dans `useSceneStore.ts` avec tolérance de `2px`, et `body.bounds` dans `matterPhysicsEngine.ts` pour `boundary_behavior` : rebond sensor, wrap, clamp).
  - Mesure des dimensions internes exactes du canvas (`clientWidth` / `clientHeight`) via `ResizeObserver`, `window.resize`, et resynchronisation immédiate à chaque frame dans la boucle 60 FPS de `Scene.tsx` (y compris pendant les transitions CSS et l'extension des murs statiques Matter.js).

## [Phase 10.10] - 2026-11-12
### Corrigé (Audit Lot 1)
- **Édition complète des Modèles (Archétypes) sans instance sur le Canvas** :
  - Correction du helper `findTargetEntityOrArchetype` dans `useSceneStore.ts` (recherche par `a.id` en plus de `a.type`) et prise en charge de `updateEntityState` sur les modèles hors scène : il est désormais possible d'attribuer des comportements, overrides par état, tags, états et dessins directement depuis le catalogue `EntityGallery` même lorsqu'aucune instance n'est posée sur la scène (badge *« Modèle (hors scène) »* dans `Inspector` et surbrillance active dans le catalogue).
- **Alignement strict des Colliders avec Scale & Flip horizontal (`flipX`)** :
  - Correction dans `collider.ts`, `matterPhysicsEngine.ts`, `useSceneStore.ts`, `Apple.tsx` et `Plant.tsx` : calcul centralisé `getEntityWorldColliderBounds` tenant compte du `scale` (transform centré DOM) et du miroir horizontal `flipX`, préservation de la vélocité lors des changements d'offset ou de reconstruction du corps Matter.js, et correction de la conservation de vélocité orthogonale en pause de patrouille.
- **Nettoyage complet du cycle Play/Stop & Évaluation des Règles** :
  - Ajout de `clearPlayRuntimeState()` à l'arrêt du mode Play (annulation de tous les timers `setTimeout` de délai en attente, purge des cooldowns, `preCollisionStates`, `preEventAutoRevertStates`, contacts de collision et `lastSpawnedEntityId`).
  - Nettoyage automatique de `activePhysicsCollisionPairs` et `activePhysicsCollisionContacts` sur événement `collisionEnd` de Matter.js.
  - Suppression d'un blocage prématuré (`collisionRules.length === 0`) empêchant l'évaluation d'autres règles dépendantes dans `evaluateRulesWithTemp`, et ajout d'un garde différentiel sur `activeCollisions`.
- **Dimensionnement dynamique de la Scène (`sceneBounds`)** :
  - Suivi en temps réel du conteneur `<Scene />` via `ResizeObserver` (`setSceneBounds`), utilisé à la place des dimensions figées `800x500` dans les bordures (`boundary`), le spawn aléatoire (`spawn_entity`) et le sélecteur visuel `SpawnLocationPicker`.
- **Calques verrouillés & Palette sur Dessin Direct (`DirectCanvasDrawingOverlay`)** :
  - Propagation de `strokeColorId`/`fillColorId` pour les tracés directs sur canvas et respect strict du verrouillage de calque (`layer.locked`).
- **Seuil Clic vs Drag unifié** :
  - Harmonisation du seuil de détection clic vs glisser-déposer sur les composants `CustomShape`, `Apple` et `Plant`.

### Ajouté & Amélioré (Lot 2)
- **Position exacte d'événement (`eventPosition`) pour Spawn & Particules** :
  - Capture des coordonnées exactes de collision (`getCollisionContactPoint` / `getPhysicsCollisionContact`) ou d'interaction souris (`getSceneEventPosition`) et propagation dans la séquence d'actions.
  - Nouveaux modes de position dans `SpawnLocationPicker` (`at_event_point`, `offset_event_point` via le bouton *"Point exact (Collision / Clic)"*) et nouvelle origine `"Point exact"` (ainsi que `Par Type` et `Par Tag`) pour l'action `emit_particles` du `RuleBook`.
- **Restauration complète du choix de l'État initial au Spawn (`spawnInitialStateId`)** :
  - Ajout d'un bandeau sélecteur visuel *"État initial à l'apparition"* dans `SpawnLocationPicker` (avec aperçus `<EntityMiniPreview />`), restauration de l'étape `choose_spawn_state` dans le flux d'édition du `RuleBook` et affichage de l'état initial sur les cartes du Storyboard.
- **Ciblage par `#Tag` et par `Instance précise` sur les Déclencheurs** :
  - Ajout du sélecteur `Par Type | Par #Tag | Instance précise` pour le Sujet et la Cible dans l'assistant de création et la modale d'édition du `RuleBook`, avec affichage dédié sur les cartes du Storyboard.
- **Particules Dessinées à la Main (`CustomParticlePreset`)** :
  - Nouveau registre `customParticles` dans `useSceneStore` (persistance, import/export projet, CRUD complet) et cache sprite canvas `Path2D` haute netteté (`96x96`) dans `particleSystem.ts`.
  - Intégration directe de la galerie de particules dessinées et du modal `<FullScreenDrawingModal />` (dessin libre, édition, suppression, et option `useParticleTint` pour colorer dynamiquement ou conserver les couleurs d'origine) à la fois dans `BehaviorManager` (`particle_emitter`) et dans le `RuleBook` (`emit_particles`).

## [Phase 10.9] - 2026-11-12
### Ajouté & Amélioré
- **Action `spawn_entity` : Choix de l'objet de référence & Copie de taille (`match_reference`)** :
  - Ajout dans `SpawnLocationPicker` d'une section dédiée **"Objet de référence"** permettant de baser le positionnement direct (`at_*`) ou relatif (`offset_*`) sur : *Sujet de la règle*, *Cible de la collision*, *Entité précise de la scène*, *Type d'objet*, *Tag (`#tag`)* ou *Dernier objet créé*.
  - Ajout d'un mode de taille **"Même taille que la référence (`match_reference`)"** alignant automatiquement les dimensions de l'objet créé sur celles de son référent.
  - Résolution centralisée dans `useSceneStore` (`resolveEntityReference`) et prévisualisation complète dans les cartes du `RuleBook`.
- **Comportement `keyboard_control` : Restrictions d'axes & Activation du saut** :
  - Ajout de trois interrupteurs empilés style Unity dans `BehaviorManager` : **Mouvement horizontal (Gauche / Droite)** (`allowHorizontal`), **Mouvement vertical (Haut / Bas)** (`allowVertical`, mode Top-Down) et **Autoriser le saut** (`allowJump`, mode Plateforme).
  - Application stricte dans `matterPhysicsEngine.ts` (y compris neutralisation de l'impulsion de saut et de la vitesse verticale si désactivée).
- **Parenting d'Entités & Détachement Dynamique en Cours de Jeu** :
  - Ajout du lien hiérarchique (`parentId`, `parentOffset` avec `x`, `y`, `rotationOffset`, `inheritRotation`, `inheritFlip`) sur le modèle `Entity`.
  - **Synchronisation en Mode Édition (WYSIWYG)** : déplacer un parent déplace automatiquement ses enfants ; déplacer un enfant met à jour son offset relatif.
  - **Simulation Physique Matter.js** : résolution topologique parent → enfant à 60 FPS avec positionnement relatif pivoté autour du centre du parent, héritage de rotation et du retournement (`flipX`), et attribution d'un `collisionFilter.group` négatif partagé par famille (racine) pour empêcher les collisions internes entre un parent et ses enfants attachés tout en conservant leurs collisions avec le monde extérieur.
  - **Détachement sécurisé** : suppression d'un parent libère proprement ses enfants sans les détruire ; séparation dynamique en Mode Play via deux nouvelles actions dans le `RuleBook` (*Attacher à un Parent* `attach_to_parent` et *Détacher du Parent* `detach_parent`, avec options *Conserver les coordonnées actuelles* ou offset manuel).
  - **Interface Inspecteur & Hiérarchie** : bloc dédié *"Parenting & Attachement"* empilé dans `Inspector.tsx` et indentation visuelle avec badge `Link2` dans `SceneHierarchyList.tsx`.
- **Système de Particules 2D Léger (Canvas Poolé Sans Surcharge DOM/Physique)** :
  - Nouveau moteur `src/utils/particleSystem.ts` à pool fixe (`MAX_PARTICLES = 280` particules maximum simultanées), aucune création de nœud DOM ni de corps physique Matter.js.
  - Calque `<ParticleCanvasOverlay />` (`ResizeObserver` + haute densité DPI) monté uniquement en Mode Play (`active={isPlayMode}`).
  - **Composant continu `particle_emitter`** dans `BehaviorManager.tsx` (catégorie *Effets Visuels & Particules*) : émission continue personnalisable (fréquence/s, quantité/salve, forme cercle/carré/losange/étoile, direction, dispersion angulaire, vitesse, gravité, durée de vie, taille début/fin, couleurs début/fin).
  - **Action ponctuelle `emit_particles`** dans le `RuleBook` (Wizard & Modale d'action) avec 5 présets rapides (*Explosion*, *Étincelles*, *Fumée*, *Pluie d'étoiles*, *Confettis*) et sélection de l'origine (*Sujet*, *Cible*, *Dernier objet créé*, *Type*, *Tag*).

## [Phase 10.8] - 2026-11-12
### Corrigé & Ajouté
- **Option "Flip horizontal (Sens du déplacement)" (`flipOnMove` / `flipInvert`)** :
  - Ajout de l'option dans tous les comportements de déplacement (`keyboard_control`, `patrol`, `wandering`, `move_to`, `follow`, `constant_velocity`) avec choix du sens du dessin d'origine (*Regarde vers la droite* ou *Regarde vers la gauche*).
  - Retournement visuel `scaleX(-1)` appliqué uniquement au contenu graphique de l'entité (sans inverser ni le collider ni les libellés).
- **Correction des objets sans composant Physique (`isSensor: true` par défaut)** :
  - Correction critique dans `matterPhysicsEngine.ts` : une entité sans composant `physics` est désormais strictement configurée en tant que capteur non-bloquant (`isSensor: true`).
  - Les objets dépourvus du composant Physique ne bloquent ni ne repoussent plus les autres entités tout en continuant de déclencher les règles de collision. Seul le composant `physics` avec `Collider Solide` activé rend l'objet matériellement solide.
  - Ajout du rebond capteur sur les bords de scène lorsqu'un comportement `boundary_behavior` (mode `bounce`) est utilisé sans composant `physics`.
- **Correction définitive du "Look At" (Élimination des tours complets inutiles)** :
  - Implémentation de la fonction `shortestAngleDiffRad` par modulo euclidien strict dans `[-π, +π]` avec accumulation angulaire continue (`body.angle + diff`) sans saut de discontinuité autour de `±180°`.
  - Désactivation de l'interpolation spring Framer Motion sur la rotation en Mode Play (`transition={{ duration: 0 }}`) dans `CustomShape.tsx` et `Apple.tsx` pour supprimer l'effet de rotation inverse de 350° au franchissement de ±180°.
  - Prise en charge de la synchronisation de rotation pour les entités statiques équipées de `look_at` (tourelles fixes).

## [Phase 10.7] - 2026-11-12
### Corrigé & Ajouté
- **Désactivation stricte du Drag par défaut en Mode Play (`isEntityDraggable`)** :
  - Correction des entités initiales, archétypes et nouvelles entités/instances créées (`isDraggable: false` par défaut).
  - Suppression du repli implicite `entity.isDraggable !== false` dans `matterPhysicsEngine.ts` : une entité n'est désormais déplaçable en mode Play que si elle possède explicitement le composant **"Déplaçable à la souris" (`draggable`)** activé (ou via une surcharge d'état active).
  - Synchronisation du badge `Drag` dans la Hiérarchie et sur le canvas avec l'état réel du composant `draggable`, et mise à jour de l'action `toggle_draggable` sur le composant modulaire.
- **Nouveau Comportement "Balade Aléatoire" (`wandering`)** :
  - Ajout du composant modulaire `wandering` dans la catégorie *Déplacements Autonomes & Visée* avec inspecteur style Unity (attributs empilés ligne par ligne) et support complet des overrides par état.
  - Paramètres configurables : **Type de déplacement** (`Zone 2D libre` ou `Horizontal Sol/Plateforme`), **Rayon de la zone** (`40–600 px`), **Vitesse de déplacement** (`10–400 px/s`), **Aléatoire des virages** (`0–100 %`), **Intervalle de décision** (`0.3–5.0 s`), **Pause aléatoire max** (`0–4.0 s`) et option **Orienter vers le trajet**.
  - Confinement souple dans le rayon circulaire ou horizontal autour de la position initiale tout en respectant la gravité en mode plateforme et les bords du canvas.

## [Phase 10.6] - 2026-11-11
### Ajouté & Amélioré
- **Système Unifié de Ciblage Dynamique d'Instances en Mode Play (Compatibilité des 4 Pistes A, B, C et D)** :
  - **Piste A — Ciblage par Tags (`#tag`) & Attribution de Tags au Spawn (`spawnTags`)** :
    - Ajout d'un champ d'attribution de Tags optionnels dans `SpawnLocationPicker` (avec boutons rapides `+#projectile`, `+#piece`, `+#ennemi`, `+#cible`) permettant de tagger automatiquement toute nouvelle instance créée en cours de jeu.
    - Ajout du mode de ciblage **"Par Tag (`#tag`)"** dans les actions sur objets tiers du `RuleBook`, agissant dynamiquement sur toutes les instances actives portant ce tag.
  - **Piste B — Ciblage Contextuel de l'Instance en Contact (`targetMode: 'target'`)** :
    - Résolution directe de l'identifiant unique (`targetInstanceId`) de l'objet touché lors d'une collision, même lorsque la règle de collision est définie par *Type d'archétype* ou par *Tag*.
  - **Piste C — Référence Dynamique au Dernier Objet Créé (`targetMode: 'last_spawned'`)** :
    - Mémorisation de l'`EntityId` retourné par `spawnEntity` au sein de la séquence d'exécution de la règle (`lastSpawnedEntityId`).
    - Nouvelle cible **"Dernier objet créé"** permettant d'enchaîner dans une même règle la création d'une instance puis la modification de son état ou sa destruction après un délai.
  - **Piste D — Requête Spatiale Dynamique dans les Comportements Autonomes (`nearest_type` & `nearest_tag`)** :
    - Enrichissement des comportements **Aller vers (`move_to`)**, **Regarder vers (`look_at`)** et **Suivre (`follow`)** avec deux nouveaux modes : *Type d'objet le plus proche* et *Tag le plus proche (`#tag`)*.
    - Calcul spatial euclidien temps réel à 60 FPS (`findNearestTarget`) dans `matterPhysicsEngine.ts` permettant de poursuivre ou viser automatiquement les instances créées à la volée.
- **Palette Personnalisée Partagée par Projet (16 Couleurs avec IDs Durables & Sélecteur Direct au Clic)** :
  - Extension de la palette de dessin de 12 à **16 couleurs** (`pal-1` à `pal-16`) stockée au niveau du projet (`projectPalette`) et persistée dans les sauvegardes/exports.
  - **Sélecteur de couleur personnalisé directement sur la palette** : Appuyer directement sur n'importe quel emplacement de couleur dans la grille de la palette ouvre immédiatement le sélecteur de couleur natif et applique le choix à tout le projet.
  - Liaison par identifiant (`strokeColorId`, `fillColorId`) sur chaque tracé vectoriel (`VectorPath`).
  - Modification en direct d'une couleur de la palette (`updateProjectPaletteColor`) répercutée instantanément et durablement sur tous les dessins d'entités, états, archétypes personnalisés et calques de scène du projet qui utilisent ce slot.

## [Phase 10.5] - 2026-11-11
### Ajouté & Corrigé
- **Option Freeze Rotation pour le Rigidbody 2D (`freezeRotation`)** :
  - Ajout du paramètre `freezeRotation` dans la configuration physique (`PhysicsBehaviorConfig`) et dans l'interface de l'Inspecteur avec un switch clair.
  - Définition de l'inertie infinie dans Matter.js (`inertia: Infinity`) et verrouillage à 0° de l'angle et de la vélocité angulaire à chaque itération. L'objet ne bascule plus et reste droit lors des chocs et glissements.
- **Composant Modulaire d'Autodestruction Temporisée (`auto_destroy`)** :
  - Nouveau composant disponible dans l'Inspecteur (Catégorie *Cycle de Vie & Nettoyage*) permettant de définir une durée de vie en secondes (`delay`) avant suppression automatique de l'objet.
  - Décompte autonome géré frame par frame par la simulation physique, nettoyé proprement lors de l'arrêt du mode Play.
- **Correction Complète des Événements avec Auto-remise (Hover Enter/Exit & Collision Enter/Exit)** :
  - **Survol (Hover)** : suppression du cooldown parasite de 350ms sur les événements de sortie (`hover_exit`) et levée du filtre d'état strict sur la phase de sortie avec `autoRevert` actif, garantissant un retour immédiat à l'état initial.
  - **Collision** : maintien de l'état de collision actif (`nextCollisions[collisionKey] = true`) même après changement d'état par la règle d'entrée, évitant l'interruption prématurée du contact. Séparation du cooldown `enter` vs `exit` pour que la séparation (`isExiting`) et l'auto-remise s'exécutent instantanément.
- **Bascule d'État Avancée (Toggle State)** :
  - Enrichissement du sélecteur d'action dans le Wizard et dans la modale d'actions :
    1. Basculer entre 2 états précis choisis par l'utilisateur (menus déroulants avec aperçu).
    2. Basculer entre l'état actuel et un état cible (aller-retour binaire mémorisant l'état d'origine).
    3. Cycler séquentiellement entre tous les états de l'entité.
  - Résumé lisible et détaillé affiché directement dans le RuleBook (`(État A ⇄ État B)` ou `(Actuel ⇄ Cible)`).
- **Mode Dessin : Couleur Noire par Défaut** :
  - Initialisation rigoureuse de `initialStrokeColor="#000000"` à l'ouverture du mode plein écran (`FullScreenDrawingModal.tsx`) et remplacement des couleurs de repli par le noir `#000000`.
- **Nettoyage UX Inspecteur** :
  - Retrait du badge numérique compteur de comportements à côté du bouton "Ajouter".

## [Phase 10.4] - 2026-11-11
### Amélioré & Refactorisé
- **Inspecteur de Composants Style Unity (Attributs Empilés Ligne par Ligne)** :
  - Restructuration intégrale de `BehaviorManager.tsx` : suppression de toutes les grilles denses et étriquées.
  - Chaque variable/attribut est désormais isolé dans sa propre ligne pleine et empilé verticalement de façon aérée et lisible, identique à l'Inspecteur d'Unity.
  - Rendu visuel propre en cartes blanches légères avec label typographique, badges de valeurs temps réel et contrôles intuitifs (sliders, selects, inputs, boutons-bascules).
- **Terminologie et Ligne Dédiée pour l'Override** :
  - Remplacement systématique du terme "Surcharge" par **"Override"** dans l'ensemble de l'interface.
  - Ajout d'une ligne d'en-tête dédiée au sommet de chaque composant déplié affichant l'état (`Override actif pour l'état [X]` ou `Valeur partagée (tous les états)`) avec bouton d'action direct (`+ Créer un override` / `Annuler l'override`).
- **Calibration Différenciée du Rebond (Bounciness & Restitution)** :
  - Décorrélation nette entre le rebond contre les autres entités physiques (`physics.bounce`) et le rebond contre les bords de la scène (`boundary_behavior.bounciness`).
  - Murs et limites calibrés avec restitution neutre (0.0) et ajustement dynamique via l'écouteur `collisionStart` de Matter.js (`pair.restitution = boundaryBeh?.bounciness ?? physics?.bounce ?? 0.0`).
  - Si `bounce = 0`, l'objet s'arrête net sans aucun rebond artificiel.
- **Suppression Rigoureuse de l'Offset des Bords Invisibles** :
  - Placement de l'épaisseur des parois (`wallThickness = 100`) strictement à l'extérieur des limites `[0, w]` et `[0, h]`.
  - Élimination des décalages et paddings parasites dans `extractPathsBounds` et calibrage exact des fallbacks pour que les objets viennent buter et s'aligner précisément au pixel près sur la bordure visible du canvas.
- **Fiabilisation de la Détection de Collisions (Lentes et Instantanées)** :
  - Interrogation directe du solveur SAT/GJK de Matter.js via `getActivePhysicsCollisionPairs()` dans `checkCollision` pour une vérité terrain immédiate.
  - Ajout d'une tolérance de contact de 3px dans le test géométrique AABB/cercle pour les corps au repos ou à très faible vitesse.
  - Évaluation continue des règles à 60 FPS dans la boucle d'animation (`Scene.tsx`) réagissant instantanément aux trajectoires physiques autonomes (gravité, impulsions, patrouilles).

## [Phase 10.3] - 2026-11-11
### Corrigé & Calibré
- **Désactivation de la physique par défaut pour les entités sans composant** :
  - Les entités sans composant `physics` explicite sont désormais strictement statiques (`isStatic: true`), sans aucune gravité ni dérive.
  - Seules les entités disposant du composant `physics` (avec `isStatic: false`) sont soumises à la gravité et aux forces dynamiques.
  - Neutralisation de l'inertie de lancer au relâchement (`throwable`) pour les entités dépourvues de physique dynamique.
- **Calibrage de la vitesse de lancer (Élimination de l'hyper-accélération)** :
  - Conversion rigoureuse des vitesses du DOM (pixels/seconde) vers les unités de pas de Matter.js (pixels/trame à ~60Hz, soit division par 60), supprimant le facteur d'accélération intempestif ×60.
  - Détection d'immobilité avant relâchement (`now - last.time <= 90ms`) : si le curseur s'arrête avant de lâcher, aucun lancer résiduel n'est appliqué.
  - Double plafond de sécurité sur la vélocité maximale au lâcher et en vol (`maxSpeedPerTick = 25`, `maxVelocity = 30`).
- **Détection exacte des Colliders du Mode Dessin pour Matter.js** :
  - Extraction directe de la géométrie de collision (`getEntityColliderBounds`) issue du mode dessin (cercle, boîte, polygone).
  - Calcul et calage des dimensions réelles (`scaleX`, `scaleY`), des décalages d'ancrage (`relCenterX`, `relCenterY`) et des rayons dans le repère de la scène.
  - Recréation dynamique du corps Matter.js dès que la forme ou les dimensions du collider sont éditées dans l'atelier de dessin.
  - Les collisions physiques et rebonds coïncident désormais avec une exactitude sub-pixel sur le contour vert en pointillés défini par l'utilisateur.

## [Phase 10.2] - 2026-11-11
### Ajouté & Remplacé
- **Migration Intégrale vers le Moteur Physique Matter.js (`src/utils/matterPhysicsEngine.ts`)** :
  - Remplacement complet et définitif de l'ancien moteur arcade par un moteur 2D standard de corps rigides (*Matter.js Engine, World, Bodies, Body, Composite*).
  - Suppression intégrale de tous les fichiers et références à l'ancien moteur arcade.
  - Simulation réaliste par corps rigides avec masse dynamique, inertie angulaire, friction, amortissement de l'air (`frictionAir`), et coefficient de restitution (rebond élastique).
  - Murs et sol statiques infranchissables délimitant précisément la zone du canvas (`isStatic: true`).
  - Prise en charge native des collisions solides entre objets avec résolution d'impulsion, des obstacles inamovibles (`isStatic`), et des zones de passage fantômes / détecteurs d'événements (`isSensor: true` pour le mode `isTrigger`).
  - Synchronisation cinématique en direct lors du glisser-déposer (`syncEntityDragPosition`) garantissant que les objets bousculent physiquement leur environnement même lorsqu'ils sont tenus par le curseur.
  - Calcul de l'inertie de lâcher (Throw / Fling Momentum) avec injection immédiate de la vitesse vectorielle $(V_x, V_y)$ dans le corps physique Matter.js (`setEntityRuntimeVelocity`).
  - Intégration harmonieuse des comportements autonomes avec la simulation physique : contrôles joueur clavier (Top-down & Plateforme avec saut), vitesse continue, patrouille, Aller vers (Move To), Visée (Look At) et Suivi (Follow).

## [Phase 10.1] - 2026-11-11
### Ajouté & Optimisé
- **Inertie et Lancer Physique au Glisser-Déposer (Throw / Fling Velocity)** :
  - Échantillonnage de la trajectoire et du temps lors du drag (`handleDrag` avec mémoire glissante sur les dernières trames).
  - Calcul du vecteur vitesse instantané $(\Delta X/\Delta t, \Delta Y/\Delta t)$ et injection directe dans le moteur physique via `setEntityRuntimeVelocity`.
  - Continuation naturelle du mouvement avec gravité, rebond et friction lors du lâcher.
- **Refonte de l'Override de Composants par État (1-Click Localisé)** :
  - Suppression de l'onglet global déroutant : chaque composant affiche son statut direct (`Partagé (tous les états)` ou `Surcharge active pour [État]`).
  - Bouton dédié sur chaque composant pour activer une surcharge (`+ Surcharger`) ou l'annuler (`Annuler la surcharge`).
  - Modification transparente : agir sur les sliders modifie soit la surcharge si active, soit la valeur partagée pour tous les états.
- **Composant Modulaire "Déplaçable à la souris" (`draggable`)** :
  - Intégration de `draggable` dans la liste des composants avec option `throwable` (inertie) et plafond de vitesse.
  - Suppression de la case à cocher redondante dans l'Inspecteur au profit du système de composants unifié.
- **Collisions Solides & Triggers (`isTrigger` & `isStatic`)** :
  - Séparation spatiale et impulsion de rebond élastique entre entités physiques solides (`isTrigger: false`).
  - Prise en charge des obstacles statiques infranchissables (`isStatic: true`).
- **Éradication Définitive du Scintillement du Curseur sur Chrome / Blink** :
  - Remplacement de l'URL SVG dynamique par une texture 19×19 Base64 PNG matérielle avec point chaud centré `9 9`.
  - Cache matériel immédiat par le composant GPU de Chrome, supprimant le re-parsing SVG de Blink lors des déplacements.
- **Nettoyage UX** : Suppression du cadre/texte "aucun comportement attaché".

## [Phase 10] - 2026-11-10
### Ajouté & Optimisé
- **Architecture de Comportements Modulaires (Entity-Component System)** :
  - Ajout des composants de comportements sur les entités (`entity.behaviors`) et surcharges fines par état (`state.behaviorOverrides`).
  - Moteur de résolution pur `getEffectiveBehaviors(entity, currentState)` permettant l'héritage d'entité et la surcharge sélective par état (ex: désactiver la gravité sur un état pomme sur l'arbre, activer sur l'état tombée).
- **Moteur Physique Arcade 2D Réactif (`src/utils/arcadePhysicsEngine.ts`)** :
  - Boucle d'animation fluide à 60 FPS en mode Play via `requestAnimationFrame` avec pas de temps dynamique protégé contre les saccades d'horloge.
  - **Physique & Gravité** : Chute libre réglable (px/s²), masse, restitution/rebond élastique (0..1) et frottement de l'air/sol.
  - **Vitesse continue (Projectile & Rotation)** : Déplacement continu vectoriel ($V_x, V_y$) et vitesse angulaire continue (°/s).
  - **Contrôles Joueur (Clavier)** : Gestion fluide des flèches et touches ZQSD/WASD en mode *Vue de dessus (8 directions)* ou mode *Plateforme (gauche/droite + impulsion de saut avec gestion du sol)*.
  - **Patrouille (Aller-retour autonome)** : Déplacement oscillatoire sur axe horizontal ou vertical, portée paramétrable et temps de pause aux extrémités.
  - **Aller vers (Move To)** : Ralliement direct d'une position fixe $(X, Y)$ ou d'une autre entité de la scène à vitesse paramétrable.
  - **Orientation & Visée (Look At)** : Alignement angulaire direct ou lissé (`smoothSpeed`) vers le curseur de souris ou une entité cible avec décalage angulaire.
  - **Suivi (Follow)** : Poursuite de la souris ou d'une entité avec distance d'arrêt minimale et vitesse réglable.
  - **Gestion des Bords de Scène (Boundaries)** : Rebond élastique, téléportation continue (Wrap style Asteroids) et butée infranchissable (Clamp).
- **Interface Inspecteur & Gestionnaire de Composants (`BehaviorManager.tsx`)** :
  - Panneau accordéon dédié avec sélecteur de portée instantané ("Base de l'objet" vs "Surcharges pour l'état X").
  - Modale catégorisée d'ajout de composants selon les 5 univers fonctionnels.
  - Sliders, inputs numériques et dropdowns pour tous les paramètres de comportement.
  - Sauvegarde et restauration automatique des positions et rotations à la sortie du mode Play.

## [Phase 9.1] - 2026-11-10
### Ajouté & Perfectionné
- **Élimination Définitive du Scintillement du Curseur** :
  - Déclaration de la classe CSS statique `.atelier-fine-crosshair` dans `index.css` mise en cache par le moteur graphique du navigateur, supprimant les recalculs d'URL de données SVG en boucle.
  - Arrêt du re-render React à 120Hz/240Hz : suppression de l'appel `setCursorPos` lors du survol normal en dessin.
  - Application cohérente sur la scène, le canvas de dessin et les calques sans conflits de pointeur.
- **Pot de Peinture Hybride Haute Fidélité (Option B)** :
  - **Niveau 1 (Formes fermées)** : Remplissage direct `fill: couleur` sur les rectangles, cercles et boucles vectorielles fermées. Exactitude mathématique absolue à 100%, zéro polygone supplémentaire créé.
  - **Niveau 2 (Intersections de traits multiples)** : Détection sur masque haute définition 1000×1000 px (supersampling 5×) avec simplification RDP préservant les segments droits (ex: segment vertical vert de la capture 01) et lissage naturel des courbes sans effet de boudin.
- **Système de Gestion de Calques dans l'Atelier de Dessin (Drawing Layers)** :
  - Nouveau modèle `DrawingLayer` (nom, visibilité œil, verrouillage cadenas, opacité).
  - Panneau interactif des calques dans la barre latérale : création (`+ Nouveau`), renommage par double-clic, réordonnancement (monter/descendre), suppression, et réglage d'opacité.
  - Rendu étagé des calques de bas en haut dans le SVG avec masquage dynamique et protection contre le dessin sur calque verrouillé.
  - Sélecteur de calque dans l'inspecteur pour réassigner instantanément les tracés sélectionnés.
  - Sauvegarde et persistance transparente dans les états d'entités avec rétrocompatibilité totale.

## [Phase 9] - 2026-11-10
### Corrigé & Optimisé
- **Curseur Croix Fine & Élimination du Scintillement (Edit & Dessin)** :
  - Curseur fin `FINE_CROSSHAIR_CURSOR` (croix 19x19 fine blanche et noire ultra-nette) défini par défaut en mode édition et dans l'atelier de dessin.
  - Élimination des scintillements de curseur lors du survol de tracés existants grâce à l'isolation des événements pointeur (`pointerEvents: none` sur les traits pendant le dessin).
  - En mode Play, conservation stricte des curseurs dynamiques définis dans les paramètres du projet.
- **Remplissage Pot de Peinture sans Fermeture Forcée des Tracés** :
  - Détection automatique des cavités fermées créées par l'intersection de plusieurs tracés ouverts ou fermés (Moore-Neighbor 8-connected contour tracing sur masque de rastérisation + Ramer-Douglas-Peucker).
  - Rendu vectoriel du remplissage en arrière-plan (`[fillPath, ...paths]`) sans jamais modifier ni forcer la fermeture (`Z`) des tracés originaux (respect des formes ouvertes comme illustré dans les captures 01 et 02).
- **Sélecteur de Couleur Personnalisée dans l'Atelier de Dessin** :
  - Ajout d'un sélecteur complet (pastille visuelle active, palette rapide, input natif `type="color"` et champ hexadécimal direct en direct) pour la couleur de contour et de remplissage.
- **Couleur Noire par Défaut** :
  - Couleur noire (`#000000`) définie comme couleur de départ pour tous les nouveaux tracés et ateliers de dessin.
- **Fiabilisation Complète de l'Undo / Redo** :
  - Gestion d'historique synchronisée par références stables (`historyRef` et `historyIndexRef`), éliminant les bugs de closures périmées.
  - Prise en charge des raccourcis clavier Ctrl+Z / Cmd+Z (Annuler) et Ctrl+Y / Cmd+Shift+Z (Rétablir), ainsi que des boutons UI avec désactivation réactive.
- **Paramétrage Précis du Délai d'Action (Secondes)** :
  - Étape dédiée `delay_duration_picker` dans le Wizard séquentiel et `choose_delay_duration` dans la modal d'action.
  - Choix rapide par presets (0.2s, 0.5s, 1s, 2s, 3s, 5s), slider fluide et saisie numérique exacte au dixième de seconde.
- **Sections Repliées par Défaut dans les Paramètres (Settings)** :
  - Accordéons du panneau des paramètres (`files`, `canvas`, `rules`, `cursors`, `play`) initialisés tous fermés pour une vue épurée à l'ouverture.

## [Phase 8] - 2026-11-08
### Ajouté & Optimisé
- **Support complet des 6 nouveaux types de conditions** :
  - **⏱️ Timers & Chronomètres (`timer`)** : déclencheur après X secondes (délai unique) ou répétition toutes les X secondes.
  - **⌨️ Événements Clavier (`keyboard`)** : écoute globale des touches (Flèches directionnelles, Espace, Entrée) en mode Play.
  - **🔄 Changements d'État (`state_change`)** : réaction en chaîne quand une entité passe à un état donné.
  - **📏 Proximité & Distance (`proximity`)** : détection de rapprochement (&lt; 80px) entre deux entités.
  - **🖼️ Bords de Scène (`boundary`)** : réaction au contact avec le cadre du canvas.
  - **📊 Variables & Système de Score (`variable` / `add_score`)** : action d'ajout au score (+1), affichage dynamique du badge `🏆 Score` en mode Play et condition sur seuil de score.

## [Phase 7] - 2026-11-08
### Ajouté & Optimisé
- **Lissage du Dessin Direct Vectoriel sur Canvas (Stroke Width & Alignement Précis)** :
  - Alignement exact 1:1 entre les coordonnées du curseur et la vue SVG (`preserveAspectRatio="none"`), éliminant tout décalage (offset) de pointeur.
  - Garantie de constante d'épaisseur de trait (`strokeWidth`) et de rendu visuel entre la prévisualisation en direct et la sauvegarde du calque vectoriel.
  - Retrait du bouton "Dessiner" sur les lignes de calques dans `SceneLayerManager` pour une UI épurée (la sélection de la ligne de calque active directement le mode dessin canvas).
- **Organisation des Conditions en 4 Cases Logiques dans le RuleBook** :
  - Restructuration visuelle de l'Étape 2 du Wizard et du modal de choix d'événement en 4 cases thématiques avec contours colorés et icônes distinctes :
    1. **Collisions & Contacts** (*Collision Entrée*, *Collision Sortie*, *Contact Continu*, *Relâchement sur Cible*).
    2. **Clics & Pointeur** (*Clic Complet*, *Appui / Down*, *Relâchement / Up*).
    3. **Survol Souris (Hover)** (*Survol Entrée*, *Survol Sortie*).
    4. **Glisser-Déposer Libre** (*Relâchement dans le vide / Drop*).
- **Déclencheurs Explicit "Collision Entrée" et "Collision Sortie"** :
  - Prise en charge complète dans le moteur physique de `collision` avec `phase = 'enter'` (premier contact) et `phase = 'exit'` (séparation des colliders) avec badges et étiquettes explicites dans la vue storyboard.

## [Phase 6] - 2026-11-08
### Ajouté & Optimisé
- **Dessin Direct sur Canvas de Scène (Calques Background / Foreground)** :
  - Possibilité de dessiner directement sur le canvas principal de la scène lors de la sélection d'un calque de décor (sans ouvrir de modal plein écran).
  - Intégration du composant `DrawingToolsPanel` dans la colonne de droite (à la place de l'inspecteur) lors de l'édition d'un calque (outils crayon, lignes, formes géométriques, remplissage pot de peinture, gomme, sélecteur de couleurs et épaisseur).
- **Persistance de l'État Plié / Déplié des Règles (Accordéon)** :
  - Migration de l'état `collapsedRuleIds` vers le store central `useSceneStore`.
  - Conservation automatique des règles pliées ou dépliées lors du basculement Mode Play / Mode Edit et lors des changements d'onglets ou de fenêtres.
- **Nouveaux Déclencheurs de Survol Souris (Hover Enter & Exit)** :
  - Ajout du type de déclencheur `hover` avec choix explicite de sous-phase : **Survol Entrée** (`enter` / `hover_enter`) et **Survol Sortie** (`exit` / `hover_exit`).
- **Déclencheurs d'Appui (Mouse Down) et Relâchement (Mouse Up)** :
  - Ajout des déclencheurs d'appui enfoncé (`down` / `mouse_down`) et de relâchement (`up` / `mouse_up`) dans les règles de clics.
- **Lisibilité & Superposition Améliorées dans la Fenêtre de Spawn (`SpawnLocationPicker`)** :
  - Fenêtre relative interactive plus grand format avec fond blanc (`bg-white`) et grille nette.
  - Sélecteur d'ancre de référence explicite pour basculer entre **Sujet** et **Cible**.
  - Rendu de l'objet à créer en superposition semi-transparente (`opacity-70`) pour visualiser clairement le chevauchement avec l'objet d'ancrage.
  - Taille initiale par défaut réglée sur 256px par 256px.

## [Phase 4 & 5] - 2026-11-07
### Ajouté & Optimisé
- **Arrière-plans et Décors Multi-Calques Dessinables (Background & Foreground)** :
  - Intégration de `SceneLayerManager` dans l'onglet **Scène** : groupes de calques dépliables et configurables (*Arrière-plan*, *Premier-plan*, ou groupes personnalisés).
  - Dessin vectoriel direct sur chaque calque via le bouton dédié *« Dessiner »*, ouvrant l'atelier vectoriel complet.
  - Rendu étagé SVG haute fidélité dans la scène (calques d'arrière-plan en dessous des entités de jeu, calques de premier-plan au-dessus).
  - Sauvegarde et restauration automatiques des calques dans les slots et les exports de projet.
- **Épuration Visuelle du Canvas** :
  - Suppression de l'étiquette/badge textuel *"Format 16:9"* superposé sur le canvas.
- **Gestionnaire de Sauvegardes Locales par Slots Nommés (Browser Storage)** :
  - Modal `ProjectSlotsModal` complet pour enregistrer plusieurs projets sous des noms personnalisés.
  - Correction et fiabilisation du bouton **"Écraser"** avec confirmation inline interactive à 2 étapes, totalement affranchie des fenêtres pop-up `window.confirm` bloquées par les navigateurs.
  - Bouton d'accès rapide dans la barre d'en-tête représenté exclusivement par une icône de disquette (`Save`) épurée.
- **Formats & Ratios de Scène Configurables (Ancrés en haut & Centrés)** :
  - Support natif des ratios **16:9** (Paysage), **4:3** (Rétro), **1:1** (Carré), **9:16** (Mobile vertical) et **Libre** (Pleine fenêtre).
  - Ancrage solide en haut et centrage horizontal (`items-center justify-start`) garantissant que la zone de dessin reste toujours visible sans jamais s'effondrer ou disparaître lors des basculements de format.
- **Masquage temporaire du mode Kiosk** :
  - Le bouton Kiosk a été retiré de la barre d'en-tête selon la demande.

## [Phase 3.3] - 2026-11-07
### Perfectionné
- **Ergonomie du Bouton Play & Mode Jeu** :
  - Le clic sur le bouton Play en mode Jeu bascule immédiatement en mode Édition.
  - Suppression du toaster / badge flottant "MODE PLAY" dans la scène.
  - Ajustement de l'assombrissement par défaut sur "Léger" (Light).
- **Organisation des Paramètres & Pliage des Curseurs** :
  - Repositionnement du bloc "Import / Export & Sauvegarde" tout en haut de l'onglet des Paramètres.
  - Ajout d'un bouton chevron pour plier/déplier la section "Curseurs Dynamiques (Mode Jeu)".

## [Phase 3.2] - 2026-11-07
### Perfectionné & Restructuré
- **Choix des Actions en 3 Sections Encadrées Distinctes** :
  - Remplacement des 2 colonnes par 3 sections rectangulaires clairement délimitées :
    1. **Section SUJET** (actions affectant l'entité Sujet uniquement : changer d'état, toggle/cycle, détruire).
    2. **Section CIBLE** (actions affectant l'entité Cible uniquement lors d'une collision : changer d'état de la cible, détruire la cible).
    3. **Section MONDE & EFFETS** (actions globales et tierces : créer un objet/spawn, jouer un effet sonore, modifier un autre objet tierce C, détruire un autre objet tierce C).
- **Accordéon Pliable Minimaliste (Icône Seule)** :
  - Suppression des textes *"Repliée"*, *"Dépliée"* et *"Déplier ▾"* au profit exclusif de l'icône chevron (`ChevronRight` / `ChevronDown`) pour un design épuré et compact.
- **Immersion Visualisée du Mode Play (Overlay Paramétrable)** :
  - Assombrissement dynamique de l'interface en mode Play (`bg-slate-950` et voile sombre sur les panneaux latéraux) pour distinguer immédiatement la phase de jeu de la phase d'édition.
  - Fenêtre canvas surélevée avec anneau lumineux vert émeraude (`ring-4 ring-emerald-500/30`) et badge animé *"MODE PLAY"*.
  - Paramètres dédiés dans l'inspecteur de configuration : toggle d'activation et 3 niveaux d'intensité (Léger 40%, Moyen 65%, Intense 85%).

## [Phase 3.1] - 2026-11-07
### Rétabli & Perfectionné
- **Restauration de la vue Storyboard Horizontale en Une Ligne** :
  - La liste des règles à la racine du Rulebook retrouve son affichage horizontal en continu : `[Sujet] [Événement] [Cible] ➔ [Cartes Actions...] + [+ Action]`.
  - **Bouton d'Accordéon (`ChevronDown` / `ChevronRight`)** : permet de replier/déplier chaque règle individuellement en une fine ligne synthétique (`Sujet ➔ Événement ➔ Cible ➔ X actions`), offrant une vue d'ensemble compacte sans encombrer la vue.
- **Fenêtre de Choix des Actions en 2 Colonnes Sémantiques (Wizard Étape 4 & Modal Action)** :
  - **Colonne Gauche (SUJET)** : En-tête avec badge violet, miniature dynamique (`EntityMiniPreview`) et nom réel de l'entité ; regroupe *Changer l'état du Sujet*, *Basculer l'état (Toggle ⇄ / Cycle)* et *Détruire le Sujet*.
  - **Colonne Droite (CIBLE & MONDE)** : En-tête avec miniature dynamique et nom réel de la cible touchée (ou Monde & Effets si non-collision) ; regroupe *Changer l'état de la Cible*, *Détruire la Cible*, *Créer un nouvel Objet (Spawn)*, *Jouer un effet sonore*, *Changer un Autre Objet* et *Détruire un Autre Objet*.
  - Nom réel et miniature visuelle intégrés dans chaque carte pour une compréhension immédiate sans hésitation.

## [Phase 3] - 2026-11-07
### Ajouté & Optimisé
- **Rulebook Restructuré en 2 Colonnes Sémantiques** :
  - Colonne Gauche : Dédiée exclusivement au **Sujet** (carte visuelle avec miniature `EntityMiniPreview`, sélecteur d'état requis, liste des actions ciblant le sujet, bouton d'ajout d'action sur le sujet).
  - Colonne Droite : Dédiée à la **Cible et au Monde** (carte visuelle de la cible avec miniature et état requis, liste des actions ciblant la cible, instanciations, sons, et bouton d'ajout d'action cible/monde).
  - Bandeau horizontal supérieur dédié au type d'événement (Collision, Clic, Relâcher, Contact continu) avec phase détaillée et configuration au clic.
- **Miniatures Graphiques Directes dans les Actions** :
  - Chaque action affiche un aperçu miniature en direct (`EntityMiniPreview`) de l'état futur ciblé et le nom explicite de l'entité.
  - Pré-écoute directe des effets sonores avec bouton `Test` intégré sur la carte.
- **Système de Dossiers Thématiques Pliables & Recherche Instantanée** :
  - Création, modification et suppression de dossiers thématiques de règles avec pastilles de couleur.
  - Barre d'onglets de dossiers avec badges numériques du nombre de règles contenues.
  - Recherche instantanée par nom de règle, nom d'entité, type d'action ou son.
  - Sélecteur de dossier direct sur l'en-tête de chaque règle pour un classement immédiat.
- **Système Audio Étendu (Microphone & Fichiers Importés)** :
  - Composant `SoundRecorderModal` : enregistrement vocal direct depuis le micro via l'API Web Audio et `MediaRecorder`, avec vu-mètre en temps réel et chronomètre.
  - Import de fichiers audio locaux (formats MP3, WAV, OGG, WebM).
  - Pré-écoute immédiate, nommage et sauvegarde persistée dans la bibliothèque audio du projet.
  - Sélection des sons personnalisés ou synthétisés dans l'action `Jouer un son` (dans l'éditeur d'action et dans le wizard séquentiel).

## [Phase 2] - 2026-11-07
### Ajouté & Optimisé
- **Pack de Curseurs Vectoriels par défaut** :
  - Intégration du pack utilisateur JSON (`pack-curseurs-2026-11-07_b1d15da7.json`) actif dès le premier lancement.
  - Configuration par défaut : `cursorSourceMode: 'custom_drawn'`, ombres désactivées (`cursorShadow: false`).
- **Hiérarchie de Scène Épurée** :
  - Masquage des libellés "Plan #X" et des boutons fléchés au profit du réordonnancement direct par poignée de glisser-déposer.
- **Expérience de Dessin iPad & Apple Pencil Fluide** :
  - Migration vers les Pointer Events unifiés avec capture du pointeur (`setPointerCapture`).
  - Prise en charge des événements coalescés (`getCoalescedEvents()`) pour capter chaque point d'échantillonnage de l'Apple Pencil (120Hz/240Hz).
  - Élimination de la quantification au pixel entier : coordonnées sous-pixel lissées sans escalier ni aspect "pérsillé".
  - Verrouillage pleine page iPad (`100dvh`, `overscroll-behavior: none`, désactivation du zoom accidentel).
- **Pot de Peinture Vectoriel & Auto-fermeture** :
  - Remplissage vectoriel direct (`fill`) avec fermeture automatique (`Z`) si les extrémités d'un tracé libre sont proches (< 24px).
  - Remplissage à l'intérieur d'un contour polygonal fermé via ray-casting.
  - Désactivation du fond involontaire en mode crayon libre pour éviter l'effet "lasso bizarre".
- **Sélection Multi-Tracés dans l'Atelier de Dessin** :
  - Sélection multiple au Shift + clic ou par cadre de sélection (Marquee drag sur fond vide).
  - Boîte englobante commune permettant de déplacer tous les tracés sélectionnés d'un seul geste.
  - Duplication, suppression et mise à jour simultanée des couleurs/épaisseurs pour l'ensemble de la sélection.

## [Prototype 3] - 2026-08-30
### Ajouté
- **Actions Toggle Bi-directionnelles & Cycliques** (`toggle_state`) :
  - Possibilité d'alterner entre deux états spécifiques (A ⇄ B) ou de cycler séquentiellement entre tous les états d'une entité.
- **Instanciation d'Objets avec Placement Précis** (`spawn_entity`) :
  - Support des modes `offset_subject` (décalage relatif au sujet, ex: sortie d'arme / projectile).
  - Support des modes `offset_target` (décalage relatif à la cible).
  - Support du placement absolu (`absolute`) avec coordonnées précises (X, Y).
- **Actions sur Entités Tierces** :
  - Modification d'état ou destruction d'une tierce entité C lors d'un événement entre A et B.
- **Réinitialisation Automatique Scène (Mode Play ⇄ Edit)** :
  - Système de snapshot préservant l'état originel des entités lors du passage en mode lecture.
  - Nettoyage automatique des objets instanciés en mode play (`spawn-*`) et restauration des états/objets lors du retour au mode édition.
- **Gestion Avancée des Colliders** :
  - Prise en compte du collider circulaire ou rectangulaire pour les interactions pointeur (clic, drag, hover).
- **Amélioration UX Éditeur** :
  - Ouverture automatique de l'atelier de dessin lors de la création d'un nouvel état.
  - Double-clic sur le nom de l'entité réservé au renommage textuel.

## [Prototype 2] - 2026-08-08
### Ajouté
- **Conditions d'État sur les Déclencheurs** :
  - Support des filtres d'état pour le Sujet et la Cible (`subjectStateId` & `targetStateId`).
  - Possibilité de spécifier un état exact requis (ex: `QUAND [Étoile] (à l'état [Étincelant]) touche [Pomme]`) ou de sélectionner `(peu importe l'état)`.
  - Intégration dans le moteur d'évaluation en temps réel (`evaluateRulesWithTemp` et `triggerClickEvent`).
  - Nouveaux préréglages illustrant les déclencheurs conditionnels par état dans le RuleBook.
- **Moteur de Règles Hybride (RuleBook)** :
  - Hybridation des options A (Cartes lisibles) et B (Briques d'actions modulaires).
  - Déclencheurs réactifs : `Collision / Contact` entre objets et `Clic` sur un objet.
  - Briques d'actions empilables : *Passer à un état visuel*, *Basculer la possibilité de glisser (Draggable)*, *Faire disparaître de la scène*.
  - Préréglages (Meta-blocs en 1-clic) : *"Croquer la pomme au clic"*, *"Manger la pomme au contact"*, *"Étincelle d'étoile au clic"*.
  - Bouton On/Off (Actif / Inactif) sur chaque carte de règle.

## [Prototype 1] - 2026-08-08
### Ajouté
- **Inspecteur de Dessin (Inspector)** : Panneau latéral d'inspection de l'entité sélectionnée.
- **Éditeur d'États** :
  - Création de nouveaux états ("+ Créer état").
  - Basculement instantané entre états pour tester les animations en direct.
  - Réglage de l'échelle, de la rotation et de la couleur principale de chaque état.
  - Réglages spécifiques pour la plante : hauteur de tige, nombre de pétales, couleur de la fleur.
- **Création & Gestion d'Entités** :
  - Boutons d'ajout rapide (🌱 Plante, 🍎 Pomme, ⭐ Étoile) sur la scène et dans l'en-tête.
  - Activer / désactiver la possibilité de glisser un objet (prop `isDraggable`).
  - Suppression d'un dessin de la scène.
- **Composant CustomShape** : Support des étoiles/formes magiques réactives.

## [Prototype 0] - 2026-08-08
### Ajouté
- Scène interactive avec Plante et Pomme.
- Animation fluide Motion entre états (`pousse` / `fleur`).
- Détection de collision AABB et règle automatique en dur.
- Documentation d'architecture initiale dans `/docs/`.
