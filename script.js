(() => {
  "use strict";

  const API_URL = "http://127.0.0.1:8000/predict";
  const form = document.getElementById("prediction-form");
  const formPanel = document.querySelector(".form-panel");
  const loadingState = document.getElementById("loading-state");
  const resultState = document.getElementById("result-state");
  const errorBox = document.getElementById("form-error");
  const submitButton = document.getElementById("submit-button");
  const scoreValue = document.getElementById("score-value");
  const scoreFeedback = document.getElementById("score-feedback-text");
  const scoreRing = document.querySelector(".ring-arc");
  const ringDescription = document.getElementById("ring-desc");
  const progressCount = document.getElementById("progress-count");
  const progressBar = document.getElementById("progress-bar");
  const progressTrack = document.querySelector(".progress-track");
  const countrySelect = document.getElementById("Country");
  const otherCountry = document.getElementById("Country_other");
  const requiredFields = Array.from(form.querySelectorAll("[required]"));
  const numericFields = new Set([
    "Age",
    "Avg_Daily_Usage_Hours",
    "Daily_Unlocks",
    "Study_Hours",
    "Physical_Activity_Hours",
    "Sleep_Hours_Per_Night"
  ]);
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  function getCountryValue() {
    return countrySelect.value === "__other__" ? otherCountry.value.trim() : countrySelect.value;
  }

  function updateProgress() {
    let completed = 0;
    for (const field of requiredFields) {
      const value = field.name === "Country" ? getCountryValue() : field.value.trim();
      if (value !== "") completed += 1;
    }

    progressCount.textContent = `${completed} / ${requiredFields.length}`;
    progressBar.style.width = `${(completed / requiredFields.length) * 100}%`;
    progressTrack.setAttribute("aria-valuenow", String(completed));
  }

  function showError(message) {
    errorBox.textContent = message;
    errorBox.hidden = false;
    errorBox.focus();
  }

  function clearError() {
    errorBox.textContent = "";
    errorBox.hidden = true;
    for (const field of requiredFields) field.removeAttribute("aria-invalid");
    otherCountry.removeAttribute("aria-invalid");
  }

  function focusFirstInvalid() {
    const invalid = requiredFields.find((field) => {
      if (field.name === "Country") return getCountryValue() === "";
      return !field.checkValidity();
    });
    if (invalid) {
      if (invalid.name === "Country" && countrySelect.value === "__other__") {
        otherCountry.focus();
      } else {
        invalid.focus();
      }
    }
  }

  function validateForm() {
    clearError();
    const invalid = requiredFields.find((field) => {
      if (field.name === "Country") return getCountryValue() === "" || !countrySelect.checkValidity();
      return !field.checkValidity();
    });

    if (invalid) {
      invalid.setAttribute("aria-invalid", "true");
      const label = invalid.labels?.[0]?.textContent.replace(/\s+/g, " ").trim().replace(/\s*\*\s*/g, "") || invalid.name;
      const isOtherCountry = invalid.name === "Country" && countrySelect.value === "__other__";
      if (isOtherCountry) otherCountry.setAttribute("aria-invalid", "true");
      const issue = isOtherCountry || invalid.validity.valueMissing
        ? "Please complete this required field."
        : invalid.validationMessage;
      showError(`${label}: ${issue}`);
      focusFirstInvalid();
      return false;
    }
    return true;
  }

  function buildPayload() {
    const payload = {};
    for (const field of requiredFields) {
      const value = field.name === "Country" ? getCountryValue() : field.value.trim();
      payload[field.name] = numericFields.has(field.name) ? Number(value) : value;
    }
    return payload;
  }

  function setView(view) {
    form.hidden = view !== "form";
    loadingState.hidden = view !== "loading";
    resultState.hidden = view !== "result";
    if (view === "form") {
      formPanel.scrollIntoView({ behavior: reducedMotion.matches ? "auto" : "smooth", block: "start" });
    } else {
      formPanel.scrollIntoView({ behavior: reducedMotion.matches ? "auto" : "smooth", block: "center" });
    }
  }

  function getScoreFeedback(percentage) {
    if (percentage < 50) {
      return "This estimate is toward the lower end of the model's scale. A score alone cannot explain why. If it feels useful, consider one small, manageable change to a routine that matters to you.";
    }
    if (percentage < 70) {
      return "This estimate is in the middle range of the model's scale. Notice which parts of your routine support you, and where a little more rest or balance might help.";
    }
    if (percentage < 85) {
      return "This estimate is toward the higher end of the model's scale. Keep noticing and protecting the routines that feel supportive for you.";
    }
    return "This estimate is at the higher end of the model's scale. Take a moment to recognize the routines that feel supportive, while remembering that one score cannot capture your whole experience.";
  }

  function animateScore(score) {
    const target = Math.round(Number(score) * 10);
    if (!Number.isFinite(target)) {
      throw new TypeError("The prediction response did not contain a finite numeric score.");
    }

    scoreFeedback.textContent = getScoreFeedback(target);
    scoreRing.style.strokeDashoffset = String(100 - target);
    ringDescription.textContent = `Predicted wellness estimate: ${target}% out of 100.`;

    if (reducedMotion.matches) {
      scoreValue.textContent = `${target}%`;
      return;
    }

    const duration = 950;
    const start = performance.now();
    const startValue = 0;
    scoreValue.style.animation = "count-pop .35s ease-out both";

    function tick(now) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = startValue + (target - startValue) * eased;
      scoreValue.textContent = `${Math.round(current)}%`;
      if (progress < 1) {
        requestAnimationFrame(tick);
      } else {
        scoreValue.textContent = `${target}%`;
      }
    }
    requestAnimationFrame(tick);
  }

  async function requestPrediction(payload) {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify(payload)
    });
    const responseText = await response.text();
    let data;
    try {
      data = responseText ? JSON.parse(responseText) : {};
    } catch {
      throw new Error("The prediction server returned an unreadable response. Please try again.");
    }

    if (!response.ok) {
      const detail = typeof data.detail === "string"
        ? data.detail
        : Array.isArray(data.detail)
          ? data.detail.map((issue) => issue.msg || "Invalid input").join(" ")
          : "";
      throw new Error(detail || `The prediction request failed (HTTP ${response.status}). Please check your answers and try again.`);
    }

    if (
      typeof data.predicted_mental_health_score !== "number" ||
      !Number.isFinite(data.predicted_mental_health_score) ||
      data.predicted_mental_health_score < 0 ||
      data.predicted_mental_health_score > 10
    ) {
      throw new Error("The server response must contain a predicted_mental_health_score between 0 and 10. No score was displayed.");
    }
    return data.predicted_mental_health_score;
  }

  countrySelect.addEventListener("change", () => {
    const customCountry = countrySelect.value === "__other__";
    otherCountry.hidden = !customCountry;
    otherCountry.required = customCountry;
    if (!customCountry) otherCountry.value = "";
    updateProgress();
  });

  otherCountry.addEventListener("input", updateProgress);
  form.addEventListener("input", updateProgress);
  form.addEventListener("input", clearError);
  form.addEventListener("change", () => {
    updateProgress();
    clearError();
  });
  otherCountry.addEventListener("input", clearError);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!validateForm()) return;

    const payload = buildPayload();
    submitButton.disabled = true;
    clearError();
    setView("loading");

    try {
      const score = await requestPrediction(payload);
      setView("result");
      animateScore(score);
    } catch (error) {
      setView("form");
      const message = error instanceof TypeError
        ? `Could not connect to the prediction API at ${API_URL}. Check that your FastAPI backend is running and that CORS permits this page's origin.`
        : error instanceof Error
          ? error.message
          : "Something went wrong while contacting the prediction server. Please try again.";
      showError(message);
    } finally {
      submitButton.disabled = false;
    }
  });

  document.getElementById("try-again-button").addEventListener("click", () => {
    clearError();
    setView("form");
  });

  document.getElementById("reset-button").addEventListener("click", () => {
    form.reset();
    countrySelect.value = "";
    otherCountry.value = "";
    otherCountry.hidden = true;
    otherCountry.required = false;
    scoreValue.textContent = "—";
    clearError();
    updateProgress();
    setView("form");
  });

  updateProgress();
})();
