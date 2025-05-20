module.exports = function (bot, orders, adminOrders) {
  const broadcastState = {};
  const addProductState = {};

  bot.onText(/\/admin/, (msg) => {
    if (msg.chat.id.toString() !== process.env.ADMIN_CHAT_ID) return;

    bot.sendMessage(msg.chat.id, 'Панель адміністратора:', {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🧾 Останні замовлення', callback_data: 'admin_orders' }],
          [{ text: '📢 Розсилка', callback_data: 'admin_broadcast' }],
          [{ text: '➕ Додати товар', callback_data: 'admin_add' }]
        ]
      }
    });
  });

  bot.on('callback_query', (query) => {
    const chatId = query.message.chat.id;
    const data = query.data;

    if (chatId.toString() !== process.env.ADMIN_CHAT_ID) return;

    if (data === 'admin_orders') {
      if (adminOrders.length === 0) {
        return bot.sendMessage(chatId, 'Замовлень поки немає.');
      }

      const last = adminOrders.slice(-5).reverse();
      const message = last.map((o, i) =>
        `#${last.length - i}: ${o.product}\n${o.name}, ${o.phone}\n${o.address}`
      ).join('\n\n');

      return bot.sendMessage(chatId, `🧾 *Останні замовлення:*\n\n${message}`, { parse_mode: 'Markdown' });
    }

    if (data === 'admin_broadcast') {
      broadcastState[chatId] = true;
      return bot.sendMessage(chatId, 'Введіть текст для розсилки всім користувачам:');
    }

    if (data === 'admin_add') {
      addProductState[chatId] = { step: 'name' };
      return bot.sendMessage(chatId, 'Введіть назву товару:');
    }
  });

  bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    // Розсилка
    if (broadcastState[chatId]) {
      broadcastState[chatId] = false;
      bot.sendMessage(chatId, 'Розсилка запущена...');
      // Тут можна реалізувати збереження userId десь і надсилати їм
      // Для прикладу надсилаємо тільки адміну
      bot.sendMessage(chatId, 'Тестова розсилка: ' + text);
      return;
    }

    // Додавання товару
    if (addProductState[chatId]) {
      const state = addProductState[chatId];

      if (state.step === 'name') {
        state.name = text;
        state.step = 'price';
        return bot.sendMessage(chatId, 'Введіть ціну товару (в грн):');
      }

      if (state.step === 'price') {
        state.price = text;
        state.step = 'desc';
        return bot.sendMessage(chatId, 'Введіть опис товару:');
      }

      if (state.step === 'desc') {
        const product = {
          name: state.name,
          price: state.price,
          description: text
        };
        delete addProductState[chatId];

        return bot.sendMessage(chatId, `✅ Товар додано:

*${product.name}*
Ціна: ${product.price} грн
Опис: ${product.description}`, {
          parse_mode: 'Markdown'
        });
      }
    }
  });
};