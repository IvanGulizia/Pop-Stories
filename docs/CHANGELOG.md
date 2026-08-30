# Journal des Modifications (CHANGELOG)

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
