const API_BASE_URL = window.NEXFORD_API_BASE_URL ||
  (["localhost", "127.0.0.1"].includes(window.location.hostname)
    ? "http://localhost:4000"
    : window.location.origin);
const TOKEN_KEY = "nexford-access-token";
const USER_KEY = "nexford-user";

const api = {
  register: "/api/auth/register",
  verifyRegistration: "/api/auth/verify-registration",
  forgotPassword: "/api/auth/forgot-password",
  resetPassword: "/api/auth/reset-password",
  login: "/api/auth/userLogin",
  createTradingAccount: "/api/auth/trading-account",
  tradingAccounts: "/api/auth/trading-accounts",
  refresh: "/api/auth/refresh",
  logout: "/api/auth/userLogout",
  trades: "/api/trades",
  account: "/api/trades/account",
  openTrade: "/api/trades/open",
  symbols: "/api/symbols",
  symbolSearch: "/api/symbols/search",
  watchlist: "/api/user/watchlist",
  adminBalance: "/api/trades/admin/balance/deposit",
  adminCredit: "/api/trades/admin/credit/deposit",
  adminPassword: "/api/trades/admin/user/change-password",
  cacheSizes: "/api/trades/admin/cache-sizes",
  clientRequests: "/api/client-requests",
  transfers: "/api/transfers",
  wallet: "/api/transfers/wallet"
};

let currentWatchlist = [];
let latestTrades = { open: [], closed: [], balance: null };
let latestClientRequests = [];
let latestWalletSummary = null;
let latestTransfers = [];
let latestTradingAccounts = [];
let realtimeClient = null;

const depositBankDetails = {
  bankName: "Apna Sahakari Bank Ltd.",
  accountName: "Anita Enterprises",
  accountNumber: "055012100000300",
  ifscCode: "ASBL0000055"
};

function getToken() {
  return sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY);
}

function setToken(token, remember = false) {
  sessionStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(TOKEN_KEY);
  if (!token) return;
  (remember ? localStorage : sessionStorage).setItem(TOKEN_KEY, token);
}

function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || sessionStorage.getItem(USER_KEY) || "null");
  } catch {
    return null;
  }
}

function setStoredUser(user, remember = false) {
  localStorage.removeItem(USER_KEY);
  sessionStorage.removeItem(USER_KEY);
  if (!user) return;
  (remember ? localStorage : sessionStorage).setItem(USER_KEY, JSON.stringify(user));
}

function authHeaders() {
  const token = getToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
}

async function readBody(response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

async function backendFetch(path, options = {}, retry = true) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: { ...authHeaders(), ...(options.headers || {}) },
    credentials: "omit"
  });

  if (response.status === 401 && retry && getToken() && await refreshAccessToken()) {
    return backendFetch(path, options, false);
  }

  return response;
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function money(value) {
  return `$${Number(value || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function compact(value) {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "number") return Number.isInteger(value) ? String(value) : value.toFixed(4).replace(/\.?0+$/, "");
  return String(value);
}

function showMessage(text, ok = false) {
  const message = document.querySelector("#authMessage") || document.querySelector("#dashboardMessage");
  if (!message) return;
  message.textContent = text;
  message.classList.toggle("success", ok);
}

async function refreshAccessToken() {
  const oldToken = getToken();
  if (!oldToken) return false;
  const response = await fetch(`${API_BASE_URL}${api.refresh}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ oldToken }),
    credentials: "omit"
  });
  if (!response.ok) return false;
  const data = await readBody(response);
  if (!data.token) return false;
  const remember = Boolean(localStorage.getItem(TOKEN_KEY));
  setToken(data.token, remember);
  return true;
}

async function logout() {
  const token = getToken();
  setToken("");
  setStoredUser(null);
  window.location.href = "login.html";

  if (!token) return;
  try {
    fetch(`${API_BASE_URL}${api.logout}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      credentials: "omit",
      keepalive: true
    }).catch(() => {});
  } catch {}
}

const signupForm = document.querySelector("#signupForm");
let otpCountdownTimer = null;

function clearSignupAutofillLeak() {
  if (!signupForm) return;
  const emailInput = signupForm.querySelector('input[name="email"]');
  const passwordInput = signupForm.querySelector('input[name="password"]');
  const confirmPasswordInput = signupForm.querySelector('input[name="confirmPassword"]');

  if (emailInput && /^\d+$/.test(String(emailInput.value || "").trim())) {
    emailInput.value = "";
  }

  if (passwordInput?.value && !confirmPasswordInput?.value) {
    passwordInput.value = "";
  }
}

function getSignupButton() {
  return document.querySelector("#signupButton");
}

function getSignupOtpInput() {
  return document.querySelector("#otpField input");
}

function syncSignupOtpButton() {
  const signupButton = getSignupButton();
  const otpInput = getSignupOtpInput();
  if (!signupForm || !signupButton || signupForm.dataset.awaitingOtp !== "true") return;
  signupButton.disabled = String(otpInput?.value || "").trim().length !== 6;
}

clearSignupAutofillLeak();

function buildSignupPayload(form) {
  return {
    name: form.get("name"),
    email: form.get("email"),
    password: String(form.get("password") || ""),
    role: "USER"
  };
}

function formatOtpTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function startOtpCountdown(expiresInMinutes = 5) {
  const otpStatus = document.querySelector("#otpStatus");
  const otpTimer = document.querySelector("#otpTimer");
  const resendButton = document.querySelector("#resendOtpButton");
  const signupButton = document.querySelector("#signupButton");
  if (!otpStatus || !otpTimer || !resendButton) return;

  clearInterval(otpCountdownTimer);
  let remainingSeconds = Math.max(1, Number(expiresInMinutes) || 5) * 60;
  otpStatus.hidden = false;
  resendButton.hidden = true;
  syncSignupOtpButton();
  otpTimer.textContent = `Enter OTP within ${formatOtpTime(remainingSeconds)}`;

  otpCountdownTimer = setInterval(() => {
    remainingSeconds -= 1;
    if (remainingSeconds <= 0) {
      clearInterval(otpCountdownTimer);
      otpTimer.textContent = "OTP expired. Please resend OTP.";
      resendButton.hidden = false;
      signupButton.disabled = true;
      return;
    }
    otpTimer.textContent = `Enter OTP within ${formatOtpTime(remainingSeconds)}`;
  }, 1000);
}

async function requestSignupOtp(form) {
  const signupButton = getSignupButton();
  const password = String(form.get("password") || "");
  const confirmPassword = String(form.get("confirmPassword") || "");

  if (password !== confirmPassword) {
    showMessage("Passwords do not match.");
    return false;
  }

  try {
    if (signupButton) {
      signupButton.disabled = true;
      signupButton.textContent = "Sending OTP...";
    }

    const response = await backendFetch(api.register, {
      method: "POST",
      body: JSON.stringify(buildSignupPayload(form))
    }, false);
    const data = await readBody(response);
    showMessage(data.message || data.msg || data.error || (response.ok ? "OTP ready. Check the shown delivery mode." : "Signup failed."), response.ok);

    if (!response.ok) return false;

    signupForm.dataset.awaitingOtp = "true";
    document.querySelector("#otpField")?.removeAttribute("hidden");
    document.querySelector("#otpField input")?.setAttribute("required", "required");
    document.querySelector("#signupButton").textContent = "Verify OTP";
    startOtpCountdown(data.expiresInMinutes || 5);
    return true;
  } catch {
    showMessage("Backend not reachable. Start Spring Boot on port 8084.");
    return false;
  } finally {
    if (signupButton && signupForm?.dataset.awaitingOtp !== "true") {
      signupButton.disabled = false;
      signupButton.textContent = "Create account";
    }
  }
}

signupForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = new FormData(signupForm);
  const awaitingOtp = signupForm.dataset.awaitingOtp === "true";

  if (awaitingOtp) {
    const email = String(form.get("email") || "").trim();
    const otp = String(form.get("otp") || "").trim();

    if (!otp) {
      showMessage("Enter the OTP sent to your email.");
      return;
    }

    try {
      const signupButton = getSignupButton();
      if (signupButton) {
        signupButton.disabled = true;
        signupButton.textContent = "Verifying...";
      }

      const response = await backendFetch(api.verifyRegistration, {
        method: "POST",
        body: JSON.stringify({ email, otp, password: String(form.get("password") || "") })
      }, false);
      const data = await readBody(response);
      if (response.ok) {
        showMessage(data.message || "User has been created.", true);
        setTimeout(() => { window.location.href = "login.html"; }, 1800);
      } else {
        showMessage(data.message || data.error || "OTP verification failed.");
        if (signupButton) {
          signupButton.textContent = "Verify OTP";
          syncSignupOtpButton();
        }
      }
    } catch {
      showMessage("Backend not reachable. Start Spring Boot on port 8084.");
      const signupButton = getSignupButton();
      if (signupButton) {
        signupButton.textContent = "Verify OTP";
        syncSignupOtpButton();
      }
    }
    return;
  }

  await requestSignupOtp(form);
});

document.querySelector("#resendOtpButton")?.addEventListener("click", async () => {
  const form = new FormData(signupForm);
  document.querySelector("#resendOtpButton").hidden = true;
  document.querySelector("#signupButton").disabled = false;
  document.querySelector("#otpField input").value = "";
  await requestSignupOtp(form);
});

getSignupOtpInput()?.addEventListener("input", syncSignupOtpButton);

const loginForm = document.querySelector("#loginForm");
const forgotPasswordForm = document.querySelector("#forgotPasswordForm");
let resetOtpCountdownTimer = null;

function setForgotMode(enabled) {
  if (!loginForm || !forgotPasswordForm) return;
  loginForm.hidden = enabled;
  forgotPasswordForm.hidden = !enabled;
  showMessage("");
}

function resetForgotPasswordFormState() {
  clearInterval(resetOtpCountdownTimer);
  forgotPasswordForm?.reset();
  if (forgotPasswordForm) forgotPasswordForm.dataset.awaitingOtp = "false";
  ["#resetOtpField", "#newPasswordField", "#confirmNewPasswordField", "#resetOtpStatus"].forEach((selector) => {
    const el = document.querySelector(selector);
    if (el) el.hidden = true;
  });
  ["#resetOtpField input", "#newPasswordField input", "#confirmNewPasswordField input"].forEach((selector) => {
    document.querySelector(selector)?.removeAttribute("required");
  });
  const forgotButton = document.querySelector("#forgotPasswordButton");
  if (forgotButton) {
    forgotButton.textContent = "Send reset OTP";
    forgotButton.disabled = false;
  }
}

function startResetOtpCountdown(expiresInMinutes = 5) {
  const otpStatus = document.querySelector("#resetOtpStatus");
  const otpTimer = document.querySelector("#resetOtpTimer");
  const resendButton = document.querySelector("#resendResetOtpButton");
  const resetButton = document.querySelector("#forgotPasswordButton");
  if (!otpStatus || !otpTimer || !resendButton || !resetButton) return;

  clearInterval(resetOtpCountdownTimer);
  let remainingSeconds = Math.max(1, Number(expiresInMinutes) || 5) * 60;
  otpStatus.hidden = false;
  resendButton.hidden = true;
  resetButton.disabled = false;
  otpTimer.textContent = `Enter OTP within ${formatOtpTime(remainingSeconds)}`;

  resetOtpCountdownTimer = setInterval(() => {
    remainingSeconds -= 1;
    if (remainingSeconds <= 0) {
      clearInterval(resetOtpCountdownTimer);
      otpTimer.textContent = "OTP expired. Please resend OTP.";
      resendButton.hidden = false;
      resetButton.disabled = true;
      return;
    }
    otpTimer.textContent = `Enter OTP within ${formatOtpTime(remainingSeconds)}`;
  }, 1000);
}

async function requestPasswordResetOtp(form) {
  const email = String(form.get("email") || "").trim();
  if (!email) {
    showMessage("Enter your email address.");
    return false;
  }

  try {
    const response = await backendFetch(api.forgotPassword, {
      method: "POST",
      body: JSON.stringify({ email })
    }, false);
    const data = await readBody(response);
    showMessage(data.message || data.error || (response.ok ? "OTP sent to email." : "Could not send OTP."), response.ok);
    if (!response.ok) return false;

    forgotPasswordForm.dataset.awaitingOtp = "true";
    document.querySelector("#resetOtpField").hidden = false;
    document.querySelector("#newPasswordField").hidden = false;
    document.querySelector("#confirmNewPasswordField").hidden = false;
    document.querySelector("#resetOtpField input").setAttribute("required", "required");
    document.querySelector("#newPasswordField input").setAttribute("required", "required");
    document.querySelector("#confirmNewPasswordField input").setAttribute("required", "required");
    document.querySelector("#forgotPasswordButton").textContent = "Reset password";
    startResetOtpCountdown(data.expiresInMinutes || 5);
    return true;
  } catch {
    showMessage("Backend not reachable. Start Spring Boot on port 8084.");
    return false;
  }
}

document.querySelector("#showForgotPassword")?.addEventListener("click", () => setForgotMode(true));
document.querySelector("#backToLoginButton")?.addEventListener("click", () => {
  resetForgotPasswordFormState();
  setForgotMode(false);
});

forgotPasswordForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = new FormData(forgotPasswordForm);
  const awaitingOtp = forgotPasswordForm.dataset.awaitingOtp === "true";

  if (!awaitingOtp) {
    await requestPasswordResetOtp(form);
    return;
  }

  const newPassword = String(form.get("newPassword") || "");
  const confirmNewPassword = String(form.get("confirmNewPassword") || "");
  if (newPassword !== confirmNewPassword) {
    showMessage("New passwords do not match.");
    return;
  }

  try {
    const response = await backendFetch(api.resetPassword, {
      method: "POST",
      body: JSON.stringify({
        email: form.get("email"),
        otp: form.get("otp"),
        newPassword
      })
    }, false);
    const data = await readBody(response);
    showMessage(data.message || data.error || (response.ok ? "Password reset successful." : "Password reset failed."), response.ok);
    if (response.ok) {
      setTimeout(() => {
        resetForgotPasswordFormState();
        setForgotMode(false);
      }, 1200);
    }
  } catch {
    showMessage("Backend not reachable. Start Spring Boot on port 8084.");
  }
});

document.querySelector("#resendResetOtpButton")?.addEventListener("click", async () => {
  const form = new FormData(forgotPasswordForm);
  document.querySelector("#resendResetOtpButton").hidden = true;
  document.querySelector("#forgotPasswordButton").disabled = false;
  document.querySelector("#resetOtpField input").value = "";
  await requestPasswordResetOtp(form);
});

loginForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = new FormData(loginForm);
  const remember = Boolean(form.get("remember"));
  const loginId = String(form.get("loginId") || form.get("email") || "").trim();
  const password = String(form.get("password") || "");
  const loginPayload = /^\d+$/.test(loginId)
    ? { id: loginId, password }
    : { email: loginId, password };

  try {
    const response = await backendFetch(api.login, {
      method: "POST",
      body: JSON.stringify(loginPayload)
    }, false);
    const data = await readBody(response);

    if (!response.ok || !data.token) {
      showMessage(data.message || "Login failed.");
      return;
    }

    setToken(data.token, remember);
    setStoredUser(data.user, remember);
    showMessage("Login successful.", true);
    window.location.href = "dashboard.html";
  } catch {
    showMessage("Portal backend not reachable. Start Node on port 4000.");
  }
});

function requireAuth() {
  if (!document.querySelector("#dashboardWelcome")) return false;
  if (!getToken()) {
    window.location.href = "login.html";
    return false;
  }
  return true;
}

async function loadDashboard() {
  if (!requireAuth()) return;
  const user = getStoredUser() || {};
  renderProfile(user);
  renderTradingAccountState(user);
  bindDashboardEvents();
  await Promise.allSettled([loadTradingAccounts(), loadWalletSummary(), loadAccount(), loadTrades(), loadClientRequests(), loadTransfers()]);
}

function renderProfile(user) {
  const name = user.name || "Trader";
  const role = String(user.role || "USER").toUpperCase();
  document.querySelector("#dashboardWelcome").textContent = `Welcome, ${name}`;
  document.querySelector("#roleBadge").textContent = role;
  document.querySelector("#profileHeroName") && (document.querySelector("#profileHeroName").textContent = name);
  document.querySelector("#profileName").textContent = name;
  document.querySelector("#profileMobile") && (document.querySelector("#profileMobile").textContent = user.phone || user.mobile || "-");
  document.querySelector("#profileEmail").textContent = user.email || "-";
  document.querySelector("#upiDepositEmail") && (document.querySelector("#upiDepositEmail").value = user.email || "");
  document.querySelector("#withdrawEmail") && (document.querySelector("#withdrawEmail").value = user.email || "");
  document.querySelector("#withdrawTradingAccountNumber") && (document.querySelector("#withdrawTradingAccountNumber").value = user.accountNumber || "");
  document.querySelector("#upiAutoEmail") && (document.querySelector("#upiAutoEmail").value = user.email || "");
  document.querySelector("#cryptoChillEmail") && (document.querySelector("#cryptoChillEmail").value = user.email || "");
  document.querySelector("#profileId").textContent = user.id || "-";
  document.querySelector("#profileAccount").textContent = user.accountNumber || "-";
  document.querySelector("#profileAccountType").textContent = user.accountType || "-";
  document.querySelector("#profileSwap").textContent = user.swapValue === true ? "Yes" : user.swapValue === false ? "No" : "-";
  document.querySelectorAll(".admin-only").forEach((el) => { el.hidden = role !== "ADMIN"; });
}

function renderTradingAccountState(user = getStoredUser() || {}, accounts = latestTradingAccounts) {
  const createBox = document.querySelector("#createTradingAccountBox");
  const tableBody = document.querySelector("#tradingAccountsBody");
  const selectedId = user.selectedTradingAccountId;
  const existingTypes = new Set((accounts || []).map((account) => String(account.accountType || "").toUpperCase()));
  const missingTypes = ["DEMO", "LIVE"].filter((type) => !existingTypes.has(type));
  const hasTradingAccount = Boolean(user.accountNumber);

  if (createBox) {
    createBox.hidden = missingTypes.length === 0;
    const select = createBox.querySelector('select[name="accountType"]');
    if (select) {
      select.innerHTML = missingTypes.map((type) => (
        `<option value="${type}">${type === "DEMO" ? "Demo account - $5,000" : "Live account - $0"}</option>`
      )).join("");
    }
  }
  if (!tableBody) return;

  tableBody.innerHTML = accounts?.length
    ? accounts.map((account) => {
        const isSelected = String(account.id) === String(selectedId);
        return `<tr>
          <td>${compact(account.accountNumber)}</td>
          <td>${compact(account.accountType)}</td>
          <td>${compact(account.accountPlanName || account.accountPlan)}</td>
          <td>${account.isBlocked ? "Blocked" : isSelected ? "Selected" : "Available"}</td>
          <td>${isSelected ? "In use" : `<button class="outline-button select-trading-account" type="button" data-account-id="${account.id}">Use this account</button>`}</td>
        </tr>`;
      }).join("")
    : `<tr><td colspan="5">No trading account available. Create Demo or Live above.</td></tr>`;
}

function bindDashboardEvents() {
  if (document.body.dataset.dashboardBound) return;
  document.body.dataset.dashboardBound = "true";

  document.addEventListener("click", (event) => {
    if (event.target.closest("#logoutButton")) {
      event.preventDefault();
      logout();
    }
    if (event.target.closest("#refreshButton")) {
      event.preventDefault();
      refreshAll();
    }
  });
  document.querySelector("#reloadTradesButton")?.addEventListener("click", loadTrades);
  document.querySelector("#reloadRequestsButton")?.addEventListener("click", loadClientRequests);
  document.querySelector("#saveWatchlistButton")?.addEventListener("click", saveWatchlist);
  document.querySelector("#cacheSizesButton")?.addEventListener("click", loadCacheSizes);

  document.querySelectorAll(".dash-tab").forEach((button) => {
    button.addEventListener("click", () => {
      activateDashboardView(button.dataset.view, button);
    });
  });

  document.querySelectorAll(".portal-dropdown-toggle").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.view) {
        activateDashboardView(button.dataset.view, button);
        return;
      }
      const menu = document.querySelector(`#${button.dataset.menu}`);
      if (!menu) return;
      menu.hidden = !menu.hidden;
      button.classList.toggle("open", !menu.hidden);
    });
  });

  document.querySelectorAll("[data-deposit-method]").forEach((button) => {
    button.addEventListener("click", () => {
      activateDashboardView(button.dataset.depositMethod);
      renderProfile(getStoredUser() || {});
    });
  });

  document.querySelectorAll("[data-withdraw-method]").forEach((button) => {
    button.addEventListener("click", () => {
      activateDashboardView(button.dataset.withdrawMethod);
    });
  });

  document.querySelector("#openTradeForm")?.addEventListener("submit", submitOpenTrade);
  document.querySelector("#modifyTradeForm")?.addEventListener("submit", submitModifyTrade);
  document.querySelector("#closeTradeForm")?.addEventListener("submit", submitCloseTrade);
  document.querySelector("#partialCloseForm")?.addEventListener("submit", submitPartialClose);
  document.querySelector("#cancelTradeForm")?.addEventListener("submit", submitCancelTrade);
  document.querySelector("#symbolSearchForm")?.addEventListener("submit", submitSymbolSearch);
  document.querySelector("#watchlistForm")?.addEventListener("submit", submitAddWatchlist);
  document.querySelector("#adminBalanceForm")?.addEventListener("submit", submitAdminBalance);
  document.querySelector("#adminCreditForm")?.addEventListener("submit", submitAdminCredit);
  document.querySelector("#adminPasswordForm")?.addEventListener("submit", submitAdminPassword);
  document.querySelectorAll(".deposit-request-form, .client-request-form").forEach((form) => {
    form.addEventListener("submit", submitDepositRequest);
  });
  document.querySelectorAll(".transfer-action-form").forEach((form) => {
    form.addEventListener("submit", submitTransfer);
  });
  document.querySelector("#createTradingAccountForm")?.addEventListener("submit", submitCreateTradingAccount);
  document.addEventListener("click", (event) => {
    const button = event.target.closest(".select-trading-account");
    if (!button) return;
    event.preventDefault();
    submitSelectTradingAccount(button.dataset.accountId);
  });
}

function activateDashboardView(viewId, activeButton = null) {
  if (!viewId) return;
  document.querySelectorAll(".dash-tab, .portal-dropdown-toggle").forEach((tab) => tab.classList.remove("active"));
  document.querySelectorAll(".dashboard-view").forEach((view) => view.classList.remove("active"));
  document.querySelector(`#${viewId}`)?.classList.add("active");
  if (activeButton) activeButton.classList.add("active");
}

async function refreshAll() {
  showMessage("Refreshing dashboard...", true);
  const results = await Promise.allSettled([loadTradingAccounts(), loadAccount(), loadTrades(), loadClientRequests(), loadWalletSummary(), loadTransfers()]);
  const failed = results.filter((result) => result.status === "rejected").length;
  showMessage(failed ? `Refresh completed with ${failed} failed request(s).` : "Dashboard refreshed.", failed === 0);
}

async function loadTradingAccounts() {
  const response = await backendFetch(api.tradingAccounts);
  if (!response.ok) throw new Error("Trading accounts unavailable");
  const data = await readBody(response);
  latestTradingAccounts = data.accounts || [];
  renderTradingAccountState(getStoredUser() || {}, latestTradingAccounts);
}

async function loadAccount() {
  const response = await backendFetch(api.account);
  if (response.status === 409) {
    renderAccount({});
    return;
  }
  if (!response.ok) throw new Error("Account unavailable");
  const account = await readBody(response);
  renderAccount(account);
}

function renderAccount(account = {}) {
  document.querySelector("#metricEquity").textContent = money(account.equity);
  document.querySelector("#metricFreeMargin").textContent = money(account.freeMargin);
  document.querySelector("#metricMarginLevel").textContent = `${Number(account.marginLevel || 0).toFixed(1)}%`;
  document.querySelector("#metricCredit").textContent = money(account.credit);
  document.querySelector("#barBalance").textContent = money(account.balance);
  document.querySelector("#barEquity").textContent = money(account.equity);
  document.querySelector("#barMargin").textContent = money(account.margin);
  document.querySelector("#barFreeMargin").textContent = money(account.freeMargin);
  renderTransferAccountSummary(account);
}

async function loadWalletSummary() {
  const response = await backendFetch(api.wallet);
  if (!response.ok) throw new Error("Wallet unavailable");
  latestWalletSummary = await readBody(response);
  renderWalletSummary(latestWalletSummary);
}

async function loadTransfers() {
  const response = await backendFetch(api.transfers);
  if (!response.ok) throw new Error("Transfers unavailable");
  const data = await readBody(response);
  latestTransfers = data.transfers || [];
}

function renderWalletSummary(summary = {}) {
  const walletBalance = Number(summary.wallet?.balance || 0);
  document.querySelectorAll("[data-wallet-balance]").forEach((element) => {
    element.textContent = money(walletBalance);
  });
}

function renderTransferAccountSummary(account = {}) {
  const user = getStoredUser() || {};
  const rows = document.querySelectorAll("#accountToWalletView .account-summary-box strong");
  if (!rows.length) return;

  const values = [
    "MT5",
    user.accountNumber || "----",
    money(account.balance),
    money(account.equity),
    "1:100",
    money(account.credit),
    money(account.credit)
  ];

  rows.forEach((row, index) => {
    row.textContent = values[index] ?? "----";
  });
}

async function loadTrades() {
  const response = await backendFetch(api.trades);
  if (response.status === 409) {
    renderTrades({ open: [], closed: [], balance: null });
    return;
  }
  if (!response.ok) throw new Error("Trades unavailable");
  latestTrades = await readBody(response);
  renderTrades(latestTrades);
  if (latestTrades.balance) renderAccount(latestTrades.balance);
}

function renderTrades(data = {}) {
  const open = data.open || [];
  const closed = data.closed || [];
  document.querySelector("#metricOpenTrades").textContent = open.length;
  document.querySelector("#openTradesBody").innerHTML = open.map((trade) => `
    <tr>
      <td><button class="copy-id" type="button" data-id="${trade.id || ""}">${compact(trade.id).slice(0, 8)}</button></td>
      <td>${compact(trade.symbol)}</td>
      <td>${compact(trade.orderType || trade.type)}</td>
      <td>${compact(trade.status)}</td>
      <td>${compact(trade.volume)}</td>
      <td>${compact(trade.openPrice)}</td>
      <td>${compact(trade.sl)}</td>
      <td>${compact(trade.tp)}</td>
      <td>${compact(trade.profit)}</td>
    </tr>
  `).join("") || `<tr><td colspan="9">No open or pending trades yet.</td></tr>`;

  document.querySelector("#closedTradesBody").innerHTML = closed.map((trade) => `
    <tr>
      <td>${compact(trade.id).slice(0, 8)}</td>
      <td>${compact(trade.symbol)}</td>
      <td>${compact(trade.type)}</td>
      <td>${compact(trade.volume)}</td>
      <td>${compact(trade.openPrice)}</td>
      <td>${compact(trade.closePrice)}</td>
      <td>${compact(trade.result)}</td>
      <td>${compact(trade.closeTime)}</td>
    </tr>
  `).join("") || `<tr><td colspan="8">No closed history yet.</td></tr>`;

  document.querySelectorAll(".copy-id").forEach((button) => {
    button.addEventListener("click", () => fillTradeIds(button.dataset.id));
  });
}

function fillTradeIds(id) {
  ["#modifyTradeForm", "#closeTradeForm", "#partialCloseForm", "#cancelTradeForm"].forEach((selector) => {
    const input = document.querySelector(`${selector} input[name="id"]`);
    if (input) input.value = id;
  });
  showMessage("Trade ID copied into forms.", true);
}

async function submitOpenTrade(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const orderType = form.get("orderType");
  const payload = {
    symbol: String(form.get("symbol") || "").toUpperCase().replace("/", ""),
    orderType,
    volume: numberOrNull(form.get("volume")),
    openPrice: numberOrNull(form.get("openPrice")),
    sl: numberOrNull(form.get("sl")),
    tp: numberOrNull(form.get("tp")),
    triggerPrice: numberOrNull(form.get("triggerPrice")),
    limitPrice: numberOrNull(form.get("limitPrice")),
    tradeCount: numberOrNull(form.get("tradeCount")) || 1
  };
  payload.type = String(orderType).startsWith("BUY") ? "buy" : "sell";
  await submitJson(api.openTrade, "POST", payload, "Trade opened.");
  await loadTrades();
}

async function submitModifyTrade(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const id = form.get("id");
  const payload = {
    sl: numberOrNull(form.get("sl")),
    tp: numberOrNull(form.get("tp")),
    volume: numberOrNull(form.get("volume"))
  };
  await submitJson(`${api.trades}/${id}`, "PUT", payload, "Trade modified.");
  await loadTrades();
}

async function submitCloseTrade(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  await submitJson(`${api.trades}/close/${form.get("id")}`, "POST", {
    closePrice: numberOrNull(form.get("closePrice")),
    reason: form.get("reason") || "MANUAL"
  }, "Trade closed.");
  await loadTrades();
}

async function submitPartialClose(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  await submitJson(`${api.trades}/${form.get("id")}/partial`, "POST", {
    closeVolume: numberOrNull(form.get("closeVolume")),
    closePrice: numberOrNull(form.get("closePrice"))
  }, "Trade partially closed.");
  await loadTrades();
}

async function submitCancelTrade(event) {
  event.preventDefault();
  const id = new FormData(event.currentTarget).get("id");
  await submitJson(`${api.trades}/${id}/cancel`, "DELETE", null, "Pending order cancelled.");
  await loadTrades();
}

async function submitDepositRequest(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const requestName = form.dataset.requestName || "Deposit";
  const payload = Object.fromEntries(new FormData(form).entries());
  if (requestName === "Online Bank Withdraw" && payload.accountNumber !== payload.confirmAccountNumber) {
    showMessage("Account number and confirm account number do not match.");
    return;
  }

  const amount = Number(payload.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    showMessage("Enter a valid amount.");
    return;
  }

  const isUpiDeposit = requestName === "UPI Deposit";
  const isOnlineBankWithdraw = requestName === "Online Bank Withdraw";

  if (!isUpiDeposit && !isOnlineBankWithdraw) {
    showMessage("Only UPI deposits and online bank withdrawals are available right now.");
    return;
  }

  const requestPayload = isOnlineBankWithdraw
    ? {
        type: "WITHDRAWAL",
        method: "ONLINE_BANK",
        amount,
        utr: String(payload.accountNumber || "").trim(),
        payerName: String(payload.accountHolderName || "").trim(),
        phone: String(payload.phone || "").trim(),
        email: String(payload.email || "").trim(),
        payload: {
          accountHolderName: String(payload.accountHolderName || "").trim(),
          bankName: String(payload.bankName || "").trim(),
          accountNumber: String(payload.accountNumber || "").trim(),
          confirmAccountNumber: String(payload.confirmAccountNumber || "").trim(),
          ifscCode: String(payload.ifscCode || "").trim(),
          branchName: String(payload.branchName || "").trim(),
          tradingAccountNumber: String(payload.tradingAccountNumber || "").trim()
        }
      }
    : {
        type: "DEPOSIT",
        method: "UPI",
        amount,
        utr: String(payload.utr || "").trim(),
        payerName: String(payload.payerName || "").trim(),
        phone: String(payload.phone || "").trim(),
        email: String(payload.email || "").trim(),
        payload: {
          beneficiary: depositBankDetails
        }
      };

  try {
    const successText = isOnlineBankWithdraw
      ? "Withdrawal request submitted. Status: Pending."
      : "Deposit request submitted. Status: Pending.";
    const { response } = await submitJson(api.clientRequests, "POST", requestPayload, successText);

    if (response.ok) {
      form.reset();
      renderProfile(getStoredUser() || {});
      await loadClientRequests();
    }
  } catch {
    showMessage("Backend not reachable. Request was not saved.");
  }
}

async function submitCreateTradingAccount(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const formData = new FormData(form);
  const accountType = String(formData.get("accountType") || "").toUpperCase();
  const password = String(formData.get("password") || "");

  try {
    const response = await backendFetch(api.createTradingAccount, {
      method: "POST",
      body: JSON.stringify({ accountType, password })
    });
    const data = await readBody(response);

    if (!response.ok) {
      showMessage(data.message || "Could not create trading account.");
      return;
    }

    const remember = Boolean(localStorage.getItem(TOKEN_KEY));
    setToken(data.token, remember);
    setStoredUser(data.user, remember);
    form.reset();
    renderProfile(data.user);
    latestTradingAccounts = data.user?.tradingAccounts || latestTradingAccounts;
    renderTradingAccountState(data.user, latestTradingAccounts);
    showMessage(data.message || "Trading account created.", true);
    await Promise.allSettled([loadTradingAccounts(), loadWalletSummary(), loadAccount(), loadTrades()]);
  } catch {
    showMessage("Portal backend not reachable. Start Node on port 4000.");
  }
}

async function submitSelectTradingAccount(accountId) {
  if (!accountId) return;

  const password = window.prompt("Enter your portal password to switch trading account");
  if (!password) return;

  try {
    const response = await backendFetch(`${api.tradingAccounts}/${encodeURIComponent(accountId)}/select`, {
      method: "POST",
      body: JSON.stringify({ password })
    });
    const data = await readBody(response);

    if (!response.ok) {
      showMessage(data.message || "Could not select trading account.");
      return;
    }

    const remember = Boolean(localStorage.getItem(TOKEN_KEY));
    setToken(data.token, remember);
    setStoredUser(data.user, remember);
    latestTradingAccounts = data.user?.tradingAccounts || latestTradingAccounts;
    renderProfile(data.user);
    renderTradingAccountState(data.user, latestTradingAccounts);
    showMessage(data.message || "Trading account selected.", true);
    await Promise.allSettled([loadWalletSummary(), loadAccount(), loadTrades()]);
  } catch {
    showMessage("Portal backend not reachable. Account was not selected.");
  }
}

async function submitTransfer(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const formData = new FormData(form);
  const user = getStoredUser() || {};
  const enteredAccount = String(formData.get("accountNumber") || "").trim();
  const expectedAccount = user.accountNumber ? String(user.accountNumber) : "";
  const amount = Number(formData.get("amount"));
  const type = form.dataset.transferType;

  if (!enteredAccount) {
    showMessage("Enter your account number.");
    return;
  }

  if (expectedAccount && enteredAccount !== expectedAccount) {
    showMessage("Account number does not match your profile.");
    return;
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    showMessage("Enter a valid transfer amount.");
    return;
  }

  if (!["WALLET_TO_TRADING", "TRADING_TO_WALLET"].includes(type)) {
    showMessage("Invalid transfer type.");
    return;
  }

  const successText = type === "WALLET_TO_TRADING"
    ? "Transfer to trading account completed."
    : "Transfer to wallet completed.";

  try {
    const { response } = await submitJson(api.transfers, "POST", { type, amount }, successText);
    if (response.ok) {
      form.reset();
      await Promise.allSettled([loadAccount(), loadTrades(), loadWalletSummary(), loadTransfers()]);
    }
  } catch {
    showMessage("Backend not reachable. Transfer was not completed.");
  }
}

async function loadClientRequests() {
  const response = await backendFetch(`${api.clientRequests}/my`);
  if (!response.ok) throw new Error("Requests unavailable");
  const data = await readBody(response);
  latestClientRequests = data.requests || [];
  renderClientRequests(latestClientRequests);
}

function requestStatusClass(status) {
  const normalized = String(status || "PENDING").toUpperCase();
  if (normalized === "APPROVED") return "approved";
  if (normalized === "REJECTED") return "rejected";
  return "pending";
}

function formatRequestDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return compact(value);
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function renderClientRequests(requests = []) {
  const body = document.querySelector("#clientRequestsBody");
  if (!body) return;

  body.innerHTML = requests.map((request) => {
    const status = String(request.status || "PENDING").toUpperCase();
    const type = String(request.type || "").toUpperCase();
    const reference = type === "WITHDRAWAL"
      ? request.payload?.accountNumber || request.utr
      : request.utr || request.payload?.accountNumber;
    return `
      <tr>
        <td>${formatRequestDate(request.createdAt)}</td>
        <td>${compact(request.type)}</td>
        <td>${compact(request.method)}</td>
        <td>${money(request.amount)}</td>
        <td>${compact(reference)}</td>
        <td><span class="request-status ${requestStatusClass(status)}">${status}</span></td>
        <td>${compact(request.adminNote)}</td>
      </tr>
    `;
  }).join("") || `<tr><td colspan="7">No requests yet.</td></tr>`;
}

async function submitJson(path, method, payload, successText) {
  const options = { method };
  if (payload !== null) options.body = JSON.stringify(payload);
  const response = await backendFetch(path, options);
  const data = await readBody(response);
  const fallback = response.status === 401
    ? "Session expired. Please log in again."
    : `Action failed. Status ${response.status}.`;
  showMessage(data.message || data.error || data.msg || (response.ok ? successText : fallback), response.ok);
  return { response, data };
}

async function loadSymbols(query = "", type = "") {
  const params = new URLSearchParams({ page: "0", size: "24" });
  let path = api.symbols;
  if (query) {
    params.set("q", query);
    path = api.symbolSearch;
  } else if (type) {
    params.set("type", type);
  }
  const response = await backendFetch(`${path}?${params.toString()}`);
  if (!response.ok) throw new Error("Symbols unavailable");
  const data = await readBody(response);
  renderSymbols(data.content || data || []);
}

function renderSymbols(symbols) {
  const grid = document.querySelector("#symbolsGrid");
  if (!grid) return;
  grid.innerHTML = symbols.map((symbol) => `
    <article class="symbol-card">
      <header><strong>${compact(symbol.id || symbol.symbol)}</strong><span>${compact(symbol.type)}</span></header>
      <p>${compact(symbol.name || symbol.description || "Trading symbol")}</p>
      <div><span>Spread</span><b>${compact(symbol.spread)}</b></div>
      <div><span>Pip</span><b>${compact(symbol.pipSize)}</b></div>
      <div><span>Volume</span><b>${compact(symbol.minimalVolume)} - ${compact(symbol.maximalVolume)}</b></div>
      <button class="outline-button add-symbol" type="button" data-symbol="${symbol.id || symbol.symbol}" data-type="${symbol.type || ""}">Add to watchlist</button>
    </article>
  `).join("") || `<div class="empty-panel">No symbols found.</div>`;

  document.querySelectorAll(".add-symbol").forEach((button) => {
    button.addEventListener("click", () => addWatchlistItem(button.dataset.symbol, button.dataset.type));
  });
}

async function submitSymbolSearch(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  await loadSymbols(String(form.get("q") || "").trim(), String(form.get("type") || ""));
}

async function loadWatchlist() {
  const response = await backendFetch(api.watchlist);
  if (!response.ok) throw new Error("Watchlist unavailable");
  const data = await readBody(response);
  currentWatchlist = data.watchlist || [];
  renderWatchlist();
}

function addWatchlistItem(symbol, type) {
  if (!symbol) return;
  const normalized = String(symbol).toUpperCase().replace("/", "");
  if (!currentWatchlist.some((item) => String(item.symbol).toUpperCase() === normalized)) {
    currentWatchlist.push({ symbol: normalized, type: type || "FOREX" });
  }
  renderWatchlist();
  showMessage("Symbol added locally. Save to backend when ready.", true);
}

function submitAddWatchlist(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  addWatchlistItem(form.get("symbol"), form.get("type"));
  event.currentTarget.reset();
}

function removeWatchlistItem(symbol) {
  currentWatchlist = currentWatchlist.filter((item) => item.symbol !== symbol);
  renderWatchlist();
}

function renderWatchlist() {
  document.querySelector("#watchlistPreview").textContent = JSON.stringify(currentWatchlist, null, 2);
  const chips = document.querySelector("#watchlistChips");
  if (!chips) return;
  chips.innerHTML = currentWatchlist.map((item) => `
    <button class="watch-chip" type="button" data-symbol="${item.symbol}">
      <strong>${item.symbol}</strong><span>${item.type || "-"}</span><em>Remove</em>
    </button>
  `).join("") || `<div class="empty-panel">No saved symbols yet.</div>`;
  chips.querySelectorAll(".watch-chip").forEach((chip) => {
    chip.addEventListener("click", () => removeWatchlistItem(chip.dataset.symbol));
  });
}

async function saveWatchlist() {
  await submitJson(api.watchlist, "PUT", { watchlist: currentWatchlist }, "Watchlist saved.");
  await loadWatchlist();
}

async function submitAdminBalance(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  await submitJson(api.adminBalance, "POST", {
    userId: form.get("userId"),
    amount: numberOrNull(form.get("amount")),
    reason: form.get("reason") || "DEPOSIT"
  }, "Balance deposited.");
}

async function submitAdminCredit(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  await submitJson(api.adminCredit, "POST", {
    userId: form.get("userId"),
    amount: numberOrNull(form.get("amount")),
    reason: form.get("reason") || "BONUS"
  }, "Credit deposited.");
}

async function submitAdminPassword(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  await submitJson(api.adminPassword, "POST", {
    userId: form.get("userId"),
    newPassword: form.get("newPassword")
  }, "Password changed.");
}

async function loadCacheSizes() {
  const response = await backendFetch(api.cacheSizes);
  const data = await readBody(response);
  document.querySelector("#cachePreview").textContent = JSON.stringify(data, null, 2);
  showMessage(response.ok ? "Cache sizes loaded." : data.error || "Could not load cache sizes.", response.ok);
}

function connectRealtime(user = {}) {
  if (realtimeClient || !window.SockJS || !window.StompJs) return;

  realtimeClient = new StompJs.Client({
    webSocketFactory: () => new SockJS(`${API_BASE_URL}/ws`),
    reconnectDelay: 5000,
    debug: () => {},
    onConnect: () => {
      const refreshFromSocket = () => Promise.allSettled([loadTrades(), loadAccount()]);
      if (user.id) realtimeClient.subscribe(`/topic/trades/${user.id}`, refreshFromSocket);
      realtimeClient.subscribe("/topic/trades", refreshFromSocket);
      realtimeClient.subscribe("/user/queue/trades", refreshFromSocket);
      realtimeClient.subscribe("/user/account/update", (message) => {
        try {
          renderAccount(JSON.parse(message.body));
        } catch {
          loadAccount();
        }
      });
      showMessage("Realtime updates connected.", true);
    },
    onStompError: () => {
      showMessage("Realtime channel unavailable. Manual refresh still works.");
    }
  });

  realtimeClient.activate();
}

loadDashboard();
