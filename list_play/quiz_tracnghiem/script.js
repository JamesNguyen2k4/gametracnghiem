let questions = [];
let currentIndex = 0;
let score = 0;
let answered = false;
let currentQuizTitle = "";

const refs = {
  backDashboardBtn: document.getElementById("backDashboardBtn"),
  quizSelect: document.getElementById("quizSelect"),
  loadQuizBtn: document.getElementById("loadQuizBtn"),
  startQuizBtn: document.getElementById("startQuizBtn"),
  totalQuestionText: document.getElementById("totalQuestionText"),
  scoreText: document.getElementById("scoreText"),
  progressText: document.getElementById("progressText"),
  progressBarFill: document.getElementById("progressBarFill"),
  messageText: document.getElementById("messageText"),
  emptyState: document.getElementById("emptyState"),
  quizScreen: document.getElementById("quizScreen"),
  resultScreen: document.getElementById("resultScreen"),
  questionIndexText: document.getElementById("questionIndexText"),
  questionText: document.getElementById("questionText"),
  optionsContainer: document.getElementById("optionsContainer"),
  feedbackBox: document.getElementById("feedbackBox"),
  feedbackText: document.getElementById("feedbackText"),
  nextBtn: document.getElementById("nextBtn"),
  restartBtn: document.getElementById("restartBtn"),
  playAgainBtn: document.getElementById("playAgainBtn"),
  resultEmoji: document.getElementById("resultEmoji"),
  resultScore: document.getElementById("resultScore"),
  resultMessage: document.getElementById("resultMessage"),
  correctSound: document.getElementById("correctSound"),
  wrongSound: document.getElementById("wrongSound"),
};

function setMessage(text, isError = false) {
  refs.messageText.textContent = text || "";
  refs.messageText.style.color = isError ? "#be123c" : "#9a3412";
}

async function getAccessToken() {
  const {
    data: { session },
    error,
  } = await window.supabaseClient.auth.getSession();

  if (error) throw error;
  if (!session?.access_token) {
    throw new Error("Không tìm thấy phiên đăng nhập. Vui lòng đăng nhập lại.");
  }

  return session.access_token;
}

async function supabaseFetch(path, options = {}) {
  const accessToken = await getAccessToken();

  const response = await fetch(`${SUPABASE_URL}${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `HTTP ${response.status}`);
  }

  return response;
}

function goBackDashboard() {
  window.location.href = "../../dashboard/index.html";
}

function resetQuizState() {
  currentIndex = 0;
  score = 0;
  answered = false;

  refs.scoreText.textContent = "0";
  refs.progressText.textContent = `0 / ${questions.length}`;
  refs.progressBarFill.style.width = "0%";

  refs.feedbackBox.classList.add("hidden");
  refs.nextBtn.classList.add("hidden");
  refs.restartBtn.classList.add("hidden");
  refs.resultScreen.classList.add("hidden");
}

function updateStats() {
  refs.totalQuestionText.textContent = String(questions.length);
  refs.scoreText.textContent = String(score);

  const answeredCount = Math.min(currentIndex, questions.length);
  refs.progressText.textContent = `${answeredCount} / ${questions.length}`;

  const percent = questions.length
    ? (answeredCount / questions.length) * 100
    : 0;

  refs.progressBarFill.style.width = `${percent}%`;
}

function showQuizScreen() {
  refs.emptyState.classList.add("hidden");
  refs.resultScreen.classList.add("hidden");
  refs.quizScreen.classList.remove("hidden");
}

function showEmptyState() {
  refs.quizScreen.classList.add("hidden");
  refs.resultScreen.classList.add("hidden");
  refs.emptyState.classList.remove("hidden");
}

function showResultScreen() {
  refs.quizScreen.classList.add("hidden");
  refs.emptyState.classList.add("hidden");
  refs.resultScreen.classList.remove("hidden");

  refs.resultScore.textContent = `${score} / ${questions.length}`;

  const ratio = questions.length ? score / questions.length : 0;

  if (ratio === 1) {
    refs.resultEmoji.textContent = "🏆";
    refs.resultMessage.textContent = "Xuất sắc! Bạn trả lời đúng toàn bộ.";
  } else if (ratio >= 0.7) {
    refs.resultEmoji.textContent = "🎉";
    refs.resultMessage.textContent = "Rất tốt! Bạn đã nắm bài khá chắc.";
  } else if (ratio >= 0.4) {
    refs.resultEmoji.textContent = "😊";
    refs.resultMessage.textContent = "Ổn rồi, chỉ cần luyện thêm một chút nữa.";
  } else {
    refs.resultEmoji.textContent = "💪";
    refs.resultMessage.textContent = "Cố gắng thêm nhé, bạn có thể làm tốt hơn.";
  }

  refs.progressText.textContent = `${questions.length} / ${questions.length}`;
  refs.progressBarFill.style.width = "100%";
}

function renderQuestion() {
  if (!questions.length || currentIndex >= questions.length) {
    showResultScreen();
    return;
  }

  const currentQuestion = questions[currentIndex];
  answered = false;

  showQuizScreen();
  refs.feedbackBox.classList.add("hidden");
  refs.nextBtn.classList.add("hidden");
  refs.restartBtn.classList.add("hidden");

  refs.questionIndexText.textContent = `Câu ${currentIndex + 1} / ${questions.length}`;
  refs.questionText.textContent = currentQuestion.question;
  refs.optionsContainer.innerHTML = "";

  currentQuestion.options.forEach((optionText, optionIndex) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "option-btn";
    button.textContent = optionText;
    button.addEventListener("click", () => selectAnswer(optionIndex));
    refs.optionsContainer.appendChild(button);
  });

  refs.progressText.textContent = `${currentIndex} / ${questions.length}`;
  const percent = questions.length ? (currentIndex / questions.length) * 100 : 0;
  refs.progressBarFill.style.width = `${percent}%`;
}

function playAudio(audioEl) {
  if (!audioEl) return;

  audioEl.currentTime = 0;
  audioEl.play().catch((error) => {
    console.warn("Không phát được âm thanh:", error);
  });
}

function selectAnswer(selectedIndex) {
  if (answered) return;
  answered = true;

  const currentQuestion = questions[currentIndex];
  const buttons = refs.optionsContainer.querySelectorAll(".option-btn");
  const correctIndex = currentQuestion.correctIndex;

  buttons.forEach((button) => {
    button.disabled = true;
  });

  if (selectedIndex === correctIndex) {
    score += 1;
    buttons[selectedIndex]?.classList.add("correct");
    refs.feedbackText.textContent = "✅ Chính xác!";
    refs.feedbackText.style.color = "#166534";
    playAudio(refs.correctSound);
  } else {
    buttons[selectedIndex]?.classList.add("wrong");
    buttons[correctIndex]?.classList.add("correct");
    refs.feedbackText.textContent = "❌ Sai rồi!";
    refs.feedbackText.style.color = "#991b1b";
    playAudio(refs.wrongSound);
  }

  refs.feedbackBox.classList.remove("hidden");
  refs.scoreText.textContent = String(score);

  if (currentIndex < questions.length - 1) {
    refs.nextBtn.textContent = "Câu tiếp theo →";
    refs.nextBtn.classList.remove("hidden");
  } else {
    refs.nextBtn.textContent = "Xem kết quả 🏆";
    refs.nextBtn.classList.remove("hidden");
  }
}

function goNextQuestion() {
  currentIndex += 1;

  if (currentIndex >= questions.length) {
    showResultScreen();
    return;
  }

  renderQuestion();
}

function startQuiz() {
  if (!questions.length) {
    setMessage("Bạn cần tải bộ câu hỏi trước.", true);
    return;
  }

  resetQuizState();
  setMessage(`Đã bắt đầu: ${currentQuizTitle}`);
  renderQuestion();
}

function restartQuiz() {
  if (!questions.length) return;
  resetQuizState();
  renderQuestion();
}

async function loadQuizManifest() {
  try {
    const user = await requireAuthOrRedirect();
    if (!user) return;

    const res = await supabaseFetch(
      `/rest/v1/quizzes?select=id,title,slug,description,user_id&user_id=eq.${user.id}&order=id.asc`
    );

    const quizzes = await res.json();
    refs.quizSelect.innerHTML = "";

    if (!Array.isArray(quizzes) || quizzes.length === 0) {
      refs.quizSelect.innerHTML = `<option value="">Bạn chưa có bộ câu hỏi nào</option>`;
      refs.startQuizBtn.disabled = true;
      setMessage("Bạn chưa có bộ câu hỏi nào trong database.", true);
      return;
    }

    quizzes.forEach((quiz) => {
      const option = document.createElement("option");
      option.value = quiz.id;
      option.textContent = quiz.title;
      option.dataset.slug = quiz.slug || "";
      refs.quizSelect.appendChild(option);
    });

    setMessage("Đã tải danh sách bộ câu hỏi.");
  } catch (error) {
    console.error("loadQuizManifest error:", error);
    refs.quizSelect.innerHTML = `<option value="">Không đọc được danh sách bộ câu hỏi</option>`;
    setMessage(error.message || "Không đọc được danh sách bộ câu hỏi.", true);
  }
}

async function loadSelectedQuiz() {
  const quizId = refs.quizSelect.value;

  if (!quizId) {
    setMessage("Vui lòng chọn bộ câu hỏi.", true);
    return;
  }

  try {
    const user = await requireAuthOrRedirect();
    if (!user) return;

    setMessage("Đang tải bộ câu hỏi...");

    const selectedOption = refs.quizSelect.options[refs.quizSelect.selectedIndex];
    currentQuizTitle = selectedOption?.textContent || "Bộ câu hỏi";

    const quizCheckRes = await supabaseFetch(
      `/rest/v1/quizzes?select=id,user_id,title&user_id=eq.${user.id}&id=eq.${quizId}&limit=1`
    );
    const quizCheckData = await quizCheckRes.json();

    if (!Array.isArray(quizCheckData) || quizCheckData.length === 0) {
      throw new Error("Bạn không có quyền truy cập bộ câu hỏi này.");
    }

    const res = await supabaseFetch(
      `/rest/v1/questions_list?select=id,question,option_a,option_b,option_c,option_d,correct_index,quiz_id&quiz_id=eq.${quizId}&order=id.asc`
    );
    const rows = await res.json();

    if (!Array.isArray(rows) || rows.length === 0) {
      throw new Error("Bộ câu hỏi này chưa có dữ liệu.");
    }

    const normalizedQuestions = rows.map((row, index) => ({
      id: row.id ?? index + 1,
      question: row.question ?? "",
      options: [row.option_a, row.option_b, row.option_c, row.option_d],
      correctIndex: Number(row.correct_index),
    }));

    const hasInvalidQuestion = normalizedQuestions.some((q) => {
      return (
        !q.question ||
        !Array.isArray(q.options) ||
        q.options.length !== 4 ||
        q.options.some((opt) => !opt) ||
        Number.isNaN(q.correctIndex) ||
        q.correctIndex < 0 ||
        q.correctIndex > 3
      );
    });

    if (hasInvalidQuestion) {
      throw new Error("Một hoặc nhiều câu hỏi trong database không đúng định dạng.");
    }

    questions = normalizedQuestions;
    resetQuizState();
    updateStats();
    refs.startQuizBtn.disabled = false;
    showEmptyState();

    setMessage(`Đã tải bộ câu hỏi: ${currentQuizTitle}`);
  } catch (error) {
    console.error("loadSelectedQuiz error:", error);
    questions = [];
    currentQuizTitle = "";
    refs.startQuizBtn.disabled = true;
    updateStats();
    showEmptyState();
    setMessage(error.message || "Không thể tải bộ câu hỏi.", true);
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  await requireAuthOrRedirect();

  refs.backDashboardBtn?.addEventListener("click", goBackDashboard);
  refs.loadQuizBtn?.addEventListener("click", loadSelectedQuiz);
  refs.startQuizBtn?.addEventListener("click", startQuiz);
  refs.nextBtn?.addEventListener("click", goNextQuestion);
  refs.restartBtn?.addEventListener("click", restartQuiz);
  refs.playAgainBtn?.addEventListener("click", restartQuiz);

  updateStats();
  showEmptyState();
  await loadQuizManifest();
});