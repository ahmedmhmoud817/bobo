const { Telegraf } = require('telegraf');

const bot = new Telegraf(process.env.BOT_TOKEN);

const games = new Map();

const STATE = {
    WAITING: 'waiting',
    PLAYING: 'playing',
    ROUND: 'round'
};

const GIF = {
    START: "https://media.tenor.com/4h9gXkL.gif",
    MUSIC: "https://media.tenor.com/3kW2k5Z.gif",
    LOSE: "https://media.tenor.com/9hXc1Qk.gif",
    WIN: "https://media.tenor.com/8kJd2Lm.gif"
};

function createGame(chatId, creatorId, name) {

    const game = {
        chatId,
        creatorId,
        players: new Map(),
        state: STATE.WAITING,
        round: 0,
        seated: new Set(),
        timeout: null,
        msgId: null
    };

    games.set(chatId, game);

    return game;
}

bot.start(async (ctx) => {

    await ctx.replyWithAnimation(
        GIF.START,
        {
            caption:
`🔥 CHAIR GAME PRO MAX 🔥

🎮 WELCOME ${ctx.from.first_name.toUpperCase()}

📌 COMMANDS:
/create
/join
/players
/end

🪑 TYPE: كراسي`
        }
    );
});

bot.command('create', async (ctx) => {

    const old = games.get(ctx.chat.id);

    if (old)
        return ctx.reply("⚠️ GAME ALREADY RUNNING");

    const game = createGame(
        ctx.chat.id,
        ctx.from.id,
        ctx.from.first_name
    );

    game.players.set(ctx.from.id, ctx.from.first_name);

    await ctx.reply(
`🎮 GAME CREATED

👑 ${ctx.from.first_name.toUpperCase()}

👥 PLAYERS: 1

▶️ TYPE /join
🚀 TYPE "كراسي"`
    );
});

bot.command('join', async (ctx) => {

    const game = games.get(ctx.chat.id);

    if (!game)
        return ctx.reply("❌ NO GAME");

    if (game.state !== STATE.WAITING)
        return ctx.reply("⚠️ GAME STARTED");

    if (game.players.has(ctx.from.id))
        return ctx.reply("✅ ALREADY JOINED");

    game.players.set(ctx.from.id, ctx.from.first_name);

    const list = [...game.players.values()]
        .map(p => `👉 ${p.toUpperCase()}`)
        .join("\n");

    await ctx.reply(
`🎉 NEW PLAYER

👤 ${ctx.from.first_name.toUpperCase()}

👥 PLAYERS (${game.players.size}):

${list}`
    );
});

async function startGame(ctx, chatId) {

    const game = games.get(chatId);

    if (!game)
        return ctx.reply("❌ NO GAME");

    if (game.players.size < 3)
        return ctx.reply("⚠️ NEED 3 PLAYERS");

    game.state = STATE.PLAYING;

    await ctx.replyWithAnimation(
        GIF.MUSIC,
        {
            caption:
`🔥 GAME STARTED 🔥

🎵 MUSIC ON...
🪑 GET READY`
        }
    );

    setTimeout(() => {
        startRound(ctx.telegram, game);
    }, 3000);
}

async function startRound(tg, game) {

    game.round++;
    game.seated = new Set();

    const players = [...game.players.values()];
    let chair = Math.max(1, players.length - 3);

    const list = players
        .map(p => `👉 ${p.toUpperCase()}`)
        .join("\n");

    const msg = await tg.sendMessage(
        game.chatId,
`🎵 ROUND ${game.round}

👥 PLAYERS: ${players.length}
🪑 CHAIRS: ${chair}

${list}

⚡ FAST!`,
        {
            reply_markup: {
                inline_keyboard: [[
                    {
                        text: `🪑 SIT (${chair})`,
                        callback_data: "sit"
                    }
                ]]
            }
        }
    );

    game.msgId = msg.message_id;
    game.state = STATE.ROUND;

    // 💥 FAKE CHAIR ANIMATION
    let interval = setInterval(async () => {

        if (chair <= 1) {
            clearInterval(interval);
            return;
        }

        chair--;

        try {
            await tg.editMessageText(
                game.chatId,
                game.msgId,
                undefined,
`🎵 ROUND ${game.round}

👥 PLAYERS: ${players.length}
🪑 CHAIRS MOVING ➜ ${chair}

${list}

⚡ HURRY!`,
                {
                    reply_markup: {
                        inline_keyboard: [[
                            {
                                text: `🪑 SIT (${chair})`,
                                callback_data: "sit"
                            }
                        ]]
                    }
                }
            );
        } catch (_) {}
    }, 2000);

    game.timeout = setTimeout(() => {
        clearInterval(interval);
        endRound(tg, game);
    }, 15000);
}

async function endRound(tg, game) {

    const losers = [...game.players.keys()]
        .filter(id => !game.seated.has(id));

    losers.forEach(id => game.players.delete(id));

    await tg.sendAnimation(
        game.chatId,
        GIF.LOSE,
        {
            caption: "💀 ROUND OVER"
        }
    );

    if (game.players.size <= 1) {

        const winner = [...game.players.values()][0];

        await tg.sendAnimation(
            game.chatId,
            GIF.WIN,
            {
                caption:
`🏆 WINNER

👑 ${winner.toUpperCase()}`
            }
        );

        games.delete(game.chatId);
        return;
    }

    setTimeout(() => startRound(tg, game), 3000);
}

bot.hears('كراسي', (ctx) => startGame(ctx, ctx.chat.id));

bot.command('end', (ctx) => {
    games.delete(ctx.chat.id);
    ctx.reply("🛑 GAME STOPPED");
});

bot.command('players', async (ctx) => {

    const game = games.get(ctx.chat.id);

    if (!game)
        return ctx.reply("❌ NO GAME");

    const list = [...game.players.values()]
        .map(p => `👉 ${p.toUpperCase()}`)
        .join("\n");

    ctx.reply(`👥 PLAYERS\n\n${list}`);
});

bot.action('sit', async (ctx) => {

    const game = games.get(ctx.chat.id);

    if (!game || game.state !== STATE.ROUND)
        return;

    const id = ctx.from.id;

    if (!game.players.has(id))
        return;

    game.seated.add(id);

    await ctx.answerCbQuery("🔥 SIT OK");
});

bot.launch();

console.log("🔥 PRO MAX CHAIR GAME RUNNING");
