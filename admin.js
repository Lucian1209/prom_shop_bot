module.exports = function (bot, orders, adminOrders) {
  bot.onText(/\/admin/, (msg) => {
    if (msg.chat.id.toString() !== process.env.ADMIN_CHAT_ID) return;

    bot.sendMessage(msg.chat.id, 'Панель адміністратора:', {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🧾 Останні замовлення', callback_data: 'admin_orders' }],
          [{ text: '📢 Розсилка (в розробці)', callback_data: 'admin_broadcast' }],
          [{ text: '➕ Додати товар (в розробці)', callback_data: 'admin_add' }]
        ]
      }
    });
  });

  bot.on('callback_query', (query) => {
    const chatId = query.message.chat.id;
    const data = query.data;

    if (data === 'admin_orders') {
      if (chatId.toString() !== process.env.ADMIN_CHAT_ID) return;
      if (adminOrders.length === 0) {
        return bot.sendMessage(chatId, 'Замовлень поки немає.');
      }

      const last = adminOrders.slice(-5).reverse();
      const message = last.map((o, i) =>
        `#${last.length - i}: ${o.product}\n${o.name}, ${o.phone}\n${o.address}`
      ).join('\n\n');

      return bot.sendMessage(chatId, `🧾 *Останні замовлення:*\n\n${message}`, { parse_mode: 'Markdown' });
    }
  });
};