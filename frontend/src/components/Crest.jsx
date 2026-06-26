import React from "react";

export const Crest = ({ code = "FC", size = "md", country = "" }) => {
  const sz = size === "lg" ? "w-12 h-12 text-base" : size === "sm" ? "w-7 h-7 text-[10px]" : "w-9 h-9 text-xs";
  return (
    <div className={`${sz} rounded-md flex items-center justify-center font-display tracking-wider shrink-0`}
         style={{
           background: "linear-gradient(135deg,#15151a 0%,#26262d 100%)",
           border: "1px solid rgba(255,255,255,0.12)",
           color: "#ffffff",
         }}>
      {code}
    </div>
  );
};
