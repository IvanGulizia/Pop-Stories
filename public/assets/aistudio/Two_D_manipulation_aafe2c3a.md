# Two D manipulation

La librairie `Dan.TwoDManipulation` (`Assets/Library/TwoDManipulation`) enchaîne trois couches : une **action** se déclenche, ses **conditions** filtrent l’événement, et les **feedbacks** attachés à une condition vraie s’exécutent.

Chaque action hérite aussi d’un mode d’exécution des conditions (`ConditionExecutionMode`) : toutes les conditions vraies, seulement la première depuis le haut, ou seulement la première depuis le bas.

## **Conditions communes à toutes les actions**

`AbstractActionBehaviour` les expose partout (attribut hérité). Dans l’inspecteur elles sont rangées dans la catégorie **Logic**, sauf la dernière.

| **Nom inspecteur** | **Classe** | **Rôle** |
| --- | --- | --- |
| Everytime | `AlwaysActionCondition` | Toujours vraie. |
| Every x time | `EveryXTimeCondition` | Vraie toutes les N évaluations. Option premier appel, et plafond de déclenchements. |
| Every x seconds | `EveryXSecondeCondition` | Vraie toutes les N secondes (`PeriodTime`). Option premier appel et temps non scalé. |
| Once | `OnceCondition` | Vraie une seule fois, puis consommée. |
| Cooldown | `CooldownCondition` | Bloque pendant `CooldownTime` après un succès. Option au démarrage et temps non scalé. |
| And | `AndCondition` | Toutes les sous-conditions doivent être vraies. |
| Or | `OrCondition` | Au moins une sous-condition vraie. |
| Not | `NotCondition` | Inverse la sous-condition. |
| Variable comparison | `VariableComparisonCondition` | Compare deux variables étendues : Float, String ou Bool. Opérateurs : Equal, NotEqual, More, MoreOrEqual, Less, LessOrEqual. Float : arrondi optionnel. String : sensibilité à la casse. |
| Is actual state | `IfStateCondition` | Vraie si la machine d’états est dans l’état `State` choisi. |

`And`, `Or` et `Not` sont des conditions logiques : elles contiennent d’autres conditions.

## **Actions**

Menu Unity : **2D Manipulation/Actions/…**

### **Entrées et cycle de vie**

| **Menu** | **Classe** | **Déclenchement** | **Conditions en plus** |
| --- | --- | --- | --- |
| On Awake | `OnAwakeActionBehaviour` | `Awake` | — |
| On Start | `OnStartActionBehaviour` | `Start` | — |
| On Update | `OnUpdateActionBehaviour` | `Update`, `LateUpdate` ou `FixedUpdate` | On position change, On Velocity value |
| On script call | `OnScriptCallAction` | Appel code `TriggerAction(sender)` | — |
| On Button | `OnButtonActionBehaviour` | État du bouton : Pressed, Up, Down. Source : nom d’input, axe, ou `KeyCode`. Rythme : Update / LateUpdate / FixedUpdate | On Data Change |
| On Joint break 2D | `OnJointBreak2DAction` | `OnJointBreak2D` | — |

### **Souris et curseur**

| **Menu** | **Classe** | **Déclenchement** | **Conditions en plus** |
| --- | --- | --- | --- |
| Click | `ClickActionBehaviour` | Clic sur un `Collider2D`. Kind : MouseDown ou MouseUp. Limite de distance et/ou de durée | On Layer, On Custom Layer, Speed 2D |
| Double Click | `DoubleClickActionBehaviour` | Deux clics dans `TimeBetweenClick` | On Layer, On Custom Layer, Speed 2D |
| On Mouse click | `OnMouseClickActionBehaviour` | Clic global (pas besoin de collider). Bouton Left / Middle / Right, MouseDown ou MouseUp | — (elle redéclare seulement une partie des conditions logiques) |
| On Mouse Over 2D | `OnMouseOver2DActionBehaviour` | Survol d’un `Collider2D`, à `NbCheckPerSecond` | Handle mouse over or exit |
| On Cursor Move | `OnCursorMoveBehaviour` | Le curseur bouge, par rapport à `TargetReference` | On Data Change |
| Cursor | `CursorActionBehaviour` | Curseur custom : sprite, rayon, masquage du curseur OS | Click, Over, Not Over, On Data Change |

### **Manipulation**

| **Menu** | **Classe** | **Déclenchement** | **Conditions en plus** |
| --- | --- | --- | --- |
| Drag'n'drop | `DragAndDropActionBehaviour` | Glisser-déposer. Modes : `OverrideTransformPosition`, `UsingRigidBody2d`. Inertie au relâchement, colliders désactivés ou passés en trigger | Minimum distance for drag and drop, On release drag'n'drop, On Data Change |
| Drag'n'drop Extended | `DragAndDropActionBehaviourExtended` | Même chose, plus `UsingSpringJoint2d`, `PendulumTransform`, `PendulumPhysics` (fréquence, amortissement, angle max, friction) | Idem |
| Linear Manipulation | `LinearManipulationBehaviour` | Glisser un objet entre `StartPosition` et `EndPosition`. Option pas discrets (`StepQuantity`). Expose le pourcentage du chemin | On Data Change |
| Rotation Manipulation | `RotationManipulationBehaviour` | Tourner à la souris. Kind : Free ou Step (`NumberSteps`, `StepOffset`) | Is between rotation position, On total rotation reached, On Data Change |

### **Physique**

| **Menu** | **Classe** | **Déclenchement** | **Conditions en plus** |
| --- | --- | --- | --- |
| On collision | `OnCollisionActionBehaviour` | `OnCollisionEnter2D` / `OnCollisionExit2D` | On Collision 2D, On Layer, On Custom Layer, On Custom Layer pair |
| On collision notification | `OnCollisionNotificationBehaviour` | Relaye une collision vers un manager | Idem |
| On collision manager | `OnCollisionManagerActionBehaviour` | Reçoit la notification. Kind : Enter, Exit, ou Both. Source et autre objet | Idem |
| On trigger | `OnTriggerActionBehaviour` | `OnTriggerEnter2D` / `OnTriggerExit2D`. Exige un `Collider2D` | On Trigger 2D, On Layer, On Custom Layer, On Custom Layer pair |
| On overlap circle | `OnOverlapCircle` | `Physics2D.OverlapCircle` sur un layer. Centre : transform, position locale ou monde. Rayon et rythme d’update | On Data Change |

## **Conditions spécifiques**

Elles n’apparaissent que sur les actions listées ci-dessus.

| **Nom inspecteur** | **Ce qu’elle teste** | **Paramètres** |
| --- | --- | --- |
| On Layer | Le layer Unity de l’autre objet (ou de l’objet cliqué) est dans le masque | `LayerMask` |
| On Custom Layer | L’autre objet a un `CustomLayerBehaviour` dont le nom est dans la liste | Liste de noms |
| On Custom Layer pair | La source et l’autre objet portent chacun un custom layer de la paire | Deux listes de noms |
| On Collision 2D | Type d’événement Enter ou Exit, puis filtre | Kind, layer mask, masque source, ou liste de GameObjects |
| On Trigger 2D | Type Enter ou Exit, puis filtre | Kind, layer mask, ou liste de GameObjects |
| On Data Change | Les données de l’action ont changé depuis la dernière évaluation | — |
| On position change | Le `Transform` cible a bougé | `TargetTransform` |
| On Velocity value | Vitesse au carré d’un `Rigidbody2D` | Egal, NotEgal, MoreThan, MoreOrEgalThan, LessTham, LessOrEgalThan, et une limite |
| Speed 2D (`Speed2DCondition`, sans nom d’inspecteur) | Vitesse d’un `Rigidbody2D` | Standard, OnlyHorizontal, OnlyVertical, via `FloatComparison` |
| Minimum distance for drag and drop | Distance totale parcourue depuis le clic ≥ seuil | `MinimumDistanceToMove` |
| On release drag'n'drop | L’état du drag est `OnRelease` | — |
| Handle mouse over or exit | L’événement souris correspond | Enter, Over, Exit, Outside |
| Click (curseur) | Clic sur le curseur custom | Kind, bouton, layer, sprite, jusqu’au relâchement |
| Over | Le curseur est au-dessus d’un `CursorOverBehaviour` de ce layer | Layer, sprite de survol |
| Not Over | Le curseur n’est au-dessus de rien | Sprite, seulement si aucun bouton n’est enfoncé |
| Is between rotation position | L’angle actuel est entre min et max | `MinRotation`, `MaxRotation`, `OriginOffset`. Déclenchement : OnRelease ou OnChange |
| On total rotation reached | La rotation cumulée dépasse un angle, dans le même sens | `TotalRotation`. OnRelease ou OnChange |

`FloatComparison` n’est pas une condition autonome. Elle sert à Speed 2D : Equal, NotEqual, Greater, Smaller, GreaterOrEqual, SmallerOrEqual, BetweenInclusive, BetweenExclusive.

**Condition présente dans le code mais non assignée à une action :** `IsBetweenLinearActionCondition` (« Is between linear position »). Elle teste si le pourcentage d’un `LinearData` est entre `MinPercent` et `MaxPercent`, mais `LinearManipulationBehaviour` ne la déclare pas dans son `[AssignCondition]`. Elle n’apparaît donc pas dans le menu de conditions de l’action linéaire.

`CustomLayerBehaviour` est le composant qui donne un nom de layer custom (chaîne libre) à un GameObject.

## **Feedbacks**

Un feedback est un composant glissé sur une condition. Menu : **2D Manipulation/Feedback/…**. `StopActionFeedback` n’a pas d’entrée de menu.

| **Menu** | **Effet** |
| --- | --- |
| Debug message | Log. |
| Unity Event Feedback | Invoque un `UnityEvent`. |
| Feedback Group | Joue une liste d’autres feedbacks. |
| Give data to target | Envoie l’action, la condition et les données aux `IFeedbackDataReceiver`. |
| Stop Action (`StopActionFeedback`) | Arrête une action `IActionStopable` (les deux drag and drop). |
| Destroying GameObject | Détruit un GameObject. |
| Enabling GameObject | Active ou désactive des GameObjects (`ExtendedBool`). |
| Enabling ext.GameObject | Idem, cible via variable étendue. |
| Switch Enabling GameObject | Inverse l’état actif d’une liste. |
| Enabling Behaviour | Active ou désactive des `Behaviour`. |
| Switch Enabling Behaviour | Inverse leur état. |
| Instantiate Prefab | Instancie un prefab. |
| Instantiate Prefab Extended | Prefab, position et parent via variables étendues. |
| Snap Object | Aligne un transform sur un autre si la distance ≤ `MaxSnapDistance`, puis joue d’autres feedbacks. |
| Enable particle system | Active un système de particules. |
| Play Audio Clip | Joue un clip. |
| Set Sprite Color | Couleur d’un `SpriteRenderer`. |
| Set Sprite Material | Matériau d’un `SpriteRenderer`. |
| Material/Set sprite material bool | Bool d’un paramètre de matériau. |
| Set text to Text | Texte UI (`ExtendedString`). |
| Set text to TextMesh | Texte d’un `TextMesh`. |
| Set bool / float / gameobject / animator global variable value | Écrit une variable globale. |
| Animation/Set Bool Animator | Assigne ou bascule un bool. |
| Animation/Set float on animator | Écrit un float (`ExtendedFloat`). |
| Animation/Trigger an animator | Déclenche un trigger. |
| Change state | Change l’état d’une machine d’états. |
| Physics2D/Add force to Rigidbody2D | `AddForce`, avec `ForceMode2D`. |
| Physics2D/Change velocity to rigidbody2D | Vitesse X/Y ou speed, en assignation ou en ajout. |
| Physics2D/Change rigid body constraints | Freeze X, Y, rotation Z. |
| Physics2D/Change rigid body gravity scale | Gravity scale. |
| Physics2D/Enabling Physic Simulation | `Rigidbody2D.simulated`. |
| Transform/Set a position | Position world ou local (`ExtendedVector3`). |
| Transform/Set a rotation | Rotation en degrés. |
| Transform/Set scalling | Scale : SetValue, AddValue, MultiplyByValue. |
| Transform/Copy a transform | Copie position (avec offset), rotation et/ou scale. |
| Transform/Look at (2D) | Oriente un transform vers un autre, avec offset. |
| Copy a position on a spline shape | Package optionnel 2D SpriteShape : copie un point de spline. |

## **Autour des actions**

**Machines d’états.** `StateMachine` porte un id, un état de départ, des `StateDefinition` et des `StateTransitionFeedback`. `StateManager` est le singleton. `ChangeStateFeedback` change l’état ; `IfStateCondition` le teste.

**Calculs** (`Computations`), composants séparés, pas des conditions :

- `FloatComputation` : formule sur des `ExtendedFloat` (addition, soustraction, multiplication, division, modulo).
- `RatioComputation` : valeur / maximum, avec clamp.
- `TransformDistanceComputation` : distance entre deux transforms.

**Variables étendues** (`ExtendedFields`) : Bool, Int, Float, String, Vector2, Vector3, GameObject, Transform, Animator. Chaque champ peut être une valeur directe, un script exposé, une variable globale, ou une propriété système. `GlobalVariableManager` stocke les globales.

**Outils hors du flux action/condition :** parallax (`ParallaxLayer`), attributs `ReadOnly` et `QuickFetcher`, singletons.