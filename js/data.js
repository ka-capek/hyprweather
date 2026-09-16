/*
 * Mock data pro vizuální prototyp (Etapa 1).
 * Jediné místo, kde se mění obsah. Žádná reálná data, žádné API.
 * Scénář: Praha, 18 °C, bouřka slábnoucí přes večer do slabého deště
 * a k ránu do sucha.
 *
 * Hodnoty jsou smyšlené, ČASY jsou skutečné — počítají se od aktuálního
 * okamžiku, aby graf ani panely nikdy neukazovaly zastaralé hodiny.
 */
window.MOCK = {
  badge: 'Design preview · Sample weather',

  location: {
    city: 'Prague',
    region: 'Czechia',
  },

  current: {
    temp: 18,
    condition: 'Thunderstorms',
    icon: 'bolt',
    feelsLike: 17,
    high: 21,
    low: 14,
  },

  /*
   * Srážkový výhled na dalších 12 hodin, 24 kroků po 30 minutách, mm/h.
   * Osa x nese skutečný místní čas, ne relativní odstup.
   */
  precip: {
    // Tvar sloupce. Rozhodnuto uživatelem. Galerie: lab/bar-shapes.html
    barShape: 'hatched-uniform',

    // Způsob kódování intenzity. Rozhodnuto. Přehled: lab/precip-styles.html
    barStyle: 'bands',


    /*
     * Bez startHour se řada začíná skutečným teď (zaokrouhleným dolů na krok).
     * startHour: 18 by to přebilo pevným časem — jen pro fixture scénáře.
     */
    stepMinutes: 30,
    tickEveryMinutes: 120,   // popisek osy x každé dvě hodiny

    /*
     * Meteorologické prahy intenzity srážek v mm/h. Standardní dělení,
     * které používají i běžné předpovědní služby.
     */
    levels: [
      { label: 'Light',    from: 0.1 },
      { label: 'Moderate', from: 2.5 },
      { label: 'Heavy',    from: 7.6 },
    ],

    /*
     * Intenzita v mm/h po 30 minutách, 12 hodin dopředu.
     * Bouřkový průtrž v 18:00, utišení kolem 21:00, druhé pásmo kolem 22:30,
     * pak mrholení a k ránu sucho.
     */
    series: [
      16.0, 12.0, 7.0, 4.2, 2.6, 1.5, 0.9, 1.4,
      3.2, 5.4, 4.0, 2.2, 1.2, 0.7, 0.5, 0.35,
      0.25, 0.15, 0.08, 0, 0, 0, 0, 0,
    ],
  },

  /*
   * 24hodinový výhled: 8 bodů po třech hodinách, bez horizontálního scrollu.
   * Popisky se počítají z `hours` (odstup od teď), ne z pevného textu —
   * jinak by si odporovaly s časovou osou srážkového grafu.
   */
  hourly: [
    { hours: 0,  icon: 'bolt',    temp: 18, pop: 85 },
    { hours: 3,  icon: 'rain',    temp: 16, pop: 70 },
    { hours: 6,  icon: 'drizzle', temp: 15, pop: 45 },
    { hours: 9,  icon: 'drizzle', temp: 14, pop: 30 },
    { hours: 12, icon: 'cloud',   temp: 14, pop: 15 },
    { hours: 15, icon: 'cloud',   temp: 16, pop: 15 },
    { hours: 18, icon: 'partly',  temp: 18, pop: 10 },
    { hours: 21, icon: 'partly',  temp: 19, pop: 10 },
  ],

  // Pětidenní výhled. `days` je odstup od dneška, `now` vykreslí tečku.
  daily: [
    { days: 0, icon: 'bolt',    pop: 85, low: 14, high: 21, now: 18 },
    { days: 1, icon: 'rain',    pop: 60, low: 13, high: 19 },
    { days: 2, icon: 'drizzle', pop: 35, low: 12, high: 20 },
    { days: 3, icon: 'partly',  pop: 10, low: 13, high: 23 },
    { days: 4, icon: 'sun',     pop: 0,  low: 15, high: 26 },
  ],
};
