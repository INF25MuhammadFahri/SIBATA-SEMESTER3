import { login, isLoggedIn } from "./auth.js";

document.addEventListener("DOMContentLoaded", () => {
  const urlParams = new URLSearchParams(window.location.search);
  const redirectTarget = urlParams.get("redirect")||"admin";
 // const redirectTarget = urlParams.get("redirect") || "admin";

  // Jika sudah login, langsung alihkan ke halaman tujuan
  if (isLoggedIn()) {
    window.location.replace(redirectTarget);
    return;
  }

  const form = document.getElementById("form-login");
  const usernameInput = document.getElementById("login-username");
  const passwordInput = document.getElementById("login-password");
  const alertBox = document.getElementById("login-alert");
  const togglePassBtn = document.getElementById("btn-toggle-password");

  if (togglePassBtn && passwordInput) {
    togglePassBtn.addEventListener("click", () => {
      const isPassword = passwordInput.type === "password";
      passwordInput.type = isPassword ? "text" : "password";
      togglePassBtn.textContent = isPassword ? "Sembunyikan" : "Lihat";
    });
  }

  if (form) {
    const submitBtn = form.querySelector('button[type="submit"]');

    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      const username = usernameInput.value;
      const password = passwordInput.value;

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Memverifikasi...";
      }

      try {
        const result = await login(username, password);
        
        
        if (result.success) {
          
          if (alertBox) {
            alertBox.className = "login-alert success";
            const sessionNote = result.sessionId
              ? ` (Sesi ID: ${result.sessionId.substring(0, 8)}...)`
              : "";
            alertBox.textContent = `Login berhasil${sessionNote}! Mengalihkan ke panel admin...`;
            alertBox.style.display = "block";
          }
          setTimeout(() => {
            window.location.href = redirectTarget;
          }, 400);
        } else {
          if (alertBox) {
            alertBox.className = "login-alert danger";
            alertBox.textContent = result.message || "Username atau password salah!";
            alertBox.style.display = "block";
          }
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = "Masuk ke Panel";
          }
        }
      } catch (err) {
        
        if (alertBox) {
          alertBox.className = "login-alert danger";
          alertBox.textContent = "Terjadi kesalahan saat memproses login.";
          alertBox.style.display = "block";
        }
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = "Masuk ke Panel";
        }
      }
    });
  }
});
