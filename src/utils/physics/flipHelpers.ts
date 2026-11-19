import { KeyboardControlBehaviorConfig } from '../../types';

export type HorizontalIntent = -1 | 0 | 1;

export interface OtherFlipBehaviorInput {
  flipOnMove?: boolean;
  flipInvert?: boolean;
  isActivelyPaused?: boolean;
}

export interface ComputeMovementFlipParams {
  keyboard?: Pick<KeyboardControlBehaviorConfig, 'flipOnMove' | 'flipInvert'>;
  keyboardHorizIntent: HorizontalIntent;
  otherFlipBehavior?: OtherFlipBehaviorInput;
  velocityX: number;
  velocityDeadzone?: number;
}

/**
 * Résout l'état horizontal `flipX` à partir de l'intention clavier et des comportements de mouvement.
 *
 * Règle anti-faux-retournement :
 * - Si le contrôleur clavier gère le flip (`keyboard.flipOnMove === true`), la direction de regard
 *   suit immédiatement la touche horizontale pressée (`keyboardHorizIntent`), même si le corps est
 *   bloqué contre un mur ou freine par inertie.
 * - Lorsque le joueur relâche les touches horizontales (`keyboardHorizIntent === 0`), on conserve
 *   strictement le `flipX` actuel afin qu'un micro-rebond physique ou une séparation de collision
 *   au freinage ne retourne jamais le personnage en sens inverse.
 */
export function computeMovementFlipX({
  keyboard,
  keyboardHorizIntent,
  otherFlipBehavior,
  velocityX,
  velocityDeadzone = 0.35,
}: ComputeMovementFlipParams): boolean | null {
  if (keyboard?.flipOnMove) {
    if (keyboardHorizIntent !== 0) {
      const movingLeft = keyboardHorizIntent < 0;
      return keyboard.flipInvert ? !movingLeft : movingLeft;
    }

    // Clavier immobile : n'autoriser le flip par vitesse que si un autre comportement autonome (IA)
    // avec flipOnMove actif est effectivement en train de déplacer l'entité.
    if (
      otherFlipBehavior?.flipOnMove &&
      !otherFlipBehavior.isActivelyPaused &&
      Math.abs(velocityX) > velocityDeadzone
    ) {
      const movingLeft = velocityX < 0;
      return otherFlipBehavior.flipInvert ? !movingLeft : movingLeft;
    }

    return null;
  }

  if (otherFlipBehavior?.flipOnMove) {
    if (otherFlipBehavior.isActivelyPaused) {
      return null;
    }
    if (Math.abs(velocityX) > velocityDeadzone) {
      const movingLeft = velocityX < 0;
      return otherFlipBehavior.flipInvert ? !movingLeft : movingLeft;
    }
  }

  return null;
}
