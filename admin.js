// Покращена адміністративна панель
module.exports = function (bot, orders, adminOrders) {
  // Зберігаємо стан для різних функцій
  const adminStates = {};
  
  // Хелпер для очищення стану
  const clearState = (chatId) => {
    if (adminStates[chatId]) {
      delete adminStates[chatId];
    }
  };

  // Головне меню адміністратора
  bot.onText(/\/admin/, (msg) => {
    const chatId = msg.chat.id;
    
    if (chatId.toString() !== process.env.ADMIN_CHAT_ID) return;
    
    // Очищаємо попередній стан
    clearState(chatId);

    bot.sendMessage(chatId, '🔐 *Панель адміністратора*', {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '📊 Статистика', callback_data: 'admin_stats' }],
          [{ text: '🧾 Замовлення', callback_data: 'admin_orders' }],
          [{ text: '🛍️ Управління товарами', callback_data: 'admin_products' }],
          [{ text: '📢 Розсилка', callback_data: 'admin_broadcast' }]
        ]
      }
    });
  });

  // Обробник callback-запитів для адмін-панелі
  bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const messageId = query.message.message_id;
    const data = query.data;

    // Перевіряємо, чи це адмін
    if (chatId.toString() !== process.env.ADMIN_CHAT_ID) return;
    
    // Відповідаємо на callback, щоб прибрати "годинник"
    bot.answerCallbackQuery(query.id);

    // Повернення до головного меню адміна
    if (data === 'admin_back') {
      clearState(chatId);
      
      bot.editMessageText('🔐 *Панель адміністратора*', {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '📊 Статистика', callback_data: 'admin_stats' }],
            [{ text: '🧾 Замовлення', callback_data: 'admin_orders' }],
            [{ text: '🛍️ Управління товарами', callback_data: 'admin_products' }],
            [{ text: '📢 Розсилка', callback_data: 'admin_broadcast' }]
          ]
        }
      });
      return;
    }

    // ----- СТАТИСТИКА -----
    if (data === 'admin_stats') {
      // Обчислюємо статистику замовлень
      const totalOrders = adminOrders.length;
      
      // Замовлення за останні 24 години
      const last24Hours = adminOrders.filter(order => {
        const orderDate = new Date(order.date);
        const now = new Date();
        const diff = now - orderDate;
        return diff < 24 * 60 * 60 * 1000; // 24 години в мілісекундах
      }).length;
      
      // Замовлення за останній тиждень
      const lastWeek = adminOrders.filter(order => {
        const orderDate = new Date(order.date);
        const now = new Date();
        const diff = now - orderDate;
        return diff < 7 * 24 * 60 * 60 * 1000; // 7 днів у мілісекундах
      }).length;
      
      // Найпопулярніші товари (топ-3)
      const productCounts = {};
      adminOrders.forEach(order => {
        productCounts[order.product] = (productCounts[order.product] || 0) + 1;
      });
      
      // Сортуємо за популярністю
      const topProducts = Object.entries(productCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([name, count], index) => `${index + 1}. ${name} - ${count} замовл.`)
        .join('\n');
      
      bot.editMessageText(
        `📊 *Статистика замовлень*\n\n` +
        `Всього замовлень: *${totalOrders}*\n` +
        `За останні 24 години: *${last24Hours}*\n` +
        `За останній тиждень: *${lastWeek}*\n\n` +
        `*Найпопулярніші товари:*\n${topProducts || 'Недостатньо даних'}`,
        {
          chat_id: chatId,
          message_id: messageId,
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '« Назад', callback_data: 'admin_back' }]
            ]
          }
        }
      );
      return;
    }

    // ----- ЗАМОВЛЕННЯ -----
    if (data === 'admin_orders') {
      if (adminOrders.length === 0) {
        bot.editMessageText('📝 *Замовлення*\n\nЗамовлень поки немає.', {
          chat_id: chatId,
          message_id: messageId,
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '« Назад', callback_data: 'admin_back' }]
            ]
          }
        });
        return;
      }

      // Показуємо меню опцій для замовлень
      bot.editMessageText('📝 *Управління замовленнями*\n\nОберіть опцію:', {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '📋 Останні замовлення', callback_data: 'admin_orders_recent' }],
            [{ text: '🔍 Пошук замовлень', callback_data: 'admin_orders_search' }],
            [{ text: '📅 За період', callback_data: 'admin_orders_period' }],
            [{ text: '« Назад', callback_data: 'admin_back' }]
          ]
        }
      });
      return;
    }

    // Останні замовлення
    if (data === 'admin_orders_recent') {
      // Отримуємо останні 5 замовлень і сортуємо в зворотньому порядку
      const recent = adminOrders.slice(-5).reverse();
      
      let message = '📋 *Останні замовлення:*\n\n';
      
      recent.forEach((order, i) => {
        const orderDate = new Date(order.date);
        const formattedDate = `${orderDate.getDate().toString().padStart(2, '0')}.${(orderDate.getMonth() + 1).toString().padStart(2, '0')}.${orderDate.getFullYear()} ${orderDate.getHours().toString().padStart(2, '0')}:${orderDate.getMinutes().toString().padStart(2, '0')}`;
        
        message += `*#${recent.length - i}* (${formattedDate})\n`;
        message += `📦 Товар: ${order.product}\n`;
        message += `👤 Клієнт: ${order.name}\n`;
        message += `📞 Телефон: ${order.phone}\n`;
        message += `🏠 Адреса: ${order.address}\n\n`;
      });
      
      // Кнопки для керування замовленнями
      const keyboard = recent.map((order, i) => [
        { text: `✏️ Змінити статус #${recent.length - i}`, callback_data: `admin_order_status_${order.id}` }
      ]);
      
      // Додаємо кнопку для повернення
      keyboard.push([{ text: '« Назад', callback_data: 'admin_orders' }]);
      
      bot.editMessageText(message, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: keyboard
        }
      });
      return;
    }

    // Зміна статусу замовлення
    if (data.startsWith('admin_order_status_')) {
      const orderId = data.split('admin_order_status_')[1];
      
      // Знаходимо замовлення за ID
      const order = adminOrders.find(o => o.id.toString() === orderId);
      
      if (!order) {
        bot.sendMessage(chatId, '❌ Замовлення не знайдено');
        return;
      }
      
      // Показуємо можливі статуси
      bot.editMessageText(
        `✏️ *Зміна статусу замовлення #${orderId}*\n\n` +
        `📦 Товар: ${order.product}\n` +
        `👤 Клієнт: ${order.name}\n` +
        `📞 Телефон: ${order.phone}\n` +
        `Поточний статус: ${order.status || 'Новий'}\n\n` +
        `Оберіть новий статус:`,
        {
          chat_id: chatId,
          message_id: messageId,
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '🆕 Новий', callback_data: `admin_set_status_${orderId}_new` }],
              [{ text: '✅ Підтверджено', callback_data: `admin_set_status_${orderId}_confirmed` }],
              [{ text: '🚚 Відправлено', callback_data: `admin_set_status_${orderId}_shipped` }],
              [{ text: '✓ Доставлено', callback_data: `admin_set_status_${orderId}_delivered` }],
              [{ text: '❌ Скасовано', callback_data: `admin_set_status_${orderId}_canceled` }],
              [{ text: '« Назад', callback_data: 'admin_orders_recent' }]
            ]
          }
        }
      );
      return;
    }

    // Встановлення нового статусу
    if (data.startsWith('admin_set_status_')) {
      const parts = data.split('_');
      const orderId = parts[3];
      const newStatus = parts[4];
      
      // Знаходимо замовлення за ID
      const orderIndex = adminOrders.findIndex(o => o.id.toString() === orderId);
      
      if (orderIndex === -1) {
        bot.sendMessage(chatId, '❌ Замовлення не знайдено');
        return;
      }
      
      // Мапа статусів для відображення
      const statusMap = {
        'new': 'Новий',
        'confirmed': 'Підтверджено',
        'shipped': 'Відправлено',
        'delivered': 'Доставлено',
        'canceled': 'Скасовано'
      };
      
      // Оновлюємо статус
      adminOrders[orderIndex].status = statusMap[newStatus];
      
      // Інформуємо користувача про зміну статусу
      if (newStatus !== 'new' && adminOrders[orderIndex].userId) {
        bot.sendMessage(
          adminOrders[orderIndex].userId,
          `🔔 *Статус вашого замовлення оновлено*\n\n` +
          `📦 Товар: ${adminOrders[orderIndex].product}\n` +
          `Статус: *${statusMap[newStatus]}*`,
          { parse_mode: 'Markdown' }
        ).catch(error => {
          // Якщо не вдалося надіслати повідомлення, просто ігноруємо помилку
          console.error('Не вдалося надіслати повідомлення користувачу:', error.message);
        });
      }
      
      // Повідомляємо адміна
      bot.editMessageText(
        `✅ Статус замовлення #${orderId} успішно змінено на *${statusMap[newStatus]}*`,
        {
          chat_id: chatId,
          message_id: messageId,
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '« Назад до замовлень', callback_data: 'admin_orders_recent' }]
            ]
          }
        }
      );
      return;
    }

    // Пошук замовлень
    if (data === 'admin_orders_search') {
      // Встановлюємо стан пошуку
      adminStates[chatId] = { action: 'search_orders' };
      
      bot.editMessageText(
        '🔍 *Пошук замовлень*\n\n' +
        'Введіть запит для пошуку (ім\'я клієнта, номер телефону або назву товару):',
        {
          chat_id: chatId,
          message_id: messageId,
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '« Скасувати', callback_data: 'admin_orders' }]
            ]
          }
        }
      );
      return;
    }

    // ----- УПРАВЛІННЯ ТОВАРАМИ -----
    if (data === 'admin_products') {
      bot.editMessageText('🛍️ *Управління товарами*\n\nОберіть опцію:', {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '➕ Додати товар', callback_data: 'admin_add_product' }],
            [{ text: '📋 Список товарів', callback_data: 'admin_list_products' }],
            [{ text: '🔄 Синхронізувати з Prom.ua', callback_data: 'admin_sync_products' }],
            [{ text: '« Назад', callback_data: 'admin_back' }]
          ]
        }
      });
      return;
    }

    // Додавання товару
    if (data === 'admin_add_product') {
      adminStates[chatId] = { action: 'add_product', step: 'name' };
      
      bot.editMessageText(
        '➕ *Додавання нового товару*\n\n' +
        'Введіть назву товару:',
        {
          chat_id: chatId,
          message_id: messageId,
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '« Скасувати', callback_data: 'admin_products' }]
            ]
          }
        }
      );
      return;
    }

    // Синхронізація товарів з Prom.ua
    if (data === 'admin_sync_products') {
      bot.editMessageText(
        '🔄 *Синхронізація товарів з Prom.ua*\n\n' +
        'Початок синхронізації... Будь ласка, зачекайте.',
        {
          chat_id: chatId,
          message_id: messageId,
          parse_mode: 'Markdown'
        }
      );
      
      try {
        // Тут має бути логіка синхронізації з Prom.ua API
        // Для прикладу робимо затримку
        setTimeout(() => {
          bot.editMessageText(
            '✅ *Синхронізацію успішно завершено*\n\n' +
            'Всі товари з Prom.ua успішно синхронізовані.',
            {
              chat_id: chatId,
              message_id: messageId,
              parse_mode: 'Markdown',
              reply_markup: {
                inline_keyboard: [
                  [{ text: '« Назад', callback_data: 'admin_products' }]
                ]
              }
            }
          );
        }, 2000);
      } catch (error) {
        bot.editMessageText(
          '❌ *Помилка синхронізації*\n\n' +
          `Сталася помилка: ${error.message}`,
          {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [{ text: '« Назад', callback_data: 'admin_products' }]
              ]
            }
          }
        );
      }
      return;
    }

    // ----- РОЗСИЛКА -----
    if (data === 'admin_broadcast') {
      bot.editMessageText(
        '📢 *Розсилка повідомлень*\n\n' +
        'Оберіть тип розсилки:',
        {
          chat_id: chatId,
          message_id: messageId,
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '👥 Всім користувачам', callback_data: 'admin_broadcast_all' }],
              [{ text: '🛒 Лише клієнтам з замовленнями', callback_data: 'admin_broadcast_customers' }],
              [{ text: '🆕 Розсилка з кнопками', callback_data: 'admin_broadcast_buttons' }],
              [{ text: '« Назад', callback_data: 'admin_back' }]
            ]
          }
        }
      );
      return;
    }

    // Розсилка всім користувачам
    if (data === 'admin_broadcast_all') {
      adminStates[chatId] = { action: 'broadcast', type: 'all' };
      
      bot.editMessageText(
        '📢 *Розсилка всім користувачам*\n\n' +
        'Введіть текст повідомлення для розсилки:',
        {
          chat_id: chatId,
          message_id: messageId,
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '« Скасувати', callback_data: 'admin_broadcast' }]
            ]
          }
        }
      );
      return;
    }

    // Розсилка лише клієнтам
    if (data === 'admin_broadcast_customers') {
      adminStates[chatId] = { action: 'broadcast', type: 'customers' };
      
      bot.editMessageText(
        '📢 *Розсилка клієнтам з замовленнями*\n\n' +
        'Введіть текст повідомлення для розсилки:',
        {
          chat_id: chatId,
          message_id: messageId,
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '« Скасувати', callback_data: 'admin_broadcast' }]
            ]
          }
        }
      );
      return;
    }

    // Розсилка з кнопками
    if (data === 'admin_broadcast_buttons') {
      adminStates[chatId] = { action: 'broadcast', type: 'buttons', step: 'text' };
      
      bot.editMessageText(
        '📢 *Розсилка з кнопками*\n\n' +
        'Введіть текст повідомлення для розсилки:',
        {
          chat_id: chatId,
          message_id: messageId,
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '« Скасувати', callback_data: 'admin_broadcast' }]
            ]
          }
        }
      );
      return;
    }
  });

  // Обробник повідомлень для адмінки
  bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text || '';
    
    // Перевіряємо, чи це адмін
    if (chatId.toString() !== process.env.ADMIN_CHAT_ID) return;
    
    // Перевіряємо, чи є активний стан для цього чату
    if (!adminStates[chatId]) return;
    
    const state = adminStates[chatId];

    // ----- ОБРОБКА ПОШУКУ ЗАМОВЛЕНЬ -----
    if (state.action === 'search_orders') {
      // Очищаємо стан
      clearState(chatId);
      
      // Пошук замовлень за текстом
      const query = text.toLowerCase();
      const results = adminOrders.filter(order => 
        order.name.toLowerCase().includes(query) || 
        order.phone.toLowerCase().includes(query) || 
        order.product.toLowerCase().includes(query) ||
        (order.address && order.address.toLowerCase().includes(query))
      );
      
      if (results.length === 0) {
        bot.sendMessage(chatId, 
          '🔍 *Результати пошуку*\n\nЗа вашим запитом нічого не знайдено.',
          {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [{ text: '« Назад', callback_data: 'admin_orders' }]
              ]
            }
          }
        );
        return;
      }
      
      // Обмежуємо результати до перших 5
      const limitedResults = results.slice(0, 5);
      
      let message = `🔍 *Результати пошуку за "${text}"*\n\n`;
      
      limitedResults.forEach((order, i) => {
        const orderDate = new Date(order.date);
        const formattedDate = `${orderDate.getDate().toString().padStart(2, '0')}.${(orderDate.getMonth() + 1).toString().padStart(2, '0')}.${orderDate.getFullYear()}`;
        
        message += `*#${order.id}* (${formattedDate})\n`;
        message += `📦 Товар: ${order.product}\n`;
        message += `👤 Клієнт: ${order.name}\n`;
        message += `📞 Телефон: ${order.phone}\n`;
        message += `🏠 Адреса: ${order.address || 'Не вказано'}\n\n`;
      });
      
      if (results.length > 5) {
        message += `_...та ще ${results.length - 5} результатів_`;
      }
      
      // Кнопки для зміни статусу знайдених замовлень
      const keyboard = limitedResults.map(order => [
        { text: `✏️ Статус #${order.id}`, callback_data: `admin_order_status_${order.id}` }
      ]);
      
      // Додаємо кнопку для повернення
      keyboard.push([{ text: '« Назад', callback_data: 'admin_orders' }]);
      
      bot.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: keyboard
        }
      });
      return;
    }

    // ----- ОБРОБКА ДОДАВАННЯ ТОВАРУ -----
    if (state.action === 'add_product') {
      if (state.step === 'name') {
        state.name = text;
        state.step = 'price';
        
        bot.sendMessage(chatId, 
          '✅ Назву товару збережено.\n\nВведіть ціну товару (в грн):',
          {
            reply_markup: {
              inline_keyboard: [
                [{ text: '« Скасувати', callback_data: 'admin_products' }]
              ]
            }
          }
        );
        return;
      }
      
      if (state.step === 'price') {
        // Перевіряємо, чи це число
        const price = parseFloat(text.replace(/[^\d.]/g, ''));
        
        if (isNaN(price)) {
          bot.sendMessage(chatId, 
            '❌ Некоректна ціна. Будь ласка, введіть числове значення:',
            {
              reply_markup: {
                inline_keyboard: [
                  [{ text: '« Скасувати', callback_data: 'admin_products' }]
                ]
              }
            }
          );
          return;
        }
        
        state.price = price;
        state.step = 'description';
        
        bot.sendMessage(chatId, 
          '✅ Ціну товару збережено.\n\nВведіть опис товару:',
          {
            reply_markup: {
              inline_keyboard: [
                [{ text: '« Скасувати', callback_data: 'admin_products' }]
              ]
            }
          }
        );
        return;
      }
      
      if (state.step === 'description') {
        state.description = text;
        state.step = 'image';
        
        bot.sendMessage(chatId, 
          '✅ Опис товару збережено.\n\nТепер надішліть фото товару або натисніть "Пропустити":',
          {
            reply_markup: {
              inline_keyboard: [
                [{ text: '⏩ Пропустити', callback_data: 'admin_skip_image' }],
                [{ text: '« Скасувати', callback_data: 'admin_products' }]
              ]
            }
          }
        );
        return;
      }
    }

    // ----- ОБРОБКА РОЗСИЛКИ -----
    if (state.action === 'broadcast') {
      if (state.type === 'all' || state.type === 'customers') {
        // Зберігаємо текст розсилки
        const broadcastText = text;
        
        // Очищаємо стан
        clearState(chatId);
        
        // Симулюємо розсилку (в реальному проекті тут має бути робота з базою користувачів)
        const targetType = state.type === 'all' ? 'всім користувачам' : 'клієнтам з замовленнями';
        
        bot.sendMessage(chatId, 
          `📢 *Розсилку розпочато*\n\nРозсилка ${targetType} з текстом:\n\n${broadcastText}`,
          { parse_mode: 'Markdown' }
        );
        
        // Імітуємо процес розсилки
        setTimeout(() => {
          // Тут мала б бути реальна функція розсилки
          const recipientCount = state.type === 'all' ? Math.floor(Math.random() * 50) + 10 : adminOrders.length;
          
          bot.sendMessage(chatId, 
            `✅ *Розсилку завершено*\n\nПовідомлення успішно надіслано ${recipientCount} отримувачам.`,
            {
              parse_mode: 'Markdown',
              reply_markup: {
                inline_keyboard: [
                  [{ text: '« Назад до меню', callback_data: 'admin_back' }]
                ]
              }
            }
          );
        }, 2000);
        
        return;
      }
      
      if (state.type === 'buttons') {
        if (state.step === 'text') {
          // Зберігаємо текст розсилки
          state.text = text;
          state.step = 'button_text';
          
          bot.sendMessage(chatId, 
            '✅ Текст повідомлення збережено.\n\nТепер введіть текст для кнопки:',
            {
              reply_markup: {
                inline_keyboard: [
                  [{ text: '« Скасувати', callback_data: 'admin_broadcast' }]
                ]
              }
            }
          );
          return;
        }
        
        if (state.step === 'button_text') {
          // Зберігаємо текст кнопки
          state.buttonText = text;
          state.step = 'button_url';
          
          bot.sendMessage(chatId, 
            '✅ Текст кнопки збережено.\n\nТепер введіть URL для кнопки:',
            {
              reply_markup: {
                inline_keyboard: [
                  [{ text: '« Скасувати', callback_data: 'admin_broadcast' }]
                ]
              }
            }
          );
          return;
        }
        
        if (state.step === 'button_url') {
          // Валідуємо URL
          if (!text.startsWith('http://') && !text.startsWith('https://')) {
            bot.sendMessage(chatId, 
              '❌ Некоректний URL. URL повинен починатися з http:// або https://. Спробуйте ще раз:',
              {
                reply_markup: {
                  inline_keyboard: [
                    [{ text: '« Скасувати', callback_data: 'admin_broadcast' }]
                  ]
                }
              }
            );
            return;
          }
          
          // Зберігаємо URL кнопки
          state.buttonUrl = text;
          
          // Готуємо попередній перегляд
          bot.sendMessage(chatId, 
            `*Попередній перегляд розсилки:*\n\n${state.text}`,
            {
              parse_mode: 'Markdown',
              reply_markup: {
                inline_keyboard: [
                  [{ text: state.buttonText, url: state.buttonUrl }],
                  [{ text: '✅ Підтвердити розсилку', callback_data: 'admin_confirm_broadcast' }],
                  [{ text: '« Скасувати', callback_data: 'admin_broadcast' }]
                ]
              }
            }
          );
          return;
        }
      }
    }
  });

  // Обробник фото для додавання товару
  bot.on('photo', (msg) => {
    const chatId = msg.chat.id;
    
    // Перевіряємо, чи це адмін
    if (chatId.toString() !== process.env.ADMIN_CHAT_ID) return;
    
    // Перевіряємо, чи є активний стан для додавання товару
    if (!adminStates[chatId] || adminStates[chatId].action !== 'add_product' || adminStates[chatId].step !== 'image') {
      return;
    }
    
    // Отримуємо фото з найвищою роздільною здатністю
    const photo = msg.photo[msg.photo.length - 1];
    const fileId = photo.file_id;
    
    // Зберігаємо fileId
    adminStates[chatId].image = fileId;
    
    // Фіналізуємо додавання товару
    const product = {
      name: adminStates[chatId].name,
      price: adminStates[chatId].price,
      description: adminStates[chatId].description,
      image: fileId
    };
    
    // Тут мала б бути функція для збереження товару в базу даних
    
    // Очищаємо стан
    clearState(chatId);
    
    bot.sendMessage(chatId, 
      `✅ *Товар успішно додано*\n\n` +
      `📦 Назва: ${product.name}\n` +
      `💰 Ціна: ${product.price} грн\n` +
      `📝 Опис: ${product.description.substring(0, 100)}${product.description.length > 100 ? '...' : ''}`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '« Назад до меню', callback_data: 'admin_products' }]
          ]
        }
      }
    );
  });

  // Додаткові обробники для адмін-панелі
  bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const data = query.data;
    
    // Перевіряємо, чи це адмін
    if (chatId.toString() !== process.env.ADMIN_CHAT_ID) return;
    
    // Обробка пропуску фото при додаванні товару
    if (data === 'admin_skip_image') {
      // Відповідаємо на callback
      bot.answerCallbackQuery(query.id);
      
      // Перевіряємо, чи є активний стан для додавання товару
      if (!adminStates[chatId] || adminStates[chatId].action !== 'add_product' || adminStates[chatId].step !== 'image') {
        return;
      }
      
      // Фіналізуємо додавання товару без фото
      const product = {
        name: adminStates[chatId].name,
        price: adminStates[chatId].price,
        description: adminStates[chatId].description,
        image: null
      };
      
      // Тут мала б бути функція для збереження товару в базу даних
      
      // Очищаємо стан
      clearState(chatId);
      
      bot.editMessageText(
        `✅ *Товар успішно додано*\n\n` +
        `📦 Назва: ${product.name}\n` +
        `💰 Ціна: ${product.price} грн\n` +
        `📝 Опис: ${product.description.substring(0, 100)}${product.description.length > 100 ? '...' : ''}`,
        {
          chat_id: chatId,
          message_id: query.message.message_id,
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '« Назад до меню', callback_data: 'admin_products' }]
            ]
          }
        }
      );
      return;
    }
    
    // Підтвердження розсилки з кнопками
    if (data === 'admin_confirm_broadcast') {
      // Відповідаємо на callback
      bot.answerCallbackQuery(query.id);
      
      // Перевіряємо, чи є активний стан для розсилки
      if (!adminStates[chatId] || adminStates[chatId].action !== 'broadcast' || adminStates[chatId].type !== 'buttons') {
        return;
      }
      
      // Отримуємо дані розсилки
      const broadcastData = adminStates[chatId];
      
      // Очищаємо стан
      clearState(chatId);
      
      bot.editMessageText(
        '📢 *Розсилку розпочато*\n\nРозсилка з кнопками...',
        {
          chat_id: chatId,
          message_id: query.message.message_id,
          parse_mode: 'Markdown'
        }
      );
      
      // Імітуємо процес розсилки
      setTimeout(() => {
        // Тут мала б бути реальна функція розсилки
        const recipientCount = Math.floor(Math.random() * 50) + 10;
        
        bot.editMessageText(
          `✅ *Розсилку завершено*\n\nПовідомлення з кнопкою успішно надіслано ${recipientCount} отримувачам.`,
          {
            chat_id: chatId,
            message_id: query.message.message_id,
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [{ text: '« Назад до меню', callback_data: 'admin_back' }]
              ]
            }
          }
        );
      }, 2000);
      return;
    }
    
    // Список товарів
    if (data === 'admin_list_products') {
      bot.answerCallbackQuery(query.id);
      
      // Тут мав би бути код для отримання списку товарів з бази даних
      // Для прикладу використовуємо тестові дані
      const products = [
        { id: 1, name: 'Футболка XL', price: 499.99, status: 'active' },
        { id: 2, name: 'Джинси', price: 999.99, status: 'active' },
        { id: 3, name: 'Куртка зимова', price: 1999.99, status: 'inactive' }
      ];
      
      if (products.length === 0) {
        bot.editMessageText(
          '📋 *Список товарів*\n\nТоварів поки немає.',
          {
            chat_id: chatId,
            message_id: query.message.message_id,
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [{ text: '« Назад', callback_data: 'admin_products' }]
              ]
            }
          }
        );
        return;
      }
      
      let message = '📋 *Список товарів*\n\n';
      
      products.forEach((product, i) => {
        message += `*${i + 1}. ${product.name}*\n`;
        message += `💰 Ціна: ${product.price} грн\n`;
        message += `📊 Статус: ${product.status === 'active' ? '✅ Активний' : '❌ Неактивний'}\n\n`;
      });
      
      // Кнопки для керування товарами
      const keyboard = products.map(product => [
        { text: `✏️ Редагувати ${product.name}`, callback_data: `admin_edit_product_${product.id}` }
      ]);
      
      // Додаємо кнопку для повернення
      keyboard.push([{ text: '« Назад', callback_data: 'admin_products' }]);
      
      bot.editMessageText(message, {
        chat_id: chatId,
        message_id: query.message.message_id,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: keyboard
        }
      });
      return;
    }
    
    // Редагування товару
    if (data.startsWith('admin_edit_product_')) {
      bot.answerCallbackQuery(query.id);
      
      const productId = data.split('admin_edit_product_')[1];
      
      // Тут мав би бути код для отримання товару з бази даних
      // Для прикладу використовуємо тестові дані
      const product = {
        id: productId,
        name: 'Футболка XL',
        price: 499.99,
        description: 'Якісна бавовняна футболка великого розміру',
        status: 'active'
      };
      
      bot.editMessageText(
        `✏️ *Редагування товару*\n\n` +
        `📦 Назва: ${product.name}\n` +
        `💰 Ціна: ${product.price} грн\n` +
        `📝 Опис: ${product.description}\n` +
        `📊 Статус: ${product.status === 'active' ? '✅ Активний' : '❌ Неактивний'}\n\n` +
        `Оберіть дію:`,
        {
          chat_id: chatId,
          message_id: query.message.message_id,
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '✏️ Змінити назву', callback_data: `admin_edit_product_name_${productId}` }],
              [{ text: '💰 Змінити ціну', callback_data: `admin_edit_product_price_${productId}` }],
              [{ text: '📝 Змінити опис', callback_data: `admin_edit_product_desc_${productId}` }],
              [{ text: `${product.status === 'active' ? '❌ Деактивувати' : '✅ Активувати'}`, callback_data: `admin_toggle_product_${productId}` }],
              [{ text: '🗑️ Видалити товар', callback_data: `admin_delete_product_${productId}` }],
              [{ text: '« Назад до списку', callback_data: 'admin_list_products' }]
            ]
          }
        }
      );
      return;
    }
    
    // Зміна статусу товару
    if (data.startsWith('admin_toggle_product_')) {
      bot.answerCallbackQuery(query.id);
      
      const productId = data.split('admin_toggle_product_')[1];
      
      // Тут мав би бути код для зміни статусу товару в базі даних
      
      bot.editMessageText(
        '✅ *Статус товару змінено*\n\nСтатус товару успішно оновлено.',
        {
          chat_id: chatId,
          message_id: query.message.message_id,
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '« Назад до списку', callback_data: 'admin_list_products' }]
            ]
          }
        }
      );
      return;
    }
    
    // Видалення товару
    if (data.startsWith('admin_delete_product_')) {
      bot.answerCallbackQuery(query.id);
      
      const productId = data.split('admin_delete_product_')[1];
      
      // Запит підтвердження видалення
      bot.editMessageText(
        '⚠️ *Підтвердження видалення*\n\nВи впевнені, що хочете видалити цей товар? Ця дія незворотна.',
        {
          chat_id: chatId,
          message_id: query.message.message_id,
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '✅ Так, видалити', callback_data: `admin_confirm_delete_${productId}` }],
              [{ text: '❌ Скасувати', callback_data: `admin_edit_product_${productId}` }]
            ]
          }
        }
      );
      return;
    }
    
    // Підтвердження видалення товару
    if (data.startsWith('admin_confirm_delete_')) {
      bot.answerCallbackQuery(query.id);
      
      const productId = data.split('admin_confirm_delete_')[1];
      
      // Тут мав би бути код для видалення товару з бази даних
      
      bot.editMessageText(
        '✅ *Товар видалено*\n\nТовар успішно видалено з бази даних.',
        {
          chat_id: chatId,
          message_id: query.message.message_id,
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '« Назад до списку', callback_data: 'admin_list_products' }]
            ]
          }
        }
      );
      return;
    }
    
    // Перегляд замовлень за період
    if (data === 'admin_orders_period') {
      bot.answerCallbackQuery(query.id);
      
      bot.editMessageText(
        '📅 *Замовлення за період*\n\nОберіть період:',
        {
          chat_id: chatId,
          message_id: query.message.message_id,
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '📆 Сьогодні', callback_data: 'admin_orders_today' }],
              [{ text: '📆 Вчора', callback_data: 'admin_orders_yesterday' }],
              [{ text: '📆 Цей тиждень', callback_data: 'admin_orders_week' }],
              [{ text: '📆 Цей місяць', callback_data: 'admin_orders_month' }],
              [{ text: '📆 Власний період', callback_data: 'admin_orders_custom_period' }],
              [{ text: '« Назад', callback_data: 'admin_orders' }]
            ]
          }
        }
      );
      return;
    }
    
    // Замовлення за сьогодні
    if (data === 'admin_orders_today') {
      bot.answerCallbackQuery(query.id);
      
      // Фільтруємо замовлення за сьогоднішню дату
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const todayOrders = adminOrders.filter(order => {
        const orderDate = new Date(order.date);
        return orderDate >= today;
      });
      
      if (todayOrders.length === 0) {
        bot.editMessageText(
          '📅 *Замовлення за сьогодні*\n\nЗа сьогодні немає замовлень.',
          {
            chat_id: chatId,
            message_id: query.message.message_id,
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [{ text: '« Назад', callback_data: 'admin_orders_period' }]
              ]
            }
          }
        );
        return;
      }
      
      // Показуємо список замовлень
      let message = '📅 *Замовлення за сьогодні*\n\n';
      
      todayOrders.forEach((order, i) => {
        const orderDate = new Date(order.date);
        const formattedTime = `${orderDate.getHours().toString().padStart(2, '0')}:${orderDate.getMinutes().toString().padStart(2, '0')}`;
        
        message += `*#${i + 1}* (${formattedTime})\n`;
        message += `📦 Товар: ${order.product}\n`;
        message += `👤 Клієнт: ${order.name}\n`;
        message += `📞 Телефон: ${order.phone}\n`;
        message += `🏠 Адреса: ${order.address || 'Не вказано'}\n\n`;
      });
      
      bot.editMessageText(message, {
        chat_id: chatId,
        message_id: query.message.message_id,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '« Назад', callback_data: 'admin_orders_period' }]
          ]
        }
      });
      return;
    }
  });

  // Повертаємо функцію для інтеграції з іншими модулями
  return {
    adminStates,
    clearState
  };
};