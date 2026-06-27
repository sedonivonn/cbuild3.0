import React, { useEffect, useMemo, useState } from "react";
import { HomeScreen } from "./screens/HomeScreen";
import { FormationScreen } from "./screens/FormationScreen";
import { DraftScreen } from "./screens/DraftScreen";
import { ConfirmScreen } from "./screens/ConfirmScreen";
import { TacticsScreen } from "./screens/TacticsScreen";
import { TournamentScreen } from "./screens/TournamentScreen";
import { MatchScreen } from "./screens/MatchScreen";
import { TrophyScreen } from "./screens/TrophyScreen";
import { TopBar } from "./components/TopBar";
import { sound } from "./engine/sounds";
import { FORMATIONS } from "./data/formations";
import { computeTeamStats } from "./engine/overallEngine";

const SAVE_KEY = "ucl_draft_save_v1";

function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (_) { return null; }
}

function saveState(state) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch (_) {}
}

function App() {
  const initial = loadSave();
  const [screen, setScreen] = useState(initial?.screen || "home");
  const [teamName, setTeamName] = useState(initial?.teamName || "");
  const [formationId, setFormationId] = useState(initial?.formationId || null);
  const [xi, setXi] = useState(initial?.xi || []);
  const [changes, setChanges] = useState(initial?.changes || { remaining: 3, luckyRemaining: 1 });
  const [tactic, setTactic] = useState(initial?.tactic || null);
  const [tournament, setTournament] = useState(initial?.tournament || null);
  const [activeMatch, setActiveMatch] = useState(null);
  const [trophyTeam, setTrophyTeam] = useState(null);
  const [soundOn, setSoundOn] = useState(sound.isEnabled());

  // Persist
  useEffect(() => {
    saveState({ screen, teamName, formationId, xi, changes, tactic, tournament });
  }, [screen, teamName, formationId, xi, changes, tactic, tournament]);

  const teamStats = useMemo(() => {
    if (!formationId || xi.length === 0) return null;
    const formation = FORMATIONS[formationId];
    const mapped = formation.slots.map((slot, idx) => ({ slot, player: xi[idx] }));
    if (mapped.some((m) => !m.player)) return null;
    return computeTeamStats(mapped);
  }, [formationId, xi]);

  const handleStart = () => {
    sound.click();
    setTeamName("");
    setFormationId(null);
    setXi([]);
    setChanges({ remaining: 3, luckyRemaining: 1 });
    setTactic(null);
    setTournament(null);
    setScreen("formation");
  };

  const handleContinue = () => { setScreen(initial?.screen || "home"); };

  const handleFormationContinue = () => {
    if (!formationId) return;
    const formation = FORMATIONS[formationId];
    setXi(new Array(formation.slots.length).fill(null));
    setScreen("draft");
    sound.click();
  };

  const handleDraftComplete = (newXi) => {
    setXi(newXi);
    setScreen("confirm");
    sound.click();
  };

  const handleConfirmBack = () => {
    setScreen("draft");
    sound.click();
  };

  const handleConfirmContinue = () => {
    setScreen("tactics");
    sound.click();
  };

  const handleTacticsContinue = () => {
    if (!tactic) return;
    setScreen("tournament");
    sound.click();
  };

  const handleUseChange = (wasLucky) => {
    setChanges((c) => ({
      remaining: c.remaining - 1,
      luckyRemaining: wasLucky ? Math.max(0, c.luckyRemaining - 1) : c.luckyRemaining,
    }));
  };

  const handleReset = () => {
    if (!window.confirm("Tüm ilerlemeyi sıfırlayıp baştan başlamak istediğinden emin misin?")) return;
    try { localStorage.removeItem(SAVE_KEY); } catch (_) {}
    setTeamName(""); setFormationId(null); setXi([]); setChanges({ remaining: 3, luckyRemaining: 1 });
    setTactic(null); setTournament(null); setActiveMatch(null); setTrophyTeam(null);
    setScreen("home");
  };

  const handleSoundToggle = () => {
    const v = sound.toggle();
    setSoundOn(v);
  };

  const userTournamentStats = useMemo(() => {
    if (!teamStats) return null;
    return {
      overall: teamStats.overall,
      keeper: teamStats.keeper,
      defense: teamStats.defense,
      midfield: teamStats.midfield,
      attack: teamStats.attack,
    };
  }, [teamStats]);

  const hasSave = !!(initial && initial.screen && initial.screen !== "home" && initial.formationId);
  const displayedTeamName = teamName?.trim() || "DRAFT TAKIMI";

  return (
    <div className="min-h-screen text-white">
      <TopBar onSoundToggle={handleSoundToggle} soundOn={soundOn} onReset={handleReset} />
      {screen === "home" && <HomeScreen onStart={handleStart} hasSave={hasSave} onContinue={handleContinue} />}
      {screen === "formation" && (
        <FormationScreen selected={formationId} onSelect={setFormationId} onContinue={handleFormationContinue} teamName={teamName} setTeamName={setTeamName} />
      )}
      {screen === "draft" && formationId && (
        <DraftScreen
          formationId={formationId}
          xi={xi}
          setXi={setXi}
          changes={changes}
          onUseChange={handleUseChange}
          onComplete={handleDraftComplete}
        />
      )}
      {screen === "confirm" && formationId && (
        <ConfirmScreen formationId={formationId} xi={xi} teamStats={teamStats} teamName={displayedTeamName} onBack={handleConfirmBack} onContinue={handleConfirmContinue} />
      )}
      {screen === "tactics" && formationId && (
        <TacticsScreen formationId={formationId} xi={xi} teamStats={teamStats} tactic={tactic} setTactic={setTactic} onContinue={handleTacticsContinue} />
      )}
      {screen === "tournament" && userTournamentStats && tactic && (
        <TournamentScreen
          userStats={userTournamentStats}
          userTacticId={tactic}
          userTeamName={displayedTeamName}
          savedState={tournament}
          onSaveState={setTournament}
          onMatch={setActiveMatch}
          onTrophy={(team) => setTrophyTeam(team)}
        />
      )}

      {activeMatch && <MatchScreen match={activeMatch} onClose={() => {
        const m = activeMatch;
        setActiveMatch(null);
        if (m && m.stage === "Final" && m.userWon && m.championRef) {
          sound.trophy();
          setTrophyTeam(m.championRef);
        }
      }} />}}
      {trophyTeam && <TrophyScreen teamLabel={trophyTeam.label} onRestart={() => { setTrophyTeam(null); handleReset(); }} />}
    </div>
  );
}

export default App;
