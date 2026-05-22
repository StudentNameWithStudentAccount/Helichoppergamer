// --- CUSTOM SPRITE KINDS ---
namespace SpriteKind {
    export const Turret = SpriteKind.create()
    export const EnemyProjectile = SpriteKind.create()
    export const Platform = SpriteKind.create() // Safe ledges to refuel
    export const Hazard = SpriteKind.create()   // Instant death (Floor & Spikes)
    export const Heal = SpriteKind.create()
    export const Coin = SpriteKind.create()
    export const UI = SpriteKind.create()       // For the fuel bar
}

// --- GAME STATE & UPGRADES ---
let fireRate = 400
let lastShot = 0
let projectiles = 1
let nextUpgradeScore = 150
let enemyPower = 0
let isDead = false

// Jetpack / Helicopter Physics
let gravity = 6
let thrustPower = 12
let moveSpeed = 15
let friction = 0.85

// Fuel System
let maxFuel = 200
let currentFuel = maxFuel

// Upgrades
let bouncyLifespan = 0
let shrapnelCount = 0

let upgradeNames = [
    "SPREAD SHOT",
    "FASTER FIRE",
    "REPAIR (+2 HP)",
    "SPEED UP",
    "BOUNCY BULLETS",
    "EXPLOSIONS"
]

// --- INITIALIZE GAME ---
info.setScore(0)
info.setLife(20)

// Create Player 
let playerImg = img`
    . 1 1 1 1 1 1 1 1 1 .
    . . . . . 1 . . . . .
    . . 5 5 5 5 5 5 5 . .
    . 5 5 5 8 8 8 5 5 5 .
    . . 5 5 5 5 5 5 5 . .
    . . . 5 5 . 5 5 . . .
    . . 1 1 1 1 1 1 1 . .
`
let player = sprites.create(playerImg, SpriteKind.Player)
player.setPosition(30, 80)
player.setStayInScreen(true)

// --- FUEL BAR UI ---
let fuelBarImg = image.create(60, 6)
let fuelBar = sprites.create(fuelBarImg, SpriteKind.UI)
fuelBar.setFlag(SpriteFlag.RelativeToCamera, true)
fuelBar.setFlag(SpriteFlag.Ghost, true) // Ignore collisions
fuelBar.setPosition(80, 10)

// --- THE FLOOR IS LAVA ---
let groundImg = image.create(160, 16)
groundImg.fill(11)
groundImg.fillRect(0, 0, 160, 4, 7)
let ground = sprites.create(groundImg, SpriteKind.Hazard)
ground.setPosition(80, 120)

// --- STARTING PLATFORM (To top off fuel before starting) ---
let platImg = img`
    e e e e e e e e e e e e e e e e e e e e e e e e e e e e e e e e
    7 7 7 7 7 7 7 7 7 7 7 7 7 7 7 7 7 7 7 7 7 7 7 7 7 7 7 7 7 7 7 7
    c c c c c c c c c c c c c c c c c c c c c c c c c c c c c c c c
`
let startPlat = sprites.create(platImg, SpriteKind.Platform)
startPlat.setPosition(30, 105)
startPlat.vx = -40
startPlat.setFlag(SpriteFlag.AutoDestroy, true)

// --- DIFFICULTY INCREASES OVER TIME ---
game.onUpdateInterval(15000, function () {
    if (isDead) return
    enemyPower += 1
    game.splash("DIFFICULTY UP! Level " + enemyPower)
})

// --- FLIGHT PHYSICS & FUEL MANAGEMENT ---
game.onUpdate(function () {

    // Draw the Fuel Bar dynamically
    fuelBarImg.fill(15) // Black background
    let fuelWidth = Math.max(0, (currentFuel / maxFuel) * 58)
    let fuelColor = currentFuel > 50 ? 7 : 2 // Green if good, Red if low
    fuelBarImg.fillRect(1, 1, fuelWidth, 4, fuelColor)

    if (isDead) {
        player.setStayInScreen(false)
        player.vy += gravity * 1.2
        player.vx = -30
        if (player.top >= 140) {
            game.over(false)
        }
        return
    }

    let isGrounded = false
    player.vy += gravity

    // PLATFORM COLLISION & REFUELING
    for (let plat of sprites.allOfKind(SpriteKind.Platform)) {
        if (player.vy >= 0 && player.right > plat.left && player.left < plat.right) {
            if (player.bottom >= plat.top && player.bottom <= plat.top + 10) {
                player.bottom = plat.top
                player.vy = 0
                isGrounded = true
                currentFuel = maxFuel // REFILL FUEL WHEN LANDED!
            }
        }
    }

    // FLYING / THRUSTERS
    if (controller.up.isPressed() && currentFuel > 0) {
        player.vy -= thrustPower
        currentFuel -= 1.5 // Drain fuel while flying
    }

    // RUNNING / FLYING HORIZONTALLY
    if (controller.left.isPressed()) player.vx -= moveSpeed
    if (controller.right.isPressed()) player.vx += moveSpeed
    player.vx *= friction

    // FAST DROP
    if (controller.down.isPressed() && !isGrounded) {
        player.vy += gravity * 1.5
    }

    // SHOOTING
    if (controller.A.isPressed() || controller.B.isPressed()) {
        if (game.runtime() - lastShot > fireRate) {
            let pBulletImg = img`
                6 6 6
                6 6 6
            `
            for (let i = 0; i < projectiles; i++) {
                let angleOffset = (i - (projectiles - 1) / 2) * 15
                let rad = angleOffset * Math.PI / 180

                let bx = Math.cos(rad) * 150
                let by = Math.sin(rad) * 150

                let b = sprites.create(pBulletImg, SpriteKind.Projectile)
                b.setPosition(player.x, player.y)
                b.vx = bx
                b.vy = by

                if (bouncyLifespan > 0) {
                    b.setBounceOnWall(true)
                    b.lifespan = bouncyLifespan
                } else {
                    b.setFlag(SpriteFlag.AutoDestroy, true)
                }
            }
            lastShot = game.runtime()
        }
    }
})

// --- CRASH SEQUENCE TRIGGER ---
function triggerCrashSequence() {
    if (!isDead) {
        isDead = true
        info.setLife(0)
        player.startEffect(effects.fire)
        scene.cameraShake(8, 800)
    }
}

// --- CONSTANT PLATFORM SPAWNING ---
game.onUpdateInterval(1200, function () {
    if (isDead) return
    let platform = sprites.create(platImg, SpriteKind.Platform)
    platform.setPosition(160, randint(60, 100))
    platform.vx = -40 - (enemyPower * 2)
    platform.setFlag(SpriteFlag.AutoDestroy, true)
})

// --- HAZARD WALL SPAWNING ---
game.onUpdateInterval(3500, function () {
    if (isDead) return
    let hazardImg = img`
        2 2 2 2 2 2 2 2
        2 4 4 4 4 4 4 2
        2 4 2 2 2 2 4 2
        2 4 2 2 2 2 4 2
        2 4 2 2 2 2 4 2
        2 4 4 4 4 4 4 2
        2 2 2 2 2 2 2 2
    `
    let hazard = sprites.create(hazardImg, SpriteKind.Hazard)
    hazard.setPosition(160, randint(50, 105))
    hazard.vx = -45 - (enemyPower * 4)
    hazard.setFlag(SpriteFlag.AutoDestroy, true)
})

// --- COIN SPAWNING ---
game.onUpdateInterval(1800, function () {
    if (isDead) return
    let coinImg = img`
        . 5 5 .
        5 4 4 5
        5 4 4 5
        . 5 5 .
    `
    let coin = sprites.create(coinImg, SpriteKind.Coin)
    coin.setPosition(160, randint(30, 90))
    coin.vx = -40 - (enemyPower * 2)
    coin.setFlag(SpriteFlag.AutoDestroy, true)
})

// --- ENEMY SPAWNING ---
game.onUpdateInterval(1400, function () {
    if (isDead) return
    let turretImg = img`
        . . 2 2 2 . .
        . 2 2 2 2 2 .
        2 2 2 2 2 2 2
        f 2 2 2 2 2 f
        f 2 2 2 2 2 f
    `
    let turret = sprites.create(turretImg, SpriteKind.Turret)
    turret.setPosition(160, randint(20, 95))
    turret.vx = randint(-50 - (enemyPower * 6), -30 - (enemyPower * 6))
    turret.setFlag(SpriteFlag.AutoDestroy, true)
})

// --- ENEMY SHOOTING ---
game.onUpdateInterval(1500, function () {
    if (isDead) return
    for (let t of sprites.allOfKind(SpriteKind.Turret)) {
        let dx = player.x - t.x
        let dy = player.y - t.y
        let angle = Math.atan2(dy, dx)

        let bulletSpeed = 65 + (enemyPower * 12)
        let vx = Math.cos(angle) * bulletSpeed
        let vy = Math.sin(angle) * bulletSpeed

        let eBulletImg = img`
            a a
            a a
        `
        let eb = sprites.createProjectileFromSprite(eBulletImg, t, vx, vy)
        eb.setKind(SpriteKind.EnemyProjectile)
    }
})

// --- COLLISIONS ---

// Hazards = Instant Death
sprites.onOverlap(SpriteKind.Player, SpriteKind.Hazard, function (p, hazard) {
    triggerCrashSequence()
})

sprites.onOverlap(SpriteKind.Player, SpriteKind.Coin, function (p, c) {
    c.destroy(effects.disintegrate, 100)
    info.changeScoreBy(10)
    music.play(music.melodyPlayable(music.baDing), music.PlaybackMode.InBackground)
    checkScoreForUpgrade()
})

sprites.onOverlap(SpriteKind.Projectile, SpriteKind.Platform, function (bullet, plat) {
    if (bouncyLifespan > 0) { bullet.vy *= -1 } else { bullet.destroy() }
})
sprites.onOverlap(SpriteKind.Projectile, SpriteKind.Hazard, function (bullet, haz) {
    if (bouncyLifespan > 0) { bullet.vy *= -1 } else { bullet.destroy() }
})

sprites.onOverlap(SpriteKind.EnemyProjectile, SpriteKind.Platform, function (eb, plat) { eb.destroy() })
sprites.onOverlap(SpriteKind.EnemyProjectile, SpriteKind.Hazard, function (eb, haz) { eb.destroy() })

sprites.onOverlap(SpriteKind.Projectile, SpriteKind.Turret, function (bullet, turret) {
    bullet.destroy()
    turret.destroy(effects.fire, 100)
    info.changeScoreBy(25)

    if (Math.percentChance(20)) {
        let hpImg = img`
            . 7 7 .
            7 7 7 7
            7 7 7 7
            . 7 7 .
        `
        let hpDrop = sprites.create(hpImg, SpriteKind.Heal)
        hpDrop.setPosition(turret.x, turret.y)
        hpDrop.vx = -25
        hpDrop.lifespan = 4000
    }

    if (shrapnelCount > 0) {
        let shrapImg = img`
            8 8
            8 8
        `
        for (let s = 0; s < shrapnelCount; s++) {
            let shrap = sprites.createProjectileFromSprite(shrapImg, turret, randint(-80, 80), randint(-80, 80))
            shrap.lifespan = 600
        }
    }

    checkScoreForUpgrade()
})

sprites.onOverlap(SpriteKind.Player, SpriteKind.Heal, function (p, hpDrop) {
    if (isDead) return
    hpDrop.destroy(effects.hearts, 200)
    info.changeLifeBy(1)
})

sprites.onOverlap(SpriteKind.EnemyProjectile, SpriteKind.Player, function (enemyBullet, p) {
    if (isDead) return
    enemyBullet.destroy()
    info.changeLifeBy(-1)
    scene.cameraShake(4, 500)
    if (info.life() <= 0) { triggerCrashSequence() }
})

sprites.onOverlap(SpriteKind.Turret, SpriteKind.Player, function (turret, p) {
    if (isDead) return
    turret.destroy(effects.fire, 100)
    info.changeLifeBy(-1)
    scene.cameraShake(6, 500)
    if (info.life() <= 0) { triggerCrashSequence() }
})

// --- ROGUELITE UPGRADE SYSTEM ---
function triggerUpgrade() {
    if (isDead) return
    let opt1 = randint(0, 5)
    let opt2 = randint(0, 5)
    while (opt1 === opt2) { opt2 = randint(0, 5) }

    let titleText = "A: " + upgradeNames[opt1]
    let subText = "B: " + upgradeNames[opt2]

    let pickedA = game.ask(titleText, subText)
    let selected = pickedA ? opt1 : opt2;

    if (selected === 0) projectiles += 1
    else if (selected === 1) fireRate = Math.max(50, fireRate * 0.8)
    else if (selected === 2) info.changeLifeBy(2)
    else if (selected === 3) moveSpeed += 4
    else if (selected === 4) bouncyLifespan += 1500
    else if (selected === 5) shrapnelCount += 2

    enemyPower += 1
}

function checkScoreForUpgrade() {
    if (info.score() >= nextUpgradeScore) {
        nextUpgradeScore += 200
        triggerUpgrade()
    }
}

triggerUpgrade()