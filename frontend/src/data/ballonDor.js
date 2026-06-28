// Per-season Ballon d'Or winners. A player is only treated as a Ballon d'Or
// season specifically when their name+season pair appears here. Outside their
// winning season they receive their regular overall rating.
// Season label maps to the spring-end year of the UCL season (e.g. "2009" = 2008/09).
// Ballon d'Or for a calendar year is paired with the season ending in that year.

export const BALLON_DOR_BY_YEAR = {
  1995: ["George Weah"],
  1997: ["Ronaldo"],
  1998: ["Zinedine Zidane"],
  1999: ["Rivaldo"],
  2000: ["Luís Figo"],
  2002: ["Ronaldo"],
  2003: ["Pavel Nedvěd"],
  2004: ["Andriy Shevchenko"],
  2005: ["Ronaldinho"],
  2006: ["Fabio Cannavaro"],
  2007: ["Kakà"],
  2008: ["Cristiano Ronaldo"],
  2009: ["Lionel Messi"],
  2010: ["Lionel Messi"],
  2011: ["Lionel Messi"],
  2012: ["Lionel Messi"],
  2013: ["Cristiano Ronaldo"],
  2014: ["Cristiano Ronaldo"],
  2015: ["Lionel Messi"],
  2016: ["Cristiano Ronaldo"],
  2017: ["Cristiano Ronaldo"],
  2018: ["Luka Modrić"],
  2019: ["Lionel Messi"],
  2021: ["Lionel Messi"],
  2022: ["Karim Benzema"],
  2023: ["Lionel Messi"],
  2024: ["Rodri"],
  2025: ["Ousmane Dembélé"],
};

export function isBallonDorSeason(name, season) {
  if (!name || !season) return false;
  const list = BALLON_DOR_BY_YEAR[Number(season)];
  return !!(list && list.includes(name));
}

// Effective overall — 99 only when this player won the Ballon d'Or in this
// specific season. Otherwise use the player's stored season-specific rating.
export function effOverall(player, season) {
  if (!player) return 0;
  if (isBallonDorSeason(player.name, season)) return 99;
  return player.overall;
}

// Kept for backward compat; treated as career flag — used by share-code parsing only.
export const BALLON_DOR_WINNERS = new Set(
  Object.values(BALLON_DOR_BY_YEAR).flat()
);
export function isBallonDor(name) {
  return BALLON_DOR_WINNERS.has(name);
}
