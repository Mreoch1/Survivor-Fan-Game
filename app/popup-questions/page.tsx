import type { Metadata } from "next";
import { requireChatGPTUser } from "../chatgpt-auth";
import { AppShell } from "../components/AppShell";
import { PopupQuestions } from "../components/PopupQuestions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Bonus questions" };

export default async function PopupQuestionsPage() {
  await requireChatGPTUser("/popup-questions");
  return <AppShell showBonusPrompt={false}><main className="wrap interior-page popup-questions-page">
    <header className="page-hero"><p className="eyebrow">An extra chance for points</p><h1>Bonus questions</h1><p>One final answer per question, remembered across your devices. A correct answer earns 3 points; a wrong answer or skip earns 0.</p></header>
    <PopupQuestions mode="page"/>
  </main></AppShell>;
}
