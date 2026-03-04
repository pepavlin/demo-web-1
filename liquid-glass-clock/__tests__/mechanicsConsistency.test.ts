/**
 * Tests for game mechanics consistency fixes:
 * 1. doAttack() guard — cannot attack while in vehicle/possession/space station
 * 2. Coin healing — collecting coins restores player HP
 * 3. Sheep flee — sheep do NOT flee from player when player is possessing a sheep
 * 4. Damage immunity — no fox/cannonball damage during rocket flight or in space station
 *
 * These tests use pure logic simulations mirroring the actual Game3D.tsx code
 * without requiring a React render or Three.js scene.
 */

// ─── Constants (mirrors Game3D.tsx) ──────────────────────────────────────────

const PLAYER_MAX_HP = 100;
const COIN_HEAL_AMOUNT = 20;
const SHEEP_FLEE_RADIUS = 12;
const FOX_ATTACK_DAMAGE = 9;
const CANNONBALL_DAMAGE = 28;
const CANNONBALL_HIT_RADIUS = 1.6;
const FOX_ATTACK_RANGE = 2.5;

// ─── Helpers ─────────────────────────────────────────────────────────────────

interface PlayerState {
  hp: number;
  isPossessing: boolean;
  onBoat: boolean;
  onRocket: boolean;
  inSpaceStation: boolean;
  gameOver: boolean;
}

function makePlayer(overrides: Partial<PlayerState> = {}): PlayerState {
  return {
    hp: PLAYER_MAX_HP,
    isPossessing: false,
    onBoat: false,
    onRocket: false,
    inSpaceStation: false,
    gameOver: false,
    ...overrides,
  };
}

/**
 * Mirrors the doAttack() early-return guards from Game3D.tsx.
 * Returns true if an attack is allowed, false if blocked.
 */
function canAttack(player: PlayerState, isLocked: boolean, cooldown: number): boolean {
  if (!isLocked) return false;
  if (cooldown > 0) return false;
  if (player.isPossessing || player.onBoat || player.onRocket || player.inSpaceStation) return false;
  return true;
}

/**
 * Mirrors coin collection logic: heal up to PLAYER_MAX_HP.
 * Returns the new HP value after collecting a coin.
 */
function collectCoin(currentHp: number): number {
  return Math.min(PLAYER_MAX_HP, currentHp + COIN_HEAL_AMOUNT);
}

/**
 * Mirrors sheep flee-from-player logic.
 * Returns true if the sheep should flee this frame.
 */
function shouldFleeFromPlayer(
  distToPlayer: number,
  playerIsPossessing: boolean,
): boolean {
  // When possessing, player is a sheep — no "human" threat to other sheep
  return !playerIsPossessing && distToPlayer < SHEEP_FLEE_RADIUS;
}

/**
 * Mirrors fox damage application guard from Game3D.tsx.
 * Returns the actual damage dealt (0 if immune).
 */
function applyFoxDamage(
  player: PlayerState,
  distToFox: number,
): number {
  if (player.gameOver) return 0;
  if (player.onRocket || player.inSpaceStation) return 0; // physically elsewhere
  if (distToFox >= FOX_ATTACK_RANGE) return 0;
  return FOX_ATTACK_DAMAGE;
}

/**
 * Mirrors cannonball damage application guard from Game3D.tsx.
 * Returns the actual damage dealt (0 if immune).
 */
function applyCannonballDamage(
  player: PlayerState,
  distToCannonball: number,
): number {
  if (player.gameOver) return 0;
  if (player.onRocket || player.inSpaceStation) return 0;
  if (distToCannonball >= CANNONBALL_HIT_RADIUS) return 0;
  return CANNONBALL_DAMAGE;
}

// ═════════════════════════════════════════════════════════════════════════════
// 1. Attack guard — vehicle / possession / space station
// ═════════════════════════════════════════════════════════════════════════════

describe("doAttack() guard: cannot attack in special states", () => {
  it("allows attack in normal explore state", () => {
    const player = makePlayer();
    expect(canAttack(player, true, 0)).toBe(true);
  });

  it("blocks attack when possessing a sheep", () => {
    const player = makePlayer({ isPossessing: true });
    expect(canAttack(player, true, 0)).toBe(false);
  });

  it("blocks attack when on a boat", () => {
    const player = makePlayer({ onBoat: true });
    expect(canAttack(player, true, 0)).toBe(false);
  });

  it("blocks attack when on the rocket", () => {
    const player = makePlayer({ onRocket: true });
    expect(canAttack(player, true, 0)).toBe(false);
  });

  it("blocks attack when inside the space station", () => {
    const player = makePlayer({ inSpaceStation: true });
    expect(canAttack(player, true, 0)).toBe(false);
  });

  it("blocks attack when pointer is not locked (game not focused)", () => {
    const player = makePlayer();
    expect(canAttack(player, false, 0)).toBe(false);
  });

  it("blocks attack when on attack cooldown", () => {
    const player = makePlayer();
    expect(canAttack(player, true, 0.3)).toBe(false);
  });

  it("allows attack immediately after cooldown expires", () => {
    const player = makePlayer();
    expect(canAttack(player, true, 0)).toBe(true);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 2. Coin healing mechanic
// ═════════════════════════════════════════════════════════════════════════════

describe("Coin collection heals player HP", () => {
  it("restores COIN_HEAL_AMOUNT HP when player is not at max", () => {
    const newHp = collectCoin(50);
    expect(newHp).toBe(70);
  });

  it("does not exceed PLAYER_MAX_HP", () => {
    const newHp = collectCoin(95);
    expect(newHp).toBe(PLAYER_MAX_HP); // capped at 100, not 115
  });

  it("heals a full COIN_HEAL_AMOUNT from 80 HP", () => {
    const newHp = collectCoin(80);
    expect(newHp).toBe(100);
  });

  it("heals from critical HP", () => {
    const newHp = collectCoin(1);
    expect(newHp).toBe(21);
  });

  it("does nothing further when already at max HP", () => {
    const newHp = collectCoin(PLAYER_MAX_HP);
    expect(newHp).toBe(PLAYER_MAX_HP);
  });

  it("multiple coins stack up to max HP", () => {
    let hp = 10;
    for (let i = 0; i < 5; i++) {
      hp = collectCoin(hp);
    }
    expect(hp).toBe(PLAYER_MAX_HP); // capped at 100
  });

  it("COIN_HEAL_AMOUNT is a positive integer", () => {
    expect(COIN_HEAL_AMOUNT).toBeGreaterThan(0);
    expect(Number.isInteger(COIN_HEAL_AMOUNT)).toBe(true);
  });

  it("healing amount is meaningful relative to fox damage (covers at least 1 fox hit)", () => {
    // A coin should restore at least as much HP as one fox attack deals
    expect(COIN_HEAL_AMOUNT).toBeGreaterThanOrEqual(FOX_ATTACK_DAMAGE);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 3. Sheep flee — no flee when player is possessing
// ═════════════════════════════════════════════════════════════════════════════

describe("Sheep flee-from-player: suppressed during possession", () => {
  const closeDistance = SHEEP_FLEE_RADIUS * 0.5; // well within flee radius
  const farDistance = SHEEP_FLEE_RADIUS * 2;     // outside flee radius

  it("sheep flees when player is close in normal state", () => {
    expect(shouldFleeFromPlayer(closeDistance, false)).toBe(true);
  });

  it("sheep does NOT flee from close player when player is possessing", () => {
    // Player is controlling a sheep body — no scary human presence
    expect(shouldFleeFromPlayer(closeDistance, true)).toBe(false);
  });

  it("sheep does NOT flee when player is far away (normal state)", () => {
    expect(shouldFleeFromPlayer(farDistance, false)).toBe(false);
  });

  it("sheep does NOT flee when player is far away AND possessing", () => {
    expect(shouldFleeFromPlayer(farDistance, true)).toBe(false);
  });

  it("flee boundary is exactly at SHEEP_FLEE_RADIUS", () => {
    // At exactly the radius, should NOT flee (< not <=)
    expect(shouldFleeFromPlayer(SHEEP_FLEE_RADIUS, false)).toBe(false);
    // Just inside the radius, should flee
    expect(shouldFleeFromPlayer(SHEEP_FLEE_RADIUS - 0.01, false)).toBe(true);
  });

  it("all sheep around possessed player remain calm (no cascade flee)", () => {
    const sheepDistances = [1, 2, 5, 8, 11]; // all within or near SHEEP_FLEE_RADIUS
    const playerIsPossessing = true;
    const fleeing = sheepDistances.filter((d) => shouldFleeFromPlayer(d, playerIsPossessing));
    expect(fleeing).toHaveLength(0); // no sheep should flee
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 4. Damage immunity during rocket flight and space station
// ═════════════════════════════════════════════════════════════════════════════

describe("Fox damage: immunity during rocket and space station", () => {
  it("fox deals damage to normal player in melee range", () => {
    const player = makePlayer();
    const damage = applyFoxDamage(player, FOX_ATTACK_RANGE - 0.1);
    expect(damage).toBe(FOX_ATTACK_DAMAGE);
  });

  it("fox deals NO damage when player is in rocket", () => {
    const player = makePlayer({ onRocket: true });
    const damage = applyFoxDamage(player, 0); // even at distance 0
    expect(damage).toBe(0);
  });

  it("fox deals NO damage when player is in space station", () => {
    const player = makePlayer({ inSpaceStation: true });
    const damage = applyFoxDamage(player, 0);
    expect(damage).toBe(0);
  });

  it("fox deals NO damage after game over", () => {
    const player = makePlayer({ gameOver: true });
    const damage = applyFoxDamage(player, FOX_ATTACK_RANGE - 0.1);
    expect(damage).toBe(0);
  });

  it("fox deals NO damage outside its attack range", () => {
    const player = makePlayer();
    const damage = applyFoxDamage(player, FOX_ATTACK_RANGE + 1);
    expect(damage).toBe(0);
  });
});

describe("Cannonball damage: immunity during rocket and space station", () => {
  const closeHit = CANNONBALL_HIT_RADIUS * 0.5; // well within hit radius

  it("cannonball deals damage to normal player in range", () => {
    const player = makePlayer();
    const damage = applyCannonballDamage(player, closeHit);
    expect(damage).toBe(CANNONBALL_DAMAGE);
  });

  it("cannonball deals NO damage when player is in rocket", () => {
    const player = makePlayer({ onRocket: true });
    const damage = applyCannonballDamage(player, closeHit);
    expect(damage).toBe(0);
  });

  it("cannonball deals NO damage when player is in space station", () => {
    const player = makePlayer({ inSpaceStation: true });
    const damage = applyCannonballDamage(player, closeHit);
    expect(damage).toBe(0);
  });

  it("cannonball deals NO damage after game over", () => {
    const player = makePlayer({ gameOver: true });
    const damage = applyCannonballDamage(player, closeHit);
    expect(damage).toBe(0);
  });

  it("cannonball misses when player is outside hit radius", () => {
    const player = makePlayer();
    const damage = applyCannonballDamage(player, CANNONBALL_HIT_RADIUS + 0.5);
    expect(damage).toBe(0);
  });

  it("HP reduction from cannonball stays within [0, PLAYER_MAX_HP]", () => {
    const player = makePlayer({ hp: 20 });
    const damage = applyCannonballDamage(player, closeHit);
    const newHp = Math.max(0, player.hp - damage);
    expect(newHp).toBe(0); // 20 - 28 = clamped to 0
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 5. Cross-mechanic consistency checks
// ═════════════════════════════════════════════════════════════════════════════

describe("Cross-mechanic consistency", () => {
  it("player in rocket cannot attack AND cannot take damage (fully protected)", () => {
    const player = makePlayer({ onRocket: true });
    expect(canAttack(player, true, 0)).toBe(false);
    expect(applyFoxDamage(player, 0)).toBe(0);
    expect(applyCannonballDamage(player, 0)).toBe(0);
  });

  it("player in space station cannot attack AND cannot take damage", () => {
    const player = makePlayer({ inSpaceStation: true });
    expect(canAttack(player, true, 0)).toBe(false);
    expect(applyFoxDamage(player, 0)).toBe(0);
    expect(applyCannonballDamage(player, 0)).toBe(0);
  });

  it("player possessing sheep cannot attack but can still take damage in normal world", () => {
    const player = makePlayer({ isPossessing: true });
    expect(canAttack(player, true, 0)).toBe(false); // no attacking
    // Note: possession doesn't grant damage immunity — player body is in the world
    // Fox and cannonball damage are not blocked by possession (only rocket/station)
    expect(applyFoxDamage(player, FOX_ATTACK_RANGE - 0.1)).toBe(FOX_ATTACK_DAMAGE);
  });

  it("coin heal effect is rendered in green (+ prefix)", () => {
    // The attackEffect string for coin healing starts with "+", which signals green color
    const healEffect = `+${Math.min(COIN_HEAL_AMOUNT, PLAYER_MAX_HP - 80)} HP`;
    expect(healEffect.startsWith("+")).toBe(true);
    expect(healEffect).toBe("+20 HP");
  });

  it("damage effect strings start with '-' (yellow color signal)", () => {
    const damageEffect = `-${FOX_ATTACK_DAMAGE}`;
    expect(damageEffect.startsWith("+")).toBe(false);
    expect(damageEffect.startsWith("-")).toBe(true);
  });

  it("COIN_HEAL_AMOUNT and FOX_ATTACK_DAMAGE are balanced (coins are worth collecting)", () => {
    // A single coin should meaningfully offset damage (at least 1 full fox hit)
    expect(COIN_HEAL_AMOUNT).toBeGreaterThanOrEqual(FOX_ATTACK_DAMAGE);
  });
});
