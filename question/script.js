let parsedQuiz = null;
let currentUser = null;
let allQuizzes = [];
let filteredQuizzes = [];
let currentQuiz = null;
let currentQuestions = [];
let editingQuestionId = null;
let deletingQuestionId = null;

const refs = {
  // top actions
  backDashboardBtn: document.getElementById("backDashboardBtn"),
  createNewQuizBtn: document.getElementById("createNewQuizBtn"),

  // sidebar
  quizSearchInput: document.getElementById("quizSearchInput"),
  quizList: document.getElementById("quizList"),

  // quiz meta
  quizTitle: document.getElementById("quizTitle"),
  quizDescription: document.getElementById("quizDescription"),
  saveQuizMetaBtn: document.getElementById("saveQuizMetaBtn"),
  deleteQuizBtn: document.getElementById("deleteQuizBtn"),

  // question list
  questionList: document.getElementById("questionList"),
  addQuestionBtn: document.getElementById("addQuestionBtn"),

  // import txt
  message: document.getElementById("message"),
  // create quiz modal
  createQuizModalOverlay: document.getElementById("createQuizModalOverlay"),
  closeCreateQuizModalBtn: document.getElementById("closeCreateQuizModalBtn"),
  createQuizTitle: document.getElementById("createQuizTitle"),
  createQuizDescription: document.getElementById("createQuizDescription"),
  createQuizRawInput: document.getElementById("createQuizRawInput"),
  createQuizMessage: document.getElementById("createQuizMessage"),
  parseCreateQuizBtn: document.getElementById("parseCreateQuizBtn"),
  saveCreateQuizBtn: document.getElementById("saveCreateQuizBtn"),
  // question modal
  questionModalOverlay: document.getElementById("questionModalOverlay"),
  questionModalTitle: document.getElementById("questionModalTitle"),
  closeQuestionModalBtn: document.getElementById("closeQuestionModalBtn"),
  cancelQuestionModalBtn: document.getElementById("cancelQuestionModalBtn"),
  saveQuestionBtn: document.getElementById("saveQuestionBtn"),
  modalQuestionText: document.getElementById("modalQuestionText"),
  modalOptionA: document.getElementById("modalOptionA"),
  modalOptionB: document.getElementById("modalOptionB"),
  modalOptionC: document.getElementById("modalOptionC"),
  modalOptionD: document.getElementById("modalOptionD"),
  modalCorrectAnswer: document.getElementById("modalCorrectAnswer"),

  // delete quiz modal
  deleteQuizModalOverlay: document.getElementById("deleteQuizModalOverlay"),
  closeDeleteQuizModalBtn: document.getElementById("closeDeleteQuizModalBtn"),
  cancelDeleteQuizBtn: document.getElementById("cancelDeleteQuizBtn"),
  confirmDeleteQuizBtn: document.getElementById("confirmDeleteQuizBtn"),

  // delete question modal
  deleteQuestionModalOverlay: document.getElementById("deleteQuestionModalOverlay"),
  closeDeleteQuestionModalBtn: document.getElementById("closeDeleteQuestionModalBtn"),
  cancelDeleteQuestionBtn: document.getElementById("cancelDeleteQuestionBtn"),
  confirmDeleteQuestionBtn: document.getElementById("confirmDeleteQuestionBtn"),
};

function setMessage(text, type = "normal") {
  if (!refs.message) return;
  refs.message.textContent = text || "";
  refs.message.classList.remove("error", "success");

  if (type === "error") refs.message.classList.add("error");
  if (type === "success") refs.message.classList.add("success");
}
function setCreateQuizMessage(text, type = "normal") {
  if (!refs.createQuizMessage) return;
  refs.createQuizMessage.textContent = text || "";
  refs.createQuizMessage.classList.remove("error", "success");

  if (type === "error") refs.createQuizMessage.classList.add("error");
  if (type === "success") refs.createQuizMessage.classList.add("success");
}
async function requireAuth() {
  if (!window.supabaseClient) {
    throw new Error("Thiếu supabaseClient. Hãy nạp shared/supabase.js trước.");
  }

  const {
    data: { session },
    error,
  } = await window.supabaseClient.auth.getSession();

  if (error) throw error;

  if (!session?.user) {
    window.location.href = "../login/index.html";
    return null;
  }

  return session.user;
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
async function handleSaveCreateQuiz() {
  try {
    const user = await requireAuth();
    if (!user) return;

    if (!parsedQuiz) {
      parsedQuiz = buildQuizObjectFromCreateModal();
    }

    setCreateQuizMessage("Đang lưu bộ câu hỏi lên Supabase...");

    const savedQuiz = await upsertQuiz(parsedQuiz.meta, user.id);

    await deleteOldQuestionsByQuizId(savedQuiz.id);
    await insertQuestions(savedQuiz, parsedQuiz.questions);

    closeCreateQuizModal();

    await loadQuizList();
    await selectQuiz(savedQuiz.id);

    setMessage(
      `Đã tạo thành công bộ câu hỏi "${savedQuiz.title}" với ${parsedQuiz.questions.length} câu.`,
      "success"
    );
  } catch (error) {
    console.error("handleSaveCreateQuiz error:", error);
    setCreateQuizMessage(`Lưu thất bại: ${error.message}`, "error");
  }
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

function slugify(name) {
  let value = String(name || "").trim().toLowerCase();

  value = value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  value = value.replace(/đ/g, "d").replace(/Đ/g, "d");
  value = value.replace(/[^a-z0-9\s\-_]/g, "");
  value = value.replace(/\s+/g, "-");
  value = value.replace(/-+/g, "-");
  value = value.replace(/^-+|-+$/g, "");

  return value || "bo-cau-hoi";
}

function escapeHtml(str) {
  return String(str || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function parseQuestionsFromText(rawText) {
  const blocks = rawText
    .trim()
    .split(/\n\s*\n/)
    .map((block) =>
      block
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
    );

  const questions = blocks.map((lines, blockIndex) => {
    if (lines.length !== 5) {
      throw new Error(
        `Câu ${blockIndex + 1} không đúng định dạng. Mỗi câu phải có 1 dòng câu hỏi + 4 dòng đáp án.`
      );
    }

    const question = lines[0];
    const optionLines = lines.slice(1);

    let correctIndex = -1;
    const options = optionLines.map((line, i) => {
      if (line.startsWith("*")) {
        if (correctIndex !== -1) {
          throw new Error(`Câu ${blockIndex + 1} có nhiều hơn 1 đáp án đúng.`);
        }
        correctIndex = i;
        return line.slice(1).trim();
      }
      return line;
    });

    if (correctIndex === -1) {
      throw new Error(`Câu ${blockIndex + 1} chưa đánh dấu đáp án đúng bằng dấu *.`);
    }

    if (options.some((opt) => !opt)) {
      throw new Error(`Câu ${blockIndex + 1} có đáp án rỗng.`);
    }

    return {
      orderIndex: blockIndex + 1,
      question,
      options,
      correctIndex,
    };
  });

  return questions;
}
function openCreateQuizModal() {
  parsedQuiz = null;
  refs.createQuizTitle.value = "";
  refs.createQuizDescription.value = "";
  refs.createQuizRawInput.value = "";
  setCreateQuizMessage("");
  refs.createQuizModalOverlay.classList.remove("hidden");
}
function handleParseCreateQuiz() {
  try {
    parsedQuiz = buildQuizObjectFromCreateModal();
    setCreateQuizMessage(
      `Đã chuẩn hóa thành công ${parsedQuiz.questions.length} câu hỏi.`,
      "success"
    );
  } catch (error) {
    parsedQuiz = null;
    setCreateQuizMessage(error.message, "error");
  }
}
function closeCreateQuizModal() {
  parsedQuiz = null;
  refs.createQuizModalOverlay.classList.add("hidden");
}
function buildQuizObjectFromCreateModal() {
  const title = refs.createQuizTitle?.value.trim() || "";
  const description = refs.createQuizDescription?.value.trim() || "";
  const rawText = refs.createQuizRawInput?.value.trim() || "";

  if (!title) throw new Error("Bạn chưa nhập tên bộ câu hỏi.");
  if (!rawText) throw new Error("Bạn chưa dán nội dung câu hỏi.");

  const slug = slugify(title);
  const questions = parseQuestionsFromText(rawText);

  return {
    meta: {
      title,
      slug,
      description,
      totalQuestions: questions.length,
      createdAt: new Date().toISOString(),
    },
    questions,
  };
}

function handleParse() {
  try {
    parsedQuiz = buildQuizObject();
    setMessage(`Đã chuẩn hóa thành công ${parsedQuiz.questions.length} câu hỏi.`, "success");
  } catch (error) {
    parsedQuiz = null;
    setMessage(error.message, "error");
  }
}

async function fetchQuizzesByUser(userId) {
  const res = await supabaseFetch(
    `/rest/v1/quizzes?select=id,title,slug,description,user_id&user_id=eq.${userId}&order=id.desc`
  );
  return await res.json();
}

async function fetchQuestionsByQuizId(quizId) {
  const res = await supabaseFetch(
    `/rest/v1/questions_list?select=id,quiz_id,quiz_name,question,option_a,option_b,option_c,option_d,correct_index&quiz_id=eq.${quizId}&order=id.asc`
  );
  return await res.json();
}

async function findExistingQuizBySlugAndUser(slug, userId) {
  const res = await supabaseFetch(
    `/rest/v1/quizzes?select=id,title,slug,description,user_id&slug=eq.${encodeURIComponent(
      slug
    )}&user_id=eq.${userId}&limit=1`
  );
  const data = await res.json();
  return Array.isArray(data) && data.length > 0 ? data[0] : null;
}

async function createQuiz(meta, userId) {
  const payload = {
    title: meta.title,
    slug: meta.slug,
    description: meta.description || "",
    user_id: userId,
  };

  const res = await supabaseFetch("/rest/v1/quizzes", {
    method: "POST",
    headers: {
      Prefer: "return=representation",
    },
    body: JSON.stringify([payload]),
  });

  const data = await res.json();

  if (!Array.isArray(data) || !data[0]?.id) {
    throw new Error("Không lấy được quiz id sau khi tạo bộ câu hỏi.");
  }

  return data[0];
}

async function updateQuiz(quizId, meta, userId) {
  const payload = {
    title: meta.title,
    slug: meta.slug,
    description: meta.description || "",
    user_id: userId,
  };

  const res = await supabaseFetch(
    `/rest/v1/quizzes?id=eq.${quizId}&user_id=eq.${userId}`,
    {
      method: "PATCH",
      headers: {
        Prefer: "return=representation",
      },
      body: JSON.stringify(payload),
    }
  );

  const data = await res.json();

  if (!Array.isArray(data) || !data[0]?.id) {
    throw new Error("Không cập nhật được bộ câu hỏi.");
  }

  return data[0];
}

async function upsertQuiz(meta, userId) {
  const existing = await findExistingQuizBySlugAndUser(meta.slug, userId);

  if (existing) {
    return await updateQuiz(existing.id, meta, userId);
  }

  return await createQuiz(meta, userId);
}

async function deleteOldQuestionsByQuizId(quizId) {
  await supabaseFetch(`/rest/v1/questions_list?quiz_id=eq.${quizId}`, {
    method: "DELETE",
  });
}

async function insertQuestions(quiz, questions) {
  const rows = questions.map((q) => ({
    quiz_id: quiz.id,
    quiz_name: quiz.slug,
    question: q.question,
    option_a: q.options[0],
    option_b: q.options[1],
    option_c: q.options[2],
    option_d: q.options[3],
    correct_index: q.correctIndex,
  }));

  await supabaseFetch("/rest/v1/questions_list", {
    method: "POST",
    headers: {
      Prefer: "return=representation",
    },
    body: JSON.stringify(rows),
  });
}

function clearQuizForm() {
  refs.quizTitle.value = "";
  refs.quizDescription.value = "";
  parsedQuiz = null;
}

function renderQuizList() {
  if (!refs.quizList) return;

  if (!filteredQuizzes.length) {
    refs.quizList.innerHTML = `
      <div class="empty-state">
        <strong>Không tìm thấy bộ câu hỏi</strong>
        Hãy thử từ khóa khác hoặc tạo bộ mới.
      </div>
    `;
    return;
  }

  refs.quizList.innerHTML = filteredQuizzes
    .map((quiz) => {
      const isActive = currentQuiz?.id === quiz.id;
      const questionCount =
        currentQuiz?.id === quiz.id ? currentQuestions.length : "—";

      return `
        <div class="quiz-item ${isActive ? "active" : ""}" data-quiz-id="${quiz.id}">
          <div class="quiz-item-main">
            <h3>${escapeHtml(quiz.title)}</h3>
            <p>${escapeHtml(quiz.description || "Chưa có mô tả")}</p>
            <span>${questionCount} câu hỏi</span>
          </div>

          <div class="quiz-item-actions">
            <button class="small-btn edit" data-action="select" data-quiz-id="${quiz.id}">
              Chọn
            </button>
            <button class="small-btn delete" data-action="ask-delete-quiz" data-quiz-id="${quiz.id}">
              Xóa
            </button>
          </div>
        </div>
      `;
    })
    .join("");
}

function renderQuestionList() {
  if (!refs.questionList) return;

  if (!currentQuiz) {
    refs.questionList.innerHTML = `
      <div class="empty-state">
        <strong>Chưa chọn bộ câu hỏi</strong>
        Hãy chọn một bộ câu hỏi ở cột bên trái để xem và chỉnh sửa.
      </div>
    `;
    return;
  }

  if (!currentQuestions.length) {
    refs.questionList.innerHTML = `
      <div class="empty-state">
        <strong>Chưa có câu hỏi nào</strong>
        Bạn có thể thêm thủ công hoặc nhập nhanh từ TXT.
      </div>
    `;
    return;
  }

  refs.questionList.innerHTML = currentQuestions
    .map((item, index) => {
      const options = [item.option_a, item.option_b, item.option_c, item.option_d];
      return `
        <div class="question-item">
          <div class="question-item-head">
            <h3>Câu ${index + 1}</h3>
            <div class="question-item-actions">
              <button class="small-btn edit" data-action="edit-question" data-question-id="${item.id}">
                Sửa
              </button>
              <button class="small-btn delete" data-action="ask-delete-question" data-question-id="${item.id}">
                Xóa
              </button>
            </div>
          </div>

          <p class="question-text">${escapeHtml(item.question)}</p>

          <ul class="option-list">
            ${options
              .map((opt, i) => {
                const cls = Number(item.correct_index) === i ? "correct" : "";
                const label = String.fromCharCode(65 + i);
                return `<li class="${cls}">${label}. ${escapeHtml(opt)}</li>`;
              })
              .join("")}
          </ul>
        </div>
      `;
    })
    .join("");
}

function applyQuizToForm() {
  if (!currentQuiz) {
    refs.quizTitle.value = "";
    refs.quizDescription.value = "";
    return;
  }

  refs.quizTitle.value = currentQuiz.title || "";
  refs.quizDescription.value = currentQuiz.description || "";
}

function filterQuizList() {
  const keyword = refs.quizSearchInput?.value.trim().toLowerCase() || "";

  if (!keyword) {
    filteredQuizzes = [...allQuizzes];
  } else {
    filteredQuizzes = allQuizzes.filter((quiz) => {
      const title = String(quiz.title || "").toLowerCase();
      const description = String(quiz.description || "").toLowerCase();
      return title.includes(keyword) || description.includes(keyword);
    });
  }

  renderQuizList();
}

async function loadQuizList() {
  if (!currentUser?.id) return;

  allQuizzes = await fetchQuizzesByUser(currentUser.id);
  filteredQuizzes = [...allQuizzes];
  renderQuizList();
}

async function selectQuiz(quizId) {
  const selected = allQuizzes.find((quiz) => String(quiz.id) === String(quizId));
  if (!selected) {
    setMessage("Không tìm thấy bộ câu hỏi.", "error");
    return;
  }

  currentQuiz = selected;
  applyQuizToForm();
  currentQuestions = await fetchQuestionsByQuizId(selected.id);
  renderQuizList();
  renderQuestionList();
  setMessage(`Đã tải bộ câu hỏi "${selected.title}".`, "success");
}

function openQuestionModal(mode = "create", question = null) {
  editingQuestionId = question?.id || null;

  console.log("openQuestionModal mode =", mode);
  console.log("editingQuestionId =", editingQuestionId);
  console.log("question =", question);

  refs.questionModalTitle.textContent =
    mode === "edit" ? "Chỉnh sửa câu hỏi" : "Thêm câu hỏi";

  refs.modalQuestionText.value = question?.question || "";
  refs.modalOptionA.value = question?.option_a || "";
  refs.modalOptionB.value = question?.option_b || "";
  refs.modalOptionC.value = question?.option_c || "";
  refs.modalOptionD.value = question?.option_d || "";
  refs.modalCorrectAnswer.value = String(question?.correct_index ?? 0);

  refs.questionModalOverlay.classList.remove("hidden");
}

function closeQuestionModal() {
  editingQuestionId = null;
  refs.questionModalOverlay.classList.add("hidden");
}

function openDeleteQuizModal() {
  if (!currentQuiz) {
    setMessage("Bạn chưa chọn bộ câu hỏi để xóa.", "error");
    return;
  }
  refs.deleteQuizModalOverlay.classList.remove("hidden");
}

function closeDeleteQuizModal() {
  refs.deleteQuizModalOverlay.classList.add("hidden");
}

function openDeleteQuestionModal(questionId) {
  deletingQuestionId = questionId;
  refs.deleteQuestionModalOverlay.classList.remove("hidden");
}

function closeDeleteQuestionModal() {
  deletingQuestionId = null;
  refs.deleteQuestionModalOverlay.classList.add("hidden");
}

function validateQuestionModalInput() {
  const question = refs.modalQuestionText.value.trim();
  const optionA = refs.modalOptionA.value.trim();
  const optionB = refs.modalOptionB.value.trim();
  const optionC = refs.modalOptionC.value.trim();
  const optionD = refs.modalOptionD.value.trim();
  const correctIndex = Number(refs.modalCorrectAnswer.value);

  if (!question) throw new Error("Bạn chưa nhập nội dung câu hỏi.");
  if (!optionA || !optionB || !optionC || !optionD) {
    throw new Error("Bạn phải nhập đầy đủ 4 đáp án.");
  }

  return {
    question,
    option_a: optionA,
    option_b: optionB,
    option_c: optionC,
    option_d: optionD,
    correct_index: correctIndex,
  };
}

async function handleSaveQuizMeta() {
  try {
    if (!currentQuiz) {
      throw new Error("Bạn chưa chọn bộ câu hỏi để cập nhật.");
    }

    const title = refs.quizTitle.value.trim();
    const description = refs.quizDescription.value.trim();

    if (!title) throw new Error("Tên bộ câu hỏi không được để trống.");

    const updated = await updateQuiz(
      currentQuiz.id,
      {
        title,
        slug: slugify(title),
        description,
      },
      currentUser.id
    );

    currentQuiz = updated;
    await loadQuizList();
    await selectQuiz(updated.id);
    setMessage(`Đã cập nhật bộ câu hỏi "${updated.title}".`, "success");
  } catch (error) {
    console.error("handleSaveQuizMeta error:", error);
    setMessage(error.message, "error");
  }
}

async function handleCreateNewQuiz() {
  openCreateQuizModal();
}

async function handleDeleteCurrentQuiz() {
  try {
    if (!currentQuiz) throw new Error("Bạn chưa chọn bộ câu hỏi để xóa.");

    await supabaseFetch(`/rest/v1/questions_list?quiz_id=eq.${currentQuiz.id}`, {
      method: "DELETE",
    });

    await supabaseFetch(
      `/rest/v1/quizzes?id=eq.${currentQuiz.id}&user_id=eq.${currentUser.id}`,
      {
        method: "DELETE",
      }
    );

    const deletedTitle = currentQuiz.title;
    currentQuiz = null;
    currentQuestions = [];
    clearQuizForm();
    closeDeleteQuizModal();
    await loadQuizList();
    renderQuestionList();
    setMessage(`Đã xóa bộ câu hỏi "${deletedTitle}".`, "success");
  } catch (error) {
    console.error("handleDeleteCurrentQuiz error:", error);
    setMessage(`Xóa bộ câu hỏi thất bại: ${error.message}`, "error");
  }
}

async function handleSaveQuestion() {
  try {
    if (!currentQuiz) throw new Error("Bạn chưa chọn bộ câu hỏi.");

    const payload = validateQuestionModalInput();

    if (editingQuestionId) {
      console.log("Updating question id =", editingQuestionId);
      console.log("Current quiz id =", currentQuiz.id);
      console.log("Payload =", payload);

      const res = await supabaseFetch(
        `/rest/v1/questions_list?id=eq.${editingQuestionId}`,
        {
          method: "PATCH",
          headers: {
            Prefer: "return=representation",
          },
          body: JSON.stringify(payload),
        }
      );

      const data = await res.json();
      console.log("PATCH result =", data);

      if (!Array.isArray(data) || !data[0]?.id) {
        throw new Error("Không cập nhật được câu hỏi.");
      }

      setMessage("Đã cập nhật câu hỏi.", "success");
    } else {
      const res = await supabaseFetch("/rest/v1/questions_list", {
        method: "POST",
        headers: {
          Prefer: "return=representation",
        },
        body: JSON.stringify([
          {
            quiz_id: currentQuiz.id,
            quiz_name: currentQuiz.slug,
            ...payload,
          },
        ]),
      });

      const data = await res.json();
      if (!Array.isArray(data) || !data[0]?.id) {
        throw new Error("Không thêm được câu hỏi.");
      }

      setMessage("Đã thêm câu hỏi mới.", "success");
    }

    closeQuestionModal();
    currentQuestions = await fetchQuestionsByQuizId(currentQuiz.id);
    renderQuizList();
    renderQuestionList();
  } catch (error) {
    console.error("handleSaveQuestion error:", error);
    setMessage(error.message, "error");
  }
}

async function handleDeleteQuestion() {
  try {
    if (!currentQuiz) throw new Error("Bạn chưa chọn bộ câu hỏi.");
    if (!deletingQuestionId) throw new Error("Không xác định được câu hỏi cần xóa.");

    await supabaseFetch(
      `/rest/v1/questions_list?id=eq.${deletingQuestionId}&quiz_id=eq.${currentQuiz.id}`,
      {
        method: "DELETE",
      }
    );

    closeDeleteQuestionModal();
    currentQuestions = await fetchQuestionsByQuizId(currentQuiz.id);
    renderQuizList();
    renderQuestionList();
    setMessage("Đã xóa câu hỏi.", "success");
  } catch (error) {
    console.error("handleDeleteQuestion error:", error);
    setMessage(`Xóa câu hỏi thất bại: ${error.message}`, "error");
  }
}



function handleQuizListClick(event) {
  const actionEl = event.target.closest("[data-action]");
  if (!actionEl) return;

  const action = actionEl.dataset.action;
  const quizId = actionEl.dataset.quizId;
  const questionId = actionEl.dataset.questionId;

  if (action === "select" && quizId) {
    selectQuiz(quizId);
  }

  if (action === "ask-delete-quiz" && quizId) {
    const quiz = allQuizzes.find((item) => String(item.id) === String(quizId));
    if (quiz) {
      currentQuiz = quiz;
      applyQuizToForm();
      openDeleteQuizModal();
      renderQuizList();
    }
  }

  if (action === "edit-question" && questionId) {
    const question = currentQuestions.find(
      (item) => String(item.id) === String(questionId)
    );
    if (question) {
      openQuestionModal("edit", question);
    }
  }

  if (action === "ask-delete-question" && questionId) {
    openDeleteQuestionModal(questionId);
  }
}

function handleQuestionListClick(event) {
  const actionEl = event.target.closest("[data-action]");
  if (!actionEl) return;

  const action = actionEl.dataset.action;
  const questionId = actionEl.dataset.questionId;

  if (action === "edit-question" && questionId) {
    const question = currentQuestions.find(
      (item) => String(item.id) === String(questionId)
    );
    if (question) openQuestionModal("edit", question);
  }

  if (action === "ask-delete-question" && questionId) {
    openDeleteQuestionModal(questionId);
  }
}

function bindEvents() {
  refs.backDashboardBtn?.addEventListener("click", () => {
    window.location.href = "../dashboard/index.html";
  });

  refs.createNewQuizBtn?.addEventListener("click", handleCreateNewQuiz);
  refs.quizSearchInput?.addEventListener("input", filterQuizList);
  refs.saveQuizMetaBtn?.addEventListener("click", handleSaveQuizMeta);
  refs.deleteQuizBtn?.addEventListener("click", openDeleteQuizModal);

  refs.addQuestionBtn?.addEventListener("click", () => {
    if (!currentQuiz) {
      setMessage("Hãy chọn bộ câu hỏi trước khi thêm câu hỏi.", "error");
      return;
    }
    openQuestionModal("create");
  });
  refs.closeCreateQuizModalBtn?.addEventListener("click", closeCreateQuizModal);
  refs.parseCreateQuizBtn?.addEventListener("click", handleParseCreateQuiz);
  refs.saveCreateQuizBtn?.addEventListener("click", handleSaveCreateQuiz);

  refs.createQuizModalOverlay?.addEventListener("click", (event) => {
    if (event.target === refs.createQuizModalOverlay) {
      closeCreateQuizModal();
    }
  });
  refs.quizList?.addEventListener("click", handleQuizListClick);
  refs.questionList?.addEventListener("click", handleQuestionListClick);

  refs.closeQuestionModalBtn?.addEventListener("click", closeQuestionModal);
  refs.cancelQuestionModalBtn?.addEventListener("click", closeQuestionModal);
  refs.saveQuestionBtn?.addEventListener("click", handleSaveQuestion);

  refs.closeDeleteQuizModalBtn?.addEventListener("click", closeDeleteQuizModal);
  refs.cancelDeleteQuizBtn?.addEventListener("click", closeDeleteQuizModal);
  refs.confirmDeleteQuizBtn?.addEventListener("click", handleDeleteCurrentQuiz);

  refs.closeDeleteQuestionModalBtn?.addEventListener("click", closeDeleteQuestionModal);
  refs.cancelDeleteQuestionBtn?.addEventListener("click", closeDeleteQuestionModal);
  refs.confirmDeleteQuestionBtn?.addEventListener("click", handleDeleteQuestion);

  refs.questionModalOverlay?.addEventListener("click", (event) => {
    if (event.target === refs.questionModalOverlay) {
      closeQuestionModal();
    }
  });

  refs.deleteQuizModalOverlay?.addEventListener("click", (event) => {
    if (event.target === refs.deleteQuizModalOverlay) {
      closeDeleteQuizModal();
    }
  });

  refs.deleteQuestionModalOverlay?.addEventListener("click", (event) => {
    if (event.target === refs.deleteQuestionModalOverlay) {
      closeDeleteQuestionModal();
    }
  });
}

function initEmptyState() {
  renderQuizList();
  renderQuestionList();
}

document.addEventListener("DOMContentLoaded", async () => {
  try {
    bindEvents();
    initEmptyState();

    currentUser = await requireAuth();
    if (!currentUser) return;

    await loadQuizList();

    if (allQuizzes.length > 0) {
      await selectQuiz(allQuizzes[0].id);
    } else {
      setMessage("Bạn chưa có bộ câu hỏi nào. Hãy tạo bộ mới hoặc nhập từ TXT.");
    }
  } catch (error) {
    console.error("question manager init error:", error);
    setMessage(`Khởi tạo thất bại: ${error.message}`, "error");
  }
});