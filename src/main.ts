/**
 * Entry point — bootstraps the Phaser game.
 */
import Phaser from 'phaser';
import { gameConfig } from './config';

const game = new Phaser.Game(gameConfig);

// Expose for debugging
(window as unknown as Record<string, unknown>).__GAME__ = game;
