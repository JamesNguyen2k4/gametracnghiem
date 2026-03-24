function generateRoomId(length = 6) {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let id = "";
    for (let i = 0; i < length; i += 1) {
      id += chars[Math.floor(Math.random() * chars.length)];
    }
    return id;
  }
  
  async function generateUniqueRoomId(maxRetries = 10) {
    if (!window.supabaseClient) {
      throw new Error("Thiếu supabaseClient.");
    }
  
    for (let i = 0; i < maxRetries; i += 1) {
      const roomId = generateRoomId();
  
      const { data, error } = await window.supabaseClient
        .from("exam")
        .select("id")
        .eq("room_id", roomId)
        .limit(1);
  
      if (error) throw error;
      if (!data || data.length === 0) {
        return roomId;
      }
    }
  
    throw new Error("Không thể tạo mã phòng duy nhất. Vui lòng thử lại.");
  }
  
  function formatDeadline(value) {
    if (!value) return "";
    const d = new Date(value);
    return d.toLocaleString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  }
  
  function buildStudentSubmitLink(roomId) {
    const origin = window.location.origin;
    return `${origin}/submit/student_submit/index.html?roomId=${encodeURIComponent(roomId)}`;
  }
  
  function showToast(message) {
    const toast = document.getElementById("toast");
    const toastMsg = document.getElementById("toastMsg");
    if (!toast || !toastMsg) return;
  
    toastMsg.textContent = message;
    toast.classList.add("show");
  
    window.clearTimeout(showToast._timer);
    showToast._timer = window.setTimeout(() => {
      toast.classList.remove("show");
    }, 2500);
  }
  
  function showResultCard({ name, deadline, roomId, link }) {
    const previewCard = document.getElementById("previewCard");
    const resultCard = document.getElementById("resultCard");
  
    document.getElementById("resName").textContent = name;
    document.getElementById("resDeadline").textContent = formatDeadline(deadline);
    document.getElementById("resId").textContent = roomId;
    document.getElementById("resLink").textContent = link;
  
    previewCard?.classList.add("hidden");
    resultCard?.classList.remove("hidden");
    resultCard?.classList.add("fade-in");
  }
  
  function resetFormView() {
    const form = document.getElementById("examForm");
    const resultCard = document.getElementById("resultCard");
    const previewCard = document.getElementById("previewCard");
  
    form?.reset();
    resultCard?.classList.add("hidden");
    previewCard?.classList.remove("hidden");
  }
  
  async function copyElementText(elementId, successMessage) {
    const element = document.getElementById(elementId);
    if (!element) return;
  
    try {
      await navigator.clipboard.writeText(element.textContent || "");
      showToast(successMessage);
    } catch (error) {
      console.error("copy error:", error);
      showToast("Không thể sao chép");
    }
  }
  
  async function handleCreate(event) {
    event.preventDefault();
  
    const createBtn = document.getElementById("createBtn");
    const examNameInput = document.getElementById("examName");
    const examDescInput = document.getElementById("examDesc");
    const examDeadlineInput = document.getElementById("examDeadline");
  
    const nameExam = examNameInput?.value.trim() || "";
    const description = examDescInput?.value.trim() || "";
    const deadline = examDeadlineInput?.value || "";
  
    if (!nameExam || !deadline) {
      showToast("Vui lòng nhập đủ tên bài thi và hạn nộp");
      return;
    }
  
    const deadlineDate = new Date(deadline);
    if (Number.isNaN(deadlineDate.getTime())) {
      showToast("Hạn nộp không hợp lệ");
      return;
    }
  
    const now = new Date();
    if (deadlineDate <= now) {
      showToast("Hạn nộp phải lớn hơn thời điểm hiện tại");
      return;
    }
  
    try {
      if (!window.supabaseClient) {
        throw new Error("Thiếu supabaseClient.");
      }
  
      const user = await requireAuthOrRedirect();
      if (!user) return;
  
      if (createBtn) {
        createBtn.disabled = true;
        createBtn.innerHTML = `
          <i data-lucide="loader-circle" class="w-5 h-5 animate-spin"></i>
          Đang tạo phòng thi...
        `;
        lucide.createIcons();
      }
  
      const roomId = await generateUniqueRoomId();
      const submitLink = buildStudentSubmitLink(roomId);
  
      const payload = {
        nameexam: nameExam,
        description,
        deadline: deadlineDate.toISOString(),
        room_id: roomId,
        id_usermake: user.id
      };
  
      const { error } = await window.supabaseClient
        .from("exam")
        .insert([payload]);
  
      if (error) throw error;
  
      showResultCard({
        name: nameExam,
        deadline,
        roomId,
        link: submitLink
      });
  
      showToast("Tạo phòng thi thành công!");
    } catch (error) {
      console.error("create exam error:", error);
      showToast(error.message || "Không thể tạo phòng thi");
    } finally {
      if (createBtn) {
        createBtn.disabled = false;
        createBtn.innerHTML = `
          <i data-lucide="sparkles" class="w-5 h-5"></i>
          Tạo phòng thi
        `;
        lucide.createIcons();
      }
    }
  }
  
  async function handleLogout() {
    try {
      if (!window.supabaseClient) {
        throw new Error("Thiếu supabaseClient.");
      }
  
      await window.supabaseClient.auth.signOut();
      window.location.href = "../../login/index.html";
    } catch (error) {
      console.error("logout error:", error);
      showToast("Đăng xuất thất bại");
    }
  }
  
  function goBackDashboardSubmit() {
    window.location.href = "../dashboard_submit/index.html";
  }
  
  function goToRankingByCreatedRoom() {
    const roomId = document.getElementById("resId")?.textContent?.trim();
    if (!roomId) {
      showToast("Chưa có mã phòng để xem xếp hạng");
      return;
    }
  
    window.location.href = `../ranking/index.html?roomId=${encodeURIComponent(roomId)}`;
  }
  
  document.addEventListener("DOMContentLoaded", async () => {
    const user = await requireAuthOrRedirect();
    if (!user) return;
  
    const examForm = document.getElementById("examForm");
    const logoutBtn = document.getElementById("logoutBtn");
    const backDashboardSubmitBtn = document.getElementById("backDashboardSubmitBtn");
    const createNewRoomBtn = document.getElementById("createNewRoomBtn");
    const goLeaderboardBtn = document.getElementById("goLeaderboardBtn");
    const copyIdBtn = document.getElementById("copyIdBtn");
    const copyLinkBtn = document.getElementById("copyLinkBtn");
  
    if (examForm) {
      examForm.addEventListener("submit", handleCreate);
    }
  
    if (logoutBtn) {
      logoutBtn.addEventListener("click", handleLogout);
    }
  
    if (backDashboardSubmitBtn) {
      backDashboardSubmitBtn.addEventListener("click", goBackDashboardSubmit);
    }
  
    if (createNewRoomBtn) {
      createNewRoomBtn.addEventListener("click", resetFormView);
    }
  
    if (goLeaderboardBtn) {
      goLeaderboardBtn.addEventListener("click", goToRankingByCreatedRoom);
    }
  
    if (copyIdBtn) {
      copyIdBtn.addEventListener("click", () => {
        copyElementText("resId", "Đã sao chép ID phòng!");
      });
    }
  
    if (copyLinkBtn) {
      copyLinkBtn.addEventListener("click", () => {
        copyElementText("resLink", "Đã sao chép link nộp bài!");
      });
    }
  
    lucide.createIcons();
  });