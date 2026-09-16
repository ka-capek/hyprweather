# Assets — zdroje a licence

Kód projektu je pod GPL v3 (`LICENSE`). Na nic z níže uvedeného se to
nevztahuje — každé aktivum si nese vlastní podmínky.

Přehled všech přibalených souborů, které nevznikly v tomto projektu.
Před případným veřejným publikováním projektu ověř údaje znovu u zdroje.

---

## Fotografie pozadí

**Soubor:** `assets/img/sky-storm.png` (1974 × 2094, PNG)

| | |
|---|---|
| Zdroj | Unsplash |
| URL | https://unsplash.com/photos/dark-stormy-clouds-fill-the-sky-PaSbzKR5pt8 |
| ID | `PaSbzKR5pt8` |
| Autor | engin akyurt (převzato z dosavadní rešerše v `AGENTS.md`; Unsplash blokoval automatické načtení stránky, EXIF originálu jméno autora neobsahuje — **před publikováním ověř ručně v prohlížeči**) |
| Licence | [Unsplash License](https://unsplash.com/license) — bezplatné komerční i nekomerční použití, úpravy povoleny, atribuce není vyžadována, ale je slušností |

**Zpracování:** originál 11648 × 8736 px stažen přes oficiální download endpoint,
středově oříznut na poměr 1316 : 1396 (8235 × 8736) a zmenšen na 1974 × 2094 PNG
(≈ 1,5× cílové rozlišení okna). Barvy nebyly upravovány; ztmavení spodní části
dělá CSS gradient (`.sky-veil`), aby zůstala zachována textura mraků.

**Status:** dočasná vizuální reference pro budoucí animovanou scénu (Etapa 4).

---

## Písmo

**Soubory:** `assets/fonts/Inter-latin.woff2`, `assets/fonts/Inter-latin-ext.woff2`

| | |
|---|---|
| Rodina | Inter (variabilní, váhy 200–700) |
| Autor | The Inter Project Authors — Rasmus Andersson |
| Zdroj souborů | Google Fonts CDN (`fonts.gstatic.com`, Inter v20), subsety `latin` a `latin-ext` |
| Domov projektu | https://github.com/rsms/inter |
| Licence | SIL Open Font License 1.1 — plný text v `assets/fonts/OFL.txt` |

OFL 1.1 dovoluje přibalení a distribuci včetně komerční, pokud písmo není
prodáváno samostatně a licenční text zůstává přiložen. Obě podmínky splněny.

Inter byl vybrán kvůli kvalitním číslicím a dostupnému `tnum` (tabulkové číslice),
což drží zarovnání teplot ve sloupcích.

---

## Ikony počasí

**Umístění:** inline SVG sprite přímo v `index.html` (`<symbol id="i-*">`)

Kresleno ručně pro tento projekt. Žádná externí ikonová knihovna, žádná cizí
licence. Jednotná mřížka 24 × 24, tah 1.5, zaoblené konce.

---

## Meteorologická data

**Zdroj:** [Open-Meteo](https://open-meteo.com/) — předpověď i geokódování měst.

| | |
|---|---|
| Endpointy | `api.open-meteo.com/v1/forecast`, `geocoding-api.open-meteo.com/v1/search` |
| Klíč / účet | nevyžadován |
| Licence dat | CC BY 4.0 — **atribuce je povinná** |
| Podmínky | bezplatné pro nekomerční použití, limit 10 000 volání denně |

Atribuce je v aplikaci vidět trvale v popisku vlevo nahoře (`Open-Meteo · updated …`).
Ověřeno 2026-09-16: odpovídá s `access-control-allow-origin: *` i pro `Origin: null`.
Aplikace se dotazuje jednou za 10 minut, při chybě zkouší po minutě.

**Zdroj polohy podle IP:** [geojs.io](https://get.geojs.io/), při selhání
[ipwho.is](https://ipwho.is/). Obě HTTPS, bez klíče, s CORS. Poloha je odhad;
při VPN vyjde jinde.

Nepoužité, prověřené kandidáty: `ipapi.co` (vrátilo rovnou HTTP 429),
`ip-api.com` (na bezplatném tieru pouze HTTP, bez TLS).

**Před veřejným publikováním** znovu ověř podmínky všech tří služeb a doplň
atribuci Open-Meteo i do README a do případného „o aplikaci".

## Mock data

`js/data.js` obsahuje smyšlený scénář pro posuzování vzhledu. Do produkčního
zobrazení se nedostane — načte se jen na `?mock` a je zřetelně označený jako
`Design preview · Sample weather`.

## Animated night sky

Bundled celestial star map: NASA/Goddard Space Flight Center Scientific Visualization Studio,
**Deep Star Maps**, https://svs.gsfc.nasa.gov/3895 . Public-domain NASA SVS asset;
source URL, credits, projection and limitations are recorded in
[`WeatherAnimationLab/ASSETS.md`](WeatherAnimationLab/ASSETS.md).
