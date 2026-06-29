#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================

user_problem_statement: "TrophyScreen Yılın Oyuncusu kartında MAÇ değeri 19 görünüyor; UCL turnuva yapısına göre bir oyuncunun oynayabileceği maksimum maç 13 olmalı (6 grup + 2 R16 + 2 QF + 2 SF + 1 Final). Logo (sol üst) biraz daha büyük ve hafif sağa kaydırılmış olmalı."

frontend:
  - task: "Tournament stats: matches counter must cap at 13 (no inflation due to mutation/StrictMode)"
    implemented: true
    working: "NA"
    file: "frontend/src/screens/TournamentScreen.jsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: "Root cause: aggregateMatchStats spread-copied prev but mutated shared player objects. React 18 StrictMode double-invokes updaters; the second invocation reused the already-mutated object, double-counting matches/goals/assists. Combined with ties counted as 1 (not legs), totals were inflated to ~19. Fix: deep-clone each entry per update AND honor p.legs so a 2-leg tie adds 2 matches. Group(6)+R16(2)+QF(2)+SF(2)+F(1)=13 max."

  - task: "AYARLARA DÖN preserves drafted pool (no re-roll)"
    implemented: true
    working: "NA"
    file: "frontend/src/screens/DraftScreen.jsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: "Bug: Clicking 'AYARLARA DÖN' button then coming back re-rolled a new random team every time (unlimited free re-rolls bypassing CHANGE HAKKI). Fix: 1) Back button no longer setPool(null); pool persists. 2) handleRoll: if pool already exists, just transition phase setup->draft without re-rolling. 3) Setup phase shows a new 'DRAFT'A DEVAM ET' button when pool exists, with text 'Aynı takım korunur · yeni zar için CHANGE kullan'. New random team only via CHANGE button (limited 3/3) or initial ROLL DICE."

  - task: "Elimination flow: dramatic ELENDİN screen + SİMÜLASYONU BİTİR button"
    implemented: true
    working: "NA"
    file: "frontend/src/screens/TournamentScreen.jsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: "Bug: When user lost a knockout tie, autoCompleteBracket ran instantly; user dumped straight into the post-tournament screen with no closure. Fix: playR16/QF/SF now set stage='eliminated' and saveState without auto-completing. The 'eliminated' stage renders a centered glass card: skull emoji + 'ELENDİN' + '{stage}'NDE VEDA' + description + 'SİMÜLASYONU BİTİR' button. Brackets are HIDDEN in this stage. Clicking the button runs autoCompleteBracket, moves to 'eliminated_done', revealing full bracket + champion + awards as before."

metadata:
  created_by: "main_agent"
  version: "1.0"
  test_sequence: 2
  run_ui: true

test_plan:
  current_focus:
    - "AYARLARA DÖN preserves drafted pool (no re-roll)"
    - "Elimination flow: dramatic ELENDİN screen + SİMÜLASYONU BİTİR button"
    - "Tournament stats: matches counter must cap at 13 (no inflation due to mutation/StrictMode)"
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
    -agent: "main"
    -message: "Three things to verify on the frontend. Use http://localhost:3000.\n\n(A) AYARLARA DÖN preserves team:\n  1. Click 'YENI DRAFT BAŞLAT'.\n  2. Click 'GEGENPRESS' tactic (button[data-testid=\"tactic-GEGENPRESS\"]).\n  3. Click 'ROLL DICE' (button[data-testid=\"roll-dice-button\"]).\n  4. Wait ~1.5s for spin to finish. Read the season + club shown on the cards (e.g. '2017 Real Madrid'). Capture screenshot 1.\n  5. Click 'AYARLARA DÖN' (button[data-testid=\"back-to-setup-button\"]).\n  6. In setup phase, verify a 'DRAFT'A DEVAM ET' (button[data-testid=\"continue-to-draft-button\"]) appears with text 'Çekildi: <same team>'. The team here MUST match step 4.\n  7. Click that button. Verify we're back in draft view and the same team is shown — NO re-roll. Capture screenshot 2.\n  8. Repeat the round-trip 2 more times — each time the same team must persist. CHANGE HAKKI should remain 3/3.\n  9. Now click 'CHANGE' (the visible CHANGE button next to YIL) — this is the only way a new team should be drawn. Verify a new team is rolled and CHANGE HAKKI decrements to 2/3.\n\n(B) Eliminated screen (best-effort, depends on RNG):\n  1. After a fresh draft, fill all 11 players (click any card from pool, then the matching slot on pitch). Use any random picks.\n  2. Click 'TURNUVAYA BAŞLA'. Play through group matchdays (6x button[data-testid=\"play-matchday-button\"]) until KO stage begins. Then play R16 (button[data-testid=\"play-r16-button\"]).\n  3. If user wins, continue playing QF/SF/Final — at some stage user is statistically likely to lose. On loss, verify:\n     - The eliminated screen appears with: skull emoji, 'ELENDİN' label, '<STAGE>'NDE VEDA' headline, and a 'SİMÜLASYONU BİTİR' button (button[data-testid=\"finish-simulation-button\"]).\n     - No bracket/QF/SF/Final views visible at this stage.\n  4. Click SİMÜLASYONU BİTİR — the full bracket should appear with champion + awards.\n  5. If user wins entire tournament (lucky), test elimination by restarting with weaker random picks. If still not eliminated after 2 tries, mark elimination test as 'NA - unable to reproduce' but verify the code logic exists (check stage='eliminated' branch in TournamentScreen.jsx).\n\n(C) Match count cap:\n  - At the TrophyScreen (if user wins) or in eliminated_done view's TournamentAwards, locate the player-of-tournament 'MAÇ' value. Must be <= 13. If eliminated at R16: <=8; QF: <=10; SF: <=12.\n\nReport per-section pass/fail with screenshots."

