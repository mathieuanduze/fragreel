import Nav from "@/components/Nav";
import { getMatch } from "@/lib/api";
import MatchClient from "./MatchClient";

export default async function MatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let match;
  try {
    match = await getMatch(id);
  } catch {
    match = null;
  }

  if (!match) {
    return (
      <div style={{ minHeight: "100vh", background: "#0D0D1A", color: "#E8E8F0", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Nav />
        <div style={{ textAlign: "center", color: "rgba(255,255,255,0.3)" }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>😕</div>
          <div>Partida não encontrada ou API offline.</div>
        </div>
      </div>
    );
  }

  return (
    <>
      <Nav />
      <MatchClient match={match} />
    </>
  );
}
