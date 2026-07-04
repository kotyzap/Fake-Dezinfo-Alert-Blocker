// Fake & Dezinfo Alert - background service worker (Manifest V3)
//
// Stará se o:
//  - pravidelné stahování veřejného seznamu z konspiratori.sk
//  - rozparsování do dvou vyhledávacích tabulek (weby, YouTube kanály)
//  - udržování chrome.storage.local aktuální pro content.js a html.html
//  - nastavování odznaku (badge) na ikoně podle zpráv od content.js
//
// Zdroj dat: https://konspiratori.sk/osetrenie-kampane
// "mixed_zoznam.csv" obsahuje v jednom souboru weby i YouTube kanály.
// Sloupce (bez hlavičky): domain,rating,detailUrl,youtubeChannelUrl,youtubeChannelId
// U jednotlivých řádků může chybět buď sloupec s doménou, nebo se sloupci pro YouTube.

const FEED_URL = "https://konspiratori.sk/static/lists/mixed_zoznam.csv";
const ALARM_NAME = "refresh-feed";
const REFRESH_PERIOD_MINUTES = 360; // 6 hodin

function stripWww(host) {
  return host.replace(/^www\./i, "");
}

// Jednoduchý CSV parser. Hodnoty ve feedu neobsahují čárky ani uvozovky,
// takže obyčejné rozdělení podle čárky je bezpečné a ušetří závislost
// na CSV knihovně.
function parseFeed(text) {
  const sites = {};
  const channels = {};

  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    if (!line.trim()) continue;
    const cols = line.split(",");
    if (cols.length < 5) continue;

    const [domainRaw, ratingRaw, , , channelIdRaw] = cols;
    const rating = parseFloat(ratingRaw);
    if (Number.isNaN(rating)) continue;

    const domain = domainRaw.trim();
    if (domain) {
      sites[stripWww(domain.toLowerCase())] = rating;
    }

    const channelId = channelIdRaw.trim();
    if (channelId) {
      channels[channelId] = rating;
    }
  }

  return { sites, channels };
}

async function refreshFeed() {
  try {
    const res = await fetch(FEED_URL, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    const { sites, channels } = parseFeed(text);

    const siteCount = Object.keys(sites).length;
    const channelCount = Object.keys(channels).length;
    if (siteCount === 0 && channelCount === 0) {
      throw new Error("Feed se rozparsoval na nulu záznamů - seznam v úložišti nepřepisuji");
    }

    await chrome.storage.local.set({
      sites,
      channels,
      lastUpdated: Date.now(),
      lastError: null,
    });
    console.log(`Fake & Dezinfo Alert: seznam aktualizován (${siteCount} webů, ${channelCount} YouTube kanálů)`);
  } catch (err) {
    console.warn("Fake & Dezinfo Alert: aktualizace seznamu selhala, používám seznam z cache", err);
    await chrome.storage.local.set({
      lastError: String(err && err.message ? err.message : err),
      lastAttempt: Date.now(),
    });
  }
}

chrome.runtime.onInstalled.addListener(() => {
  // Výchozí hodnotu nastavíme jen při úplně první instalaci - nikdy
  // nepřepisujeme volbu, kterou už uživatel udělal (to byla chyba ve v2:
  // přepínač se resetoval při každém restartu prohlížeče).
  chrome.storage.local.get(["notifs"], (r) => {
    if (r.notifs === undefined) {
      chrome.storage.local.set({ notifs: false });
    }
  });

  chrome.alarms.create(ALARM_NAME, { periodInMinutes: REFRESH_PERIOD_MINUTES });
  refreshFeed();
});

chrome.runtime.onStartup.addListener(() => {
  refreshFeed();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) {
    refreshFeed();
  }
});

// content.js hlásí hodnocení (nebo null) pro stránku, na které běží;
// aktualizace odznaku na základě zpráv nahrazuje starý setInterval,
// který by stejně nemohl v service workeru Manifestu V3 spolehlivě běžet.
chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg && msg.type === "rating" && sender.tab && sender.tab.id != null) {
    const tabId = sender.tab.id;
    if (msg.rating != null) {
      chrome.action.setBadgeText({ tabId, text: String(msg.rating) });
      chrome.action.setBadgeBackgroundColor({
        tabId,
        color: msg.rating < 7 ? "#ff7a05" : "#ff0000",
      });
    } else {
      chrome.action.setBadgeText({ tabId, text: "" });
    }
  }
  return false;
});
