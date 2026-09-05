export function carryWildCardAnswer({ answer, previousQuestion, nextQuestion, nextOptions }: {
  answer: string; previousQuestion: string; nextQuestion: string; nextOptions: string[];
}) {
  const normalize = (question: string) => question.trim().replace(/\s+/g, " ");
  const unchangedQuestion = Boolean(normalize(previousQuestion)) && normalize(previousQuestion) === normalize(nextQuestion);
  return unchangedQuestion && nextOptions.includes(answer) ? answer : "";
}
