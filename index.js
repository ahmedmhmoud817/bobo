const { Telegraf } = require('telegraf');
const fs = require('fs');

const bot = new Telegraf(process.env.BOT_TOKEN);

let db = fs.existsSync('./data.json')
    ? JSON.parse(fs.readFileSync('./data.json'))
    : {};

function save() {
    fs.writeFileSync('./data.json', JSON.stringify(db, null, 2));
}

function user(id, name) {

    if (!db[id]) {
        db[id] = {
            name,
            coins: 100,
            xp: 0,
            level: 1,
            wins: 0,
            games: 0,
            lastDaily: 0,
            skill: "normal"
        };
    }

    return db[id];
}

/* ================= TOURNAMENT SYSTEM ================= */

const tournaments = new Map();

/* ================= ROOM ================= */

const rooms = new Map();

function room(chatId) {

    if (!rooms.has(chatId)) {
        rooms.set(chatId, {
            players: new Map(),
            seated: new Set(),
            round: 0,
            msgId: null
        });
    }

    return rooms.get(chatId);
}

/* ================= SKILLS ================= */

function randomSkill() {

    const skills = ["FAST", "LUCKY", "SHIELD"];

    return skills[Math.floor(Math.random() * skills.length)];
}

/* ================= JOIN ================= */

bot.hears('كراسي', (ctx) => {

    const r = room(ctx.chat.id);

    const u = user(ctx.from.id, ctx.from.first_name);

    r.players.set(ctx.from.id, u.name);

    ctx.reply(
`🎮 PLAYER JOINED

👤 ${u.name}
👥 ${r.players.size}`
    );
});

/* ================= DAILY QUEST ================= */

bot.hears('مهمة', (ctx) => {

    const u = user(ctx.from.id, ctx.from.first_name);

    ctx.reply(
`🎯 DAILY QUEST

🎮 العب مباراة → +50 XP
🏆 فز → +100 COINS`
    );
});

/* ================= SHOP ================= */

bot.hears('متجر', (ctx) => {

    ctx.reply(
`🛒 SHOP

⚡ BOOST (x2 coins)
🪑 SKIN (chair effects)

اكتب: شراء`
    );
});

bot.hears('شراء', (ctx) => {

    const u = user(ctx.from.id, ctx.from.first_name);

    if (u.coins < 100)
        return ctx.reply("❌ مش معاك كوينز");

    u.coins -= 100;
    u.skill = randomSkill();

    save();

    ctx.reply(`✨ حصلت على مهارة: ${u.skill}`);
});

/* ================= TOURNAMENT ================= */

bot.hears('بطولة', (ctx) => {

    const t = tournaments.get(ctx.chat.id) || {
        players: new Map()
    };

    tournaments.set(ctx.chat.id, t);

    t.players.set(ctx.from.id, ctx.from.first_name);

    ctx.reply(
`🏆 TOURNAMENT

👥 ${t.players.size} لاعبين`
    );
});

/* ================= START ================= */

bot.hears('ابدأ', async (ctx) => {

    const r = room(ctx.chat.id);

    if (r.players.size < 2)
        return ctx.reply("❌ محتاج لاعبين");

    startGame(ctx, r);
});

/* ================= CINEMATIC GAME ================= */

async function startGame(ctx, r) {

    r.seated = new Set();

    const players = [...r.players.values()];

    let chairs = Math.max(1, Math.floor(players.length / 2));

    await ctx.reply(
`🎬 GAME START

👥 ${players.length}
🪑 ${chairs}
🔊 MUSIC ON 🔊`
    );

    setTimeout(() => round(ctx, r), 3000);
}

/* ================= ROUND ================= */

async function round(ctx, r) {

    const players = [...r.players.values()];

    let chairs = Math.max(1, Math.floor(players.length / 2));

    await ctx.telegram.sendMessage(
        ctx.chat.id,
`🎮 ROUND ${r.round}

👥 PLAYERS: ${players.length}
🪑 CHAIRS: ${chairs}

⚡ FIGHT!`
    );

    setTimeout(() => end(ctx, r), 12000);
}

/* ================= END ================= */

function end(ctx, r) {

    const losers = [...r.players.keys()]
        .filter(id => !r.seated.has(id));

    losers.forEach(id => r.players.delete(id));

    // 💰 reward
    [...r.players.keys()].forEach(id => {

        const u = user(id);

        u.coins += 50;
        u.xp += 30;
        u.games++;

        if (u.xp >= u.level * 100) {
            u.level++;
            u.xp = 0;
        }
    });

    save();

    ctx.telegram.sendMessage(
        ctx.chat.id,
        "💀 ROUND OVER"
    );

    if (r.players.size <= 1) {

        const winner = [...r.players.values()][0];

        const w = user([...r.players.keys()][0]);

        w.wins++;

        ctx.telegram.sendMessage(
            ctx.chat.id,
`🏆 CHAMPION

👑 ${winner}`
        );

        return;
    }

    setTimeout(() => round(ctx, r), 3000);
}

bot.launch();

console.log("👑 GENESIS BOT RUNNING");
