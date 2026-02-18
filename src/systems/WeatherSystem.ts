/**
 * WeatherSystem — environmental effects on gameplay.
 *
 * Rain: increased knock-on probability, reduced ball friction
 * Wind: lateral force on kicked balls
 */

import Phaser from 'phaser';

export type WeatherType = 'clear' | 'rain' | 'wind' | 'rain_and_wind';

export interface WeatherConfig {
  knockOnModifier: number;   // Multiplier on knock-on chance (1.0 = normal)
  frictionModifier: number;  // Ball friction modifier (lower = less friction)
  windForceX: number;        // Wind force on X axis (px/frame)
  windForceY: number;        // Wind force on Y axis
  rainIntensity: number;     // 0–1 for visual effect
}

const WEATHER_PRESETS: Record<WeatherType, WeatherConfig> = {
  clear: { knockOnModifier: 1.0, frictionModifier: 1.0, windForceX: 0, windForceY: 0, rainIntensity: 0 },
  rain: { knockOnModifier: 1.5, frictionModifier: 0.85, windForceX: 0, windForceY: 0, rainIntensity: 0.7 },
  wind: { knockOnModifier: 1.0, frictionModifier: 1.0, windForceX: 0.8, windForceY: 0.3, rainIntensity: 0 },
  rain_and_wind: { knockOnModifier: 1.8, frictionModifier: 0.75, windForceX: 1.0, windForceY: 0.4, rainIntensity: 0.9 },
};

export class WeatherSystem {
  private weather: WeatherType = 'clear';
  private config: WeatherConfig;
  private particles: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private windIndicator: Phaser.GameObjects.Text | null = null;

  constructor() {
    this.config = { ...WEATHER_PRESETS.clear };
  }

  /**
   * Set the weather for the match.
   */
  setWeather(type: WeatherType, scene?: Phaser.Scene): void {
    this.weather = type;
    this.config = { ...WEATHER_PRESETS[type] };

    // Visual effects
    if (scene && (type === 'rain' || type === 'rain_and_wind')) {
      this.createRainEffect(scene);
    }

    if (scene && (type === 'wind' || type === 'rain_and_wind')) {
      this.createWindIndicator(scene);
    }
  }

  private createRainEffect(scene: Phaser.Scene): void {
    // Create rain particle effect using Phaser particles
    // Simple diagonal lines falling
    const gfx = scene.add.graphics();
    gfx.lineStyle(1, 0x6699cc, 0.4);
    gfx.beginPath();
    gfx.moveTo(0, 0);
    gfx.lineTo(2, 8);
    gfx.strokePath();
    gfx.generateTexture('rain_drop', 3, 9);
    gfx.destroy();

    this.particles = scene.add.particles(0, 0, 'rain_drop', {
      x: { min: 0, max: scene.cameras.main.width },
      y: -10,
      speedY: { min: 150, max: 250 },
      speedX: { min: 20, max: 50 },
      lifespan: 2000,
      frequency: 10,
      quantity: 3,
      alpha: { start: 0.5, end: 0.1 },
    });
    this.particles.setScrollFactor(0).setDepth(200);
  }

  private createWindIndicator(scene: Phaser.Scene): void {
    const dir = this.config.windForceX > 0 ? '→' : '←';
    const strength = Math.abs(this.config.windForceX);
    const arrows = strength > 0.5 ? '▶▶' : '▶';
    this.windIndicator = scene.add.text(20, 80, `Wind ${arrows} ${dir}`, {
      fontSize: '10px', fontFamily: 'monospace', color: '#94a3b8',
    }).setScrollFactor(0).setDepth(100);
  }

  /** Get the current weather config for gameplay calculations */
  getConfig(): Readonly<WeatherConfig> {
    return this.config;
  }

  getWeatherType(): WeatherType {
    return this.weather;
  }

  /**
   * Apply wind force to a kicked ball's end position.
   * @param endX Original end X
   * @param endY Original end Y
   * @param flightDuration Duration in seconds
   * @returns Adjusted end position
   */
  applyWindToKick(endX: number, endY: number, flightDuration: number): { x: number; y: number } {
    return {
      x: endX + this.config.windForceX * flightDuration * 50,
      y: endY + this.config.windForceY * flightDuration * 50,
    };
  }

  destroy(): void {
    this.particles?.destroy();
    this.windIndicator?.destroy();
  }
}
