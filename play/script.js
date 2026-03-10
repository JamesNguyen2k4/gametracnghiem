// ========================================
// CẤU HÌNH TRÒ CHƠI
// ========================================
const DEFAULT_ANSWER_TIME = 15;
const DEFAULT_WIN_THRESHOLD = 4;

const pageParams = new URLSearchParams(window.location.search);

const TEAM_A_NAME = pageParams.get("teamAName") || "ĐỘI XANH";
const TEAM_B_NAME = pageParams.get("teamBName") || "ĐỘI ĐỎ";

const ANSWER_TIME = Math.min(
  120,
  Math.max(5, Number(pageParams.get("answerTime")) || DEFAULT_ANSWER_TIME)
);

const WIN_THRESHOLD = Math.min(
  20,
  Math.max(1, Number(pageParams.get("winThreshold")) || DEFAULT_WIN_THRESHOLD)
);

let teamATimer = null;
let teamBTimer = null;
let teamATimeLeft = ANSWER_TIME;
let teamBTimeLeft = ANSWER_TIME;

const SUPABASE_URL = "https://izjtgtgnyedmdzmljbte.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml6anRndGdueWVkbWR6bWxqYnRlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxNTM2MjYsImV4cCI6MjA4ODcyOTYyNn0.b5JgqCSgXvrU8msDvvI85xvf8J5578Z981Bf_F43GiQ";

// Mapping phím cho 2 đội
const KEY_BINDINGS = {
  a: { team: "A", answerIndex: 0 },
  s: { team: "A", answerIndex: 1 },
  d: { team: "A", answerIndex: 2 },
  f: { team: "A", answerIndex: 3 },

  h: { team: "B", answerIndex: 0 },
  j: { team: "B", answerIndex: 1 },
  k: { team: "B", answerIndex: 2 },
  l: { team: "B", answerIndex: 3 }
};

// Hiển thị hint phím trên nút đáp án
const TEAM_KEYS = {
  A: ["A", "S", "D", "F"],
  B: ["H", "J", "K", "L"]
};

let TEAM_A_QUESTIONS = [];
let TEAM_B_QUESTIONS = [];

// ========================================
// STATE
// ========================================
let teamAScore = 0;
let teamBScore = 0;
let teamAIndex = 0;
let teamBIndex = 0;
let gameEnded = false;
let teamAAnswered = false;
let teamBAnswered = false;

const defaultConfig = {
  team_a_name: "ĐỘI XANH",
  team_b_name: "ĐỘI ĐỎ",
  game_title: "🎯 KÉO CO TRẮC NGHIỆM 🎯"
};

// ========================================
// SDK DỰ PHÒNG
// ========================================
function getTimerByTeam(team) {
  return team === "A" ? teamATimer : teamBTimer;
}

function setTimerByTeam(team, timer) {
  if (team === "A") {
    teamATimer = timer;
  } else {
    teamBTimer = timer;
  }
}

function setTimeLeftByTeam(team, value) {
  if (team === "A") {
    teamATimeLeft = value;
  } else {
    teamBTimeLeft = value;
  }
}

function getTimeLeftByTeam(team) {
  return team === "A" ? teamATimeLeft : teamBTimeLeft;
}

function clearTeamTimer(team) {
  const timer = getTimerByTeam(team);
  if (timer) {
    clearInterval(timer);
    setTimerByTeam(team, null);
  }
}

function updateTimerUI(team) {
  const progressEl = document.getElementById(`team${team}Progress`);
  const questions = getQuestionsByTeam(team);
  const index = getCurrentQuestionIndex(team);

  if (!progressEl) return;

  if (!questions.length) {
    progressEl.textContent = "Câu: 0/0";
    return;
  }

  const displayIndex = Math.min(index + 1, questions.length);
  progressEl.textContent = `Câu: ${displayIndex}/${questions.length} • ${getTimeLeftByTeam(team)}s`;
}

function startQuestionTimer(team) {
  clearTeamTimer(team);
  setTimeLeftByTeam(team, ANSWER_TIME);
  updateTimerUI(team);

  const timer = setInterval(() => {
    if (gameEnded || isTeamAnswered(team)) {
      clearTeamTimer(team);
      return;
    }

    const nextValue = getTimeLeftByTeam(team) - 1;
    setTimeLeftByTeam(team, nextValue);
    updateTimerUI(team);

    if (nextValue <= 0) {
      clearTeamTimer(team);
      setAnsweredState(team, true);
      showTeamStatus(team, false);

      setTimeout(() => {
        advanceQuestion(team);
        renderQuestion(team);
      }, 1000);
    }
  }, 1000);

  setTimerByTeam(team, timer);
}
async function initSDK() {
  return;
}

async function supabaseFetch(path, options = {}) {
  const response = await fetch(`${SUPABASE_URL}${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `HTTP ${response.status}`);
  }

  return response;
}

// ========================================
// LOAD DANH SÁCH BỘ CÂU HỎI
// ========================================
async function loadQuizManifest() {
  const select = document.getElementById("quizSelect");
  if (!select) return;

  try {
    const res = await supabaseFetch(
      "/rest/v1/quizzes?select=id,title,slug,description&order=id.asc"
    );

    const quizzes = await res.json();
    select.innerHTML = "";

    if (!Array.isArray(quizzes) || quizzes.length === 0) {
      select.innerHTML = '<option value="">Chưa có bộ câu hỏi nào</option>';
      return;
    }

    quizzes.forEach((quiz) => {
      const option = document.createElement("option");
      option.value = quiz.id;
      option.textContent = quiz.title;
      option.dataset.slug = quiz.slug || "";
      select.appendChild(option);
    });
  } catch (error) {
    console.error("loadQuizManifest error:", error);
    select.innerHTML = '<option value="">Không đọc được danh sách bộ câu hỏi</option>';
  }
}

// ========================================
// CHIA CÂU HỎI CHO 2 ĐỘI
// ========================================
function splitQuestionsForTeams(allQuestions) {
  if (!Array.isArray(allQuestions) || allQuestions.length === 0) {
    TEAM_A_QUESTIONS = [];
    TEAM_B_QUESTIONS = [];
    return;
  }

  const midpoint = Math.ceil(allQuestions.length / 2);
  TEAM_A_QUESTIONS = allQuestions.slice(0, midpoint);
  TEAM_B_QUESTIONS = allQuestions.slice(midpoint);

  if (TEAM_B_QUESTIONS.length === 0) {
    TEAM_B_QUESTIONS = [...TEAM_A_QUESTIONS];
  }
}

// ========================================
// LOAD BỘ CÂU HỎI ĐƯỢC CHỌN
// ========================================
async function loadSelectedQuiz() {
  const select = document.getElementById("quizSelect");
  if (!select) return;

  const quizId = select.value;
  if (!quizId) return;

  try {
    const selectedOption = select.options[select.selectedIndex];
    const quizTitle = selectedOption?.textContent || "Bộ câu hỏi";

    const res = await supabaseFetch(
      `/rest/v1/questions_list?select=id,question,option_a,option_b,option_c,option_d,correct_index,quiz_id&quiz_id=eq.${quizId}&order=id.asc`
    );

    const rows = await res.json();

    if (!Array.isArray(rows) || rows.length === 0) {
      throw new Error("Bộ câu hỏi này chưa có dữ liệu.");
    }

    const normalizedQuestions = rows.map((q, idx) => ({
      id: q.id ?? idx + 1,
      question: q.question ?? "",
      options: [q.option_a, q.option_b, q.option_c, q.option_d],
      correctIndex: Number(q.correct_index)
    }));

    const isInvalid = normalizedQuestions.some(
      (q) =>
        !q.question ||
        !Array.isArray(q.options) ||
        q.options.length !== 4 ||
        q.options.some((opt) => !opt) ||
        Number.isNaN(q.correctIndex) ||
        q.correctIndex < 0 ||
        q.correctIndex > 3
    );

    if (isInvalid) {
      throw new Error("Một hoặc nhiều câu hỏi trong database không đúng định dạng.");
    }

    splitQuestionsForTeams(normalizedQuestions);
    resetGame();

    alert(`Đã tải bộ câu hỏi: ${quizTitle}`);
  } catch (error) {
    console.error("loadSelectedQuiz error:", error);
    alert(`Không thể tải bộ câu hỏi: ${error.message}`);
  }
}

// ========================================
// HÀM PHỤ
// ========================================
function getQuestionsByTeam(team) {
  return team === "A" ? TEAM_A_QUESTIONS : TEAM_B_QUESTIONS;
}

function getCurrentQuestionIndex(team) {
  return team === "A" ? teamAIndex : teamBIndex;
}

function setAnsweredState(team, value) {
  if (team === "A") {
    teamAAnswered = value;
  } else {
    teamBAnswered = value;
  }
}

function isTeamAnswered(team) {
  return team === "A" ? teamAAnswered : teamBAnswered;
}

function incrementTeamScore(team) {
  if (team === "A") {
    teamAScore += 1;
  } else {
    teamBScore += 1;
  }
}

function advanceQuestion(team) {
  if (team === "A") {
    teamAIndex += 1;
    teamAAnswered = false;
  } else {
    teamBIndex += 1;
    teamBAnswered = false;
  }
}

function getAnsweredCount(team) {
  const index = getCurrentQuestionIndex(team);
  const answered = isTeamAnswered(team);
  return index + (answered ? 1 : 0);
}

function getCompletedLeader() {
  const answeredCountA = getAnsweredCount("A");
  const answeredCountB = getAnsweredCount("B");

  const teamACompleted =
    answeredCountA >= TEAM_A_QUESTIONS.length && TEAM_A_QUESTIONS.length > 0;
  const teamBCompleted =
    answeredCountB >= TEAM_B_QUESTIONS.length && TEAM_B_QUESTIONS.length > 0;

  if (teamACompleted && !teamBCompleted && teamAScore > teamBScore) {
    return "A";
  }

  if (teamBCompleted && !teamACompleted && teamBScore > teamAScore) {
    return "B";
  }

  return null;
}

// ========================================
// RENDER CÂU HỎI
// ========================================
function renderQuestion(team) {
  const questions = getQuestionsByTeam(team);
  const index = getCurrentQuestionIndex(team);
  const questionEl = document.getElementById(`team${team}Question`);
  const optionsEl = document.getElementById(`team${team}Options`);
  const progressEl = document.getElementById(`team${team}Progress`);
  const statusEl = document.getElementById(`team${team}Status`);

  if (!questionEl || !optionsEl || !progressEl || !statusEl) return;

  statusEl.style.opacity = "0";
  statusEl.textContent = "";

  if (!questions.length) {
    questionEl.textContent = "Chưa có dữ liệu câu hỏi!";
    optionsEl.innerHTML =
      '<p class="col-span-2 text-center text-white/70">Hãy chọn bộ câu hỏi.</p>';
    progressEl.textContent = "Câu: 0/0";
    return;
  }

  if (index >= questions.length) {
    questionEl.textContent = "Đã hết câu hỏi!";
    optionsEl.innerHTML =
      '<p class="col-span-2 text-center text-white/70">Chờ đội khác...</p>';
    progressEl.textContent = `Câu: ${questions.length}/${questions.length}`;
    return;
  }

  const q = questions[index];
  questionEl.textContent = q.question;
  setTimeLeftByTeam(team, ANSWER_TIME);
  updateTimerUI(team);

  const labels = ["A", "B", "C", "D"];
  const colors =
    team === "A"
      ? [
          "from-blue-400 to-blue-500",
          "from-blue-500 to-blue-600",
          "from-blue-600 to-blue-700",
          "from-blue-700 to-blue-800"
        ]
      : [
          "from-red-400 to-red-500",
          "from-red-500 to-red-600",
          "from-red-600 to-red-700",
          "from-red-700 to-red-800"
        ];

  const keyHints = TEAM_KEYS[team];

  optionsEl.innerHTML = q.options
    .map(
      (opt, i) => `
        <button 
          class="answer-btn bg-gradient-to-r ${colors[i]} text-white font-bold py-3 px-4 rounded-xl shadow-lg border-2 border-white/20 hover:border-white/50 text-sm md:text-base leading-tight"
          data-team="${team}"
          data-index="${i}"
          type="button"
        >
          <span class="key-hint block text-xs md:text-sm mb-1 opacity-90">[${keyHints[i]}]</span>
          <span class="block text-lg font-extrabold mb-1">${labels[i]}</span>
          <span class="block">${opt}</span>
        </button>
      `
    )
    .join("");

  const buttons = optionsEl.querySelectorAll("button");
  buttons.forEach((button) => {
    const selectedIndex = Number(button.dataset.index);
    button.addEventListener("click", () => {
      submitAnswer(team, selectedIndex, "pointer");
    });
  });
  startQuestionTimer(team);
}

// ========================================
// UI FEEDBACK
// ========================================
function updateAnswerUI(team, selectedIndex, correctIndex, isCorrect) {
  const optionsEl = document.getElementById(`team${team}Options`);
  if (!optionsEl) return;

  const buttons = optionsEl.querySelectorAll("button");

  buttons.forEach((btn, i) => {
    btn.disabled = true;

    if (i === selectedIndex) {
      btn.classList.add(isCorrect ? "correct" : "wrong");
    }

    if (i === correctIndex && !isCorrect) {
      setTimeout(() => {
        btn.classList.add("correct");
      }, 350);
    }
  });
}

function showTeamStatus(team, isCorrect) {
  const statusEl = document.getElementById(`team${team}Status`);
  if (!statusEl) return;

  statusEl.textContent = isCorrect ? "✅ ĐÚNG RỒI!" : "❌ SAI RỒI!";
  statusEl.style.opacity = "1";
}

// ========================================
// XỬ LÝ TRẢ LỜI CHUNG
// ========================================
function submitAnswer(team, selectedIndex, source = "unknown") {
  if (gameEnded) return;
  if (isTeamAnswered(team)) return;

  const questions = getQuestionsByTeam(team);
  const index = getCurrentQuestionIndex(team);
  const q = questions[index];

  if (!q) return;
  if (selectedIndex < 0 || selectedIndex > 3) return;

  setAnsweredState(team, true);
  clearTeamTimer(team);
  const isCorrect = selectedIndex === q.correctIndex;

  updateAnswerUI(team, selectedIndex, q.correctIndex, isCorrect);
  showTeamStatus(team, isCorrect);

  if (isCorrect) {
    incrementTeamScore(team);
    triggerPullAnimation(team);
    updateTugOfWar();
  }

  const scoreDiff = Math.abs(teamAScore - teamBScore);

  const answeredCountA = getAnsweredCount("A");
  const answeredCountB = getAnsweredCount("B");

  const allQuestionsFinished =
    answeredCountA >= TEAM_A_QUESTIONS.length &&
    answeredCountB >= TEAM_B_QUESTIONS.length &&
    TEAM_A_QUESTIONS.length > 0 &&
    TEAM_B_QUESTIONS.length > 0;

  const completedLeader = getCompletedLeader();

  if (scoreDiff >= WIN_THRESHOLD) {
    setTimeout(() => {
      showWinner(teamAScore > teamBScore ? "A" : "B");
    }, 900);
    return;
  }

  if (completedLeader) {
    setTimeout(() => {
      showWinner(completedLeader);
    }, 900);
    return;
  }

  if (allQuestionsFinished) {
    setTimeout(() => {
      if (teamAScore > teamBScore) {
        showWinner("A");
      } else if (teamBScore > teamAScore) {
        showWinner("B");
      } else {
        showDraw();
      }
    }, 900);
    return;
  }

  setTimeout(() => {
    advanceQuestion(team);
    renderQuestion(team);
  }, 1600);
}

function handleAnswer(team, selectedIndex) {
  submitAnswer(team, selectedIndex, "legacy");
}

// ========================================
// ANIMATION KÉO CO
// ========================================
function triggerPullAnimation(winningTeam) {
  const teamAPeople = document.getElementById("teamAPeople");
  const teamBPeople = document.getElementById("teamBPeople");
  const ropeSection = document.getElementById("ropeSection");

  if (!teamAPeople || !teamBPeople || !ropeSection) return;

  if (winningTeam === "A") {
    teamAPeople.classList.add("team-a-pulling");
    ropeSection.classList.add("rope-pulling");

    setTimeout(() => {
      teamAPeople.classList.remove("team-a-pulling");
      ropeSection.classList.remove("rope-pulling");
    }, 900);
  } else {
    teamBPeople.classList.add("team-b-pulling");
    ropeSection.classList.add("rope-pulling");

    setTimeout(() => {
      teamBPeople.classList.remove("team-b-pulling");
      ropeSection.classList.remove("rope-pulling");
    }, 900);
  }
}

// ========================================
// CẬP NHẬT GIAO DIỆN KÉO CO
// ========================================
function updateTugOfWar() {
  const scoreDiff = teamAScore - teamBScore;
  const absDiff = Math.abs(scoreDiff);

  document.getElementById("teamAScoreDisplay").textContent = teamAScore;
  document.getElementById("teamBScoreDisplay").textContent = teamBScore;
  document.getElementById("scoreDiff").textContent = absDiff;
  document.getElementById("pullForce").textContent = absDiff;

  const remainingToWin = Math.max(WIN_THRESHOLD - absDiff, 0);
  const winProgressText = document.getElementById("winProgressText");

  if (winProgressText) {
    if (remainingToWin === 0) {
      winProgressText.innerHTML = `Đã đạt mức chênh lệch <strong>${WIN_THRESHOLD}</strong> để thắng`;
    } else {
      winProgressText.innerHTML = `Cần đạt <strong>${WIN_THRESHOLD}</strong> điểm chênh lệch để thắng`;
    }
  }

  const progressFill = document.getElementById("pullProgressFill");
  if (progressFill) {
    const percent = Math.min((absDiff / WIN_THRESHOLD) * 100, 100);
    progressFill.style.width = `${percent}%`;
  }

  const offset = (teamBScore - teamAScore) * 12;

  document.getElementById("teamAPeople").style.transform =
    `translateY(-50%) translateX(${offset}px)`;

  document.getElementById("teamBPeople").style.transform =
    `translateY(-50%) translateX(${offset}px)`;

  document.getElementById("ropeKnot").style.transform =
    `translate(-50%, -50%) translateX(${offset}px)`;
}

// ========================================
// HIỂN THỊ KẾT QUẢ
// ========================================
function showWinner(team) {
  gameEnded = true;

  const overlay = document.getElementById("winnerOverlay");
  const title = document.getElementById("winnerTitle");

  const teamName =
    team === "A" ? TEAM_A_NAME : TEAM_B_NAME;

  title.textContent = teamName;
  title.style.color = team === "A" ? "#3b82f6" : "#ef4444";

  overlay.classList.remove("hidden");
  overlay.classList.add("flex");
}

function showDraw() {
  gameEnded = true;

  const overlay = document.getElementById("winnerOverlay");
  const title = document.getElementById("winnerTitle");

  title.textContent = "HÒA!";
  title.style.color = "#facc15";

  overlay.classList.remove("hidden");
  overlay.classList.add("flex");
}

// ========================================
// RESET
// ========================================
function resetGame() {
  teamAScore = 0;
  teamBScore = 0;
  teamAIndex = 0;
  teamBIndex = 0;
  gameEnded = false;
  teamAAnswered = false;
  teamBAnswered = false;
  clearTeamTimer("A");
  clearTeamTimer("B");
  setTimeLeftByTeam("A", ANSWER_TIME);
  setTimeLeftByTeam("B", ANSWER_TIME);
  const overlay = document.getElementById("winnerOverlay");
  if (overlay) {
    overlay.classList.add("hidden");
    overlay.classList.remove("flex");
  }

  updateTugOfWar();
  renderQuestion("A");
  renderQuestion("B");
}

// ========================================
// KEYBOARD INPUT
// ========================================
function setupKeyboardControls() {
  document.addEventListener("keydown", (event) => {
    const activeTag = document.activeElement?.tagName?.toLowerCase();
    if (activeTag === "input" || activeTag === "textarea" || activeTag === "select") {
      return;
    }

    const key = event.key.toLowerCase();
    const binding = KEY_BINDINGS[key];
    if (!binding) return;

    event.preventDefault();
    submitAnswer(binding.team, binding.answerIndex, "keyboard");
  });
}

// ========================================
// INIT
// ========================================
document.addEventListener("DOMContentLoaded", async () => {
  await initSDK();

  const resetBtn = document.getElementById("resetBtn");
  const loadQuizBtn = document.getElementById("loadQuizBtn");
  const winnerResetBtn = document.getElementById("winnerResetBtn");
  const teamANameEl = document.getElementById("teamAName");
  const teamBNameEl = document.getElementById("teamBName");
  
  if (teamANameEl) {
    teamANameEl.querySelector("span:last-child").textContent = TEAM_A_NAME;
  }
  
  if (teamBNameEl) {
    teamBNameEl.querySelector("span:last-child").textContent = TEAM_B_NAME;
  }
  if (resetBtn) {
    resetBtn.addEventListener("click", resetGame);
  }
  if (winnerResetBtn) {
    winnerResetBtn.addEventListener("click", resetGame);
  }
  if (loadQuizBtn) {
    loadQuizBtn.addEventListener("click", loadSelectedQuiz);
  }

  setupKeyboardControls();
  await loadQuizManifest();

  const backDashboardBtn = document.getElementById("backDashboardBtn");
  if (backDashboardBtn) {
    backDashboardBtn.addEventListener("click", () => {
      window.location.href = "../dashboard/index.html";
    });
  }

  const quizSelect = document.getElementById("quizSelect");
  if (quizSelect && quizSelect.value) {
    await loadSelectedQuiz();
  } else {
    resetGame();
  }
});