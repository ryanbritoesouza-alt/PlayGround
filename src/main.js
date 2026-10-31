import { Game } from './game.js';

const canvas = document.getElementById('game');
const game = new Game(canvas);

// Handy for debugging and for automated browser checks.
window.__fruitSeas = game;
window.__fruitSeasReady = true;
