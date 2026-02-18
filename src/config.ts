/**
 * Phaser game configuration.
 */
import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { MenuScene } from './scenes/MenuScene';
import { MatchScene } from './scenes/MatchScene';
import { SetPieceScene } from './scenes/SetPieceScene';
import { HalfTimeScene } from './scenes/HalfTimeScene';
import { ResultScene } from './scenes/ResultScene';
import { TeamSelectScene } from './scenes/TeamSelectScene';
import { PITCH } from './utils/Constants';

export const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 960,
  height: 540,
  backgroundColor: '#1a1a2e',
  parent: 'app',
  pixelArt: true,
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false,
    },
  },
  scene: [BootScene, MenuScene, TeamSelectScene, MatchScene, SetPieceScene, HalfTimeScene, ResultScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
};

/**
 * Pitch dimensions exported for convenience.
 */
export { PITCH };
