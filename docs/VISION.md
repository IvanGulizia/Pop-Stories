# Vision — Atelier de dessins vivants

## Le Concept
Une application web de création interactive où le dessin est le point de départ. L'objectif est de donner vie à des dessins 2D en leur ajoutant des états, des comportements et des réactions aux autres objets.

## Philosophie
> "Chaque fonctionnalité doit permettre de donner davantage de vie à un dessin."

- **Dessin d'abord :** La programmation visuelle est un moyen, pas une fin.
- **Manipulation directe :** Le résultat doit être visible immédiatement (ex: Figma, Spline).
- **Composition :** Les entités sont des assemblages de capacités (ex: Dessin + Draggable + Mangeur).
- **Jouabilité :** La création doit ressembler à un jeu (ex: Sok Stories, Dreams).
- **Progressivité :** Ne révéler la complexité (variables, conditions complexes) que si l'utilisateur en a besoin.

## Le Modèle Mental (L'Entité)
Tout est une `Entité`.
Une Entité est composée de :
1. **Visuel** (Tracés SVG)
2. **États** (Ex: Graine, Fleur) - Situations exclusives avec leurs propres visuels.
3. **Propriétés / Traits** (Ex: Enflammé) - Caractéristiques cumulables.
4. **Comportements / Capacités** (Ex: Draggable, Peut tomber) - Briques logiques pré-construites.
5. **Rule Book (Règles)** - Scénario / Storyboard programmable (Quand X -> Alors Y).
