# Fake & Dezinfo Alert (v3) - Chrome

Firefox verze je v sousední složce `Fake_and_Dezinfo_Alert-v3-Firefox` (stejný kód, jiný `manifest.json` a instalační postup - viz její vlastní README). Safari verzi jsme zkoušeli, ale vyžaduje balení přes Xcode do nativní aplikace, což se ukázalo jako zbytečná komplikace pro tento projekt, takže jsme ji zrušili.

Rozšíření pro Google Chrome, které varuje před weby a YouTube kanály uvedenými
ve veřejné databázi [konspiratori.sk](https://www.konspiratori.sk) - projektu,
který eviduje stránky se sporným, neseriózním, klamavým, podvodným,
konspiračním nebo propagandistickým obsahem.

Rozšíření umí dva režimy:

- **Varování** (výchozí) - na stránce se zobrazí červený banner s hodnocením
  a odkazem na konspiratori.sk. Banner lze zavřít křížkem.
- **Blokování** - po kliknutí na "Zablokovat vše" v popupu se každá další
  návštěva webu nebo YouTube kanálu ze seznamu automaticky přesměruje na
  konspiratori.sk.

Odznak na ikoně rozšíření navíc ukazuje číselné hodnocení dané stránky
(oranžová pod 7 bodů, červená od 7 výš).

## Instalace (needitovaná/vývojová verze)

1. Otevřete `chrome://extensions`
2. Zapněte **Vývojářský režim** (přepínač vpravo nahoře)
3. Klikněte na **Načíst rozbalené**
4. Vyberte tuto složku (`Fake_and_Dezinfo_Alert-v3-Chrome`)
5. Ikona se objeví na liště - pokud ne, připněte ji přes ikonu skládačky

Po instalaci chvíli trvá, než se na pozadí stáhne aktuální seznam - stav
(počet webů a kanálů, čas poslední aktualizace) je vidět v popupu.

## Jak to funguje

- `background.js` - service worker na pozadí. Jednou denně (respektive
  každých 6 hodin) stáhne aktuální seznam z konspiratori.sk a uloží ho do
  `chrome.storage.local`. Seznam se stahuje i při instalaci a startu
  prohlížeče. Pokud stažení selže, ponechá se poslední funkční kopie.
- `content.js` - běží na každé navštívené stránce. Porovná doménu (a na
  YouTube i ID aktuálního kanálu) s uloženým seznamem a podle zvoleného
  režimu buď zobrazí banner, nebo přesměruje pryč. Zároveň pošle hodnocení
  service workeru, aby nastavil odznak na ikoně.
- `html.html` + `pops.js` - popup, který se otevře po kliknutí na ikonu.
  Zobrazuje přepínač mezi režimem varování a blokování a stav seznamu.
- `manifest.json` - Manifest V3 (service worker, `action`, `host_permissions`).

## Zdroj dat

Seznam se stahuje z oficiálního veřejného exportu konspiratori.sk určeného
primárně pro vylučování reklamních umístění:

```
https://konspiratori.sk/static/lists/mixed_zoznam.csv
```

Soubor obsahuje jak weby, tak YouTube kanály v jednom CSV (bez hlavičky),
sloupce: `doména, hodnocení, odkaz na detail, URL YouTube kanálu, ID YouTube kanálu`.
Pokud konspiratori.sk cestu k souboru v budoucnu změní, stačí upravit
konstantu `FEED_URL` v `background.js`.

## Oprávnění

- `storage` - ukládání staženého seznamu a nastavení uživatele
- `alarms` - pravidelné plánované stahování seznamu
- `host_permissions` (`http://*/*`, `https://*/*`) - potřeba pro spuštění
  kontrolního skriptu na každé navštívené stránce a pro stahování seznamu
  na pozadí

Rozšíření nikam neposílá historii prohlížení - porovnání probíhá čistě
lokálně v prohlížeči proti jednou staženému seznamu.

## Známá omezení

- Detekce YouTube kanálu na stránkách s vlastním @handle nebo na stránkách
  videí se opírá o interní JSON data YouTube stránky (`channelId` v
  `ytInitialData`); pokud YouTube změní strukturu stránky, může být potřeba
  detekci upravit v `content.js`.
- V blokovacím režimu se přesměrování spouští asynchronně (po načtení
  uloženého seznamu), takže na velmi rychlých stránkách se stránka může na
  zlomek sekundy zobrazit, než dojde k přesměrování.
- `popup.html` a `hi3.png` jsou nepoužívané soubory z původní verze z roku
  2019 (manifest je nikde neodkazuje) - lze je bez obav smazat.

## Historie

Původní verze (2.0, 2019) používala Manifest V2 a vlastní staženou kopii
jQuery pro parsování XML seznamu jen webových stránek. Verze 3 je kompletní
přepis na Manifest V3 (nutné, protože Chrome Manifest V2 v roce 2026 zcela
vyřazuje), přidává podporu YouTube kanálů a opravuje několik chyb (mj. reset
přepínače blokování při každém restartu prohlížeče).
