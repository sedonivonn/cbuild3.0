import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Crest } from "../components/Crest";
import { computeStandings, buildR16, playGroupMatch, playKnockout } from "../engine/tournamentEngine";
import { drawGroups, generateGroupFixtures } from "../engine/draftEngine";
import { CHAMPIONS } from "../data/champions";
import { sound } from "../engine/sounds";
import { Play, Trophy } from "lucide-react";

// Create team refs (32 entries)
function buildTeamRefs(userTeam) {
  const champions = CHAMPIONS.map((c, i) => ({
    id: `ch-${i}`,
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
  return [user, ...champions];
}

export const TournamentScreen = ({ userStats, userTacticId, onMatch, onTrophy, savedState, onSaveState }) => {
  const [state, setState] = useState(savedState || null);

  // Init on mount if no saved state
  useEffect(() => {
    if (state) return;
    const teamRefs = buildTeamRefs({ label: "DRAFT TAKIMI", stats: userStats });
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
      next.stage = "r16";
      const r16 = buildR16(standings);
      next.r16 = r16.map((pair) => ({ ...pair, played: false }));
    }
    setState(next);
    onSaveState && onSaveState(next);
    if (userMatch) onMatch(userMatch);
  };

  const playR16 = () => {
    sound.swoosh();
    const r16 = state.r16.map((pair) => ({ ...pair, ...playKnockout(pair.home, pair.away, userStats, userTacticId, isUserTeam, true), played: true }));
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
    const qf = state.qf.map((pair) => ({ ...pair, ...playKnockout(pair.home, pair.away, userStats, userTacticId, isUserTeam, true), played: true }));
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
    const sf = state.sf.map((pair) => ({ ...pair, ...playKnockout(pair.home, pair.away, userStats, userTacticId, isUserTeam, true), played: true }));
    const w1 = sf[0].tie.winner === "home" ? sf[0].home : sf[0].away;
    const w2 = sf[1].tie.winner === "home" ? sf[1].home : sf[1].away;
    const final = [{ home: w1, away: w2, played: false }];
    const userTie = sf.find((m) => isUserTeam(m.home) || isUserTeam(m.away));
    if (userTie) {
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
    const fin = state.final.map((pair) => ({ ...pair, ...playKnockout(pair.home, pair.away, userStats, userTacticId, isUserTeam, false), played: true }));
    const winnerRef = fin[0].tie.winner === "home" ? fin[0].home : fin[0].away;
    const userTie = fin[0];
    const userWon = (isUserTeam(userTie.home) && userTie.tie.winner === "home") || (isUserTeam(userTie.away) && userTie.tie.winner === "away");
    onMatch({ stage: "Final", knockout: userTie, userWon });
    const next = { ...state, final: fin, stage: "done", champion: winnerRef };
    setState(next);
    onSaveState && onSaveState(next);
    if (userWon) { sound.trophy(); onTrophy && onTrophy(winnerRef); }
  };

  return (
    <div className="px-5 md:px-10 py-6 max-w-7xl mx-auto">
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

      {(state.stage === "r16" || state.stage === "qf" || state.stage === "sf" || state.stage === "final" || state.stage === "done" || state.stage === "eliminated") && (
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
    case "r16": return "SON 16";
    case "qf": return "ÇEYREK FİNAL";
    case "sf": return "YARI FİNAL";
    case "final": return "FİNAL";
    case "done": return "TAMAMLANDI";
    case "eliminated": return "ELENDİN";
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
    <div className="glass rounded-xl p-3">
      <div className="font-display text-sm tracking-widest text-amber-300 mb-2">{title}</div>
      <table className="w-full text-xs">
        <thead className="text-white/40 font-mono">
          <tr><th className="text-left py-1">TAKIM</th><th>O</th><th>G</th><th>AV</th><th>P</th></tr>
        </thead>
        <tbody>
          {table.map((row, i) => (
            <tr key={i} className={`${row.team.isUser ? "text-amber-300" : "text-white/85"}`}>
              <td className="py-1">
                <div className="flex items-center gap-1.5">
                  <Crest code={row.team.crest} size="sm" />
                  <div className="flex flex-col leading-tight min-w-0">
                    <span className="truncate max-w-[110px] text-[11px]">{row.team.club}</span>
                    {!row.team.isUser && (
                      <span className="text-[9px] font-mono text-white/45 tracking-wider">{row.team.season}</span>
                    )}
                  </div>
                </div>
              </td>
              <td className="text-center">{row.P}</td>
              <td className="text-center">{row.W}</td>
              <td className="text-center">{row.GD}</td>
              <td className="text-center font-bold">{row.Pts}</td>
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
  return (
    <div className="glass rounded-xl p-3 text-sm">
      <Row team={pair.home} score={aggA} isWin={homeWin} pen={pair.tie?.penalties?.a} />
      <div className="h-px my-1.5 bg-white/10" />
      <Row team={pair.away} score={aggB} isWin={awayWin} pen={pair.tie?.penalties?.b} />
      {pair.tie?.decidedBy === "penalties" && (
        <div className="mt-2 text-[10px] font-mono text-amber-300 tracking-widest">PENALTILAR</div>
      )}
      {pair.tie?.decidedBy === "extra_time" && (
        <div className="mt-2 text-[10px] font-mono text-amber-300 tracking-widest">UZATMA</div>
      )}
    </div>
  );
};

const Row = ({ team, score, isWin, pen }) => (
  <div className={`flex items-center gap-2 ${isWin ? "text-amber-300" : "text-white/80"}`}>
    <Crest code={team.crest} size="sm" />
    <div className="flex flex-col leading-tight flex-1 min-w-0">
      <span className="truncate text-xs">{team.club || team.label}</span>
      {!team.isUser && team.season && (
        <span className="text-[9px] font-mono text-white/45 tracking-wider">SEZON · {team.season}</span>
      )}
    </div>
    <span className="font-display text-lg">{score ?? "—"}</span>
    {pen !== undefined && <span className="text-[10px] text-white/60">({pen})</span>}
  </div>
);
