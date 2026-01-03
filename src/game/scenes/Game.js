import { Scene } from 'phaser';

export class Game extends Scene
{
    constructor ()
    {
        super('Game');
        
        // Game Constants
        this.GRAVITY = 400;
        this.DRAG = 0.3;
        this.PIPE_WIDTH = 80;
        this.PIPE_GAP = 180;
        this.PIPE_DIST_INTERVAL = 400;
        this.MAX_PULL = 200;
        this.POWER_MULTIPLIER = 3.0;

        // State Variables
        this.gameState = 'MENU';
        this.score = 0;
        this.highscore = 0;
        this.timeLeft = 30;
        this.worldSpeed = 0;
        this.distanceTraveled = 0;
        this.nextPipeDist = 400;
        this.pipesClearedInLaunch = 0;
        
        // Background Scrolling
        this.bgScrollX = 0;

        // Aiming Variables
        this.aiming = {
            active: false,
            startX: 0,
            startY: 0,
            currentX: 0,
            currentY: 0
        };

        // Menu Variables
        this.menuTitleTimer = 0;
        this.titleOffset = 0;
        this.isTransitioning = false;
        
        this.titleChars = [];
    }

    preload ()
    {
        this.load.setPath('assets');
        
        for (let i = 1; i <= 5; i++) {
            this.load.image(`bird${i}`, `sprites/bird/frame-${i}.png`);
        }

        this.load.audio('music', 'audio/BGM.wav');
        this.load.audio('jump', 'audio/jump.wav');
        this.load.audio('score', 'audio/score.wav');
    }

    create ()
    {
        this.createBackgroundTexture();
        this.bgTileSprite = this.add.tileSprite(0, 0, this.scale.width, this.scale.height, 'bg_checker').setOrigin(0,0);
        this.graphics = this.add.graphics();

        this.anims.create({
            key: 'fly',
            frames: [
                { key: 'bird1' },
                { key: 'bird2' },
                { key: 'bird3' },
                { key: 'bird4' },
                { key: 'bird5' }
            ],
            frameRate: 20,
            repeat: -1
        });

        this.bird = this.add.sprite(100, 300, 'bird1');
        this.bird.setOrigin(0.5, 0.5);
        this.bird.setDisplaySize(40, 40);

        this.pipes = [];

        const uiStyle = { fontFamily: 'Arial', fontSize: '24px', color: '#000000' };
        this.scoreText = this.add.text(20, 20, 'Score: 0', uiStyle).setDepth(10);
        this.highscoreText = this.add.text(20, 50, 'Best: 0', uiStyle).setDepth(10);
        this.timeText = this.add.text(20, 80, 'Time: 30.0', uiStyle).setDepth(10);
        
        this.centerText = this.add.text(this.scale.width / 2, this.scale.height / 2, '', {
            fontFamily: 'Arial', fontSize: '40px', color: '#000000', align: 'center'
        }).setOrigin(0.5).setDepth(10);

        this.titleContainer = this.add.container(this.scale.width / 2, this.scale.height / 2 - 150);
        this.titleContainer.setDepth(10);
        const titleStr = "Angry Flappy Bird";
        const titleStyle = { fontFamily: 'Arial', fontSize: '60px', color: '#4488FF', stroke: '#000000', strokeThickness: 4 };
        
        let cursorX = 0;
        for (let i = 0; i < titleStr.length; i++) {
            const char = titleStr[i];
            const t = this.add.text(0, 0, char, titleStyle).setOrigin(0, 0.5);
            this.titleChars.push(t);
            this.titleContainer.add(t);
        }

        this.titleChars.forEach(t => {
            t.x = cursorX;
            cursorX += t.width;
        });

        const fullWidth = cursorX;
        this.titleChars.forEach(t => {
            t.x -= fullWidth / 2;
        });

        this.input.on('pointerdown', this.handleInputDown, this);
        this.input.on('pointermove', this.handleInputMove, this);
        this.input.on('pointerup', this.handleInputUp, this);

        this.soundJump = this.sound.add('jump');
        this.soundScore = this.sound.add('score');
        this.music = this.sound.add('music', { loop: true, volume: 0.5 });
        this.music.play();

        this.loadHighscore();
        this.resetGame();
        
        this.gameState = 'MENU';
        this.bird.x = this.scale.width / 2;
        this.bird.y = this.scale.height / 2;
        this.birdY = this.bird.y;
    }

    loadHighscore() {
        try {
            const storedScore = localStorage.getItem('angry-flappy-highscore');
            this.highscore = storedScore ? parseInt(storedScore, 10) : 0;
        } catch (e) {
            console.warn('Could not load highscore:', e);
            this.highscore = 0;
        }
    }

    saveHighscore() {
        try {
            localStorage.setItem('angry-flappy-highscore', this.highscore.toString());
        } catch (e) {
            console.warn('Could not save highscore:', e);
        }
    }

    createBackgroundTexture()
    {
        const cellSize = 40;
        const graphics = this.make.graphics({ x: 0, y: 0, add: false });
        graphics.fillStyle(0xF5F5DB);
        graphics.fillRect(0, 0, cellSize, cellSize);
        graphics.fillStyle(0xEDE8D1);
        graphics.fillRect(cellSize, 0, cellSize, cellSize);
        graphics.fillStyle(0xEDE8D1);
        graphics.fillRect(0, cellSize, cellSize, cellSize);
        graphics.fillStyle(0xF5F5DB);
        graphics.fillRect(cellSize, cellSize, cellSize, cellSize);
        graphics.generateTexture('bg_checker', 80, 80);
    }

    resetGame()
    {
        this.bird.x = 100;
        this.birdY = 300;
        this.birdVy = 0;
        this.birdAngle = 0;
        this.isAnimating = false;
        this.bird.stop();
        this.bird.setTexture('bird1');

        if (this.music) {
            this.music.volume = 0.5;
        }

        this.pipes.forEach((p) => {
             if (p.topPipe) p.topPipe.destroy();
             if (p.bottomPipe) p.bottomPipe.destroy();
        });
        this.pipes = [];

        this.score = 0;
        this.pipesClearedInLaunch = 0;
        this.timeLeft = 30;
        this.gameState = 'START';
        this.aiming.active = false;
        this.worldSpeed = 0;
        this.distanceTraveled = 0;
        this.nextPipeDist = 400;
        this.titleOffset = 0;
        this.isTransitioning = false;
        this.updateUI();
    }

    spawnPipe(xPos)
    {
        const minHeight = 100;
        const maxHeight = this.scale.height - this.PIPE_GAP - minHeight;
        const topHeight = Phaser.Math.Between(minHeight, maxHeight);
        
        const pipeColor = 0x33CC33;
        const strokeColor = 0x000000;
        const strokeWidth = 3;

        const topPipe = this.add.rectangle(xPos, 0, this.PIPE_WIDTH, topHeight, pipeColor);
        topPipe.setOrigin(0, 0);
        topPipe.setStrokeStyle(strokeWidth, strokeColor);
        
        const bottomPipeY = topHeight + this.PIPE_GAP;
        const bottomPipeHeight = this.scale.height - bottomPipeY;
        const bottomPipe = this.add.rectangle(xPos, bottomPipeY, this.PIPE_WIDTH, bottomPipeHeight, pipeColor);
        bottomPipe.setOrigin(0, 0);
        bottomPipe.setStrokeStyle(strokeWidth, strokeColor);

        this.pipes.push({
            x: xPos,
            top: topHeight,
            scored: false,
            topPipe: topPipe,
            bottomPipe: bottomPipe
        });
    }

    handleInputDown(pointer)
    {
        if (this.gameState === 'GAMEOVER') {
            this.resetGame();
            return;
        }
        this.aiming.active = true;
        this.aiming.startX = pointer.x;
        this.aiming.startY = pointer.y;
        this.aiming.currentX = pointer.x;
        this.aiming.currentY = pointer.y;
        if (this.gameState === 'START') this.gameState = 'PLAYING';
    }

    handleInputMove(pointer)
    {
        if (this.aiming.active) {
            this.aiming.currentX = pointer.x;
            this.aiming.currentY = pointer.y;
        }
    }

    handleInputUp(pointer)
    {
        if (this.aiming.active) {
            this.aiming.active = false;
            if (this.gameState === 'MENU') {
                this.gameState = 'PLAYING';
                this.isTransitioning = true;
            }
            let dx = this.aiming.startX - pointer.x;
            let dy = this.aiming.startY - pointer.y;
            if (dx < 0) dx = 0;
            const len = Math.sqrt(dx * dx + dy * dy);
            if (len > this.MAX_PULL) {
                const scale = this.MAX_PULL / len;
                dx *= scale;
                dy *= scale;
            }
            this.birdVy = dy * this.POWER_MULTIPLIER;
            this.worldSpeed += dx * this.POWER_MULTIPLIER;
            this.pipesClearedInLaunch = 0;
            this.soundJump.play();
            this.isAnimating = true;
            this.bird.play('fly');
            this.tweens.add({
                targets: this.music,
                volume: 0.1,
                duration: 1000
            });
        }
    }

    update(time, delta)
    {
        const dt = delta / 1000;
        const timeScale = this.aiming.active ? 0.1 : 1.0;
        const gameDt = dt * timeScale;
        this.bgScrollX += this.worldSpeed * 0.1 * gameDt;
        this.bgTileSprite.tilePositionX = this.bgScrollX;
        this.updateUI();
        this.graphics.clear();
        if (this.aiming.active) {
            let dx = this.aiming.startX - this.aiming.currentX;
            let dy = this.aiming.startY - this.aiming.currentY;
            if (dx < 0) dx = 0;
            const len = Math.sqrt(dx * dx + dy * dy);
            let drawDx = dx, drawDy = dy;
            if (len > this.MAX_PULL) {
                const scale = this.MAX_PULL / len;
                drawDx *= scale;
                drawDy *= scale;
            }
            this.graphics.lineStyle(2, 0x000000, 0.3);
            this.graphics.lineBetween(this.bird.x, this.bird.y, this.bird.x - drawDx, this.bird.y - drawDy);
            this.graphics.fillStyle(0x000000, 1);
            this.graphics.fillCircle(this.bird.x - drawDx, this.bird.y - drawDy, 5);
            this.drawTrajectory(drawDx, drawDy);
        }
        if (this.isTransitioning) {
            this.titleOffset += 1000 * dt;
            this.bird.x = this.bird.x + (100 - this.bird.x) * 5 * dt;
            if (Math.abs(this.bird.x - 100) < 1) {
                this.bird.x = 100;
                this.isTransitioning = false;
            }
        }
        if (this.gameState === 'MENU') {
            this.menuTitleTimer += dt;
            this.titleContainer.setVisible(true);
            this.titleChars.forEach((t, i) => {
                t.y = Math.sin(this.menuTitleTimer * 5 + i * 0.5) * 10;
            });
            this.centerText.setText("Drag to Start!");
            this.centerText.setY(this.scale.height / 2 + 60);
            this.centerText.setColor('#000000');
        } else {
             this.titleContainer.setVisible(false);
             if (this.gameState === 'START') {
                 this.centerText.setText(`Click and Drag to Launch!\nBest: ${this.highscore}`);
                 this.centerText.setY(this.scale.height / 2);
                 this.centerText.setColor('#000000');
            } else if (this.gameState === 'GAMEOVER') {
                 this.centerText.setText(`GAME OVER\nScore: ${this.score}\nBest: ${this.highscore}\nClick to Restart`);
                 this.centerText.setColor('#000000');
            } else {
                 this.centerText.setText("");
            }
        }
        if (this.gameState === 'PLAYING') {
            this.timeLeft -= dt;
            if (this.timeLeft <= 0) {
                this.timeLeft = 0;
                this.setGameOver();
            }
            this.birdVy += this.GRAVITY * gameDt;
            this.birdY += this.birdVy * gameDt;
            this.bird.y = this.birdY;
            this.worldSpeed -= (this.worldSpeed * this.DRAG * gameDt);
            if (Math.abs(this.worldSpeed) < 1) this.worldSpeed = 0;
            const targetAngle = Phaser.Math.Clamp(this.birdVy * 0.002, -0.78, 1.57);
            this.bird.rotation = targetAngle;
             if (Math.abs(this.worldSpeed) < 50 && Math.abs(this.birdVy) < 10) {
                 this.bird.stop();
                 this.bird.setTexture('bird1');
                 this.isAnimating = false;
             }
            if (this.birdY < 0 || this.birdY > this.scale.height) this.setGameOver();
            if (this.worldSpeed > 0) this.distanceTraveled += this.worldSpeed * gameDt;
            if (this.distanceTraveled > this.nextPipeDist) {
                this.spawnPipe(this.scale.width + 50);
                this.nextPipeDist += this.PIPE_DIST_INTERVAL;
            }
            for (let i = this.pipes.length - 1; i >= 0; i--) {
                const p = this.pipes[i];
                p.x -= this.worldSpeed * gameDt;
                p.topPipe.x = p.x;
                p.bottomPipe.x = p.x;
                const birdRad = 20;
                const birdRight = this.bird.x + birdRad, birdLeft = this.bird.x - birdRad;
                const birdTop = this.birdY - birdRad, birdBottom = this.birdY + birdRad;
                const pipeLeft = p.x, pipeRight = p.x + this.PIPE_WIDTH;
                const pipeGapTop = p.top, pipeGapBottom = p.top + this.PIPE_GAP;
                if (birdRight > pipeLeft && birdLeft < pipeRight) {
                    if (birdTop < pipeGapTop || birdBottom > pipeGapBottom) this.setGameOver();
                }
                if (!p.scored && pipeRight < birdLeft) {
                    this.pipesClearedInLaunch++;
                    const points = 1 * this.pipesClearedInLaunch;
                    this.score += points;
                    p.scored = true;
                    const timeBonus = 1 * this.pipesClearedInLaunch;
                    this.timeLeft += timeBonus;
                    this.soundScore.play();
                    let textMsg = `+${points} (+${timeBonus}s)`;
                    if (this.pipesClearedInLaunch > 1) textMsg += ` (x${this.pipesClearedInLaunch}!)`;
                    this.spawnFloatingText(this.bird.x, this.birdY - 30, textMsg);
                    if (this.score > this.highscore) {
                        this.highscore = this.score;
                        this.saveHighscore();
                    }
                }
                if (pipeRight < -100) {
                    p.topPipe.destroy();
                    p.bottomPipe.destroy();
                    this.pipes.splice(i, 1);
                }
            }
        }
    }

    spawnFloatingText(x, y, message) {
        const text = this.add.text(x, y, message, {
            fontFamily: 'Arial', fontSize: '24px', color: '#ffffff', stroke: '#000000', strokeThickness: 4
        }).setOrigin(0.5);
        this.tweens.add({ targets: text, y: y - 50, duration: 800, ease: 'Linear' });
        this.tweens.add({ targets: text, scaleX: 1.5, scaleY: 1.5, duration: 400, yoyo: true, ease: 'Sine.easeInOut', onComplete: () => { text.destroy(); } });
        this.tweens.add({ targets: text, alpha: 0, duration: 800, ease: 'Linear' });
    }

    drawTrajectory(dx, dy)
    {
        this.graphics.lineStyle(2, 0xff0000, 0.6);
        let simX = this.bird.x, simY = this.bird.y;
        let simVy = dy * this.POWER_MULTIPLIER;
        let simWorldSpeed = this.worldSpeed + (dx * this.POWER_MULTIPLIER);
        const simDt = 1/60;
        for (let i = 0; i < 90; i++) {
            simVy += this.GRAVITY * simDt;
            simY += simVy * simDt;
            simWorldSpeed -= (simWorldSpeed * this.DRAG * simDt);
            if (Math.abs(simWorldSpeed) < 1) simWorldSpeed = 0;
            simX += simWorldSpeed * simDt;
            if (i % 3 === 0) this.graphics.fillCircle(simX, simY, 3);
            if (simY > this.scale.height || simY < 0 || simX > this.scale.width) break;
        }
    }

    setGameOver()
    {
        if (this.gameState !== 'GAMEOVER') {
            this.gameState = 'GAMEOVER';
            this.tweens.add({ targets: this.music, volume: 0.5, duration: 1000 });
            if (this.score > this.highscore) {
                this.highscore = this.score;
                this.saveHighscore();
            }
        }
    }

    updateUI()
    {
        this.scoreText.setText(`Score: ${this.score}`);
        this.highscoreText.setText(`Best: ${this.highscore}`);
        this.timeText.setText(`Time: ${this.timeLeft.toFixed(1)}`);
        if (this.timeLeft < 5) {
            this.timeText.setColor('#ff0000');
        } else {
            if (this.timeText.style.color !== '#ff0000' && this.timeLeft >= 5) {
                this.timeText.setColor('#000000');
            }
        }
    }
}