"use client";

import { useState } from "react";
import Game3D from "@/components/Game3D";
import LobbyScreen from "@/components/LobbyScreen";
import FeedbackWidget from "@/components/FeedbackWidget";

export default function Home() {
  const [playerName, setPlayerName] = useState<string | null>(null);

  if (!playerName) {
    return <LobbyScreen onJoin={setPlayerName} />;
  }

  return (
    <>
      <Game3D playerName={playerName} />
      <FeedbackWidget />
    </>
  );
}
