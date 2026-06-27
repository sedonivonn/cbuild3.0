// Career Ballon d'Or winners present (or likely present) in the dataset.
// Players in this set get the special black "ICON" card regardless of overall rating.
// Names must EXACTLY match the player.name value in seasons.js.

export const BALLON_DOR_WINNERS = new Set([
  // 1990s and earlier (those in data)
  "Lothar Matthäus",
  "Jean-Pierre Papin",
  "George Weah",
  "Matthias Sammer",
  "Ronaldo",              // O Fenomeno - 1997, 2002
  "Zinedine Zidane",      // 1998
  "Rivaldo",              // 1999
  "Luís Figo",            // 2000
  "Michael Owen",         // 2001
  "Pavel Nedvěd",         // 2003
  "Andriy Shevchenko",    // 2004
  "Ronaldinho",           // 2005
  "Fabio Cannavaro",      // 2006
  "Kakà",                 // 2007
  "Cristiano Ronaldo",    // 2008, 2013, 2014, 2016, 2017
  "Lionel Messi",         // 2009, 2010, 2011, 2012, 2015, 2019, 2021, 2023
  "Luka Modrić",          // 2018
  "Karim Benzema",        // 2022
  "Rodri",                // 2024
  "Ousmane Dembélé",      // 2025
]);

export function isBallonDor(name) {
  return BALLON_DOR_WINNERS.has(name);
}

// Effective overall — career Ballon d'Or winners always display/play as 99,
// regardless of the season-specific rating stored in seasons.js.
export function effOverall(player) {
  if (!player) return 0;
  if (BALLON_DOR_WINNERS.has(player.name)) return 99;
  return player.overall;
}
