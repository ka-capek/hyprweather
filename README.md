# WeatherApp

Linuxová weather aplikace zaměřená na atmosféru a animované pozadí.
Úplné zadání, rozhodnutí a plán etap: **[`AGENTS.md`](AGENTS.md)**.

## Stav

**Živá data z Open-Meteo.** Vzhled je odsouhlasený, data jsou skutečná.

| | |
|---|---|
| Cílový rozměr okna | 1316 × 1396 px |
| Předpověď | Open-Meteo, bez klíče, obnova po 10 min |
| Poloha | podle IP nebo ručně vybrané město |
| Pozadí | animovaná obloha podle aktuálních dat |
| Animace a zvuk | animace zapojené, zvuk zatím není |

Kliknutím na název města otevřeš vyhledávání. Volba se pamatuje; `Use current location` vrátí polohu podle IP. Časy předpovědi odpovídají vybranému městu.

Data se ukládají, takže po restartu je hned co ukázat. Bez sítě zůstane poslední
známá předpověď a popisek se přepne na `Offline · last update …` — smyšlená data
se nikdy nevydávají za skutečná.

`?mock` zobrazí návrhový scénář z `js/data.js`, označený jako
`Design preview · Sample weather`.

## Spuštění

### Jako okno (doporučeno)

Vyžaduje Electron, Node.js 22+ a npm. `run.sh` sestaví animované pozadí; při prvním spuštění také nainstaluje jeho závislosti.

```sh
./run.sh            # aplikace
./run.sh shapes     # galerie tvarů sloupce, velké specimeny
./run.sh styles     # kódování intenzity
./run.sh inapp      # každý tvar ve skutečném srážkovém panelu, 1:1
```

Čisté okno 1316 × 1396 px přes Electron — bez adresního řádku, záložek, menu
i rámečku. V běžícím okně přepínáš stránky klávesami `1` / `2` / `3` / `4`.
`Esc` zavře, `F5` znovu načte, `F12` otevře devtools.

Laboratoře jsou naskládané přesně na tenhle rozměr, takže je vidíš ve skutečné
velikosti a bez scrollování — stejně jako aplikaci.

> Electron je tu jen vývojový obal, aby šel prototyp posoudit jako aplikace.
> **Není to rozhodnutí o technologii** — výběr stacku patří do Etapy 3.

### Screenshot v cílovém rozměru

```sh
./shot.sh                 # PNG + vykreslení do terminálu (kitty)
./shot.sh 1600 900        # jiný rozměr
```

`shot.sh` běží přes Firefox headless. Pixelově shodný snímek přímo z okna
aplikace dá `./run.sh --capture=out.png`.

### Instalovatelný balíček

```sh
npm install      # jednou: Electron a electron-builder
npm run dist     # AppImage + pacman balíček do release/
npm run pack     # jen rozbalený adresář release/linux-unpacked na zkoušku
```

| Výsledek | Jak se použije |
|---|---|
| `release/hyprweather-<verze>-x86_64.AppImage` | `chmod +x` a spustit, nic se neinstaluje |
| `release/hyprweather-<verze>-x64.pacman` | `sudo pacman -U release/hyprweather-<verze>-x64.pacman` |

Oba balíčky si nesou vlastní Electron (~320 MB rozbaleno), takže nezávisí na
systémovém `electron43` ani na Node.js. Pacman verze se instaluje do
`/opt/Weather`, přidá položku menu **Weather** s ikonou; okno má `app_id`
`hyprweather` — podle toho ho adresují pravidla Hyprlandu. Odinstaluje se
`sudo pacman -R hyprweather`.

Cache počasí a vybrané město žijí v `~/.config/hyprweather/store.json`.
Vývojové spuštění přes `./run.sh` má vlastní úložiště, balíček s ním nesdílí nic.

V balíčku jsou jen soubory, které aplikace potřebuje za běhu — laboratorní
stránky, testy a zdroje animace zůstávají mimo. Konfigurace je
v [`electron-builder.yml`](electron-builder.yml), ikona vzniká z `build/icon.svg`
přes `npm run icons` (vyžaduje `rsvg-convert`).

### Vydání na GitHubu

Balíčky sestavuje GitHub Actions — [`.github/workflows/release.yml`](.github/workflows/release.yml):

```sh
# verze v package.json a v tagu se musí shodovat, jinak sestavení skončí
git tag v0.1.0 && git push origin v0.1.0
```

Tag `v*` spustí testy, sestavení a vytvoří vydání s AppImage, `.pacman`
a `SHA256SUMS.txt`. Ruční spuštění (workflow_dispatch) balíčky jen přiloží
k běhu jako artefakt a nic nevydává.

### AUR

[`packaging/aur/`](packaging/aur/) drží `PKGBUILD` balíčku **`hyprweather-bin`**,
který bere AppImage z vydání a rozbalí ho do `/opt/hyprweather`. Postup pro nové
verze i pro první odeslání do AUR je v [`packaging/aur/README.md`](packaging/aur/README.md).
Po přidání se aplikace instaluje `yay -S hyprweather-bin`.

## Laboratoř vzhledů

Dvě nezávislé volby, dvě stránky. Otevři je přes `./run.sh` (klávesy 1–4),
ať je vidíš ve skutečné velikosti.

| Stránka | `./run.sh` | Volí | Zapisuje se do |
|---|---|---|---|
| `lab/bar-shapes.html` | `shapes` | jak vypadá **jeden sloupec** — 23 tvarů | `precip.barShape` |
| `lab/precip-styles.html` | `styles` | jak se **kóduje intenzita** — 8 způsobů | `precip.barStyle` |
| `lab/shapes-in-app.html` | `inapp` | tvary ve **skutečném panelu** aplikace, 1:1 | `precip.barShape` |

Na stránce `inapp` listuješ tvary šipkami `↑` `↓`, klávesa `C` zapne kompaktní
režim (nižší panel, víc tvarů najednou).

## Struktura

```
index.html              kostra kompozice + SVG sprite ikon
css/styles.css          celý vizuální systém
js/weather.js           živá data: poloha, Open-Meteo, cache, offline stav
js/data.js              mock scénář pro ?mock a laboratoře
js/app.js               vykreslení dat do DOM
js/precip.js            srážkový graf — renderer, osy a kódování intenzity
js/bar-shapes.js        tvary sloupce, sdílené grafem i galerií
lab/bar-shapes.html     galerie tvarů sloupce (vývojová stránka)
lab/precip-styles.html  způsoby kódování intenzity (vývojová stránka)
lab/shapes-in-app.html  tvary ve skutečném panelu aplikace (vývojová stránka)
lab/_lab.css            společný rám vývojových stránek
devshell/               Electron obal: okno, schéma app://, trvalé úložiště
WeatherAnimationLab/    animovaná obloha (Three.js, Vite) — sestavuje se do dist/
assets/img/             fotografie pozadí
assets/fonts/           Inter (OFL) + licence
build/                  ikona aplikace (SVG a vygenerované PNG)
electron-builder.yml    sestavení AppImage a pacman balíčku
packaging/aur/          PKGBUILD pro AUR (hyprweather-bin)
.github/workflows/      sestavení a vydání balíčků na GitHubu
run.sh                  spuštění jako okno
shot.sh                 screenshot v cílovém rozměru
ASSETS.md               zdroje a licence přibalených souborů
AGENTS.md               zadání a plán všech etap
```

Samotná aplikace je prostý HTML, CSS a JavaScript bez backendu. Build a npm
závislosti potřebuje jen animované pozadí a balení do AppImage či pacman balíčku.

## Ukázkový scénář

Praha, 18 °C, bouřka slábnoucí přes večer, druhé slabší pásmo o čtyři hodiny
později, k ránu vyklízení. Časy se počítají od aktuálního okamžiku. Označeno v levém horním rohu jako
`Design preview · Sample weather`.

Srážkový graf používá meteorologické prahy (slabý < 2,5 · mírný 2,5–7,6 ·
silný > 7,6 mm/h). Každé pásmo dostane na svislé ose **stejnou třetinu výšky**,
uvnitř pásma je mapování lineární — jinak by slabý déšť zabíral osminu grafu
a nešel odečíst. Varianta `mm-axis` si ponechává skutečně lineární škálu,
protože nese čísla.

**Časy jsou skutečné, hodnoty smyšlené.** Graf začíná aktuálním okamžikem,
popisky osy leží na celých sudých hodinách (`Now`, `20:00`, `22:00` …) a okno
si je za běhu samo aktualizuje.

Vzhled je zvolený: sloupce **`hatched-uniform`** (šrafované, se šrafováním
i obrysem slábnoucím dolů na 22 %, obrys 2,0 px po celém obvodu) v kódování
**`bands`** (pojmenovaná pásma na svislé ose). Ostatní tvary a kódování zůstávají
v `js/bar-shapes.js`, `js/precip.js` a v laboratořích jako záznam hledání.

## Licence

Kód je pod **GNU GPL v3** — viz [`LICENSE`](LICENSE).

Na přibalená aktiva se GPL nevztahuje, ta si nesou vlastní podmínky:

| | |
|---|---|
| Písmo Inter | SIL Open Font License 1.1 |
| Fotografie pozadí | Unsplash License |
| Meteorologická data | Open-Meteo, CC BY 4.0 — atribuce povinná |

Podrobnosti a odkazy v [`ASSETS.md`](ASSETS.md).
