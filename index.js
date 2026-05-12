const { Telegraf } = require('telegraf');
const fs = require('fs');

const bot = new Telegraf(process.env.BOT_TOKEN);

const DB_FILE = './data.json';

let db = fs.existsSync(DB_FILE)
    ? JSON.parse(fs.readFileSync(DB_FILE))
    : {};

function save() {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

function user(id, name) {

    if (!db[id]) {
        db[id] = {
            name,
            coins: 100,
            xp: 0,
            level: 1,
            wins: 0,
            lastDaily: 0
        };
    }

    return db[id];
}

/* ================= ROOMS ================= */

const rooms = new Map();

function getRoom(chatId) {

    if (!rooms.has(chatId)) {

        rooms.set(chatId, {
            players: new Map(),
            seated: new Set(),
            round: 0
        });
    }

    return rooms.get(chatId);
}

/* ================= DAILY ================= */

bot.command('daily', (ctx) => {

    const u = user(ctx.from.id, ctx.from.first_name);

    const now = Date.now();

    if (now - u.lastDaily < 86400000)
        return ctx.reply("⏳ COME BACK LATER");

    u.coins += 200;
    u.lastDaily = now;

    save();

    ctx.reply("🎁 +200 COINS");
});

/* ================= PROFILE ================= */

bot.command('profile', (ctx) => {

    const u = user(ctx.from.id, ctx.from.first_name);

    ctx.reply(
`👤 PROFILE

💰 ${u.coins}
🏆 ${u.wins}
📊 LEVEL ${u.level}
⭐ XP ${u.xp}`
    );
});

/* ================= LEADERBOARD ================= */

bot.command('top', (ctx) => {

    const top = Object.entries(db)
        .sort((a, b) => b[1].coins - a[1].coins)
        .slice(0, 5)
        .map((u, i) =>
            `${i + 1}. ${u[1].name} - 💰 ${u[1].coins}`
        )
        .join("\n");

    ctx.reply(`🌍 TOP PLAYERS\n\n${top}`);
});

/* ================= STEAL ================= */

bot.command('steal', (ctx) => {

    const from = user(ctx.from.id);

    const keys = Object.keys(db);

    const targetId = keys[Math.floor(Math.random() * keys.length)];

    const target = db[targetId];

    if (!target || targetId == ctx.from.id)
        return ctx.reply("❌ FAILED");

    const amount = Math.floor(Math.random() * 70);

    target.coins -= amount;
    from.coins += amount;

    save();

    ctx.reply(`💣 STOLE ${amount} COINS`);
});

/* ================= GAME ================= */

bot.hears('كراسي', (ctx) => {

    const room = getRoom(ctx.chat.id);

    room.players.set(ctx.from.id, ctx.from.first_name);

    // 🧠 AI BOT
    if (room.players.size < 3) {
        room.players.set("AI_" + Math.random(), "🤖 BOT");
    }

    ctx.reply(
`🎮 JOINED

👥 PLAYERS: ${room.players.size}`
    );
});

/* ================= START ================= */

bot.command('begin', async (ctx) => {

    const room = getRoom(ctx.chat.id);

    if (room.players.size < 2)
        return ctx.reply("❌ NEED PLAYERS");

    startRound(ctx, room);
});

/* ================= ROUND ================= */

async function startRound(ctx, room) {

    room.round++;
    room.seated = new Set();

    let players = [...room.players.values()];
    let chairs = Math.max(1, players.length - 2);

    const msg = await ctx.reply(
`🎵 ROUND ${room.round}

👥 ${players.length}
🪑 ${chairs}

⚡ GO`,
        {
            reply_markup: {
                inline_keyboard: [[
                    { text: "🪑 SIT", callback_data: "sit" }
                ]]
            }
        }
    );

    room.msgId = msg.message_id;

    setTimeout(() => endRound(ctx, room), 15000);
}

/* ================= END ROUND ================= */

function endRound(ctx, room) {

    const losers = [...room.players.keys()]
        .filter(id => !room.seated.has(id));

    losers.forEach(id => room.players.delete(id));

    // 💰 reward winners
    [...room.players.keys()].forEach(id => {

        const u = user(id);

        u.coins += 50;
        u.xp += 20;
        u.wins++;

        if (u.xp >= u.level * 100) {
            u.level++;
            u.xp = 0;
        }
    });

    save();

    if (room.players.size <= 1) {

        const winner = [...room.players.values()][0];

        ctx.reply(
`🏆 WINNER

👑 ${winner}

🔥 GAME OVER`
        );

        rooms.delete(room.chatId);

        return;
    }

    setTimeout(() => startRound(ctx, room), 3000);
}

/* ================= SIT ================= */

bot.action('sit', async (ctx) => {

    const room = getRoom(ctx.chat.id);

    room.seated.add(ctx.from.id);

    await ctx.answerCbQuery("🔥 OK");
});

bot.launch();

console.log("👑 FINAL GOD MODE RUNNING");
