export const TUNER_SCOPE_CLASS_NAME = 'tuner-Scope';

export function isTunerScope(target: EventTarget): boolean {
  return target instanceof Element && target.classList.contains(TUNER_SCOPE_CLASS_NAME);
}
