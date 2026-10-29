const card = document.getElementById("card");
const body = document.body;
const switchButton = document.getElementById("midBtn");
const switchDescription = document.getElementById("switchDescription");
const toast = document.getElementById("toast");
const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");
const accountPanel = document.getElementById("accountPanel");
const accountDetails = document.getElementById("accountDetails");
let isRegister = false;
let toastTimer;

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 3000);
}

async function apiRequest(url, options = {}) {
  const response = await fetch(url, {
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "حدث خطأ. حاول مرة أخرى.");
  return data;
}

function setBusy(form, busy, busyText) {
  const button = form.querySelector('button[type="submit"]');
  if (busy) {
    button.dataset.originalText = button.textContent;
    button.textContent = busyText;
    button.disabled = true;
  } else {
    button.textContent = button.dataset.originalText || button.textContent;
    button.disabled = false;
  }
}

function toggleAuth(forceRegister) {
  isRegister = typeof forceRegister === "boolean" ? forceRegister : !isRegister;
  card.className = isRegister ? "card active-right" : "card active-left";
  body.classList.toggle("show-register", isRegister);
  switchButton.textContent = isRegister ? "Login" : "Register";
  switchDescription.innerHTML = isRegister ? "Already have<br>an account?" : "Don't have<br>an account?";
}

function showAccount(user) {
  card.hidden = true;
  accountPanel.hidden = false;
  accountDetails.textContent = `${user.username} · ${user.email}`;
}

function showForms() {
  accountPanel.hidden = true;
  card.hidden = false;
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!loginForm.reportValidity()) return;
  setBusy(loginForm, true, "Signing in…");
  const formData = new FormData(loginForm);
  try {
    const result = await apiRequest("/api/login", {
      method: "POST",
      body: JSON.stringify({
        login: formData.get("login"),
        password: formData.get("password")
      })
    });
    loginForm.reset();
    showAccount(result.user);
    showToast(result.message);
  } catch (error) {
    showToast(error.message);
  } finally {
    setBusy(loginForm, false);
  }
});

registerForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!registerForm.reportValidity()) return;
  setBusy(registerForm, true, "Creating account…");
  const formData = new FormData(registerForm);
  try {
    const result = await apiRequest("/api/register", {
      method: "POST",
      body: JSON.stringify({
        username: formData.get("username"),
        email: formData.get("email"),
        password: formData.get("password")
      })
    });
    registerForm.reset();
    showAccount(result.user);
    showToast(result.message);
  } catch (error) {
    showToast(error.message);
  } finally {
    setBusy(registerForm, false);
  }
});

switchButton.addEventListener("click", () => toggleAuth());
document.getElementById("bottomSwitch").addEventListener("click", () => toggleAuth(false));
document.getElementById("forgotBtn").addEventListener("click", () => {
  showToast("ميزة استعادة كلمة المرور تحتاج إلى إعداد البريد الإلكتروني.");
});
document.getElementById("logoutBtn").addEventListener("click", async () => {
  try {
    const result = await apiRequest("/api/logout", { method: "POST", body: "{}" });
    showForms();
    toggleAuth(false);
    showToast(result.message);
  } catch (error) {
    showToast(error.message);
  }
});

document.querySelectorAll(".social").forEach((button) => {
  button.addEventListener("click", () => showToast("تسجيل الدخول الاجتماعي غير مفعّل بعد."));
});

async function restoreSession() {
  try {
    const result = await apiRequest("/api/me");
    showAccount(result.user);
  } catch {
    // Not signed in; keep the login/register form visible.
  }
}
restoreSession();
