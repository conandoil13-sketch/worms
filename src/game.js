import {
    APPLE_COUNT,
    BASE_BOOST_TICK,
    BASE_NORMAL_TICK,
    BOT_COLORS,
    BOT_COUNT,
    GRID_HEIGHT,
    GRID_WIDTH,
    TILE_SIZE
} from "./config.js";
import { createGenerativeArt, createGenome, generateHexFromTime } from "./art.js";

function getDist(a, b) {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function keyOf(point) {
    return `${point.x},${point.y}`;
}

function cloneBody(body) {
    return body.map((segment) => ({ ...segment }));
}

function isSamePoint(a, b) {
    return a.x === b.x && a.y === b.y;
}

export class SnakeGame {
    constructor({ canvas, scoreBoard, logDisplay, startOverlay, resultOverlay, artPreviewContainer, audio, equippedArtwork = null }) {
        this.canvas = canvas;
        this.ctx = canvas.getContext("2d");
        this.scoreBoard = scoreBoard;
        this.logDisplay = logDisplay;
        this.startOverlay = startOverlay;
        this.resultOverlay = resultOverlay;
        this.artPreviewContainer = artPreviewContainer;
        this.audio = audio;
        this.equippedArtwork = equippedArtwork;
        this.gameLogs = [];
        this.lastGeneratedArt = null;
        this.lastRunRecord = null;
        this.startTime = 0;

        this.canvas.width = GRID_WIDTH * TILE_SIZE;
        this.canvas.height = GRID_HEIGHT * TILE_SIZE;

        this.init();
    }

    init() {
        this.obstacles = new Set();
        this.apples = [];
        this.snakes = [];
        this.started = false;
        this.gameOver = false;
        this.globalTick = 0;
        this.lastTempoLevel = 0;
        this.gameLogs = [];
        this.metrics = {
            applesEaten: 0,
            boostTicks: 0,
            directionChanges: 0,
            roomsDiscovered: this.rooms?.length ?? 0,
            path: [],
            appleEvents: [],
            deathPoint: null
        };
        this.logDisplay.innerHTML = "";
        this.startOverlay.style.opacity = "1";
        this.startOverlay.style.display = "flex";
        this.resultOverlay.style.display = "none";
        this.lastGeneratedArt = null;
        this.buildDungeon();
        this.spawnPlayers();
        this.metrics.roomsDiscovered = this.rooms.length;
        this.metrics.path.push({ ...this.player.body[0] });
        for (let i = 0; i < APPLE_COUNT; i += 1) {
            this.spawnApple();
        }
        this.logEvent("SYSTEM", { msg: "CORE INITIALIZED" });
    }

    get player() {
        return this._player;
    }

    set player(value) {
        this._player = value;
    }

    getCurrentIntervals() {
        const scoreLevel = Math.floor(this.player.score / 100);
        if (scoreLevel > this.lastTempoLevel) {
            this.lastTempoLevel = scoreLevel;
            this.logEvent("LEVEL UP", { tempo: "Increased", level: scoreLevel });
        }
        const reduction = scoreLevel * 10;
        return {
            normal: Math.max(100, BASE_NORMAL_TICK - reduction),
            boost: Math.max(50, BASE_BOOST_TICK - (reduction / 2))
        };
    }

    logEvent(type, detail) {
        const entry = { timestamp: Date.now(), type, ...detail };
        this.gameLogs.push(entry);

        const line = document.createElement("div");
        line.className = "mb-1 border-l-2 border-[#00f2ff]/30 pl-2 opacity-80 transition-opacity";
        line.textContent = `[${type}] ${JSON.stringify(detail)}`;
        this.logDisplay.prepend(line);
        if (this.logDisplay.childNodes.length > 40) {
            this.logDisplay.removeChild(this.logDisplay.lastChild);
        }
    }

    buildDungeon() {
        const floor = new Set();
        const rooms = [];
        for (let i = 0; i < 15; i += 1) {
            const w = 5 + Math.random() * 8;
            const h = 5 + Math.random() * 8;
            const x = 2 + Math.random() * (GRID_WIDTH - w - 4);
            const y = 2 + Math.random() * (GRID_HEIGHT - h - 4);
            rooms.push({ x, y, w, h, cx: Math.floor(x + w / 2), cy: Math.floor(y + h / 2) });
            for (let iy = Math.floor(y); iy < y + h; iy += 1) {
                for (let ix = Math.floor(x); ix < x + w; ix += 1) {
                    floor.add(`${ix},${iy}`);
                }
            }
        }
        for (let i = 0; i < rooms.length - 1; i += 1) {
            const a = rooms[i];
            const b = rooms[i + 1];
            for (let ix = Math.min(a.cx, b.cx); ix <= Math.max(a.cx, b.cx); ix += 1) {
                floor.add(`${ix},${a.cy}`);
                floor.add(`${ix},${a.cy + 1}`);
            }
            for (let iy = Math.min(a.cy, b.cy); iy <= Math.max(a.cy, b.cy); iy += 1) {
                floor.add(`${b.cx},${iy}`);
                floor.add(`${b.cx + 1},${iy}`);
            }
        }
        for (let y = 0; y < GRID_HEIGHT; y += 1) {
            for (let x = 0; x < GRID_WIDTH; x += 1) {
                if (!floor.has(`${x},${y}`)) {
                    this.obstacles.add(`${x},${y}`);
                }
            }
        }
        this.rooms = rooms;
    }

    spawnPlayers() {
        const room = this.rooms[0];
        this.player = {
            id: "YOU",
            body: [{ x: room.cx, y: room.cy }],
            prevBody: [{ x: room.cx, y: room.cy }],
            dir: { x: 0, y: 0 },
            nextDir: { x: 0, y: 0 },
            color: this.equippedArtwork?.genome?.palette?.[0] ?? "#00f2ff",
            score: 0,
            isBot: false,
            isDead: false,
            isBoosting: false,
            lastMove: 0
        };

        this.snakes.push(this.player);
        for (let i = 0; i < BOT_COUNT; i += 1) {
            this.spawnBot(i + 1);
        }
    }

    spawnBot(id) {
        const aliveCount = this.snakes.filter((snake) => snake.isBot && !snake.isDead).length;
        if (aliveCount >= BOT_COUNT) {
            return;
        }

        const room = this.rooms[Math.floor(Math.random() * this.rooms.length)];
        const directions = [
            { x: 1, y: 0 },
            { x: -1, y: 0 },
            { x: 0, y: 1 },
            { x: 0, y: -1 }
        ];

        const initialDir = directions[Math.floor(Math.random() * directions.length)];
        const color = BOT_COLORS[Math.floor(Math.random() * BOT_COLORS.length)];

        this.snakes.push({
            id: `BOT_#${id}`,
            body: [{ x: room.cx, y: room.cy }],
            prevBody: [{ x: room.cx, y: room.cy }],
            dir: initialDir,
            color,
            score: 0,
            isBot: true,
            isDead: false,
            isBoosting: false,
            lastMove: 0,
            path: []
        });
    }

    spawnApple(xPos = -1, yPos = -1) {
        let x = xPos;
        let y = yPos;
        if (xPos === -1 || yPos === -1) {
            let attempts = 0;
            do {
                x = Math.floor(Math.random() * GRID_WIDTH);
                y = Math.floor(Math.random() * GRID_HEIGHT);
                attempts += 1;
                if (attempts > 100) {
                    return;
                }
            } while (
                this.hasAppleAt(x, y) ||
                this.obstacles.has(`${x},${y}`) ||
                this.snakes.some((snake) => snake.body.some((segment) => segment.x === x && segment.y === y))
            );
        }

        if (!this.hasAppleAt(x, y)) {
            this.apples.push({ x, y });
        }
    }

    hasAppleAt(x, y) {
        return this.apples.some((apple) => apple.x === x && apple.y === y);
    }

    start() {
        if (!this.started) {
            this.audio.init();
            this.started = true;
            this.startTime = performance.now();
            this.startOverlay.style.opacity = "0";
            setTimeout(() => {
                this.startOverlay.style.display = "none";
            }, 500);
        }
    }

    update(now) {
        if (this.gameOver || !this.started) {
            return;
        }

        if (this.player.isBoosting) {
            this.metrics.boostTicks += 1;
        }
        this.globalTick += 1;
        const currentRates = this.getCurrentIntervals();
        const plans = this.createMovePlans(now, currentRates);
        this.resolveTurn(plans, now);
    }

    createMovePlans(now, currentRates) {
        return this.snakes
            .filter((snake) => !snake.isDead)
            .map((snake) => {
                const interval = snake.isBoosting ? currentRates.boost : currentRates.normal;
                const shouldMove = now - snake.lastMove >= interval;
                const dir = shouldMove
                    ? (snake.isBot ? this.logicBot(snake) : { ...snake.nextDir })
                    : { ...snake.dir };
                const next = shouldMove
                    ? { x: snake.body[0].x + dir.x, y: snake.body[0].y + dir.y }
                    : null;
                const willAdvance = Boolean(shouldMove && (dir.x !== 0 || dir.y !== 0));
                const ateApple = Boolean(willAdvance && next && this.hasAppleAt(next.x, next.y));
                const dropsTail = Boolean(willAdvance && !ateApple && snake.body.length > 0);

                return {
                    snake,
                    interval,
                    shouldMove,
                    willAdvance,
                    dir,
                    next,
                    ateApple,
                    dropsTail,
                    boostDropsTail: Boolean(
                        willAdvance &&
                        snake.isBoosting &&
                        snake.body.length > 3 &&
                        this.globalTick % 5 === 0
                    )
                };
            });
    }

    logicBot(bot) {
        if (this.globalTick % 6 === 0 || !bot.path || bot.path.length === 0) {
            if (this.apples.length > 0) {
                const target = this.apples.reduce((prev, current) => (
                    getDist(bot.body[0], current) < getDist(bot.body[0], prev) ? current : prev
                ), this.apples[0]);
                bot.path = this.findPath(bot.body[0], target) ?? [];
            }
        }

        if (bot.path && bot.path.length > 0) {
            const next = bot.path.shift();
            return { x: next.x - bot.body[0].x, y: next.y - bot.body[0].y };
        }

        const directions = [
            { x: 1, y: 0 },
            { x: -1, y: 0 },
            { x: 0, y: 1 },
            { x: 0, y: -1 }
        ].sort(() => Math.random() - 0.5);

        for (const dir of directions) {
            const probe = { x: bot.body[0].x + dir.x, y: bot.body[0].y + dir.y };
            if (!this.isStaticCollision(probe)) {
                return dir;
            }
        }

        return { ...bot.dir };
    }

    findPath(start, target) {
        const open = [start];
        const cameFrom = new Map();
        const g = new Map();
        const f = new Map();
        g.set(keyOf(start), 0);
        f.set(keyOf(start), getDist(start, target));

        let iterations = 0;
        while (open.length > 0 && iterations < 250) {
            iterations += 1;
            let current = open.reduce((a, b) => ((f.get(keyOf(a)) || 0) < (f.get(keyOf(b)) || 0) ? a : b));
            if (isSamePoint(current, target)) {
                const path = [];
                while (cameFrom.has(keyOf(current))) {
                    path.push(current);
                    current = cameFrom.get(keyOf(current));
                }
                return path.reverse();
            }

            open.splice(open.indexOf(current), 1);
            [
                { x: 1, y: 0 },
                { x: -1, y: 0 },
                { x: 0, y: 1 },
                { x: 0, y: -1 }
            ].forEach((dir) => {
                const neighbor = { x: current.x + dir.x, y: current.y + dir.y };
                const neighborKey = keyOf(neighbor);

                if (
                    neighbor.x < 0 ||
                    neighbor.x >= GRID_WIDTH ||
                    neighbor.y < 0 ||
                    neighbor.y >= GRID_HEIGHT ||
                    this.obstacles.has(neighborKey)
                ) {
                    return;
                }

                if (this.snakes.some((snake) => !snake.isDead && snake.body.some((segment) => isSamePoint(segment, neighbor)))) {
                    return;
                }

                const tentativeG = g.get(keyOf(current)) + 1;
                if (!g.has(neighborKey) || tentativeG < g.get(neighborKey)) {
                    cameFrom.set(neighborKey, current);
                    g.set(neighborKey, tentativeG);
                    f.set(neighborKey, tentativeG + getDist(neighbor, target));
                    if (!open.some((point) => isSamePoint(point, neighbor))) {
                        open.push(neighbor);
                    }
                }
            });
        }

        return null;
    }

    isStaticCollision(point) {
        if (
            point.x < 0 ||
            point.x >= GRID_WIDTH ||
            point.y < 0 ||
            point.y >= GRID_HEIGHT ||
            this.obstacles.has(keyOf(point))
        ) {
            return true;
        }

        return this.snakes.some((snake) => !snake.isDead && snake.body.some((segment) => isSamePoint(segment, point)));
    }

    buildOccupancy(plans) {
        const occupancy = new Map();

        plans.forEach((plan) => {
            const body = plan.snake.body;
            const tailIndex = body.length - 1;
            body.forEach((segment, index) => {
                if (plan.dropsTail && index === tailIndex) {
                    return;
                }
                const cellKey = keyOf(segment);
                if (!occupancy.has(cellKey)) {
                    occupancy.set(cellKey, new Set());
                }
                occupancy.get(cellKey).add(plan.snake.id);
            });
        });

        return occupancy;
    }

    resolveTurn(plans, now) {
        const occupancy = this.buildOccupancy(plans);
        const deadIds = new Set();
        const movingPlans = plans.filter((plan) => plan.willAdvance);
        const headTargets = new Map();

        movingPlans.forEach((plan) => {
            const nextKey = keyOf(plan.next);
            if (
                plan.next.x < 0 ||
                plan.next.x >= GRID_WIDTH ||
                plan.next.y < 0 ||
                plan.next.y >= GRID_HEIGHT ||
                this.obstacles.has(nextKey)
            ) {
                deadIds.add(plan.snake.id);
                return;
            }

            if (occupancy.has(nextKey)) {
                deadIds.add(plan.snake.id);
            }

            if (!headTargets.has(nextKey)) {
                headTargets.set(nextKey, []);
            }
            headTargets.get(nextKey).push(plan);
        });

        headTargets.forEach((plansAtCell) => {
            if (plansAtCell.length > 1) {
                plansAtCell.forEach((plan) => deadIds.add(plan.snake.id));
            }
        });

        for (let i = 0; i < movingPlans.length; i += 1) {
            for (let j = i + 1; j < movingPlans.length; j += 1) {
                const first = movingPlans[i];
                const second = movingPlans[j];
                if (
                    isSamePoint(first.next, second.snake.body[0]) &&
                    isSamePoint(second.next, first.snake.body[0])
                ) {
                    deadIds.add(first.snake.id);
                    deadIds.add(second.snake.id);
                }
            }
        }

        const consumedApples = [];

        plans.forEach((plan) => {
            if (deadIds.has(plan.snake.id)) {
                return;
            }

            if (!plan.willAdvance) {
                return;
            }

            plan.snake.prevBody = cloneBody(plan.snake.body);
            plan.snake.dir = plan.dir;
            plan.snake.body.unshift(plan.next);
            if (!plan.snake.isBot) {
                this.metrics.path.push({ ...plan.next });
            }

            if (plan.ateApple) {
                plan.snake.score += 15;
                this.metrics.applesEaten += plan.snake.isBot ? 0 : 1;
                if (!plan.snake.isBot) {
                    this.metrics.appleEvents.push({ ...plan.next });
                }
                consumedApples.push(plan.next);
                if (!plan.snake.isBot) {
                    this.audio.playEat();
                }
            } else {
                plan.snake.body.pop();
            }

            if (plan.boostDropsTail) {
                const dropped = plan.snake.body.pop();
                if (dropped) {
                    this.spawnApple(dropped.x, dropped.y);
                }
            }

            plan.snake.lastMove = now;
        });

        consumedApples.forEach((applePoint) => {
            const appleIndex = this.apples.findIndex((apple) => isSamePoint(apple, applePoint));
            if (appleIndex !== -1) {
                this.apples.splice(appleIndex, 1);
                this.spawnApple();
            }
        });

        plans
            .filter((plan) => deadIds.has(plan.snake.id))
            .forEach((plan) => {
                this.kill(plan.snake);
            });
    }

    kill(snake) {
        if (snake.isDead) {
            return;
        }

        snake.isDead = true;
        if (snake.id === "YOU") {
            this.metrics.deathPoint = { ...snake.body[0] };
        }
        this.audio.playDie();
        snake.body.forEach((point, index) => {
            if (index % 2 === 0) {
                this.spawnApple(point.x, point.y);
            }
        });
        this.logEvent("UNIT_LOST", { id: snake.id, finalScore: snake.score });

        if (snake.id === "YOU") {
            this.handleGameOver();
            return;
        }

        setTimeout(() => {
            this.snakes = this.snakes.filter((item) => item !== snake);
            if (!this.gameOver) {
                this.spawnBot(Math.floor(Math.random() * 1000));
            }
        }, 2500);
    }

    handleGameOver() {
        this.gameOver = true;
        const endTime = performance.now();
        const startCol = generateHexFromTime(this.startTime);
        const endCol = generateHexFromTime(endTime);
        const metrics = {
            score: this.player.score,
            length: this.player.body.length,
            survivalTime: Math.round(endTime - this.startTime),
            applesEaten: this.metrics.applesEaten,
            boostTicks: this.metrics.boostTicks,
            directionChanges: this.metrics.directionChanges,
            tempoLevel: this.lastTempoLevel,
            rooms: this.rooms.length
        };
        const genome = createGenome({
            startCol,
            endCol,
            length: metrics.length,
            score: metrics.score,
            time: metrics.survivalTime,
            parentGenome: this.equippedArtwork?.genome ?? null
        });
        this.lastGeneratedArt = createGenerativeArt({
            startCol,
            endCol,
            length: metrics.length,
            score: metrics.score,
            time: metrics.survivalTime,
            genome,
            metrics,
            relics: {
                generation: (this.equippedArtwork?.generation ?? 0) + 1,
                path: this.metrics.path,
                apples: this.metrics.appleEvents,
                deathPoint: this.metrics.deathPoint,
                rooms: this.rooms.map((room) => ({ cx: room.cx, cy: room.cy }))
            }
        });
        this.lastRunRecord = {
            id: Date.now(),
            data: this.lastGeneratedArt,
            createdAt: Date.now(),
            generation: (this.equippedArtwork?.generation ?? 0) + 1,
            parentId: this.equippedArtwork?.id ?? null,
            genome,
            metrics
        };
        this.artPreviewContainer.innerHTML = `<img src="${this.lastGeneratedArt}" class="w-full h-full object-contain">`;
        this.resultOverlay.style.display = "flex";
    }

    setEquippedArtwork(artwork) {
        this.equippedArtwork = artwork;
        if (this.player) {
            this.player.color = artwork?.genome?.palette?.[0] ?? "#00f2ff";
        }
    }

    registerDirectionChange() {
        this.metrics.directionChanges += 1;
    }

    draw(now) {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
        this.ctx.lineWidth = 1;

        for (let i = 0; i < GRID_WIDTH; i += 10) {
            this.ctx.beginPath();
            this.ctx.moveTo(i * TILE_SIZE, 0);
            this.ctx.lineTo(i * TILE_SIZE, this.canvas.height);
            this.ctx.stroke();
        }
        for (let i = 0; i < GRID_HEIGHT; i += 10) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, i * TILE_SIZE);
            this.ctx.lineTo(this.canvas.width, i * TILE_SIZE);
            this.ctx.stroke();
        }

        this.ctx.fillStyle = "#222";
        this.obstacles.forEach((value) => {
            const [x, y] = value.split(",").map(Number);
            this.ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        });

        this.apples.forEach((apple) => {
            this.ctx.shadowBlur = 15;
            this.ctx.shadowColor = "#fbbf24";
            this.ctx.fillStyle = "#fbbf24";
            this.ctx.beginPath();
            this.ctx.arc(
                apple.x * TILE_SIZE + TILE_SIZE / 2,
                apple.y * TILE_SIZE + TILE_SIZE / 2,
                TILE_SIZE / 3,
                0,
                Math.PI * 2
            );
            this.ctx.fill();
        });
        this.ctx.shadowBlur = 0;

        const currentRates = this.getCurrentIntervals();
        this.snakes.forEach((snake) => {
            if (snake.isDead) {
                return;
            }

            const interval = snake.isBoosting ? currentRates.boost : currentRates.normal;
            const lerp = Math.min((now - snake.lastMove) / interval, 1);
            this.ctx.shadowBlur = snake.isBoosting ? 20 : 10;
            this.ctx.shadowColor = snake.color;
            this.ctx.fillStyle = snake.color;

            snake.body.forEach((current, index) => {
                const previous = snake.prevBody[index] || current;
                const dx = (previous.x + (current.x - previous.x) * (this.started ? lerp : 0)) * TILE_SIZE;
                const dy = (previous.y + (current.y - previous.y) * (this.started ? lerp : 0)) * TILE_SIZE;
                this.ctx.beginPath();
                this.ctx.roundRect(dx + 1, dy + 1, TILE_SIZE - 2, TILE_SIZE - 2, index === 0 ? 6 : 4);
                this.ctx.fill();
            });
            this.ctx.shadowBlur = 0;
        });
    }

    renderScoreboard() {
        const sorted = [...this.snakes]
            .filter((snake) => !snake.isDead)
            .sort((a, b) => b.score - a.score);

        this.scoreBoard.innerHTML = sorted.map((snake) => `
            <div class="flex justify-between items-center p-3 rounded-xl ${snake.id === "YOU" ? "bg-emerald-500/20 border-2 border-emerald-400" : "bg-slate-800/40 border-2 border-slate-700"}">
                <div class="flex items-center gap-3">
                    <div class="w-4 h-4 rounded-sm" style="background:${snake.color}; box-shadow: 0 0 10px ${snake.color};"></div>
                    <span class="font-bold text-xl ${snake.id === "YOU" ? "text-emerald-400" : "text-slate-300"}">${snake.id}</span>
                </div>
                <span class="font-mono text-2xl text-white">${snake.score}</span>
            </div>
        `).join("");
    }
}
