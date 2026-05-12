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
    return ctx.reply('⚠️ يوجد لعبة جارية بالفعل! استخدم /end لإنهائها.');
  }
  const userId = ctx.from.id;
  const userName = ctx.from.first_name || ctx.from.username || 'لاعب';
  const game = createGame(chatId, userId, userName);
  game.players.set(userId, userName);
  await ctx.reply(
    `🎮 تم إنشاء لعبة *Chairs Game* بواسطة ${userName}!\n\n` +
    `👥 اللاعبون (1):\n• ${userName}\n\n` +
    `📌 انضم إلى اللعبة بكتابة /join\n` +
    `▶️ ابدأ اللعبة بكتابة /begin أو "كراسي"`,
    { parse_mode: 'Markdown' }
  );
});

bot.command('join', async (ctx) => {
  const chatId = ctx.chat.id;
  const game = games.get(chatId);
  if (!game) return ctx.reply('❌ لا توجد لعبة. أنشئ واحدة بـ /create');
  if (game.state !== STATE.WAITING) return ctx.reply('⚠️ اللعبة بدأت بالفعل!');
  const userId = ctx.from.id;
  const userName = ctx.from.first_name || ctx.from.username || 'لاعب';
  if (game.players.has(userId)) return ctx.reply('⚠️ أنت مشارك في اللعبة بالفعل!');
  game.players.set(userId, userName);
  const playerList = [...game.players.values()].map((n) => `• ${n}`).join('\n');
  await ctx.reply(
    `✅ انضم *${userName}* إلى اللعبة!\n\n` +
    `👥 اللاعبون (${game.players.size}):\n${playerList}\n\n` +
    `▶️ ابدأ اللعبة بكتابة /begin أو "كراسي"`,
    { parse_mode: 'Markdown' }
  );
});

async function startGame(ctx, chatId) {
  const game = games.get(chatId);
  if (!game) return ctx.reply('❌ لا توجد لعبة. أنشئ واحدة بـ /create');
  if (game.state !== STATE.WAITING) return ctx.reply('⚠️ اللعبة بدأت بالفعل!');
  if (game.players.size < 3) return ctx.reply('⚠️ تحتاج على الأقل 3 لاعبين لبدء اللعبة!');
  game.state = STATE.PLAYING;
  const playerList = [...game.players.values()].map((n) => `• ${n}`).join('\n');
  await ctx.reply(
    `🎮 بدأت لعبة *Chairs Game*!\n\n` +
    `👥 اللاعبون (${game.players.size}):\n${playerList}\n\n` +
    `⏳ تبدأ الجولة الأولى خلال 3 ثوانٍ...`,
    { parse_mode: 'Markdown' }
  );
  setTimeout(() => startRound(ctx.telegram, game), 3000);
}

async function startRound(telegram, game) {
  if (!games.has(game.chatId)) return;
  game.round++;
  game.seated = new Set();
  const playerCount = game.players.size;
  const chairCount = Math.max(1, playerCount - 2);
  const playerList = [...game.players.values()].map((n) => `• ${n}`).join('\n');
  try {
    const msg = await telegram.sendMessage(
      game.chatId,
      `🎵 *الجولة ${game.round}*\n\n` +
      `👥 اللاعبون (${playerCount}):\n${playerList}\n\n` +
      `🪑 الكراسي المتاحة: *${chairCount}*\n\n` +
      `اضغط الزر قبل نفاد الكراسي! ⏱ *20 ثانية*`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[{ text: `🪑 اقعد  (${chairCount} كرسي متبقي)`, callback_data: 'sit' }]],
        },
      }
    );
    game.currentMessageId = msg.message_id;
    game.state = STATE.ROUND;
    game.roundTimeout = setTimeout(() => endRound(telegram, game, true), 20000);
  } catch (err) {
    console.error('خطأ في بدء الجولة:', err.message);
  }
}

async function endRound(telegram, game, isTimeout = false) {
  if (!games.has(game.chatId)) return;
  if (game.roundTimeout) { clearTimeout(game.roundTimeout); game.roundTimeout = null; }
  game.state = STATE.PLAYING;
  let standingPlayers = [...game.players.keys()].filter((id) => !game.seated.has(id));
  if (standingPlayers.length === 0) {
    const allPlayers = [...game.players.keys()];
    standingPlayers = [allPlayers[Math.floor(Math.random() * allPlayers.length)]];
  }
  const eliminatedNames = standingPlayers.map((id) => game.players.get(id));
  for (const id of standingPlayers) game.players.delete(id);
  try {
    await telegram.editMessageReplyMarkup(game.chatId, game.currentMessageId, undefined, { inline_keyboard: [] });
  } catch (_) {}
  const eliminatedList = eliminatedNames.map((n) => `❌ ${n}`).join('\n');
  const timeoutNote = isTimeout ? `\n⏱ انتهى الوقت — تم استبعاد المتأخرين` : '';
  if (game.players.size <= 1) {
    const winnerName = [...game.players.values()][0] || '—';
    await telegram.sendMessage(
      game.chatId,
      `${eliminatedList}${timeoutNote}\n\n🏆 *انتهت اللعبة!*\n\n🎉 الفائز: *${winnerName}* — مبروك! 🎊`,
      { parse_mode: 'Markdown' }
    );
    games.delete(game.chatId);
  } else {
    const remainingList = [...game.players.values()].map((n) => `• ${n}`).join('\n');
    await telegram.sendMessage(
      game.chatId,
      `${eliminatedList}${timeoutNote}\n\n👥 اللاعبون المتبقون (${game.players.size}):\n${remainingList}\n\n⏳ الجولة التالية خلال 3 ثوانٍ...`,
      { parse_mode: 'Markdown' }
    );
    setTimeout(() => startRound(telegram, game), 3000);
  }
}

bot.command('begin', (ctx) => startGame(ctx, ctx.chat.id));
bot.hears('كراسي', (ctx) => startGame(ctx, ctx.chat.id));

bot.action('sit', async (ctx) => {
  await ctx.answerCbQuery();
  const chatId = ctx.chat.id;
  const game = games.get(chatId);
  if (!game || game.state !== STATE.ROUND) return ctx.answerCbQuery('⚠️ لا توجد جولة نشطة حالياً');
  const userId = ctx.from.id;
  if (!game.players.has(userId)) return ctx.answerCbQuery('❌ أنت لست ضمن لاعبي هذه اللعبة!');
  if (game.seated.has(userId)) return ctx.answerCbQuery('✅ أنت جالس بالفعل على كرسي!');
  const chairCount = Math.max(1, game.players.size - 2);
  if (game.seated.size >= chairCount) return ctx.answerCbQuery('❌ لا يوجد كراسي متبقية — أنت خارج الجولة!');
  game.seated.add(userId);
  const remaining = chairCount - game.seated.size;
  try {
    await ctx.answerCbQuery(remaining > 0 ? `✅ جلست على كرسي! تبقّى ${remaining} كرسي` : '✅ أخذت آخر كرسي!');
  } catch (_) {}
  if (remaining > 0) {
    try {
      await ctx.editMessageReplyMarkup({ inline_keyboard: [[{ text: `🪑 اقعد  (${remaining} كرسي متبقي)`, callback_data: 'sit' }]] });
    } catch (_) {}
  } else {
    try { await ctx.editMessageReplyMarkup({ inline_keyboard: [] }); } catch (_) {}
    await endRound(ctx.telegram, game);
  }
});

bot.command('end', async (ctx) => {
  const chatId = ctx.chat.id;
  const game = games.get(chatId);
  if (!game) return ctx.reply('❌ لا توجد لعبة نشطة.');
  if (game.roundTimeout) clearTimeout(game.roundTimeout);
  games.delete(chatId);
  await ctx.reply('🛑 تم إنهاء اللعبة.');
});

bot.command('players', async (ctx) => {
  const chatId = ctx.chat.id;
  const game = games.get(chatId);
  if (!game) return ctx.reply('❌ لا توجد لعبة نشطة.');
  const playerList = [...game.players.values()].map((n) => `• ${n}`).join('\n');
  await ctx.reply(`👥 اللاعبون الحاليون (${game.players.size}):\n${playerList}`, { parse_mode: 'Markdown' });
});

bot.command('help', async (ctx) => {
  await ctx.reply(
    `🎮 *Chairs Game — دليل الأوامر*\n\n` +
    `/create — إنشاء لعبة جديدة\n/join — الانضمام إلى اللعبة\n` +
    `/begin أو كراسي — بدء اللعبة\n/players — عرض قائمة اللاعبين\n/end — إنهاء اللعبة\n\n` +
    `*طريقة اللعب:*\nكل جولة يظهر زر 🪑 اقعد — اضغطه قبل نفاد الكراسي!\n` +
    `عدد الكراسي أقل بـ 2 من عدد اللاعبين.\nتستمر الجولات حتى يبقى فائز واحد 🏆`,
    { parse_mode: 'Markdown' }
  );
});

bot.launch().then(() => console.log('🤖 Chairs Game Bot يعمل الآن...'));
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));