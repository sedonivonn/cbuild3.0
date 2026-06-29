import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Crest } from "../components/Crest";
import { computeStandings, buildR16, playGroupMatch, playKnockout } from "../engine/tournamentEngine";
import { drawGroups, generateGroupFixtures } from "../engine/draftEngine";
import { SEASONS } from "../data/seasons";
import { sound } from "../engine/sounds";
import { Play, Trophy } from "lucide-react";

// Pick 1 random semi-finalist per season and compute its baseOverall from top-11 players.
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
    out.push({ season, club: team.club, country: team.country, crest: team.crest, baseOverall });
  });
  return out;
}

// Create team refs (32 entries: user + 31 random semi-finalists, one per season)
function buildTeamRefs(userTeam) {
  const opponents = pickOpponentsFromSemifinalists().map((c, i) => ({
    id: `op-${i}`,
    label: `${c.season} ${c.club}`,
    club: c.club,
    season: c.season,
    crest: c.crest,
    country: c.country,
    baseOverall: c.baseOverall,
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
  return [user, ...opponents];
}

export const TournamentScreen = ({ userStats, userTacticId, userTeamName, onMatch, onTrophy, savedState, onSaveState }) => {
  const [state, setState] = useState(savedState || null);

  // Init on mount if no saved state
  useEffect(() => {
    if (state) return;
    const teamRefs = buildTeamRefs({ label: userTeamName || "DRAFT TAKIMI", stats: userStats });
    const groups = drawGroups(teamRefs);
    const fixtures = generateGroupFixtures(groups);
    const fresh = {
      stage: "group",
      groups,
      fixtures,
      matchdayIndex: 0,
      results: groups.map(() => []),
      standings: null,
      r16: null,
      qf: null,
      sf: null,
      final: null,
      champion: null,
      eliminatedAt: null,
    };
    setState(fresh);
    onSaveState && onSaveState(fresh);
  }, [state, userStats, onSaveState]);

  const isUserTeam = (t) => t && t.isUser;

  // Group standings helper (live) - must be before early return per hooks rules
  const liveStandings = useMemo(() => {
    if (!state) return [];
    return state.groups.map((g, gi) => computeStandings(g, state.results[gi] || []));
  }, [state]);

  if (!state) {
    return <div className="p-10 text-center text-white/60 font-display tracking-widest">TURNUVA HAZIRLANIYOR…</div>;
  }

  const playMatchday = () => {
    sound.swoosh();
    const md = state.matchdayIndex;
    const newResults = state.results.map((arr) => [...arr]);
    let userMatch = null;
    state.fixtures.forEach((groupFixtures, gi) => {
      const matches = groupFixtures[md];
      matches.forEach(({ home, away }) => {
        const m = playGroupMatch(home, away, userStats, userTacticId, isUserTeam);
        newResults[gi].push(m);
        if (isUserTeam(home) || isUserTeam(away)) userMatch = { ...m, group: gi };
      });
    });
    const nextMd = md + 1;
    const next = { ...state, results: newResults, matchdayIndex: nextMd };
    if (nextMd >= 6) {
      const standings = next.groups.map((g, gi) => computeStandings(g, newResults[gi]));
      next.standings = standings;
      // Show post-group summary first, then transition to R16 on user action
      next.stage = "post_group";
      const r16 = buildR16(standings);
      next.r16 = r16.map((pair) => ({ ...pair, played: false }));
    }
    setState(next);
    onSaveState && onSaveState(next);
    if (userMatch) onMatch(userMatch);
  };

  // Auto-complete the rest of the bracket when user is eliminated, so they can
  // still watch how the tournament finishes (who knocks out who, who wins).
  const autoCompleteBracket = (baseState) => {
    let s = { ...baseState };
    // Play any unplayed R16 ties (stageBonus 1)
    if (s.r16 && s.r16.some((p) => !p.played)) {
      s.r16 = s.r16.map((p) =>
        p.played ? p : ({ ...p, ...playKnockout(p.home, p.away, userStats, userTacticId, isUserTeam, true, 1), played: true })
      );
    }
    // Build QF bracket from R16 winners if missing
    if (!s.qf || s.qf.length === 0) {
      s.qf = [];
      for (let i = 0; i < 8; i += 2) {
        const w1 = s.r16[i].tie.winner === "home" ? s.r16[i].home : s.r16[i].away;
        const w2 = s.r16[i + 1].tie.winner === "home" ? s.r16[i + 1].home : s.r16[i + 1].away;
        s.qf.push({ home: w1, away: w2, played: false });
      }
    }
    // Play any unplayed QF ties (stageBonus 2)
    if (s.qf.some((p) => !p.played)) {
      s.qf = s.qf.map((p) =>
        p.played ? p : ({ ...p, ...playKnockout(p.home, p.away, userStats, userTacticId, isUserTeam, true, 2), played: true })
      );
    }
    // Build SF from QF winners if missing
    if (!s.sf || s.sf.length === 0) {
      s.sf = [];
      for (let i = 0; i < 4; i += 2) {
        const w1 = s.qf[i].tie.winner === "home" ? s.qf[i].home : s.qf[i].away;
        const w2 = s.qf[i + 1].tie.winner === "home" ? s.qf[i + 1].home : s.qf[i + 1].away;
        s.sf.push({ home: w1, away: w2, played: false });
      }
    }
    // Play any unplayed SF ties (stageBonus 3)
    if (s.sf.some((p) => !p.played)) {
      s.sf = s.sf.map((p) =>
        p.played ? p : ({ ...p, ...playKnockout(p.home, p.away, userStats, userTacticId, isUserTeam, true, 3), played: true })
      );
    }
    // Build Final from SF winners if missing
    if (!s.final || s.final.length === 0) {
      const w1 = s.sf[0].tie.winner === "home" ? s.sf[0].home : s.sf[0].away;
      const w2 = s.sf[1].tie.winner === "home" ? s.sf[1].home : s.sf[1].away;
      s.final = [{ home: w1, away: w2, played: false }];
    }
    // Play Final (single match, stageBonus 4)
    if (s.final.some((p) => !p.played)) {
      s.final = s.final.map((p) =>
        p.played ? p : ({ ...p, ...playKnockout(p.home, p.away, userStats, userTacticId, isUserTeam, false, 4), played: true })
      );
    }
    s.champion = s.final[0].tie.winner === "home" ? s.final[0].home : s.final[0].away;
    s.stage = "eliminated_done";
    return s;
  };

  const playR16 = () => {
    sound.swoosh();
    const r16 = state.r16.map((pair) => ({ ...pair, ...playKnockout(pair.home, pair.away, userStats, userTacticId, isUserTeam, true, 1), played: true }));
    const qf = [];
    for (let i = 0; i < 8; i += 2) {
      const w1 = r16[i].tie.winner === "home" ? r16[i].home : r16[i].away;
      const w2 = r16[i+1].tie.winner === "home" ? r16[i+1].home : r16[i+1].away;
      qf.push({ home: w1, away: w2, played: false });
    }
    const userTie = r16.find((m) => isUserTeam(m.home) || isUserTeam(m.away));
    if (userTie) {
      const userWon = (isUserTeam(userTie.home) && userTie.tie.winner === "home") || (isUserTeam(userTie.away) && userTie.tie.winner === "away");
      onMatch({ stage: "Son 16", knockout: userTie, userWon });
      if (!userWon) {
        const next = autoCompleteBracket({ ...state, r16, qf, eliminatedAt: "Son 16" });
        setState(next); onSaveState && onSaveState(next);
        return;
      }
    }
    const next = { ...state, r16, qf, stage: "qf" };
    setState(next); onSaveState && onSaveState(next);
  };

  const playQF = () => {
    sound.swoosh();
    const qf = state.qf.map((pair) => ({ ...pair, ...playKnockout(pair.home, pair.away, userStats, userTacticId, isUserTeam, true, 2), played: true }));
    const sf = [];
    for (let i = 0; i < 4; i += 2) {
      const w1 = qf[i].tie.winner === "home" ? qf[i].home : qf[i].away;
      const w2 = qf[i+1].tie.winner === "home" ? qf[i+1].home : qf[i+1].away;
      sf.push({ home: w1, away: w2, played: false });
    }
    const userTie = qf.find((m) => isUserTeam(m.home) || isUserTeam(m.away));
    if (userTie) {
      const userWon = (isUserTeam(userTie.home) && userTie.tie.winner === "home") || (isUserTeam(userTie.away) && userTie.tie.winner === "away");
      onMatch({ stage: "Çeyrek Final", knockout: userTie, userWon });
      if (!userWon) {
        const next = autoCompleteBracket({ ...state, qf, sf, eliminatedAt: "Çeyrek Final" });
        setState(next); onSaveState && onSaveState(next);
        return;
      }
    }
    const next = { ...state, qf, sf, stage: "sf" };
    setState(next); onSaveState && onSaveState(next);
  };

  const playSF = () => {
    sound.swoosh();
    const sf = state.sf.map((pair) => ({ ...pair, ...playKnockout(pair.home, pair.away, userStats, userTacticId, isUserTeam, true, 3), played: true }));
    const w1 = sf[0].tie.winner === "home" ? sf[0].home : sf[0].away;
    const w2 = sf[1].tie.winner === "home" ? sf[1].home : sf[1].away;
    const final = [{ home: w1, away: w2, played: false }];
    const userTie = sf.find((m) => isUserTeam(m.home) || isUserTeam(m.away));
    if (userTie) {
      const userWon = (isUserTeam(userTie.home) && userTie.tie.winner === "home") || (isUserTeam(userTie.away) && userTie.tie.winner === "away");
      onMatch({ stage: "Yarı Final", knockout: userTie, userWon });
      if (!userWon) {
        const next = autoCompleteBracket({ ...state, sf, final, eliminatedAt: "Yarı Final" });
        setState(next); onSaveState && onSaveState(next);
        return;
      }
    }
    const next = { ...state, sf, final, stage: "final" };
    setState(next); onSaveState && onSaveState(next);
  };

  const playFinal = () => {
    sound.swoosh();
    const fin = state.final.map((pair) => ({ ...pair, ...playKnockout(pair.home, pair.away, userStats, userTacticId, isUserTeam, false, 4), played: true }));
    const winnerRef = fin[0].tie.winner === "home" ? fin[0].home : fin[0].away;
    const userTie = fin[0];
    const userWon = (isUserTeam(userTie.home) && userTie.tie.winner === "home") || (isUserTeam(userTie.away) && userTie.tie.winner === "away");
    // Pass trophy candidate via the match payload — App.js will trigger trophy after modal closes
    onMatch({ stage: "Final", knockout: userTie, userWon, championRef: winnerRef });
    const next = { ...state, final: fin, stage: "done", champion: winnerRef };
    setState(next);
    onSaveState && onSaveState(next);
  };

  return (
    <div className="px-5 md:px-10 py-6 max-w-[1700px] mx-auto">
      <div className="flex items-end justify-between flex-wrap gap-4 mb-6">
        <div>
          <div className="font-mono text-xs text-amber-300 tracking-widest">ADIM 4 / 4 · TURNUVA</div>
          <h2 className="font-display text-4xl md:text-5xl tracking-tight">ŞAMPIYONLAR LİGİ {currentStageLabel(state)}</h2>
        </div>
        <StageActions state={state} onPlayMd={playMatchday} onPlayR16={playR16} onPlayQF={playQF} onPlaySF={playSF} onPlayFinal={playFinal} />
      </div>

      {/* Group Stage */}
      {state.stage === "group" && (
        <div>
          <div className="text-xs text-white/60 font-mono tracking-widest mb-3">
            MAÇ GÜNÜ {Math.min(state.matchdayIndex + 1, 6)} / 6
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {liveStandings.map((table, gi) => (
              <GroupTable key={gi} title={`GROUP ${String.fromCharCode(65 + gi)}`} table={table} />
            ))}
          </div>
        </div>
      )}

      {state.stage === "post_group" && (
        <div className="space-y-6">
          <div className="glass rounded-2xl p-5 text-center">
            <div className="font-mono text-xs text-amber-300 tracking-widest">GRUP AŞAMASI TAMAMLANDI</div>
            <div className="font-display text-3xl tracking-tight mt-1">Tüm gruplardaki nihai sıralama aşağıda. Hazır olduğunda Son 16'ya geç.</div>
            <button
              type="button"
              className="btn-primary mt-4"
              onClick={() => {
                const next = { ...state, stage: "r16" };
                setState(next); onSaveState && onSaveState(next);
              }}
              data-testid="advance-to-r16-button"
            >
              SON 16'YA İLERLE →
            </button>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {liveStandings.map((table, gi) => (
              <GroupTable key={gi} title={`GROUP ${String.fromCharCode(65 + gi)}`} table={table} />
            ))}
          </div>
        </div>
      )}

      {(state.stage === "r16" || state.stage === "qf" || state.stage === "sf" || state.stage === "final" || state.stage === "done" || state.stage === "eliminated" || state.stage === "eliminated_done") && (
        <div className="space-y-8">
          <Bracket title="SON 16" pairs={state.r16} />
          {state.qf && <Bracket title="ÇEYREK FİNAL" pairs={state.qf} />}
          {state.sf && <Bracket title="YARI FİNAL" pairs={state.sf} />}
          {state.final && <Bracket title="FİNAL" pairs={state.final} final />}

          {state.stage === "done" && state.champion && (
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="glass rounded-2xl p-8 text-center">
              <Trophy size={48} className="text-amber-300 mx-auto mb-3" />
              <div className="font-mono text-xs tracking-widest text-amber-300">KUPA SAHİBİ</div>
              <div className="font-display text-4xl tracking-tight mt-2">{state.champion.label}</div>
            </motion.div>
          )}
          {state.stage === "eliminated_done" && state.champion && (
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="glass rounded-2xl p-6 text-center">
              <div className="font-mono text-xs tracking-widest text-red-400">{state.eliminatedAt || "ELENDİN"}</div>
              <div className="font-display text-2xl mt-1 text-white/70">Senin için final geçti — ama turnuva devam etti.</div>
              <div className="mt-4 pt-4 border-t border-white/10">
                <Trophy size={40} className="text-amber-300 mx-auto mb-2" />
                <div className="font-mono text-xs tracking-widest text-amber-300">ŞAMPİYON</div>
                <div className="font-display text-3xl tracking-tight mt-1">{state.champion.label}</div>
              </div>
              {/* Spectator buttons: let the user watch remaining matches even after elimination */}
              <div className="mt-5 flex flex-wrap gap-2 justify-center">
                {state.eliminatedAt === "Son 16" && state.qf && state.qf[0]?.tie && (
                  <button type="button" className="btn-ghost" data-testid="watch-qf-button"
                    onClick={() => onMatch({ stage: "Çeyrek Final", knockout: state.qf[0], userWon: false, spectator: true })}>
                    <Play size={14} className="inline mr-1" /> ÇF MAÇI İZLE
                  </button>
                )}
                {(state.eliminatedAt === "Son 16" || state.eliminatedAt === "Çeyrek Final") && state.sf && state.sf[0]?.tie && (
                  <button type="button" className="btn-ghost" data-testid="watch-sf-button"
                    onClick={() => onMatch({ stage: "Yarı Final", knockout: state.sf[0], userWon: false, spectator: true })}>
                    <Play size={14} className="inline mr-1" /> YF MAÇI İZLE
                  </button>
                )}
                {state.final && state.final[0]?.tie && (
                  <button type="button" className="btn-primary" data-testid="watch-final-button"
                    onClick={() => onMatch({ stage: "Final", knockout: state.final[0], userWon: false, spectator: true })}>
                    <Play size={14} className="inline mr-1" /> FİNALİ İZLE
                  </button>
                )}
              </div>
            </motion.div>
          )}
          {state.stage === "eliminated" && (
            <div className="glass rounded-2xl p-6 text-center text-white/70">
              <div className="font-mono text-xs tracking-widest text-red-400">ELENDIN</div>
              <div className="font-display text-2xl mt-1">Aşama: {state.eliminatedAt}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

function currentStageLabel(state) {
  switch (state.stage) {
    case "group": return "GRUP AŞAMASI";
    case "post_group": return "GRUP SONU";
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

const StageActions = ({ state, onPlayMd, onPlayR16, onPlayQF, onPlaySF, onPlayFinal }) => {
  if (state.stage === "group") return <button type="button" className="btn-primary flex items-center gap-2" onClick={onPlayMd} data-testid="play-matchday-button"><Play size={18}/> MD {Math.min(state.matchdayIndex + 1, 6)} OYNA</button>;
  if (state.stage === "r16") return <button type="button" className="btn-primary flex items-center gap-2" onClick={onPlayR16} data-testid="play-r16-button"><Play size={18}/> SON 16 OYNA</button>;
  if (state.stage === "qf") return <button type="button" className="btn-primary flex items-center gap-2" onClick={onPlayQF} data-testid="play-qf-button"><Play size={18}/> ÇEYREK FİNAL</button>;
  if (state.stage === "sf") return <button type="button" className="btn-primary flex items-center gap-2" onClick={onPlaySF} data-testid="play-sf-button"><Play size={18}/> YARI FİNAL</button>;
  if (state.stage === "final") return <button type="button" className="btn-primary flex items-center gap-2" onClick={onPlayFinal} data-testid="play-final-button"><Play size={18}/> FİNAL</button>;
  return null;
};

const GroupTable = ({ title, table }) => {
  return (
    <div className="glass rounded-xl p-4">
      <div className="font-display text-base tracking-widest text-amber-300 mb-3">{title}</div>
      <table className="w-full text-sm">
        <thead className="text-white/45 font-mono text-[11px]">
          <tr><th className="text-left py-1.5">TAKIM</th><th>O</th><th>G</th><th>AV</th><th>P</th></tr>
        </thead>
        <tbody>
          {table.map((row, i) => (
            <tr key={i} className={`${row.team.isUser ? "text-amber-300" : "text-white/85"}`}>
              <td className="py-1.5">
                <div className="flex items-center gap-2">
                  <Crest code={row.team.crest} size="sm" />
                  <div className="flex flex-col leading-tight min-w-0">
                    <span className="truncate max-w-[140px] text-[13px]">{row.team.club}</span>
                    {!row.team.isUser && (
                      <span className="text-[10px] font-mono text-white/45 tracking-wider">{row.team.season}</span>
                    )}
                  </div>
                </div>
              </td>
              <td className="text-center text-sm">{row.P}</td>
              <td className="text-center text-sm">{row.W}</td>
              <td className="text-center text-sm">{row.GD}</td>
              <td className="text-center text-base font-bold">{row.Pts}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const Bracket = ({ title, pairs, final = false }) => {
  return (
    <div>
      <div className="font-display text-xl tracking-widest text-amber-300 mb-3">{title}</div>
      <div className={`grid gap-3 ${final ? "" : "md:grid-cols-2 lg:grid-cols-4"}`}>
        {pairs.map((p, i) => <KnockoutCard key={i} pair={p} />)}
      </div>
    </div>
  );
};

const KnockoutCard = ({ pair }) => {
  const winner = pair.tie?.winner;
  const aggA = pair.tie?.aggregate?.a;
  const aggB = pair.tie?.aggregate?.b;
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
