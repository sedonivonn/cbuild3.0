import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { Trophy, Archive, Crown, Sparkles } from "lucide-react";
import { effOverall } from "../data/ballonDor";

// Pick the best user player across the whole tournament — Ballon d'Or style.
function pickPlayerOfTournament(tournamentStats, userXi) {
  if (!tournamentStats || !userXi || userXi.length === 0) return null;
  let best = null;
  userXi.forEach((p) => {
    const s = tournamentStats[p.name];
    if (!s || s.matches === 0) return;
    const avg = s.totalRating / s.matches;
    // Composite score: avg rating × matches + goals + 0.5 * assists + MOM bonus
    const score = avg * s.matches + (s.goals || 0) * 1.2 + (s.assists || 0) * 0.7 + (s.mom || 0) * 0.5;
    if (!best || score > best.score) {
      best = {
        score,
        name: p.name,
        slot: p._slot || p.primary,
        season: p._season,
        club: p._club || "",
        ovr: effOverall(p, p._season),
        goals: s.goals || 0,
        assists: s.assists || 0,
        matches: s.matches,
        mom: s.mom || 0,
        avgRating: Math.round(avg * 10) / 10,
      };
    }
  });
  return best;
}

export const TrophyScreen = ({ teamLabel, teamName, userXi, tournamentStats, onRestart, onHallOfFame, onDismiss }) => {
  const potTournament = useMemo(
    () => pickPlayerOfTournament(tournamentStats, userXi),
    [tournamentStats, userXi]
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-start md:items-center justify-center bg-black/95 backdrop-blur-xl px-4 py-8 overflow-y-auto cursor-pointer"
      data-testid="trophy-screen"
      onClick={() => onDismiss && onDismiss()}
      title="Kapatmak için boş alana tıkla"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.85, y: 40 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 180, damping: 14 }}
        className="max-w-2xl w-full text-center my-auto cursor-default"
        onClick={(e) => e.stopPropagation()}
      >
        <motion.div
          animate={{ y: [-6, 4, -6], rotate: [-3, 3, -3] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          className="inline-block"
        >
          <Trophy size={120} className="text-amber-300 drop-shadow-[0_0_25px_rgba(255,215,0,0.6)]" />
        </motion.div>
        <div className="font-mono text-xs tracking-widest text-amber-300 mt-6">UEFA CHAMPIONS LEAGUE</div>
        <h1 className="font-display text-6xl md:text-7xl tracking-tight mt-2">ŞAMPİYON!</h1>
        <p className="text-white/70 mt-4 text-base max-w-md mx-auto">
          {teamLabel} tarihin en güçlü karma kadrosunu kurarak Şampiyonlar Ligi kupasını kaldırdı.
        </p>
        <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-300/15 border border-amber-300/30">
          <Archive size={14} className="text-amber-300" />
          <span className="text-xs font-mono tracking-widest text-amber-300">KUPA KABİNİNE EKLENDİ</span>
        </div>

        {/* UCL Player of the Tournament — Ballon d'Or-style award */}
        {potTournament && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: 0.9, duration: 0.6, type: "spring", stiffness: 120 }}
            className="relative mt-7 mx-auto max-w-md"
            data-testid="player-of-tournament-card"
          >
            {/* Animated halo */}
            <motion.div
              animate={{ opacity: [0.4, 0.85, 0.4], scale: [1, 1.06, 1] }}
              transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
              className="absolute inset-0 rounded-2xl"
              style={{
                background: "radial-gradient(circle at 50% 50%, rgba(245,197,66,0.45) 0%, rgba(245,197,66,0) 70%)",
                filter: "blur(14px)",
              }}
            />
            <div
              className="relative rounded-2xl p-5 border border-amber-300/50 overflow-hidden"
              style={{
                background:
                  "linear-gradient(140deg, rgba(40,30,8,0.92) 0%, rgba(15,12,5,0.92) 60%, rgba(60,40,8,0.92) 100%)",
              }}
            >
              {/* Sparkle row */}
              <div className="flex items-center justify-center gap-2 text-amber-300 mb-2">
                <Sparkles size={14} />
                <span className="font-mono text-[10px] tracking-[0.35em]">
                  ŞAMPİYONLAR LİGİ YILIN OYUNCUSU
                </span>
                <Sparkles size={14} />
              </div>

              {/* Player name with crown */}
              <div className="flex items-center justify-center gap-2 mt-1">
                <Crown size={26} className="text-amber-300 drop-shadow-[0_0_8px_rgba(245,197,66,0.6)]" />
                <div className="font-display text-3xl md:text-4xl tracking-tight">
                  {potTournament.name}
                </div>
              </div>
              <div className="text-[11px] font-mono text-amber-300/80 tracking-widest mt-1">
                {potTournament.slot} · {potTournament.season} · {potTournament.club}
              </div>

              {/* Stat strip */}
              <div className="grid grid-cols-4 gap-2 mt-4">
                <StatChip label="MAÇ" value={potTournament.matches} />
                <StatChip label="GOL" value={potTournament.goals} highlight />
                <StatChip label="ASİST" value={potTournament.assists} />
                <StatChip label="REYTING" value={potTournament.avgRating.toFixed(1)} accent />
              </div>
              {potTournament.mom > 0 && (
                <div className="mt-3 text-[10px] font-mono text-amber-300/70 tracking-widest">
                  {potTournament.mom} × PLAYER OF THE MATCH
                </div>
              )}
            </div>
          </motion.div>
        )}

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <button type="button" onClick={onHallOfFame} data-testid="trophy-view-cabinet-button" className="btn-ghost flex items-center gap-2">
            <Archive size={16} /> KABİNİ GÖR
          </button>
          <button type="button" onClick={onRestart} data-testid="trophy-restart-button" className="btn-primary">
            YENİ DRAFT BAŞLAT
          </button>
        </div>
        <div className="mt-5 text-[10px] font-mono tracking-widest text-white/35">
          KADRO İSTATİSTİKLERİNİ GÖRMEK İÇİN BOŞ ALANA TIKLA
        </div>
      </motion.div>
    </div>
  );
};

const StatChip = ({ label, value, highlight = false, accent = false }) => (
  <div
    className={`rounded-lg py-2 px-2 text-center ${
      accent ? "bg-amber-300/20 ring-1 ring-amber-300/40" : "bg-white/5"
    }`}
  >
    <div
      className={`font-display text-xl leading-tight ${
        accent ? "text-amber-300" : highlight ? "text-emerald-300" : "text-white"
      }`}
    >
      {value}
    </div>
    <div className="font-mono text-[9px] tracking-widest text-white/50 mt-0.5">{label}</div>
  </div>
);
