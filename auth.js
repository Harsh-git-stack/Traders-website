const API_BASE_URL = window.NEXFORD_API_BASE_URL ||
  (["localhost", "127.0.0.1"].includes(window.location.hostname)
    ? "http://localhost:8084/traders-backend"
    : `${window.location.origin}/traders-backend`);
const TOKEN_KEY = "nexford-access-token";
const USER_KEY = "nexford-user";

const api = {
  register: "/api/auth/register",
  verifyRegistration: "/api/auth/verify-registration",
  login: "/api/auth/login",
  refresh: "/api/auth/refresh",
  logout: "/api/auth/logout",
  trades: "/api/trades",
  account: "/api/trades/account",
  openTrade: "/api/trades/open",
  symbols: "/api/symbols",
  symbolSearch: "/api/symbols/search",
  watchlist: "/api/user/watchlist",
  adminBalance: "/api/trades/admin/balance/deposit",
  adminCredit: "/api/trades/admin/credit/deposit",
  adminPassword: "/api/trades/admin/user/change-password",
  cacheSizes: "/api/trades/admin/cache-sizes"
};

let currentWatchlist = [];
let latestTrades = { open: [], closed: [], balance: null };
let realtimeClient = null;

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
  try {
    await backendFetch(api.logout, { method: "POST" }, false);
  } catch {}
  setToken("");
  setStoredUser(null);
  window.location.href = "login.html";
}

const signupForm = document.querySelector("#signupForm");
let otpCountdownTimer = null;

function buildSignupPayload(form) {
  return {
    name: form.get("name"),
    phone: form.get("phone"),
    email: form.get("email"),
    password: String(form.get("password") || ""),
    role: "USER",
    accountType: "LIVE",
    brokerAccountType: form.get("accountType") || "Standard STP",
    swap: Boolean(form.get("swap"))
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
  signupButton.disabled = false;
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
  const password = String(form.get("password") || "");
  const confirmPassword = String(form.get("confirmPassword") || "");

  if (password !== confirmPassword) {
    showMessage("Passwords do not match.");
    return false;
  }

  try {
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
      const response = await backendFetch(api.verifyRegistration, {
        method: "POST",
        body: JSON.stringify({ email, otp })
      }, false);
      const data = await readBody(response);
      showMessage(data.message || data.error || (response.ok ? "Account verified. You can now log in." : "OTP verification failed."), response.ok);
      if (response.ok) setTimeout(() => { window.location.href = "login.html"; }, 900);
    } catch {
      showMessage("Backend not reachable. Start Spring Boot on port 8084.");
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

const loginForm = document.querySelector("#loginForm");
loginForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = new FormData(loginForm);
  const remember = Boolean(form.get("remember"));

  try {
    const response = await backendFetch(api.login, {
      method: "POST",
      body: JSON.stringify({ email: form.get("email"), password: form.get("password") })
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
    showMessage("Backend not reachable. Start Spring Boot on port 8084.");
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
  bindDashboardEvents();
  connectRealtime(user);
  await Promise.allSettled([loadAccount(), loadTrades(), loadSymbols(), loadWatchlist()]);
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
  document.querySelector("#upiAutoEmail") && (document.querySelector("#upiAutoEmail").value = user.email || "");
  document.querySelector("#cryptoChillEmail") && (document.querySelector("#cryptoChillEmail").value = user.email || "");
  document.querySelector("#profileId").textContent = user.id || "-";
  document.querySelector("#profileAccount").textContent = user.accountNumber || "-";
  document.querySelector("#profileAccountType").textContent = user.accountType || "-";
  document.querySelector("#profileSwap").textContent = user.swapValue === true ? "Yes" : user.swapValue === false ? "No" : "-";
  document.querySelectorAll(".admin-only").forEach((el) => { el.hidden = role !== "ADMIN"; });
}

function bindDashboardEvents() {
  if (document.body.dataset.dashboardBound) return;
  document.body.dataset.dashboardBound = "true";

  document.querySelector("#logoutButton")?.addEventListener("click", logout);
  document.querySelector("#refreshButton")?.addEventListener("click", () => refreshAll());
  document.querySelector("#reloadTradesButton")?.addEventListener("click", loadTrades);
  document.querySelector("#saveWatchlistButton")?.addEventListener("click", saveWatchlist);
  document.querySelector("#cacheSizesButton")?.addEventListener("click", loadCacheSizes);

  document.querySelectorAll(".dash-tab").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".dash-tab").forEach((tab) => tab.classList.remove("active"));
      document.querySelectorAll(".dashboard-view").forEach((view) => view.classList.remove("active"));
      button.classList.add("active");
      document.querySelector(`#${button.dataset.view}`)?.classList.add("active");
    });
  });

  document.querySelectorAll(".portal-dropdown-toggle").forEach((button) => {
    button.addEventListener("click", () => {
      const menu = document.querySelector(`#${button.dataset.menu}`);
      if (!menu) return;
      menu.hidden = !menu.hidden;
      button.classList.toggle("open", !menu.hidden);
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
  document.querySelectorAll(".deposit-request-form").forEach((form) => {
    form.addEventListener("submit", submitDepositRequest);
  });
}

async function refreshAll() {
  await Promise.allSettled([loadAccount(), loadTrades(), loadSymbols(), loadWatchlist()]);
  showMessage("Dashboard refreshed.", true);
}

async function loadAccount() {
  const response = await backendFetch(api.account);
  if (!response.ok) throw new Error("Account unavailable");
  const account = await readBody(response);
  renderAccount(account);
}

function renderAccount(account = {}) {
  document.querySelector("#metricBalance").textContent = money(account.balance);
  document.querySelector("#metricEquity").textContent = money(account.equity);
  document.querySelector("#metricFreeMargin").textContent = money(account.freeMargin);
  document.querySelector("#metricMarginLevel").textContent = `${Number(account.marginLevel || 0).toFixed(1)}%`;
  document.querySelector("#metricCredit").textContent = money(account.credit);
  document.querySelector("#barBalance").textContent = money(account.balance);
  document.querySelector("#barEquity").textContent = money(account.equity);
  document.querySelector("#barMargin").textContent = money(account.margin);
  document.querySelector("#barFreeMargin").textContent = money(account.freeMargin);
}

async function loadTrades() {
  const response = await backendFetch(api.trades);
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

function submitDepositRequest(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const requestName = form.dataset.requestName || "Deposit";
  const payload = Object.fromEntries(new FormData(form).entries());
  const requests = JSON.parse(localStorage.getItem("depositRequests") || "[]");

  requests.unshift({
    type: requestName,
    values: payload,
    createdAt: new Date().toISOString()
  });
  localStorage.setItem("depositRequests", JSON.stringify(requests.slice(0, 25)));

  showMessage(`${requestName} request submitted.`, true);
}

async function submitJson(path, method, payload, successText) {
  const options = { method };
  if (payload !== null) options.body = JSON.stringify(payload);
  const response = await backendFetch(path, options);
  const data = await readBody(response);
  showMessage(data.message || data.error || data.msg || (response.ok ? successText : "Action failed."), response.ok);
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
