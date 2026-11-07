# Plan d'Architecture & d'Implémentation : Mise à Jour Majeure

Ce document détaille la conception, l'architecture technique et le découpage par phases de la mise à jour majeure de l'application selon vos choix et priorités.

---

## 1. Objectifs & Exigences Clés

1. **Stabilité & Scène (Priorité Immédiate)**
   - Correction des conflits de sélection et de drag en mode Édition (séparation nette entre manipulation d'édition et colliders de jeu).
   - Nouvel onglet **"Scène"** dans le panneau latéral (à côté de "Entités") : liste hiérarchique des instances posées, ordre de superposition Z-Index (Premier plan / Arrière-plan), sélection rapide, masquage, verrouillage et suppression.
   - Snapshot & Reset de la scène : sauvegarde d'un instantané fidèle avant le lancement du mode Play et restauration exacte au retour en mode Édition (positions, états, variables, instances créées/détruites).
   - Suppression en cascade : supprimer une entité depuis la bibliothèque supprime automatiquement toutes ses instances sur la scène et nettoie les règles associées.
   - Taille par défaut des entités sur le canvas ajustée à **256px**.

2. **Atelier de Dessin & Précision iPad**
   - Correction du tracé tactile sur iPad / Apple Pencil (suppression de l'effet "perlé/haché" grâce à la capture des événements `pointermove` avec coalesced events et interpolation de Bézier fluide).
   - Sélection multiple de traits : outil lasso / rectangle de sélection pour déplacer, dupliquer, redimensionner ou supprimer un groupe de traits.
   - Système de calques (Layers) dans l'atelier de dessin : réorganisation, opacité, verrouillage et fusion.
   - Outil Pot de peinture vectoriel : détection de fermeture de contour avec remplissage SVG d'aplat net (`fill` SVG) sans artefact.
   - Layout iPad pleine page : verrouillage `100dvh`, suppression de tout défilement vertical parasite de la fenêtre.

3. **Rulebook Repensé & Organisation Visuelle**
   - Architecture 2 colonnes sémantiques :
     - **Colonne Gauche :** Sujet (Qui déclenche l'événement et actions qui s'appliquent à lui).
     - **Colonne Droite :** Cible (Entité rencontrée et actions qui s'appliquent à elle).
   - Miniatures visuelles dans les cartes d'actions : affichage d'un aperçu graphique miniature (thumbnail de l'état actif) + nom de l'entité concernée pour un repérage immédiat.
   - Organisation des règles : **Dossiers thématiques repliables** (ex: "Mouvements", "Ennemis", "Victoire / Défaite") avec recherche textuelle instantanée et filtres par entité.

4. **Système Audio Étendu**
   - Importation directe de fichiers audio (MP3, WAV, OGG) encodés localement.
   - Enregistreur vocal / micro intégré dans le navigateur (décompte, enregistrement, pré-écoute, découpe et nommage personnalisé).
   - Intégration transparente dans les menus d'actions `Jouer un son`.

5. **Format de Scène, Arrière-Plans & Mode Plein Écran**
   - Sélecteur de format de scène : Presets standards (16:9 Paysage, 4:3 Rétro, 1:1 Carré, 9:16 Mobile / TikTok) et format personnalisé avec letterboxing élégant.
   - Arrière-plans multi-calques dessinables : calques de fond statiques avec métadonnées prêtes pour le parallax (vitesse de défilement configurable).
   - Mode Play Kiosk / Arcade plein écran : bascule instantanée vers un affichage 100% épuré sans aucune interface d'édition (bouton d'échappement discret).

6. **Persistance & Galerie**
   - Étape 1 : Gestionnaire de sauvegardes locales par "Slots" dans le navigateur (LocalStorage / IndexedDB) avec sauvegarde rapide, renommage, duplication et export/import JSON.
   - Étape 2 (Feuille de route Firebase) : Mise en place de la galerie en ligne partagée sur le Spark plan gratuit de Firebase (stockage JSON des projets + prévisualisations sans frais).

---

## 2. Architecture Technique & Modifications de Modules

### A. Store & État Global (`useSceneStore.ts` & `types/index.ts`)
- **Modèle de Scène & Snapshot :**
  ```typescript
  interface SceneSnapshot {
    entities: Entity[];
    sceneSettings: SceneFormatSettings;
    backgroundLayers: BackgroundLayer[];
  }
  ```
- **Nouvel onglet Scène :** ajout de `activeLibraryTab: 'entities' | 'scene'`.
- **Règles & Dossiers :**
  ```typescript
  interface RuleFolder {
    id: string;
    name: string;
    color?: string;
    isCollapsed: boolean;
  }
  // extension de DynamicRule avec folderId?: string;
  ```
- **Sons personnalisés :**
  ```typescript
  interface CustomSound {
    id: string;
    name: string;
    dataUrl: string; // base64 audio
    duration: number;
    source: 'upload' | 'microphone';
  }
  ```
- **Calques de dessin (`VectorLayer`) :**
  ```typescript
  interface VectorLayer {
    id: string;
    name: string;
    visible: boolean;
    locked: boolean;
    opacity: number;
  }
  // VectorPath étendu avec layerId: string; et fill?: string;
  ```

### B. Interface Utilisateur & Composants
- `src/components/EntitiesPanel.tsx` : Intégration des deux sous-onglets **Entités** (bibliothèque de prototypes) et **Scène** (liste des instances sur la scène avec ordre z-index par glisser-déposer / boutons monter-descendre).
- `src/components/RulebookPanel.tsx` : Refonte en deux colonnes explicites (Sujet à gauche / Cible à droite), badges miniatures d'entités avec rendu SVG compact, création et gestion de dossiers de règles avec barre de recherche en en-tête.
- `src/components/DrawingCanvas.tsx` & `FullScreenDrawingModal.tsx` :
  - Pipeline de dessin tactile amélioré pour iPad (`pointerEvents` avec `getCoalescedEvents()`).
  - Outil de sélection multiple (box select).
  - Outil pot de peinture fermant le polygone et appliquant `fill`.
  - Panneau de gestion des calques de dessin.
- `src/components/PlayModeKiosk.tsx` : Nouveau composant de vue de jeu plein écran sans chrome ni barre d'outils.
- `src/components/ProjectSlotsModal.tsx` : Gestionnaire visuel de sauvegardes locales.
- `src/components/SoundRecorderModal.tsx` : Enregistreur micro et importateur audio.

---

## 3. Découpage des Phases d'Implémentation

```
Phase 1 : Socle Scène & Ergonomie
  ├── Résolution du drag en mode Édition & Z-Index
  ├── Nouvel onglet "Scène" dans le panneau latéral
  ├── Snapshot & Réinitialisation fidèle Edit <-> Play
  ├── Suppression en cascade des entités et instances
  └── Taille par défaut des entités à 256px

Phase 2 : Optimisations iPad & Outils de Dessin
  ├── Correction du tracé haché / tactile iPad
  ├── Verrouillage de page 100dvh (anti-scroll)
  ├── Pot de peinture & remplissage de formes SVG
  ├── Outil sélection multiple de traits
  └── Système de calques de dessin (Layers)

Phase 3 : Rulebook Restructuré & Son
  ├── Organisation en 2 colonnes (Sujet gauche / Cible droite)
  ├── Miniatures visuelles des entités dans les cartes d'actions
  ├── Dossiers thématiques repliables & recherche de règles
  └── Enregistreur micro & import de sons personnalisés

Phase 4 : Format de Scène, Arrière-Plans & Mode Kiosk
  ├── Presets de format de scène (16:9, 4:3, 1:1, 9:16, Libre)
  ├── Toile de fond multi-calques (Background layers)
  └── Mode Play plein écran immersif sans interface

Phase 5 : Persistance Locale & Préparation Galerie
  ├── Gestionnaire de projets par slots locaux (navigateur)
  └── Architecture prête pour le connecteur Galerie Firebase
```

---

## 4. Vérification & Tests de Non-Régression
- Test de persistance et de rappel des scènes lors de la transition Play/Edit.
- Test de manipulation tactile sur écran tactile / iPad (tracés continus, zoom et absence de défilement de page).
- Vérification que les règles existantes conservent leur intégrité et s'affichent correctement dans la nouvelle disposition 2 colonnes et dans les dossiers.
- Validation des builds TypeScript (`npm run lint` & `compile_applet`).
