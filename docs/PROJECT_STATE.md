# État du Projet

## Complété
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
- **Décors & Arrière-plans Multi-Calques Dessinables (Background & Foreground)** :
  - **Groupes de calques pliables dans l'onglet Scène** : Groupe *Arrière-plan (Background)*, *Premier-plan (Foreground)* et possibilité de créer de nouveaux groupes de calques personnalisés.
  - **Gestion complète de calques** : Ajout de calques, nommage, masquage/affichage (`Eye` / `EyeOff`), suppression et opacité.
  - **Dessin vectoriel direct sur calque** : Clic sur le bouton *« Dessiner »* d'un calque pour ouvrir l'atelier vectoriel complet et dessiner le décor de fond ou de premier plan.
  - **Rendu étagé dans la scène** : Les calques d'arrière-plan sont rendus en dessous de tous les objets de jeu (`z-index: 1`), tandis que les calques de premier-plan sont projetés au-dessus (`z-index: 40`).
  - **Persistance intégrée** : Sauvegarde et restauration des groupes de calques et tracés vectoriels dans les slots de projets et fichiers JSON d'export/import.
  - **Suppression du badge de format** : Retrait du badge textuel *"Format 16:9"* superposé sur le canvas pour un rendu visuel net.

## Étape Logique Suivante
- **Bibliothèque de Préréglages & Modèles de Jeu** : Presets de démarrage pré-configurés (mini-jeux type plateforme, collecteur d'objets, tamagotchi).
- **Contrôles de vitesse de Parallaxe active** : Défilement automatique ou réactif au pointeur des calques avec `parallaxFactor`.

## Dette Technique Potentielle & Risques
- Poursuivre le découpage modulaire de RuleBook et DrawingCanvas en sous-composants dédiés.

