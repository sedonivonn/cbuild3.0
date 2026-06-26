import { SEASONS } from "../data/seasons";

const ALL_SEASONS = Object.keys(SEASONS).map(Number).sort((a, b) => a - b);

// Strong teams set - used for "lucky change" mechanic (1 of 3 has boosted strong odds)
const STRONG_TEAMS = new Set([
  "2009-Barcelona", "2011-Barcelona", "2015-Barcelona",
  "2008-Manchester United", "1999-Manchester United",
  "2003-AC Milan", "2007-AC Milan", "2005-AC Milan",
  "2014-Real Madrid", "2016-Real Madrid", "2017-Real Madrid",
  "2018-Real Madrid", "2022-Real Madrid", "2024-Real Madrid",
  "2013-Bayern Munich", "2020-Bayern Munich", "2010-Inter",
  "2019-Liverpool", "2002-Real Madrid", "2003-Juventus",
  "2025-Paris Saint-Germain", "2023-Manchester City", "2018-Liverpool",
]);

function rngSeason() {
  return ALL_SEASONS[Math.floor(Math.random() * ALL_SEASONS.length)];
}

function rngTeam(season) {
  const list = SEASONS[season];
  return list[Math.floor(Math.random() * list.length)];
}

// Standard random pick
export function rollRandom() {
  const season = rngSeason();
  const team = rngTeam(season);
  return { season, team };
}

// Roll with boosted strong-team odds (for 1 of the 3 changes)
export function rollLucky() {
  // 65% chance of strong team, 35% normal random
  if (Math.random() < 0.65) {
    const strongList = [...STRONG_TEAMS];
    const pick = strongList[Math.floor(Math.random() * strongList.length)];
    const [seasonStr, ...clubParts] = pick.split("-");
    const season = Number(seasonStr);
    const club = clubParts.join("-");
    const team = (SEASONS[season] || []).find((t) => t.club === club);
    if (team) return { season, team };
  }
  return rollRandom();
}

// Group draw: 8 groups of 4 (32 teams). User's team is placed deterministically in Group A pot 1.
export function drawGroups(teams) {
  // teams: array of 32 team-references (mix of champions + user team).
  // Simple Champions-League-like seeding: by baseOverall.
  const sorted = [...teams].sort((a, b) => (b.baseOverall || b.overall || 80) - (a.baseOverall || a.overall || 80));
  const pots = [sorted.slice(0, 8), sorted.slice(8, 16), sorted.slice(16, 24), sorted.slice(24, 32)];
  // Shuffle inside each pot for variety
  pots.forEach((pot) => pot.sort(() => Math.random() - 0.5));
  // Ensure user team in Group A (pot 1)
  const groups = Array.from({ length: 8 }, () => []);
  for (let p = 0; p < 4; p++) {
    for (let g = 0; g < 8; g++) {
      groups[g].push(pots[p][g]);
    }
  }
  return groups;
}

// Generate 6 matchdays (double round-robin within each group)
export function generateGroupFixtures(groups) {
  // Each group: 4 teams play 6 matches (3 home, 3 away). Simple round-robin.
  const fixturesByGroup = groups.map((group, gi) => {
    const [A, B, C, D] = group;
    return [
      [{ home: A, away: B }, { home: C, away: D }], // MD1
      [{ home: A, away: C }, { home: D, away: B }], // MD2
      [{ home: A, away: D }, { home: B, away: C }], // MD3
      [{ home: B, away: A }, { home: D, away: C }], // MD4
      [{ home: C, away: A }, { home: B, away: D }], // MD5
      [{ home: D, away: A }, { home: C, away: B }], // MD6
    ];
  });
  return fixturesByGroup;
}
