/**
 * Audio catalog based on the Haunted Adventure pack's suggested screen mapping.
 * Files live in android/app/src/main/res/raw (converted to OGG by prepare_assets.py).
 * Gains are relative multipliers on top of the user's channel volume.
 */
export type SceneId =
  | 'splash'
  | 'home'
  | 'quests'
  | 'world'
  | 'focus'
  | 'ledger'
  | 'keeper'
  | 'profile'
  | 'achievement'
  | 'silent';

export interface Layer {
  file: string;
  gain: number;
}

export interface SceneDef {
  music: Layer | null;
  ambience: Layer[];
}

export const SCENES: Record<SceneId, SceneDef> = {
  splash: {
    music: { file: 'mus_splash_haunted_menu.ogg', gain: 1 },
    ambience: [{ file: 'amb_foggy_night_air.ogg', gain: 0.5 }],
  },
  home: {
    music: { file: 'mus_home_graveyard_theme.ogg', gain: 1 },
    ambience: [
      { file: 'amb_graveyard_wind.ogg', gain: 0.8 },
      { file: 'amb_distant_owl_crickets.ogg', gain: 0.55 },
    ],
  },
  quests: {
    music: { file: 'mus_quests_lowkey_haunted.ogg', gain: 0.9 },
    ambience: [{ file: 'amb_foggy_night_air.ogg', gain: 0.3 }],
  },
  world: {
    music: { file: 'mus_world_forgotten_world.ogg', gain: 1 },
    ambience: [
      { file: 'amb_forgotten_forest_wind.ogg', gain: 0.75 },
      { file: 'amb_bats_forest_air.ogg', gain: 0.45 },
    ],
  },
  focus: {
    music: { file: 'mus_focus_chamber.ogg', gain: 0.7 },
    ambience: [{ file: 'amb_focus_chamber_subtle.ogg', gain: 0.35 }],
  },
  ledger: {
    music: { file: 'mus_ledger_calm_haunted.ogg', gain: 0.85 },
    ambience: [{ file: 'amb_calm_haunted_air.ogg', gain: 0.3 }],
  },
  keeper: {
    music: { file: 'mus_dark_keeper_theme.ogg', gain: 0.9 },
    ambience: [{ file: 'amb_magical_room_tone.ogg', gain: 0.6 }],
  },
  profile: {
    music: { file: 'mus_ledger_calm_haunted.ogg', gain: 0.75 },
    ambience: [{ file: 'amb_calm_haunted_air.ogg', gain: 0.3 }],
  },
  achievement: {
    music: { file: 'mus_achievement_victory.ogg', gain: 1 },
    ambience: [{ file: 'amb_calm_haunted_air.ogg', gain: 0.25 }],
  },
  silent: { music: null, ambience: [] },
};

export type SfxId =
  | 'achievement'
  | 'doorCreak'
  | 'batFlap'
  | 'candle'
  | 'whisper'
  | 'owl'
  | 'tick'
  | 'ghost'
  | 'drone'
  | 'spell'
  | 'magicTransition'
  | 'menu'
  | 'pageTurn'
  | 'questComplete'
  | 'notification'
  | 'reward';

export interface SfxDef {
  file: string;
  gain: number;
  /** Important cues duck the ambience bed while they play. */
  duck?: boolean;
  /** Allowed inside the Focus Chamber (no sudden loud sounds there). */
  gentle?: boolean;
}

export const SFX: Record<SfxId, SfxDef> = {
  achievement: { file: 'sfx_achievement_unlock.ogg', gain: 1, duck: true },
  doorCreak: { file: 'sfx_ancient_door_creak.ogg', gain: 0.8, duck: true },
  batFlap: { file: 'sfx_bat_flap.ogg', gain: 0.7 },
  candle: { file: 'sfx_candle_flicker.ogg', gain: 0.6, gentle: true },
  whisper: { file: 'sfx_dark_whisper.ogg', gain: 0.75 },
  owl: { file: 'sfx_distant_owl_call.ogg', gain: 0.5 },
  tick: { file: 'sfx_focus_timer_tick.ogg', gain: 0.35, gentle: true },
  ghost: { file: 'sfx_ghost_presence.ogg', gain: 0.7 },
  drone: { file: 'sfx_graveyard_low_drone.ogg', gain: 0.6 },
  spell: { file: 'sfx_magic_spell_soft.ogg', gain: 0.8, gentle: true },
  magicTransition: { file: 'sfx_magic_transition.ogg', gain: 0.75, duck: true },
  menu: { file: 'sfx_menu_transition.ogg', gain: 0.5 },
  pageTurn: { file: 'sfx_page_turn.ogg', gain: 0.6, gentle: true },
  questComplete: { file: 'sfx_quest_complete.ogg', gain: 0.9, duck: true },
  notification: { file: 'sfx_quest_notification.ogg', gain: 0.7 },
  reward: { file: 'sfx_reward_chime.ogg', gain: 0.8, duck: true, gentle: true },
};
