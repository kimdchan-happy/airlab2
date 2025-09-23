const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const scoreEl = document.getElementById("score");
const ballsEl = document.getElementById("balls");

const GRAVITY = 0.35;
const FRICTION = 0.995;
const WALL_LEFT = 80;
const WALL_RIGHT = canvas.width - 80;
const WALL_TOP = 80;
const WALL_BOTTOM = canvas.height - 70;

let score = 0;
let lives = 3;
let gameOver = false;

function setScore(value) {
  score = value;
  scoreEl.textContent = Math.max(0, Math.floor(score));
}

function addScore(delta) {
  setScore(score + delta);
}

function setLives(value) {
  lives = value;
  ballsEl.textContent = Math.max(0, lives);
}

class Ball {
  constructor() {
    this.radius = 12;
    this.reset();
  }

  reset() {
    this.x = canvas.width * 0.55;
    this.y = WALL_BOTTOM - 120;
    this.vx = (Math.random() - 0.5) * 6;
    this.vy = -10;
  }

  update() {
    if (gameOver) {
      return false;
    }

    this.vy += GRAVITY;
    this.vx *= FRICTION;
    this.vy *= FRICTION;

    this.x += this.vx;
    this.y += this.vy;

    // Walls
    if (this.x - this.radius < WALL_LEFT) {
      this.x = WALL_LEFT + this.radius;
      this.vx *= -0.9;
    } else if (this.x + this.radius > WALL_RIGHT) {
      this.x = WALL_RIGHT - this.radius;
      this.vx *= -0.9;
    }

    if (this.y - this.radius < WALL_TOP) {
      this.y = WALL_TOP + this.radius;
      this.vy *= -0.92;
    }

    if (this.y - this.radius > canvas.height + 40) {
      return true;
    }

    return false;
  }

  draw() {
    ctx.save();
    const gradient = ctx.createRadialGradient(
      this.x - this.radius * 0.4,
      this.y - this.radius * 0.4,
      this.radius * 0.2,
      this.x,
      this.y,
      this.radius
    );
    gradient.addColorStop(0, "#ffffff");
    gradient.addColorStop(0.55, "#8de9ff");
    gradient.addColorStop(1, "#1f9fff");
    ctx.fillStyle = gradient;

    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

class Bumper {
  constructor(x, y, radius, scoreValue = 100, color = "#ffb347") {
    this.x = x;
    this.y = y;
    this.radius = radius;
    this.scoreValue = scoreValue;
    this.color = color;
    this.hitCooldown = 0;
  }

  update(ball) {
    if (this.hitCooldown > 0) {
      this.hitCooldown -= 1;
    }

    const dx = ball.x - this.x;
    const dy = ball.y - this.y;
    const dist = Math.hypot(dx, dy);
    const overlap = this.radius + ball.radius - dist;

    if (overlap > 0) {
      const safeDist = dist || 0.0001;
      const nx = dx / safeDist;
      const ny = dy / safeDist;
      ball.x += nx * overlap;
      ball.y += ny * overlap;

      const dot = ball.vx * nx + ball.vy * ny;
      ball.vx -= 2 * dot * nx;
      ball.vy -= 2 * dot * ny;

      ball.vx *= 0.9;
      ball.vy *= 0.9;

      if (this.hitCooldown === 0) {
        addScore(this.scoreValue);
        this.hitCooldown = 12;
      }
    }
  }

  draw() {
    ctx.save();
    const gradient = ctx.createRadialGradient(
      this.x - this.radius * 0.3,
      this.y - this.radius * 0.3,
      this.radius * 0.2,
      this.x,
      this.y,
      this.radius
    );
    gradient.addColorStop(0, "#fff4d6");
    gradient.addColorStop(0.6, this.color);
    gradient.addColorStop(1, "#ff6133");

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "rgba(255,255,255,0.5)";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();
  }
}

class Peg extends Bumper {
  constructor(x, y, radius = 10) {
    super(x, y, radius, 25, "#7dd3fc");
  }
}

class Flipper {
  constructor(x, y, length, restAngle, activeAngle) {
    this.x = x;
    this.y = y;
    this.length = length;
    this.restAngle = restAngle;
    this.activeAngle = activeAngle;
    this.angle = restAngle;
    this.prevAngle = restAngle;
    this.thickness = 18;
    this.isActive = false;
  }

  setActive(active) {
    this.isActive = active;
  }

  update() {
    this.prevAngle = this.angle;
    const target = this.isActive ? this.activeAngle : this.restAngle;
    this.angle += (target - this.angle) * 0.35;
  }

  getEndPoint() {
    return {
      x: this.x + Math.cos(this.angle) * this.length,
      y: this.y + Math.sin(this.angle) * this.length,
    };
  }

  collide(ball) {
    const end = this.getEndPoint();
    const segX = end.x - this.x;
    const segY = end.y - this.y;
    const segLengthSq = segX * segX + segY * segY;
    if (segLengthSq === 0) {
      return;
    }

    const t = Math.max(
      0,
      Math.min(
        1,
        ((ball.x - this.x) * segX + (ball.y - this.y) * segY) / segLengthSq
      )
    );

    const closestX = this.x + segX * t;
    const closestY = this.y + segY * t;
    const dx = ball.x - closestX;
    const dy = ball.y - closestY;
    const dist = Math.hypot(dx, dy);
    const overlap = ball.radius + this.thickness * 0.5 - dist;

    if (overlap > 0) {
      const nx = dx / (dist || 1);
      const ny = dy / (dist || 1);

      ball.x += nx * overlap;
      ball.y += ny * overlap;

      const dot = ball.vx * nx + ball.vy * ny;
      ball.vx -= 2 * dot * nx;
      ball.vy -= 2 * dot * ny;

      const segLength = Math.sqrt(segLengthSq);
      const dirX = segX / segLength;
      const dirY = segY / segLength;
      const tangentX = -dirY;
      const tangentY = dirX;
      const angularVelocity = this.angle - this.prevAngle;
      const impulse = angularVelocity * this.length * 1.5;

      ball.vx += tangentX * impulse + dirX * 1.2;
      ball.vy += tangentY * impulse + dirY * 1.2;

      if (Math.abs(angularVelocity) > 0.01) {
        addScore(10);
      }
    }
  }

  draw() {
    const end = this.getEndPoint();
    ctx.save();
    ctx.lineCap = "round";
    ctx.strokeStyle = "#fcd34d";
    ctx.lineWidth = this.thickness;
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();

    ctx.strokeStyle = "rgba(255,255,255,0.45)";
    ctx.lineWidth = this.thickness * 0.4;
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
    ctx.restore();
  }
}

class Rail {
  constructor(x1, y1, x2, y2) {
    this.x1 = x1;
    this.y1 = y1;
    this.x2 = x2;
    this.y2 = y2;
    this.thickness = 14;
  }

  collide(ball) {
    const segX = this.x2 - this.x1;
    const segY = this.y2 - this.y1;
    const segLengthSq = segX * segX + segY * segY;
    if (segLengthSq === 0) return;

    const t = Math.max(
      0,
      Math.min(
        1,
        ((ball.x - this.x1) * segX + (ball.y - this.y1) * segY) / segLengthSq
      )
    );

    const closestX = this.x1 + segX * t;
    const closestY = this.y1 + segY * t;
    const dx = ball.x - closestX;
    const dy = ball.y - closestY;
    const dist = Math.hypot(dx, dy);
    const overlap = ball.radius + this.thickness * 0.5 - dist;

    if (overlap > 0) {
      const nx = dx / (dist || 1);
      const ny = dy / (dist || 1);
      ball.x += nx * overlap;
      ball.y += ny * overlap;

      const dot = ball.vx * nx + ball.vy * ny;
      ball.vx -= 2 * dot * nx;
      ball.vy -= 2 * dot * ny;
    }
  }

  draw() {
    ctx.save();
    ctx.strokeStyle = "rgba(94, 234, 212, 0.8)";
    ctx.lineWidth = this.thickness;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(this.x1, this.y1);
    ctx.lineTo(this.x2, this.y2);
    ctx.stroke();
    ctx.restore();
  }
}

const ball = new Ball();
const bumpers = [
  new Bumper(260, 210, 40),
  new Bumper(400, 160, 32, 120, "#f472b6"),
  new Bumper(540, 230, 46, 150, "#c4b5fd"),
];

const pegs = [
  new Peg(210, 320, 14),
  new Peg(280, 360, 12),
  new Peg(360, 320, 14),
  new Peg(440, 360, 12),
  new Peg(520, 320, 14),
];

const rails = [
  new Rail(WALL_LEFT + 6, WALL_TOP + 40, WALL_LEFT + 100, WALL_TOP + 140),
  new Rail(WALL_RIGHT - 6, WALL_TOP + 40, WALL_RIGHT - 100, WALL_TOP + 150),
  new Rail(WALL_LEFT + 40, WALL_BOTTOM - 50, WALL_LEFT + 120, WALL_BOTTOM + 10),
  new Rail(WALL_RIGHT - 40, WALL_BOTTOM - 50, WALL_RIGHT - 120, WALL_BOTTOM + 10),
];

const leftFlipper = new Flipper(
  WALL_LEFT + 150,
  WALL_BOTTOM + 20,
  120,
  Math.PI * 0.02,
  -Math.PI * 0.5
);
const rightFlipper = new Flipper(
  WALL_RIGHT - 150,
  WALL_BOTTOM + 20,
  120,
  Math.PI - Math.PI * 0.02,
  Math.PI + Math.PI * 0.5
);

const flippers = [leftFlipper, rightFlipper];

function drawPlayfield() {
  ctx.save();
  ctx.strokeStyle = "rgba(93, 220, 255, 0.6)";
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(WALL_LEFT, canvas.height - 40);
  ctx.quadraticCurveTo(WALL_LEFT - 30, canvas.height - 160, WALL_LEFT, WALL_TOP + 20);
  ctx.quadraticCurveTo(WALL_LEFT + 10, WALL_TOP, WALL_LEFT + 40, WALL_TOP);
  ctx.lineTo(WALL_RIGHT - 40, WALL_TOP);
  ctx.quadraticCurveTo(WALL_RIGHT - 10, WALL_TOP, WALL_RIGHT, WALL_TOP + 20);
  ctx.quadraticCurveTo(WALL_RIGHT + 30, canvas.height - 160, WALL_RIGHT, canvas.height - 40);
  ctx.stroke();

  ctx.strokeStyle = "rgba(14, 165, 233, 0.35)";
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 10]);
  ctx.stroke();
  ctx.restore();

  ctx.save();
  const glow = ctx.createLinearGradient(0, WALL_TOP, 0, canvas.height);
  glow.addColorStop(0, "rgba(59,130,246,0.18)");
  glow.addColorStop(0.5, "rgba(14,165,233,0.08)");
  glow.addColorStop(1, "rgba(56,189,248,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(WALL_LEFT + 6, WALL_TOP + 6, WALL_RIGHT - WALL_LEFT - 12, canvas.height - WALL_TOP - 12);
  ctx.restore();
}

function drawGameOver() {
  ctx.save();
  ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#f8fafc";
  ctx.font = "bold 48px 'Pretendard', 'Segoe UI', sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("GAME OVER", canvas.width / 2, canvas.height / 2 - 10);
  ctx.font = "24px 'Pretendard', 'Segoe UI', sans-serif";
  ctx.fillStyle = "#bae6fd";
  ctx.fillText("Space 키를 눌러 다시 시작", canvas.width / 2, canvas.height / 2 + 34);
  ctx.restore();
}

function resetGame() {
  setScore(0);
  setLives(3);
  gameOver = false;
  ball.reset();
}

function loseLife() {
  setLives(lives - 1);
  if (lives <= 0) {
    gameOver = true;
  } else {
    ball.reset();
  }
}

function step() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawPlayfield();

  rails.forEach((rail) => rail.draw());

  flippers.forEach((flipper) => flipper.update());

  const lost = ball.update();
  if (lost) {
    loseLife();
  }

  bumpers.forEach((bumper) => {
    bumper.update(ball);
    bumper.draw();
  });

  pegs.forEach((peg) => {
    peg.update(ball);
    peg.draw();
  });

  rails.forEach((rail) => rail.collide(ball));
  flippers.forEach((flipper) => {
    flipper.collide(ball);
    flipper.draw();
  });

  ball.draw();

  if (gameOver) {
    drawGameOver();
  }

  requestAnimationFrame(step);
}

window.addEventListener("keydown", (event) => {
  if (event.code === "ArrowLeft") {
    event.preventDefault();
    leftFlipper.setActive(true);
  } else if (event.code === "ArrowRight") {
    event.preventDefault();
    rightFlipper.setActive(true);
  } else if (event.code === "Space") {
    event.preventDefault();
    if (gameOver) {
      resetGame();
    }
  }
});

window.addEventListener("keyup", (event) => {
  if (event.code === "ArrowLeft") {
    leftFlipper.setActive(false);
  } else if (event.code === "ArrowRight") {
    rightFlipper.setActive(false);
  }
});

resetGame();
requestAnimationFrame(step);
