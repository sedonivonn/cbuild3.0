import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { Trophy, Star, Crown, Target, Hand } from "lucide-react";
import { effOverall } from "../data/ballonDor";

// Compute "Best XI" by picking the highest avg-rating user player per slot category.
function pickBestXi(tournamentStats, userXi) {
  if (!userXi || userXi.length === 0) return [];
  return userXi.map((p) => {
    const s = tournamentStats[p.name];
    const avgRating = s && s.matches > 0 ? s.totalRating / s.matches : 6.5;
    return {
      ...p,
      goals: s?.goals || 0,
      assists: s?.assists || 0,
      mom: s?.mom || 0,
      matches: s?.matches || 0,
      avgRating: Math.round(avgRating * 10) / 10,
    };
  });
}

export const TournamentAwards = ({ tournamentStats, userXi, userTeamName, isChampion = false }) => {
  const players = useMemo(() => pickBestXi(tournamentStats, userXi), [tournamentStats, userXi]);

  const goldenBoot = useMemo(() => {
    return [...players].sort((a, b) => b.goals - a.goals || b.assists - a.assists)[0];
  }, [players]);

  const goldenBall = useMemo(() => {
    return [...players].sort((a, b) => b.avgRating - a.avgRating || b.mom - a.mom)[0];
  }, [players]);

  const playmaker = useMemo(() => {
    return [...players].sort((a, b) => b.assists - a.assists || b.goals - a.goals)[0];
  }, [players]);

  const hasAnyStats = players.some((p) => p.matches > 0);

  if (!hasAnyStats) {
    return (
      <div className="glass rounded-2xl p-6 text-center text-white/50 text-sm">
        Henüz turnuva istatistikleri yok.
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
      data-testid="tournament-awards"
    >
      <div className="text-center mb-2">
        <div className="font-mono text-xs tracking-widest text-amber-300">TURNUVA ÖDÜLLERİ</div>
        <h3 className="font-display text-3xl md:text-4xl tracking-tight mt-1">
          {isChampion ? "ŞAMPİYON KADRONUN İSTATİSTİKLERİ" : "KADRONUN İSTATİSTİKLERİ"}
        </h3>
        <div className="text-xs text-white/40 font-mono tracking-wider mt-1">{userTeamName}</div>
      </div>

      {/* Top 3 award cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <AwardCard
          icon={<Target size={22} />}
          label="ALTIN KRAMPON"
          subtitle="EN ÇOK GOL"
          player={goldenBoot}
          metric={`${goldenBoot?.goals || 0} GOL`}
          color="#f5c542"
          testId="golden-boot"
        />
        <AwardCard
          icon={<Crown size={22} />}
          label="ALTIN TOP"
          subtitle="EN İYİ OYUNCU"
          player={goldenBall}
          metric={`${goldenBall?.avgRating?.toFixed(1)} ORT.`}
          color="#7c3aed"
          accent
          testId="golden-ball"
        />
        <AwardCard
          icon={<Hand size={22} />}
          label="OYUN KURUCU"
          subtitle="EN ÇOK ASİST"
          player={playmaker}
          metric={`${playmaker?.assists || 0} ASİST`}
          color="#10b981"
          testId="playmaker"
        />
      </div>

      {/* Best XI table */}
      <div className="glass rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <Star size={16} className="text-amber-300" />
          <span className="font-mono text-xs tracking-widest text-amber-300">TURNUVA EN İYİ 11 (KADRO İSTATİSTİKLERİ)</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-white/45 font-mono text-[10px] tracking-widest border-b border-white/10">
              <tr>
                <th className="text-left py-2 pl-2">POS</th>
                <th className="text-left">OYUNCU</th>
                <th className="text-center">MAÇ</th>
                <th className="text-center">GOL</th>
                <th className="text-center">AST</th>
                <th className="text-center">MOM</th>
                <th className="text-right pr-2">REYTING</th>
              </tr>
            </thead>
            <tbody>
              {players.map((p, i) => {
                const isStar = p === goldenBall;
                return (
                  <tr key={i} className={`border-b border-white/5 ${isStar ? "bg-amber-300/5" : ""}`}>
                    <td className="py-2 pl-2 font-mono text-[10px] text-white/50">{p._slot || p.primary}</td>
                    <td className="text-white">
                      <div className="flex items-center gap-2">
                        <span className="truncate">{p.name}</span>
                        <span className="font-mono text-[10px] text-white/40">{p._season}</span>
                        {isStar && <Crown size={12} className="text-amber-300 shrink-0" />}
                      </div>
                    </td>
                    <td className="text-center text-white/70">{p.matches}</td>
                    <td className="text-center font-semibold text-emerald-300">{p.goals || "—"}</td>
                    <td className="text-center font-semibold text-sky-300">{p.assists || "—"}</td>
                    <td className="text-center text-amber-300">{p.mom || "—"}</td>
                    <td className="text-right pr-2 font-display text-base">
                      <span style={{ color: ratingColor(p.avgRating) }}>{p.avgRating.toFixed(1)}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
};

function ratingColor(r) {
  if (r >= 8.5) return "#a855f7";
  if (r >= 7.5) return "#f5c542";
  if (r >= 6.8) return "#10b981";
  if (r >= 6.0) return "#cbd5e1";
  return "#f87171";
}

const AwardCard = ({ icon, label, subtitle, player, metric, color, accent = false, testId }) => {
  if (!player) return null;
  return (
    <motion.div
      whileHover={{ y: -4 }}
      transition={{ type: "spring", stiffness: 300, damping: 22 }}
      className="glass rounded-2xl p-5 relative overflow-hidden"
      style={{
        background: accent
          ? `linear-gradient(160deg, rgba(20,15,30,0.85) 0%, rgba(80,40,140,0.3) 100%)`
          : `linear-gradient(160deg, rgba(20,20,24,0.85) 0%, rgba(40,30,10,0.4) 100%)`,
      }}
      data-testid={`award-${testId}`}
    >
      <Trophy size={64} className="absolute -top-2 -right-2 opacity-10" style={{ color }} />
      <div className="flex items-center gap-2 mb-2" style={{ color }}>
        {icon}
        <div>
          <div className="font-display text-base tracking-wider leading-none">{label}</div>
          <div className="font-mono text-[9px] tracking-widest text-white/40 mt-0.5">{subtitle}</div>
        </div>
      </div>
      <div className="mt-3 font-display text-xl tracking-tight truncate" title={player.name}>{player.name}</div>
      <div className="text-[11px] font-mono text-white/50 tracking-wider mt-0.5">
        {player._slot || player.primary} · {player._season} · OVR {effOverall(player, player._season)}
      </div>
      <div className="mt-3 inline-block px-3 py-1 rounded-md font-display text-lg" style={{ background: color, color: "black" }}>
        {metric}
      </div>
    </motion.div>
  );
};
