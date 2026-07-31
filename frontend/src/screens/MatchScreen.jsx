import React, { useEffect, useState, useMemo, useRef } from "react";
import { motion } from "framer-motion";
import { sound } from "../engine/sounds";
import { FORMATIONS } from "../data/formations";
import { CanvasMatch } from "./match/CanvasMatch";

// Single-speed reveal cadence. The speed picker was removed on user request
// (iter-28) — every match plays at the calm "yavaş" pace now, and users skip
// the whole simulation via the new MAÇI ATLA button (see `handleSkip`).
const EVENT_DELAY_MS = 1600;

// -----------------------------------------------------------------------------
// Opponent XI → formation mapping (opponents don't carry a formation, only a
// top-11 sorted by rating). We drop the sorted list into a 4-3-3 template using
// each player's primary position and fall back to the raw order if the mapping
// can't fill a slot.
// -----------------------------------------------------------------------------
const DEFAULT_OPP_FORMATION = "4-3-3";

function buildOpponentXi(players) {
  if (!players || players.length === 0) return { formationId: DEFAULT_OPP_FORMATION, xi: [] };
  const formation = FORMATIONS[DEFAULT_OPP_FORMATION];
  const slots = formation.slots;
  const pool = players.slice(0, 11);
  const xi = new Array(slots.length).fill(null);
  const used = new Set();

  const matches = (slotPos, p) => p && (p.primary === slotPos || p.secondary === slotPos);
  const familyMatch = (slotPos, p) => {
    if (!p) return false;
    const wide = new Set(["LW", "RW", "LM", "RM"]);
    if (wide.has(slotPos) && (wide.has(p.primary) || wide.has(p.secondary))) return true;
    return false;
  };

  // Pass 1: exact primary/secondary match
  slots.forEach((slot, i) => {
    if (xi[i]) return;
    const found = pool.findIndex((p, pi) => !used.has(pi) && matches(slot.pos, p));
    if (found !== -1) { xi[i] = pool[found]; used.add(found); }
  });
  // Pass 2: wing family match
  slots.forEach((slot, i) => {
    if (xi[i]) return;
    const found = pool.findIndex((p, pi) => !used.has(pi) && familyMatch(slot.pos, p));
    if (found !== -1) { xi[i] = pool[found]; used.add(found); }
  });
  // Pass 3: leftovers in order
  slots.forEach((slot, i) => {
    if (xi[i]) return;
    const found = pool.findIndex((_, pi) => !used.has(pi));
    if (found !== -1) { xi[i] = pool[found]; used.add(found); }
  });
  return { formationId: DEFAULT_OPP_FORMATION, xi };
}

export const MatchScreen = ({ match, onClose }) => {
  const [phase, setPhase] = useState("prematch"); // prematch -> kickoff -> playing -> et_confirm -> playing_et -> penalties -> done
  const [legIdx, setLegIdx] = useState(0);
  const [penShotIdx, setPenShotIdx] = useState(0);
  const [etVisibleIdx, setEtVisibleIdx] = useState(0);
  // Events emitted BY the pitch simulation on the canvas during regulation.
  // These are the scoreboard's single source of truth for the live score,
  // live minute and the commentary log — the parent never generates its own
  // match events any more.
  const [emittedRegEvents, setEmittedRegEvents] = useState([]);
  const finishedRef = useRef(false);

  const speed = { delay: EVENT_DELAY_MS };

  const isKnockout = !!match.knockout;
  const legs = useMemo(() => {
    if (!isKnockout) return [match.result];
    if (match.knockout.tie.legs) return match.knockout.tie.legs;
    return [match.knockout.tie.match];
  }, [match, isKnockout]);

  const isSecondLeg = isKnockout && legs.length === 2 && legIdx === 1;
  const homeRef = isKnockout
    ? (isSecondLeg ? match.knockout.away : match.knockout.home)
    : match.home;
  const awayRef = isKnockout
    ? (isSecondLeg ? match.knockout.home : match.knockout.away)
    : match.away;
  const homeName = homeRef.label || homeRef.name;
  const awayName = awayRef.label || awayRef.name;

  const currentLeg = legs[legIdx];
  const events = currentLeg?.events || [];
  const regulationEvents = useMemo(() => events.filter((e) => e.minute <= 90), [events]);
  const extraTimeEvents = useMemo(() => events.filter((e) => e.minute > 90), [events]);
  const isLastLeg = legIdx === legs.length - 1;
  const tie = isKnockout ? match.knockout.tie : null;
  const hasPenalties = isKnockout && tie?.penalties;
  const hasExtraTime = isKnockout && isLastLeg && (!!tie?.et || tie?.decidedBy === "extra_time" || tie?.decidedBy === "penalties");

  const userSide = useMemo(() => {
    if (homeRef?.isUser) return "home";
    if (awayRef?.isUser) return "away";
    return null;
  }, [homeRef, awayRef]);

  // Resolve XI + formation for both sides. User side uses `match.userXi` /
  // `match.userFormationId`; opponents use their top-11 mapped into 4-3-3.
  const homeLineup = useMemo(() => {
    if (homeRef?.isUser) return { formationId: match.userFormationId || DEFAULT_OPP_FORMATION, xi: match.userXi || [] };
    return buildOpponentXi(homeRef?.players);
  }, [homeRef, match.userXi, match.userFormationId]);
  const awayLineup = useMemo(() => {
    if (awayRef?.isUser) return { formationId: match.userFormationId || DEFAULT_OPP_FORMATION, xi: match.userXi || [] };
    return buildOpponentXi(awayRef?.players);
  }, [awayRef, match.userXi, match.userFormationId]);

  // Reset per leg (excluding prematch which only fires on the first leg entry).
  useEffect(() => {
    setEmittedRegEvents([]);
    setEtVisibleIdx(0);
    setPenShotIdx(0);
    finishedRef.current = false;
    if (legIdx === 0) return; // first leg is handled by prematch → start button
    sound.whistleStart();
    setPhase("kickoff");
    const k = setTimeout(() => setPhase("playing"), 800);
    return () => clearTimeout(k);
  }, [legIdx]);

  const startMatch = () => {
    sound.whistleStart();
    setPhase("kickoff");
    setTimeout(() => setPhase("playing"), 800);
  };

  // The canvas is the source of truth. Every physics event lands here first;
  // we ONLY append to the scoreboard's log — we never invent events.
  const handleCanvasEvent = (e) => {
    setEmittedRegEvents((prev) => {
      // De-dupe by minute+type+text (defensive against a double-tick edge).
      const key = `${e.minute}-${e.type}-${e.text}`;
      if (prev.some((p) => `${p.minute}-${p.type}-${p.text}` === key)) return prev;
      return [...prev, e];
    });
    if (e.type === "GOAL") sound.goal();
  };

  // Canvas signals the simulation is fully done (natural end or skip button).
  const handleCanvasEnd = () => {
    sound.whistleEnd();
    if (isLastLeg && hasExtraTime) setPhase("et_confirm");
    else if (isLastLeg && hasPenalties && !hasExtraTime) setPhase("penalties");
    else setPhase("done");
  };

  // Extra-time event ticker (minutes 91-120). ET still uses the pre-baked
  // events from matchEngine — only regulation is physics-driven for now.
  useEffect(() => {
    if (phase !== "playing_et") return;
    if (etVisibleIdx >= extraTimeEvents.length) {
      const t = setTimeout(() => {
        sound.whistleEnd();
        if (hasPenalties) setPhase("penalties");
        else setPhase("done");
      }, 400);
      return () => clearTimeout(t);
    }
    const e = extraTimeEvents[etVisibleIdx];
    const t = setTimeout(() => {
      if (e.type === "GOAL") sound.goal();
      setEtVisibleIdx((i) => i + 1);
    }, speed.delay);
    return () => clearTimeout(t);
  }, [phase, etVisibleIdx, extraTimeEvents, speed.delay, hasPenalties]);

  // Penalty reveal (slow, suspense)
  useEffect(() => {
    if (phase !== "penalties") return;
    const shots = tie?.penalties?.shots || [];
    if (penShotIdx >= shots.length) {
      const t = setTimeout(() => setPhase("done"), 800);
      return () => clearTimeout(t);
    }
    const baseDelay = Math.max(550, speed.delay * 2);
    const t = setTimeout(() => {
      const s = shots[penShotIdx];
      if (s.scored) sound.goal(); else sound.error();
      setPenShotIdx(penShotIdx + 1);
    }, baseDelay);
    return () => clearTimeout(t);
  }, [phase, penShotIdx, tie, speed.delay]);

  const handleClose = () => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    onClose();
  };

  // Skip lives ON the canvas itself — the CanvasMatch button drives its own
  // fast-forward through the physics and then calls back via `onEnd`, which
  // is where we transition the phase. This keeps `handleSkip` a no-op alias
  // (used when the canvas skip fires but hasn't triggered onEnd yet, e.g.
  // during kickoff freeze).
  const handleSkip = () => {
    if (phase === "kickoff") {
      // Kickoff phase: fast-forward the whole regulation. The canvas isn't
      // mounted yet for stepping, so we just transition. (Rare path.)
      setPhase(isLastLeg && hasExtraTime ? "et_confirm"
             : isLastLeg && hasPenalties ? "penalties"
             : "done");
    } else if (phase === "playing_et") {
      setEtVisibleIdx(extraTimeEvents.length);
      setPhase(hasPenalties ? "penalties" : "done");
    }
    // For phase === "playing" the CanvasMatch drains the sim itself and
    // fires handleCanvasEnd → phase transition. Nothing to do here.
  };

  const nextLeg = () => {
    if (legIdx + 1 < legs.length) setLegIdx(legIdx + 1);
    else handleClose();
  };

  const startExtraTime = () => {
    sound.whistleStart();
    setPhase("playing_et");
  };

  // Score accumulation — regulation now reads from CANVAS-EMITTED events.
  const goalsSoFar = useMemo(() => {
    let h = 0, a = 0;
    emittedRegEvents.forEach((e) => {
      if (e.type === "GOAL") { if (e.side === "home") h++; else a++; }
    });
    return { h, a };
  }, [emittedRegEvents]);

  const etGoalsSoFar = useMemo(() => {
    let h = 0, a = 0;
    extraTimeEvents.slice(0, etVisibleIdx).forEach((e) => {
      if (e.type === "GOAL") { if (e.side === "home") h++; else a++; }
    });
    return { h, a };
  }, [extraTimeEvents, etVisibleIdx]);

  let displayedHomeScore;
  let displayedAwayScore;
  if (phase === "prematch" || phase === "playing" || phase === "kickoff") {
    displayedHomeScore = goalsSoFar.h;
    displayedAwayScore = goalsSoFar.a;
  } else if (phase === "et_confirm") {
    displayedHomeScore = goalsSoFar.h;
    displayedAwayScore = goalsSoFar.a;
  } else if (phase === "playing_et") {
    displayedHomeScore = goalsSoFar.h + etGoalsSoFar.h;
    displayedAwayScore = goalsSoFar.a + etGoalsSoFar.a;
  } else {
    displayedHomeScore = currentLeg.home.score;
    displayedAwayScore = currentLeg.away.score;
  }

  const penShots = tie?.penalties?.shots || [];
  const penShown = penShots.slice(0, penShotIdx);
  const penPairHomeName = (match.knockout?.home?.label) || homeName;
  const penPairAwayName = (match.knockout?.away?.label) || awayName;
  const penHomeScored = penShown.filter((s) => s.side === "home" && s.scored).length;
  const penAwayScored = penShown.filter((s) => s.side === "away" && s.scored).length;

  const showAggregateBlock = phase === "done" && isKnockout && isLastLeg;

  // Live clock: regulation reads from the latest CANVAS-EMITTED event,
  // extra time from the pre-baked ET tick pointer.
  const liveMinute = useMemo(() => {
    if (phase === "playing" && emittedRegEvents.length > 0) {
      return emittedRegEvents[emittedRegEvents.length - 1].minute;
    }
    if (phase === "playing_et" && etVisibleIdx > 0) {
      return extraTimeEvents[Math.min(etVisibleIdx - 1, extraTimeEvents.length - 1)]?.minute ?? 90;
    }
    return null;
  }, [phase, emittedRegEvents, etVisibleIdx, extraTimeEvents]);

  const isCanvasPhase = phase === "playing" || phase === "playing_et" || phase === "kickoff";
  const stageLabel = `${match.stage ? match.stage : "GRUP AŞAMASI"}${legs.length > 1 ? ` · LEG ${legIdx + 1}/${legs.length} · ${isSecondLeg ? "RÖVANŞ" : "İLK MAÇ"}` : ""}`;

  // Prematch: allow cancelling by pressing Escape or clicking the backdrop.
  // We only wire these while the animation hasn't started yet — once the
  // simulation kicks off, the modal must run to completion so that the
  // tournament state stays consistent with the (already-applied) result.
  useEffect(() => {
    if (phase !== "prematch") return;
    const onKey = (ev) => { if (ev.key === "Escape") handleClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase]);

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center px-4 py-6 bg-black/85 backdrop-blur-md overflow-y-auto"
      data-testid="match-modal"
      onClick={(e) => {
        // Only backdrop clicks close, and only while still in prematch.
        if (phase === "prematch" && e.target === e.currentTarget) handleClose();
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className={`glass rounded-2xl w-full ${phase === "prematch" ? "max-w-5xl" : "max-w-3xl"} p-5 md:p-7`}
      >
        <div className={`flex items-center justify-between mb-2 flex-wrap gap-2 ${isCanvasPhase ? "hidden" : ""}`}>
          <div className="font-mono text-xs tracking-widest text-amber-300">
            {stageLabel}
          </div>
        </div>

        {/* --- PRE-MATCH: side-by-side lineups + pitches ------------------ */}
        {phase === "prematch" && (
          <PreMatchLineups
            homeName={homeName}
            awayName={awayName}
            homeRef={homeRef}
            awayRef={awayRef}
            homeLineup={homeLineup}
            awayLineup={awayLineup}
            onStart={startMatch}
            onCancel={handleClose}
          />
        )}

        {/* --- CANVAS MATCH (in-play view) ------------------------------ */}
        {isCanvasPhase && (
          <CanvasMatch
            key={`leg-${legIdx}`}
            stageLabel={stageLabel}
            homeName={homeName}
            awayName={awayName}
            homeScore={displayedHomeScore}
            awayScore={displayedAwayScore}
            liveMinute={liveMinute}
            matchInputs={{
              homeName,
              awayName,
              seed: currentLeg?.seed ?? 1,
              _homePlayers: currentLeg?._homePlayers ?? null,
              _awayPlayers: currentLeg?._awayPlayers ?? null,
              _homeStrength: currentLeg?._homeStrength,
              _awayStrength: currentLeg?._awayStrength,
            }}
            onEvent={handleCanvasEvent}
            onEnd={handleCanvasEnd}
            onSkip={handleSkip}
          />
        )}

        {/* --- Scoreboard for post-match phases (et_confirm / done) ------- */}
        {(phase === "et_confirm" || phase === "done") && (
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 mb-3">
            <div className="text-right min-w-0">
              <div className="font-display text-lg md:text-2xl tracking-tight truncate" data-testid="home-name">{homeName}</div>
              <div className="text-[10px] text-white/40 font-mono tracking-widest">{isKnockout ? "EV SAHİBİ" : ""}</div>
            </div>
            <div className="text-center flex flex-col items-center">
              <motion.div
                key={`${displayedHomeScore}-${displayedAwayScore}-${legIdx}`}
                initial={{ scale: 1 }}
                animate={{ scale: [1.0, 1.18, 1.0] }}
                transition={{ duration: 0.5 }}
                className="font-display text-5xl md:text-6xl text-amber-300 leading-none"
                data-testid="scoreboard"
              >
                {displayedHomeScore} <span className="text-white/30">·</span> {displayedAwayScore}
              </motion.div>
            </div>
            <div className="min-w-0">
              <div className="font-display text-lg md:text-2xl tracking-tight truncate" data-testid="away-name">{awayName}</div>
              <div className="text-[10px] text-white/40 font-mono tracking-widest">{isKnockout ? "DEPLASMAN" : ""}</div>
            </div>
          </div>
        )}

        {/* Extra-time confirmation modal */}
        {phase === "et_confirm" && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mt-4 bg-black/60 border border-amber-300/40 rounded-xl p-5 text-center"
            data-testid="et-confirm-modal"
          >
            <div className="font-mono text-[10px] tracking-widest text-amber-300 mb-2">90. DAKİKA</div>
            <div className="font-display text-2xl md:text-3xl text-white mb-2">Maç uzatmalara gidiyor.</div>
            <div className="text-sm text-white/70 mb-4">Devam etmek ister misin? 30 dakikalık uzatma oynanacak, gerekirse penaltılara gidilecek.</div>
            <button type="button" className="btn-primary" onClick={startExtraTime} data-testid="et-continue-button">DEVAM ET →</button>
          </motion.div>
        )}

        {/* Penalty reveal */}
        {phase === "penalties" && (
          <div className="bg-black/50 rounded-xl p-4 border border-amber-300/30" data-testid="penalty-block">
            <div className="text-center font-display text-2xl text-amber-300 tracking-widest mb-3">PENALTI ATIŞLARI</div>
            <div className="grid grid-cols-2 gap-3 text-center">
              <PenaltyColumn name={penPairHomeName} shots={penShown.filter((s) => s.side === "home")} totalScored={penHomeScored} />
              <PenaltyColumn name={penPairAwayName} shots={penShown.filter((s) => s.side === "away")} totalScored={penAwayScored} />
            </div>
            <div className="text-center mt-3 text-[10px] text-white/40 font-mono tracking-widest">
              {penShotIdx} / {penShots.length} ATIŞ
            </div>
          </div>
        )}

        {/* Stats */}
        {phase === "done" && currentLeg && phase !== "penalties" && (
          <div className="grid grid-cols-3 gap-3 mt-4 text-center text-xs text-white/70">
            <StatBar label="ŞUT"      h={currentLeg.home.shots}    a={currentLeg.away.shots} />
            <StatBar label="İSABETLİ" h={currentLeg.home.onTarget} a={currentLeg.away.onTarget} />
            <StatBar label="XG"       h={currentLeg.home.xg?.toFixed(2)} a={currentLeg.away.xg?.toFixed(2)} />
          </div>
        )}

        {/* Player of the Match */}
        {phase === "done" && currentLeg && (() => {
          const homeStats = currentLeg.homePlayerStats || [];
          const awayStats = currentLeg.awayPlayerStats || [];
          const all = [
            ...homeStats.map((p) => ({ ...p, _side: "home" })),
            ...awayStats.map((p) => ({ ...p, _side: "away" })),
          ];
          if (all.length === 0) return null;
          const potm = [...all].sort((a, b) => b.rating - a.rating)[0];
          if (!potm) return null;
          const isUserPotm = userSide && potm._side === userSide;
          const saves = (currentLeg.events || []).filter((e) => e.type === "SAVE" && e.side === potm._side).length;
          const isGK = potm.slot === "GK";
          const containerClass = isUserPotm
            ? "border-amber-300/40 bg-gradient-to-br from-amber-300/10 to-amber-300/0"
            : "border-white/30 bg-gradient-to-br from-white/10 to-white/0";
          const labelColor = isUserPotm ? "text-amber-300" : "text-white";
          const ratingColor = isUserPotm ? "text-amber-300" : "text-white";
          return (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className={`mt-4 p-4 rounded-xl border ${containerClass}`}
              data-testid="potm-card"
            >
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1 pr-3">
                  <div className={`font-mono text-[10px] tracking-widest ${labelColor}`}>
                    PLAYER OF THE MATCH{!isUserPotm && " · RAKİP"}
                  </div>
                  <div className="font-display text-2xl tracking-tight mt-0.5 truncate">{potm.name}</div>
                  {potm.teamName && (
                    <div className={`text-[10px] font-mono tracking-wider truncate uppercase ${isUserPotm ? "text-amber-300/70" : "text-white/65"}`}>
                      {potm.teamName}
                    </div>
                  )}
                  <div className="text-[11px] font-mono text-white/50 tracking-wider mt-0.5">
                    {potm.slot} · {potm.season} · {isGK ? `${saves} KURTARIŞ` : `${potm.goals} GOL · ${potm.assists} ASİST`}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className={`font-display text-4xl ${ratingColor}`}>{potm.rating.toFixed(1)}</div>
                  <div className="text-[10px] font-mono text-white/50">REYTING</div>
                </div>
              </div>
            </motion.div>
          );
        })()}

        {/* Aggregate / result */}
        {showAggregateBlock && (
          <div className="mt-4 text-center" data-testid="aggregate-result">
            {tie?.aggregate && (
              <div className="font-display text-lg tracking-widest text-amber-300">
                TOPLAM: {match.knockout.home.label} {tie.aggregate.a} - {tie.aggregate.b} {match.knockout.away.label}
              </div>
            )}
            {tie?.decidedBy === "penalties" && tie?.penalties && (
              <div className="font-mono text-xs tracking-widest text-amber-300 mt-1">
                PENALTILAR: {tie.penalties.a} - {tie.penalties.b}
              </div>
            )}
            <div className="font-display text-3xl mt-2 text-white" data-testid="user-result">
              {match.spectator
                ? `KAZANAN: ${tie?.winner === "home" ? match.knockout.home.label : match.knockout.away.label}`
                : (match.userWon ? "TUR ATLADIN" : "ELENDİN")}
            </div>
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          {phase === "done" && legIdx + 1 < legs.length && (
            <button type="button" className="btn-ghost" onClick={nextLeg} data-testid="next-leg-button">RÖVANŞ MAÇI →</button>
          )}
          {phase === "done" && legIdx + 1 >= legs.length && (
            <button type="button" className="btn-primary" onClick={handleClose} data-testid="close-match-button">DEVAM ET</button>
          )}
        </div>
      </motion.div>
    </div>
  );
};

// -----------------------------------------------------------------------------
// PreMatchLineups — two team columns, each with player list and a mini pitch.
// -----------------------------------------------------------------------------
const PreMatchLineups = ({ homeName, awayName, homeRef, awayRef, homeLineup, awayLineup, onStart, onCancel }) => (
  <div data-testid="prematch-lineups">
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
      <TeamLineupPanel
        name={homeName}
        subtitle={homeRef?.isUser ? "SENİN TAKIMIN" : (homeRef?.season ? `${homeRef.season} · ${homeRef.club || ""}` : (homeRef?.club || ""))}
        accent="left"
        lineup={homeLineup}
      />
      <TeamLineupPanel
        name={awayName}
        subtitle={awayRef?.isUser ? "SENİN TAKIMIN" : (awayRef?.season ? `${awayRef.season} · ${awayRef.club || ""}` : (awayRef?.club || ""))}
        accent="right"
        lineup={awayLineup}
      />
    </div>
    <div className="mt-5 flex items-center justify-center gap-3">
      <button type="button" className="btn-ghost" onClick={onCancel} data-testid="prematch-cancel-button">
        ← GERİ
      </button>
      <button type="button" className="btn-primary" onClick={onStart} data-testid="start-match-button">
        MAÇI BAŞLAT →
      </button>
    </div>
    <div className="mt-2 text-center text-[10px] font-mono tracking-widest text-white/40">
      ESC veya dışarı tıklamak da geri dönüyor
    </div>
  </div>
);

const TeamLineupPanel = ({ name, subtitle, accent, lineup }) => {
  const players = lineup?.xi || [];
  const barClass = accent === "left"
    ? "bg-gradient-to-r from-amber-300/25 to-transparent border-l-4 border-amber-300"
    : "bg-gradient-to-l from-red-400/25 to-transparent border-r-4 border-red-400";
  return (
    <div className="rounded-xl overflow-hidden border border-white/10 bg-black/30 flex flex-col">
      <div className={`px-3 py-2 ${barClass}`}>
        <div className="font-display text-lg md:text-xl tracking-tight truncate">{name}</div>
        {subtitle && <div className="text-[10px] font-mono tracking-widest text-white/60 truncate">{subtitle}</div>}
      </div>
      {/* Player list only — the mini pitch under the list was removed on user
          request. Keep the list as the single source of prematch info. */}
      <ul className="p-3 space-y-1 min-w-0" data-testid={`lineup-list-${accent}`}>
        {players.slice(0, 11).map((p, i) => {
          if (!p) {
            return (
              <li key={i} className="flex items-center gap-2 text-xs text-white/40">
                <span className="font-mono w-5 text-right">{i + 1}.</span>
                <span className="italic">— BOŞ SLOT —</span>
              </li>
            );
          }
          const ovr = p.overall ?? 80;
          return (
            <li key={i} className="flex items-center gap-2 text-xs md:text-sm">
              <span className="font-mono w-5 text-right text-white/50">{i + 1}.</span>
              <span className="flex-1 truncate">{p.name}</span>
              <OvrBadge ovr={ovr} />
            </li>
          );
        })}
      </ul>
    </div>
  );
};

const OvrBadge = ({ ovr }) => {
  const bg =
    ovr >= 99 ? "bg-black text-orange-300 border-orange-400/50" :
    ovr >= 90 ? "bg-purple-600/30 text-purple-200 border-purple-400/50" :
    ovr >= 81 ? "bg-amber-500/30 text-amber-200 border-amber-400/60" :
    ovr >= 70 ? "bg-slate-500/30 text-slate-100 border-slate-400/50" :
                 "bg-orange-800/30 text-orange-300 border-orange-500/50";
  return (
    <span className={`font-mono text-[10px] px-1.5 py-0.5 rounded border ${bg}`}>{ovr}</span>
  );
};

// Pitch under each team panel was removed on user request — MiniPitch
// deleted. `FORMATIONS[DEFAULT_OPP_FORMATION]` is still used by
// `buildOpponentXi` above to slot opponents into a 4-3-3 template.




const PenaltyColumn = ({ name, shots, totalScored }) => (
  <div>
    <div className="font-display text-base tracking-tight truncate mb-1">{name}</div>
    <div className="font-display text-3xl text-amber-300 mb-2">{totalScored}</div>
    <div className="flex justify-center gap-1 flex-wrap">
      {shots.map((s, i) => (
        <motion.span
          key={i}
          initial={{ scale: 0, rotate: -90 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 280, damping: 18 }}
          className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold ${
            s.scored ? "bg-emerald-400 text-black" : "bg-red-500 text-white"
          }`}
          data-testid={`pen-shot`}
        >
          {s.scored ? "●" : "✕"}
        </motion.span>
      ))}
    </div>
  </div>
);

const StatBar = ({ label, h, a }) => (
  <div className="bg-white/5 rounded px-2 py-1.5">
    <div className="text-[9px] text-white/40 tracking-widest">{label}</div>
    <div className="font-display text-base"><span className="text-amber-300">{h}</span> · <span className="text-white">{a}</span></div>
  </div>
);
