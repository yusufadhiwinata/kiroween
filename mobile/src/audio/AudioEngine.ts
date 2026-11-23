import { AppState, type AppStateStatus } from 'react-native';
import Sound from 'react-native-sound';
import { SCENES, SFX, type Layer, type SceneId, type SfxId } from './catalog';

/**
 * Context-aware audio engine.
 * - One music bed + independent ambience layers per scene, crossfaded on change.
 * - SFX have priority: important cues duck the ambience while they play.
 * - The same SFX never overlaps itself.
 * - Everything pauses in the background and resumes in the foreground.
 * - Focus scene only allows gentle cues at reduced gain.
 */
type Channel = 'music' | 'ambience';

interface Track {
  file: string;
  channel: Channel;
  gain: number;
  sound: Sound | null;
  loaded: boolean;
  volume: number;
  disposing: boolean;
}

interface SfxSlot {
  sound: Sound | null;
  loaded: boolean;
  playing: boolean;
  lastStart: number;
}

export interface AudioPrefs {
  enabled: boolean;
  music: number;
  ambience: number;
  sfx: number;
}

const PRELOAD: SfxId[] = ['menu', 'pageTurn', 'questComplete', 'reward', 'candle', 'spell'];
const FADE_MS = 1200;
const TICK_MS = 60;
const DUCK_LEVEL = 0.4;
const DUCK_MS = 1500;

class AudioEngine {
  private tracks: Track[] = [];
  private baseScene: SceneId = 'silent';
  private overlay: SceneId | null = null;
  private prefs: AudioPrefs = { enabled: false, music: 0.45, ambience: 0.35, sfx: 0.65 };
  private sfx = new Map<SfxId, SfxSlot>();
  private duckUntil = 0;
  private ticker: ReturnType<typeof setInterval> | null = null;
  // currentState can be null/unknown at launch; only background/inactive count as paused.
  private appActive = AppState.currentState !== 'background' && AppState.currentState !== 'inactive';

  constructor() {
    Sound.setCategory('Playback', true);
    AppState.addEventListener('change', this.onAppState);
  }

  configure(prefs: AudioPrefs) {
    const wasEnabled = this.prefs.enabled;
    this.prefs = prefs;
    if (!prefs.enabled && wasEnabled) {
      this.sfx.forEach(slot => slot.sound?.stop());
      this.tracks.forEach(t => (t.disposing = true));
    }
    if (prefs.enabled && !wasEnabled) {
      PRELOAD.forEach(id => this.ensureSfx(id));
      this.applyScene();
    }
    this.startTicker();
  }

  get currentScene(): SceneId {
    return this.overlay ?? this.baseScene;
  }

  setScene(scene: SceneId) {
    if (scene === this.baseScene) return;
    this.baseScene = scene;
    if (!this.overlay) this.applyScene();
  }

  /** Temporary scene (e.g. achievement fanfare) layered over the current screen. */
  pushOverlay(scene: SceneId) {
    this.overlay = scene;
    this.applyScene();
  }

  popOverlay() {
    if (!this.overlay) return;
    this.overlay = null;
    this.applyScene();
  }

  playSfx(id: SfxId, opts: { restart?: boolean } = {}) {
    if (!this.prefs.enabled || this.prefs.sfx <= 0 || !this.appActive) return;
    const def = SFX[id];
    const inFocus = this.currentScene === 'focus';
    if (inFocus && !def.gentle) return;
    const slot = this.sfx.get(id);
    if (!slot) {
      this.ensureSfx(id, () => this.playSfx(id, opts));
      return;
    }
    if (!slot.loaded || !slot.sound) return;
    const now = Date.now();
    if (slot.playing && !opts.restart) return; // no overlapping duplicates
    if (now - slot.lastStart < 120) return;
    if (slot.playing) slot.sound.stop();
    slot.lastStart = now;
    slot.playing = true;
    slot.sound.setVolume(Math.min(1, this.prefs.sfx * def.gain * (inFocus ? 0.6 : 1)));
    slot.sound.play(() => {
      if (slot) slot.playing = false;
    });
    if (def.duck) {
      this.duckUntil = now + DUCK_MS;
      this.startTicker();
    }
  }

  stopAll() {
    this.tracks.forEach(t => (t.disposing = true));
    this.startTicker();
  }

  // ---------------------------------------------------------------- internals
  private ensureSfx(id: SfxId, onReady?: () => void): SfxSlot {
    const existing = this.sfx.get(id);
    if (existing) return existing;
    const slot: SfxSlot = { sound: null, loaded: false, playing: false, lastStart: 0 };
    slot.sound = new Sound(SFX[id].file, Sound.MAIN_BUNDLE, err => {
      if (err) {
        slot.sound = null;
        return;
      }
      slot.loaded = true;
      onReady?.();
    });
    this.sfx.set(id, slot);
    return slot;
  }

  private onAppState = (state: AppStateStatus) => {
    const active = state === 'active';
    if (active === this.appActive) return;
    this.appActive = active;
    if (!active) {
      this.tracks.forEach(t => t.loaded && t.sound?.pause());
      this.sfx.forEach(s => s.sound?.stop());
    } else {
      this.tracks.forEach(t => {
        if (t.loaded && !t.disposing) t.sound?.play();
      });
      this.startTicker();
    }
  };

  private applyScene() {
    const def = SCENES[this.currentScene];
    const wanted: { layer: Layer; channel: Channel }[] = [
      ...(def.music ? [{ layer: def.music, channel: 'music' as const }] : []),
      ...def.ambience.map(layer => ({ layer, channel: 'ambience' as const })),
    ];
    // Fade out anything not in the new scene.
    this.tracks.forEach(t => {
      const keep = wanted.find(w => w.layer.file === t.file && w.channel === t.channel);
      if (keep) {
        t.gain = keep.layer.gain;
        t.disposing = false;
      } else {
        t.disposing = true;
      }
    });
    if (this.prefs.enabled) {
      wanted.forEach(w => {
        if (!this.tracks.some(t => t.file === w.layer.file && t.channel === w.channel)) {
          this.tracks.push(this.createTrack(w.layer, w.channel));
        }
      });
    }
    this.startTicker();
  }

  private createTrack(layer: Layer, channel: Channel): Track {
    const track: Track = { file: layer.file, channel, gain: layer.gain, sound: null, loaded: false, volume: 0, disposing: false };
    track.sound = new Sound(layer.file, Sound.MAIN_BUNDLE, err => {
      if (err || !track.sound) {
        track.sound = null;
        track.disposing = true;
        return;
      }
      track.loaded = true;
      if (track.disposing) {
        track.sound.release();
        track.sound = null;
        return;
      }
      track.sound.setNumberOfLoops(-1);
      track.sound.setVolume(0);
      if (this.appActive && !track.disposing) track.sound.play();
      this.startTicker();
    });
    return track;
  }

  private target(t: Track): number {
    if (t.disposing || !this.prefs.enabled || !this.appActive) return 0;
    const channelVolume = t.channel === 'music' ? this.prefs.music : this.prefs.ambience;
    const duck = t.channel === 'ambience' && Date.now() < this.duckUntil ? DUCK_LEVEL : 1;
    return Math.min(1, channelVolume * t.gain * duck);
  }

  private startTicker() {
    if (this.ticker) return;
    this.ticker = setInterval(this.tick, TICK_MS);
  }

  private tick = () => {
    const step = TICK_MS / FADE_MS;
    let busy = Date.now() < this.duckUntil;
    this.tracks.forEach(t => {
      if (!t.loaded || !t.sound) return;
      const goal = this.target(t);
      if (Math.abs(goal - t.volume) > 0.001) {
        t.volume = goal > t.volume ? Math.min(goal, t.volume + step) : Math.max(goal, t.volume - step);
        t.sound.setVolume(t.volume);
        busy = true;
      }
    });
    // Release faded-out tracks.
    this.tracks = this.tracks.filter(t => {
      if (!t.disposing) return true;
      if (!t.sound) return false; // failed to load or already released
      if (t.loaded && t.volume <= 0.001) {
        t.sound.stop();
        t.sound.release();
        t.sound = null;
        return false;
      }
      return true; // still loading or fading out
    });
    if (this.tracks.some(t => t.disposing)) busy = true;
    if (!busy && this.ticker) {
      clearInterval(this.ticker);
      this.ticker = null;
    }
  };
}

export const audio = new AudioEngine();
