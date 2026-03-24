let examCache = [];
let submissionCache = {};
const STORAGE_BUCKET = "BaiNopHS";

function showToast(message) {
  const toast = document.getElementById("toast");
  const toastMsg = document.getElementById("toastMsg");
  if (!toast || !toastMsg) return;

  toastMsg.textContent = message;
  toast.classList.add("show");

  window.clearTimeout(showToast._timer);
  showToast._timer = window.setTimeout(() => {
    toast.classList.remove("show");
  }, 2600);
}

function formatDateTime(value) {
  if (!value) return "";
  return new Date(value).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function isExpired(deadline) {
  if (!deadline) return false;
  return new Date(deadline) < new Date();
}

function handleLogout() {
  window.supabaseClient.auth.signOut().then(() => {
    window.location.href = "../../login/index.html";
  }).catch((error) => {
    console.error("logout error:", error);
    showToast("Đăng xuất thất bại.");
  });
}

function goBackSubmitDashboard() {
  window.location.href = "../dashboard_submit/index.html";
}

async function fetchAllExams() {
  const { data, error } = await window.supabaseClient
    .from("exam")
    .select("id, nameexam, description, deadline, room_id")
    .order("id", { ascending: false });

  if (error) throw error;
  return data || [];
}

async function fetchSubmissionCounts() {
  const { data, error } = await window.supabaseClient
    .from("exam_submissions")
    .select("room_id");

  if (error) throw error;
  return data || [];
}

async function fetchSubmissionsByRoomId(roomId) {
  const { data, error } = await window.supabaseClient
    .from("exam_submissions")
    .select(`
      id,
      room_id,
      student_name,
      class_name,
      group_name,
      group_members,
      file_name,
      file_path,
      file_url,
      submitted_at
    `)
    .eq("room_id", roomId)
    .order("submitted_at", { ascending: true });

  if (error) throw error;
  return data || [];
}

async function createSignedFileUrl(filePath) {
  const { data, error } = await window.supabaseClient.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(filePath, 60 * 10);

  if (error) throw error;
  return data.signedUrl;
}

async function openSubmissionFile(filePath) {
  try {
    const signedUrl = await createSignedFileUrl(filePath);
    window.open(signedUrl, "_blank");
  } catch (error) {
    console.error("open file error:", error);
    showToast("Không mở được file.");
  }
}

function renderStats(exams, submissionRows) {
  const totalExamCount = document.getElementById("totalExamCount");
  const activeExamCount = document.getElementById("activeExamCount");
  const totalSubmissionCount = document.getElementById("totalSubmissionCount");

  const activeCount = exams.filter((item) => !isExpired(item.deadline)).length;

  if (totalExamCount) totalExamCount.textContent = String(exams.length);
  if (activeExamCount) activeExamCount.textContent = String(activeCount);
  if (totalSubmissionCount) totalSubmissionCount.textContent = String(submissionRows.length);
}

function countSubmissionsByRoom(submissionRows) {
  const map = {};
  submissionRows.forEach((row) => {
    map[row.room_id] = (map[row.room_id] || 0) + 1;
  });
  return map;
}

function renderExamTable(exams, submissionRows) {
  const tbody = document.getElementById("examTableBody");
  const summary = document.getElementById("examTableSummary");
  if (!tbody || !summary) return;

  if (!exams.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="empty-row">Chưa có phòng thi nào.</td>
      </tr>
    `;
    summary.textContent = "0 phòng thi";
    return;
  }

  const countMap = countSubmissionsByRoom(submissionRows);
  summary.textContent = `${exams.length} phòng thi`;

  tbody.innerHTML = exams.map((exam, index) => {
    const expired = isExpired(exam.deadline);
    const statusHtml = expired
      ? '<span class="status-badge status-expired">Đã hết hạn</span>'
      : '<span class="status-badge status-active">Đang nhận bài</span>';

    return `
      <tr>
        <td>${index + 1}</td>
        <td>${exam.nameexam || "Không có tên"}</td>
        <td><strong>${exam.room_id || ""}</strong></td>
        <td>${formatDateTime(exam.deadline)}</td>
        <td>${statusHtml}</td>
        <td>${countMap[exam.room_id] || 0}</td>
        <td>
          <div class="action-icon-group">
            <button
              class="icon-action-btn view-btn"
              data-room-id="${exam.room_id}"
              title="Xem bài nộp"
              aria-label="Xem bài nộp"
            >
              <i data-lucide="eye" class="w-4 h-4"></i>
            </button>

            <button
              class="icon-action-btn access-btn"
              data-room-id="${exam.room_id}"
              title="Mở link nộp bài"
              aria-label="Mở link nộp bài"
            >
              <i data-lucide="external-link" class="w-4 h-4"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join("");

  tbody.querySelectorAll(".view-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const roomId = btn.dataset.roomId;
      openSubmissionModal(roomId);
    });
  });

  tbody.querySelectorAll(".access-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const roomId = btn.dataset.roomId;
      openStudentSubmitPage(roomId);
    });
  });

  lucide.createIcons();
}

function renderModalTable(roomId, submissions) {
  const modalTitle = document.getElementById("modalTitle");
  const modalSubtitle = document.getElementById("modalSubtitle");
  const tbody = document.getElementById("modalSubmissionTableBody");

  if (!tbody || !modalTitle || !modalSubtitle) return;

  modalTitle.textContent = `Bài nộp của phòng ${roomId}`;
  modalSubtitle.textContent = `${submissions.length} bài nộp`;

  if (!submissions.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="empty-row">Chưa có bài nộp nào trong phòng này.</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = submissions.map((item, index) => {
    const displayName = item.group_name?.trim()
      ? item.group_name
      : (item.student_name || "Không rõ");

    const members = item.group_members?.trim() || "-";

    return `
      <tr>
        <td>${index + 1}</td>
        <td>${displayName}</td>
        <td>${item.class_name || "-"}</td>
        <td>${members}</td>
        <td>${item.file_name || "-"}</td>
        <td>${formatDateTime(item.submitted_at)}</td>
        <td>
          <button class="file-link open-file-btn" data-file-path="${item.file_path}">
            <i data-lucide="download" class="w-4 h-4"></i>
            Mở file
          </button>
        </td>
      </tr>
    `;
  }).join("");

  tbody.querySelectorAll(".open-file-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      openSubmissionFile(btn.dataset.filePath);
    });
  });

  lucide.createIcons();
}

async function openSubmissionModal(roomId) {
  const modal = document.getElementById("submissionModal");
  if (!modal) return;

  try {
    let submissions = submissionCache[roomId];

    if (!submissions) {
      submissions = await fetchSubmissionsByRoomId(roomId);
      submissionCache[roomId] = submissions;
    }

    renderModalTable(roomId, submissions);
    modal.classList.remove("hidden");
  } catch (error) {
    console.error("open modal error:", error);
    showToast("Không tải được bài nộp của phòng này.");
  }
}

function closeSubmissionModal() {
  document.getElementById("submissionModal")?.classList.add("hidden");
}

async function loadSubmissionManagerData() {
  try {
    const [exams, submissionRows] = await Promise.all([
      fetchAllExams(),
      fetchSubmissionCounts()
    ]);

    examCache = exams;
    renderStats(exams, submissionRows);
    renderExamTable(exams, submissionRows);
  } catch (error) {
    console.error("load submission manager error:", error);
    showToast("Không tải được danh sách phòng thi.");
  }
}
function openStudentSubmitPage(roomId) {
  const submitUrl = `../student_submit/index.html?roomId=${encodeURIComponent(roomId)}`;
  window.open(submitUrl, "_blank");
}
document.addEventListener("DOMContentLoaded", async () => {
  const user = await requireAuthOrRedirect();
  if (!user) return;

  const logoutBtn = document.getElementById("logoutBtn");
  const backSubmitDashboardBtn = document.getElementById("backSubmitDashboardBtn");
  const closeModalBtn = document.getElementById("closeModalBtn");
  const modalBackdrop = document.getElementById("modalBackdrop");

  if (logoutBtn) {
    logoutBtn.addEventListener("click", handleLogout);
  }

  if (backSubmitDashboardBtn) {
    backSubmitDashboardBtn.addEventListener("click", goBackSubmitDashboard);
  }

  if (closeModalBtn) {
    closeModalBtn.addEventListener("click", closeSubmissionModal);
  }

  if (modalBackdrop) {
    modalBackdrop.addEventListener("click", closeSubmissionModal);
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeSubmissionModal();
    }
  });

  await loadSubmissionManagerData();

  lucide.createIcons();
});