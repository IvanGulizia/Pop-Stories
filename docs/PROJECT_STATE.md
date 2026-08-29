# État du Projet

## Complété
- Initialisation de la documentation (VISION, ARCHITECTURE, ROADMAP).
- Analyse approfondie du cahier des charges de l'Atelier de dessins vivants.
- **Prototype 0 (MVP)** : Scène interactive fonctionnelle avec une plante (pousse / fleur via Motion) et une pomme manipulable (drag & drop), avec collision et déclenchement de règle.
- **Prototype 1 : Éditeur d'États & Gestionnaire de Dessins** :
  - Sélection d'entités par clic sur le canevas ou dans la liste des dessins.
  - Inspection et personnalisation des propriétés (nom, commutateur draggable/déplaçable).
  - Création, suppression et prévisualisation d'états en direct (Onglets d'états).
  - Réglages visuels en temps réel par état : taille/échelle, rotation, couleur principale, hauteur de tige, pétales de fleur, etc.
  - Ajout dynamique de nouveaux dessins sur la scène (Plante, Pomme, Étoile).

## Étape Logique Suivante
- **Prototype 2 : Moteur de Règles Modulaire & Conditionnel (Triggers + Briques d'Actions)** :
  - **Option A + B combinées** : Cartes lisibles ("QUAND [Déclencheur] ➔ ALORS [Actions]") assemblables par briques modulaires.
  - **Filtres d'États sur les Déclencheurs** : Possibilité de cibler un état précis (ex: Étoile à l'état `[Étincelant]`) OU d'appliquer à `(tous états)` / n'importe quel état.
  - Déclencheurs supportés : Collision / Contact physique & Clic direct sur l'entité (avec condition d'état optionnelle).
  - Actions modulaires combinables : Changer d'état visuel, Basculer la manipulabilité (Draggable), Faire disparaître / Supprimer du canevas.
  - Presets (Méta-blocs) en 1-clic : "Clic Étoile (en état Calme) ➔ Étincelle", "Contact Étoile (Étincelante) + Pomme ➔ Plante Fleur", "Manger la pomme au contact".
  - Activation / Désactivation à la volée de chaque règle.

## Étape Logique Suivante
- **Prototype 3 : Dessin vectoriel libre / Import & Export de scène** :
  - Permettre à l'utilisateur de tracer un nouveau dessin libre sur la scène ou d'ajouter de nouvelles formes.
  - Exporter / Importer la scène complète et le livre de règles au format JSON.

## Dette Technique Potentielle & Risques
- **Composabilités avancées (Boucles / Timers) :** Ajouter un déclencheur temporel récurrent (ex: "Toutes les 3 secondes") pour les animations cycliques autonomes.

