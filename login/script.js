const loginForm = document.getElementById("loginForm");
const emailEl = document.getElementById("email");
const passwordEl = document.getElementById("password");
const loginBtn = document.getElementById("loginBtn");
const messageEl = document.getElementById("message");

function setMessage(text, isError = false) {
  if (!messageEl) return;
  messageEl.textContent = text;
  messageEl.style.color = isError ? "#fca5a5" : "#86efac";
}

function setLoading(isLoading) {
  if (!loginBtn) return;
  loginBtn.disabled = isLoading;
  loginBtn.textContent = isLoading ? "Đang đăng nhập..." : "Đăng nhập";
}

async function redirectIfLoggedIn() {
  const {
    data: { session },
    error
  } = await window.supabaseClient.auth.getSession();

  if (error) {
    console.error("getSession error:", error);
    return;
  }

  if (session) {
    window.location.href = "../dashboard/index.html";
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  await redirectIfLoggedIn();
});

loginForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const email = emailEl?.value.trim() || "";
  const password = passwordEl?.value || "";

  if (!email || !password) {
    setMessage("Vui lòng nhập đầy đủ email và mật khẩu.", true);
    return;
  }

  try {
    setLoading(true);
    setMessage("");

    const { error } = await window.supabaseClient.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      throw error;
    }

    setMessage("Đăng nhập thành công, đang chuyển trang...");
    window.location.href = "../dashboard/index.html";
  } catch (error) {
    console.error("login error:", error);
    setMessage(error.message || "Đăng nhập thất bại.", true);
  } finally {
    setLoading(false);
  }
});