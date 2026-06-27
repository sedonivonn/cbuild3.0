// Dynamic tactic analysis: produces an array of {sign:'+'|'-', text} bullets
// based on the user's actual XI stats and the selected tactic.
// Replaces the static "+/- list" with insight that adapts to the squad.

export function analyzeTactic(teamStats, tacticId) {
  if (!teamStats) return [];
  const { overall, keeper, defense, midfield, attack } = teamStats;
  const out = [];

  // Helpers
  const plus = (text) => out.push({ sign: "+", text });
  const minus = (text) => out.push({ sign: "-", text });

  // Common XI insights
  if (keeper >= 90) plus(`Dünya klası kaleci (${keeper}) — kritik kurtarışlar`);
  else if (keeper >= 85) plus(`Üst düzey kaleci (${keeper})`);
  else if (keeper < 78) minus(`Kaleci formu zayıf (${keeper}) — kontratak riski`);

  if (defense >= 88) plus(`Çelik savunma hattı (${defense}) — zor gol yer`);
  else if (defense >= 83) plus(`Sağlam defans (${defense})`);
  else if (defense < 78) minus(`Defans hattı kırılgan (${defense})`);

  if (midfield >= 88) plus(`Üst düzey orta saha (${midfield}) — top kontrolü`);
  else if (midfield >= 83) plus(`Disiplinli orta saha (${midfield})`);
  else if (midfield < 78) minus(`Orta saha kontrolü zayıf (${midfield})`);

  if (attack >= 90) plus(`Yıldız hücum (${attack}) — gol garantisi`);
  else if (attack >= 85) plus(`Güçlü hücum (${attack})`);
  else if (attack < 78) minus(`Hücumda etkisizlik riski (${attack})`);

  // Balance
  const lineDiff = Math.abs(attack - defense);
  if (lineDiff > 8 && attack > defense) minus("Dengesiz takım: hücum > savunma — kontrataklara açık");
  if (lineDiff > 8 && defense > attack) minus("Dengesiz takım: savunma > hücum — pozisyon üretimi zor");

  // Tactic-specific overlays
  switch (tacticId) {
    case "GEGENPRESS": {
      if (attack >= 86) plus("GEGENPRESS hücumu zirveye çıkarır (+6 hücum)");
      if (midfield >= 85) plus("Yoğun pres orta sahanı %25 daha aktif kılar");
      if (defense < 82) minus("Yüksek savunma hattı zayıf defansla risk taşır (-3 def)");
      if (keeper < 82) minus("Kaleci form düşükse direkt kontratak golü gelir");
      plus("Tempo 1.25× — daha çok pozisyon, daha çok gol");
      break;
    }
    case "TIKI_TAKA": {
      if (midfield >= 86) plus("TIKI-TAKA orta saha ustalığını maksimize eder (+6 ort)");
      if (attack >= 85) plus("Yaratıcı paslar hücumu besler (+3 hüc)");
      plus("Topa sahip olma > %60 hedefi");
      if (defense < 80) minus("Yüksek top oyunu savunma boşluğunda kalabilir");
      if (overall < 84) minus("Düşük genel kalitede paslaşma zinciri kopabilir");
      break;
    }
    case "PARK_THE_BUS": {
      if (defense >= 86) plus("PARK THE BUS çelik savunmana güç katar (+7 def)");
      if (keeper >= 85) plus("Kalecinin formu beraberlikleri kazanca dönüştürür (+2 klc)");
      if (attack < 82) minus("Hücum gücü zaten düşük — gol bulmak çok zor (-3 hüc)");
      if (midfield < 80) minus("Top kazanılınca oyun kuracak kalite eksik");
      plus("Tempo 0.8× — risk -40%, az gol yeme avantajı");
      break;
    }
    default:
      break;
  }

  return out;
}
