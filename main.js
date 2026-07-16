// Physics Photo Puzzle - main.js

// Matter.js module aliases
const {
  Engine,
  Render,
  Runner,
  World,
  Bodies,
  Body,
  Constraint,
  Mouse,
  MouseConstraint,
  Events
} = Matter;

// Game State Variables
let gameState = 'menu'; // 'menu', 'playing', 'clear'
let difficulty = { cols: 3, rows: 2 };
let rotationEnabled = false;

// Detect touch device
const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

let engine = null;
let render = null;
let runner = null;
let mouseConstraint = null;

// Puzzle configurations
const puzzleWidth = 600;
const puzzleHeight = 400;
const canvasWidth = 1024;
const canvasHeight = 768;
const targetX = canvasWidth / 2; // 512
const targetY = 280; // Puzzle center Y
const targetLeft = targetX - puzzleWidth / 2; // 212
const targetTop = targetY - puzzleHeight / 2; // 80

let puzzleImage = null;
let puzzleImageLoaded = false;
let pieces = [];
let hintVisible = true;

// UI elements
let startScreen = null;
let gameScreen = null;
let clearScreen = null;
let timerText = null;
let progressText = null;
let hintBtn = null;
let rotationInstruction = null;

// Timer variables
let startTime = 0;
let elapsedTime = 0;
let timerInterval = null;

// Audio Context for sound effects
let audioCtx = null;

// Initialize when DOM is fully loaded
window.addEventListener('DOMContentLoaded', () => {
  initUI();
  preloadImage();
});

function initUI() {
  startScreen = document.getElementById('title-screen');
  gameScreen = document.getElementById('game-screen');
  clearScreen = document.getElementById('clear-screen');
  timerText = document.getElementById('game-timer');
  progressText = document.getElementById('progress-value');
  hintBtn = document.getElementById('hint-btn');
  rotationInstruction = document.getElementById('rotation-instruction');

  // Title Screen difficulty selectors
  const diffButtons = document.querySelectorAll('.diff-btn');
  diffButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      diffButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      difficulty.cols = parseInt(btn.dataset.cols);
      difficulty.rows = parseInt(btn.dataset.rows);
    });
  });

  // Rotation Toggle
  const rotationToggle = document.getElementById('rotation-toggle');
  rotationToggle.addEventListener('change', () => {
    rotationEnabled = rotationToggle.checked;
    if (rotationEnabled) {
      rotationInstruction.style.display = 'block';
    } else {
      rotationInstruction.style.display = 'none';
    }
  });

  // Start game button
  document.getElementById('start-game-btn').addEventListener('click', () => {
    if (puzzleImageLoaded) {
      startGame();
    } else {
      alert('画像の読み込み中です。少々お待ちください。');
    }
  });

  // Reset button
  document.getElementById('reset-btn').addEventListener('click', () => {
    resetGame();
  });

  // Back to Menu button
  document.getElementById('back-to-menu-btn').addEventListener('click', () => {
    confirmBackToMenu();
  });

  // Hint button toggle
  hintBtn.addEventListener('click', () => {
    toggleHint();
  });

  // Retry button (Clear Screen)
  document.getElementById('retry-btn').addEventListener('click', () => {
    switchScreen('game');
    resetGame();
  });

  // Back to Menu button (Clear Screen)
  document.getElementById('menu-btn').addEventListener('click', () => {
    switchScreen('menu');
  });

  // Enable Audio Context on first click
  window.addEventListener('click', initAudio, { once: true });

  // Multi-touch rotation support (tap with a second finger while dragging to rotate)
  window.addEventListener('touchstart', (e) => {
    if (gameState === 'playing' && rotationEnabled && mouseConstraint && mouseConstraint.body) {
      if (e.touches.length > 1) {
        e.preventDefault();
        rotatePiece(mouseConstraint.body);
      }
    }
  }, { passive: false });

  // Prevent any browser scrolling or bouncing gestures while in game or clear screens
  window.addEventListener('touchmove', (e) => {
    if (gameState === 'playing' || gameState === 'clear') {
      e.preventDefault();
    }
  }, { passive: false });
}

function initAudio() {
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
}

function preloadImage() {
  puzzleImage = new Image();
  puzzleImage.src = 'puzzle.png';
  puzzleImage.onload = () => {
    puzzleImageLoaded = true;
    console.log('Puzzle image loaded successfully:', puzzleImage.naturalWidth, 'x', puzzleImage.naturalHeight);
  };
  puzzleImage.onerror = () => {
    console.error('Failed to load puzzle.png. Make sure it exists in the same directory.');
  };
}

function switchScreen(screenName) {
  if (screenName === 'menu') {
    document.body.classList.remove('game-active');
    startScreen.classList.add('active');
    gameScreen.classList.remove('active');
    clearScreen.classList.remove('active');
    gameState = 'menu';
    stopTimer();
    cleanupPhysics();
  } else if (screenName === 'game') {
    document.body.classList.add('game-active');
    startScreen.classList.remove('active');
    gameScreen.classList.add('active');
    clearScreen.classList.remove('active');
    gameState = 'playing';
  } else if (screenName === 'clear') {
    document.body.classList.add('game-active');
    // Keep game screen active and display the clear screen as an overlay modal
    clearScreen.classList.add('active');
    gameState = 'clear';
  }
}

function startGame() {
  switchScreen('game');
  initPhysics();
  createPuzzlePieces();
  startTimer();
}

function resetGame() {
  stopTimer();
  cleanupPhysics();
  initPhysics();
  createPuzzlePieces();
  startTimer();
}

function confirmBackToMenu() {
  if (confirm('タイトル画面に戻りますか？現在の進行状況は失われます。')) {
    switchScreen('menu');
  }
}

// ----------------- PHYSICS ENGINE SETUP -----------------

function initPhysics() {
  const container = document.getElementById('canvas-container');
  container.innerHTML = ''; // Clear container

  // Create background hint image
  const hintImg = document.createElement('img');
  hintImg.id = 'hint-image';
  hintImg.src = 'puzzle.png';
  hintImg.style.position = 'absolute';
  hintImg.style.width = `${(puzzleWidth / canvasWidth) * 100}%`;
  hintImg.style.height = `${(puzzleHeight / canvasHeight) * 100}%`;
  hintImg.style.left = `${(targetLeft / canvasWidth) * 100}%`;
  hintImg.style.top = `${(targetTop / canvasHeight) * 100}%`;
  hintImg.style.opacity = hintVisible ? '0.15' : '0';
  hintImg.style.pointerEvents = 'none';
  hintImg.style.zIndex = '1';
  hintImg.style.borderRadius = '8px';
  hintImg.style.transition = 'opacity 0.3s ease';
  container.appendChild(hintImg);

  // Initialize Engine
  engine = Engine.create({
    gravity: { y: 0.6 } // Default gravity for lower tray
  });

  // Initialize Renderer
  render = Render.create({
    element: container,
    engine: engine,
    options: {
      width: canvasWidth,
      height: canvasHeight,
      wireframes: false,
      background: 'transparent', // Transparent to see background hint
      showAngleIndicator: false
    }
  });

  // Custom Render loop to draw puzzle pieces (bypasses CORS/toDataURL SecurityError under file:// protocol)
  Events.on(render, 'afterRender', () => {
    if (!puzzleImageLoaded || !puzzleImage) return;
    const ctx = render.context;
    
    pieces.forEach(p => {
      const { x, y } = p.body.position;
      const angle = p.body.angle;
      
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      
      // Calculate crop source position
      const srcW = puzzleImage.naturalWidth / difficulty.cols;
      const srcH = puzzleImage.naturalHeight / difficulty.rows;
      const srcX = p.col * srcW;
      const srcY = p.row * srcH;
      
      // Draw the piece image centered
      ctx.drawImage(
        puzzleImage,
        srcX, srcY, srcW, srcH,
        -p.width / 2, -p.height / 2,
        p.width, p.height
      );
      
      // Aesthetics border & glow effects
      if (mouseConstraint && mouseConstraint.body === p.body) {
        ctx.shadowColor = 'rgba(99, 102, 241, 0.8)';
        ctx.shadowBlur = 12;
        ctx.strokeStyle = 'rgba(99, 102, 241, 0.9)';
        ctx.lineWidth = 2.5;
        ctx.strokeRect(-p.width / 2, -p.height / 2, p.width, p.height);
      } else if (!p.snapped) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(-p.width / 2, -p.height / 2, p.width, p.height);
      }
      
      ctx.restore();
    });
  });

  // Apply CSS to canvas so it sits on top of hint image
  const canvas = render.canvas;
  canvas.style.position = 'absolute';
  canvas.style.top = '0';
  canvas.style.left = '0';
  canvas.style.zIndex = '2';

  // Prevent mobile browser scrolling when dragging inside canvas
  canvas.addEventListener('touchmove', (e) => {
    if (gameState === 'playing') {
      e.preventDefault();
    }
  }, { passive: false });

  // Walls and Tray boundaries
  const thickness = 60;
  
  // Outer boundaries to prevent pieces falling offscreen
  const ground = Bodies.rectangle(canvasWidth / 2, canvasHeight + thickness / 2 - 20, canvasWidth, thickness, {
    isStatic: true,
    render: { fillStyle: '#1e293b' }
  });
  const leftWall = Bodies.rectangle(-thickness / 2 + 10, canvasHeight / 2, thickness, canvasHeight, {
    isStatic: true,
    render: { fillStyle: '#1e293b' }
  });
  const rightWall = Bodies.rectangle(canvasWidth + thickness / 2 - 10, canvasHeight / 2, thickness, canvasHeight, {
    isStatic: true,
    render: { fillStyle: '#1e293b' }
  });
  const ceiling = Bodies.rectangle(canvasWidth / 2, -thickness / 2 + 10, canvasWidth, thickness, {
    isStatic: true,
    render: { fillStyle: '#1e293b' }
  });

  // Puzzle area outline (Decorative lines in Matterjs)
  const borderCol = 'rgba(255, 255, 255, 0.2)';
  const puzzleGuideBorder = Bodies.rectangle(targetX, targetY, puzzleWidth + 2, puzzleHeight + 2, {
    isStatic: true,
    isSensor: true, // Non-colliding sensor
    render: {
      fillStyle: 'transparent',
      strokeStyle: borderCol,
      lineWidth: 2
    }
  });

  World.add(engine.world, [ground, leftWall, rightWall, ceiling, puzzleGuideBorder]);

  // Setup Mouse Interaction
  const mouse = Mouse.create(render.canvas);
  mouseConstraint = MouseConstraint.create(engine, {
    mouse: mouse,
    constraint: {
      stiffness: 0.15,
      render: { visible: false }
    }
  });

  World.add(engine.world, mouseConstraint);

  // Responsive mouse coordinates correction
  const updateMouseScale = () => {
    if (!mouseConstraint || !render || !render.canvas) return;
    const clientRect = render.canvas.getBoundingClientRect();
    
    // Calculate CSS scaling factor
    const scaleX = canvasWidth / (clientRect.width || 1);
    const scaleY = canvasHeight / (clientRect.height || 1);
    
    Mouse.setScale(mouseConstraint.mouse, { x: scaleX, y: scaleY });
  };

  // Run scaling on engine updates and window resize
  Events.on(engine, 'beforeUpdate', updateMouseScale);
  window.addEventListener('resize', updateMouseScale);
  // Trigger once initially
  setTimeout(updateMouseScale, 100);

  // Mouse Drag Events for animations & sound
  let currentDraggedBody = null;
  let dragStartPos = { x: 0, y: 0 };
  let dragStartTime = 0;

  // Adjust drag Y-offset on touch devices to prevent finger from obscuring the piece
  Events.on(mouseConstraint, 'drag', (event) => {
    if (isTouchDevice && mouseConstraint.constraint && mouseConstraint.body) {
      // Offset by 75px upwards in canvas coordinates
      mouseConstraint.constraint.pointA.y -= 75;
    }
  });

  Events.on(mouseConstraint, 'startdrag', (event) => {
    currentDraggedBody = event.body;
    
    // Only drag non-static puzzle pieces
    if (currentDraggedBody && !currentDraggedBody.isStatic && currentDraggedBody.plugin && currentDraggedBody.plugin.pieceInfo) {
      currentDraggedBody.render.opacity = 0.85;
      
      // Store initial drag state for tap detection
      dragStartPos = { x: currentDraggedBody.position.x, y: currentDraggedBody.position.y };
      dragStartTime = Date.now();

      // Bring dragged piece to front
      const world = engine.world;
      World.remove(world, currentDraggedBody);
      World.add(world, currentDraggedBody);
      playDragSound();
    } else {
      // Don't drag static borders or walls
      mouseConstraint.constraint.bodyB = null;
    }
  });

  Events.on(mouseConstraint, 'enddrag', (event) => {
    if (currentDraggedBody) {
      currentDraggedBody.render.opacity = 1.0;
      
      // Tap detection (click/tap to rotate)
      const dx = currentDraggedBody.position.x - dragStartPos.x;
      const dy = currentDraggedBody.position.y - dragStartPos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const duration = Date.now() - dragStartTime;

      // If the movement was minimal and quick, treat it as a tap/click to rotate
      if (rotationEnabled && dist < 12 && duration < 350) {
        rotatePiece(currentDraggedBody);
      }

      currentDraggedBody = null;
    }
  });

  // Keyboard and Right Click Rotations
  window.removeEventListener('contextmenu', handleRightClick);
  window.addEventListener('contextmenu', handleRightClick);
  
  window.removeEventListener('keydown', handleKeyDown);
  window.addEventListener('keydown', handleKeyDown);

  function handleRightClick(e) {
    if (gameState === 'playing' && rotationEnabled && currentDraggedBody) {
      e.preventDefault();
      rotatePiece(currentDraggedBody);
    }
  }

  function handleKeyDown(e) {
    if (e.code === 'Space' && gameState === 'playing' && rotationEnabled && currentDraggedBody) {
      e.preventDefault();
      rotatePiece(currentDraggedBody);
    }
  }

  // Snap & Success check loop
  Events.on(engine, 'afterUpdate', () => {
    if (gameState !== 'playing') return;
    if (pieces.length === 0) return; // Prevent early win checks during synchronous init tick

    const activeDragBody = mouseConstraint.body;
    let newlySnapped = false;

    pieces.forEach(p => {
      if (p.snapped) return;

      // Check if not currently dragged
      if (p.body !== activeDragBody) {
        const currentPos = p.body.position;
        const dx = currentPos.x - p.correctX;
        const dy = currentPos.y - p.correctY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Angle check: normalized to [-PI, PI]
        let angleDiff = 0;
        if (rotationEnabled) {
          const normAngle = p.body.angle % (Math.PI * 2);
          angleDiff = Math.abs(normAngle);
          if (angleDiff > Math.PI) {
            angleDiff = Math.PI * 2 - angleDiff;
          }
        }

        // Snap tolerance: dynamic based on piece size (min 22px, max 45px)
        const tolerance = Math.max(22, Math.min(p.width, p.height) * 0.18);

        if (dist < tolerance && (!rotationEnabled || angleDiff < 0.15)) {
          // Snap!
          p.snapped = true;
          newlySnapped = true;
          
          // Lock physics properties
          Body.setPosition(p.body, { x: p.correctX, y: p.correctY });
          Body.setVelocity(p.body, { x: 0, y: 0 });
          Body.setAngle(p.body, 0);
          Body.setAngularVelocity(p.body, 0);
          p.body.isStatic = true;
          
          // Disable collision & dragging
          p.body.collisionFilter.group = -1;
          p.body.collisionFilter.mask = 0;

          // Sound and particle effects
          playSnapSound();
          createSnapParticles(p.correctX, p.correctY);
        }
      }
    });

    // Count snapped pieces after completing the loop
    const snappedCount = pieces.filter(p => p.snapped).length;

    if (newlySnapped) {
      updateProgress(snappedCount, pieces.length);
    }

    // Check win condition
    if (pieces.length > 0 && snappedCount === pieces.length) {
      winGame();
    }
  });

  // Start Engine & Render
  runner = Runner.create();
  Runner.run(runner, engine);
  Render.run(render);
}

function cleanupPhysics() {
  if (runner) Runner.stop(runner);
  if (render) Render.stop(render);
  if (engine) World.clear(engine.world);
  
  engine = null;
  render = null;
  runner = null;
  pieces = [];
}

// ----------------- PUZZLE PIECE CREATION -----------------

function createPuzzlePieces() {
  const cols = difficulty.cols;
  const rows = difficulty.rows;
  
  const pieceWidth = puzzleWidth / cols;
  const pieceHeight = puzzleHeight / rows;

  pieces = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      // Calculate correct target coordinates
      const correctX = targetLeft + c * pieceWidth + pieceWidth / 2;
      const correctY = targetTop + r * pieceHeight + pieceHeight / 2;

      // Define safe random spawn location (lower tray, avoiding overlap with walls/ground/puzzle area)
      const halfW = pieceWidth / 2;
      const halfH = pieceHeight / 2;
      
      // Keep within left/right borders (10px padding from screen edges)
      const minX = 10 + halfW;
      const maxX = canvasWidth - 10 - halfW;
      const spawnX = Math.random() * (maxX - minX) + minX;
      
      // Keep below puzzle guide area (Y = 480) and above the bottom ground (Y = 748)
      // Add 10px buffer to prevent physics engine overlap spikes
      const minY = 480 + halfH + 10;
      const maxY = 748 - halfH - 10;
      
      // Fallback check to ensure minY is always less than maxY
      const spawnY = minY < maxY ? Math.random() * (maxY - minY) + minY : 600;
      
      // Rotation angle
      let startAngle = 0;
      if (rotationEnabled) {
        const angles = [0, Math.PI / 2, Math.PI, Math.PI * 1.5];
        startAngle = angles[Math.floor(Math.random() * angles.length)];
      }

      // Create Matterjs body (invisible to default renderer, custom drawn in afterRender)
      const body = Bodies.rectangle(spawnX, spawnY, pieceWidth - 1, pieceHeight - 1, {
        render: {
          visible: false
        },
        restitution: 0.15,
        friction: 0.2,
        frictionAir: 0.03,
        inertia: rotationEnabled ? undefined : Infinity,
        plugin: {
          pieceInfo: { r, c },
          lastClickTime: 0 // Track for double tap to rotate on mobile
        }
      });

      Body.setAngle(body, startAngle);

      const pieceObj = {
        row: r,
        col: c,
        correctX: correctX,
        correctY: correctY,
        width: pieceWidth,
        height: pieceHeight,
        snapped: false,
        body: body
      };
      
      pieces.push(pieceObj);
      World.add(engine.world, body);
    }
  }

  updateProgress(0, pieces.length);
}

function rotatePiece(body) {
  const nextAngle = body.angle + Math.PI / 2;
  Body.setAngle(body, nextAngle);
  playRotateSound();
}

function toggleHint() {
  const hintImg = document.getElementById('hint-image');
  if (hintImg) {
    hintVisible = !hintVisible;
    hintImg.style.opacity = hintVisible ? '0.15' : '0';
    
    if (hintVisible) {
      hintBtn.classList.remove('secondary');
      hintBtn.innerHTML = '<i class="fa-solid fa-eye"></i> ヒントオン';
    } else {
      hintBtn.classList.add('secondary');
      hintBtn.innerHTML = '<i class="fa-regular fa-eye"></i> ヒント';
    }
  }
}

function updateProgress(snapped, total) {
  progressText.textContent = `${snapped} / ${total}`;
}

// ----------------- TIMER CONTROL -----------------

function startTimer() {
  startTime = Date.now();
  timerInterval = setInterval(() => {
    elapsedTime = Date.now() - startTime;
    timerText.textContent = formatTime(elapsedTime);
  }, 33);
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

function formatTime(ms) {
  const totalSeconds = ms / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const centiseconds = Math.floor((ms % 1000) / 10);
  
  const mStr = String(minutes).padStart(2, '0');
  const sStr = String(seconds).padStart(2, '0');
  const cStr = String(centiseconds).padStart(2, '0');
  
  return `${mStr}:${sStr}.${cStr}`;
}

// ----------------- SOUND SYNTHESIS (Web Audio) -----------------

function playTone(freq, type, duration, vol, delay = 0) {
  if (!audioCtx) return;
  
  setTimeout(() => {
    try {
      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }
      
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      
      osc.type = type;
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      
      gain.gain.setValueAtTime(vol, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + duration);
      
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      
      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch (e) {
      console.warn("Sound play error", e);
    }
  }, delay * 1000);
}

function playDragSound() {
  playTone(280, 'sine', 0.08, 0.08);
}

function playRotateSound() {
  playTone(420, 'triangle', 0.12, 0.12);
  playTone(520, 'triangle', 0.12, 0.12, 0.04);
}

function playSnapSound() {
  playTone(523.25, 'sine', 0.2, 0.15); // C5
  playTone(659.25, 'sine', 0.2, 0.15, 0.05); // E5
  playTone(783.99, 'sine', 0.3, 0.15, 0.1); // G5
}

function playWinSound() {
  const notes = [523.25, 659.25, 783.99, 1046.50, 1318.51, 1567.98, 2093.00];
  notes.forEach((freq, idx) => {
    playTone(freq, 'sine', 0.5, 0.12, idx * 0.08);
  });
  setTimeout(() => {
    playTone(1046.50, 'triangle', 1.2, 0.08, 0); // C6
    playTone(1318.51, 'triangle', 1.2, 0.08, 0); // E6
    playTone(1567.98, 'triangle', 1.2, 0.08, 0); // G6
  }, 600);
}

// ----------------- PARTICLE EFFECTS & CLEAR GAME -----------------

function createSnapParticles(x, y) {
  if (!engine) return;
  
  const colors = ['#818cf8', '#c084fc', '#38bdf8', '#ffffff'];
  
  for (let i = 0; i < 12; i++) {
    const size = Math.random() * 3 + 2;
    const particle = Bodies.circle(
      x + (Math.random() - 0.5) * 30,
      y + (Math.random() - 0.5) * 30,
      size,
      {
        render: {
          fillStyle: colors[Math.floor(Math.random() * colors.length)],
          opacity: 1.0
        },
        collisionFilter: {
          group: -2,
          mask: 0
        },
        frictionAir: 0.04
      }
    );

    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 4 + 2;
    
    Body.setVelocity(particle, {
      x: Math.cos(angle) * speed,
      y: Math.sin(angle) * speed
    });

    World.add(engine.world, particle);

    let opacity = 1.0;
    const fadeTimer = setInterval(() => {
      if (!engine) {
        clearInterval(fadeTimer);
        return;
      }
      
      opacity -= 0.06;
      if (opacity <= 0) {
        clearInterval(fadeTimer);
        World.remove(engine.world, particle);
      } else {
        particle.render.opacity = opacity;
      }
    }, 30);
  }
}

function spawnConfetti() {
  if (!engine) return;
  
  const colors = ['#f43f5e', '#ec4899', '#d946ef', '#a855f7', '#8b5cf6', '#6366f1', '#3b82f6', '#0ea5e9', '#06b6d4', '#10b981', '#22c55e', '#eab308', '#f97316'];
  
  for (let i = 0; i < 70; i++) {
    const x = Math.random() * canvasWidth;
    const y = -Math.random() * 200 - 20;
    const w = Math.random() * 10 + 6;
    const h = Math.random() * 14 + 7;
    
    const confetti = Bodies.rectangle(x, y, w, h, {
      render: {
        fillStyle: colors[Math.floor(Math.random() * colors.length)]
      },
      restitution: 0.4,
      friction: 0.1,
      frictionAir: Math.random() * 0.04 + 0.02,
      collisionFilter: {
        group: -2,
        mask: 0
      }
    });

    Body.setAngle(confetti, Math.random() * Math.PI);
    Body.setAngularVelocity(confetti, (Math.random() - 0.5) * 0.15);

    World.add(engine.world, confetti);

    setTimeout(() => {
      if (engine) {
        World.remove(engine.world, confetti);
      }
    }, 6000);
  }
}

function winGame() {
  if (gameState !== 'playing') return;
  gameState = 'won';
  stopTimer();
  playWinSound();
  
  // Show hint outline fully as puzzle is completed
  const hintImg = document.getElementById('hint-image');
  if (hintImg) hintImg.style.opacity = '1.0';

  // Spawn confetti particles
  spawnConfetti();
  
  // Transition to clear screen (Reduced delay to 1.3s for better responsiveness)
  setTimeout(() => {
    // Fill result details
    document.getElementById('final-time').textContent = formatTime(elapsedTime);
    
    const diffText = `${difficulty.cols} × ${difficulty.rows}`;
    let diffName = "Easy";
    if (difficulty.cols === 4) diffName = "Medium";
    if (difficulty.cols === 5) diffName = "Hard";
    if (difficulty.cols === 6) diffName = "Expert";
    document.getElementById('final-difficulty').textContent = `${diffName} (${diffText})`;
    
    document.getElementById('final-rotation').textContent = rotationEnabled ? '有効 (回転あり)' : '無効 (回転なし)';
    
    switchScreen('clear');
  }, 1300);
}