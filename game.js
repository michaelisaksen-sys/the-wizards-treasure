/**
 * The Wizard's Treasure - Skeleton Crypt Demo
 * A 3D first-person narrative-driven game built with Three.js
 */

// ============================================================================
// GAME CONFIGURATION
// ============================================================================

const CONFIG = {
    // Room dimensions
    ROOM_WIDTH: 20,
    ROOM_DEPTH: 20,
    ROOM_HEIGHT: 6,
    WALL_THICKNESS: 0.5,

    // Player settings
    PLAYER_HEIGHT: 1.7,
    PLAYER_SPEED: 5,
    PLAYER_MAX_HEALTH: 100,
    PLAYER_COLLISION_RADIUS: 0.4,

    // Combat settings
    ATTACK_COOLDOWN: 1.2, // seconds
    ATTACK_RANGE: 2.5,
    ATTACK_DAMAGE: 25,
    ATTACK_ANGLE: Math.PI / 3, // 60 degree cone

    // Skeleton settings
    SKELETON_HEALTH: 20,
    SKELETON_DAMAGE: 10,
    SKELETON_SPEED: 2,
    SKELETON_ATTACK_RANGE: 1.5,
    SKELETON_ATTACK_COOLDOWN: 1.5,
    TOTAL_SKELETONS: 20,
    SKELETONS_PER_WAVE: 5,
    SPAWN_DELAY: 0.5, // seconds between individual spawns

    // Visual settings
    FOG_NEAR: 5,
    FOG_FAR: 25,
    TORCH_COUNT: 8,

    // Mouse sensitivity
    MOUSE_SENSITIVITY: 0.002
};

// ============================================================================
// GAME STATE
// ============================================================================

const GameState = {
    // Game phases
    MENU: 'menu',
    PLAYING: 'playing',
    PAUSED: 'paused',
    VICTORY: 'victory',
    GAMEOVER: 'gameover'
};

let gameState = {
    phase: GameState.MENU,
    playerHealth: CONFIG.PLAYER_MAX_HEALTH,
    skeletonsRemaining: CONFIG.TOTAL_SKELETONS,
    skeletonsSpawned: 0,
    skeletonsAlive: 0,
    attackCooldown: 0,
    isAttacking: false,
    narrativeQueue: [],
    currentNarrative: null,
    narrativeTimer: 0
};

// ============================================================================
// THREE.JS CORE OBJECTS
// ============================================================================

let scene, camera, renderer;
let clock;

// Player objects
let playerBody;
let sword;
let swordPivot;

// Controls
let keys = {};
let mouseMovement = { x: 0, y: 0 };
let isPointerLocked = false;
let euler = new THREE.Euler(0, 0, 0, 'YXZ');

// Game objects
let skeletons = [];
let torches = [];
let dustParticles;
let exitDoor;
let entranceDoor;

// Collision objects
let walls = [];

// ============================================================================
// TEXTURE GENERATION (Hand-drawn aesthetic)
// ============================================================================

function createHandDrawnTexture(width, height, baseColor, lineColor, density = 0.1) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    // Base color with slight variation
    ctx.fillStyle = baseColor;
    ctx.fillRect(0, 0, width, height);

    // Add paper texture noise
    const imageData = ctx.getImageData(0, 0, width, height);
    for (let i = 0; i < imageData.data.length; i += 4) {
        const noise = (Math.random() - 0.5) * 30;
        imageData.data[i] += noise;
        imageData.data[i + 1] += noise;
        imageData.data[i + 2] += noise;
    }
    ctx.putImageData(imageData, 0, 0);

    // Draw sketchy lines
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 1;

    for (let i = 0; i < width * height * density; i++) {
        const x1 = Math.random() * width;
        const y1 = Math.random() * height;
        const length = Math.random() * 20 + 5;
        const angle = Math.random() * Math.PI * 2;

        ctx.globalAlpha = Math.random() * 0.3 + 0.1;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x1 + Math.cos(angle) * length, y1 + Math.sin(angle) * length);
        ctx.stroke();
    }

    ctx.globalAlpha = 1;

    return new THREE.CanvasTexture(canvas);
}

function createStoneTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    // Base stone color
    ctx.fillStyle = '#3a3530';
    ctx.fillRect(0, 0, 256, 256);

    // Draw stone blocks with sketchy lines
    ctx.strokeStyle = '#2a2520';
    ctx.lineWidth = 2;

    const blockHeight = 32;
    const blockWidth = 64;

    for (let y = 0; y < 256; y += blockHeight) {
        const offset = (Math.floor(y / blockHeight) % 2) * (blockWidth / 2);
        for (let x = -blockWidth; x < 256 + blockWidth; x += blockWidth) {
            // Draw block with hand-drawn effect
            ctx.beginPath();

            // Slightly irregular lines
            const wobble = () => (Math.random() - 0.5) * 3;

            ctx.moveTo(x + offset + wobble(), y + wobble());
            ctx.lineTo(x + offset + blockWidth + wobble(), y + wobble());
            ctx.lineTo(x + offset + blockWidth + wobble(), y + blockHeight + wobble());
            ctx.lineTo(x + offset + wobble(), y + blockHeight + wobble());
            ctx.closePath();
            ctx.stroke();

            // Add some texture inside blocks
            for (let i = 0; i < 5; i++) {
                ctx.globalAlpha = Math.random() * 0.2;
                const px = x + offset + Math.random() * blockWidth;
                const py = y + Math.random() * blockHeight;
                const len = Math.random() * 10 + 2;
                ctx.beginPath();
                ctx.moveTo(px, py);
                ctx.lineTo(px + len, py + (Math.random() - 0.5) * 4);
                ctx.stroke();
            }
        }
    }

    ctx.globalAlpha = 1;

    // Add noise
    const imageData = ctx.getImageData(0, 0, 256, 256);
    for (let i = 0; i < imageData.data.length; i += 4) {
        const noise = (Math.random() - 0.5) * 20;
        imageData.data[i] += noise;
        imageData.data[i + 1] += noise;
        imageData.data[i + 2] += noise;
    }
    ctx.putImageData(imageData, 0, 0);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    return texture;
}

function createFloorTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    // Darker stone floor
    ctx.fillStyle = '#2a2825';
    ctx.fillRect(0, 0, 256, 256);

    // Draw floor tiles
    ctx.strokeStyle = '#1a1815';
    ctx.lineWidth = 2;

    const tileSize = 64;

    for (let y = 0; y < 256; y += tileSize) {
        for (let x = 0; x < 256; x += tileSize) {
            // Sketchy tile outlines
            ctx.beginPath();
            const wobble = () => (Math.random() - 0.5) * 2;
            ctx.rect(x + wobble(), y + wobble(), tileSize + wobble(), tileSize + wobble());
            ctx.stroke();

            // Cracks and wear
            ctx.globalAlpha = 0.3;
            for (let i = 0; i < 3; i++) {
                ctx.beginPath();
                const cx = x + Math.random() * tileSize;
                const cy = y + Math.random() * tileSize;
                ctx.moveTo(cx, cy);
                for (let j = 0; j < 3; j++) {
                    ctx.lineTo(cx + (Math.random() - 0.5) * 20, cy + (Math.random() - 0.5) * 20);
                }
                ctx.stroke();
            }
            ctx.globalAlpha = 1;
        }
    }

    // Add noise
    const imageData = ctx.getImageData(0, 0, 256, 256);
    for (let i = 0; i < imageData.data.length; i += 4) {
        const noise = (Math.random() - 0.5) * 15;
        imageData.data[i] += noise;
        imageData.data[i + 1] += noise;
        imageData.data[i + 2] += noise;
    }
    ctx.putImageData(imageData, 0, 0);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    return texture;
}

// ============================================================================
// SCENE SETUP
// ============================================================================

function initScene() {
    // Create scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a08);
    scene.fog = new THREE.Fog(0x0a0a08, CONFIG.FOG_NEAR, CONFIG.FOG_FAR);

    // Create camera
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(0, CONFIG.PLAYER_HEIGHT, CONFIG.ROOM_DEPTH / 2 - 2);

    // Create renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.getElementById('game-container').appendChild(renderer.domElement);

    // Clock for delta time
    clock = new THREE.Clock();

    // Create player body (invisible, for reference)
    playerBody = new THREE.Object3D();
    playerBody.position.copy(camera.position);
    scene.add(playerBody);

    // Ambient light (very dim)
    const ambientLight = new THREE.AmbientLight(0x1a1510, 0.3);
    scene.add(ambientLight);

    // Build the crypt room
    buildCryptRoom();

    // Create sword
    createSword();

    // Create dust particles
    createDustParticles();

    // Handle window resize
    window.addEventListener('resize', onWindowResize);
}

function buildCryptRoom() {
    const stoneTexture = createStoneTexture();
    const floorTexture = createFloorTexture();

    // Wall material
    const wallMaterial = new THREE.MeshLambertMaterial({
        map: stoneTexture,
        side: THREE.DoubleSide
    });

    // Floor material
    const floorMaterial = new THREE.MeshLambertMaterial({
        map: floorTexture
    });

    const halfWidth = CONFIG.ROOM_WIDTH / 2;
    const halfDepth = CONFIG.ROOM_DEPTH / 2;

    // Floor
    const floorGeom = new THREE.PlaneGeometry(CONFIG.ROOM_WIDTH, CONFIG.ROOM_DEPTH);
    floorTexture.repeat.set(CONFIG.ROOM_WIDTH / 4, CONFIG.ROOM_DEPTH / 4);
    const floor = new THREE.Mesh(floorGeom, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // Ceiling
    const ceilingMaterial = new THREE.MeshLambertMaterial({
        map: stoneTexture,
        side: THREE.BackSide
    });
    stoneTexture.repeat.set(CONFIG.ROOM_WIDTH / 4, CONFIG.ROOM_DEPTH / 4);
    const ceiling = new THREE.Mesh(floorGeom.clone(), ceilingMaterial);
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.y = CONFIG.ROOM_HEIGHT;
    scene.add(ceiling);

    // Create walls
    createWall(-halfWidth, 0, halfDepth, halfWidth, false); // Back wall (entrance)
    createWall(-halfWidth, 0, -halfDepth, halfWidth, false); // Front wall (exit)
    createWall(-halfWidth, -halfDepth, 0, halfDepth, true);   // Left wall
    createWall(halfWidth, -halfDepth, 0, halfDepth, true);    // Right wall

    // Create entrance door (behind player)
    createEntranceDoor();

    // Create exit door (sealed, at far end)
    createExitDoor();

    // Add torches
    createTorches();

    // Add debris and atmospheric objects
    createDebris();

    // Add pillars for visual interest
    createPillars();
}

function createWall(x, startZ, z, length, isVertical) {
    const stoneTexture = createStoneTexture();
    stoneTexture.repeat.set(length / 2, CONFIG.ROOM_HEIGHT / 2);

    const wallMaterial = new THREE.MeshLambertMaterial({
        map: stoneTexture
    });

    let wallGeom, wallMesh;
    const halfWidth = CONFIG.ROOM_WIDTH / 2;
    const halfDepth = CONFIG.ROOM_DEPTH / 2;

    if (isVertical) {
        // Side walls (along Z axis)
        wallGeom = new THREE.BoxGeometry(CONFIG.WALL_THICKNESS, CONFIG.ROOM_HEIGHT, CONFIG.ROOM_DEPTH);
        wallMesh = new THREE.Mesh(wallGeom, wallMaterial);
        wallMesh.position.set(x, CONFIG.ROOM_HEIGHT / 2, 0);
    } else {
        // Front/back walls (along X axis)
        wallGeom = new THREE.BoxGeometry(CONFIG.ROOM_WIDTH, CONFIG.ROOM_HEIGHT, CONFIG.WALL_THICKNESS);
        wallMesh = new THREE.Mesh(wallGeom, wallMaterial);
        wallMesh.position.set(0, CONFIG.ROOM_HEIGHT / 2, z);
    }

    wallMesh.castShadow = true;
    wallMesh.receiveShadow = true;
    scene.add(wallMesh);

    // Store wall bounds for collision
    walls.push({
        mesh: wallMesh,
        bounds: new THREE.Box3().setFromObject(wallMesh)
    });
}

function createEntranceDoor() {
    const doorWidth = 2;
    const doorHeight = 3;

    // Door frame
    const frameGeom = new THREE.BoxGeometry(doorWidth + 0.4, doorHeight + 0.2, 0.6);
    const frameMaterial = new THREE.MeshLambertMaterial({ color: 0x2a2015 });
    const frame = new THREE.Mesh(frameGeom, frameMaterial);
    frame.position.set(0, doorHeight / 2, CONFIG.ROOM_DEPTH / 2 - 0.1);
    scene.add(frame);

    // Door itself (closed, wood texture)
    const doorGeom = new THREE.BoxGeometry(doorWidth, doorHeight, 0.2);
    const doorMaterial = new THREE.MeshLambertMaterial({ color: 0x3a2a1a });
    entranceDoor = new THREE.Mesh(doorGeom, doorMaterial);
    entranceDoor.position.set(0, doorHeight / 2, CONFIG.ROOM_DEPTH / 2 - 0.2);
    scene.add(entranceDoor);
}

function createExitDoor() {
    const doorWidth = 3;
    const doorHeight = 4;

    // Door frame (grand entrance)
    const frameGeom = new THREE.BoxGeometry(doorWidth + 0.6, doorHeight + 0.3, 0.8);
    const frameMaterial = new THREE.MeshLambertMaterial({ color: 0x1a1510 });
    const frame = new THREE.Mesh(frameGeom, frameMaterial);
    frame.position.set(0, doorHeight / 2, -CONFIG.ROOM_DEPTH / 2 + 0.2);
    scene.add(frame);

    // Sealed door with glowing runes (initially sealed)
    const doorGeom = new THREE.BoxGeometry(doorWidth, doorHeight, 0.3);
    const doorMaterial = new THREE.MeshLambertMaterial({
        color: 0x2a2520,
        emissive: 0x000000
    });
    exitDoor = new THREE.Mesh(doorGeom, doorMaterial);
    exitDoor.position.set(0, doorHeight / 2, -CONFIG.ROOM_DEPTH / 2 + 0.3);
    exitDoor.userData.isOpen = false;
    scene.add(exitDoor);

    // Mystical seal effect (circle on door)
    const sealGeom = new THREE.RingGeometry(0.8, 1, 32);
    const sealMaterial = new THREE.MeshBasicMaterial({
        color: 0x442222,
        transparent: true,
        opacity: 0.6,
        side: THREE.DoubleSide
    });
    const seal = new THREE.Mesh(sealGeom, sealMaterial);
    seal.position.set(0, doorHeight / 2, -CONFIG.ROOM_DEPTH / 2 + 0.45);
    seal.userData.seal = true;
    exitDoor.userData.seal = seal;
    scene.add(seal);
}

function createTorches() {
    const torchPositions = [
        { x: -CONFIG.ROOM_WIDTH / 2 + 0.5, z: CONFIG.ROOM_DEPTH / 4 },
        { x: CONFIG.ROOM_WIDTH / 2 - 0.5, z: CONFIG.ROOM_DEPTH / 4 },
        { x: -CONFIG.ROOM_WIDTH / 2 + 0.5, z: -CONFIG.ROOM_DEPTH / 4 },
        { x: CONFIG.ROOM_WIDTH / 2 - 0.5, z: -CONFIG.ROOM_DEPTH / 4 },
        { x: -CONFIG.ROOM_WIDTH / 4, z: -CONFIG.ROOM_DEPTH / 2 + 0.5 },
        { x: CONFIG.ROOM_WIDTH / 4, z: -CONFIG.ROOM_DEPTH / 2 + 0.5 },
        { x: -CONFIG.ROOM_WIDTH / 4, z: CONFIG.ROOM_DEPTH / 2 - 0.5 },
        { x: CONFIG.ROOM_WIDTH / 4, z: CONFIG.ROOM_DEPTH / 2 - 0.5 }
    ];

    torchPositions.forEach((pos, index) => {
        createTorch(pos.x, 3, pos.z);
    });
}

function createTorch(x, y, z) {
    // Torch holder
    const holderGeom = new THREE.CylinderGeometry(0.05, 0.08, 0.4, 8);
    const holderMaterial = new THREE.MeshLambertMaterial({ color: 0x3a2a1a });
    const holder = new THREE.Mesh(holderGeom, holderMaterial);
    holder.position.set(x, y, z);
    scene.add(holder);

    // Flame (simple cone)
    const flameGeom = new THREE.ConeGeometry(0.1, 0.3, 8);
    const flameMaterial = new THREE.MeshBasicMaterial({
        color: 0xff6600,
        transparent: true,
        opacity: 0.9
    });
    const flame = new THREE.Mesh(flameGeom, flameMaterial);
    flame.position.set(x, y + 0.35, z);
    scene.add(flame);

    // Point light
    const light = new THREE.PointLight(0xff6633, 1, 8);
    light.position.set(x, y + 0.3, z);
    light.castShadow = true;
    light.shadow.mapSize.width = 256;
    light.shadow.mapSize.height = 256;
    scene.add(light);

    torches.push({ holder, flame, light, baseIntensity: 1 });
}

function createDebris() {
    // Scattered bones
    for (let i = 0; i < 15; i++) {
        const boneGeom = new THREE.CylinderGeometry(0.03, 0.02, 0.3 + Math.random() * 0.3, 6);
        const boneMaterial = new THREE.MeshLambertMaterial({ color: 0xc4b8a0 });
        const bone = new THREE.Mesh(boneGeom, boneMaterial);

        bone.position.set(
            (Math.random() - 0.5) * (CONFIG.ROOM_WIDTH - 2),
            0.05,
            (Math.random() - 0.5) * (CONFIG.ROOM_DEPTH - 2)
        );
        bone.rotation.z = Math.random() * Math.PI;
        bone.rotation.y = Math.random() * Math.PI * 2;
        scene.add(bone);
    }

    // Skulls
    for (let i = 0; i < 5; i++) {
        const skullGroup = new THREE.Group();

        // Cranium
        const craniumGeom = new THREE.SphereGeometry(0.12, 8, 6);
        const skullMaterial = new THREE.MeshLambertMaterial({ color: 0xd4c8b0 });
        const cranium = new THREE.Mesh(craniumGeom, skullMaterial);
        cranium.scale.set(1, 0.9, 1.1);
        skullGroup.add(cranium);

        // Jaw
        const jawGeom = new THREE.BoxGeometry(0.1, 0.05, 0.08);
        const jaw = new THREE.Mesh(jawGeom, skullMaterial);
        jaw.position.set(0, -0.08, 0.05);
        skullGroup.add(jaw);

        skullGroup.position.set(
            (Math.random() - 0.5) * (CONFIG.ROOM_WIDTH - 3),
            0.1,
            (Math.random() - 0.5) * (CONFIG.ROOM_DEPTH - 3)
        );
        skullGroup.rotation.y = Math.random() * Math.PI * 2;
        scene.add(skullGroup);
    }

    // Crates
    for (let i = 0; i < 3; i++) {
        const crateSize = 0.5 + Math.random() * 0.3;
        const crateGeom = new THREE.BoxGeometry(crateSize, crateSize, crateSize);
        const crateMaterial = new THREE.MeshLambertMaterial({ color: 0x4a3a2a });
        const crate = new THREE.Mesh(crateGeom, crateMaterial);

        // Position crates along walls
        const side = Math.floor(Math.random() * 4);
        switch(side) {
            case 0: // Left
                crate.position.set(-CONFIG.ROOM_WIDTH / 2 + 1, crateSize / 2, (Math.random() - 0.5) * CONFIG.ROOM_DEPTH * 0.6);
                break;
            case 1: // Right
                crate.position.set(CONFIG.ROOM_WIDTH / 2 - 1, crateSize / 2, (Math.random() - 0.5) * CONFIG.ROOM_DEPTH * 0.6);
                break;
            case 2: // Back
                crate.position.set((Math.random() - 0.5) * CONFIG.ROOM_WIDTH * 0.6, crateSize / 2, CONFIG.ROOM_DEPTH / 2 - 1.5);
                break;
            case 3: // Front (near exit)
                crate.position.set((Math.random() - 0.5) * CONFIG.ROOM_WIDTH * 0.6, crateSize / 2, -CONFIG.ROOM_DEPTH / 2 + 2);
                break;
        }

        crate.rotation.y = Math.random() * 0.5 - 0.25;
        crate.castShadow = true;
        crate.receiveShadow = true;
        scene.add(crate);
    }
}

function createPillars() {
    const pillarPositions = [
        { x: -CONFIG.ROOM_WIDTH / 3, z: 0 },
        { x: CONFIG.ROOM_WIDTH / 3, z: 0 }
    ];

    pillarPositions.forEach(pos => {
        const pillarGeom = new THREE.CylinderGeometry(0.4, 0.5, CONFIG.ROOM_HEIGHT, 8);
        const pillarMaterial = new THREE.MeshLambertMaterial({ color: 0x3a3530 });
        const pillar = new THREE.Mesh(pillarGeom, pillarMaterial);
        pillar.position.set(pos.x, CONFIG.ROOM_HEIGHT / 2, pos.z);
        pillar.castShadow = true;
        pillar.receiveShadow = true;
        scene.add(pillar);

        // Add to collision
        walls.push({
            mesh: pillar,
            bounds: new THREE.Box3().setFromObject(pillar)
        });
    });
}

function createDustParticles() {
    const particleCount = 200;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount * 3; i += 3) {
        positions[i] = (Math.random() - 0.5) * CONFIG.ROOM_WIDTH;
        positions[i + 1] = Math.random() * CONFIG.ROOM_HEIGHT;
        positions[i + 2] = (Math.random() - 0.5) * CONFIG.ROOM_DEPTH;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({
        color: 0x888877,
        size: 0.05,
        transparent: true,
        opacity: 0.4
    });

    dustParticles = new THREE.Points(geometry, material);
    scene.add(dustParticles);
}

// ============================================================================
// SWORD CREATION
// ============================================================================

function createSword() {
    swordPivot = new THREE.Group();

    // Sword group
    sword = new THREE.Group();

    // Blade
    const bladeGeom = new THREE.BoxGeometry(0.06, 0.8, 0.02);
    const bladeMaterial = new THREE.MeshLambertMaterial({
        color: 0x9999aa,
        emissive: 0x222233
    });
    const blade = new THREE.Mesh(bladeGeom, bladeMaterial);
    blade.position.y = 0.4;
    sword.add(blade);

    // Blade tip
    const tipGeom = new THREE.ConeGeometry(0.03, 0.15, 4);
    tipGeom.rotateZ(Math.PI);
    const tip = new THREE.Mesh(tipGeom, bladeMaterial);
    tip.position.y = 0.87;
    sword.add(tip);

    // Cross-guard
    const guardGeom = new THREE.BoxGeometry(0.2, 0.04, 0.04);
    const guardMaterial = new THREE.MeshLambertMaterial({ color: 0x8b7355 });
    const guard = new THREE.Mesh(guardGeom, guardMaterial);
    guard.position.y = 0.02;
    sword.add(guard);

    // Handle
    const handleGeom = new THREE.CylinderGeometry(0.025, 0.03, 0.2, 8);
    const handleMaterial = new THREE.MeshLambertMaterial({ color: 0x4a3a2a });
    const handle = new THREE.Mesh(handleGeom, handleMaterial);
    handle.position.y = -0.1;
    sword.add(handle);

    // Pommel
    const pommelGeom = new THREE.SphereGeometry(0.04, 8, 6);
    const pommel = new THREE.Mesh(pommelGeom, guardMaterial);
    pommel.position.y = -0.22;
    sword.add(pommel);

    // Hand (simplified)
    const handGeom = new THREE.BoxGeometry(0.1, 0.08, 0.15);
    const handMaterial = new THREE.MeshLambertMaterial({ color: 0x7a6a5a });
    const hand = new THREE.Mesh(handGeom, handMaterial);
    hand.position.set(0, -0.05, 0.06);
    sword.add(hand);

    // Arm portion
    const armGeom = new THREE.BoxGeometry(0.08, 0.3, 0.1);
    const arm = new THREE.Mesh(armGeom, handMaterial);
    arm.position.set(0, -0.2, 0.1);
    arm.rotation.x = 0.3;
    sword.add(arm);

    // Position sword in view
    sword.position.set(0.3, -0.3, -0.5);
    sword.rotation.set(0, -0.3, 0.1);

    swordPivot.add(sword);
    camera.add(swordPivot);
    scene.add(camera);
}

// ============================================================================
// SKELETON CREATION
// ============================================================================

function createSkeleton(x, z) {
    const skeleton = new THREE.Group();
    skeleton.userData = {
        health: CONFIG.SKELETON_HEALTH,
        isAlive: true,
        attackCooldown: 0,
        state: 'idle',
        targetPosition: new THREE.Vector3()
    };

    const boneMaterial = new THREE.MeshLambertMaterial({ color: 0xc4b8a0 });
    const darkBoneMaterial = new THREE.MeshLambertMaterial({ color: 0xa49880 });

    // Pelvis
    const pelvisGeom = new THREE.BoxGeometry(0.4, 0.15, 0.2);
    const pelvis = new THREE.Mesh(pelvisGeom, boneMaterial);
    pelvis.position.y = 0.9;
    skeleton.add(pelvis);

    // Spine
    for (let i = 0; i < 4; i++) {
        const vertebraGeom = new THREE.CylinderGeometry(0.06, 0.07, 0.12, 6);
        const vertebra = new THREE.Mesh(vertebraGeom, boneMaterial);
        vertebra.position.y = 1.05 + i * 0.12;
        skeleton.add(vertebra);
    }

    // Ribcage (simplified)
    const ribcageGeom = new THREE.BoxGeometry(0.35, 0.35, 0.2);
    const ribcage = new THREE.Mesh(ribcageGeom, darkBoneMaterial);
    ribcage.position.y = 1.35;
    skeleton.add(ribcage);

    // Skull
    const skullGeom = new THREE.SphereGeometry(0.15, 8, 6);
    const skull = new THREE.Mesh(skullGeom, boneMaterial);
    skull.scale.set(1, 1.1, 1.2);
    skull.position.y = 1.7;
    skeleton.add(skull);

    // Eye sockets (glowing)
    const eyeMaterial = new THREE.MeshBasicMaterial({ color: 0xff3300 });
    const eyeGeom = new THREE.SphereGeometry(0.03, 6, 6);

    const leftEye = new THREE.Mesh(eyeGeom, eyeMaterial);
    leftEye.position.set(-0.05, 1.72, 0.12);
    skeleton.add(leftEye);

    const rightEye = new THREE.Mesh(eyeGeom, eyeMaterial);
    rightEye.position.set(0.05, 1.72, 0.12);
    skeleton.add(rightEye);

    // Jaw
    const jawGeom = new THREE.BoxGeometry(0.12, 0.05, 0.1);
    const jaw = new THREE.Mesh(jawGeom, boneMaterial);
    jaw.position.set(0, 1.58, 0.08);
    skeleton.add(jaw);

    // Arms
    [-1, 1].forEach(side => {
        // Upper arm
        const upperArmGeom = new THREE.CylinderGeometry(0.03, 0.04, 0.35, 6);
        const upperArm = new THREE.Mesh(upperArmGeom, boneMaterial);
        upperArm.position.set(side * 0.25, 1.35, 0);
        upperArm.rotation.z = side * 0.3;
        skeleton.add(upperArm);

        // Lower arm
        const lowerArmGeom = new THREE.CylinderGeometry(0.025, 0.03, 0.3, 6);
        const lowerArm = new THREE.Mesh(lowerArmGeom, boneMaterial);
        lowerArm.position.set(side * 0.35, 1.1, 0.1);
        lowerArm.rotation.x = 0.5;
        lowerArm.rotation.z = side * 0.2;
        skeleton.add(lowerArm);

        // Claw-like hand
        const handGeom = new THREE.ConeGeometry(0.04, 0.1, 4);
        const hand = new THREE.Mesh(handGeom, darkBoneMaterial);
        hand.position.set(side * 0.4, 0.9, 0.2);
        hand.rotation.x = Math.PI / 2;
        skeleton.add(hand);
    });

    // Legs
    [-1, 1].forEach(side => {
        // Thigh
        const thighGeom = new THREE.CylinderGeometry(0.04, 0.05, 0.4, 6);
        const thigh = new THREE.Mesh(thighGeom, boneMaterial);
        thigh.position.set(side * 0.12, 0.65, 0);
        skeleton.add(thigh);

        // Shin
        const shinGeom = new THREE.CylinderGeometry(0.03, 0.04, 0.4, 6);
        const shin = new THREE.Mesh(shinGeom, boneMaterial);
        shin.position.set(side * 0.12, 0.25, 0);
        skeleton.add(shin);

        // Foot
        const footGeom = new THREE.BoxGeometry(0.08, 0.05, 0.15);
        const foot = new THREE.Mesh(footGeom, darkBoneMaterial);
        foot.position.set(side * 0.12, 0.025, 0.03);
        skeleton.add(foot);
    });

    skeleton.position.set(x, 0, z);
    skeleton.castShadow = true;

    // Add point light for glowing eyes
    const eyeLight = new THREE.PointLight(0xff3300, 0.3, 2);
    eyeLight.position.set(0, 1.7, 0.15);
    skeleton.add(eyeLight);

    scene.add(skeleton);
    skeletons.push(skeleton);

    return skeleton;
}

function spawnSkeletonWave() {
    const toSpawn = Math.min(CONFIG.SKELETONS_PER_WAVE, CONFIG.TOTAL_SKELETONS - gameState.skeletonsSpawned);

    for (let i = 0; i < toSpawn; i++) {
        setTimeout(() => {
            if (gameState.phase !== GameState.PLAYING) return;

            // Spawn positions around the room edges, away from player
            const angle = Math.random() * Math.PI * 2;
            const distance = Math.random() * 3 + 5;
            let x = Math.cos(angle) * distance;
            let z = Math.sin(angle) * distance;

            // Clamp to room bounds
            x = Math.max(-CONFIG.ROOM_WIDTH / 2 + 2, Math.min(CONFIG.ROOM_WIDTH / 2 - 2, x));
            z = Math.max(-CONFIG.ROOM_DEPTH / 2 + 2, Math.min(CONFIG.ROOM_DEPTH / 2 - 2, z));

            // Avoid spawning too close to player
            const playerDist = Math.sqrt(
                Math.pow(x - camera.position.x, 2) +
                Math.pow(z - camera.position.z, 2)
            );
            if (playerDist < 4) {
                x = -x;
                z = -z;
            }

            createSkeleton(x, z);
            gameState.skeletonsSpawned++;
            gameState.skeletonsAlive++;

        }, i * CONFIG.SPAWN_DELAY * 1000);
    }
}

// ============================================================================
// PLAYER CONTROLS
// ============================================================================

function initControls() {
    // Keyboard
    document.addEventListener('keydown', (e) => {
        keys[e.code] = true;

        if (e.code === 'Escape') {
            togglePause();
        }
        if (e.code === 'KeyR' && (gameState.phase === GameState.VICTORY || gameState.phase === GameState.GAMEOVER)) {
            restartGame();
        }
    });

    document.addEventListener('keyup', (e) => {
        keys[e.code] = false;
    });

    // Mouse look
    document.addEventListener('mousemove', (e) => {
        if (!isPointerLocked || gameState.phase !== GameState.PLAYING) return;

        mouseMovement.x = e.movementX || 0;
        mouseMovement.y = e.movementY || 0;

        euler.setFromQuaternion(camera.quaternion);
        euler.y -= mouseMovement.x * CONFIG.MOUSE_SENSITIVITY;
        euler.x -= mouseMovement.y * CONFIG.MOUSE_SENSITIVITY;
        euler.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, euler.x));
        camera.quaternion.setFromEuler(euler);
    });

    // Attack
    document.addEventListener('mousedown', (e) => {
        if (e.button === 0 && gameState.phase === GameState.PLAYING && isPointerLocked) {
            attack();
        }
    });

    // Pointer lock
    document.addEventListener('pointerlockchange', () => {
        isPointerLocked = document.pointerLockElement === renderer.domElement;
    });
}

function requestPointerLock() {
    renderer.domElement.requestPointerLock();
}

function updatePlayer(delta) {
    if (gameState.phase !== GameState.PLAYING) return;

    // Movement
    const moveSpeed = CONFIG.PLAYER_SPEED * delta;
    const forward = new THREE.Vector3();
    const right = new THREE.Vector3();

    camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();

    right.crossVectors(forward, new THREE.Vector3(0, 1, 0));

    const movement = new THREE.Vector3();

    if (keys['KeyW']) movement.add(forward);
    if (keys['KeyS']) movement.sub(forward);
    if (keys['KeyA']) movement.sub(right);
    if (keys['KeyD']) movement.add(right);

    if (movement.length() > 0) {
        movement.normalize().multiplyScalar(moveSpeed);

        // Calculate new position
        const newPos = camera.position.clone().add(movement);

        // Check wall collisions
        if (!checkWallCollision(newPos)) {
            camera.position.copy(newPos);
        }

        // Keep within room bounds
        const halfWidth = CONFIG.ROOM_WIDTH / 2 - CONFIG.PLAYER_COLLISION_RADIUS;
        const halfDepth = CONFIG.ROOM_DEPTH / 2 - CONFIG.PLAYER_COLLISION_RADIUS;
        camera.position.x = Math.max(-halfWidth, Math.min(halfWidth, camera.position.x));
        camera.position.z = Math.max(-halfDepth, Math.min(halfDepth, camera.position.z));
    }

    // Update attack cooldown
    if (gameState.attackCooldown > 0) {
        gameState.attackCooldown -= delta;
        updateAttackIndicator();
    }

    // Update sword animation
    updateSwordAnimation(delta);
}

function checkWallCollision(position) {
    const playerBounds = new THREE.Sphere(position, CONFIG.PLAYER_COLLISION_RADIUS);

    for (const wall of walls) {
        if (wall.bounds.intersectsSphere(playerBounds)) {
            return true;
        }
    }
    return false;
}

// ============================================================================
// COMBAT SYSTEM
// ============================================================================

function attack() {
    if (gameState.attackCooldown > 0 || gameState.isAttacking) return;

    gameState.isAttacking = true;
    gameState.attackCooldown = CONFIG.ATTACK_COOLDOWN;

    // Sword swing animation
    animateSwordSwing();

    // Check for hits after a short delay (mid-swing)
    setTimeout(() => {
        const cameraDirection = new THREE.Vector3();
        camera.getWorldDirection(cameraDirection);

        skeletons.forEach(skeleton => {
            if (!skeleton.userData.isAlive) return;

            const toSkeleton = new THREE.Vector3();
            toSkeleton.subVectors(skeleton.position, camera.position);
            toSkeleton.y = 0;

            const distance = toSkeleton.length();
            toSkeleton.normalize();

            // Check if skeleton is in front and in range
            const angle = Math.acos(cameraDirection.dot(toSkeleton));

            if (distance < CONFIG.ATTACK_RANGE && angle < CONFIG.ATTACK_ANGLE / 2) {
                damageSkeleton(skeleton, CONFIG.ATTACK_DAMAGE);
            }
        });
    }, 200);

    // Reset attack state
    setTimeout(() => {
        gameState.isAttacking = false;
    }, 400);
}

function animateSwordSwing() {
    const startRotation = sword.rotation.z;
    const swingAmount = -1.5;
    const duration = 300;
    const startTime = Date.now();

    function animate() {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Swing arc
        if (progress < 0.5) {
            sword.rotation.z = startRotation + swingAmount * (progress * 2);
            sword.position.x = 0.3 - 0.2 * (progress * 2);
        } else {
            sword.rotation.z = startRotation + swingAmount * (1 - (progress - 0.5) * 2);
            sword.position.x = 0.1 + 0.2 * ((progress - 0.5) * 2);
        }

        if (progress < 1) {
            requestAnimationFrame(animate);
        } else {
            sword.rotation.z = startRotation;
            sword.position.x = 0.3;
        }
    }

    animate();
}

function updateSwordAnimation(delta) {
    // Idle bob animation
    if (!gameState.isAttacking) {
        const time = Date.now() * 0.001;
        sword.position.y = -0.3 + Math.sin(time * 2) * 0.02;
        sword.rotation.x = Math.sin(time * 1.5) * 0.03;
    }
}

function damageSkeleton(skeleton, damage) {
    skeleton.userData.health -= damage;

    // Flash effect
    skeleton.traverse(child => {
        if (child.isMesh && child.material) {
            const originalColor = child.material.color.clone();
            child.material.color.setHex(0xff0000);
            setTimeout(() => {
                child.material.color.copy(originalColor);
            }, 100);
        }
    });

    if (skeleton.userData.health <= 0) {
        killSkeleton(skeleton);
    }
}

function killSkeleton(skeleton) {
    skeleton.userData.isAlive = false;
    gameState.skeletonsAlive--;
    gameState.skeletonsRemaining--;

    updateKillCounter();

    // Death animation - collapse
    const startTime = Date.now();
    const duration = 800;

    function animateDeath() {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);

        skeleton.scale.y = 1 - progress * 0.8;
        skeleton.position.y = -progress * 0.5;

        skeleton.traverse(child => {
            if (child.isMesh && child.material) {
                child.material.transparent = true;
                child.material.opacity = 1 - progress;
            }
        });

        if (progress < 1) {
            requestAnimationFrame(animateDeath);
        } else {
            scene.remove(skeleton);
            const index = skeletons.indexOf(skeleton);
            if (index > -1) {
                skeletons.splice(index, 1);
            }
        }
    }

    animateDeath();

    // Check for victory
    if (gameState.skeletonsRemaining <= 0) {
        victory();
    } else if (gameState.skeletonsAlive < CONFIG.SKELETONS_PER_WAVE / 2 &&
               gameState.skeletonsSpawned < CONFIG.TOTAL_SKELETONS) {
        // Spawn next wave when current wave is nearly cleared
        spawnSkeletonWave();
    }
}

function damagePlayer(damage) {
    gameState.playerHealth -= damage;
    updateHealthBar();

    // Damage flash
    const overlay = document.getElementById('damage-overlay');
    overlay.classList.add('flash');
    setTimeout(() => overlay.classList.remove('flash'), 200);

    if (gameState.playerHealth <= 0) {
        gameOver();
    }
}

// ============================================================================
// SKELETON AI
// ============================================================================

function updateSkeletons(delta) {
    skeletons.forEach(skeleton => {
        if (!skeleton.userData.isAlive) return;

        const toPlayer = new THREE.Vector3();
        toPlayer.subVectors(camera.position, skeleton.position);
        toPlayer.y = 0;
        const distance = toPlayer.length();

        // Face player
        skeleton.lookAt(camera.position.x, skeleton.position.y, camera.position.z);

        // Update attack cooldown
        if (skeleton.userData.attackCooldown > 0) {
            skeleton.userData.attackCooldown -= delta;
        }

        // Movement and attack logic
        if (distance > CONFIG.SKELETON_ATTACK_RANGE) {
            // Move toward player
            toPlayer.normalize();
            const moveDistance = CONFIG.SKELETON_SPEED * delta;

            const newPos = skeleton.position.clone();
            newPos.x += toPlayer.x * moveDistance;
            newPos.z += toPlayer.z * moveDistance;

            // Simple avoidance of other skeletons
            let canMove = true;
            skeletons.forEach(other => {
                if (other === skeleton || !other.userData.isAlive) return;
                const dist = newPos.distanceTo(other.position);
                if (dist < 0.8) canMove = false;
            });

            if (canMove) {
                skeleton.position.copy(newPos);
            }

            // Bobbing animation while moving
            skeleton.position.y = Math.sin(Date.now() * 0.01) * 0.05;

        } else if (skeleton.userData.attackCooldown <= 0) {
            // Attack player
            damagePlayer(CONFIG.SKELETON_DAMAGE);
            skeleton.userData.attackCooldown = CONFIG.SKELETON_ATTACK_COOLDOWN;

            // Attack lunge animation
            const lungeDir = toPlayer.normalize().multiplyScalar(0.2);
            skeleton.position.add(lungeDir);
            setTimeout(() => {
                skeleton.position.sub(lungeDir);
            }, 100);
        }

        // Arm animation
        const armWave = Math.sin(Date.now() * 0.005) * 0.2;
        skeleton.children.forEach(child => {
            if (child.position.x > 0.3 || child.position.x < -0.3) {
                child.rotation.x = armWave;
            }
        });
    });
}

// ============================================================================
// UI UPDATES
// ============================================================================

function updateHealthBar() {
    const healthBar = document.getElementById('health-bar');
    const healthText = document.getElementById('health-text');
    const healthPercent = Math.max(0, gameState.playerHealth / CONFIG.PLAYER_MAX_HEALTH * 100);

    healthBar.style.width = healthPercent + '%';
    healthText.textContent = Math.max(0, Math.floor(gameState.playerHealth)) + '/' + CONFIG.PLAYER_MAX_HEALTH;

    // Color change based on health
    if (healthPercent > 50) {
        healthBar.style.background = 'linear-gradient(to bottom, #8b0000 0%, #5c0000 50%, #8b0000 100%)';
    } else if (healthPercent > 25) {
        healthBar.style.background = 'linear-gradient(to bottom, #8b4400 0%, #5c2200 50%, #8b4400 100%)';
    } else {
        healthBar.style.background = 'linear-gradient(to bottom, #aa0000 0%, #770000 50%, #aa0000 100%)';
    }
}

function updateKillCounter() {
    const killText = document.getElementById('kill-text');
    killText.textContent = `Skeletons remaining: ${gameState.skeletonsRemaining}/${CONFIG.TOTAL_SKELETONS}`;
}

function updateAttackIndicator() {
    const cooldownBar = document.getElementById('attack-cooldown');
    const percent = Math.max(0, 1 - gameState.attackCooldown / CONFIG.ATTACK_COOLDOWN) * 100;
    cooldownBar.style.width = percent + '%';
}

function showNarrative(text, duration = 5000) {
    const container = document.getElementById('narrative-container');
    const textEl = document.getElementById('narrative-text');

    textEl.textContent = text;
    container.classList.add('visible');

    setTimeout(() => {
        container.classList.remove('visible');
    }, duration);
}

// ============================================================================
// GAME STATE MANAGEMENT
// ============================================================================

function startGame() {
    gameState.phase = GameState.PLAYING;
    document.getElementById('start-screen').classList.add('hidden');

    requestPointerLock();

    // Initial narrative
    setTimeout(() => {
        showNarrative("The ancient door groans shut behind you. There is no turning back.", 4000);
    }, 1000);

    setTimeout(() => {
        showNarrative("A chill runs down your spine as bones begin to rattle in the darkness...", 4000);
    }, 6000);

    // Spawn first wave after narrative
    setTimeout(() => {
        spawnSkeletonWave();
    }, 8000);
}

function togglePause() {
    if (gameState.phase === GameState.PLAYING) {
        gameState.phase = GameState.PAUSED;
        document.getElementById('pause-menu').classList.remove('hidden');
        document.exitPointerLock();
    } else if (gameState.phase === GameState.PAUSED) {
        resumeGame();
    }
}

function resumeGame() {
    gameState.phase = GameState.PLAYING;
    document.getElementById('pause-menu').classList.add('hidden');
    requestPointerLock();
}

function victory() {
    gameState.phase = GameState.VICTORY;
    document.getElementById('victory-screen').classList.remove('hidden');
    document.exitPointerLock();

    // Open the exit door with effect
    openExitDoor();
}

function openExitDoor() {
    // Remove seal
    if (exitDoor.userData.seal) {
        scene.remove(exitDoor.userData.seal);
    }

    // Glow effect
    exitDoor.material.emissive.setHex(0x224422);

    // Add light from doorway
    const doorLight = new THREE.PointLight(0x44aa44, 2, 10);
    doorLight.position.set(0, 2, -CONFIG.ROOM_DEPTH / 2);
    scene.add(doorLight);

    // Animate door opening
    const startTime = Date.now();
    const duration = 2000;

    function animateOpen() {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);

        exitDoor.position.x = -progress * 1.5;
        exitDoor.rotation.y = progress * Math.PI / 3;

        if (progress < 1) {
            requestAnimationFrame(animateOpen);
        }
    }

    animateOpen();
}

function gameOver() {
    gameState.phase = GameState.GAMEOVER;
    document.getElementById('gameover-screen').classList.remove('hidden');
    document.exitPointerLock();
}

function restartGame() {
    // Remove all skeletons
    skeletons.forEach(skeleton => {
        scene.remove(skeleton);
    });
    skeletons = [];

    // Reset state
    gameState = {
        phase: GameState.MENU,
        playerHealth: CONFIG.PLAYER_MAX_HEALTH,
        skeletonsRemaining: CONFIG.TOTAL_SKELETONS,
        skeletonsSpawned: 0,
        skeletonsAlive: 0,
        attackCooldown: 0,
        isAttacking: false,
        narrativeQueue: [],
        currentNarrative: null,
        narrativeTimer: 0
    };

    // Reset player position
    camera.position.set(0, CONFIG.PLAYER_HEIGHT, CONFIG.ROOM_DEPTH / 2 - 2);
    euler.set(0, 0, 0);
    camera.quaternion.setFromEuler(euler);

    // Reset UI
    updateHealthBar();
    updateKillCounter();

    // Hide screens
    document.getElementById('victory-screen').classList.add('hidden');
    document.getElementById('gameover-screen').classList.add('hidden');
    document.getElementById('pause-menu').classList.add('hidden');
    document.getElementById('start-screen').classList.remove('hidden');

    // Reset exit door
    if (exitDoor) {
        exitDoor.position.x = 0;
        exitDoor.rotation.y = 0;
        exitDoor.material.emissive.setHex(0x000000);
    }
}

// ============================================================================
// VISUAL EFFECTS
// ============================================================================

function updateVisualEffects(delta) {
    // Torch flicker
    torches.forEach(torch => {
        const flicker = 0.8 + Math.random() * 0.4;
        torch.light.intensity = torch.baseIntensity * flicker;
        torch.flame.scale.set(flicker, 0.8 + Math.random() * 0.4, flicker);
    });

    // Dust particle movement
    if (dustParticles) {
        const positions = dustParticles.geometry.attributes.position.array;
        for (let i = 0; i < positions.length; i += 3) {
            positions[i + 1] += Math.sin(Date.now() * 0.001 + i) * 0.001;
            if (positions[i + 1] > CONFIG.ROOM_HEIGHT) {
                positions[i + 1] = 0;
            }
        }
        dustParticles.geometry.attributes.position.needsUpdate = true;
    }
}

// ============================================================================
// MAIN GAME LOOP
// ============================================================================

function animate() {
    requestAnimationFrame(animate);

    const delta = clock.getDelta();

    if (gameState.phase === GameState.PLAYING) {
        updatePlayer(delta);
        updateSkeletons(delta);
        updateVisualEffects(delta);
    }

    renderer.render(scene, camera);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// ============================================================================
// INITIALIZATION
// ============================================================================

function init() {
    initScene();
    initControls();

    // UI Button events
    document.getElementById('start-button').addEventListener('click', startGame);
    document.getElementById('resume-button').addEventListener('click', resumeGame);
    document.getElementById('restart-button').addEventListener('click', restartGame);
    document.getElementById('victory-restart').addEventListener('click', restartGame);
    document.getElementById('gameover-restart').addEventListener('click', restartGame);

    // Start animation loop
    animate();
}

// Start the game when page loads
window.addEventListener('load', init);
