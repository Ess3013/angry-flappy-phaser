import { Game as MainGame } from './scenes/Game';
import { AUTO, Game, Scale } from 'phaser';

const config = {
    type: AUTO,
    width: 960,
    height: 540,
    parent: 'game-container',
    backgroundColor: '#028af8',
    scale: {
        mode: Scale.FIT,
        autoCenter: Scale.CENTER_BOTH
    },
    input: {
        activePointers: 3
    },
    scene: [
        MainGame
    ]
};

const StartGame = (parent) => {
    return new Game({ ...config, parent });
}

export default StartGame;