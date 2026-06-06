const navToggle = document.querySelector(".nav-toggle");
const navMenu = document.querySelector(".nav-menu");
const backTop = document.querySelector(".back-top");
const themeToggle = document.querySelector(".theme-toggle");
const pointerGlow = document.querySelector(".pointer-glow");
const quickOpen = document.querySelector(".quick-open");
const quickPanel = document.querySelector("#quickPanel");
const quickClose = document.querySelector("#quickClose");
const canHover = window.matchMedia("(pointer: fine)").matches;

function bindTiltCard(card) {
  if (!canHover || card.dataset.tiltBound) return;
  card.dataset.tiltBound = "true";
  card.addEventListener("pointermove", (event) => {
    const rect = card.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const rotateY = ((x / rect.width) - 0.5) * 10;
    const rotateX = ((0.5 - (y / rect.height)) * 10);
    card.style.setProperty("--mx", `${(x / rect.width) * 100}%`);
    card.style.setProperty("--my", `${(y / rect.height) * 100}%`);
    card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-4px)`;
  });

  card.addEventListener("pointerleave", () => {
    card.style.transform = "";
    card.style.removeProperty("--mx");
    card.style.removeProperty("--my");
  });
}

function bindGlowSurface(card) {
  if (!canHover || card.dataset.glowBound) return;
  card.dataset.glowBound = "true";
  card.addEventListener("pointermove", (event) => {
    const rect = card.getBoundingClientRect();
    card.style.setProperty("--mx", `${((event.clientX - rect.left) / rect.width) * 100}%`);
    card.style.setProperty("--my", `${((event.clientY - rect.top) / rect.height) * 100}%`);
  });
}

if (pointerGlow && canHover) {
  window.addEventListener("pointermove", (event) => {
    pointerGlow.style.opacity = "1";
    pointerGlow.style.transform = `translate3d(${event.clientX - 130}px, ${event.clientY - 130}px, 0)`;
  });

  document.addEventListener("mouseleave", () => {
    pointerGlow.style.opacity = "0";
  });
}

if (navToggle && navMenu) {
  navToggle.addEventListener("click", () => {
    const isOpen = navMenu.classList.toggle("open");
    navToggle.setAttribute("aria-expanded", String(isOpen));
  });

  document.querySelectorAll(".nav-menu a").forEach((link) => {
    link.addEventListener("click", () => {
      navMenu.classList.remove("open");
      navToggle.setAttribute("aria-expanded", "false");
    });
  });
}

if (themeToggle) {
  themeToggle.addEventListener("click", () => {
    document.body.classList.toggle("dark");
    localStorage.setItem("nexford-theme", document.body.classList.contains("dark") ? "dark" : "light");
  });
}

if (localStorage.getItem("nexford-theme") === "dark") {
  document.body.classList.add("dark");
}

const markets = [
  ["GBP/USD", "1.2704", "+0.18%"],
  ["XAU/USD", "2368.90", "+0.42%"],
  ["NAS100", "18942.5", "+0.31%"],
  ["USOIL", "78.21", "-0.16%"],
  ["BTC/USD", "68240", "+1.28%"],
  ["GBP/JPY", "198.44", "+0.09%"],
  ["GER40", "18420.2", "-0.11%"],
  ["AUD/USD", "0.6642", "+0.04%"]
];

const tickerTrack = document.querySelector("#tickerTrack");
if (tickerTrack) {
  const tickerItems = [...markets, ...markets].map(([symbol, price, change]) => {
    const item = document.createElement("div");
    item.className = "ticker-item";
    if (change.startsWith("-")) item.classList.add("is-down");
    item.innerHTML = `<b>${symbol}</b><span>${price}</span><em>${change}</em>`;
    return item;
  });
  tickerItems.forEach((item) => tickerTrack.appendChild(item));
}

const screenerData = [
  { symbol: "GBP/USD", name: "Pound Dollar", type: "forex", price: "1.2704", change: "+0.18%", spread: "0.1", bars: [36, 68, 52, 80, 64, 92] },
  { symbol: "GBP/JPY", name: "Pound Yen", type: "forex", price: "198.44", change: "+0.09%", spread: "0.7", bars: [48, 58, 72, 62, 78, 68] },
  { symbol: "XAU/USD", name: "Gold", type: "metals", price: "2368.90", change: "+0.42%", spread: "1.4", bars: [42, 76, 58, 88, 72, 94] },
  { symbol: "XAG/USD", name: "Silver", type: "metals", price: "30.82", change: "-0.12%", spread: "1.9", bars: [72, 58, 62, 44, 50, 38] },
  { symbol: "NAS100", name: "US Tech 100", type: "indices", price: "18942.5", change: "+0.31%", spread: "0.6", bars: [46, 64, 82, 70, 88, 96] },
  { symbol: "GER40", name: "Germany 40", type: "indices", price: "18420.2", change: "-0.11%", spread: "0.9", bars: [84, 72, 66, 58, 48, 42] },
  { symbol: "BTC/USD", name: "Bitcoin", type: "crypto", price: "68240", change: "+1.28%", spread: "14", bars: [34, 58, 46, 82, 74, 98] },
  { symbol: "ETH/USD", name: "Ethereum", type: "crypto", price: "3820", change: "-0.24%", spread: "5.2", bars: [76, 70, 54, 62, 48, 44] }
];

const screenerGrid = document.querySelector("#screenerGrid");
const marketSearch = document.querySelector("#marketSearch");
let activeFilter = "all";

function renderScreener() {
  if (!screenerGrid) return;
  const query = marketSearch ? marketSearch.value.trim().toLowerCase() : "";
  const filtered = screenerData.filter((item) => {
    const matchesFilter = activeFilter === "all" || item.type === activeFilter;
    const matchesQuery = !query || `${item.symbol} ${item.name} ${item.type}`.toLowerCase().includes(query);
    return matchesFilter && matchesQuery;
  });

  screenerGrid.innerHTML = filtered.map((item) => {
    const isDown = item.change.startsWith("-");
    const bars = item.bars.map((height, index) => `<span style="height:${height}%; animation-delay:${index * 0.12}s"></span>`).join("");
    return `
      <article class="screener-card tilt-card">
        <header><h3>${item.symbol}</h3><span>${item.type}</span></header>
        <div><div class="screener-price">${item.price}</div><div>${item.name}</div></div>
        <div class="sparkline">${bars}</div>
        <div class="screener-meta"><span class="screener-change ${isDown ? "down" : ""}">${item.change}</span><span>Spread ${item.spread}</span></div>
      </article>
    `;
  }).join("") || `<div class="empty-state">No instruments match your search.</div>`;
  document.querySelectorAll(".screener-card").forEach((card) => {
    bindTiltCard(card);
    bindGlowSurface(card);
  });
}

document.querySelectorAll(".filter-btn").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".filter-btn").forEach((btn) => btn.classList.remove("active"));
    button.classList.add("active");
    activeFilter = button.dataset.filter;
    renderScreener();
  });
});

if (marketSearch) {
  marketSearch.addEventListener("input", renderScreener);
}

renderScreener();

function animateCount(element) {
  const target = Number(element.dataset.count);
  const prefix = element.dataset.prefix || "";
  const suffix = element.dataset.suffix || "";
  const duration = 1200;
  const start = performance.now();

  function frame(now) {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const value = Math.round(target * eased);
    element.textContent = `${prefix}${value}${suffix}`;
    if (progress < 1) requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}

const countObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      animateCount(entry.target);
      countObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.65 });

document.querySelectorAll("[data-count]").forEach((element) => countObserver.observe(element));

if (canHover) {
  document.querySelectorAll(".tilt-card").forEach(bindTiltCard);
  document.querySelectorAll(".market-card, .account-card, .academy-card, .intel-card, .insight-card, .contact-form, .instrument-board, .platform-window, .phone-screen, .calculator, .steps, .screener-card").forEach(bindGlowSurface);
}

setInterval(() => {
  document.querySelectorAll(".ticker-item").forEach((item, index) => {
    if (index % 2 !== 0) return;
    const price = item.querySelector("span");
    const change = item.querySelector("em");
    const current = Number(price.textContent.replace(/[^\d.]/g, ""));
    const drift = (Math.random() - 0.48) * (current > 1000 ? 3.2 : 0.004);
    const next = current + drift;
    price.textContent = current > 1000 ? next.toFixed(1) : next.toFixed(4);
    const positive = drift >= 0;
    item.classList.toggle("is-down", !positive);
    change.textContent = `${positive ? "+" : "-"}${Math.abs(drift * 10).toFixed(2)}%`;
  });
}, 2400);

document.querySelectorAll(".tab-btn").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach((btn) => {
      btn.classList.remove("active");
      btn.setAttribute("aria-selected", "false");
    });
    document.querySelectorAll(".tab-panel").forEach((panel) => panel.classList.remove("active"));
    button.classList.add("active");
    button.setAttribute("aria-selected", "true");
    document.getElementById(button.dataset.tab).classList.add("active");
  });
});

const currencyRates = {
  USD: { symbol: "$", rate: 1, locale: "en-US" }
};

document.querySelectorAll(".currency-btn").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".currency-btn").forEach((btn) => btn.classList.remove("active"));
    button.classList.add("active");
    const currency = currencyRates[button.dataset.currency];
    document.querySelectorAll("[data-price]").forEach((price) => {
      const value = Number(price.dataset.price) * currency.rate;
      price.textContent = `${currency.symbol}${Math.round(value).toLocaleString(currency.locale)}`;
    });
  });
});

const deposit = document.querySelector("#deposit");
const depositValue = document.querySelector("#depositValue");
const marginValue = document.querySelector("#marginValue");
const powerValue = document.querySelector("#powerValue");

function updateCalculator() {
  const value = Number(deposit.value);
  depositValue.textContent = `$${value.toLocaleString("en-US")}`;
  marginValue.textContent = `$${Math.round(value / 100).toLocaleString("en-US")}`;
  powerValue.textContent = `$${(value * 100).toLocaleString("en-US")}`;
}

if (deposit && depositValue && marginValue && powerValue) {
  deposit.addEventListener("input", updateCalculator);
  updateCalculator();
}

const riskRange = document.querySelector("#riskRange");
const riskMood = document.querySelector("#riskMood");
const positionSize = document.querySelector("#positionSize");
const marginPressure = document.querySelector("#marginPressure");
const riskCoreValue = document.querySelector("#riskCoreValue");
const riskCore = document.querySelector("#riskCore");

function updateRiskLab() {
  if (!riskRange) return;
  const value = Number(riskRange.value);
  const mood = value < 34 ? "Conservative" : value < 68 ? "Balanced" : "Aggressive";
  riskMood.textContent = mood;
  positionSize.textContent = `${(value / 100).toFixed(2)} lot`;
  marginPressure.textContent = `${value}%`;
  riskCoreValue.textContent = `${value}%`;
  riskCore.style.background = `radial-gradient(circle, rgba(19, 185, 143, ${0.18 + value / 280}), rgba(255, 255, 255, 0.08))`;
}

if (riskRange) {
  riskRange.addEventListener("input", updateRiskLab);
  updateRiskLab();
}

const stories = document.querySelectorAll(".story-card");
let storyIndex = 0;

function showStory(index) {
  if (!stories.length) return;
  storyIndex = (index + stories.length) % stories.length;
  stories.forEach((story, current) => story.classList.toggle("active", current === storyIndex));
}

document.querySelector("#nextStory")?.addEventListener("click", () => showStory(storyIndex + 1));
document.querySelector("#prevStory")?.addEventListener("click", () => showStory(storyIndex - 1));

if (stories.length) {
  setInterval(() => showStory(storyIndex + 1), 5200);
}

function toggleQuickPanel(open) {
  if (!quickPanel) return;
  quickPanel.classList.toggle("open", open);
  quickPanel.setAttribute("aria-hidden", String(!open));
}

quickOpen?.addEventListener("click", () => toggleQuickPanel(true));
quickClose?.addEventListener("click", () => toggleQuickPanel(false));
quickPanel?.addEventListener("click", (event) => {
  if (event.target === quickPanel || event.target.matches(".quick-dialog a")) toggleQuickPanel(false);
});

document.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    toggleQuickPanel(true);
  }
  if (event.key === "Escape") toggleQuickPanel(false);
});

document.querySelectorAll(".faq-item").forEach((item) => {
  item.addEventListener("click", () => {
    document.querySelectorAll(".faq-item").forEach((faq) => faq.classList.remove("active"));
    item.classList.add("active");
  });
});

const contactForm = document.querySelector("#contactForm");
const newsletterForm = document.querySelector("#newsletterForm");

function setFieldError(field, message) {
  const label = field.closest("label");
  const error = label ? label.querySelector("small") : null;
  if (!label || !error) return;
  label.classList.toggle("invalid", Boolean(message));
  error.textContent = message;
}

function validateEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function validateContactForm() {
  let isValid = true;
  const fields = contactForm.querySelectorAll("input:not([type='checkbox']), select, textarea");

  fields.forEach((field) => {
    const value = field.value.trim();
    let message = "";

    if (!value) {
      message = "This field is required.";
    } else if (field.type === "email" && !validateEmail(value)) {
      message = "Enter a valid email address.";
    } else if (field.name === "phone" && value.replace(/\D/g, "").length < 8) {
      message = "Enter a valid phone number.";
    } else if (field.name === "message" && value.length < 12) {
      message = "Please add a little more detail.";
    }

    setFieldError(field, message);
    if (message) isValid = false;
  });

  const consent = contactForm.querySelector("input[name='consent']");
  const consentError = contactForm.querySelector(".consent-error");
  if (!consent.checked) {
    consentError.textContent = "Please confirm consent before sending.";
    isValid = false;
  } else {
    consentError.textContent = "";
  }

  return isValid;
}

if (contactForm) {
  contactForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const success = contactForm.querySelector(".form-success");

    if (!validateContactForm()) {
      success.textContent = "";
      return;
    }

    success.textContent = "Thanks. Your message is ready for the client desk.";
    contactForm.reset();
    contactForm.querySelectorAll(".invalid").forEach((label) => label.classList.remove("invalid"));
    contactForm.querySelectorAll("small").forEach((small) => {
      if (!small.classList.contains("consent-error")) small.textContent = "";
    });
  });

  contactForm.querySelectorAll("input, select, textarea").forEach((field) => {
    field.addEventListener("input", () => {
      if (field.type !== "checkbox") setFieldError(field, "");
      contactForm.querySelector(".form-success").textContent = "";
    });
  });
}

if (newsletterForm) {
  newsletterForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const input = newsletterForm.querySelector("input");
    const status = document.querySelector(".newsletter-status");

    if (!validateEmail(input.value.trim())) {
      status.classList.remove("success");
      status.textContent = "Enter a valid email address.";
      return;
    }

    status.classList.add("success");
    status.textContent = "Subscribed to the weekly market brief.";
    newsletterForm.reset();
  });
}

const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add("visible");
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.14 });

document.querySelectorAll(".reveal").forEach((element) => revealObserver.observe(element));

window.addEventListener("scroll", () => {
  if (backTop) backTop.classList.toggle("visible", window.scrollY > 650);
});

if (backTop) {
  backTop.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}
