let questionFolderHandle = null;
let parsedQuiz = null;

const pickFolderBtn = document.getElementById("pickFolderBtn");
const parseBtn = document.getElementById("parseBtn");
const saveBtn = document.getElementById("saveBtn");


const folderStatus = document.getElementById("folderStatus");
const quizTitleEl = document.getElementById("quizTitle");

const quizDescriptionEl = document.getElementById("quizDescription");
const rawInputEl = document.getElementById("rawInput");
const messageEl = document.getElementById("message");

pickFolderBtn.addEventListener("click", pickQuestionFolder);
parseBtn.addEventListener("click", handleParse);
saveBtn.addEventListener("click", handleSave);


function setMessage(text, isError = false) {
  messageEl.textContent = text;
  messageEl.style.color = isError ? "#fca5a5" : "#fde68a";
}
document.addEventListener("DOMContentLoaded", () => {
    const backDashboardBtn = document.getElementById("backDashboardBtn");
  
    if (backDashboardBtn) {
      backDashboardBtn.addEventListener("click", () => {
        window.location.href = "../dashboard/index.html";
      });
    }
  });
async function pickQuestionFolder() {
  try {
    if (!window.showDirectoryPicker) {
      setMessage("Trình duyệt hiện tại không hỗ trợ chọn thư mục. Hãy dùng Chrome hoặc Edge.", true);
      return;
    }

    questionFolderHandle = await window.showDirectoryPicker();
    folderStatus.textContent = `Đã chọn thư mục: ${questionFolderHandle.name}`;
    setMessage("Đã chọn thư mục question.");
  } catch (error) {
    setMessage("Bạn đã hủy chọn thư mục hoặc trình duyệt chặn quyền.", true);
  }
}

function normalizeFileName(name) {
    let value = name.trim().toLowerCase();
  
    // bỏ dấu tiếng Việt
    value = value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    value = value.replace(/đ/g, "d").replace(/Đ/g, "d");
  
    // bỏ ký tự đặc biệt, chỉ giữ chữ, số, khoảng trắng, gạch ngang, gạch dưới
    value = value.replace(/[^a-z0-9\s\-_]/g, "");
  
    // thay khoảng trắng bằng dấu -
    value = value.replace(/\s+/g, "-");
  
    // gộp nhiều dấu - liên tiếp
    value = value.replace(/-+/g, "-");
  
    // bỏ dấu - ở đầu/cuối
    value = value.replace(/^-+|-+$/g, "");
  
    if (!value) {
      value = "bo-cau-hoi";
    }
  
    if (!value.endsWith(".json")) {
      value += ".json";
    }
  
    return value;
  }

function parseQuestionsFromText(rawText) {
  const blocks = rawText
    .trim()
    .split(/\n\s*\n/)
    .map(block => block.split("\n").map(line => line.trim()).filter(Boolean));

  const questions = blocks.map((lines, blockIndex) => {
    if (lines.length !== 5) {
      throw new Error(`Câu ${blockIndex + 1} không đúng định dạng. Mỗi câu phải có 1 dòng câu hỏi + 4 dòng đáp án.`);
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

    if (options.some(opt => !opt)) {
      throw new Error(`Câu ${blockIndex + 1} có đáp án rỗng.`);
    }

    return {
      id: blockIndex + 1,
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
  
    const fileName = normalizeFileName(title);
    const questions = parseQuestionsFromText(rawText);
  
    return {
      meta: {
        title,
        fileName,
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
    previewEl.textContent = "";
    setMessage(error.message, true);
  }
}

async function handleSave() {
  try {
    if (!questionFolderHandle) {
      setMessage("Bạn cần chọn thư mục question trước khi lưu.", true);
      return;
    }

    if (!parsedQuiz) {
      parsedQuiz = buildQuizObject();
    }

    const jsonText = JSON.stringify(parsedQuiz, null, 2);

    const fileHandle = await questionFolderHandle.getFileHandle(parsedQuiz.meta.fileName, {
      create: true
    });
    const writable = await fileHandle.createWritable();
    await writable.write(jsonText);
    await writable.close();

    await updateManifest(parsedQuiz.meta);

    setMessage(`Đã lưu file ${parsedQuiz.meta.fileName} và cập nhật manifest.json`);
  } catch (error) {
    setMessage(`Lưu thất bại: ${error.message}`, true);
  }
}

async function updateManifest(meta) {
  let manifest = { quizzes: [] };

  try {
    const manifestHandle = await questionFolderHandle.getFileHandle("manifest.json", { create: true });
    const file = await manifestHandle.getFile();
    const text = await file.text();

    if (text.trim()) {
      manifest = JSON.parse(text);
      if (!Array.isArray(manifest.quizzes)) {
        manifest.quizzes = [];
      }
    }

    const existingIndex = manifest.quizzes.findIndex(item => item.fileName === meta.fileName);

    const entry = {
      title: meta.title,
      fileName: meta.fileName,
      description: meta.description,
      totalQuestions: meta.totalQuestions,
      updatedAt: new Date().toISOString()
    };

    if (existingIndex >= 0) {
      manifest.quizzes[existingIndex] = entry;
    } else {
      manifest.quizzes.push(entry);
    }

    const writable = await manifestHandle.createWritable();
    await writable.write(JSON.stringify(manifest, null, 2));
    await writable.close();
  } catch (error) {
    throw new Error(`Không thể cập nhật manifest.json: ${error.message}`);
  }
}

