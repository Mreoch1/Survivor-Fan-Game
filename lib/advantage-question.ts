export const DEFAULT_ADVANTAGE_QUESTION = "Will a valid immunity idol be played at Tribal Council this episode (even if it blocks no votes)? Finds and Shot in the Dark do not count.";
export const DEFAULT_ADVANTAGE_OPTIONS = ["Yes", "No"];

export const ADVANTAGE_QUESTION_CHECKLIST = [
  "State the episode or time window and the exact event that counts. Ask one objective question with one verifiable answer.",
  "Name every eligible idol or advantage. If the question concerns advantages, explicitly include or exclude Shot in the Dark; do not leave 'an advantage' undefined.",
  "Finding, receiving, revealing, attempting, playing, and succeeding are different events. A find does not count as a play. An attempt does not count as success unless the question explicitly asks about attempts.",
  "Define success when it matters: for example, blocking at least one vote. For a play question, state whether a valid play that has no effect still counts.",
  "Give two to four short, mutually exclusive choices that cover the possible outcomes. Put all scoring conditions in the displayed question, not only in private research notes.",
  "Keep the complete question within 140 characters. Simplify its scope if the conditions will not fit. Preserve questions and choices already scheduled; apply this checklist to new future episodes.",
] as const;
