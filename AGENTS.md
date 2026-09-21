# WeatherApp — zadání, kontext a implementační plán

Tento dokument je dlouhodobým kontextem pro vývoj aplikace. Zachovává rozhodnutí uživatele i pořadí práce. Pozdější explicitní pokyny uživatele mají přednost. Aktualizuj jej při schválených změnách směru; neoznačuj návrhy jako hotové nebo schválené funkce.

## Aktuální stav a bezprostřední úkol

- **Etapa 6 rozpracovaná: aplikace běží na živých datech z Open-Meteo.** Uživatel si vyžádal skok na reálná data před Etapami 3–5 (desktopový stack, animace, zvuk); ty zůstávají neudělané.
- Spuštění: `./run.sh`. Laboratoře `./run.sh shapes` / `styles` / `inapp`, v okně klávesy 1–4.
- Hotovo v datové vrstvě (`js/weather.js`): poloha podle IP, předpověď, převod WMO kódů na stav a ikony, patnáctiminutové srážky s náhradou hodinovými, cache na disku, obnova po 10 minutách, opakování po minutě při chybě, offline zobrazení posledních dat s údajem o stáří.
- **Zbývá z Etapy 6:** ruční vyhledání města a návrat na `Current location`. Datová vrstva to už umí (`Weather.search`, `Weather.setPlace`), chybí nenápadné UI.
- Vzhled je odsouhlasený: tvar sloupce `hatched-uniform`, kódování `bands`, škála po třetinách, živý čas na ose.

## Rozhodnutí a nálezy k živým datům

- **Open-Meteo** — bez klíče a účtu, limit 10 000 volání denně, licence dat CC BY 4.0 s **povinnou atribucí**. Ta je trvale v popisku vlevo nahoře. Ověřeno 2026-09-16, že posílá `access-control-allow-origin: *` i pro `Origin: null`.
- **IP poloha: `geojs.io`, záloha `ipwho.is`.** Obě HTTPS, bez klíče, s CORS. `ipapi.co` vrátilo rovnou HTTP 429 a `ip-api.com` je na bezplatném tieru jen HTTP bez TLS — nepoužitelné.
- **Aplikace se servíruje přes vlastní schéma `app://`, ne přes `file://`.** Pod `file://` je origin neprůhledný. Nezkoušej se vrátit k `file://`.
- **Trvalé úložiště drží hlavní proces v JSON souboru** (`devshell/preload.js` + `store:get`/`store:set` v `devshell/main.js`), protože Chromium ani pro `app://` localStorage mezi spuštěními nezachová — ověřeno, zápisy skončí v Session Storage a po restartu jsou pryč. `js/weather.js` použije `window.appStore`, když existuje, jinak spadne na localStorage (prohlížeč, laboratoře).
- **Srážky:** `minutely_15.precipitation` je úhrn v mm za 15 minut, **ne mm/h** — převádí se. Dvojice patnáctiminutovek se slučuje na půlhodinový krok. Když pro lokalitu patnáctiminutová data nejsou, použijí se hodinová; model si nese `resolution`.
- **Chybějící hodnoty zůstávají `null`** a v grafu se přeskakují. Nikdy se nevykreslí jako nula.
- **Mock data se do produkčního zobrazení nedostanou.** Načtou se jen na `?mock` a nesou vlastní označení.
- Ikony byly doplněny o `snow`, `fog`, `moon` a `partly-night` — reálné WMO kódy je vyžadují.

## Změny směru schválené uživatelem po prvním prototypu

Tyto pokyny mají přednost před staršími formulacemi v popisu Etapy 1 níže.

- **Žádný text popisující data.** Slovní shrnutí vývoje (`Rain easing this evening.`) i titulek nad srážkovým grafem (`Rain stopping in about 2 hours`) byly odstraněny na výslovné přání uživatele. Nepřidávej je zpět.
- **Bez nadpisů panelů.** `NEXT 24 HOURS` a `5-DAY FORECAST` uživatel zrušil jako zbytečné — obsah je čitelný sám o sobě. Nadpis srážkového panelu padl se stejným odůvodněním, protože jeho roli převzala časová osa.
- **Srážkový graf pokrývá 12 hodin, ne 2.** Menší detail je v pořádku, místa je dost.
- **Osa x nese skutečný místní čas** (`18:00`, `20:00`, …), ne relativní odstup typu `30m`.
- **Pásma intenzity mají na svislé ose stejnou výšku.** Slabý, mírný a silný déšť dostanou každý přesně třetinu; uvnitř pásma je mapování lineární. Dřívější škála lineární v mm/h tlačila slabý déšť do osminy výšky a uživatel ji odmítl. Číselná osa (`mm-axis`) si lineární škálu ponechává, jinak by čísla lhala.
- **Časy v UI jsou skutečné, hodnoty zůstávají smyšlené.** Uživatel odmítl zamrzlý čas. Srážkový graf začíná aktuálním okamžikem zaokrouhleným dolů na krok řady, hodinový výhled i názvy dnů se počítají od teď. Tím padá dřívější věta „Časové údaje mohou být pevné pro stabilní vizuální posuzování" — pevný čas zůstává jen jako možnost pro fixture (`precip.startHour`).
- **Popisky časové osy leží na celých sudých hodinách, ne v odstupech od začátku.** Vlevo je `Now`, pak `20:00`, `22:00`… Popisek, který by se otřel o `Now` nebo o pravý okraj, se vynechá. Díky tomu jsou to vždy kulaté časy a osa nikdy nevypadá rozsypaně, ať se graf vykreslí kdykoli.
- **Běžící okno si čas hlídá samo.** `js/app.js` kontroluje otisk času a překresluje graf i panely při změně půlhodiny nebo dne, aby po hodinách běhu nezobrazovalo zastaralé časy.
- **Graf se musí překreslit při změně velikosti okna.** SVG má viewBox v pixelech; bez překreslení se jen roztáhne podle starého viewBoxu a obsah se zmenší do letterboxu. `ResizeObserver` v `js/app.js` to hlídá — neodstraňuj ho.
- **Osa y musí být srozumitelná.** První pokus ji nechal bez popisků a s mocninnou škálou; uživatel pak nepoznal, co sloupce znamenají. Svislá škála je proto lineární v mm/h s meteorologickými prahy (slabý < 2,5 · mírný 2,5–7,6 · silný > 7,6 mm/h) a osa se popisuje.
- **Mock data musí mít realistický rozsah.** Původní hodnoty měly vrchol 3,4 mm/h, což je na bouřku nesmysl a připravilo graf o dynamiku. Bouřkový vrchol je nyní 16 mm/h.
- **Popisky časové osy byly příliš malé.** Zvětšeno na 13,5 px.
- **Varianty vzhledu předkládej velké a všechny najednou.** Uživatel třikrát odmítl porovnávání tvarů na malých sloupcích v grafu. Správná forma je galerie, kde je každý tvar vykreslený ve velkém a vedle něj v poloviční velikosti jako kontrola, že funguje i v malém. `lab/precip-styles.html` navíc kreslí stejně vysoké sloupce; `?real` přepne na skutečná data.
- **Popisky os musí být čitelné.** Uživatel si na drobné písmo stěžoval dvakrát. Časová osa je 15 px, popisky pásem intenzity 12,5 px, obojí s vysokým kontrastem. Nezmenšuj to kvůli kompozici.
- **Sloupce bez gradientu.** Uživatel si vybírá vzhled z variant v `lab/precip-styles.html`; naznačil zájem o průhlednou výplň s výraznějším obrysem.
- Spodní teplotní pruhy pětidenního výhledu uživatel schválil beze změn.

## Vize produktu

Linuxová weather aplikace inspirovaná vizuální kvalitou Apple Weather na iOS. Má být krásným, živým oknem s počasím vedle hlavní aplikace na velkém ultrawide displeji. Uživatel ji přirovnává k widgetu, ale požaduje normální velké aplikační okno, nikoli nutně desktopový widget nebo panelový applet.

Nejdůležitější je atmosféra a animované pozadí přes celou výšku okna. Vizuální kvalita má vyšší prioritu než vysoká hustota dat či rozšiřování funkcí. Apple je inspirace, nikoli požadavek na přesnou kopii interakcí. Uživatel nakonec upřesnil, že mu na Apple Weather nic zásadního nevadí; nevymýšlej zbytečně složité „chytřejší“ zobrazování deště.

Liquid glass není prioritou. Preferuj prostor, kvalitní typografii, silnou kompozici a počasí jako hlavní zážitek. Rozhraní je v angličtině; pracovní komunikace s uživatelem může být česky.

## Ověřené cílové prostředí

Zjištěno přímo ze systému a Hyprlandu dne 2026-09-16:

- CachyOS Linux, rolling distribuce příbuzná Archu, x86_64.
- Hyprland a Wayland.
- Monitor Philips 49M2C8900, 49 palců, 5120 × 1440 px, přibližně 240 Hz.
- Škálování displeje 1, tedy 100 %.
- Terminál kitty s touto konverzací měl rozměr **1316 × 1396 px**, pozici přibližně x=3782, y=22.
- Právě rozměr tohoto terminálu je výchozí cílová velikost weather aplikace. Nezaměň jej s celým monitorem ani rozměrem aktuálně fokusovaného prohlížeče.
- Projektový adresář: `/home/karel/Documents/WeatherApp`.

Geometrie se může později změnit. Pokud bude potřeba ověřit skutečné rozměry, použij čtecí dotazy Hyprlandu (`hyprctl -j clients`, `hyprctl -j monitors`). Bez důvodu neupravuj uživatelův layout ani konfiguraci compositoru.

## Dohodnuté vlastnosti aplikace

### Platforma a distribuce

- Linux only; konkrétním prvním cílem je tento CachyOS/Hyprland desktop.
- Uživatel nemá preferovaný technologický stack. Vyber podle vizuální kvality a spolehlivosti výsledku.
- Aplikace má být zdarma a bez uživatelského účtu či povinného vlastního API klíče.
- Pokud se povede, může se stát veřejným open-source projektem. Publikování zatím není požadováno.
- Uživatel toleruje vysokou spotřebu zdrojů, orientačně i 2 GB RAM a 40 % CPU, pokud to pomůže vzhledu. Jsou to vyjádřené tolerance, nikoli cílová spotřeba nebo naměřené hodnoty.
- Neomezuj zbytečně vizuální kvalitu kvůli předčasné optimalizaci; zachovej plynulost a stabilitu.

### Poloha a jednotky

- Výchozí lokalitu později odhaduj automaticky podle IP. Uživatel výslovně přijal přibližnost i možnost nesprávného výsledku při VPN.
- Nabídni možnost ručně vyhledat a zvolit jiné město.
- Ruční volbu si pamatuj, dokud uživatel nepřepne zpět na `Current location`.
- Neslibuj přesnou GPS polohu na desktopu.
- Stupně Celsia a metrické jednotky jsou dosavadní pracovní předpoklad; uživatel nevznesl opačný požadavek.
- Konkrétní IP geolokační služba zatím vybrána není. Před integrací ověř dostupnost, podmínky, limity a požadavek bez účtu.

### Scéna a počasí

- Animované pozadí přes celé okno, včetně prostoru pod spodními informačními částmi.
- Produkční scéna vždy odpovídá dostupným aktuálním meteorologickým datům a místní denní době vybrané lokality.
- Uživatel odmítl běžně dostupný přepínač počasí či scén. Vývojové testovací scénáře mohou existovat interně, ale nejsou produktovým ovládáním.
- Hlavní efekty: prostorové mraky, světlo, déšť, sníh, mlha a bouřky podle podmínek.
- Za bouřky má být scéna epická: tmavé těžké mraky, výrazné blesky, déšť a hřmění. Uživatel výslovně odmítl návrh automaticky tlumit dramatičnost jen proto, že okno bude vedle práce.
- Základ deště je v otevřeném prostoru, nikoli kapky stékající po skle.
- Později lze experimentálně vyzkoušet pár kapek na skle v kombinaci s prostorovým deštěm; nejde o schválenou výchozí součást ani důvod ji přidat do prvního prototypu.
- Změny počasí a denní doby mají později působit plynule.

### Zvuk

- Průběžná kvalitní atmosféra: déšť, vítr, hřmění; nejde o zvuky klikání a notifikací.
- Při prvním spuštění má zvuk rovnou hrát na střední, zřetelné hlasitosti. Dříve navržených 20 % není závazné: uživatel upřesnil „semi hlasitě“.
- Hlasitost a mute se mají pamatovat mezi spuštěními; konkrétní počáteční gain dolaď podle skutečných nahrávek.
- Jasné klidné počasí má být tiché. Ptáci, cvrčci a podobný ambient nejsou požadováni.
- Vítr může být slyšet i za jasna, pokud skutečně fouká; intenzitu později odvoď z počasí a dolaď poslechem.
- Ztráta focusu sama o sobě zvuk nikdy neztlumí.
- Výchozí chování: zvuk hraje i při přechodu na jiný workspace.
- Volitelný přepínač `Mute on other workspaces`: aplikace na workspace 1 hraje, když uživatel pracuje v jiné aplikaci na workspace 1; při přechodu na workspace 2 se plynule ztlumí a při návratu zase zesílí.
- Tento přepínač má být ve výchozím stavu vypnutý. Jde o integraci s Hyprlandem, nikoli obecnou schopnost všech Wayland compositorů.
- Zvukové nahrávky mají být kvalitní, smyčkovatelné a s licencí dovolující přibalení/distribuci v projektu. „Free download“ samo o sobě není dostačující licence.
- Žádné konkrétní zvukové assety zatím nejsou vybrané ani stažené.

### Informační architektura

- Aktuální počasí a vizuální atmosféra jsou hlavní.
- Vše hlavní se má vejít do cílového okna na jednu obrazovku, bez scrollování či přepínání stránek.
- Horních přibližně 60–65 % nech převážně obloze a hlavním údajům.
- Hlavní údaje: město, velká teplota, stav počasí, pocitová teplota, denní minimum a maximum.
- Spodní část: krátké slovní shrnutí vývoje, srážkový výhled, 24hodinová předpověď a kompaktní několikadenní výhled.
- Nejsou požadovány radar, AQI, UV, komplikované meteorologické dashboardy, panelový applet, oznámení ani autostart. Nepřidávej je jako automatickou součást rozsahu.
- Pozdější ovládání polohy, hlasitosti a nezbytných nastavení má být nenápadné a nemá zatěžovat hlavní kompozici.

## Etapa 1 — statický vizuální prototyp

### Účel a technologie

Nejprve schválit rozložení, typografii, proporce a atmosféru v reálné velikosti. Implementuj HTML/CSS s minimem JavaScriptu. Finální desktopový obal a renderer animací zatím nejsou vybrané. Webový prototyp není závazek, že výsledná aplikace bude běžná webová stránka.

### 1. Založení projektu

- Pracuj v tomto kořeni, zachovej tento dokument a případné novější uživatelské soubory.
- Připrav jednoduché lokální spuštění náhledu a stručné instrukce.
- Nevytvářej backend, účty, API integrace ani zbytečně složitou strukturu.
- Mock data drž odděleně od rozložení na jednom snadno upravitelném místě.

### 2. Statické PNG pozadí

- Najdi skutečnou kvalitní fotografii dramatické bouřkové oblohy; uživatel výslovně požaduje v této fázi nalezený PNG obrázek místo animace.
- Zdroj může být v jiném rastrovém formátu; v takovém případě jej normálně převeď na PNG. Není potřeba obraz generovat pomocí AI.
- Ověř zdroj a licenci, ulož asset lokálně a zaznamenej autora, URL a podmínky použití.
- Upřednostni mraky s výraznou strukturou a hloubkou, které snesou ořez do téměř čtvercového formátu.
- Obraz vyplní celou plochu okna. Spodní část jemně ztmav kvůli čitelnosti; neznič tím texturu ani dramatičnost mraků.
- Fotografie je dočasná reference pro budoucí animovanou scénu.

### 3. Horní kompozice

- První varianta bude mít hlavní údaje vystředěné, inspirované Apple Weather.
- Nenápadné město a případně popisek lokality, dominantní teplota, stručný stav počasí, pocitová teplota a H/L.
- Velká teplota je typografický střed, obloha zůstává hlavní vizuální zážitek.
- Dostatek prázdného prostoru, minimum dekorativních prvků.
- Bez velké aplikační lišty a boční navigace.

### 4. Spodní kompozice

- Krátká věta o vývoji, například `Rain easing this evening.`
- Graf srážek na nejbližší dvě hodiny s časovou osou a rozlišením intenzity.
- Dalších 24 hodin v osmi časových bodech po třech hodinách, aby nebylo potřeba horizontálně scrollovat.
- Pětidenní výhled s ikonami, minimy/maximy a teplotními rozsahy.
- Několik klidných, lehce průsvitných ploch s jemným oddělením; minimum rámečků a bez výrazného liquid glass.
- Konkrétní rozdělení panelů dolaď podle výsledku v cílovém okně. Žádná z těchto částí nesmí vytlačit dominantní oblohu.

### 5. Vizuální systém

- Studená šedomodrá obloha, měkká bílá typografie, decentní modré zvýraznění srážek.
- Konzistentní ikony a volně použitelný font s kvalitními číslicemi; zaznamenej licence přibalených fontů a ikon.
- Údaje dostatečně velké pro pohodlné čtení na tomto monitoru, vyvážené mezery a umírněná hustota spodních panelů.
- Pozadí je viditelné až ke spodní hraně.

### 6. Ukázkový scénář

- `Prague` je pouze mock lokalita, nikoli zjištěná skutečná poloha uživatele.
- Přibližně 18 °C, bouřka přecházející během večera do slabšího deště.
- Teploty, ikony, srážkový graf a slovní popisy mají být vzájemně konzistentní.
- Nenápadné označení `Design preview · Sample weather` jasně odliší ukázku od skutečné předpovědi.
- Časové údaje mohou být pevné pro stabilní vizuální posuzování.

### 7. Ověření a předání

- Spusť náhled a vizuálně jej zkontroluj při 1316 × 1396 px.
- Zohledni rozdíl mezi celým aplikačním oknem a obsahovou plochou prohlížeče; browser chrome nesmí vést k mylnému ověření geometrie.
- Žádný svislý ani vodorovný scroll, přetékající text nebo oříznuté údaje v cílovém rozměru.
- Ověř kontrast přes světlé i tmavé části fotografie, proporce a čitelnost.
- Ověř, že lokální assety fungují a že konzole nehlásí chyby.
- Připrav screenshot a jednoduchý způsob opětovného spuštění náhledu.
- Nepiš rozsáhlé testy jen pro statické CSS. Základem je skutečné vizuální ověření.
- Předlož uživateli výsledek k hodnocení pozadí, velikosti/umístění teploty, množství údajů a spodních panelů.
- **Zde se zastav a čekej na uživatelovu zpětnou vazbu před dalšími etapami.**

## Etapa 2 — iterace a schválení vzhledu

- Zapracuj konkrétní připomínky uživatele do statického prototypu.
- Měň rozložení, ořez pozadí, typografii a informační hustotu podle skutečně viděného výsledku.
- Zachovej jednu obrazovku a dominantní oblohu.
- Až bude směr schválen, stabilizuj základní vizuální hodnoty: mezery, velikosti textu, barvy a průsvitnost panelů.
- Následující etapy představují plán celé aplikace; jejich konkrétní implementace se může změnit podle schváleného prototypu.

## Etapa 3 — desktopový základ a renderování

- Vyber Linuxový desktopový obal a grafickou technologii podle požadované kvality scény, práce se zvukem, kompatibility s Waylandem a možnosti znovupoužít schválený UI prototyp.
- Zvaž GPU renderování přes WebGL/WebGPU nebo nativní alternativu; Electron, Tauri či nativní Qt jsou možnosti, nikoli rozhodnutý stack.
- Ověř klíčovou technickou cestu na tomto stroji dříve, než na ní postavíš všechny scény.
- Aplikace musí fungovat jako samostatné normální okno v cílové velikosti a mít smysluplné chování při změně velikosti.
- Odděl prezentaci UI, stav počasí, renderování a zvuk, aby skutečná data později nahradila mock data bez přepisu rozložení.
- U desktopového obalu ověř automatické spuštění audia; pravidla běžné webové stránky nesmějí nepozorovaně zablokovat požadované chování.

## Etapa 4 — animované scény

- Nejprve dokonči vizuálně přesvědčivou bouřku odpovídající schválenému směru.
- Vytvoř hloubku pomocí vrstev mraků, světla, prostorových částic deště a výrazných blesků.
- Dolaď scénu při skutečné velikosti okna, ne jen na zmenšeném screenshotu.
- Pak přidej jasno, částečnou oblačnost, zataženo, slabý/silný déšť, sníh a mlhu v potřebných denních/nočních variantách.
- Zaveď mapování meteorologických podmínek na scénu a intenzitu efektů, včetně větru a plynulých přechodů.
- Čas dne a polohu slunce odvozuj z vybrané lokality, nikoli pouze z lokálního času systému.
- Interní deterministické fixture scénáře jsou vhodné pro vývoj a screenshoty; nezpřístupňuj je jako uživatelský přepínač počasí.
- Volitelný experiment s několika kapkami na skle proveď až tehdy, když existuje kvalitní prostorová verze, a posuď jej s uživatelem.
- Kontroluj plynulost, spotřebu a dlouhodobou stabilitu. Nezaměň toleranci vyšší spotřeby za oprávnění k únikům paměti nebo zbytečnému zatěžování CPU.

## Etapa 5 — zvuková atmosféra

- Najdi a poslechni kvalitní legálně distribuovatelné nahrávky deště, větru a hromů.
- Zaznamenej jejich zdroje, licence a potřebnou atribuci. Preferuj jasné licence vhodné pro zamýšlený open-source projekt.
- Připrav bezešvé smyčky, přechody intenzit a zvukový mix; nesmí vznikat slyšitelná mezera na konci smyčky nebo cvaknutí při mute.
- Déšť a vítr reagují na podmínky; hřmění časově navazuje na blesky.
- Jasné bezvětří zůstává tiché.
- Přidej nenápadné ovládání hlasitosti a mute s persistencí. První spuštění začne slyšitelně na střední hlasitosti.
- Výchozí přehrávání pokračuje bez ohledu na focus a workspace.
- Neztotožňuj případné úspory vizuálního renderování při skrytém okně s vypnutím audia.

## Etapa 6 — poloha a živá meteorologická data

- Ověř aktuální podmínky zvolených poskytovatelů před implementací.
- Pracovní volbou je Open-Meteo: bez klíče/účtu pro bezplatné nekomerční použití, s dostupnými aktuálními podmínkami, hodinovou a denní předpovědí.
- Pro srážkový výhled prověř patnáctiminutová data a jejich skutečné pokrytí zvolené lokality. Modelová předpověď není radarový nowcast; neslibuj přesnou minutu začátku deště.
- Implementuj IP polohu, ruční hledání města a návrat na `Current location`.
- Vybrané místo, jeho souřadnice a časové pásmo musí být konzistentní napříč UI, daty, scénou a zvukem.
- Připoj skutečné teploty, pocitovou teplotu, počasí, srážky, vítr, denní rozsahy a časy východu/západu slunce podle potřeb UI a scén.
- Vytvoř jednotný interní datový model a ošetři chybějící hodnoty; chybějící srážky se nesmí automaticky tvářit jako nula.
- Respektuj limity služeb, používej cache a přiměřené intervaly aktualizací; nic nedotazuj každý renderovaný snímek.
- Při výpadku sítě zobraz poslední dostupná data s nenápadnou informací o stáří, nebo srozumitelný stav nedostupnosti. Nevydávej mock data za živé počasí.
- Nepřidávej login ani nevyžaduj vlastní klíč uživatele.

## Etapa 7 — nastavení a Hyprland

- Přidej minimum potřebných nastavení v souladu se schváleným UI: lokalita, hlasitost/mute a volitelná závislost zvuku na workspace.
- Implementuj `Mute on other workspaces`, výchozí stav vypnuto.
- Identifikuj vlastní okno a jeho workspace; sleduj události Hyprlandu a změnu při přesunu okna.
- Ověř scénáře: jiná fokusovaná aplikace na stejném workspace stále hraje; odchod na jiný workspace ztlumí pouze při aktivním přepínači; návrat obnoví hlasitost bez zrušení ručního mute.
- Ztlumení prováděj plynule a odděl nastavenou hlasitost od dočasného útlumu workspace.
- Při nedostupné Hyprland integraci nesmí aplikace spadnout; výchozí přehrávání zůstává funkční. Neslibuj tuto funkci jako univerzální Wayland vlastnost.
- Integrace nemá vyžadovat změnu uživatelova desktopového layoutu nebo globálních klávesových zkratek.

## Etapa 8 — dokončení a předání

- Ověř všechny typy počasí, den/noc a přechody na interních fixture datech.
- Otestuj výpadek sítě, neúspěšnou geolokaci, ruční město, restart aplikace a persistenci voleb.
- Ověř zvuk poslechem, smyčky, mute a chování workspace na skutečném Hyprlandu.
- Zkontroluj dlouhodobý běh, stabilitu paměti, chování po uspání/probuzení a korektní ukončení.
- Zachovej hlavní UI bez scrollování při cílové velikosti. Menší okna řeš rozumně bez zhoršení primárního cíle.
- Připrav lokálně spustitelný/instalovatelný balíček vhodný pro cílový Linux, stručné README a přehled známých omezení.
- Uveď zdroje meteorologických dat a potřebné licence/atribuce assetů.
- Vzdálený repozitář je zřízen na výslovný pokyn uživatele: **privátní** `capekk23/hyprweather`, licence **GPL-3.0** (`LICENSE`). Veřejné publikování zatím požadováno není — než repozitář zveřejníš, dohledej autora fotografie z Unsplash (v `ASSETS.md` je zatím neověřený) a překontroluj podmínky všech tří služeb.

## Dosavadní rešerše a reference

Tyto zdroje jsou výchozí vodítka z dosavadní konverzace, nikoli potvrzení, že jejich kód nebo assety již byly zkontrolovány, staženy nebo použity.

### Apple Weather animace

- https://github.com/iamvinny/weather-app
- README popisuje rekonstrukci staršího systému Apple Weather Mica pomocí scén získaných z `.caml` souborů a renderování v Expo/React Native Skia.
- Je to konkrétní technická a vizuální reference. Kvalita výsledku a použitelnost pro naši aplikaci zatím nejsou ověřeny.
- Licence repozitářového kódu sama o sobě nepotvrzuje právo distribuovat původní Apple grafické assety. Před převzetím ověř původ a podmínky jednotlivých součástí; případně vytvoř vlastní ekvivalent.
- Uživatel chce dosáhnout kvality Apple pozadí a požádal je „nějak sehnat“; není tím rozhodnuto použít tento konkrétní projekt ani přesně kopírovat jeho implementaci.

### Meteorologická data

- https://open-meteo.com/
- https://open-meteo.com/en/docs
- https://open-meteo.com/en/pricing
- Při dosavadní rešerši bylo bezplatné nekomerční API bez klíče, s limitem 10 000 volání denně. Aktuální podmínky ověř při integraci.
- Dokumentace uváděla patnáctiminutové srážky a modely pro střední Evropu. Ověř konkrétní pokrytí a interpretaci časových intervalů.

### Kandidáti na statickou fotografii

- https://unsplash.com/photos/dark-stormy-clouds-fill-the-sky-PaSbzKR5pt8 — engin akyurt.
- https://unsplash.com/photos/dark-dramatic-storm-clouds-gathering-in-the-sky-ONXc50Y2AqA — engin akyurt.
- https://unsplash.com/photos/dark-grey-storm-clouds-AtxeOe04PQ8
- Všechny tři byly staženy, oříznuty do poměru cílového okna a předloženy uživateli. **Zvolen první z nich (`PaSbzKR5pt8`)** kvůli nejlepší čitelnosti typografie a nejtmavšímu podání; je použit v prototypu.

## Principy pro další práci

- Priorita: krásná atmosféra → kompozice a čitelnost → potřebná data → doplňkové funkce.
- Neopakuj uživateli otázky, které tento dokument již zodpovídá.
- Rutinní implementační rozhodnutí dělej samostatně v mezích schválené etapy.
- Udržuj stručné průběžné zprávy o konkrétním pokroku a výsledcích.
- Neimplementuj pozdější etapy před vizuálním schválením prvního prototypu.
- Rozlišuj hotové části, mock data, vývojové nástroje a zamýšlené funkce.
- Úspěchem první etapy je kvalitní prohlédnutelný návrh, podle kterého uživatel rozhodne, co upravit.

## Nejnovější směr a revize (2026-09-16)

- Uživatel chce směřovat animace do hlavní aplikace s reálnými daty; poslední úkol je ještě průchod současným kódem a oprava chyb. Samotné napojení pozadí do hlavní aplikace zatím není dokončené.
- Požadované varianty: slabý déšť, běžný déšť, liják bez blesků a s blesky; každá ve dne i v noci. Mapování zahrnuje 28 Open-Meteo WMO kódů.
- **feat (end goal): UI pro změnu aktivního města**, včetně existující logiky `Weather.search` / `Weather.setPlace`. Nyní pouze backlog.
- Zbývá vizuálně ověřit vodorovné protažení na uživatelově GPU, doladit měkké cáry mlhy a zvýšit hustotu chumelenice. Headless SwiftShader není důkaz kvality nativního osvětlení mraků.
- Při integraci opravit také práci s časem: API vrací místní ISO časy bez offsetu, které nynější datová vrstva parsuje v pásmu počítače. Hodinové/denní popisky odvozené od aktuálního času mohou při dlouhém offline režimu posouvat starou předpověď do budoucna. Uložit absolutní časy a formátovat v pásmu vybraného města.

## Animované pozadí v hlavní aplikaci

Hlavní aplikace nyní načítá renderer z `WeatherAnimationLab/dist` místo fotografie. `run.sh` jej sestavuje před spuštěním. Model předává WMO kód, den/noc, oblačnost a vítr přes `js/atmosphere.js`; renderer neprovádí vlastní meteorologické požadavky. Do získání použitelného modelu zůstává neutrální pozadí. Rozložení a ovládací prvky hlavního UI jsou zachované. Ověření vzhledu na uživatelově GPU stále zbývá.

## Výběr města a další atmosférické změny

- Hotovo: kliknutí na název města otevře vyhledávání, výsledky rozlišují oblast a zemi. Volba se ukládá; `Use current location` vrátí IP polohu. Nová volba obnoví data ihned a starý požadavek je nesmí přepsat.
- API nyní vrací absolutní Unix časy. Hodinový výhled, dny i osa srážek používají časové pásmo vybraného města. Tím je dřívější úkol časových pásem vyřešen pro čerstvá data; historická cache se obnoví při načtení.
- Opravené hranice intenzity srážek: horní mez škály vždy přesahuje Heavy, i při nulových srážkách. Popisky jsou ve středech tří stejně vysokých pásem.
- Blesky: dlouhé výboje přes výšku či šířku scény, jemné odchylky hlavního kanálu, slabší větve, několik návratových pulzů. HDR kompozice před bloomem; nativní HDR monitoru zde není potvrzené.
- Mlha: čtyři samostatně posouvané vrstvy hustoty s průhledy. Noční mraky mají vlastní výrazně slabší osvětlení, zvlášť při zataženu.
- Skutečná hvězdná mapa NASA SVS, kulová projekce podle souřadnic města a UTC. Jde o přibližnou orientaci (bez precese/refrakce), jas je výtvarně upravený a měsíc nadále placeholder. Zdroj a podmínky v `WeatherAnimationLab/ASSETS.md`.

## Schválené živé zobrazení

Uživatel schválil vzhled animací. Hlavní aplikace používá pouze scénu podle aktuálního počasí a denní doby vybraného města. Název města otevírá výběr lokality bez doprovodné šipky.

## Výkon bez snížení kvality

Uživatel požaduje úspory zbytečné práce, nikoli nižší kvalitu obrazu. Zachovat rozlišení, cloud quality/iterations, temporální stabilizaci, bloom a počet viditelných částic. Sloučen závěrečný průchod bloom → tone mapping → grade; při plné noci se nekreslí zcela překrytá atmosférická obloha. Neaktivní slunce/měsíc a nulově průhledné částice vynechávají zbytečné výpočty. Povrch měsíce se počítá pouze uvnitř jeho disku. Samotné volumetrické mraky a jejich stíny zůstávají beze změn; softwarové offscreen měření není měření FPS na uživatelově GPU.

Ověření: build a všech 8 testovacích souborů prošly, stejně jako živá aplikace v Electronu. Deterministické snímky noci, slabého deště, chumelenice, mlhy a blesku měly maximální rozdíl kanálu 1/255 proti předchozí verzi. Noc ověřena s high nastavením, ostatní s existujícím low režimem pro SwiftShader. Draw calls: noc 25→23, déšť 26→25, chumelenice 26→24, mlha 25→24, blesk 30→29. Jde o méně práce rendereru, nikoli procentuální záruku zlepšení FPS.

## Měsíc, čitelná zatažená noc a HDR blesky (21. září 2026)

Uživatel požaduje skutečný Měsíc a HDR; zatažená noc mu připadala příliš černá. Výchozí realizace je jemné modrošedé prosvětlení mraků a skutečná poloha/fáze Měsíce. Doplňující volby vzhledu byly nabídnuty, ale uživatel zatím neodpověděl; tyto výchozí volby nejsou jeho výslovným schválením.

- NASA měsíční textura, Astronomy Engine: skutečná fáze, natočení přivrácené strany, poloha a paralaxa podle místa/UTC. Výpočty se cachují po minutách. Disk je pro čitelnost výtvarně zvětšený 2,4×; jas je upravený. Měsíc pod obzorem není vidět; hvězdy i Měsíc dál zakrývají mraky. Noční kamera se může plynule natočit k Měsíci, stále bez země/horizontu. Zatmění a atmosférická refrakce nejsou implementované.
- Zatažená noc má jemnou pohyblivou okolní záři omezenou alfa maskou skutečných mraků; jde o výtvarné doplnění světla, nikoli simulaci konkrétního městského osvětlení. Nepřidává další render pass.
- HDR: volitelná WebGPU vrstva pouze pro jádra blesků, stejné geometrie jako SDR blesk. Aktivuje se jen při HDR display + WebGPU + podporované float16 canvas konfiguraci. Mezi blesky skrytá, bez renderování. Selhání této vrstvy nesmí zastavit hlavní SDR renderer. Nepřidávat automaticky experimentální flags nebo přepisovat monitor/Hyprland konfiguraci.
- Electron 44.4.1 / Chromium 152 zde nemá WebGL drawingBufferToneMapping ani po zapnutí zkoušeného WebGLToneMapping flagu. Softwarový test WebGPU shaderu ověřil float16 výstup nad SDR bílou; nativní HDR swapchain není v místním headless backendu podporovaný. Skutečný HDR jas musí potvrdit uživatel na svém monitoru, neslibovat jej pouze z úspěšné konfigurace canvasu.

Ověření této iterace: build a všech 10 testovacích souborů prošly, včetně fáze/natočení Měsíce, plynulého pohybu mezi minutovými výpočty a HDR fallbacku při chybě zařízení/změně displeje. V hlavní aplikaci prošlo napojení aktuálního počasí a výběr města. Pořízeny a zkontrolovány snímky měsíčního povrchu a plně zatažené noci. WebGPU shader na skutečné offscreen float16 textuře vytvořil hodnoty nad 1; test nativní F16 canvas vrstvy na SwiftShaderu korektně přešel do SDR.
