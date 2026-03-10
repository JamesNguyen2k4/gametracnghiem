const registerForm = document.getElementById("registerForm");
const displayNameEl = document.getElementById("displayName");
const emailEl = document.getElementById("email");
const passwordEl = document.getElementById("password");
const confirmPasswordEl = document.getElementById("confirmPassword");
const agreeTermsEl = document.getElementById("agreeTerms");
const registerBtn = document.getElementById("registerBtn");
const messageEl = document.getElementById("message");

function setMessage(text, isError = false) {
  if (!messageEl) return;
  messageEl.textContent = text;
  messageEl.style.color = isError ? "#fca5a5" : "#86efac";
}

function setLoading(isLoading) {
  if (!registerBtn) return;
  registerBtn.disabled = isLoading;
  registerBtn.textContent = isLoading ? "Đang tạo tài khoản..." : "Tạo tài khoản";
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

registerForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const displayName = displayNameEl?.value.trim() || "";
  const email = emailEl?.value.trim() || "";
  const password = passwordEl?.value || "";
  const confirmPassword = confirmPasswordEl?.value || "";
  const agreeTerms = agreeTermsEl?.checked;

  if (!email || !password || !confirmPassword) {
    setMessage("Vui lòng nhập đầy đủ thông tin bắt buộc.", true);
    return;
  }

  if (password.length < 6) {
    setMessage("Mật khẩu phải có ít nhất 6 ký tự.", true);
    return;
  }

  if (password !== confirmPassword) {
    setMessage("Mật khẩu nhập lại không khớp.", true);
    return;
  }

  if (!agreeTerms) {
    setMessage("Bạn cần đồng ý với điều khoản sử dụng.", true);
    return;
  }

  try {
    setLoading(true);
    setMessage("");

    const { data, error } = await window.supabaseClient.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: displayName || email
        }
      }
    });

    if (error) {
      throw error;
    }

    const user = data.user;

    if (user) {
      const { error: profileError } = await window.supabaseClient
        .from("profiles")
        .upsert([
          {
            id: user.id,
            display_name: displayName || email
          }
        ]);

      if (profileError) {
        throw profileError;
      }
    }

    setMessage("Đăng ký thành công. Bạn có thể cần xác thực email trước khi đăng nhập.");
    registerForm.reset();
  } catch (error) {
    console.error("register error:", error);
    setMessage(error.message || "Đăng ký thất bại.", true);
  } finally {
    setLoading(false);
  }
});