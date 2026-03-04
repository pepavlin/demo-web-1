# Mechanics Consistency

This document describes how game systems interact and the rules that keep them consistent.

## Player State Exclusions

The player can be in one of these mutually exclusive states during gameplay:

| State | Ref | Effect on Other Systems |
|-------|-----|------------------------|
| Normal (explore) | — | Full access to all mechanics |
| Possessing sheep | `possessedSheepRef` | Attack blocked; sheep flee suppressed |
| On boat | `onBoatRef` | Attack blocked |
| On rocket | `onRocketRef` | Attack blocked; immune to fox + cannonball damage |
| In space station | `inSpaceStationRef` | Attack blocked; immune to fox + cannonball damage |
| Game over | `gameOver` | All damage blocked; attack blocked |

## Coin → Heal Loop

Coins are not purely cosmetic. Collecting a coin restores **20 HP** (capped at `PLAYER_MAX_HP = 100`).

- Healing is shown as a green `+20 HP` popup (same `attackEffect` element as damage, green when string starts with `+`)
- This closes the loop: coins mitigate fox/catapult damage and reward exploration
- 35 coins × 20 HP = 700 total HP of recovery available, far exceeding a single run's damage budget

## Sheep Flee Suppression During Possession

Normally sheep flee from the player body within `SHEEP_FLEE_RADIUS = 12` units.
While possessing a sheep, this check is suppressed (`fleeingFromPlayer = false`).

**Rationale:** The controlled sheep moves naturally among other sheep. If the player's body position remained a threat, all nearby sheep would cascade-flee, making possession disruptive and counter-intuitive.

## Damage Immunity in Rocket / Space Station

Fox attacks and cannonballs check `!onRocketRef.current && !inSpaceStationRef.current` before dealing damage.

**Rationale:** During rocket flight (Y = 0 → 165 over 12s) and inside the space station (Y = 2000), the player is physically far from the ground-level enemies. Allowing damage would be unfair and confusing.

## Attack Effect Color Coding

The `attackEffect` state string uses a prefix convention for color:

| Prefix | Colour | Meaning |
|--------|--------|---------|
| Starts with `+` | Green `#4ade80` | Healing (coin) |
| `"Miss"` | Gray `#9ca3af` | Missed attack |
| Other (e.g. `"-55"`) | Yellow `#fbbf24` | Damage dealt |

## Game Over Summary

The game-over screen shows all tracked metrics consistently:
- Foxes defeated
- Catapults destroyed (shown only when > 0)
- Coins collected out of total available
