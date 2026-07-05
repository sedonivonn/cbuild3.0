import React, { useEffect, useMemo, useState } from "react";
import { HomeScreen } from "./screens/HomeScreen";
import { FormationScreen } from "./screens/FormationScreen";
import { DraftScreen } from "./screens/DraftScreen";
import { ConfirmScreen } from "./screens/ConfirmScreen";
import { TacticsScreen } from "./screens/TacticsScreen";
import { TournamentScreen } from "./screens/TournamentScreen";
import { LeagueTournamentScreen } from "./screens/LeagueTournamentScreen";
import { MatchScreen } from "./screens/MatchScreen";
import { TrophyScreen } from "./screens/TrophyScreen";
import { HallOfFameScreen } from "./screens/HallOfFameScreen";
import { OnlineScreen } from "./screens/OnlineScreen";
import { OnlineLobbyScreen } from "./screens/OnlineLobbyScreen";
import { OnlineDraftScreen } from "./screens/OnlineDraftScreen";
import { TopBar } from "./components/TopBar";
import { sound } from "./engine/sounds";
import { FORMATIONS } from "./data/formations";
import { computeTeamStats } from "./engine/overallEngine";
import { readDraftFromUrl, clearDraftFromUrl } from "./engine/shareCode";
import { saveTrophy } from "./engine/hallOfFame";
import { AuthProvider } from "./hooks/useAuth";
import { AuthScreen } from "./screens/AuthScreen";

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
  // "group" = legacy 8x4 group phase, "league" = 32-team Swiss-model league phase.
  // Existing saves without this field default to "group" for backward compat.
  const [tournamentMode, setTournamentMode] = useState(initial?.tournamentMode || "group");
  const [activeMatch, setActiveMatch] = useState(null);
  const [trophyTeam, setTrophyTeam] = useState(null);
  const [soundOn, setSoundOn] = useState(sound.isEnabled());
  const [authOpen, setAuthOpen] = useState(false);

  // Online multiplayer state (kept out of the persisted save on purpose —
  // sessions are ephemeral and depend on server-side room lifecycle).
  const [onlineMe, setOnlineMe] = useState(null);       // { id, nickname, is_host }
  const [onlineCode, setOnlineCode] = useState(null);
  const [onlinePrefill, setOnlinePrefill] = useState(null);

  // Detect `?room=CODE` on initial load and route to the Online KATIL tab.
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const roomFromUrl = params.get("room");
      if (roomFromUrl) {
        setOnlinePrefill(roomFromUrl.toUpperCase());
        setScreen("online");
      }
    } catch (_) { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Read shared draft from URL hash on first mount
  useEffect(() => {
    const shared = readDraftFromUrl();
    if (shared && shared.formationId && shared.xi && shared.xi.length > 0) {
      const ok = window.confirm("Paylaşılan bir kadro buldum. Yüklemek ister misin?");
      if (ok) {
        setTeamName(shared.teamName || "");
        setFormationId(shared.formationId);
        setXi(shared.xi);
        setChanges({ remaining: 0, luckyRemaining: 0 });
        setTactic(null);
        setTournament(null);
        setScreen("draft");
      }
      clearDraftFromUrl();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist
  useEffect(() => {
    saveState({ screen, teamName, formationId, xi, changes, tactic, tournament, tournamentMode });
  }, [screen, teamName, formationId, xi, changes, tactic, tournament, tournamentMode]);

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
    setFormationId("4-3-3");
    setXi(new Array(FORMATIONS["4-3-3"].slots.length).fill(null));
    setChanges({ remaining: 3, luckyRemaining: 1 });
    setTactic(null);
    setTournament(null);
    setTournamentMode("group");
    setScreen("draft");
  };

  // League mode: identical draft flow, only the post-draft tournament changes.
  const handleStartLeague = () => {
    sound.click();
    setTeamName("");
    setFormationId("4-3-3");
    setXi(new Array(FORMATIONS["4-3-3"].slots.length).fill(null));
    setChanges({ remaining: 3, luckyRemaining: 1 });
    setTactic(null);
    setTournament(null);
    setTournamentMode("league");
    setScreen("draft");
  };

  const handleContinue = () => { setScreen(initial?.screen || "home"); };

  const handleDraftComplete = (newXi) => {
    setXi(newXi);
    setScreen("tournament");
    sound.click();
  };

  const handleUseChange = (wasLucky) => {
    setChanges((c) => ({
      remaining: c.remaining - 1,
      luckyRemaining: wasLucky ? Math.max(0, c.luckyRemaining - 1) : c.luckyRemaining,
    }));
  };

  const resetState = () => {
    try { localStorage.removeItem(SAVE_KEY); } catch (_) {}
    setTeamName(""); setFormationId(null); setXi([]); setChanges({ remaining: 3, luckyRemaining: 1 });
    setTactic(null); setTournament(null); setActiveMatch(null); setTrophyTeam(null);
    setTournamentMode("group");
  };

  const handleReset = () => {
    resetState();
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
      <TopBar onSoundToggle={handleSoundToggle} soundOn={soundOn} onReset={handleReset} onLogoClick={() => setScreen("home")} onOpenAuth={() => setAuthOpen(true)} />
      {screen === "home" && <HomeScreen onStart={handleStart} onStartLeague={handleStartLeague} hasSave={hasSave} onContinue={handleContinue} onHallOfFame={() => setScreen("hall_of_fame")} onOnline={() => { setOnlinePrefill(null); setScreen("online"); }} />}
      {screen === "online" && !onlineCode && (
        <OnlineScreen
          prefillCode={onlinePrefill}
          onBack={() => { setOnlinePrefill(null); setScreen("home"); try { const u = new URL(window.location.href); u.searchParams.delete("room"); window.history.replaceState({}, "", u); } catch (_) { /* noop */ } }}
          onEnterLobby={({ code, you }) => { setOnlineMe(you); setOnlineCode(code); setScreen("online_lobby"); }}
        />
      )}
      {screen === "online_lobby" && onlineCode && onlineMe && (
        <OnlineLobbyScreen
          code={onlineCode}
          me={onlineMe}
          onLeave={() => { setOnlineCode(null); setOnlineMe(null); setOnlinePrefill(null); setScreen("home"); try { const u = new URL(window.location.href); u.searchParams.delete("room"); window.history.replaceState({}, "", u); } catch (_) { /* noop */ } }}
          onStarted={() => {
            // Server has flipped the room to `started`. Every client (host
            // and guests) now transitions to the online draft view. The
            // draft screen re-reads state via WebSocket, so it's safe to
            // enter here without any additional payload.
            sound.click();
            setScreen("online_draft");
          }}
        />
      )}
      {screen === "online_draft" && onlineCode && onlineMe && (
        <OnlineDraftScreen
          code={onlineCode}
          me={onlineMe}
          onLeave={() => { setOnlineCode(null); setOnlineMe(null); setOnlinePrefill(null); setScreen("home"); try { const u = new URL(window.location.href); u.searchParams.delete("room"); window.history.replaceState({}, "", u); } catch (_) { /* noop */ } }}
          onTournamentStart={(r) => {
            // Phase 1: server-authoritative tournament sim is not yet
            // implemented. When the host clicks TURNUVAYA BAŞLA we drop
            // each client into their local tournament using their
            // server-drafted squad. Phase 2 will replace this with a
            // synchronized server sim.
            const mine = r?.game?.drafts?.[onlineMe.id];
            if (!mine) return;
            const formationSlots = FORMATIONS[mine.formation_id]?.slots || FORMATIONS["4-3-3"].slots;
            setFormationId(mine.formation_id || "4-3-3");
            setXi(mine.xi && mine.xi.length === formationSlots.length ? mine.xi : (new Array(formationSlots.length).fill(null)));
            setTactic(mine.tactic_id || "GEGENPRESS");
            setTeamName(mine.team_name || onlineMe.nickname);
            setChanges({ remaining: 0, luckyRemaining: 0 });
            setTournament(null);
            setTournamentMode(r?.mode === "league" ? "league" : "group");
            setOnlineCode(null); setOnlineMe(null); setOnlinePrefill(null);
            setScreen("tournament");
          }}
        />
      )}
      {screen === "draft" && formationId && (
        <DraftScreen
          formationId={formationId}
          setFormationId={setFormationId}
          teamName={teamName}
          setTeamName={setTeamName}
          xi={xi}
          setXi={setXi}
          tactic={tactic}
          setTactic={setTactic}
          changes={changes}
          onUseChange={handleUseChange}
          onComplete={handleDraftComplete}
        />
      )}
      {/* Legacy routes — kept reachable from shared URLs / saves only */}
      {screen === "formation" && (
        <FormationScreen selected={formationId} onSelect={setFormationId} onContinue={() => { setXi(new Array(FORMATIONS[formationId].slots.length).fill(null)); setScreen("draft"); }} teamName={teamName} setTeamName={setTeamName} />
      )}
      {screen === "confirm" && formationId && (
        <ConfirmScreen formationId={formationId} xi={xi} teamStats={teamStats} teamName={displayedTeamName} onBack={() => setScreen("draft")} onContinue={() => setScreen("draft")} />
      )}
      {screen === "tactics" && formationId && (
        <TacticsScreen formationId={formationId} xi={xi} teamStats={teamStats} tactic={tactic} setTactic={setTactic} onContinue={() => setScreen("tournament")} />
      )}
      {screen === "tournament" && userTournamentStats && tactic && tournamentMode === "group" && (
        <TournamentScreen
          userStats={userTournamentStats}
          userTacticId={tactic}
          userTeamName={displayedTeamName}
          userXi={xi}
          savedState={tournament}
          onSaveState={setTournament}
          onMatch={setActiveMatch}
          onTrophy={(team) => setTrophyTeam(team)}
        />
      )}
      {screen === "tournament" && userTournamentStats && tactic && tournamentMode === "league" && (
        <LeagueTournamentScreen
          userStats={userTournamentStats}
          userTacticId={tactic}
          userTeamName={displayedTeamName}
          userXi={xi}
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
          // Persist this win to the Hall of Fame cabinet.
          try {
            saveTrophy({
              teamName: displayedTeamName,
              formationId,
              tactic,
              totalOvr: teamStats?.overall,
              xi,
              tournamentStats: tournament?.tournamentStats || null,
              tournamentMode,
            });
          } catch (_) { /* localStorage may be unavailable */ }
          setTrophyTeam(m.championRef);
        }
      }} />}
      {trophyTeam && <TrophyScreen
        teamLabel={trophyTeam.label}
        teamName={displayedTeamName}
        userXi={xi}
        tournamentStats={tournament?.tournamentStats || {}}
        onRestart={() => { setTrophyTeam(null); resetState(); setScreen("home"); }}
        onHallOfFame={() => { setTrophyTeam(null); resetState(); setScreen("hall_of_fame"); }}
        onDismiss={() => setTrophyTeam(null)}
      />}
      {screen === "hall_of_fame" && <HallOfFameScreen onBack={() => setScreen("home")} />}
      {authOpen && <AuthScreen onClose={() => setAuthOpen(false)} />}
    </div>
  );
}

export default function AppWithProviders() {
  return (
    <AuthProvider>
      <App />
    </AuthProvider>
  );
}
