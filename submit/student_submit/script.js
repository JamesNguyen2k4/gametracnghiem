const STORAGE_BUCKET = "BaiNopHS";

let currentExam = null;

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

function getRoomIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return (params.get("roomId") || "").trim().toUpperCase();
}

function setLoading(button, isLoading, loadingText, defaultHtml) {
  if (!button) return;

  if (isLoading) {
    button.disabled = true;
    button.dataset.defaultHtml = defaultHtml || button.innerHTML;
    button.innerHTML = `
      <i data-lucide="refresh-cw" class="w-4 h-4 animate-spin"></i>
      ${loadingText}
    `;
    lucide.createIcons();
    return;
  }

  button.disabled = false;
  button.innerHTML = button.dataset.defaultHtml || defaultHtml || button.innerHTML;
  lucide.createIcons();
}

function renderExamInfo(exam, expired) {
  const examInfoBox = document.getElementById("examInfoBox");
  const examNameText = document.getElementById("examNameText");
  const examDescText = document.getElementById("examDescText");
  const examDeadlineText = document.getElementById("examDeadlineText");
  const examStatusText = document.getElementById("examStatusText");

  if (!examInfoBox || !examNameText || !examDescText || !examDeadlineText || !examStatusText) return;

  examNameText.textContent = exam.nameexam || "Không có tên";
  examDescText.textContent = exam.description || "Không có mô tả";
  examDeadlineText.textContent = formatDateTime(exam.deadline);

  if (expired) {
    examStatusText.textContent = "Đã hết hạn nộp";
    examStatusText.className = "text-sm font-semibold mt-1 text-red-600";
  } else {
    examStatusText.textContent = "Đang nhận bài";
    examStatusText.className = "text-sm font-semibold mt-1 text-green-600";
  }

  examInfoBox.classList.remove("hidden");
}

async function fetchExamByRoomId(roomId) {
  if (!window.supabaseClient) {
    throw new Error("Thiếu supabaseClient.");
  }

  const { data, error } = await window.supabaseClient
    .from("exam")
    .select("id, nameexam, description, deadline, room_id")
    .eq("room_id", roomId)
    .limit(1);

  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error("Không tìm thấy phòng thi.");
  }

  return data[0];
}

async function checkRoom() {
  const roomIdInput = document.getElementById("roomIdInput");
  const checkRoomBtn = document.getElementById("checkRoomBtn");

  const roomId = (roomIdInput?.value || "").trim().toUpperCase();
  if (!roomId) {
    showToast("Vui lòng nhập mã phòng.");
    return;
  }

  try {
    setLoading(checkRoomBtn, true, "Đang kiểm tra...", checkRoomBtn.innerHTML);

    const exam = await fetchExamByRoomId(roomId);
    currentExam = exam;

    const expired = new Date(exam.deadline) < new Date();
    renderExamInfo(exam, expired);

    roomIdInput.value = roomId;
    showToast(expired ? "Phòng thi đã hết hạn nộp." : "Đã tìm thấy phòng thi.");
  } catch (error) {
    console.error("check room error:", error);
    currentExam = null;
    document.getElementById("examInfoBox")?.classList.add("hidden");
    showToast(error.message || "Không kiểm tra được mã phòng.");
  } finally {
    setLoading(checkRoomBtn, false, "", "Kiểm tra phòng");
  }
}

function sanitizeFileName(name) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .toLowerCase();
}

async function uploadSubmissionFile(roomId, file) {
  if (!window.supabaseClient) {
    throw new Error("Thiếu supabaseClient.");
  }

  const timestamp = Date.now();
  const safeName = sanitizeFileName(file.name);
  const filePath = `${roomId}/${timestamp}-${safeName}`;

  const { error: uploadError } = await window.supabaseClient.storage
    .from(STORAGE_BUCKET)
    .upload(filePath, file, {
      upsert: false
    });

  if (uploadError) throw uploadError;

  return {
    filePath
  };
}

function validateSubmissionForm({ studentName, className, groupName, file, exam }) {
  if (!exam) {
    throw new Error("Vui lòng kiểm tra mã phòng trước khi nộp.");
  }

  if (new Date(exam.deadline) < new Date()) {
    throw new Error("Phòng thi đã hết hạn nộp.");
  }

  if (!className.trim()) {
    throw new Error("Vui lòng nhập lớp.");
  }

  if (!studentName.trim() && !groupName.trim()) {
    throw new Error("Vui lòng nhập họ tên hoặc tên nhóm.");
  }

  if (!file) {
    throw new Error("Vui lòng chọn tệp bài nộp.");
  }
}

async function handleSubmit(event) {
  event.preventDefault();

  const submitBtn = document.getElementById("submitBtn");
  const roomIdInput = document.getElementById("roomIdInput");
  const studentNameInput = document.getElementById("studentNameInput");
  const classNameInput = document.getElementById("classNameInput");
  const groupNameInput = document.getElementById("groupNameInput");
  const groupMembersInput = document.getElementById("groupMembersInput");
  const fileInput = document.getElementById("fileInput");

  const roomId = (roomIdInput?.value || "").trim().toUpperCase();
  const studentName = studentNameInput?.value || "";
  const className = classNameInput?.value || "";
  const groupName = groupNameInput?.value || "";
  const groupMembers = groupMembersInput?.value || "";
  const file = fileInput?.files?.[0] || null;

  try {
    setLoading(submitBtn, true, "Đang nộp bài...", submitBtn.innerHTML);

    if (!currentExam || currentExam.room_id !== roomId) {
      currentExam = await fetchExamByRoomId(roomId);
      renderExamInfo(currentExam, new Date(currentExam.deadline) < new Date());
    }

    validateSubmissionForm({
      studentName,
      className,
      groupName,
      file,
      exam: currentExam
    });

    const { filePath } = await uploadSubmissionFile(roomId, file);

    const payload = {
      exam_id: currentExam.id,
      room_id: roomId,
      student_name: studentName.trim() || null,
      class_name: className.trim(),
      group_name: groupName.trim() || null,
      group_members: groupMembers.trim() || null,
      file_name: file.name,
      file_path: filePath,
      file_url: null
    };

    const { error: insertError } = await window.supabaseClient
      .from("exam_submissions")
      .insert([payload]);

    if (insertError) throw insertError;

    document.getElementById("successRoomId").textContent = roomId;
    document.getElementById("successFileName").textContent = file.name;
    document.getElementById("successTime").textContent = formatDateTime(new Date().toISOString());
    document.getElementById("successCard")?.classList.remove("hidden");

    document.getElementById("submitForm")?.reset();
    roomIdInput.value = roomId;

    showToast("Nộp bài thành công!");
  } catch (error) {
    console.error("submit error:", error);
    showToast(error.message || "Không thể nộp bài.");
  } finally {
    setLoading(submitBtn, false, "", "Nộp bài");
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  const roomIdInput = document.getElementById("roomIdInput");
  const checkRoomBtn = document.getElementById("checkRoomBtn");
  const submitForm = document.getElementById("submitForm");

  const roomIdFromUrl = getRoomIdFromUrl();
  if (roomIdFromUrl && roomIdInput) {
    roomIdInput.value = roomIdFromUrl;
    try {
      currentExam = await fetchExamByRoomId(roomIdFromUrl);
      renderExamInfo(currentExam, new Date(currentExam.deadline) < new Date());
    } catch (error) {
      console.error("autoload room error:", error);
      showToast("Không tìm thấy phòng thi từ liên kết.");
    }
  }

  if (checkRoomBtn) {
    checkRoomBtn.addEventListener("click", checkRoom);
  }

  if (submitForm) {
    submitForm.addEventListener("submit", handleSubmit);
  }

  lucide.createIcons();
});