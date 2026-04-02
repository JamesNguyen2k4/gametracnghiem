async function handleLogout() {
    try {
      if (!window.supabaseClient) {
        throw new Error("Thiếu supabaseClient.");
      }
  
      await window.supabaseClient.auth.signOut();
      window.location.href = "../login/index.html";
    } catch (error) {
      console.error("logout error:", error);
      alert("Đăng xuất thất bại. Vui lòng thử lại.");
    }
  }
  
  function goToQuestionManager() {
    window.location.href = "../question/index.html";
  }
  
  function goToKeoco() {
    window.location.href = "../keoco/dashboard_keoco/index.html";
    // nếu sau này chuyển vào list_play thì sửa thành:
    // window.location.href = "../list_play/keoco/dashboard_keoco/index.html";
  }
  
  function goToTamquoc() {
    alert("Mục Tam quốc diễn nghĩa đang được phát triển.");
    // sau này dùng:
    // window.location.href = "../list_play/tamquoc/dashboard_tamquoc/index.html";
  }
  function goToCallVolunteer() {
    window.location.href = "../callvolunteer/dashboard_volunteer/index.html";
  }

  
  async function loadUserInfo(user) {
    const userDisplay = document.getElementById("user-display");
    const avatarInitial = document.getElementById("avatar-initial");
  
    const email = user?.email || "Người dùng";
    const displayName =
      user?.user_metadata?.display_name ||
      user?.user_metadata?.full_name ||
      email;
  
    if (userDisplay) {
      userDisplay.textContent = displayName;
    }
  
    if (avatarInitial) {
      avatarInitial.textContent = displayName.trim().charAt(0).toUpperCase();
    }
  }
  
  async function loadQuizCount(user) {
    const quizCountEl = document.getElementById("quizCount");
    if (!quizCountEl || !window.supabaseClient || !user?.id) return;
  
    try {
      const { count, error } = await window.supabaseClient
        .from("quizzes")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id);
  
      if (error) throw error;
  
      quizCountEl.textContent = count ?? 0;
    } catch (error) {
      console.error("loadQuizCount error:", error);
      quizCountEl.textContent = "0";
    }
  }
  function goToQuizTrivia() {
    window.location.href = "../list_play/quiz_tracnghiem/index.html";
  }
  document.addEventListener("DOMContentLoaded", async () => {
    const user = await requireAuthOrRedirect();
    if (!user) return;
  
    await loadUserInfo(user);
    await loadQuizCount(user);
  
    const logoutBtn = document.getElementById("logoutBtn");
    const questionManagerBtn = document.getElementById("questionManagerBtn");
    const keocoBtn = document.getElementById("keocoBtn");
    const tamquocBtn = document.getElementById("tamquocBtn");
    const gradingBtn = document.getElementById("gradingBtn");
    const callVolunteerBtn = document.getElementById("callVolunteerBtn");
    const quizTriviaBtn = document.getElementById("quizTriviaBtn");

    if (quizTriviaBtn) {
      quizTriviaBtn.addEventListener("click", goToQuizTrivia);
    }
    if (callVolunteerBtn) {
      callVolunteerBtn.addEventListener("click", goToCallVolunteer);
    }
    if (gradingBtn) {
      gradingBtn.addEventListener("click", () => {
        window.location.href = "../submit/dashboard_submit/index.html";
      });
    }
    if (logoutBtn) {
      logoutBtn.addEventListener("click", handleLogout);
    }
  
    if (questionManagerBtn) {
      questionManagerBtn.addEventListener("click", goToQuestionManager);
    }
  
    if (keocoBtn) {
      keocoBtn.addEventListener("click", goToKeoco);
    }
  
    if (tamquocBtn) {
      tamquocBtn.addEventListener("click", goToTamquoc);
    }
  
    
  });