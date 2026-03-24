const STORAGE_BUCKET = "BaiNopHS";

let currentUser = null;
let currentExam = null;
let currentSubmissions = [];

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
  if (!value) return "--";
  return new Date(value).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function isLate(submittedAt, deadline) {
  if (!submittedAt || !deadline) return false;
  return new Date(submittedAt).getTime() > new Date(deadline).getTime();
}

function normalizeMembers(groupMembers, fallbackStudentName = "") {
  if (Array.isArray(groupMembers)) {
    return groupMembers
      .map((item) => String(item || "").trim())
      .filter(Boolean);
  }

  if (typeof groupMembers === "string") {
    const cleaned = groupMembers.trim();
    if (!cleaned) {
      return fallbackStudentName ? [fallbackStudentName] : [];
    }

    try {
      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed)) {
        return parsed
          .map((item) => String(item || "").trim())
          .filter(Boolean);
      }
    } catch (_) {}

    return cleaned
      .split(/\n|,|;|\|/g)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  if (fallbackStudentName) return [fallbackStudentName];
  return [];
}

function getDisplayGroupName(item) {
  const groupName = String(item.group_name || "").trim();
  if (groupName) return groupName;

  const studentName = String(item.student_name || "").trim();
  if (studentName) return studentName;

  return "Không rõ nhóm";
}

function getFileIcon(fileName = "") {
  const lower = String(fileName).toLowerCase();
  if (lower.endsWith(".pdf")) return "file-text";
  if (lower.endsWith(".doc") || lower.endsWith(".docx")) return "file-type";
  if (lower.endsWith(".xls") || lower.endsWith(".xlsx")) return "file-spreadsheet";
  if (lower.endsWith(".zip") || lower.endsWith(".rar")) return "file-archive";
  return "file";
}

function calculateAverageScore(rows) {
  const scored = rows
    .map((item) => Number(item.score))
    .filter((score) => !Number.isNaN(score));

  if (!scored.length) return "--";

  const avg = scored.reduce((sum, value) => sum + value, 0) / scored.length;
  return avg.toFixed(1);
}

function rankSubmissions(rows) {
  return [...rows].sort((a, b) => {
    const scoreA = Number(a.score);
    const scoreB = Number(b.score);

    const hasScoreA = !Number.isNaN(scoreA);
    const hasScoreB = !Number.isNaN(scoreB);

    if (hasScoreA && hasScoreB && scoreB !== scoreA) {
      return scoreB - scoreA;
    }

    if (hasScoreA && !hasScoreB) return -1;
    if (!hasScoreA && hasScoreB) return 1;

    return new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime();
  });
}

function getTop5Fastest(rows) {
  return [...rows]
    .sort((a, b) => new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime())
    .slice(0, 5);
}
async function fetchOwnedExams(userId) {
  const { data, error } = await window.supabaseClient
    .from("exam")
    .select("id, nameexam, description, deadline, room_id")
    .eq("id_usermake", userId)
    .order("id", { ascending: false });

  if (error) throw error;
  return data || [];
}
function renderRoomSelect(exams, selectedRoomId = "") {
  const roomSelect = document.getElementById("roomSelect");
  if (!roomSelect) return;

  if (!exams.length) {
    roomSelect.innerHTML = `<option value="">Chưa có phòng thi nào</option>`;
    return;
  }

  roomSelect.innerHTML = exams.map((exam) => {
    const selected = exam.room_id === selectedRoomId ? "selected" : "";
    return `
      <option value="${exam.room_id}" ${selected}>
        ${exam.nameexam} (${exam.room_id})
      </option>
    `;
  }).join("");
}
function getRoomIdFromQuery() {
  const params = new URLSearchParams(window.location.search);
  return (params.get("roomId") || "").trim();
}

function goBackDashboard() {
  window.location.href = "../dashboard_submit/index.html";
}

async function handleLogout() {
  try {
    await window.supabaseClient.auth.signOut();
    window.location.href = "../../login/index.html";
  } catch (error) {
    console.error("logout error:", error);
    showToast("Đăng xuất thất bại.");
  }
}

async function fetchOwnedExamByRoomId(userId, roomId) {
  const { data, error } = await window.supabaseClient
    .from("exam")
    .select("id, nameexam, description, deadline, room_id, id_usermake")
    .eq("id_usermake", userId)
    .eq("room_id", roomId)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data || null;
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
      submitted_at,
      score
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
  return data?.signedUrl || "";
}

async function openSubmissionFile(item) {
    try {
      if (!item.file_path) {
        throw new Error("Không tìm thấy file.");
      }
  
      const signedUrl = await createSignedFileUrl(item.file_path);
  
      if (!signedUrl) {
        throw new Error("Không tạo được link file.");
      }
  
      window.open(signedUrl, "_blank");
    } catch (error) {
      console.error("openSubmissionFile error:", error);
      showToast("Không mở được file bài nộp.");
    }
  }

async function saveScore(submissionId, scoreValue) {
  const score =
    scoreValue === "" || scoreValue === null || scoreValue === undefined
      ? null
      : Number(scoreValue);

  if (score !== null && (Number.isNaN(score) || score < 0 || score > 10)) {
    throw new Error("Điểm phải nằm trong khoảng 0 đến 10.");
  }

  const { error } = await window.supabaseClient
    .from("exam_submissions")
    .update({ score })
    .eq("id", submissionId);

  if (error) throw error;
}

function renderPageInfo(exam) {
  const roomDesc = document.getElementById("roomDesc");
  const roomIdBadge = document.getElementById("roomIdBadge");
  const deadlineBadge = document.getElementById("deadlineBadge");

  if (roomDesc) {
    const desc = exam.description?.trim()
      ? `${exam.nameexam} – ${exam.description}`
      : `${exam.nameexam}`;
    roomDesc.textContent = `Phòng thi: ${desc}`;
  }

  if (roomIdBadge) {
    roomIdBadge.innerHTML = `
      <i data-lucide="hash" class="w-3 h-3"></i>
      Room ID: ${exam.room_id || "--"}
    `;
  }

  if (deadlineBadge) {
    deadlineBadge.innerHTML = `
      <i data-lucide="clock-3" class="w-3 h-3"></i>
      Hạn nộp: ${formatDateTime(exam.deadline)}
    `;
  }
}

function renderStats(exam, rows) {
  const totalSubmissionsEl = document.getElementById("totalSubmissionsEl");
  const onTimeEl = document.getElementById("onTimeEl");
  const lateEl = document.getElementById("lateEl");
  const avgScoreEl = document.getElementById("avgScoreEl");
  const topOneEl = document.getElementById("topOneEl");

  const onTime = rows.filter((item) => !isLate(item.submitted_at, exam.deadline)).length;
  const late = rows.length - onTime;
  const ranked = rankSubmissions(rows);

  if (totalSubmissionsEl) totalSubmissionsEl.textContent = String(rows.length);
  if (onTimeEl) onTimeEl.textContent = String(onTime);
  if (lateEl) lateEl.textContent = String(late);
  if (avgScoreEl) avgScoreEl.textContent = calculateAverageScore(rows);
  if (topOneEl) topOneEl.textContent = ranked[0] ? getDisplayGroupName(ranked[0]) : "--";
}

function renderChart(rows) {
    const chartArea = document.getElementById("chartArea");
    const chartEmpty = document.getElementById("chartEmpty");
    const chartWrap = document.getElementById("chartWrap");
  
    if (!chartArea || !chartEmpty || !chartWrap) return;
  
    chartArea.innerHTML = "";
  
    const fastest = getTop5Fastest(rows);
  
    if (!fastest.length) {
      chartWrap.classList.add("hidden");
      chartEmpty.classList.remove("hidden");
      return;
    }
  
    chartWrap.classList.remove("hidden");
    chartEmpty.classList.add("hidden");
  
    chartArea.style.gridTemplateColumns = `repeat(${fastest.length}, minmax(120px, 1fr))`;
  
    const baseTime = new Date(fastest[0].submitted_at).getTime();
    const maxDiff = Math.max(
      ...fastest.map((item) => new Date(item.submitted_at).getTime() - baseTime),
      1
    );
  
    const colors = [
      "linear-gradient(180deg, #7c3aed 0%, #6d28d9 100%)",
      "linear-gradient(180deg, #8b5cf6 0%, #7c3aed 100%)",
      "linear-gradient(180deg, #a78bfa 0%, #8b5cf6 100%)",
      "linear-gradient(180deg, #c4b5fd 0%, #a78bfa 100%)",
      "linear-gradient(180deg, #ddd6fe 0%, #c4b5fd 100%)"
    ];
  
    fastest.forEach((item, index) => {
      const diff = new Date(item.submitted_at).getTime() - baseTime;
      const heightPercent = 35 + ((maxDiff - diff) / maxDiff) * 55;
  
      const chartItem = document.createElement("div");
      chartItem.className = "chart-item";
  
      const bar = document.createElement("div");
      bar.className = "bar-col";
      bar.style.height = `${Math.max(90, heightPercent * 2.2)}px`;
      bar.style.background = colors[index % colors.length];
      bar.style.opacity = "0";
  
      const rankLabel = document.createElement("div");
      rankLabel.className = "chart-rank";
      rankLabel.textContent = `#${index + 1}`;
      bar.appendChild(rankLabel);
  
      if (index === 0) {
        const crown = document.createElement("div");
        crown.className = "chart-crown";
        crown.textContent = "👑";
        bar.appendChild(crown);
      }
  
      const meta = document.createElement("div");
      meta.className = "chart-meta";
  
      const timeEl = document.createElement("div");
      timeEl.className = "chart-time";
      timeEl.textContent = formatDateTime(item.submitted_at);
  
      const nameEl = document.createElement("div");
      nameEl.className = "chart-name";
      nameEl.textContent = getDisplayGroupName(item);
  
      meta.appendChild(timeEl);
      meta.appendChild(nameEl);
  
      chartItem.appendChild(bar);
      chartItem.appendChild(meta);
  
      chartArea.appendChild(chartItem);
  
      window.setTimeout(() => {
        bar.style.opacity = "1";
      }, 100 + index * 100);
    });
  }

function buildMembersHtml(members) {
  if (!members.length) return `<span class="text-brand-400">-</span>`;

  if (members.length <= 2) {
    return `<span class="text-brand-700">${members.join(", ")}</span>`;
  }

  const short = `${members[0]} +${members.length - 1}`;
  return `
    <span class="members-wrap">
      <span class="members-trigger">${short}</span>
      <span class="members-tooltip">${members.join("<br>")}</span>
    </span>
  `;
}

function renderTable(exam, rows) {
  const tbody = document.getElementById("rankingBody");
  const tableSummary = document.getElementById("tableSummary");
  const tableEmpty = document.getElementById("tableEmpty");

  if (!tbody || !tableSummary || !tableEmpty) return;

  tbody.innerHTML = "";

  const ranked = rankSubmissions(rows);
  tableSummary.textContent = `${ranked.length} bài nộp`;

  if (!ranked.length) {
    tableEmpty.classList.remove("hidden");
    return;
  }

  tableEmpty.classList.add("hidden");

  ranked.forEach((item, index) => {
    const members = normalizeMembers(item.group_members, item.student_name);
    const late = isLate(item.submitted_at, exam.deadline);
    const displayName = getDisplayGroupName(item);
    const rankCell =
      index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : String(index + 1);

    const tr = document.createElement("tr");
    tr.className = "table-row border-b border-gray-100";

    tr.innerHTML = `
      <td class="py-3 pl-3 font-bold text-brand-700">${rankCell}</td>
      <td class="py-3 font-semibold text-brand-900">${displayName}</td>
      <td class="py-3">${buildMembersHtml(members)}</td>
      
      <td class="py-3 text-brand-600 text-xs">${formatDateTime(item.submitted_at)}</td>
      <td class="py-3">
        ${
          late
            ? `<span class="badge bg-red-100 text-red-600">
                 <i data-lucide="alert-circle" class="w-3 h-3"></i>
                 Nộp muộn
               </span>`
            : `<span class="badge bg-green-100 text-green-700">
                 <i data-lucide="check-circle" class="w-3 h-3"></i>
                 Đúng hạn
               </span>`
        }
      </td>
      <td class="py-3">
        <input
          type="number"
          min="0"
          max="10"
          step="0.5"
          value="${item.score ?? ""}"
          placeholder="--"
          data-id="${item.id}"
          class="score-input w-16 text-center border border-brand-200 rounded-lg px-2 py-1 text-sm font-semibold text-brand-900 outline-none bg-white/70"
        />
      </td>
      <td class="py-3">
        <div class="flex items-center gap-2">
          <button
            class="save-score-btn action-icon-btn bg-brand-100 text-brand-600 hover:bg-brand-200"
            data-id="${item.id}"
            type="button"
            title="Lưu điểm"
          >
            <i data-lucide="save" class="w-4 h-4"></i>
          </button>

          <button
            class="open-file-btn action-icon-btn bg-brand-50 text-brand-500 hover:bg-brand-100"
            data-id="${item.id}"
            type="button"
            title="Mở file"
          >
            <i data-lucide="eye" class="w-4 h-4"></i>
          </button>
        </div>
      </td>
    `;

    tbody.appendChild(tr);
  });

  tbody.querySelectorAll(".save-score-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const submissionId = btn.dataset.id;
      const input = tbody.querySelector(`.score-input[data-id="${submissionId}"]`);
      if (!input) return;

      try {
        btn.disabled = true;
        await saveScore(submissionId, input.value);

        const target = currentSubmissions.find((item) => String(item.id) === String(submissionId));
        if (target) {
          target.score = input.value === "" ? null : Number(input.value);
        }

        renderStats(currentExam, currentSubmissions);
        showToast("Lưu điểm thành công.");
      } catch (error) {
        console.error("save score error:", error);
        showToast(error.message || "Không lưu được điểm.");
      } finally {
        btn.disabled = false;
      }
    });
  });

  tbody.querySelectorAll(".open-file-btn, .file-open-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const submissionId = btn.dataset.id;
      const item = currentSubmissions.find((row) => String(row.id) === String(submissionId));
      if (!item) return;
      await openSubmissionFile(item);
    });
  });

  lucide.createIcons();
}

function buildExportRows(rows) {
  const exportRows = [];

  rankSubmissions(rows).forEach((item) => {
    const groupScore =
      item.score === null || item.score === undefined || Number.isNaN(Number(item.score))
        ? ""
        : Number(item.score);

    const members = normalizeMembers(item.group_members, item.student_name);

    if (!members.length) {
      return;
    }

    members.forEach((member) => {
      exportRows.push({
        "Họ tên học sinh": member,
        "Số điểm": groupScore
      });
    });
  });

  exportRows.sort((a, b) => {
    const fullNameA = String(a["Họ tên học sinh"] || "").trim();
    const fullNameB = String(b["Họ tên học sinh"] || "").trim();

    const partsA = fullNameA.split(/\s+/);
    const partsB = fullNameB.split(/\s+/);

    const lastNameA = partsA.length ? partsA[partsA.length - 1] : "";
    const lastNameB = partsB.length ? partsB[partsB.length - 1] : "";

    const compareLastName = lastNameA.localeCompare(lastNameB, "vi", {
      sensitivity: "base"
    });

    if (compareLastName !== 0) {
      return compareLastName;
    }

    return fullNameA.localeCompare(fullNameB, "vi", {
      sensitivity: "base"
    });
  });

  return exportRows;
}

function exportExcel() {
  if (!currentExam) {
    showToast("Chưa có dữ liệu phòng thi.");
    return;
  }

  const rows = buildExportRows(currentSubmissions);
  if (!rows.length) {
    showToast("Chưa có dữ liệu để xuất Excel.");
    return;
  }

  const worksheet = XLSX.utils.json_to_sheet(rows);
  worksheet["!cols"] = [{ wch: 28 }, { wch: 12 }];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Bang diem");

  const safeRoomId = String(currentExam.room_id || "room").replace(/[^\w-]/g, "_");
  XLSX.writeFile(workbook, `bang_diem_${safeRoomId}.xlsx`);

  showToast("Đã xuất file Excel.");
}
async function loadRankingByRoomId(userId, roomId) {
  if (!roomId) {
    showToast("Thiếu mã phòng.");
    return;
  }

  try {
    const exam = await fetchOwnedExamByRoomId(userId, roomId);

    if (!exam) {
      showToast("Bạn không có quyền truy cập phòng thi này.");
      return;
    }

    const submissions = await fetchSubmissionsByRoomId(roomId);

    currentExam = exam;
    currentSubmissions = submissions;

    renderPageInfo(exam);
    renderStats(exam, submissions);
    renderChart(submissions);
    renderTable(exam, submissions);
    lucide.createIcons();
  } catch (error) {
    console.error("loadRankingByRoomId error:", error);
    showToast("Không tải được dữ liệu phòng thi.");
  }
}
async function loadRankingPage() {
  try {
    const user = await requireAuthOrRedirect();
    if (!user) return;
    currentUser = user;

    const exams = await fetchOwnedExams(user.id);
    const roomIdFromQuery = getRoomIdFromQuery();
    const defaultRoomId =
      roomIdFromQuery || (exams.length ? exams[0].room_id : "");

    renderRoomSelect(exams, defaultRoomId);

    if (!defaultRoomId) {
      showToast("Bạn chưa có phòng thi nào.");
      return;
    }

    await loadRankingByRoomId(user.id, defaultRoomId);
  } catch (error) {
    console.error("loadRankingPage error:", error);
    showToast("Không tải được bảng xếp hạng.");
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  const backDashboardBtn = document.getElementById("backDashboardBtn");
  const logoutBtn = document.getElementById("logoutBtn");
  const refreshBtn = document.getElementById("refreshBtn");
  const exportExcelBtn = document.getElementById("exportExcelBtn");
  const exportExcelBtnBottom = document.getElementById("exportExcelBtnBottom");
  const roomSelect = document.getElementById("roomSelect");

  if (roomSelect) {
    roomSelect.addEventListener("change", async () => {
      const selectedRoomId = roomSelect.value;
      if (!selectedRoomId || !currentUser) return;
  
      const newUrl = `${window.location.pathname}?roomId=${encodeURIComponent(selectedRoomId)}`;
      window.history.replaceState({}, "", newUrl);
  
      await loadRankingByRoomId(currentUser.id, selectedRoomId);
    });
  }
  if (backDashboardBtn) {
    backDashboardBtn.addEventListener("click", goBackDashboard);
  }

  if (logoutBtn) {
    logoutBtn.addEventListener("click", handleLogout);
  }

  if (refreshBtn) {
    refreshBtn.addEventListener("click", async () => {
      const selectedRoomId = roomSelect?.value || currentExam?.room_id;
  
      if (!selectedRoomId || !currentUser) {
        await loadRankingPage();
        return;
      }
  
      await loadRankingByRoomId(currentUser.id, selectedRoomId);
    });
  }

  if (exportExcelBtn) {
    exportExcelBtn.addEventListener("click", exportExcel);
  }

  if (exportExcelBtnBottom) {
    exportExcelBtnBottom.addEventListener("click", exportExcel);
  }

  await loadRankingPage();
  lucide.createIcons();
});