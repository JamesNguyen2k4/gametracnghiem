const DEFAULT_GAME_CONFIG = {
    answerTime: 15,
    winThreshold: 4,
    teamAName: "ĐỘI XANH",
    teamBName: "ĐỘI ĐỎ"
  };
  
  let currentConfig = { ...DEFAULT_GAME_CONFIG };
  
  function buildPlayUrl() {
    const params = new URLSearchParams({
      answerTime: String(currentConfig.answerTime),
      winThreshold: String(currentConfig.winThreshold),
      teamAName: currentConfig.teamAName,
      teamBName: currentConfig.teamBName
    });
  
    return `../play/index.html?${params.toString()}`;
  }
  
  function startGame() {
    window.location.href = buildPlayUrl();
  }
  
 
  function openConfigModal() {
    const modal = document.getElementById("configModal");
    const answerTimeInput = document.getElementById("answerTimeInput");
    const winThresholdInput = document.getElementById("winThresholdInput");
    const teamANameInput = document.getElementById("teamANameInput");
    const teamBNameInput = document.getElementById("teamBNameInput");
  
    if (answerTimeInput) {
      answerTimeInput.value = currentConfig.answerTime;
    }
  
    if (winThresholdInput) {
      winThresholdInput.value = currentConfig.winThreshold;
    }
  
    if (teamANameInput) {
      teamANameInput.value = currentConfig.teamAName;
    }
  
    if (teamBNameInput) {
      teamBNameInput.value = currentConfig.teamBName;
    }
  
    modal?.classList.remove("hidden");
  }
  
  function closeConfigModal() {
    const modal = document.getElementById("configModal");
    modal?.classList.add("hidden");
  }
  
  function clampNumber(value, min, max, fallback) {
    const num = Number(value);
    if (Number.isNaN(num)) return fallback;
    return Math.min(max, Math.max(min, num));
  }
  
  function normalizeTeamName(value, fallback) {
    const text = String(value || "").trim();
    return text || fallback;
  }
  
  function saveConfigAndStart() {
    const answerTimeInput = document.getElementById("answerTimeInput");
    const winThresholdInput = document.getElementById("winThresholdInput");
    const teamANameInput = document.getElementById("teamANameInput");
    const teamBNameInput = document.getElementById("teamBNameInput");
  
    currentConfig = {
      answerTime: clampNumber(
        answerTimeInput?.value,
        5,
        120,
        DEFAULT_GAME_CONFIG.answerTime
      ),
      winThreshold: clampNumber(
        winThresholdInput?.value,
        1,
        20,
        DEFAULT_GAME_CONFIG.winThreshold
      ),
      teamAName: normalizeTeamName(
        teamANameInput?.value,
        DEFAULT_GAME_CONFIG.teamAName
      ),
      teamBName: normalizeTeamName(
        teamBNameInput?.value,
        DEFAULT_GAME_CONFIG.teamBName
      )
    };
  
    closeConfigModal();
    startGame();
  }
  
  
  
  document.addEventListener("DOMContentLoaded", async () => {
    const user = await requireAuthOrRedirect();
    if (!user) return;
  
    const startGameBtn = document.getElementById("startGameBtn");
    const openConfigBtn = document.getElementById("openConfigBtn");
    const closeConfigBtn = document.getElementById("closeConfigBtn");
    const configBackdrop = document.getElementById("configBackdrop");
    const saveConfigBtn = document.getElementById("saveConfigBtn");
    const backMainDashboardBtn = document.getElementById("backMainDashboardBtn");

    if (backMainDashboardBtn) {
      backMainDashboardBtn.addEventListener("click", () => {
        window.location.href = "../../dashboard/index.html";
      });
    }
    if (startGameBtn) {
      startGameBtn.addEventListener("click", startGame);
    }
  
    if (openConfigBtn) {
      openConfigBtn.addEventListener("click", openConfigModal);
    }
  
    if (closeConfigBtn) {
      closeConfigBtn.addEventListener("click", closeConfigModal);
    }
  
    if (configBackdrop) {
      configBackdrop.addEventListener("click", closeConfigModal);
    }
  
    if (saveConfigBtn) {
      saveConfigBtn.addEventListener("click", saveConfigAndStart);
    }
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeConfigModal();
      }
    });
  });