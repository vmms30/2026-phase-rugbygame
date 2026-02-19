/**
 * AudioManager — Central audio controller for the rugby game.
 *
 * Generates placeholder sounds via Web Audio API oscillators,
 * manages crowd ambience with excitement scaling, and provides
 * volume controls (master, SFX, crowd) with mute toggle.
 */

import Phaser from 'phaser';
import { EventBus } from '../utils/EventBus';

/** Audio identifiers for all game sounds. */
export type SFXName =
  | 'whistle_short' | 'whistle_long'
  | 'tackle_thud' | 'pass_whoosh'
  | 'kick_thump' | 'ball_bounce'
  | 'crowd_roar' | 'crowd_gasp'
  | 'post_clang' | 'score_chime'
  | 'menu_hover' | 'menu_select'
  | 'clock_tick' | 'ui_open' | 'ui_close';

export class AudioManager {
  private scene: Phaser.Scene;

  // Volume levels (0–1)
  private masterVolume = 0.75;
  private sfxVolume = 0.75;
  private crowdVolume = 0.5;
  private muted = false;

  // Crowd ambience
  private crowdHum: Phaser.Sound.BaseSound | null = null;
  private currentExcitement = 0.3; // 0 = quiet, 1 = roaring

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.setupEventListeners();
  }

  // ─────────────────────────────────────────────────────────
  // STATIC: Generate placeholder audio buffers in BootScene
  // ─────────────────────────────────────────────────────────

  static generatePlaceholderSounds(scene: Phaser.Scene): void {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();

    const createTone = (
      freq: number, duration: number, type: OscillatorType = 'sine',
      fadeOut = true
    ): AudioBuffer => {
      const sampleRate = ctx.sampleRate;
      const length = Math.floor(sampleRate * duration);
      const buffer = ctx.createBuffer(1, length, sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i++) {
        const t = i / sampleRate;
        let sample = 0;
        switch (type) {
          case 'sine': sample = Math.sin(2 * Math.PI * freq * t); break;
          case 'square': sample = Math.sin(2 * Math.PI * freq * t) > 0 ? 0.5 : -0.5; break;
          case 'triangle': sample = (2 / Math.PI) * Math.asin(Math.sin(2 * Math.PI * freq * t)); break;
          case 'sawtooth': sample = 2 * (t * freq - Math.floor(0.5 + t * freq)); break;
        }
        // Fade out
        const envelope = fadeOut ? Math.max(0, 1 - (i / length)) : 1;
        data[i] = sample * envelope * 0.4;
      }
      return buffer;
    };

    const createNoise = (duration: number, filter = 1.0): AudioBuffer => {
      const sampleRate = ctx.sampleRate;
      const length = Math.floor(sampleRate * duration);
      const buffer = ctx.createBuffer(1, length, sampleRate);
      const data = buffer.getChannelData(0);
      let prev = 0;
      for (let i = 0; i < length; i++) {
        const white = Math.random() * 2 - 1;
        data[i] = prev + filter * (white - prev);
        prev = data[i];
        data[i] *= 0.3;
      }
      return buffer;
    };

    const bufferToArrayBuffer = (buffer: AudioBuffer): ArrayBuffer => {
      // Simple WAV encoder
      const numChannels = 1;
      const sampleRate = buffer.sampleRate;
      const bitsPerSample = 16;
      const data = buffer.getChannelData(0);
      const dataLength = data.length * (bitsPerSample / 8);
      const bufferOut = new ArrayBuffer(44 + dataLength);
      const view = new DataView(bufferOut);

      const writeString = (offset: number, str: string) => {
        for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
      };

      writeString(0, 'RIFF');
      view.setUint32(4, 36 + dataLength, true);
      writeString(8, 'WAVE');
      writeString(12, 'fmt ');
      view.setUint32(16, 16, true);
      view.setUint16(20, 1, true);
      view.setUint16(22, numChannels, true);
      view.setUint32(24, sampleRate, true);
      view.setUint32(28, sampleRate * numChannels * (bitsPerSample / 8), true);
      view.setUint16(32, numChannels * (bitsPerSample / 8), true);
      view.setUint16(34, bitsPerSample, true);
      writeString(36, 'data');
      view.setUint32(40, dataLength, true);

      let offset = 44;
      for (let i = 0; i < data.length; i++) {
        const sample = Math.max(-1, Math.min(1, data[i]));
        view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
        offset += 2;
      }
      return bufferOut;
    };

    const registerSound = (name: string, buffer: AudioBuffer) => {
      const arrayBuf = bufferToArrayBuffer(buffer);
      const blob = new Blob([arrayBuf], { type: 'audio/wav' });
      const url = URL.createObjectURL(blob);
      scene.load.audio(name, url);
    };

    // Generate all placeholder sounds
    registerSound('whistle_short', createTone(2800, 0.3, 'sine'));
    registerSound('whistle_long', createTone(2800, 1.0, 'sine'));
    registerSound('tackle_thud', createNoise(0.15, 0.1));
    registerSound('pass_whoosh', createNoise(0.2, 0.8));
    registerSound('kick_thump', createNoise(0.12, 0.15));
    registerSound('ball_bounce', createTone(200, 0.1, 'sine'));
    registerSound('crowd_roar', createNoise(1.5, 0.05));
    registerSound('crowd_gasp', createNoise(0.8, 0.1));
    registerSound('post_clang', createTone(800, 0.5, 'triangle'));
    registerSound('score_chime', createTone(1200, 0.4, 'sine'));
    registerSound('menu_hover', createTone(600, 0.05, 'sine'));
    registerSound('menu_select', createTone(900, 0.1, 'sine'));
    registerSound('clock_tick', createTone(1000, 0.03, 'square'));
    registerSound('ui_open', createTone(500, 0.08, 'sine'));
    registerSound('ui_close', createTone(400, 0.08, 'sine'));

    // Start the load
    scene.load.start();

    ctx.close();
  }

  // ─────────────────────────────────────────────────────────
  // INSTANCE METHODS
  // ─────────────────────────────────────────────────────────

  /** Play a sound effect by name. */
  play(name: SFXName, volumeScale = 1.0): void {
    if (this.muted) return;
    const effectiveVolume = this.masterVolume * this.sfxVolume * volumeScale;
    try {
      this.scene.sound.play(name, { volume: effectiveVolume });
    } catch {
      // Sound not loaded yet — ignore gracefully
    }
  }

  /** Start crowd ambience loop. */
  startCrowdAmbience(): void {
    if (!this.scene.cache.audio.exists('crowd_roar')) return;
    try {
      this.crowdHum = this.scene.sound.add('crowd_roar', {
        volume: this.getEffectiveCrowdVolume(),
        loop: true,
      });
      this.crowdHum.play();
    } catch {
      // ignore
    }
  }

  /** Update crowd excitement level (0–1). Call each frame. */
  setExcitement(level: number): void {
    this.currentExcitement = Math.max(0, Math.min(1, level));
    if (this.crowdHum && 'volume' in this.crowdHum) {
      (this.crowdHum as any).volume = this.getEffectiveCrowdVolume();
    }
  }

  private getEffectiveCrowdVolume(): number {
    if (this.muted) return 0;
    return this.masterVolume * this.crowdVolume * (0.2 + this.currentExcitement * 0.8);
  }

  // ── Volume Controls ───────────────────────────────────

  setMasterVolume(v: number): void { this.masterVolume = Math.max(0, Math.min(1, v)); }
  setSfxVolume(v: number): void { this.sfxVolume = Math.max(0, Math.min(1, v)); }
  setCrowdVolume(v: number): void { this.crowdVolume = Math.max(0, Math.min(1, v)); }
  toggleMute(): void { this.muted = !this.muted; }
  isMuted(): boolean { return this.muted; }

  // ── Event-Driven SFX ──────────────────────────────────

  private setupEventListeners(): void {
    EventBus.on('tackle', () => {
      this.play('tackle_thud');
      this.setExcitement(Math.min(1, this.currentExcitement + 0.15));
    });

    EventBus.on('score', () => {
      this.play('crowd_roar');
      this.play('score_chime', 0.8);
      this.setExcitement(1.0);
    });

    EventBus.on('penaltyAwarded', () => {
      this.play('whistle_short');
    });

    EventBus.on('halfTime', () => {
      this.play('whistle_long');
    });

    EventBus.on('fullTime', () => {
      this.play('whistle_long');
    });

    EventBus.on('ruckBallAvailable', () => {
      // Subtle whoosh as ball emerges
      this.play('pass_whoosh', 0.4);
    });

    EventBus.on('playSelected', () => {
      this.play('ui_open', 0.5);
    });
  }

  /** Call each frame to gradually decay excitement. */
  update(_delta: number): void {
    this.currentExcitement = Math.max(0.1, this.currentExcitement - 0.0005);
  }

  destroy(): void {
    this.crowdHum?.destroy();
  }
}
