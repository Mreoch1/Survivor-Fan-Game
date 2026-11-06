export const MERGE_WELCOME_ID = "s51-final-torch-welcome";

export type MergeWelcomeData = {
  originalName: string | null;
  originalIsActive: boolean;
  individualGamePoints: number;
  repickClosesAt: string;
};

export function getMergeWelcomeCopy({ originalName, originalIsActive, individualGamePoints }: Omit<MergeWelcomeData, "repickClosesAt">) {
  let openingResult = `Your Opening Outlast score is ${individualGamePoints} points.`;
  if (originalName && individualGamePoints === 10) {
    const outcome = originalIsActive ? "reached the individual game" : "reached the individual game before leaving";
    openingResult = `${originalName} ${outcome}. You earned 10 Opening Outlast points and keep them whichever Final Torch Pick you choose.`;
  } else if (originalName && !originalIsActive && individualGamePoints === 0) {
    openingResult = `${originalName} left before the individual game, so your Opening Outlast Pick earned 0 points.`;
  }

  const finalTorchAdvice = originalName && originalIsActive
    ? `Keep ${originalName} for 10 more points if they win or 3 if they finish second or third. If you switch, your new pick can earn 5 points for winning or 1.5 for second or third.`
    : "Choose a remaining castaway for your Final Torch Pick. You can earn 5 points if they win or 1.5 if they finish second or third.";

  return { openingResult, finalTorchAdvice };
}
