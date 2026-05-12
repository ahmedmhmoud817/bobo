const { Telegraf } = require('telegraf');

const bot = new Telegraf('7941587092:AAEc_oauDfPmy9_RDUH7OpeIKUxi0HGx71U');

const games = new Map();

const STATE = {
  WAITING: 'waiting',
  PLAYING: 'playing',
  ROUND: 'round',
};

function createGame(chatId, creatorId, creatorName) {
  const game = {
    chatId,
    creator: { id: creatorId, name: creatorName },
    players: new Map(),
    state: STATE.WAITING,
    round: 0,
    roundTimeout: null,
    currentMessageId: null,
    seated: new Set(),
  };

  games.set(chatId, game);
  return game;
}

bot.command('create', async (ctx) => {

  const chatId = ctx.chat.id;
  const existing = games.get(chatId);

  if (existing && existing.state !== STATE.WAITING) {
    return ctx.reply('⚠️ يوجد لعبة جارية بالفعل!');
  }

  const userId = ctx.from.id;
  const userName = ctx.from.first_name || ctx.from.username || 'لاعب';

  const game = createGame(chatId, userId, userName);

  game.players.set(userId, userName);

  await ctx.reply(
    `🎮 تم إنشاء لعبة Chairs Game!\n\n` +
    `👥 اللاعبون (${game.players.size})\n` +
    `• ${userName}\n\n` +
    `📌 للدخول اكتب /join\n` +
    `▶️ للبدء اكتب كراسي`
  );
});

bot.command('join', async (ctx) => {

  const chatId = ctx.chat.id;
  const game = games.get(chatId);

  if (!game)
    return ctx.reply('❌ لا توجد لعبة حالياً');

  if (game.state !== STATE.WAITING)
    return ctx.reply('⚠️ اللعبة بدأت بالفعل');

  const userId = ctx.from.id;
  const userName = ctx.from.first_name || ctx.from.username || 'لاعب';

  if (game.players.has(userId))
    return ctx.reply('✅ انت داخل بالفعل');

  game.players.set(userId, userName);

  const playerList = [...game.players.values()]
    .map((n) => `• ${n}`)
    .join('\n');

  await ctx.reply(
    `✅ انضم ${userName}\n\n` +
    `👥 اللاعبون (${game.players.size})\n${playerList}`
  );
});

async function startGame(ctx, chatId) {

  const game = games.get(chatId);

  if (!game)
    return ctx.reply('❌ لا توجد لعبة');

  if (game.state !== STATE.WAITING)
    return ctx.reply('⚠️ اللعبة بدأت بالفعل');

  if (game.players.size < 3)
    return ctx.reply('❌ تحتاج 3 لاعبين على الأقل');

  game.state = STATE.PLAYING;

  await ctx.reply(
    `🎮 بدأت اللعبة!\n\n` +
    `⏳ الجولة الأولى بعد 3 ثواني...`
  );

  setTimeout(() => startRound(ctx.telegram, game), 3000);
}

async function startRound(telegram, game) {

  if (!games.has(game.chatId))
    return;

  game.round++;
  game.seated = new Set();

  const playerCount = game.players.size;

  // هنا التعديل
  const chairCount = Math.max(1, playerCount - 3);

  const playerList = [...game.players.values()]
    .map((n) => `• ${n}`)
    .join('\n');

  try {

    const msg = await telegram.sendMessage(
      game.chatId,

      `🎵 الجولة ${game.round}\n\n` +
      `👥 اللاعبون (${playerCount})\n${playerList}\n\n` +
      `🪑 عدد الكراسي: ${chairCount}\n\n` +
      `⏱️ اضغط بسرعة خلال 20 ثانية`,

      {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: `🪑 اقعد (${chairCount})`,
                callback_data: 'sit'
              }
            ]
          ]
        }
      }
    );

    game.currentMessageId = msg.message_id;

    game.state = STATE.ROUND;

    game.roundTimeout = setTimeout(() => {
      endRound(telegram, game, true);
    }, 20000);

  } catch (err) {

    console.log(err.message);
  }
}

async function endRound(telegram, game, timeout = false) {

  if (!games.has(game.chatId))
    return;

  if (game.roundTimeout) {
    clearTimeout(game.roundTimeout);
    game.roundTimeout = null;
  }

  game.state = STATE.PLAYING;

  let losers = [...game.players.keys()]
    .filter((id) => !game.seated.has(id));

  if (losers.length === 0) {

    const allPlayers = [...game.players.keys()];

    losers = [
      allPlayers[Math.floor(Math.random() * allPlayers.length)]
    ];
  }

  const loserNames = losers.map((id) =>
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
      { inline_keyboard: [] }
    );

  } catch (_) {}

  const loserText = loserNames
    .map((n) => `❌ ${n}`)
    .join('\n');

  if (game.players.size <= 1) {

    const winner = [...game.players.values()][0];

    await telegram.sendMessage(
      game.chatId,

      `${loserText}\n\n` +
      `🏆 الفائز هو ${winner} 🎉`
    );

    games.delete(game.chatId);

  } else {

    const remaining = [...game.players.values()]
      .map((n) => `• ${n}`)
      .join('\n');

    await telegram.sendMessage(
      game.chatId,

      `${loserText}\n\n` +
      `👥 المتبقين (${game.players.size})\n${remaining}\n\n` +
      `⏳ الجولة التالية بعد 3 ثواني`
    );

    setTimeout(() => {
      startRound(telegram, game);
    }, 3000);
  }
}

bot.command('begin', (ctx) => {
  startGame(ctx, ctx.chat.id);
});

bot.hears('كراسي', (ctx) => {
  startGame(ctx, ctx.chat.id);
});

bot.action('sit', async (ctx) => {

  await ctx.answerCbQuery();

  const chatId = ctx.chat.id;

  const game = games.get(chatId);

  if (!game || game.state !== STATE.ROUND)
    return;

  const userId = ctx.from.id;

  if (!game.players.has(userId))
    return ctx.answerCbQuery('❌ انت لست داخل اللعبة');

  if (game.seated.has(userId))
    return ctx.answerCbQuery('✅ انت قاعد بالفعل');

  // هنا التعديل
  const chairCount = Math.max(1, game.players.size - 3);

  if (game.seated.size >= chairCount)
    return ctx.answerCbQuery('❌ لا توجد كراسي متبقية');

  game.seated.add(userId);

  const remaining = chairCount - game.seated.size;

  try {

    await ctx.answerCbQuery(
      remaining > 0
        ? `✅ قعدت! متبقي ${remaining}`
        : '✅ اخدت آخر كرسي!'
    );

  } catch (_) {}

  if (remaining > 0) {

    try {

      await ctx.editMessageReplyMarkup({
        inline_keyboard: [
          [
            {
              text: `🪑 اقعد (${remaining})`,
              callback_data: 'sit'
            }
          ]
        ]
      });

    } catch (_) {}

  } else {

    try {

      await ctx.editMessageReplyMarkup({
        inline_keyboard: []
      });

    } catch (_) {}

    await endRound(ctx.telegram, game);
  }
});

bot.command('end', async (ctx) => {

  const chatId = ctx.chat.id;

  const game = games.get(chatId);

  if (!game)
    return ctx.reply('❌ لا توجد لعبة');

  if (game.roundTimeout)
    clearTimeout(game.roundTimeout);

  games.delete(chatId);

  await ctx.reply('🛑 تم إنهاء اللعبة');
});

bot.launch();

console.log('🤖 Chairs Game Bot يعمل الآن...');
