const { Telegraf } = require('telegraf');

const bot = new Telegraf(process.env.BOT_TOKEN);

const games = new Map();

const STATE = {
    WAITING: 'waiting',
    PLAYING: 'playing',
    ROUND: 'round'
};

const GIFS = {
    start:
        'https://media.giphy.com/media/l0MYC0LajbaPoEADu/giphy.gif',

    music:
        'https://media.giphy.com/media/3o7TKtnuHOHHUjR38Y/giphy.gif',

    lose:
        'https://media.giphy.com/media/ISOckXUybVfQ4/giphy.gif',

    win:
        'https://media.giphy.com/media/11sBLVxNs7v6WA/giphy.gif'
};

function createGame(chatId, creatorId, creatorName) {

    const game = {
        chatId,
        creator: {
            id: creatorId,
            name: creatorName
        },
        players: new Map(),
        state: STATE.WAITING,
        round: 0,
        seated: new Set(),
        roundTimeout: null,
        currentMessageId: null
    };

    games.set(chatId, game);

    return game;
}

bot.start(async (ctx) => {

    await ctx.replyWithAnimation(
        GIFS.start,
        {
            caption:
`🎮 اهلا بك في لعبة الكراسي PRO MAX 🪑🔥

📌 الأوامر:

/create → إنشاء لعبة
/join → دخول اللعبة
/players → عرض اللاعبين
/end → إنهاء اللعبة

🚀 لبدء اللعبة:
اكتب "كراسي"`
        }
    );
});

bot.command('create', async (ctx) => {

    const oldGame = games.get(ctx.chat.id);

    if (oldGame)
        return ctx.reply('⚠️ يوجد لعبة بالفعل');

    const userName =
        ctx.from.first_name ||
        ctx.from.username ||
        'Player';

    const game = createGame(
        ctx.chat.id,
        ctx.from.id,
        userName
    );

    game.players.set(ctx.from.id, userName);

    await ctx.reply(
`🎮 تم إنشاء اللعبة بنجاح

👑 المنشئ:
➜ ${userName}

👥 اللاعبين:
➜ ${game.players.size}

📌 للدخول:
/join

🚀 للبدء:
كراسي`
    );
});

bot.command('join', async (ctx) => {

    const game = games.get(ctx.chat.id);

    if (!game)
        return ctx.reply('❌ لا توجد لعبة');

    if (game.state !== STATE.WAITING)
        return ctx.reply('⚠️ اللعبة بدأت بالفعل');

    const userName =
        ctx.from.first_name ||
        ctx.from.username ||
        'Player';

    if (game.players.has(ctx.from.id))
        return ctx.reply('✅ انت داخل بالفعل');

    game.players.set(ctx.from.id, userName);

    const list =
        [...game.players.values()]
        .map(x => `• ${x}`)
        .join('\n');

    await ctx.reply(
`🎉 انضم لاعب جديد

👤 ${userName}

👥 العدد الحالي:
${game.players.size}

━━━━━━━━━━━━━━
${list}
━━━━━━━━━━━━━━`
    );
});

async function startGame(ctx, chatId) {

    const game = games.get(chatId);

    if (!game)
        return ctx.reply('❌ لا توجد لعبة');

    if (game.state !== STATE.WAITING)
        return ctx.reply('⚠️ اللعبة بدأت بالفعل');

    if (game.players.size < 3)
        return ctx.reply('⚠️ لازم 3 لاعبين على الأقل');

    game.state = STATE.PLAYING;

    await ctx.replyWithAnimation(
        GIFS.music,
        {
            caption:
`🔥 بدأت اللعبة 🔥

🎵 الموسيقى شغالة...
استعدوا للجولة الأولى`
        }
    );

    setTimeout(() => {
        startRound(ctx.telegram, game);
    }, 4000);
}

async function startRound(telegram, game) {

    if (!games.has(game.chatId))
        return;

    game.round++;

    game.seated = new Set();

    const playerCount =
        game.players.size;

    // 3 يخسروا
    const chairCount =
        Math.max(1, playerCount - 3);

    const playersList =
        [...game.players.values()]
        .map(x => `• ${x}`)
        .join('\n');

    try {

        await telegram.sendAnimation(
            game.chatId,
            GIFS.music,
            {
                caption:
`🎵 الجولة ${game.round}

👥 اللاعبين:
${playerCount}

🪑 الكراسي:
${chairCount}

━━━━━━━━━━━━━━
${playersList}
━━━━━━━━━━━━━━

⚡ اضغط بسرعة!`
            }
        );

        const msg =
            await telegram.sendMessage(
                game.chatId,

`🪑 اقعد بسرعة قبل نفاد الكراسي!`,

                {
                    reply_markup: {
                        inline_keyboard: [
                            [
                                {
                                    text:
`🪑 اقعد (${chairCount})`,
                                    callback_data: 'sit'
                                }
                            ]
                        ]
                    }
                }
            );

        game.currentMessageId =
            msg.message_id;

        game.state = STATE.ROUND;

        game.roundTimeout =
            setTimeout(() => {

                endRound(
                    telegram,
                    game
                );

            }, 15000);

    } catch (err) {

        console.log(err.message);
    }
}

async function endRound(telegram, game) {

    if (!games.has(game.chatId))
        return;

    if (game.roundTimeout) {

        clearTimeout(
            game.roundTimeout
        );

        game.roundTimeout = null;
    }

    game.state = STATE.PLAYING;

    let losers =
        [...game.players.keys()]
        .filter(id =>
            !game.seated.has(id)
        );

    if (losers.length === 0) {

        const all =
            [...game.players.keys()];

        losers = [
            all[
                Math.floor(
                    Math.random() * all.length
                )
            ]
        ];
    }

    const loserNames =
        losers.map(id =>
            game.players.get(id)
        );

    for (const id of losers) {

        game.players.delete(id);
    }

    try {

        await telegram.editMessageReplyMarkup(
            game.chatId,
            game.currentMessageId,
            undefined,
            {
                inline_keyboard: []
            }
        );

    } catch (_) {}

    const loserText =
        loserNames
        .map(x => `❌ ${x}`)
        .join('\n');

    await telegram.sendAnimation(
        game.chatId,
        GIFS.lose,
        {
            caption:
`${loserText}

💀 خرجوا من الجولة`
        }
    );

    if (game.players.size <= 1) {

        const winner =
            [...game.players.values()][0];

        await telegram.sendAnimation(
            game.chatId,
            GIFS.win,
            {
                caption:
`🏆 الفائز الأسطوري 🏆

👑 ${winner}

🎉 مبرووووك 🔥`
            }
        );

        games.delete(game.chatId);

    } else {

        const remaining =
            [...game.players.values()]
            .map(x => `• ${x}`)
            .join('\n');

        await telegram.sendMessage(
            game.chatId,

`👥 المتبقين:

${remaining}

⏳ الجولة القادمة بعد 3 ثواني`
        );

        setTimeout(() => {

            startRound(
                telegram,
                game
            );

        }, 3000);
    }
}

bot.hears('كراسي', (ctx) => {

    startGame(
        ctx,
        ctx.chat.id
    );
});

bot.command('begin', (ctx) => {

    startGame(
        ctx,
        ctx.chat.id
    );
});

bot.action('sit', async (ctx) => {

    await ctx.answerCbQuery();

    const game =
        games.get(ctx.chat.id);

    if (!game)
        return;

    if (game.state !== STATE.ROUND)
        return;

    if (!game.players.has(ctx.from.id))
        return;

    if (game.seated.has(ctx.from.id))
        return ctx.answerCbQuery(
            '✅ انت قاعد بالفعل'
        );

    const chairCount =
        Math.max(
            1,
            game.players.size - 3
        );

    if (game.seated.size >= chairCount)
        return ctx.answerCbQuery(
            '❌ الكراسي خلصت'
        );

    game.seated.add(ctx.from.id);

    const remaining =
        chairCount -
        game.seated.size;

    try {

        await ctx.answerCbQuery(
            remaining > 0
                ? `🔥 قعدت! باقي ${remaining}`
                : '🔥 أخذت آخر كرسي!'
        );

    } catch (_) {}

    try {

        await ctx.editMessageReplyMarkup({
            inline_keyboard: [
                [
                    {
                        text:
`🪑 اقعد (${remaining})`,
                        callback_data: 'sit'
                    }
                ]
            ]
        });

    } catch (_) {}

    if (remaining <= 0) {

        try {

            await ctx.editMessageReplyMarkup({
                inline_keyboard: []
            });

        } catch (_) {}

        await endRound(
            ctx.telegram,
            game
        );
    }
});

bot.command('players', async (ctx) => {

    const game =
        games.get(ctx.chat.id);

    if (!game)
        return ctx.reply('❌ لا توجد لعبة');

    const list =
        [...game.players.values()]
        .map(x => `• ${x}`)
        .join('\n');

    await ctx.reply(
`👥 اللاعبون الحاليون (${game.players.size})

━━━━━━━━━━━━━━
${list}
━━━━━━━━━━━━━━`
    );
});

bot.command('end', async (ctx) => {

    const game =
        games.get(ctx.chat.id);

    if (!game)
        return ctx.reply('❌ لا توجد لعبة');

    if (game.roundTimeout)
        clearTimeout(game.roundTimeout);

    games.delete(ctx.chat.id);

    await ctx.reply(
`🛑 تم إنهاء اللعبة`
    );
});

bot.launch();

console.log('🤖 PRO MAX Chairs Game Started');
