async function handleLogout() {
    try {
      if (!window.supabaseClient) {
        throw new Error("Thiếu supabaseClient.");
      }
  
      await window.supabaseClient.auth.signOut();
      window.location.href = "../../login/index.html";
    } catch (error) {
      console.error("logout error:", error);
      alert("Đăng xuất thất bại. Vui lòng thử lại.");
    }
  }
  
  function goBackDashboard() {
    window.location.href = "../../dashboard/index.html";
  }
  
  function goToMakeExam() {
    window.location.href = "../makeExam/index.html";
  }
  
  function goToRanking() {
    window.location.href = "../ranking/index.html";
  }
  
  async function loadExamStats(user) {
    const roomCountEl = document.getElementById("roomCount");
    const activeRoomCountEl = document.getElementById("activeRoomCount");
    const todayRoomCountEl = document.getElementById("todayRoomCount");
  
    if (!user?.id || !window.supabaseClient) return;
  
    if (roomCountEl) roomCountEl.textContent = "...";
    if (activeRoomCountEl) activeRoomCountEl.textContent = "...";
    if (todayRoomCountEl) todayRoomCountEl.textContent = "...";
  
    try {
      const nowIso = new Date().toISOString();
  
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const startOfDayIso = startOfDay.toISOString();
  
      const { count: totalCount, error: totalError } = await window.supabaseClient
        .from("exam")
        .select("*", { count: "exact", head: true })
        .eq("id_usermake", user.id);
  
      if (totalError) throw totalError;
  
      const { count: activeCount, error: activeError } = await window.supabaseClient
        .from("exam")
        .select("*", { count: "exact", head: true })
        .eq("id_usermake", user.id)
        .gte("deadline", nowIso);
  
      if (activeError) throw activeError;
  
      let todayCount = 0;
  
      const { count: todayCountResult, error: todayError } = await window.supabaseClient
        .from("exam")
        .select("*", { count: "exact", head: true })
        .eq("id_usermake", user.id)
        .gte("created_at", startOfDayIso);
  
      if (!todayError) {
        todayCount = todayCountResult ?? 0;
      } else {
        console.warn("Không đếm được created_at, có thể bảng exam chưa có cột này:", todayError);
        todayCount = 0;
      }
  
      if (roomCountEl) roomCountEl.textContent = String(totalCount ?? 0);
      if (activeRoomCountEl) activeRoomCountEl.textContent = String(activeCount ?? 0);
      if (todayRoomCountEl) todayRoomCountEl.textContent = String(todayCount);
    } catch (error) {
      console.error("loadExamStats error:", error);
  
      if (roomCountEl) roomCountEl.textContent = "0";
      if (activeRoomCountEl) activeRoomCountEl.textContent = "0";
      if (todayRoomCountEl) todayRoomCountEl.textContent = "0";
    }
  }
  function goToSubmissionManager() {
    window.location.href = "../submission_manager/index.html";
  }
  document.addEventListener("DOMContentLoaded", async () => {
    console.log("dashboard_submit script loaded");
  
    const logoutBtn = document.getElementById("logoutBtn");
    const backDashboardBtn = document.getElementById("backDashboardBtn");
    const goMakeExamBtn = document.getElementById("goMakeExamBtn");
    const goRankingBtn = document.getElementById("goRankingBtn");
  
    console.log("goMakeExamBtn:", goMakeExamBtn);
    const goSubmissionManagerBtn = document.getElementById("goSubmissionManagerBtn");

    if (goSubmissionManagerBtn) {
    goSubmissionManagerBtn.addEventListener("click", goToSubmissionManager);
    }
    let user = null;
  
    try {
      user = await requireAuthOrRedirect();
      console.log("user:", user);
      if (!user) return;
    } catch (error) {
      console.error("Auth error:", error);
      return;
    }
  
    if (logoutBtn) {
      logoutBtn.addEventListener("click", handleLogout);
    }
  
    if (backDashboardBtn) {
      backDashboardBtn.addEventListener("click", goBackDashboard);
    }
  
    if (goMakeExamBtn) {
      goMakeExamBtn.addEventListener("click", () => {
        console.log("clicked make exam");
        goToMakeExam();
      });
    }
  
    if (goRankingBtn) {
      goRankingBtn.addEventListener("click", goToRanking);
    }
  
    await loadExamStats(user);
  
    lucide.createIcons();
  });