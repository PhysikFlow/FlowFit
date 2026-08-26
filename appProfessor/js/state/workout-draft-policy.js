export const WORKOUT_DRAFT_CONTEXT = Object.freeze({
  PRIMARY: "primary",
  ISOLATED: "isolated"
});

export const canMutatePrimaryWorkoutDraft = (context) => context === WORKOUT_DRAFT_CONTEXT.PRIMARY;
