import React, { useState } from "react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Pitch } from "../components/Pitch";
import { PlayerCard } from "../components/PlayerCard";
import { Share2, Check } from "lucide-react";
import { encodeDraft, buildShareUrl } from "../engine/shareCode";
import { sound } from "../engine/sounds";

const Stat = ({ label, v, color }) => (
  <div className="rounded-md py-2 bg-white/5 text-center">
    <div className="text-[9px] text-white/50 tracking-widest">{label}</div>
    <div className="font-display text-2xl" style={{ color: color || "#fff" }}>{v || 0}</div>
  </div>
);

export const ConfirmScreen = ({ formationId, xi, teamStats, teamName, onBack, onContinue }) => {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const handleShare = () => {
    const code = encodeDraft({ formationId, teamName, xi });
    const url = buildShareUrl(code);
    if (!url) return;
    try {
      navigator.clipboard.writeText(url);
      sound.click();
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch (_) {
      window.prompt(t("confirm.copyPrompt"), url);
    }
  };
  return (
    <div className="px-5 md:px-10 py-8 max-w-7xl mx-auto">
      <div className="flex items-end justify-between flex-wrap gap-4 mb-6">
        <div>
          <div className="font-mono text-xs text-amber-300 tracking-widest mb-1">{t("confirm.breadcrumb")}</div>
          <h2 className="font-display text-4xl md:text-5xl tracking-tight">{t("confirm.title")}</h2>
          <div className="text-white/60 text-sm mt-1">{t("confirm.subtitle", { team: teamName || t("common.draftTeam") })}</div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button type="button" onClick={handleShare} className="btn-ghost flex items-center gap-2" data-testid="share-draft-button">
            {copied ? <><Check size={14} /> {t("confirm.copied")}</> : <><Share2 size={14} /> {t("confirm.share")}</>}
          </button>
          <button type="button" onClick={onBack} className="btn-ghost" data-testid="confirm-back-button">{t("confirm.backToDraft")}</button>
          <button type="button" onClick={onContinue} className="btn-primary" data-testid="confirm-continue-button">{t("confirm.continueToTactic")}</button>
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-6">
        {/* Pitch summary */}
        <div className="lg:col-span-5 glass rounded-2xl p-5">
          <div className="text-xs text-white/60 mb-3 font-mono tracking-widest">{t("confirm.squadHeader")} · {formationId}</div>
          <Pitch formationId={formationId} xi={xi} readOnly compact />
          <div className="grid grid-cols-5 gap-2 mt-5">
            <Stat label={t("common.ovr")} v={teamStats?.overall} color="#FFD700" />
            <Stat label={t("common.keeperShort")} v={teamStats?.keeper} />
            <Stat label={t("common.defenseShort")} v={teamStats?.defense} />
            <Stat label={t("common.midfieldShort")} v={teamStats?.midfield} />
            <Stat label={t("common.attackShort")} v={teamStats?.attack} />
          </div>
        </div>

        {/* Players grid */}
        <div className="lg:col-span-7 glass rounded-2xl p-5">
          <div className="text-xs text-white/60 mb-3 font-mono tracking-widest">{t("confirm.playersHeader")}</div>
          <motion.div className="grid grid-cols-3 sm:grid-cols-4 gap-3"
            initial="hidden" animate="show"
            variants={{ hidden: {}, show: { transition: { staggerChildren: 0.05 } } }}>
            {xi.map((p, idx) =>
              p ? (
                <motion.div key={idx} variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }}>
                  <PlayerCard
                    player={p}
                    season={p._season}
                    club={p._club}
                    crest={p._crest}
                    country={p._country}
                    size="sm"
                    testId={`confirm-player-${idx}`}
                  />
                </motion.div>
              ) : null
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
};
