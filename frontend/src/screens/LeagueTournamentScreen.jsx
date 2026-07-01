import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Crest } from "../components/Crest";
import { playGroupMatch, playKnockout } from "../engine/tournamentEngine";
import {
  drawLeaguePhase,
  generateLeagueFixtures,
  computeLeagueStandings,
  getDirectQualifiers,
  getPlayoffTeams,
  getEliminated,
  buildR16FromLeague,
} from "../engine/leagueEngine";
import { SEASONS } from "../data/seasons";
import { sound } from "../engine/sounds";
import { Play, Trophy, ArrowRight } from "lucide-react";
import { TournamentAwards } from "./TournamentAwards";

// ---------------------------------------------------------------------------
// Team-refs builder — kept LOCAL so that any tweak here doesn't ripple into
// the legacy TournamentScreen. Behavior mirrors the group mode.
// ---------------------------------------------------------------------------
function pickOpponentsFromSemifinalists() {
  const out = [];
  Object.keys(SEASONS).forEach((sk) => {
    const season = Number(sk);
    const teams = SEASONS[season];
    if (!teams || teams.length === 0) return;
    const team = teams[Math.floor(Math.random() * teams.length)];
    const sorted = [...team.players].sort((a, b) => b.overall - a.overall).slice(0, 11);
    const baseOverall = sorted.length
      ? Math.round(sorted.reduce((s, p) => s + p.overall, 0) / sorted.length)
      : 80;
    const players = sorted.map((p) => ({ ...p, _season: season, _slot: p.primary }));
    out.push({ season, club: team.club, country: team.country, crest: team.crest, baseOverall, players });
  });
  return out;
}

function buildTeamRefs(userTeam) {
  const opponents = pickOpponentsFromSemifinalists().map((c, i) => ({
    id: `op-${i}`,
    label: `${c.season} ${c.club}`,
    club: c.club,
    season: c.season,
    crest: c.crest,
    country: c.country,
    baseOverall: c.baseOverall,
    players: c.players,
    isUser: false,
  }));
  const user = {
    id: "user",
    label: userTeam.label || "DRAFT TAKIMI",
    club: userTeam.label || "DRAFT TAKIMI",
    season: "DRAFT",
    crest: "YOU",
    country: "🌍",
    baseOverall: userTeam.stats.overall,
    isUser: true,
  };
  // Cap the opponents at 31 so the total is exactly 32 (user + 31).
  return [user, ...opponents.slice(0, 31)];
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------
export const LeagueTournamentScreen = ({
  userStats,
  userTacticId,
  userTeamName,
  userXi,
  onMatch,
  onTrophy,           // kept for API parity with the group screen
  savedState,
  onSaveState,
}) => {
  const [state, setState] = useState(savedState || null);
  const [tournamentStats, setTournamentStats] = useState(
    () => savedState?.tournamentStats || {}
  );

  // Persist per-player tournament stats into the saved state whenever they change.
  useEffect(() => {
    if (!state) return;
    if (!tournamentStats || Object.keys(tournamentStats).length === 0) return;
    onSaveState && onSaveState({ ...state, tournamentStats });
  }, [tournamentStats]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Stats helpers (identical to group mode) -----------------------------
  const aggregateMatchStats = (matchResult) => {
    if (!matchResult || !matchResult.userPlayerStats) return;
    setTournamentStats((prev) => {
      const next = { ...prev };
      const mom = [...matchResult.userPlayerStats].sort((a, b) => b.rating - a.rating)[0];
      matchResult.userPlayerStats.forEach((p) => {
        const base = prev[p.name] || {
          name: p.name, slot: p.slot, season: p.season,
          goals: 0, assists: 0, matches: 0, totalRating: 0, mom: 0,
        };
        const legsInc = p.legs && p.legs > 0 ? p.legs : 1;
        next[p.name] = {
          ...base,
          goals: base.goals + (p.goals || 0),
          assists: base.assists + (p.assists || 0),
          matches: base.matches + legsInc,
          totalRating: base.totalRating + (p.rating || 6.5) * legsInc,
          mom: base.mom + (mom && mom.name === p.name ? 1 : 0),
        };
      });
      return next;
    });
  };

  const tieToMergedPlayerStats = (tie) => {
    if (!tie) return null;
    const sources = [];
    if (tie.legs) sources.push(...tie.legs);
    if (tie.match) sources.push(tie.match);
    const merged = {};
    sources.forEach((leg) => {
      (leg.userPlayerStats || []).forEach((p) => {
        if (!merged[p.name]) {
          merged[p.name] = {
            name: p.name, slot: p.slot, season: p.season,
            teamName: p.teamName || "",
            goals: 0, assists: 0, rating: 0, legs: 0,
          };
        }
        merged[p.name].goals += p.goals || 0;
        merged[p.name].assists += p.assists || 0;
        merged[p.name].rating += p.rating || 6.5;
        merged[p.name].legs += 1;
      });
    });
    return Object.values(merged).map((p) => ({
      ...p,
      rating: p.legs > 0 ? p.rating / p.legs : 6.5,
    }));
  };

  // --- Init on mount ------------------------------------------------------
  useEffect(() => {
    if (state) return;
    const teamRefs = buildTeamRefs({ label: userTeamName || "DRAFT TAKIMI", stats: userStats });
    const draw = drawLeaguePhase(teamRefs);
    const fixtures = generateLeagueFixtures(draw);
    const fresh = {
      mode: "league",
      stage: "league",
      teams: teamRefs,
      fixtures,
      matchdayIndex: 0,
      results: fixtures.map(() => []),
      standings: null,
      playoff: null,       // 8 pairs after league phase
      playoffWinners: null,// team refs in original-seed order (index 0 = winner of 9v24)
      r16: null, qf: null, sf: null, final: null,
      champion: null, eliminatedAt: null,
    };
    setState(fresh);
    onSaveState && onSaveState(fresh);
  }, [state, userStats, onSaveState]); // eslint-disable-line react-hooks/exhaustive-deps

  const isUserTeam = (t) => t && t.isUser;

  // Live league standings (used both during league phase and post_league display).
  const liveStandings = useMemo(() => {
    if (!state) return [];
    const flat = state.results.reduce((acc, arr) => acc.concat(arr), []);
    return computeLeagueStandings(state.teams, flat);
  }, [state]);

  if (!state) {
    return <div className="p-10 text-center text-white/60 font-display tracking-widest">TURNUVA HAZIRLANIYOR…</div>;
  }

  // --- League matchday --------------------------------------------------
  const playMatchday = () => {
    sound.swoosh();
    const md = state.matchdayIndex;
    const dayFixtures = state.fixtures[md] || [];
    const dayResults = [];
    let userMatch = null;
    dayFixtures.forEach(({ home, away }) => {
      const m = playGroupMatch(home, away, userStats, userTacticId, isUserTeam, userXi);
      dayResults.push(m);
      if (isUserTeam(home) || isUserTeam(away)) userMatch = { ...m, matchday: md };
    });
    if (userMatch?.result?.userPlayerStats) {
      aggregateMatchStats(userMatch.result);
    }
    const newResults = state.results.map((arr, i) => (i === md ? dayResults : arr));
    const nextMd = md + 1;
    const next = { ...state, results: newResults, matchdayIndex: nextMd };
    if (nextMd >= 8) {
      // League phase complete
      const flat = newResults.reduce((acc, arr) => acc.concat(arr), []);
      const standings = computeLeagueStandings(state.teams, flat);
      next.standings = standings;
      next.stage = "post_league";
    }
    setState(next);
    onSaveState && onSaveState(next);
    if (userMatch) onMatch(userMatch);
  };

  // Advance from post_league → playoff (build the 8 playoff ties)
  const startPlayoff = () => {
    sound.swoosh();
    const playoffPairs = getPlayoffTeams(state.standings).map((p) => ({
      home: p.home, away: p.away,   // leg 1 home = lower seed
      higherSeedId: p.higherSeed.team.id,
      played: false,
    }));
    const next = { ...state, stage: "playoff", playoff: playoffPairs };
    setState(next);
    onSaveState && onSaveState(next);
  };

  // Play the 2-legged playoff (all 8 ties at once), extract user's tie.
  const playPlayoff = () => {
    sound.swoosh();
    const played = state.playoff.map((pair) => ({
      ...pair,
      ...playKnockout(pair.home, pair.away, userStats, userTacticId, isUserTeam, true, 1, userXi),
      played: true,
    }));

    // For each pair, the winner is the team ref that "won" the tie.
    const winnerRefById = {};
    played.forEach((pair) => {
      const winnerRef = pair.tie.winner === "home" ? pair.home : pair.away;
      winnerRefById[pair.higherSeedId] = winnerRef;
      // We also key by both seat ids just in case downstream uses either.
    });

    // Rebuild the 8 R16 slots: seeds 1-8 are direct qualifiers, seeds 9-16 are
    // playoff winners in the SAME ORDER as getPlayoffTeams produced (which is
    // seeded 9v24, 10v23, ... 16v17). So playoffWinners[0] = winner of the
    // 9v24 tie and takes the R16 seed-9 slot.
    const playoffWinnersBySeed = played.map((pair) => (pair.tie.winner === "home" ? pair.home : pair.away));

    // Was the user in the playoff? If yes, extract & aggregate.
    const userTie = played.find((m) => isUserTeam(m.home) || isUserTeam(m.away));
    if (userTie) {
      const merged = tieToMergedPlayerStats(userTie.tie);
      if (merged && merged.length > 0) aggregateMatchStats({ userPlayerStats: merged });
      const userWon = (isUserTeam(userTie.home) && userTie.tie.winner === "home") ||
                      (isUserTeam(userTie.away) && userTie.tie.winner === "away");
      onMatch({ stage: "Play-off", knockout: userTie, userWon });
      if (!userWon) {
        const next = { ...state, playoff: played, playoffWinners: playoffWinnersBySeed,
          stage: "eliminated", eliminatedAt: "Play-off" };
        setState(next); onSaveState && onSaveState(next);
        return;
      }
    }

    // Build R16 from direct qualifiers + playoff winners.
    const qualifiers = getDirectQualifiers(state.standings);
    const r16Pairs = buildR16FromLeague(qualifiers, playoffWinnersBySeed)
      .map((p) => ({ ...p, played: false }));

    const next = { ...state, playoff: played, playoffWinners: playoffWinnersBySeed,
      r16: r16Pairs, stage: "post_playoff" };
    setState(next);
    onSaveState && onSaveState(next);
  };

  // --- Knockout stages (identical logic to legacy TournamentScreen) --------
  const autoCompleteBracket = (baseState) => {
    let s = { ...baseState };
    if (s.r16 && s.r16.some((p) => !p.played)) {
      s.r16 = s.r16.map((p) =>
        p.played ? p : ({ ...p, ...playKnockout(p.home, p.away, userStats, userTacticId, isUserTeam, true, 1, userXi), played: true })
      );
    }
    if (!s.qf || s.qf.length === 0) {
      s.qf = [];
      for (let i = 0; i < 8; i += 2) {
        const w1 = s.r16[i].tie.winner === "home" ? s.r16[i].home : s.r16[i].away;
        const w2 = s.r16[i + 1].tie.winner === "home" ? s.r16[i + 1].home : s.r16[i + 1].away;
        s.qf.push({ home: w1, away: w2, played: false });
      }
    }
    if (s.qf.some((p) => !p.played)) {
      s.qf = s.qf.map((p) =>
        p.played ? p : ({ ...p, ...playKnockout(p.home, p.away, userStats, userTacticId, isUserTeam, true, 2, userXi), played: true })
      );
    }
    if (!s.sf || s.sf.length === 0) {
      s.sf = [];
      for (let i = 0; i < 4; i += 2) {
        const w1 = s.qf[i].tie.winner === "home" ? s.qf[i].home : s.qf[i].away;
        const w2 = s.qf[i + 1].tie.winner === "home" ? s.qf[i + 1].home : s.qf[i + 1].away;
        s.sf.push({ home: w1, away: w2, played: false });
      }
    }
    if (s.sf.some((p) => !p.played)) {
      s.sf = s.sf.map((p) =>
        p.played ? p : ({ ...p, ...playKnockout(p.home, p.away, userStats, userTacticId, isUserTeam, true, 3, userXi), played: true })
      );
    }
    if (!s.final || s.final.length === 0) {
      const w1 = s.sf[0].tie.winner === "home" ? s.sf[0].home : s.sf[0].away;
      const w2 = s.sf[1].tie.winner === "home" ? s.sf[1].home : s.sf[1].away;
      s.final = [{ home: w1, away: w2, played: false }];
    }
    if (s.final.some((p) => !p.played)) {
      s.final = s.final.map((p) =>
        p.played ? p : ({ ...p, ...playKnockout(p.home, p.away, userStats, userTacticId, isUserTeam, false, 4, userXi), played: true })
      );
    }
    s.champion = s.final[0].tie.winner === "home" ? s.final[0].home : s.final[0].away;
    s.stage = "eliminated_done";
    return s;
  };

  const playR16 = () => {
    sound.swoosh();
    const r16 = state.r16.map((pair) => ({ ...pair, ...playKnockout(pair.home, pair.away, userStats, userTacticId, isUserTeam, true, 1, userXi), played: true }));
    const qf = [];
    for (let i = 0; i < 8; i += 2) {
      const w1 = r16[i].tie.winner === "home" ? r16[i].home : r16[i].away;
      const w2 = r16[i+1].tie.winner === "home" ? r16[i+1].home : r16[i+1].away;
      qf.push({ home: w1, away: w2, played: false });
    }
    const userTie = r16.find((m) => isUserTeam(m.home) || isUserTeam(m.away));
    if (userTie) {
      const merged = tieToMergedPlayerStats(userTie.tie);
      if (merged && merged.length > 0) aggregateMatchStats({ userPlayerStats: merged });
      const userWon = (isUserTeam(userTie.home) && userTie.tie.winner === "home") || (isUserTeam(userTie.away) && userTie.tie.winner === "away");
      onMatch({ stage: "Son 16", knockout: userTie, userWon });
      if (!userWon) {
        const next = { ...state, r16, qf, stage: "eliminated", eliminatedAt: "Son 16" };
        setState(next); onSaveState && onSaveState(next);
        return;
      }
    }
    const next = { ...state, r16, qf, stage: "qf" };
    setState(next); onSaveState && onSaveState(next);
  };

  const playQF = () => {
    sound.swoosh();
    const qf = state.qf.map((pair) => ({ ...pair, ...playKnockout(pair.home, pair.away, userStats, userTacticId, isUserTeam, true, 2, userXi), played: true }));
    const sf = [];
    for (let i = 0; i < 4; i += 2) {
      const w1 = qf[i].tie.winner === "home" ? qf[i].home : qf[i].away;
      const w2 = qf[i+1].tie.winner === "home" ? qf[i+1].home : qf[i+1].away;
      sf.push({ home: w1, away: w2, played: false });
    }
    const userTie = qf.find((m) => isUserTeam(m.home) || isUserTeam(m.away));
    if (userTie) {
      const merged = tieToMergedPlayerStats(userTie.tie);
      if (merged && merged.length > 0) aggregateMatchStats({ userPlayerStats: merged });
      const userWon = (isUserTeam(userTie.home) && userTie.tie.winner === "home") || (isUserTeam(userTie.away) && userTie.tie.winner === "away");
      onMatch({ stage: "Çeyrek Final", knockout: userTie, userWon });
      if (!userWon) {
        const next = { ...state, qf, sf, stage: "eliminated", eliminatedAt: "Çeyrek Final" };
        setState(next); onSaveState && onSaveState(next);
        return;
      }
    }
    const next = { ...state, qf, sf, stage: "sf" };
    setState(next); onSaveState && onSaveState(next);
  };

  const playSF = () => {
    sound.swoosh();
    const sf = state.sf.map((pair) => ({ ...pair, ...playKnockout(pair.home, pair.away, userStats, userTacticId, isUserTeam, true, 3, userXi), played: true }));
    const w1 = sf[0].tie.winner === "home" ? sf[0].home : sf[0].away;
    const w2 = sf[1].tie.winner === "home" ? sf[1].home : sf[1].away;
    const final = [{ home: w1, away: w2, played: false }];
    const userTie = sf.find((m) => isUserTeam(m.home) || isUserTeam(m.away));
    if (userTie) {
      const merged = tieToMergedPlayerStats(userTie.tie);
      if (merged && merged.length > 0) aggregateMatchStats({ userPlayerStats: merged });
      const userWon = (isUserTeam(userTie.home) && userTie.tie.winner === "home") || (isUserTeam(userTie.away) && userTie.tie.winner === "away");
      onMatch({ stage: "Yarı Final", knockout: userTie, userWon });
      if (!userWon) {
        const next = { ...state, sf, final, stage: "eliminated", eliminatedAt: "Yarı Final" };
        setState(next); onSaveState && onSaveState(next);
        return;
      }
    }
    const next = { ...state, sf, final, stage: "final" };
    setState(next); onSaveState && onSaveState(next);
  };

  const playFinal = () => {
    sound.swoosh();
    const fin = state.final.map((pair) => ({ ...pair, ...playKnockout(pair.home, pair.away, userStats, userTacticId, isUserTeam, false, 4, userXi), played: true }));
    const winnerRef = fin[0].tie.winner === "home" ? fin[0].home : fin[0].away;
    const userTie = fin[0];
    const merged = tieToMergedPlayerStats(userTie.tie);
    if (merged && merged.length > 0) aggregateMatchStats({ userPlayerStats: merged });
    const userWon = (isUserTeam(userTie.home) && userTie.tie.winner === "home") || (isUserTeam(userTie.away) && userTie.tie.winner === "away");
    onMatch({ stage: "Final", knockout: userTie, userWon, championRef: winnerRef });
    const next = { ...state, final: fin, stage: "done", champion: winnerRef };
    setState(next); onSaveState && onSaveState(next);
  };

  // --- Render -------------------------------------------------------------
  return (
    <div className="px-5 md:px-10 py-6 max-w-[1700px] mx-auto">
      <div className="flex items-end justify-between flex-wrap gap-4 mb-6">
        <div>
          <div className="font-mono text-xs text-amber-300 tracking-widest">ADIM 4 / 4 · TURNUVA (LİG BAZLI)</div>
          <h2 className="font-display text-4xl md:text-5xl tracking-tight">ŞAMPİYONLAR LİGİ {currentStageLabel(state)}</h2>
        </div>
        <StageActions
          state={state}
          onPlayMd={playMatchday}
          onStartPlayoff={startPlayoff}
          onPlayPlayoff={playPlayoff}
          onAdvanceToR16={() => {
            const next = { ...state, stage: "r16" };
            setState(next); onSaveState && onSaveState(next);
          }}
          onPlayR16={playR16} onPlayQF={playQF} onPlaySF={playSF} onPlayFinal={playFinal}
        />
      </div>

      {/* League phase — full 32-team live table */}
      {state.stage === "league" && (
        <div>
          <div className="text-xs text-white/60 font-mono tracking-widest mb-3">
            HAFTA {Math.min(state.matchdayIndex + 1, 8)} / 8
          </div>
          <LeagueTable table={liveStandings} showBands={false} />
        </div>
      )}

      {/* Post-league standings with qualification bands */}
      {state.stage === "post_league" && (
        <div className="space-y-6">
          <div className="glass rounded-2xl p-5 text-center">
            <div className="font-mono text-xs text-amber-300 tracking-widest">LİG FAZI TAMAMLANDI</div>
            <div className="font-display text-2xl md:text-3xl tracking-tight mt-1">
              32 takımlık nihai lig sıralaması aşağıda.
            </div>
            <div className="mt-3 text-white/70 text-sm max-w-2xl mx-auto">
              1-8 arası doğrudan Son 16&apos;ya · 9-24 arası Play-off&apos;a · 25-32 arası elendi.
            </div>
            <button type="button" className="btn-primary mt-4 inline-flex items-center gap-2"
              onClick={startPlayoff} data-testid="advance-to-playoff-button">
              PLAY-OFF&apos;A İLERLE <ArrowRight size={16} />
            </button>
          </div>
          <LeagueTable table={state.standings} showBands />
        </div>
      )}

      {/* Playoff bracket display */}
      {state.stage === "playoff" && (
        <div className="space-y-6">
          <div className="glass rounded-2xl p-4 text-center">
            <div className="font-mono text-xs text-amber-300 tracking-widest">PLAY-OFF · 2 AYAKLI</div>
            <div className="text-white/70 text-sm mt-1">Seeds 9-16 daha üst seed olarak evinde ikinci maçı oynuyor.</div>
          </div>
          <PlayoffBracket pairs={state.playoff} />
        </div>
      )}

      {/* Post-playoff — show playoff results before R16 button */}
      {state.stage === "post_playoff" && (
        <div className="space-y-6">
          <div className="glass rounded-2xl p-5 text-center">
            <div className="font-mono text-xs text-amber-300 tracking-widest">PLAY-OFF TAMAMLANDI</div>
            <div className="font-display text-2xl tracking-tight mt-1">Son 16&apos;ya yükselen 16 takım belli oldu.</div>
            <button type="button" className="btn-primary mt-4 inline-flex items-center gap-2"
              onClick={() => {
                const next = { ...state, stage: "r16" };
                setState(next); onSaveState && onSaveState(next);
              }}
              data-testid="advance-to-r16-button"
            >
              SON 16&apos;YA İLERLE <ArrowRight size={16} />
            </button>
          </div>
          <PlayoffBracket pairs={state.playoff} />
        </div>
      )}

      {/* Eliminated banner (shared for playoff/R16/QF/SF eliminations) */}
      {state.stage === "eliminated" && (
        <motion.div
          initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }}
          className="glass rounded-2xl p-8 md:p-10 text-center max-w-2xl mx-auto"
          data-testid="eliminated-screen"
        >
          <div className="text-6xl md:text-7xl mb-3" aria-hidden>💀</div>
          <div className="font-mono text-xs tracking-[0.3em] text-red-400">ELENDİN</div>
          <div className="font-display text-3xl md:text-5xl tracking-tight mt-2">{state.eliminatedAt}&apos;NDE VEDA</div>
          <p className="text-white/60 mt-3 text-sm max-w-md mx-auto">
            Senin yolculuğun burada bitti. Turnuvanın geri kalanını otomatik simüle ederek kupanın kime gittiğini gör.
          </p>
          <button type="button"
            onClick={() => {
              sound.swoosh();
              // If eliminated at play-off, we don't yet have an R16 bracket
              // built from playoff winners → build it now before auto-play.
              let base = { ...state };
              if (!base.r16 || base.r16.length === 0) {
                const qualifiers = getDirectQualifiers(base.standings);
                base.r16 = buildR16FromLeague(qualifiers, base.playoffWinners || [])
                  .map((p) => ({ ...p, played: false }));
              }
              const finished = autoCompleteBracket(base);
              setState(finished); onSaveState && onSaveState(finished);
            }}
            data-testid="finish-simulation-button"
            className="btn-primary mt-6 inline-flex items-center gap-2 text-base"
          >
            <Play size={16} /> SİMÜLASYONU BİTİR
          </button>
        </motion.div>
      )}

      {/* Knockout stages */}
      {(state.stage === "r16" || state.stage === "qf" || state.stage === "sf" || state.stage === "final" || state.stage === "done" || state.stage === "eliminated_done") && (
        <div className="space-y-8">
          <Bracket title="SON 16" pairs={state.r16} />
          {state.qf && <Bracket title="ÇEYREK FİNAL" pairs={state.qf} />}
          {state.sf && <Bracket title="YARI FİNAL" pairs={state.sf} />}
          {state.final && <Bracket title="FİNAL" pairs={state.final} final />}

          {state.stage === "done" && state.champion && (
            <>
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="glass rounded-2xl p-8 text-center">
                <Trophy size={48} className="text-amber-300 mx-auto mb-3" />
                <div className="font-mono text-xs tracking-widest text-amber-300">KUPA SAHİBİ</div>
                <div className="font-display text-4xl tracking-tight mt-2">{state.champion.label}</div>
              </motion.div>
              <TournamentAwards
                tournamentStats={tournamentStats}
                userXi={userXi}
                userTeamName={userTeamName}
                isChampion={state.champion?.isUser}
              />
            </>
          )}
          {state.stage === "eliminated_done" && state.champion && (
            <>
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="glass rounded-2xl p-6 text-center">
                <div className="font-mono text-xs tracking-widest text-red-400">{state.eliminatedAt || "ELENDİN"}</div>
                <div className="font-display text-2xl mt-1 text-white/70">Senin için final geçti — ama turnuva devam etti.</div>
                <div className="mt-4 pt-4 border-t border-white/10">
                  <Trophy size={40} className="text-amber-300 mx-auto mb-2" />
                  <div className="font-mono text-xs tracking-widest text-amber-300">ŞAMPİYON</div>
                  <div className="font-display text-3xl tracking-tight mt-1">{state.champion.label}</div>
                </div>
                {state.final && state.final[0]?.tie && (
                  <div className="mt-5 flex justify-center">
                    <button type="button" className="btn-primary" data-testid="watch-final-button"
                      onClick={() => onMatch({ stage: "Final", knockout: state.final[0], userWon: false, spectator: true })}>
                      <Play size={14} className="inline mr-1" /> FİNALİ İZLE
                    </button>
                  </div>
                )}
              </motion.div>
              <TournamentAwards
                tournamentStats={tournamentStats}
                userXi={userXi}
                userTeamName={userTeamName}
                isChampion={false}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
function currentStageLabel(state) {
  switch (state.stage) {
    case "league": return "LİG FAZI";
    case "post_league": return "LİG SONU";
    case "playoff": return "PLAY-OFF";
    case "post_playoff": return "PLAY-OFF SONU";
    case "r16": return "SON 16";
    case "qf": return "ÇEYREK FİNAL";
    case "sf": return "YARI FİNAL";
    case "final": return "FİNAL";
    case "done": return "TAMAMLANDI";
    case "eliminated": return "ELENDİN";
    case "eliminated_done": return "ELENDİN · TURNUVA TAMAMLANDI";
    default: return "";
  }
}

const StageActions = ({ state, onPlayMd, onStartPlayoff, onPlayPlayoff, onAdvanceToR16, onPlayR16, onPlayQF, onPlaySF, onPlayFinal }) => {
  if (state.stage === "league") return (
    <button type="button" className="btn-primary flex items-center gap-2" onClick={onPlayMd} data-testid="play-matchday-button">
      <Play size={18}/> HAFTA {Math.min(state.matchdayIndex + 1, 8)} OYNA
    </button>
  );
  if (state.stage === "post_league") return null;
  if (state.stage === "playoff") return (
    <button type="button" className="btn-primary flex items-center gap-2" onClick={onPlayPlayoff} data-testid="play-playoff-button">
      <Play size={18}/> PLAY-OFF OYNA
    </button>
  );
  if (state.stage === "post_playoff") return null;
  if (state.stage === "r16") return <button type="button" className="btn-primary flex items-center gap-2" onClick={onPlayR16} data-testid="play-r16-button"><Play size={18}/> SON 16 OYNA</button>;
  if (state.stage === "qf") return <button type="button" className="btn-primary flex items-center gap-2" onClick={onPlayQF} data-testid="play-qf-button"><Play size={18}/> ÇEYREK FİNAL</button>;
  if (state.stage === "sf") return <button type="button" className="btn-primary flex items-center gap-2" onClick={onPlaySF} data-testid="play-sf-button"><Play size={18}/> YARI FİNAL</button>;
  if (state.stage === "final") return <button type="button" className="btn-primary flex items-center gap-2" onClick={onPlayFinal} data-testid="play-final-button"><Play size={18}/> FİNAL</button>;
  return null;
};

// 32-team league table. When `showBands` is true, rows are visually banded
// by qualification zone: 1-8 green (Son 16), 9-24 amber (Play-off),
// 25-32 red (Elendi).
const LeagueTable = ({ table, showBands }) => (
  <div className="glass rounded-2xl p-4 overflow-x-auto" data-testid="league-table">
    <table className="w-full text-sm">
      <thead className="text-white/45 font-mono text-[11px]">
        <tr>
          <th className="text-left py-2 pl-2 w-10">#</th>
          <th className="text-left">TAKIM</th>
          <th className="text-center">O</th>
          <th className="text-center">G</th>
          <th className="text-center">B</th>
          <th className="text-center">M</th>
          <th className="text-center">AG</th>
          <th className="text-center">YG</th>
          <th className="text-center">AV</th>
          <th className="text-center pr-2">P</th>
        </tr>
      </thead>
      <tbody>
        {table.map((row, i) => {
          const rank = i + 1;
          let bandClass = "";
          let borderLeft = "";
          if (showBands) {
            if (rank <= 8) { bandClass = "bg-emerald-500/5"; borderLeft = "border-l-2 border-emerald-400/70"; }
            else if (rank <= 24) { bandClass = "bg-amber-500/5"; borderLeft = "border-l-2 border-amber-400/70"; }
            else { bandClass = "bg-red-500/5"; borderLeft = "border-l-2 border-red-400/70"; }
          }
          const isUser = row.team.isUser;
          return (
            <React.Fragment key={i}>
              {showBands && rank === 1 && <BandHeader label="DOĞRUDAN SON 16" color="emerald" />}
              {showBands && rank === 9 && <BandHeader label="PLAY-OFF" color="amber" />}
              {showBands && rank === 25 && <BandHeader label="ELENDİ" color="red" />}
              <tr
                className={`${bandClass} ${borderLeft} ${isUser ? "text-amber-300 font-semibold" : "text-white/85"} ${isUser ? "bg-amber-300/10" : ""}`}
                data-testid={isUser ? "user-league-row" : undefined}
              >
                <td className="py-1.5 pl-2 font-mono text-white/50">{rank}</td>
                <td>
                  <div className="flex items-center gap-2">
                    <Crest code={row.team.crest} size="sm" />
                    <div className="flex flex-col leading-tight min-w-0">
                      <span className="truncate max-w-[180px] text-[13px]">{row.team.club}</span>
                      {!isUser && (
                        <span className="text-[10px] font-mono text-white/45 tracking-wider">{row.team.season}</span>
                      )}
                    </div>
                  </div>
                </td>
                <td className="text-center">{row.P}</td>
                <td className="text-center">{row.W}</td>
                <td className="text-center">{row.D}</td>
                <td className="text-center">{row.L}</td>
                <td className="text-center">{row.GF}</td>
                <td className="text-center">{row.GA}</td>
                <td className="text-center">{row.GD}</td>
                <td className="text-center pr-2 font-bold">{row.Pts}</td>
              </tr>
            </React.Fragment>
          );
        })}
      </tbody>
    </table>
  </div>
);

const BandHeader = ({ label, color }) => {
  const colors = {
    emerald: "text-emerald-300 border-emerald-400/40",
    amber: "text-amber-300 border-amber-400/40",
    red: "text-red-300 border-red-400/40",
  }[color];
  return (
    <tr>
      <td colSpan={10} className={`pt-3 pb-1 font-mono text-[10px] tracking-widest ${colors}`}>
        ─── {label} ───
      </td>
    </tr>
  );
};

// Playoff bracket = 8 vertical 2-legged ties. Reuses the KnockoutCard layout.
const PlayoffBracket = ({ pairs }) => (
  <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
    {pairs.map((p, i) => <KnockoutCard key={i} pair={p} />)}
  </div>
);

const Bracket = ({ title, pairs, final = false }) => (
  <div>
    <div className="font-display text-xl tracking-widest text-amber-300 mb-3">{title}</div>
    <div className={`grid gap-3 ${final ? "" : "md:grid-cols-2 lg:grid-cols-4"}`}>
      {pairs.map((p, i) => <KnockoutCard key={i} pair={p} />)}
    </div>
  </div>
);

const KnockoutCard = ({ pair }) => {
  const winner = pair.tie?.winner;
  const aggA = pair.tie?.aggregate?.a ?? pair.tie?.match?.home?.score;
  const aggB = pair.tie?.aggregate?.b ?? pair.tie?.match?.away?.score;
  const homeWin = winner === "home";
  const awayWin = winner === "away";
  const isUserPair = pair.home?.isUser || pair.away?.isUser;
  return (
    <div
      className={`glass rounded-xl p-4 text-sm transition-all ${
        isUserPair ? "ring-2 ring-amber-300/70 shadow-[0_0_20px_rgba(252,211,77,0.25)]" : ""
      }`}
      data-testid={isUserPair ? "user-knockout-card" : undefined}
    >
      <Row team={pair.home} score={aggA} isWin={homeWin} pen={pair.tie?.penalties?.a} />
      <div className="h-px my-2 bg-white/10" />
      <Row team={pair.away} score={aggB} isWin={awayWin} pen={pair.tie?.penalties?.b} />
      {pair.tie?.decidedBy === "penalties" && (
        <div className="mt-2 text-[11px] font-mono text-amber-300 tracking-widest">UZATMA + PENALTI</div>
      )}
      {pair.tie?.decidedBy === "extra_time" && (
        <div className="mt-2 text-[11px] font-mono text-amber-300 tracking-widest">UZATMA</div>
      )}
    </div>
  );
};

const Row = ({ team, score, isWin, pen }) => (
  <div className={`flex items-center gap-2.5 ${team.isUser ? "text-amber-300 font-semibold" : isWin ? "text-amber-300" : "text-white/80"}`}>
    <Crest code={team.crest} size="sm" />
    <div className="flex flex-col leading-tight flex-1 min-w-0">
      <span className="truncate text-sm">{team.club || team.label}</span>
      {!team.isUser && team.season && (
        <span className="text-[10px] font-mono text-white/45 tracking-wider">SEZON · {team.season}</span>
      )}
      {team.isUser && (
        <span className="text-[9px] font-mono text-amber-200/70 tracking-wider">SENİN TAKIMIN</span>
      )}
    </div>
    <span className="font-display text-lg">{score ?? "—"}</span>
    {pen !== undefined && <span className="text-[10px] text-white/60">({pen})</span>}
  </div>
);
