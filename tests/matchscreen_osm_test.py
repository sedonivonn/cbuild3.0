# OSM-style MatchScreen redesign — regression + smoke test for iteration 24.
# This test seeds localStorage with a completed draft (Ajax 1995 XI, 4-3-3, tiki_taka)
# so we can land directly on the TournamentScreen and open the user's match modal
# without having to click through the full dice/place draft flow.
#
# Run manually with Playwright's async API (mcp_browser_automation performs this).
# Keeping the seeded fixture + assertions here for future regression re-runs.

import json

SAVE_KEY = "ucl_draft_save_v1"

AJAX_XI = [
    {"name":"Edwin van der Sar","primary":"GK","secondary":"GK","overall":90,"nationality":"🇳🇱","_season":1995,"_club":"Ajax","_crest":"AJX","_country":"🇳🇱","_slot":"GK"},
    {"name":"Winston Bogarde","primary":"CB","secondary":"LB","overall":80,"nationality":"🇳🇱","_season":1995,"_club":"Ajax","_crest":"AJX","_country":"🇳🇱","_slot":"LB"},
    {"name":"Frank Rijkaard","primary":"CB","secondary":"CDM","overall":88,"nationality":"🇳🇱","_season":1995,"_club":"Ajax","_crest":"AJX","_country":"🇳🇱","_slot":"CB"},
    {"name":"Danny Blind","primary":"CB","secondary":"CB","overall":85,"nationality":"🇳🇱","_season":1995,"_club":"Ajax","_crest":"AJX","_country":"🇳🇱","_slot":"CB"},
    {"name":"Michael Reiziger","primary":"RB","secondary":"CB","overall":84,"nationality":"🇳🇱","_season":1995,"_club":"Ajax","_crest":"AJX","_country":"🇳🇱","_slot":"RB"},
    {"name":"Ronald de Boer","primary":"CM","secondary":"CAM","overall":85,"nationality":"🇳🇱","_season":1995,"_club":"Ajax","_crest":"AJX","_country":"🇳🇱","_slot":"CM"},
    {"name":"Edgar Davids","primary":"CM","secondary":"CDM","overall":87,"nationality":"🇳🇱","_season":1995,"_club":"Ajax","_crest":"AJX","_country":"🇳🇱","_slot":"CM"},
    {"name":"Clarence Seedorf","primary":"CM","secondary":"CAM","overall":86,"nationality":"🇳🇱","_season":1995,"_club":"Ajax","_crest":"AJX","_country":"🇳🇱","_slot":"CM"},
    {"name":"Marc Overmars","primary":"LW","secondary":"LM","overall":87,"nationality":"🇳🇱","_season":1995,"_club":"Ajax","_crest":"AJX","_country":"🇳🇱","_slot":"LW"},
    {"name":"Patrick Kluivert","primary":"ST","secondary":"CF","overall":86,"nationality":"🇳🇱","_season":1995,"_club":"Ajax","_crest":"AJX","_country":"🇳🇱","_slot":"ST"},
    {"name":"Finidi George","primary":"RW","secondary":"RM","overall":83,"nationality":"🇳🇬","_season":1995,"_club":"Ajax","_crest":"AJX","_country":"🇳🇱","_slot":"RW"},
]

SEED_SAVE = {
    "screen":"tournament","teamName":"TEST AJAX","formationId":"4-3-3",
    "xi": AJAX_XI,
    "changes":{"remaining":0,"luckyRemaining":0},
    "tactic":"tiki_taka","tournament":None,"tournamentMode":"group",
}

# Assertions verified live in iteration_24 (see /app/test_reports/iteration_24.json):
# 1. HomeScreen: online-button absent, start-draft-button + start-draft-league-button present.
# 2. After seed + reload, play-matchday-button on TournamentScreen opens match-modal in prematch phase.
# 3. prematch-lineups renders lineup-list-left and lineup-list-right, each with 11 <li>.
# 4. start-match-button visible with text "MAÇI BAŞLAT →". Two mini-pitches with 11 dots each.
# 5. scoreboard + event-ticker are NOT rendered while phase==prematch.
# 6. After clicking start-match-button, scoreboard + event-ticker appear.
# 7. During NORMAL sim: shot-anim-goal AND shot-anim-save overlays observed at least once.
# 8. In ULTRA mode: shot animations are skipped and match completes rapidly.
# 9. Group-stage MD ends with close-match-button (user-result only shown at knockout).
