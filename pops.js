// Fake & Dezinfo Alert - logika vyskakovacího okna (popup)

const blockButton = document.getElementById("blcal");
const heading = document.getElementById("hed");
const stats = document.getElementById("stats");

function showBlockedState() {
  blockButton.style.display = "none";
  heading.innerHTML = "Weby a YouTube kanály ze seznamu<br>jsou blokovány";
  heading.style.color = "#c0392b";
}

function showDefaultState() {
  blockButton.style.display = "block";
  heading.innerHTML = "Nechcete už číst dezinformace<br>&amp; fake news?";
  heading.style.color = "";
}

blockButton.addEventListener("click", () => {
  chrome.storage.local.set({ notifs: true }, showBlockedState);
});

chrome.storage.local.get(["notifs", "sites", "channels", "lastUpdated", "lastError"], (r) => {
  if (r.notifs) {
    showBlockedState();
  } else {
    showDefaultState();
  }

  const siteCount = r.sites ? Object.keys(r.sites).length : 0;
  const channelCount = r.channels ? Object.keys(r.channels).length : 0;

  if (!r.lastUpdated) {
    stats.textContent = r.lastError
      ? "Seznam se zatím nepodařilo stáhnout."
      : "Seznam se stahuje...";
    return;
  }

  const when = new Date(r.lastUpdated).toLocaleString("cs-CZ");
  stats.textContent = `${siteCount} webů, ${channelCount} YouTube kanálů - aktualizováno ${when}`;
});
