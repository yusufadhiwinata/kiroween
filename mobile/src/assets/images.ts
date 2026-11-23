/* Sprites sliced from the GRAVEYARD UI sheet by scripts/prepare_assets.py. */
export const images = {
  logo: require('./images/logo.png'),
  ghost: require('./images/ghost.png'),
  darkKeeper: require('./images/dark_keeper.png'),
  keeperAvatar: require('./images/keeper_avatar.png'),
  pumpkin: require('./images/pumpkin.png'),
  bat: require('./images/bat.png'),
  cat: require('./images/cat.png'),
  potion: require('./images/potion.png'),
  gem: require('./images/gem.png'),
  coin: require('./images/coin.png'),
  chestSmall: require('./images/chest_small.png'),
  chestBig: require('./images/chest_big.png'),
  sceneNight: require('./images/scene_night.png'),
  sceneHaunted: require('./images/scene_haunted.png'),
  sceneDusk: require('./images/scene_dusk.png'),
  sceneDay: require('./images/scene_day.png'),
  candles: [
    require('./images/candle_1.png'),
    require('./images/candle_2.png'),
    require('./images/candle_3.png'),
    require('./images/candle_4.png'),
    require('./images/candle_5.png'),
    require('./images/candle_6.png'),
  ],
  iconSettings: require('./images/icon_settings.png'),
  iconSound: require('./images/icon_sound.png'),
  iconMusic: require('./images/icon_music.png'),
  iconHelp: require('./images/icon_help.png'),
  bannerGhost: require('./images/banner_ghost.png'),
  decoGround: require('./images/deco_ground.png'),
  decoGate: require('./images/deco_gate.png'),
  decoTombs: require('./images/deco_tombs.png'),
  decoTree: require('./images/deco_tree.png'),
  decoLamp: require('./images/deco_lamp.png'),
  decoSign: require('./images/deco_sign.png'),
  decoCauldron: require('./images/deco_cauldron.png'),
  decoPillar: require('./images/deco_pillar.png'),
  decoCrystals: require('./images/deco_crystals.png'),
  fxFog: require('./images/fx_fog.png'),
  fxGlow: require('./images/fx_glow.png'),
} as const;

export const difficultyBadges = {
  easy: require('./images/badge_easy.png'),
  medium: require('./images/badge_medium.png'),
  hard: require('./images/badge_hard.png'),
  boss: require('./images/badge_boss.png'),
} as const;

export const regionArt = {
  forgotten_cemetery: require('./images/region_forgotten_cemetery.png'),
  pumpkin_village: require('./images/region_pumpkin_village.png'),
  whispering_woods: require('./images/region_whispering_woods.png'),
  haunted_castle: require('./images/region_haunted_castle.png'),
} as const;

export const navIcons = {
  Home: { idle: require('./images/nav_home.png'), active: require('./images/nav_home_active.png') },
  Quests: { idle: require('./images/nav_quests.png'), active: require('./images/nav_quests_active.png') },
  World: { idle: require('./images/nav_world.png'), active: require('./images/nav_world_active.png') },
  Ledger: { idle: require('./images/nav_ledger.png'), active: require('./images/nav_ledger_active.png') },
  Profile: { idle: require('./images/nav_profile.png'), active: require('./images/nav_profile_active.png') },
} as const;

/** Icons referenced by name from server data (achievements, categories). */
export const namedIcons: Record<string, number> = {
  ach_star: require('./images/ach_star.png'),
  ach_trophy: require('./images/ach_trophy.png'),
  ach_shield: require('./images/ach_shield.png'),
  ach_crown: require('./images/ach_crown.png'),
  ach_gem_shield: require('./images/ach_gem_shield.png'),
  ach_banner: require('./images/ach_banner.png'),
  banner_ghost: require('./images/banner_ghost.png'),
  chest_big: require('./images/chest_big.png'),
  badge_boss: require('./images/badge_boss.png'),
  logo: require('./images/logo.png'),
  coin: require('./images/coin.png'),
  potion: require('./images/potion.png'),
  gem: require('./images/gem.png'),
  ghost: require('./images/ghost.png'),
  pumpkin: require('./images/pumpkin.png'),
  deco_crystals: require('./images/deco_crystals.png'),
  candle: require('./images/candle_1.png'),
};
