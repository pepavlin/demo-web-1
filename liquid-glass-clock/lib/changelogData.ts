export interface ChangelogEntry {
  date: string;
  title: string;
  items: string[];
}

/** Changelog entries — newest first. Update this file with every change to the game. */
export const CHANGELOG: ChangelogEntry[] = [
  {
    date: "2026-03-13",
    title: "Zásoby z nebe & nové zbraně",
    items: [
      "Zásobovací krabice padá z nebe každých 5 minut (airdrop systém)",
      "Nová zbraň: kulomet (ultra-rychlá automatická palba)",
      "Nová zbraň: sekera (bonusové poškození při kácení stromů)",
      "Kácení stromů — dřevěné kusy létají z posekaného stromu",
      "Bioluminiscenční flóra (Avatar/Pandora) svítí v noci",
      "HP pruhy nepřátel přesunuty do levého HUD panelu",
      "Vylepšená animace luku — V-tětiva a silnější prohnutí ramen",
      "Podzemní bunkr ze shipping kontejnerů",
      "Voxelový terén (Marching Cubes) nahradil plochý heightmap",
      "Sniper věž — indikátor nabíjení s kruhovým SVG prstencem",
    ],
  },
  {
    date: "2026-03-09",
    title: "Bomby a přizpůsobení terénu",
    items: [
      "9 bomb rozmístěno na mapě, zobrazeny na minimapě",
      "Budovy ve velkém městě se přizpůsobují tvaru terénu",
    ],
  },
  {
    date: "2026-03-08",
    title: "Mombasa globus & výbušné novinky",
    items: [
      "Interaktivní 3D globus Mombasy na /mombasa",
      "Hozitelná bomba s kráterem po výbuchu na ostrově trosek",
      "Liščí zvuky přepracovány na přirozenější organickou syntézu",
      "Velké město přidáno do otevřeného světa",
    ],
  },
  {
    date: "2026-03-07",
    title: "Výkon — oddělení scén",
    items: [
      "Země a vesmírná stanice jsou nyní dvě nezávislé scény (lepší výkon)",
    ],
  },
  {
    date: "2026-03-05",
    title: "Letadlo, jeskyně & přístav",
    items: [
      "Létatelné letadlo k nalezení ve světě",
      "Jeskyně s pochodněmi, truhla s pokladem a třívrstevný systém pavouků",
      "Přístav, molo a plachetnice s plnou mechanikou plavby",
      "Dýňový svět na /pumpkins",
      "Systém sbírání a umisťování předmětů (dýně)",
    ],
  },
  {
    date: "2026-03-04",
    title: "Terén a tráva",
    items: [
      "Procedurální textury terénu s triplanárním mapováním",
      "Trojnásobná hustota trávy (60k → 180k stébel) s adaptivním LOD",
    ],
  },
  {
    date: "2026-03-03",
    title: "Optimalizace výkonu",
    items: [
      "Herní smyčka optimalizována z ~20fps na cílových 60fps",
    ],
  },
];
