# Roadmap & Prototypes

Ce projet suivra un développement par prototypes verticaux pour valider l'expérience utilisateur avant de construire les systèmes complexes.

## Prototype 0 : Preuve de Concept (MVP Actuel)
**Objectif :** Valider que "donner vie à un dessin" est amusant avec la boucle la plus courte possible.
- [x] Dessiner un objet simple (ex: Plante) avec 2 états (Pousse, Fleur).
- [x] Dessiner un deuxième objet (ex: Pomme).
- [x] Rendre la Pomme manipulable (Draggable).
- [x] Implémenter une règle en dur : "Quand Pomme touche Plante -> Plante passe à l'état Fleur".
- [x] Interpolation visuelle (couleur/taille) gérée par `motion`.

## Prototype 1 : L'Éditeur d'États
- [ ] Interface basique pour basculer entre les états d'une entité.
- [ ] Modifier l'apparence d'un état sans affecter les autres.
- [ ] Animation automatique entre les états.

## Prototype 2 : Le Rule Book Visuel
- [ ] Interface simple `Quand [Événement] -> Alors [Action]`.
- [ ] Déclencheurs : Click, Toucher un autre objet.
- [ ] Actions : Changer d'état.

## Prototype 3 : Comportements & Composition
- [ ] Ajout de briques de comportement (ex: "Tomber", "Rebondir").
- [ ] Intégration d'un moteur de collision simple (AABB).

## Prototype 4 : Outil de Dessin Intégré
- [ ] Remplacer les SVG importés/codés en dur par un mini-canvas de dessin vectoriel.
