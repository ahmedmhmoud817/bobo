const { Telegraf } = require('telegraf');
const fs = require('fs');

const bot = new Telegraf(process.env.BOT_TOKEN);

let db = fs.existsSync('./data.json')
    ? JSON.parse(fs.readFileSync('./data.json'))
    : {};

function save() {
    fs.writeFileSync('./data.json', JSON.stringify(db, null, 2));
}

function user(id, name, photo) {

    if (!db[id]) {
        db[id] = {
            name,
            photo: photo || null,
            games: 0,
            wins: 0
        };
    }

    return db[id];
}

/* ================= ROOM ================= */

const rooms = new Map();

function room(chatId) {

    if (!rooms.has(chatId)) {
        rooms.set(chatId, {
            players: new Map(),
            seated: new Set()
        });
    }

    return rooms.get(chatId);
}

/* ================= كراسي (CARD UI) ================= */

bot.hears('كراسي', async (ctx) => {

    const r = room(ctx.chat.id);

    const u = user(
        ctx.from.id,
        ctx.from.first_name,
        ctx.from.photo
    );

    r.players.set(ctx.from.id, u.name);

    await ctx.reply(
`🪑━━━━━━━━━━━━━━🪑
      🎮 GAME CARD
🪑━━━━━━━━━━━━━━🪑

👤 الاسم: ${u.name}
👥 اللاعبين: ${r.players.size}

اضغط للانضمام 👇`,
{
    reply_markup: {
        inline_keyboard: [
            [{ text: "🪑 دخول اللعبة", callback_data: "join" }]
        ]
    }
});
});

/* ================= PROFILE CARD ================= */

bot.hears('بروفايل', async (ctx) => {

    const u = user(ctx.from.id, ctx.from.first_name);

    const text =
`👤━━━━━━━━━━━━━━👤
      📊 PROFILE CARD
👤━━━━━━━━━━━━━━👤

👤 الاسم: ${u.name}
🎮 مباريات: ${u.games}
🏆 فوز: ${u.wins}`;

    if (ctx.from.photo) {

        const photos = await ctx.telegram.getUserProfilePhotos(ctx.from.id);

        const file = photos.photos?.[0]?.[0]?.file_id;

        if (file) {

            return ctx.replyWithPhoto(file, {
                caption: text
            });
        }
    }

    ctx.reply(text);
});

/* ================= CHALLENGES ================= */

bot.hears('تحدي', (ctx) => {

    ctx.reply(
`🎯━━━━━━━━━━━━━━🎯
        CHALLENGES
🎯━━━━━━━━━━━━━━🎯

1️⃣ اللي يخسر يقول: "أنا مره 😭"
2️⃣ اللي يخسر ميكسبش 10 دقايق ⛔

اختر التحدي 👇`,
{
    reply_markup: {
        inline_keyboard: [
            [{ text: "😂 التحدي الأول", callback_data: "c1" }],
            [{ text: "⛔ التحدي الثاني", callback_data: "c2" }]
        ]
    }
});
});

/* ================= GAME ================= */

bot.hears('العب', async (ctx) => {

    const r = room(ctx.chat.id);

    if (r.players.size < 2)
        return ctx.reply("❌ محتاج لاعبين");

    startGame(ctx, r);
});

/* ================= GAME START ================= */

async function startGame(ctx, r) {

    r.seated = new Set();

    const players = [...r.players.values()];

    let chairs = Math.max(1, Math.floor(players.length / 2));

    await ctx.reply(
`🎮━━━━━━━━━━━━━━🎮
      GAME STARTED
🎮━━━━━━━━━━━━━━🎮

👥 اللاعبين: ${players.length}
🪑 الكراسي: ${chairs}

⚡ استعد!`,
{
    reply_markup: {
        inline_keyboard: [
            [{ text: "🪑 اقعد", callback_data: "sit" }]
        ]
    }
});

    setTimeout(() => end(ctx, r), 15000);
}

/* ================= END ================= */

function end(ctx, r) {

    const losers = [...r.players.keys()]
        .filter(id => !r.seated.has(id));

    losers.forEach(id => r.players.delete(id));

    [...r.players.keys()].forEach(id => {

        const u = user(id);

        u.games++;
        u.wins++;
    });

    save();

    ctx.reply("💀 انتهت الجولة");

    if (r.players.size <= 1) {

        const winner = [...r.players.values()][0];

        ctx.reply(
`🏆━━━━━━━━━━━━━━🏆
      WINNER
🏆━━━━━━━━━━━━━━🏆

👑 ${winner}`
        );

        return;
    }

    setTimeout(() => startGame(ctx, r), 3000);
}

/* ================= CALLBACKS ================= */

bot.action('join', (ctx) => {

    const r = room(ctx.chat.id);

    r.players.set(ctx.from.id, ctx.from.first_name);

    ctx.answerCbQuery("🔥 دخلت اللعبة");
});

bot.action('sit', (ctx) => {

    const r = room(ctx.chat.id);

    r.seated.add(ctx.from.id);

    ctx.answerCbQuery("🪑 قعدت");
});

bot.action('c1', (ctx) => ctx.answerCbQuery("😂 التحدي الأول مفعل"));
bot.action('c2', (ctx) => ctx.answerCbQuery("⛔ التحدي الثاني مفعل"));

bot.launch();

console.log("🎮 CARD UI BOT RUNNING");
