# État du Projet

## Complété
- **Gestionnaire Complet de Calques de Dessin (Drawing Layers)** : Chaque état d'objet intègre son propre système de calques (pile ordonnée, calque actif, visibilité œil, verrouillage cadenas, réglage d'opacité, réordonnancement premier-plan/arrière-plan, suppression et réassignation des tracés sélectionnés).
- **Pot de Peinture Hybride Haute Fidélité (Option B)** : Remplissage vectoriel direct 100% pur sur les formes fermées (`fill: couleur` sans polygone créé) et détection à 1000×1000 px pour les croisements de traits multiples (préservant les segments droits sans déformation).
- **Éradication Définitive du Scintillement du Curseur** : Mise en cache statique du curseur via `.atelier-fine-crosshair` dans `index.css` et arrêt des re-renders React à 120Hz sur le simple survol du pointeur.
- **Curseur Croix Fine & Scintillement Éliminé** : Remplacement de la grosse croix OS par une croix fine 19px blanche/noire ultra-nette (`FINE_CROSSHAIR_CURSOR`) en mode édition et dans le canvas de dessin. Résolution du scintillement par suppression des bascules d'événements pointeur sur les tracés SVG lors du tracé. En mode Play, conservation des curseurs personnalisés configurés dans les paramètres.
- **Pot de Peinture avec Détection Réelle de Cavités Fermées** : Remplissage par flood fill rasterisé haute résolution et vectorisation Moore-Neighbor 8-connectée. Les tracés sous-jacents restent strictement intacts et ouverts (aucun ajout forcé de `Z` ni déformation géométrique).
- **Couleur Noire par Défaut & Sélecteur Personnalisé (HEX/Palette)** : Initialisation des outils de dessin sur le noir `#000000`, intégration d'un sélecteur complet avec pastille d'état, palette, pipette/input couleur et champ hexadécimal libre.
- **Undo / Redo Robuste & Réactif** : Gestion de l'historique par références directes (`historyRef` / `historyIndexRef`), écoute globale des raccourcis Ctrl+Z / Cmd+Z / Ctrl+Y / Cmd+Shift+Z sans perte d'état et boutons d'interface synchronisés.
- **Action Délai (Pause) Paramétrable en Secondes** : Étape dédiée dans le Wizard (`delay_duration_picker`) et dans la modale d'action (`choose_delay_duration`) avec presets rapides (0.2s à 5s), curseur continu et champ numérique libre.
- **Sections des Paramètres Pliées par Défaut** : Initialisation à `false` de tous les volets de configuration pour un menu clair et épuré.
- **Pack de Curseurs Vectoriels par défaut** : Intégration du pack utilisateur (`cursorSourceMode: 'custom_drawn'`, ombres désactivées, 7 états dessinés à la main : idle, hover_drag, hover_click, click, drag, release, hover_drag_click).
- **Simplification de la Fenêtre Hiérarchie (Scène)** : Retrait des badges "Plan #X" et des boutons fléchés manuels au profit exclusif du réordonnancement par glisser-déposer (drag & drop réactif avec poignées).
- **Lissage du Tracé sur iPad & Apple Pencil** :
  - Support natif des `PointerEvent` unifiés avec capture du pointeur.
  - Récupération des sous-événements haute fréquence via `getCoalescedEvents()` (120Hz/240Hz ProMotion).
  - Élimination des coordonnées tronquées au pixel entier : précision sous-pixel au dixième de point sans effet d'escalier ni aspect "pérsillé".
  - Filtre anti micro-jitter (< 0.7px) et extrémités/jointures arrondies (`round`).
- **Plein écran iPad sans défilement (One Page)** :
  - `100dvh` strict et `overscroll-behavior: none` pour empêcher les rebonds élastiques et le scroll de page sur Safari iPad.
  - Balise viewport calibrée avec `maximum-scale=1.0, user-scalable=no, viewport-fit=cover`.
- **Pot de Peinture Vectoriel & Fermeture Automatique** :
  - Détection automatique de fermeture de boucle si les extrémités d'un tracé sont proches (< 24px) lors du dessin ou au clic du pot de peinture.
  - Remplissage vectoriel direct (`fill`) avec fermeture du contour SVG (`Z`).
  - Remplissage par point dans le polygone (ray-casting) ou par forme rectangulaire.
  - Séparation stricte du tracé au crayon (sans fond involontaire) pour éviter l'effet "lasso bizarre".
- **Sélection Multi-Tracés dans l'Atelier de Dessin** :
  - Sélection multiple via Shift + clic ou cadre de sélection rectangulaire (Marquee drag sur l'espace vide).
  - Déplacement synchronisé de tous les tracés sélectionnés en un seul bloc.
  - Cadre de sélection global englobant.
  - Duplication et suppression groupées.
  - Modification simultanée des couleurs de contour, épaisseurs et remplissages.

- **Visualisation Storyboard en Une Ligne & Accordéon Épuré (Sans texte)** :
  - Restauration de la vue storyboard horizontale en une seule ligne à la racine du Rulebook (`[Sujet] [Événement] [Cible] ➔ [Cartes Actions...] + [+ Action]`).
  - Bouton d'accordéon minimaliste composé uniquement du chevron (`ChevronDown` / `ChevronRight`) sans libellés textuels encombrants, aussi bien sur l'en-tête que sur la règle repliée.
- **Fenêtre de Choix des Actions en 3 Sections Encadrées Distinctes (Wizard Étape 4 & Modal Action)** :
  - **Section 1 : SUJET (Qui agit)** : Rectangle encadré avec badge indigo, miniature visuelle dynamique (`EntityMiniPreview`) et nom réel du Sujet ; regroupe *Changer l'état du Sujet*, *Basculer l'état (Toggle ⇄ / Cycle)* et *Détruire le Sujet*.
  - **Section 2 : CIBLE (Touchée)** : Rectangle encadré présent en cas de collision avec badge émeraude, miniature visuelle dynamique et nom réel de la Cible touchée ; regroupe *Changer l'état de la Cible* et *Détruire la Cible*.
  - **Section 3 : MONDE & EFFETS** : Rectangle encadré indépendant pour les actions globales ; regroupe *Créer un nouvel Objet (Spawn)*, *Jouer un effet sonore*, *Changer un Autre Objet (Tierce)* et *Détruire un Autre Objet (Tierce)*.
- **Commandes & Ergonomie du Mode Play** :
  - Le clic sur le bouton Play en mode Play fait immédiatement basculer l'application en mode Édition.
  - Retrait du toaster flottant "MODE PLAY" dans le coin du canvas.
  - Opacité d'assombrissement par défaut réglée sur "Léger" (Light).
- **Organisation des Paramètres & Curseurs** :
  - Section "Import / Export & Sauvegarde" repositionnée tout en haut du panneau des Paramètres.
  - Section "Curseurs Dynamiques (Mode Jeu)" dotée d'un bouton fléché plier/déplier (chevron) pour un panneau plus compact et lisible.
- **Système de Dossiers Thématiques & Recherche Instantanée** :
  - Dossiers thématiques personnalisables avec pastilles colorées (ex: Interactions, Contrôles, Effets).
  - Onglets dynamiques avec compteurs de règles et suppression.
  - Déplacement et assignation rapide d'une règle dans un dossier via menu déroulant dédié.
  - Recherche textuelle en direct (nom de règle, entité sujet, entité cible, types d'actions, sons).
- **Système Audio Étendu (Microphone & Fichiers)** :
  - `SoundRecorderModal` : Enregistreur vocal direct via microphone (Web Audio API + `MediaRecorder` + vu-mètre animé en direct).
  - Pré-écoute immédiate du son enregistré avec nommage et sauvegarde dans les sons du projet.
  - Import de fichiers audio locaux (MP3, WAV, OGG, WebM).
  - Sélection des sons personnalisés ou synthétisés dans l'action `Jouer un son` avec bouton d'audition rapide `Test`.

- **Système de Sauvegardes Locales par Slots Nommés (Navigateur)** :
  - Modal `ProjectSlotsModal` avec gestion complète : sauvegarder l'état actuel sous un nouveau nom, charger un projet, écraser un slot existant (bouton "Écraser" avec confirmation inline réactive 100% fiable sans popup bloqueuse), dupliquer, renommer et supprimer.
  - Métadonnées riches affichées pour chaque slot : date et heure de dernière mise à jour, nombre d'entités, nombre de règles, format d'aspect ratio, badge "Projet Actif".
  - Bouton d'accès rapide dans la barre d'en-tête représenté exclusivement par une icône de disquette (`Save`) épurée.
- **Formats & Ratios de Scène Configurables (Ancrés en haut & Centrés)** :
  - Presets standards disponibles : **16:9** (Paysage), **4:3** (Rétro), **1:1** (Carré), **9:16** (Mobile / Vertical) et **Libre** (Plein écran).
  - Ancrage propre au sommet du conteneur (`justify-start`), centré horizontalement (`items-center`), évitant tout effondrement ou disparition du canvas lors des changements de format.
  - Sélecteur de ratio visuel directement accessible dans le panneau des Paramètres.
- **Dessin Direct sur Canvas de Scène (Calques Décor Background & Foreground)** :
  - Dessin vectoriel en direct directement sur le canvas principal de la scène lors de l'édition d'un calque de décor.
  - Panneau d'outils de dessin vectoriel (`DrawingToolsPanel`) affiché dans le tiroir de droite à la place de l'inspecteur lorsqu'un calque est sélectionné (crayon, lignes, rectangles, cercles, pot de peinture, gomme précise et trait, palettes de couleurs contour et fond, slider d'épaisseur, annulation).
- **Persistance de l'État de Pliage/Dépliage des Règles (Accordéon)** :
  - Conservation de l'état plié/déplié (`isCollapsed`) de chaque règle à la racine du Rulebook dans le store global `useSceneStore`.
  - Maintien rigoureux de l'état d'accordéon lors du passage en mode Play / Édition et lors des changements d'onglets ou de fenêtres.
- **Nouveau Déclencheur "Survol Souris" (Mouse Hover Enter & Exit)** :
  - Ajout du déclencheur d'événement **Survol Souris** (`TriggerType = 'hover'`).
  - Sélection précise de la phase souhaitée : **Survol Entrée** (`enter` / `hover_enter`) vs **Survol Sortie** (`exit` / `hover_exit`).
- **Déclencheurs "Clic Enfoncé" (Mouse Down) et "Clic Relâché" (Mouse Up)** :
  - Ajout des sous-phases d'appui (**Mouse Down**) et de relâchement (**Mouse Up**) au déclencheur de clic.
- **Amélioration de la Fenêtre d'Aperçu de Création d'Objet (`SpawnLocationPicker`)** :
  - Fenêtre relative interactive plus grand format avec fond blanc épuré (`bg-white`) et repères de grille clairs.
  - Sélecteur d'ancre de référence explicite pour basculer la position relative entre le **Sujet** et la **Cible**.
  - Rendu de l'objet à créer en superposition semi-transparente (`opacity-70`) pour apercevoir nettement le chevauchement et l'empilement visuel sur l'objet ancré.
  - Dimensions par défaut de l'objet créé ajustées sur 256px par 256px.

- **Lissage du Dessin Direct Vectoriel sur Canvas (Stroke Width & Alignement Précis)** :
  - Élimination du saut ou changement d'épaisseur de trait (`strokeWidth`) après avoir relâché le pointeur en dessin direct.
  - Alignement exact 1:1 sans aucun décalage (offset) entre le curseur et le tracé vectoriel via le calage `preserveAspectRatio="none"` sur le `DirectCanvasDrawingOverlay`.
  - Épure de l'interface des calques dans `SceneLayerManager` : suppression du bouton "Dessiner" superflu car la simple sélection du calque active le mode dessin sur le canvas principal et ouvre le panneau d'outils vectoriels à droite.
- **Organisation des Conditions en 4 Cases Logiques dans le RuleBook** :
  - Étape 2 du wizard séquentiel et modal d'événement restructurés en 4 grands cadres à bordures colorées :
    1. **Collisions & Contacts entre Objets** (Bordure Indigo/Sky) : *Collision Entrée*, *Collision Sortie / Séparation*, *Contact Continu*, *Lâché sur Cible*.
    2. **Clics & Pointeur** (Bordure Violet/Purple) : *Clic Complet*, *Appui Clic (Mouse Down)*, *Relâchement Clic (Mouse Up)*.
    3. **Survol Souris (Hover)** (Bordure Amber/Yellow) : *Survol Entrée (Mouse Hover Enter)*, *Survol Sortie (Mouse Hover Exit)*.
    4. **Glisser-Déposer Libre** (Bordure Emerald/Teal) : *Relâchement libre dans le vide (Drop)*.
- **Ajout Intégral de toutes les Nouvelles Conditions & Système de Score** :
  - **⏱️ Minuteurs & Chronomètres (`timer`)** : support des délais uniques (ex: *Après X secondes*) et récurrents (*Toutes les X secondes*).
  - **⌨️ Touches du Clavier (`keyboard`)** : réactivité immédiate en mode Play sur les touches (Flèches, Espace, Entrée, etc.).
  - **🔄 Changement d'État (`state_change`)** : déclenchement automatique dès qu'un objet passe à un nouvel état.
  - **📏 Proximité & Distance (`proximity`)** : déclenchement par rayon de proximité (&lt; 80px) entre deux entités.
  - **🖼️ Bords de Scène (`boundary`)** : détection de collision avec les 4 bords du canvas (Haut, Bas, Gauche, Droite ou tout bord).
  - **📊 Variable & Score (`variable` / `add_score`)** : action d'incrémentation du score (`Ajouter au score (+1)`), affichage du badge HUD `🏆 Score : X` sur la scène en mode Jeu, et déclencheur par seuil de score (ex: *Score >= 5*).

## Étape Logique Suivante
- **Bibliothèque de Préréglages & Modèles de Jeu** : Presets de démarrage pré-configurés (mini-jeux type plateforme, collecteur d'objets, tamagotchi).
- **Contrôles de vitesse de Parallaxe active** : Défilement automatique ou réactif au pointeur des calques avec `parallaxFactor`.

## Dette Technique Potentielle & Risques
- Poursuivre le découpage modulaire de RuleBook et DrawingCanvas en sous-composants dédiés.

