// Fake & Dezinfo Alert - content script (Manifest V3)
//
// Běží na každé stránce. Porovnává aktuální web (a na YouTube i aktuální
// kanál) se seznamy uloženými pomocí background.js. V režimu "blokovat"
// přesměruje pryč na konspiratori.sk, jinak zobrazí zavíratelný varovný
// banner. V obou případech nahlásí hodnocení service workeru, aby se dal
// aktualizovat odznak na ikoně pro danou kartu.

const BANNER_ID = "fda-warning-banner";
const CHANNEL_ID_RE = /UC[0-9A-Za-z_-]{22}/;

function stripWww(host) {
  return host.replace(/^www\./i, "");
}

function isYouTubeHost(host) {
  return host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com";
}

function getChannelIdFromUrl() {
  const match = location.pathname.match(new RegExp("/channel/(" + CHANNEL_ID_RE.source + ")"));
  return match ? match[1] : null;
}

function getChannelIdFromCanonical() {
  const link = document.querySelector('link[rel="canonical"]');
  if (!link) return null;
  const match = link.href.match(CHANNEL_ID_RE);
  return match ? match[0] : null;
}

function getChannelIdFromPageData() {
  // YouTube má ID kanálu autora vložené ve svých interních JSON datech
  // (ytInitialData / ytInitialPlayerResponse), a to jak na stránce kanálu,
  // tak na stránce videa - i když URL používá tvar @handle nebo /watch?v=.
  const match = document.documentElement.innerHTML.match(/"channelId":"(UC[0-9A-Za-z_-]{22})"/);
  return match ? match[1] : null;
}

function findCurrentChannelId() {
  return getChannelIdFromUrl() || getChannelIdFromCanonical() || getChannelIdFromPageData();
}

function removeBanner() {
  const el = document.getElementById(BANNER_ID);
  if (el) el.remove();
}

function showBanner(rating) {
  if (!document.body) {
    // Kontrola webu běží už ve fázi document_start, kdy <body> ještě neexistuje.
    document.addEventListener("DOMContentLoaded", () => showBanner(rating), { once: true });
    return;
  }
  if (document.getElementById(BANNER_ID)) return;

  const banner = document.createElement("div");
  banner.id = BANNER_ID;
  banner.setAttribute(
    "style",
    "position:fixed;top:16px;left:50%;transform:translateX(-50%);z-index:2147483647;" +
      "max-width:640px;width:calc(100% - 32px);box-sizing:border-box;" +
      "background:#c0392b;color:#fff;font:15px/1.4 -apple-system,Segoe UI,Roboto,sans-serif;" +
      "border-radius:12px;padding:16px 44px 16px 20px;box-shadow:0 4px 20px rgba(0,0,0,.35);" +
      "text-align:left;"
  );
  const mkLink = (href, label) =>
    `<a href="${href}" target="_blank" rel="noopener" style="color:#fff;text-decoration:underline;">${label}</a>`;

  const message =
    'Právě se nacházíte na webu, který je ve veřejné databázi stránek se sporným, ' +
    "neseriózním, klamavým, podvodným, konspiračním nebo propagandistickým obsahem " +
    `(hodnocení ${rating.toFixed(1)}/10).`;

  const links =
    mkLink("https://www.konspiratori.sk/", "konspiratori.sk") +
    " &middot; " + mkLink("https://demagog.cz", "Demagog.cz") +
    " &middot; " + mkLink("https://www.cesti-elfove.cz", "Čeští Elfové") +
    " &middot; " + mkLink("https://manipulatori.cz", "Manipulátoři.cz");

  banner.innerHTML =
    `<div>${message}</div>` +
    `<div style="margin-top:6px;font-size:13px;white-space:nowrap;overflow-x:auto;">${links}</div>`;

  const closeBtn = document.createElement("button");
  closeBtn.textContent = "×";
  closeBtn.setAttribute("aria-label", "Zavřít");
  closeBtn.setAttribute(
    "style",
    "position:absolute;top:8px;right:10px;background:transparent;border:0;color:#fff;" +
      "font-size:22px;line-height:1;cursor:pointer;padding:4px 8px;"
  );
  closeBtn.addEventListener("click", removeBanner);
  banner.appendChild(closeBtn);

  document.body.appendChild(banner);

  // Gentle heartbeat pulse - a soft glow ring plus a subtle colour shift,
  // so the warning stays noticeable without being too aggressive/flashy.
  banner.animate(
    [
      { boxShadow: "0 4px 20px rgba(0,0,0,.35), 0 0 0 0 rgba(255,255,255,0)", backgroundColor: "#c0392b" },
      { boxShadow: "0 4px 20px rgba(0,0,0,.35), 0 0 0 7px rgba(255,255,255,.45)", backgroundColor: "#e74c3c" },
      { boxShadow: "0 4px 20px rgba(0,0,0,.35), 0 0 0 0 rgba(255,255,255,0)", backgroundColor: "#c0392b" },
    ],
    { duration: 1600, iterations: Infinity, easing: "ease-in-out" }
  );
}

function reportRating(rating) {
  chrome.runtime.sendMessage({ type: "rating", rating: rating ?? null }).catch(() => {
    // Service worker může zrovna "spát" nebo se startovat - odznak pak
    // jen zůstane v aktuálním stavu.
  });
}

function act(rating, blockMode) {
  if (rating == null) {
    removeBanner();
    reportRating(null);
    return;
  }

  reportRating(rating);

  if (blockMode) {
    location.replace("https://www.konspiratori.sk/");
  } else {
    showBanner(rating);
  }
}

async function checkSite() {
  const { sites, notifs } = await chrome.storage.local.get(["sites", "notifs"]);
  const host = stripWww(location.hostname.toLowerCase());
  const rating = sites && sites[host] != null ? sites[host] : null;
  if (rating != null) {
    act(rating, !!notifs);
    return true;
  }
  return false;
}

async function checkYouTubeChannel() {
  const { channels, notifs } = await chrome.storage.local.get(["channels", "notifs"]);
  const channelId = findCurrentChannelId();
  const rating = channelId && channels && channels[channelId] != null ? channels[channelId] : null;
  act(rating, !!notifs);
}

// Kontrola webu může běžet hned - potřebuje jen hostname, takže funguje
// i ve fázi document_start před vznikem DOM, a přesměrování v blokovacím
// režimu tak proběhne co nejdřív.
checkSite();

// Detekce YouTube kanálu potřebuje obsah stránky (canonical odkaz / vložený
// JSON), takže běží až po načtení DOM, a znovu pokaždé, když YouTube jako
// single-page aplikace přejde na jiný kanál/video bez celého reloadu.
if (isYouTubeHost(stripWww(location.hostname.toLowerCase()))) {
  const runYouTubeCheck = () => {
    checkSite().then((siteMatched) => {
      if (!siteMatched) checkYouTubeChannel();
    });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", runYouTubeCheck, { once: true });
  } else {
    runYouTubeCheck();
  }

  // YouTube vyvolá tuto vlastní událost při každé klientské navigaci.
  window.addEventListener("yt-navigate-finish", () => {
    removeBanner();
    setTimeout(runYouTubeCheck, 300);
  });
}
