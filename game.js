/**
 * 早八跑酷小游戏核心逻辑。
 * 目标：在限定时间内躲避障碍，若时间结束或碰撞达到3次则判定迟到。
 */
(() => {
  const gameArea = document.getElementById("game-area");
  const playerEl = document.getElementById("player");
  const timeLeftEl = document.getElementById("time-left");
  const hitCountEl = document.getElementById("hit-count");
  const scoreEl = document.getElementById("score");
  const overlay = document.getElementById("overlay");
  const overlayTitle = document.getElementById("overlay-title");
  const overlayText = document.getElementById("overlay-text");
  const startBtn = document.getElementById("start-btn");

  const GAME_TIME = 60;
  const MAX_HIT = 3;
  const LANES = [140, 420, 700]; // 三条跑道的水平位置。

  const state = {
    running: false,
    timeLeft: GAME_TIME,
    hits: 0,
    score: 0,
    laneIndex: 1,
    jumping: false,
    ducking: false,
    jumpVelocity: 0,
    playerY: 0,
    obstacles: [],
    obstacleTimer: 0,
    spawnInterval: 900,
    gameLoopId: 0,
    lastTick: 0,
    secondAccumulator: 0,
  };

  function resetState() {
    state.running = false;
    state.timeLeft = GAME_TIME;
    state.hits = 0;
    state.score = 0;
    state.laneIndex = 1;
    state.jumping = false;
    state.ducking = false;
    state.jumpVelocity = 0;
    state.playerY = 0;
    state.obstacles.forEach((item) => item.el.remove());
    state.obstacles = [];
    state.obstacleTimer = 0;
    state.spawnInterval = 900;
    state.secondAccumulator = 0;

    playerEl.classList.remove("jumping", "ducking");
    playerEl.style.bottom = "24px";
    updatePlayerLane();
    updateHUD();
  }

  function updateHUD() {
    timeLeftEl.textContent = String(state.timeLeft);
    hitCountEl.textContent = String(state.hits);
    scoreEl.textContent = String(state.score);
  }

  function updatePlayerLane() {
    playerEl.style.left = `${LANES[state.laneIndex]}px`;
  }

  function jump() {
    if (state.jumping || !state.running) return;
    state.jumping = true;
    state.jumpVelocity = 16;
    playerEl.classList.add("jumping");
  }

  function setDuck(active) {
    if (!state.running || state.jumping) return;
    state.ducking = active;
    playerEl.classList.toggle("ducking", active);
  }

  function spawnObstacle() {
    const types = ["rail", "pedestrian", "director"];
    const kind = types[Math.floor(Math.random() * types.length)];
    const laneIndex = Math.floor(Math.random() * LANES.length);

    const el = document.createElement("div");
    el.className = `obstacle ${kind}`;
    el.style.left = `${LANES[laneIndex]}px`;
    el.style.bottom = "24px";
    gameArea.appendChild(el);

    state.obstacles.push({
      el,
      laneIndex,
      y: gameArea.clientHeight,
      speed: 6 + Math.random() * 2 + state.score * 0.02,
      hit: false,
      kind,
    });
  }

  function rectsOverlap(a, b) {
    return !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom);
  }

  function hitObstacle(obstacle) {
    obstacle.hit = true;
    obstacle.el.style.opacity = "0.4";
    state.hits += 1;
    updateHUD();
    if (state.hits >= MAX_HIT) {
      endGame(false, "你连续撞到障碍物三次，被判定迟到！");
    }
  }

  function updateObstacles(deltaMs) {
    const playerRect = playerEl.getBoundingClientRect();

    state.obstacles.forEach((obstacle) => {
      obstacle.y -= obstacle.speed * (deltaMs / 16.67);
      obstacle.el.style.transform = `translateY(${obstacle.y - gameArea.clientHeight}px)`;

      if (!obstacle.hit && obstacle.laneIndex === state.laneIndex) {
        const obstacleRect = obstacle.el.getBoundingClientRect();
        if (rectsOverlap(playerRect, obstacleRect)) {
          // 下蹲时可以从行人下方溜过，跳跃时可以越过栏杆。
          const canAvoidByAction =
            (obstacle.kind === "pedestrian" && state.ducking) ||
            (obstacle.kind === "rail" && state.jumping && state.playerY > 24);
          if (!canAvoidByAction) {
            hitObstacle(obstacle);
          }
        }
      }
    });

    state.obstacles = state.obstacles.filter((obstacle) => {
      if (obstacle.y < -100) {
        obstacle.el.remove();
        state.score += 10;
        updateHUD();
        return false;
      }
      return true;
    });
  }

  function updatePlayerPhysics(deltaMs) {
    if (!state.jumping) return;

    state.playerY += state.jumpVelocity;
    state.jumpVelocity -= 0.9 * (deltaMs / 16.67);

    if (state.playerY <= 0) {
      state.playerY = 0;
      state.jumping = false;
      state.jumpVelocity = 0;
      playerEl.classList.remove("jumping");
    }

    playerEl.style.bottom = `${24 + state.playerY}px`;
  }

  function gameLoop(timestamp) {
    if (!state.running) return;
    if (!state.lastTick) state.lastTick = timestamp;

    const deltaMs = timestamp - state.lastTick;
    state.lastTick = timestamp;

    state.secondAccumulator += deltaMs;
    if (state.secondAccumulator >= 1000) {
      state.secondAccumulator -= 1000;
      state.timeLeft -= 1;
      if (state.timeLeft <= 0) {
        endGame(false, "时间到了！你还是迟到了。下次跑快一点！");
        return;
      }
      updateHUD();
    }

    state.obstacleTimer += deltaMs;
    if (state.obstacleTimer >= state.spawnInterval) {
      state.obstacleTimer = 0;
      state.spawnInterval = Math.max(420, state.spawnInterval - 8);
      spawnObstacle();
    }

    updatePlayerPhysics(deltaMs);
    updateObstacles(deltaMs);

    state.gameLoopId = requestAnimationFrame(gameLoop);
  }

  function endGame(win, message) {
    state.running = false;
    cancelAnimationFrame(state.gameLoopId);

    overlay.classList.add("visible");
    overlayTitle.textContent = win ? "准时到达！" : "迟到了！";
    overlayText.textContent = `${message} 最终得分：${state.score}`;
    startBtn.textContent = "再来一局";
  }

  function startGame() {
    resetState();
    overlay.classList.remove("visible");
    state.running = true;
    state.lastTick = 0;
    state.gameLoopId = requestAnimationFrame(gameLoop);
  }

  window.addEventListener("keydown", (event) => {
    if (event.code === "Space") {
      event.preventDefault();
      if (!state.running) startGame();
      return;
    }

    if (event.code === "ArrowLeft" || event.code === "KeyA") {
      state.laneIndex = Math.max(0, state.laneIndex - 1);
      updatePlayerLane();
    }
    if (event.code === "ArrowRight" || event.code === "KeyD") {
      state.laneIndex = Math.min(LANES.length - 1, state.laneIndex + 1);
      updatePlayerLane();
    }
    if (event.code === "ArrowUp" || event.code === "KeyW") {
      jump();
    }
    if (event.code === "ArrowDown" || event.code === "KeyS") {
      setDuck(true);
    }
  });

  window.addEventListener("keyup", (event) => {
    if (event.code === "ArrowDown" || event.code === "KeyS") {
      setDuck(false);
    }
  });

  startBtn.addEventListener("click", startGame);

  resetState();
})();
