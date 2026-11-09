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
