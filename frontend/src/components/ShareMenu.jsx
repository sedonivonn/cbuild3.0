import React, { useRef, useState } from "react";
import { motion } from "framer-motion";
import { Share2, Twitter, Copy, Download, Check, MessageCircle } from "lucide-react";
import { exportNodeToPng, shareImage, copyToClipboard, tweetUrl, whatsappUrl } from "../engine/shareImage";
import { encodeDraft, buildShareUrl } from "../engine/shareCode";

// Renders a "Paylaş" button. When clicked, opens a small popover with:
//   - Export as PNG (auto-download or native share on mobile)
//   - Tweet, WhatsApp, Copy URL
//
// Props:
//   targetRef: React ref pointing to the DOM node to snapshot
//   draft:     { formationId, teamName, xi } — used to build the share URL
//   shareText: optional text to prefix in tweet/whatsapp
//   filename:  PNG filename
export const ShareMenu = ({ targetRef, draft, shareText = "Bu kadromu yenebilir misin?", filename = "draft.png" }) => {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const code = draft ? encodeDraft(draft) : null;
  const shareUrl = code ? buildShareUrl(code) : window.location.href;

  const handleExport = async () => {
    if (!targetRef?.current) return;
    setBusy(true);
    const dataUrl = await exportNodeToPng(targetRef.current);
    setBusy(false);
    if (dataUrl) {
      await shareImage(dataUrl, { title: "UCL Draft", text: shareText, filename });
    }
    setOpen(false);
  };

  const handleCopy = async () => {
    const ok = await copyToClipboard(shareUrl);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  return (
    <div className="relative inline-block" data-testid="share-menu">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="btn-ghost flex items-center gap-2"
        data-testid="share-menu-button"
      >
        <Share2 size={16} className="text-amber-300" />
        PAYLAŞ
      </button>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute right-0 mt-2 w-72 glass rounded-xl p-3 z-50 shadow-2xl border border-white/10"
          data-testid="share-menu-popover"
        >
          <div className="font-mono text-[10px] tracking-widest text-amber-300 mb-2">PAYLAŞIM SEÇENEKLERİ</div>
          <button
            type="button"
            onClick={handleExport}
            disabled={busy}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/10 text-left text-sm transition-colors disabled:opacity-50"
            data-testid="share-export-png-button"
          >
            <Download size={14} className="text-emerald-300" />
            {busy ? "Hazırlanıyor..." : "Görsel olarak indir / paylaş"}
          </button>
          <a
            href={tweetUrl(shareText, shareUrl)}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/10 text-left text-sm transition-colors"
            data-testid="share-twitter-button"
            onClick={() => setOpen(false)}
          >
            <Twitter size={14} className="text-sky-300" />
            Twitter / X&apos;te paylaş
          </a>
          <a
            href={whatsappUrl(shareText, shareUrl)}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/10 text-left text-sm transition-colors"
            data-testid="share-whatsapp-button"
            onClick={() => setOpen(false)}
          >
            <MessageCircle size={14} className="text-emerald-300" />
            WhatsApp&apos;ta paylaş
          </a>
          <button
            type="button"
            onClick={handleCopy}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/10 text-left text-sm transition-colors"
            data-testid="share-copy-link-button"
          >
            {copied ? (
              <>
                <Check size={14} className="text-emerald-300" />
                <span className="text-emerald-300">Kopyalandı!</span>
              </>
            ) : (
              <>
                <Copy size={14} className="text-white/70" />
                Linki kopyala
              </>
            )}
          </button>
        </motion.div>
      )}
    </div>
  );
};
