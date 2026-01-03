import { Scene } from 'phaser';

export class Game extends Scene
{
    // Game Constants
    private readonly GRAVITY = 400;
    private readonly DRAG = 0.3;
    private readonly PIPE_WIDTH = 80;
    private readonly PIPE_GAP = 180;
    private readonly PIPE_DIST_INTERVAL = 400;
    private readonly MAX_PULL = 200;
    private readonly POWER_MULTIPLIER = 3.0;

    // Game Objects
    private bird: Phaser.GameObjects.Sprite;
    private pipes: any[]; // Stores custom pipe objects
    private bgTileSprite: Phaser.GameObjects.TileSprite;
    private graphics: Phaser.GameObjects.Graphics;
    private scoreText: Phaser.GameObjects.Text;
    private highscoreText: Phaser.GameObjects.Text;
    private timeText: Phaser.GameObjects.Text;
    private centerText: Phaser.GameObjects.Text;
    
    // State Variables
    private gameState: 'MENU' | 'START' | 'PLAYING' | 'GAMEOVER' = 'MENU';
    private score: number = 0;
    private highscore: number = 0;
    private timeLeft: number = 30;
    private worldSpeed: number = 0;
    private distanceTraveled: number = 0;
    private nextPipeDist: number = 400;
    private pipesClearedInLaunch: number = 0;
    
    // Background Scrolling
    private bgScrollX: number = 0;

    // Bird Physics Variables
    private birdY: number;
    private birdVy: number;
    private birdAngle: number;
    private isAnimating: boolean = false;
    
    // Aiming Variables
    private aiming = {
        active: false,
        startX: 0,
        startY: 0,
        currentX: 0,
        currentY: 0
    };

    // Menu Variables
    private menuTitleTimer: number = 0;
    private titleOffset: number = 0;
    private isTransitioning: boolean = false;

    // Audio
    private soundJump: Phaser.Sound.BaseSound;
    private soundScore: Phaser.Sound.BaseSound;
    private music: Phaser.Sound.BaseSound;

    constructor ()
    {
        super('Game');
    }

    preload ()
    {
        this.load.setPath('assets');
        
        // Load Bird Sprites (frame-1 to frame-5)
        for (let i = 1; i <= 5; i++) {
            this.load.image(`bird${i}`, `sprites/bird/frame-${i}.png`);
        }

        // Pipe asset removed in favor of drawing

        // Load Audio
        this.load.audio('music', 'audio/BGM.wav');
        this.load.audio('jump', 'audio/jump.wav');
        this.load.audio('score', 'audio/score.wav');
    }

    create ()
    {
        // 1. Create Background
        this.createBackgroundTexture();
        this.bgTileSprite = this.add.tileSprite(0, 0, this.scale.width, this.scale.height, 'bg_checker').setOrigin(0,0);

        // Initialize Graphics for drawing lines/shapes (Slingshot)
        this.graphics = this.add.graphics();

        // Create Animations
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

        // Initialize Bird
        this.bird = this.add.sprite(100, 300, 'bird1');
        this.bird.setOrigin(0.5, 0.5);
        this.bird.setDisplaySize(40, 40);

        // Initialize Pipes List
        this.pipes = [];

        // UI Text
        // Use Black text as background is light
        const uiStyle = { fontFamily: 'Arial', fontSize: '24px', color: '#000000' };

        this.scoreText = this.add.text(20, 20, 'Score: 0', uiStyle).setDepth(10);
        this.highscoreText = this.add.text(20, 50, 'Best: 0', uiStyle).setDepth(10);
        this.timeText = this.add.text(20, 80, 'Time: 30.0', uiStyle).setDepth(10);
        
        this.centerText = this.add.text(this.scale.width / 2, this.scale.height / 2, '', {
            fontFamily: 'Arial', fontSize: '40px', color: '#000000', align: 'center'
        }).setOrigin(0.5).setDepth(10);

        // Input Handling
        this.input.on('pointerdown', this.handleInputDown, this);
        this.input.on('pointermove', this.handleInputMove, this);
        this.input.on('pointerup', this.handleInputUp, this);

        // Audio
        this.soundJump = this.sound.add('jump');
        this.soundScore = this.sound.add('score');
        this.music = this.sound.add('music', { loop: true, volume: 0.5 });
        this.music.play();

        // Load Highscore
        const storedScore = localStorage.getItem('highscore');
        if (storedScore) {
            this.highscore = parseInt(storedScore, 10);
        }

        this.resetGame();
        
        // Override for Menu
        this.gameState = 'MENU';
        this.bird.x = this.scale.width / 2;
        this.bird.y = this.scale.height / 2;
        this.birdY = this.bird.y; // Sync physics var
    }

    createBackgroundTexture()
    {
        const cellSize = 40;
        const graphics = this.make.graphics({ x: 0, y: 0, add: false });
        
        // Draw 2x2 grid
        // Top Left (Color A)
        graphics.fillStyle(0xF5F5DB);
        graphics.fillRect(0, 0, cellSize, cellSize);
        
        // Top Right (Color B)
        graphics.fillStyle(0xEDE8D1);
        graphics.fillRect(cellSize, 0, cellSize, cellSize);
        
        // Bottom Left (Color B)
        graphics.fillStyle(0xEDE8D1);
        graphics.fillRect(0, cellSize, cellSize, cellSize);
        
        // Bottom Right (Color A)
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
        this.bird.stop(); // Stop animation
        this.bird.setTexture('bird1');

        // Clear Pipes
        this.pipes.forEach((p: any) => {
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

    spawnPipe(xPos: number)
    {
        const minHeight = 100;
        const maxHeight = this.scale.height - this.PIPE_GAP - minHeight;
        const topHeight = Phaser.Math.Between(minHeight, maxHeight);
        
        // Pipe Style
        const pipeColor = 0x33CC33;
        const strokeColor = 0x000000;
        const strokeWidth = 3;

        // Top Pipe
        // height = topHeight. Origin (0,0)
        const topPipe = this.add.rectangle(xPos, 0, this.PIPE_WIDTH, topHeight, pipeColor);
        topPipe.setOrigin(0, 0);
        topPipe.setStrokeStyle(strokeWidth, strokeColor);
        
        // Bottom Pipe
        const bottomPipeY = topHeight + this.PIPE_GAP;
        const bottomPipeHeight = this.scale.height - bottomPipeY;
        const bottomPipe = this.add.rectangle(xPos, bottomPipeY, this.PIPE_WIDTH, bottomPipeHeight, pipeColor);
        bottomPipe.setOrigin(0, 0);
        bottomPipe.setStrokeStyle(strokeWidth, strokeColor);

        // Store custom object
        this.pipes.push({
            x: xPos,
            top: topHeight,
            scored: false,
            topPipe: topPipe,
            bottomPipe: bottomPipe
        });
    }

    handleInputDown(pointer: Phaser.Input.Pointer)
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

        if (this.gameState === 'START') {
            this.gameState = 'PLAYING';
        }
    }

    handleInputMove(pointer: Phaser.Input.Pointer)
    {
        if (this.aiming.active) {
            this.aiming.currentX = pointer.x;
            this.aiming.currentY = pointer.y;
        }
    }

    handleInputUp(pointer: Phaser.Input.Pointer)
    {
        if (this.aiming.active) {
            this.aiming.active = false;

            if (this.gameState === 'MENU') {
                this.gameState = 'PLAYING';
                this.isTransitioning = true;
                // this.music.stop(); // Love2D logic stopped music? Maybe keep it.
            }

            // Launch Logic
            let dx = this.aiming.startX - pointer.x;
            let dy = this.aiming.startY - pointer.y;

            if (dx < 0) dx = 0;

            const len = Math.sqrt(dx * dx + dy * dy);
            if (len > this.MAX_PULL) {
                const scale = this.MAX_PULL / len;
                dx *= scale;
                dy *= scale;
            }

            // Apply Impulse
            this.birdVy = dy * this.POWER_MULTIPLIER;
            this.worldSpeed += dx * this.POWER_MULTIPLIER;

            this.pipesClearedInLaunch = 0;
            
            this.soundJump.play();
            this.isAnimating = true;
            this.bird.play('fly');
        }
    }

    update(time: number, delta: number)
    {
        const dt = delta / 1000; // Convert to seconds

        // Time Dilation
        const timeScale = this.aiming.active ? 0.1 : 1.0;
        const gameDt = dt * timeScale;

        // Background Parallax
        // this.worldSpeed is pixels/sec. 
        // We move the background texture coordinate.
        // Factor 0.1 for depth.
        this.bgScrollX += this.worldSpeed * 0.1 * gameDt;
        this.bgTileSprite.tilePositionX = this.bgScrollX;

        this.updateUI();

        // Draw Slingshot
        this.graphics.clear();
        if (this.aiming.active) {
            let dx = this.aiming.startX - this.aiming.currentX;
            let dy = this.aiming.startY - this.aiming.currentY;
            if (dx < 0) dx = 0;
            
            const len = Math.sqrt(dx * dx + dy * dy);
            let drawDx = dx;
            let drawDy = dy;

            if (len > this.MAX_PULL) {
                const scale = this.MAX_PULL / len;
                drawDx *= scale;
                drawDy *= scale;
            }

            // Draw String
            this.graphics.lineStyle(2, 0x000000, 0.3);
            this.graphics.lineBetween(this.bird.x, this.bird.y, this.bird.x - drawDx, this.bird.y - drawDy);
            this.graphics.fillStyle(0x000000, 1);
            this.graphics.fillCircle(this.bird.x - drawDx, this.bird.y - drawDy, 5);

            // Trajectory Prediction
            this.drawTrajectory(drawDx, drawDy);
        }

        // Transition Logic
        if (this.isTransitioning) {
            this.titleOffset += 1000 * dt;
            // Lerp bird.x to 100
            this.bird.x = this.bird.x + (100 - this.bird.x) * 5 * dt;
            if (Math.abs(this.bird.x - 100) < 1) {
                this.bird.x = 100;
                this.isTransitioning = false;
            }
        }

        // Menu Title Animation
        if (this.gameState === 'MENU') {
            this.menuTitleTimer += dt;
            this.centerText.setText("Angry Flappy Bird\n\nDrag to Start!");
            this.centerText.setY(this.scale.height / 2 + Math.sin(this.menuTitleTimer * 2) * 10);
            this.centerText.setColor('#4488FF'); // Light Blueish for title
        } else if (this.gameState === 'START') {
             this.centerText.setText("Click and Drag to Launch!\nBest: " + this.highscore);
             this.centerText.setY(this.scale.height / 2);
             this.centerText.setColor('#000000');
        } else if (this.gameState === 'GAMEOVER') {
             this.centerText.setText(`GAME OVER\nScore: ${this.score}\nBest: ${this.highscore}\nClick to Restart`);
             this.centerText.setColor('#000000');
        } else {
             this.centerText.setText("");
        }


        if (this.gameState === 'PLAYING') {
            // Update Time
            this.timeLeft -= dt; // Real time penalty
            if (this.timeLeft <= 0) {
                this.timeLeft = 0;
                this.setGameOver();
            }

            // Bird Physics
            this.birdVy += this.GRAVITY * gameDt;
            this.birdY += this.birdVy * gameDt;
            this.bird.y = this.birdY;

            // World Physics
            this.worldSpeed -= (this.worldSpeed * this.DRAG * gameDt);
            if (Math.abs(this.worldSpeed) < 1) this.worldSpeed = 0;

            // Bird Rotation
            // Clamp between -45 deg (-0.78 rad) and 90 deg (1.57 rad)
            const targetAngle = Phaser.Math.Clamp(this.birdVy * 0.002, -0.78, 1.57);
            this.bird.rotation = targetAngle;

            // Animation Logic
            if (!this.isAnimating && (Math.abs(this.worldSpeed) > 50 || Math.abs(this.birdVy) > 10)) {
                 // Should be animating
            } 
            // Simplified: if fly animation is playing, keep it. 
            // Original logic stopped animation if slow.
             if (Math.abs(this.worldSpeed) < 50 && Math.abs(this.birdVy) < 10) {
                 this.bird.stop();
                 this.bird.setTexture('bird1');
                 this.isAnimating = false;
             }

            // Bounds Collision
            if (this.birdY < 0 || this.birdY > this.scale.height) {
                this.setGameOver();
            }

            // Pipe Spawning
            if (this.worldSpeed > 0) {
                this.distanceTraveled += this.worldSpeed * gameDt;
            }

            if (this.distanceTraveled > this.nextPipeDist) {
                this.spawnPipe(this.scale.width + 50);
                this.nextPipeDist += this.PIPE_DIST_INTERVAL;
            }

            // Pipes Update & Collision
            // Iterate backwards
            for (let i = this.pipes.length - 1; i >= 0; i--) {
                const p: any = this.pipes[i];
                p.x -= this.worldSpeed * gameDt;
                
                // Update sprite positions
                p.topPipe.x = p.x;
                p.bottomPipe.x = p.x;

                // Collision Detection
                // Simple AABB vs Circle check
                // Bird radius approx 20.
                const birdRad = 20;
                const birdRight = this.bird.x + birdRad;
                const birdLeft = this.bird.x - birdRad;
                const birdTop = this.birdY - birdRad;
                const birdBottom = this.birdY + birdRad;

                const pipeLeft = p.x;
                const pipeRight = p.x + this.PIPE_WIDTH;
                const pipeGapTop = p.top;
                const pipeGapBottom = p.top + this.PIPE_GAP;

                // Horizontal overlap
                if (birdRight > pipeLeft && birdLeft < pipeRight) {
                    // Vertical check (hit top pipe OR hit bottom pipe)
                    if (birdTop < pipeGapTop || birdBottom > pipeGapBottom) {
                        this.setGameOver();
                    }
                }

                // Scoring
                if (!p.scored && pipeRight < birdLeft) {
                    this.pipesClearedInLaunch++;
                    const points = 1 * this.pipesClearedInLaunch;
                    this.score += points;
                    p.scored = true;

                    // Time Bonus
                    const timeBonus = 1 * this.pipesClearedInLaunch;
                    this.timeLeft += timeBonus;

                    this.soundScore.play();
                    
                    if (this.score > this.highscore) {
                        this.highscore = this.score;
                        localStorage.setItem('highscore', this.highscore.toString());
                    }
                }

                // Cleanup
                if (pipeRight < -100) {
                    p.topPipe.destroy();
                    p.bottomPipe.destroy();
                    this.pipes.splice(i, 1);
                }
            }
        }
    }

    drawTrajectory(dx: number, dy: number)
    {
        this.graphics.lineStyle(2, 0xff0000, 0.6);
        
        let simX = this.bird.x;
        let simY = this.bird.y;
        let simVy = dy * this.POWER_MULTIPLIER;
        let simWorldSpeed = this.worldSpeed + (dx * this.POWER_MULTIPLIER);
        
        const simDt = 1/60;
        
        for (let i = 0; i < 90; i++) {
            simVy += this.GRAVITY * simDt;
            simY += simVy * simDt;
            
            simWorldSpeed -= (simWorldSpeed * this.DRAG * simDt);
            if (Math.abs(simWorldSpeed) < 1) simWorldSpeed = 0;
            
            simX += simWorldSpeed * simDt;

            if (i % 3 === 0) {
                this.graphics.fillCircle(simX, simY, 3);
            }
            
             if (simY > this.scale.height || simY < 0 || simX > this.scale.width) {
                break;
            }
        }
    }

    setGameOver()
    {
        if (this.gameState !== 'GAMEOVER') {
            this.gameState = 'GAMEOVER';
            if (this.score > this.highscore) {
                this.highscore = this.score;
                localStorage.setItem('highscore', this.highscore.toString());
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
            // Check if we need to change color depending on background?
            // Background is light, but HUD text is now black.
            // If Time is low, red is fine.
            if (this.timeText.style.color !== '#ff0000' && this.timeLeft >= 5) {
                this.timeText.setColor('#000000');
            }
        }
    }
}
