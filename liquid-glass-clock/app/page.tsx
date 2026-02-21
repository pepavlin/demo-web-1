import LiquidBackground from "@/components/LiquidBackground";
import Clock from "@/components/Clock";
import FeedbackWidget from "@/components/FeedbackWidget";
import ElementSuggestionMenu from "@/components/ElementSuggestionMenu";
import Sheep from "@/components/Sheep";
import SheepWalker from "@/components/SheepWalker";

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden">
      <LiquidBackground />
      <div className="relative z-10">
        <Clock />
      </div>
      <FeedbackWidget />
      <ElementSuggestionMenu />
      <Sheep />
      <SheepWalker />
    </main>
  );
}
