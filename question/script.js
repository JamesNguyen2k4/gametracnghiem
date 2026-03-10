let parsedQuiz = null;

const SUPABASE_URL = "https://izjtgtgnyedmdzmljbte.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml6anRndGdueWVkbWR6bWxqYnRlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxNTM2MjYsImV4cCI6MjA4ODcyOTYyNn0.b5JgqCSgXvrU8msDvvI85xvf8J5578Z981Bf_F43GiQ";

const parseBtn = document.getElementById("parseBtn");
const saveBtn = document.getElementById("saveBtn");

const quizTitleEl = document.getElementById("quizTitle");
const quizDescriptionEl = document.getElementById("quizDescription");
const rawInputEl = document.getElementById("rawInput");
const messageEl = document.getElementById("message");

const pickFolderBtn = document.getElementById("pickFolderBtn");
const folderStatus = document.getElementById("folderStatus");

if (pickFolderBtn) {
  pickFolderBtn.style.display = "none";
}
if (folderStatus) {
  folderStatus.textContent = "Đã chuyển sang lưu trực tiếp lên Supabase.";
}

parseBtn.addEventListener("click", handleParse);
saveBtn.addEventListener("click", handleSave);

document.addEventListener("DOMContentLoaded", () => {
  const backDashboardBtn = document.getElementById("backDashboardBtn");

  if (backDashboardBtn) {
    backDashboardBtn.addEventListener("click", () => {
      window.location.href = "../dashboard/index.html";
    });
  }
});

function setMessage(text, isError = false) {
  messageEl.textContent = text;
  messageEl.style.color = isError ? "#fca5a5" : "#fde68a";
}

function slugify(name) {
  let value = name.trim().toLowerCase();

  value = value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  value = value.replace(/đ/g, "d").replace(/Đ/g, "d");
  value = value.replace(/[^a-z0-9\s\-_]/g, "");
  value = value.replace(/\s+/g, "-");
  value = value.replace(/-+/g, "-");
  value = value.replace(/^-+|-+$/g, "");

  return value || "bo-cau-hoi";
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
      correctIndex
    };
  });

  return questions;
}

function buildQuizObject() {
  const title = quizTitleEl?.value.trim() || "";
  const description = quizDescriptionEl?.value.trim() || "";
  const rawText = rawInputEl?.value.trim() || "";

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
      createdAt: new Date().toISOString()
    },
    questions
  };
}

function handleParse() {
  try {
    parsedQuiz = buildQuizObject();
    setMessage(`Đã chuẩn hóa thành công ${parsedQuiz.questions.length} câu hỏi.`);
  } catch (error) {
    parsedQuiz = null;
    setMessage(error.message, true);
  }
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

async function upsertQuiz(meta) {
  const payload = {
    title: meta.title,
    slug: meta.slug,
    description: meta.description || ""
  };

  const res = await supabaseFetch("/rest/v1/quizzes?on_conflict=slug", {
    method: "POST",
    headers: {
      Prefer: "resolution=merge-duplicates,return=representation"
    },
    body: JSON.stringify([payload])
  });

  const data = await res.json();

  if (!Array.isArray(data) || !data[0]?.id) {
    throw new Error("Không lấy được quiz id sau khi lưu bảng quizzes.");
  }

  return data[0];
}

async function deleteOldQuestionsByQuizId(quizId) {
  await supabaseFetch(`/rest/v1/questions_list?quiz_id=eq.${quizId}`, {
    method: "DELETE"
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
    correct_index: q.correctIndex
  }));

  await supabaseFetch("/rest/v1/questions_list", {
    method: "POST",
    headers: {
      Prefer: "return=representation"
    },
    body: JSON.stringify(rows)
  });
}

async function handleSave() {
  try {
    if (!parsedQuiz) {
      parsedQuiz = buildQuizObject();
    }

    setMessage("Đang lưu bộ câu hỏi lên Supabase...");

    const savedQuiz = await upsertQuiz(parsedQuiz.meta);

    await deleteOldQuestionsByQuizId(savedQuiz.id);
    await insertQuestions(savedQuiz, parsedQuiz.questions);

    setMessage(
      `Đã lưu thành công bộ câu hỏi "${savedQuiz.title}" với ${parsedQuiz.questions.length} câu lên Supabase.`
    );
  } catch (error) {
    console.error("handleSave error:", error);
    setMessage(`Lưu thất bại: ${error.message}`, true);
  }
}