require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

// Створення бота з токеном з .env
const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

const adminOrders = [];

const adminModule = require('./admin.js');
adminModule(bot, [], adminOrders);

// Зберігання замовлень для адміністратора


// Функція для отримання каталогу товарів з Prom.ua
async function getCatalogProducts(limit = 10) {
  try {
    const response = await axios.get('https://my.prom.ua/api/v1/products/list', {
      headers: {
        Authorization: `Bearer ${process.env.PROM_TOKEN}`
      },
      params: {
        limit,
        presence: 'available' // Тільки доступні товари
      }
    });
    
    return response.data.products || [];
  } catch (error) {
    console.error('Помилка отримання каталогу:', error.message);
    return [];
  }
}

// Функція для отримання інформації про товар по ID
async function getProductInfo(productId) {
  try {
    const response = await axios.get(`https://my.prom.ua/api/v1/products/${productId}`, {
      headers: {
        Authorization: `Bearer ${process.env.PROM_TOKEN}`
      }
    });
    
    return response.data.product;
  } catch (error) {
    console.error(`Помилка отримання інформації про товар ${productId}:`, error.message);
    return null;
  }
}

// Функція для створення замовлення через API Prom.ua
async function createOrder(orderData) {
  try {
    const response = await axios.post('https://my.prom.ua/api/v1/orders', {
      order: {
        client_first_name: orderData.name,
        client_phone: orderData.phone,
        shipping_address: orderData.address,
        payment_option: "Оплата при отриманні",
        products: [
          {
            id: orderData.productId,
            quantity: 1
          }
        ]
      }
    }, {
      headers: {
        Authorization: `Bearer ${process.env.PROM_TOKEN}`
      }
    });
    
    return response.data;
  } catch (error) {
    console.error('Помилка створення замовлення:', error.message);
    return null;
  }
}

// Старт бота
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  
  bot.sendMessage(chatId, 
    '👋 *Вітаємо у нашому магазині!*\n\nОберіть товар із каталогу, і ми швидко доставимо його вам.', {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: '🛍️ Переглянути каталог', callback_data: 'catalog' }],
        [{ text: '📞 Зв\'язатися з підтримкою', callback_data: 'support' }]
      ]
    }
  });
});

// Обробка кнопок
bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const messageId = query.message.message_id;
  const data = query.data;
  
  // Відповідаємо на callback, щоб прибрати "годинник" на кнопці
  bot.answerCallbackQuery(query.id);
  
  // Обробка каталогу
  if (data === 'catalog') {
    await showCatalog(chatId);
    return;
  }
  
  // Обробка підтримки
  if (data === 'support') {
    bot.sendMessage(chatId, 
      '*📞 Наша підтримка:*\n\n• Телеграм: @your_support_username\n• Email: support@example.com\n• Телефон: +380XXXXXXXXX\n\nМи відповімо вам у найкоротший термін!', {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '« Назад', callback_data: 'start' }]
        ]
      }
    });
    return;
  }
  
  // Повернення на стартове меню
  if (data === 'start') {
    bot.editMessageText('👋 *Вітаємо у нашому магазині!*\n\nОберіть товар із каталогу, і ми швидко доставимо його вам.', {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🛍️ Переглянути каталог', callback_data: 'catalog' }],
          [{ text: '📞 Зв\'язатися з підтримкою', callback_data: 'support' }]
        ]
      }
    });
    return;
  }
  
  // Обробка покупки товару
  if (data.startsWith('buy_')) {
    const productId = data.split('_')[1];
    const product = await getProductInfo(productId);
    
    if (!product) {
      bot.sendMessage(chatId, '❌ На жаль, товар не знайдено або він недоступний. Спробуйте інший товар.');
      return;
    }
    
    // Зберігаємо стан замовлення в інлайн кнопці
    bot.sendMessage(chatId, 
      `🛒 *Оформлення замовлення*\n\nВи обрали: *${product.name}*\nЦіна: ${product.price} грн\n\nДля продовження, вкажіть ваше ім'я:`, {
      parse_mode: 'Markdown',
      reply_markup: {
        force_reply: true,
        selective: true,
        input_field_placeholder: 'Введіть ваше ім\'я'
      }
    }).then(sent => {
      // Створюємо обробник для наступного повідомлення від користувача - імені
      const replyListenerId = bot.onReplyToMessage(chatId, sent.message_id, async (nameMsg) => {
        const name = nameMsg.text;
        
        // Просимо ввести телефон
        bot.sendMessage(chatId, 
          `Дякуємо, *${name}*!\n\nТепер вкажіть ваш номер телефону:`, {
          parse_mode: 'Markdown',
          reply_markup: {
            force_reply: true,
            selective: true,
            input_field_placeholder: '+380XXXXXXXXX'
          }
        }).then(phoneSent => {
          // Видаляємо перший слухач
          bot.removeReplyListener(replyListenerId);
          
          // Створюємо обробник для номера телефону
          const phoneListenerId = bot.onReplyToMessage(chatId, phoneSent.message_id, async (phoneMsg) => {
            const phone = phoneMsg.text;
            
            // Просимо ввести адресу
            bot.sendMessage(chatId, 
              `Чудово! Вкажіть адресу доставки:`, {
              reply_markup: {
                force_reply: true,
                selective: true,
                input_field_placeholder: 'місто, вулиця, будинок, квартира'
              }
            }).then(addressSent => {
              // Видаляємо другий слухач
              bot.removeReplyListener(phoneListenerId);
              
              // Створюємо обробник для адреси
              const addressListenerId = bot.onReplyToMessage(chatId, addressSent.message_id, async (addressMsg) => {
                const address = addressMsg.text;
                
                // Тут створюємо замовлення через API Prom.ua
                const orderData = {
                  name,
                  phone,
                  address,
                  productId: product.id
                };
                
                // Відправляємо повідомлення про обробку
                bot.sendMessage(chatId, '⏳ Оформлюємо ваше замовлення...');
                
                // Створюємо замовлення через API
                const orderResult = await createOrder(orderData);
                
                // Зберігаємо для адміна
                adminOrders.push({
                  id: orderResult?.id || `temp_${Date.now()}`,
                  product: product.name,
                  name,
                  phone,
                  address,
                  date: new Date().toISOString()
                });
                
                // Повідомляємо адміна
                const adminText = `🆕 *Нове замовлення!*\n\n📦 Товар: *${product.name}*\n💰 Ціна: ${product.price} грн\n👤 Клієнт: ${name}\n📞 Телефон: ${phone}\n🏠 Адреса: ${address}`;
                
                bot.sendMessage(process.env.ADMIN_CHAT_ID, adminText, {
                  parse_mode: 'Markdown'
                });
                
                // Повідомляємо клієнта
                bot.sendMessage(chatId, 
                  `✅ *Замовлення успішно оформлено!*\n\n📦 Товар: *${product.name}*\n💰 Ціна: ${product.price} грн\n👤 Імʼя: ${name}\n📞 Телефон: ${phone}\n🏠 Адреса: ${address}\n\nМи зв'яжемося з вами найближчим часом для підтвердження замовлення. Дякуємо за покупку! 🙏`, {
                  parse_mode: 'Markdown',
                  reply_markup: {
                    inline_keyboard: [
                      [{ text: '📋 Повернутися до каталогу', callback_data: 'catalog' }]
                    ]
                  }
                });
                
                // Видаляємо третій слухач
                bot.removeReplyListener(addressListenerId);
              });
            });
          });
        });
      });
    });
    return;
  }
  
  // Обробка перегляду деталей товару
  if (data.startsWith('view_')) {
    const productId = data.split('_')[1];
    await showProductDetails(chatId, productId);
    return;
  }
  
  // Обробка пагінації каталогу
  if (data.startsWith('page_')) {
    const page = parseInt(data.split('_')[1]);
    await showCatalog(chatId, page);
    return;
  }
});


// Функція відображення сторінки каталогу
async function showCatalog(chatId, page = 1) {
  const itemsPerPage = 5;
  const offset = (page - 1) * itemsPerPage;
  
  // Показати повідомлення про завантаження
  const loadingMsg = await bot.sendMessage(chatId, '⏳ *Завантажую каталог товарів...*', {
    parse_mode: 'Markdown'
  });
  
  try {
    // Отримуємо продукти з API Prom.ua
    const products = await getCatalogProducts(50); // Отримаємо більше для пагінації
    
    if (!products || products.length === 0) {
      await bot.editMessageText('😔 На жаль, товари не знайдено. Спробуйте пізніше.', {
        chat_id: chatId,
        message_id: loadingMsg.message_id,
        reply_markup: {
          inline_keyboard: [
            [{ text: '« Назад', callback_data: 'start' }]
          ]
        }
      });
      return;
    }
    
    // Розбиваємо на сторінки
    const totalPages = Math.ceil(products.length / itemsPerPage);
    const pageProducts = products.slice(offset, offset + itemsPerPage);
    
    // Видаляємо повідомлення про завантаження
    await bot.deleteMessage(chatId, loadingMsg.message_id);
    
    // Відправляємо кожен товар окремим повідомленням
    for (const product of pageProducts) {
      const price = product.price ? `${product.price} грн` : 'Ціна за запитом';
      
      // Виправлено отримання зображення - перевіряємо різні можливі поля
      let image = null;
      if (product.main_image?.url_original) {
        image = product.main_image.url_original;
      } else if (product.main_image?.url) {
        image = product.main_image.url;
      } else if (product.images && product.images.length > 0) {
        // Перевіряємо перше зображення в масиві
        if (product.images[0].url_original) {
          image = product.images[0].url_original;
        } else if (product.images[0].url) {
          image = product.images[0].url;
        }
      } else if (product.image) {
        image = product.image;
      }
      
      const availability = product.presence === 'available' ? '✅ В наявності' : '⌛ Під замовлення';
      
      // Очищення опису від HTML тегів
      let cleanDescription = '';
      if (product.description) {
        cleanDescription = product.description
          .replace(/<[^>]*>/g, '') // Видаляємо HTML теги
          .replace(/&nbsp;/g, ' ') // Замінюємо &nbsp; на пробіли
          .replace(/&amp;/g, '&') // Замінюємо HTML entities
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .trim();
        
        // Обрізаємо до 150 символів
        if (cleanDescription.length > 150) {
          cleanDescription = cleanDescription.substring(0, 150) + '...';
        }
      }
      
      const caption = `*${product.name}*\n\n💰 *${price}*\n${availability}\n\n${cleanDescription || 'Натисніть кнопку деталі для більше інформації'}`;
      
      const keyboard = {
        inline_keyboard: [
          [
            { text: '🔍 Деталі', callback_data: `view_${product.id}` },
            { text: '🛒 Купити', callback_data: `buy_${product.id}` }
          ]
        ]
      };
      
      try {
        if (image) {
          await bot.sendPhoto(chatId, image, {
            caption,
            parse_mode: 'Markdown',
            reply_markup: keyboard
          });
        } else {
          await bot.sendMessage(chatId, caption, {
            parse_mode: 'Markdown',
            reply_markup: keyboard
          });
        }
      } catch (imageError) {
        // Якщо помилка з відправкою фото, відправляємо тільки текст
        console.error('Помилка відправки фото для товару', product.id, ':', imageError.message);
        await bot.sendMessage(chatId, caption, {
          parse_mode: 'Markdown',
          reply_markup: keyboard
        });
      }
    }
    
    // Відправляємо навігаційні кнопки
    const navButtons = [];
    
    // Кнопка "Назад"
    if (page > 1) {
      navButtons.push({ text: '« Попередня', callback_data: `page_${page - 1}` });
    }
    
    // Номер сторінки
    navButtons.push({ text: `${page} / ${totalPages}`, callback_data: 'catalog_info' });
    
    // Кнопка "Вперед"
    if (page < totalPages) {
      navButtons.push({ text: 'Наступна »', callback_data: `page_${page + 1}` });
    }
    
    // Повернення до головного меню
    const menuButtons = [[{ text: '« Назад до меню', callback_data: 'start' }]];
    
    // Якщо є кнопки навігації, додаємо їх
    if (navButtons.length > 0) {
      await bot.sendMessage(chatId, '📋 *Сторінка каталогу:*', {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [navButtons, ...menuButtons]
        }
      });
    } else {
      await bot.sendMessage(chatId, '📋 *Каталог товарів:*', {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: menuButtons
        }
      });
    }
    
  } catch (error) {
    console.error('Помилка при відображенні каталогу:', error.message);
    bot.editMessageText('❌ Сталася помилка при завантаженні каталогу. Спробуйте пізніше.', {
      chat_id: chatId,
      message_id: loadingMsg.message_id,
      reply_markup: {
        inline_keyboard: [
          [{ text: '« Назад', callback_data: 'start' }]
        ]
      }
    });
  }
}
// Функція відображення деталей товару
async function showProductDetails(chatId, productId) {
  // Показати повідомлення про завантаження
  const loadingMsg = await bot.sendMessage(chatId, '⏳ *Завантажую інформацію про товар...*', {
    parse_mode: 'Markdown'
  });
  
  try {
    // Отримуємо інформацію про товар
    const product = await getProductInfo(productId);
    
    if (!product) {
      await bot.editMessageText('❌ На жаль, товар не знайдено або недоступний.', {
        chat_id: chatId,
        message_id: loadingMsg.message_id,
        reply_markup: {
          inline_keyboard: [
            [{ text: '« Назад до каталогу', callback_data: 'catalog' }]
          ]
        }
      });
      return;
    }
    
    // Видаляємо повідомлення про завантаження
    await bot.deleteMessage(chatId, loadingMsg.message_id);
    
    const price = product.price ? `${product.price} грн` : 'Ціна за запитом';
    const availability = product.presence === 'available' ? '✅ В наявності' : '⌛ Під замовлення';
    
    // Отримуємо до 5 фото товару
    const images = product.images || [];
    
    if (images.length > 0) {
      // Якщо є фото, відправляємо їх групою (максимум 10)
      const mediaGroup = images.slice(0, 10).map((img, index) => ({
        type: 'photo',
        media: img.url_original,
        caption: index === 0 ? `*${product.name}*\n\n${product.description || ''}` : '',
        parse_mode: 'Markdown'
      }));
      
      // Відправляємо групу фото
      await bot.sendMediaGroup(chatId, mediaGroup);
      
      // Відправляємо інформацію та кнопки окремо
      await bot.sendMessage(chatId, 
        `*${product.name}*\n\n💰 *${price}*\n${availability}\n\n${product.vendor_code ? `Артикул: ${product.vendor_code}\n` : ''}${product.discount ? `🔥 Знижка: ${product.discount}%\n` : ''}${product.brand ? `Бренд: ${product.brand}\n` : ''}`, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🛒 Купити', callback_data: `buy_${product.id}` }],
            [{ text: '« Назад до каталогу', callback_data: 'catalog' }]
          ]
        }
      });
    } else {
      // Якщо немає фото, відправляємо текст
      await bot.sendMessage(chatId, 
        `*${product.name}*\n\n💰 *${price}*\n${availability}\n\n${product.description || ''}\n\n${product.vendor_code ? `Артикул: ${product.vendor_code}\n` : ''}${product.discount ? `🔥 Знижка: ${product.discount}%\n` : ''}${product.brand ? `Бренд: ${product.brand}\n` : ''}`, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🛒 Купити', callback_data: `buy_${product.id}` }],
            [{ text: '« Назад до каталогу', callback_data: 'catalog' }]
          ]
        }
      });
    }
    
  } catch (error) {
    console.error('Помилка при відображенні деталей товару:', error.message);
    bot.editMessageText('❌ Сталася помилка при завантаженні інформації про товар. Спробуйте пізніше.', {
      chat_id: chatId,
      message_id: loadingMsg.message_id,
      reply_markup: {
        inline_keyboard: [
          [{ text: '« Назад до каталогу', callback_data: 'catalog' }]
        ]
      }
    });
  }
}

// Обробка команди для отримання допомоги
bot.onText(/\/help/, (msg) => {
  const chatId = msg.chat.id;
  
  bot.sendMessage(chatId, 
    '📖 *Довідка з використання бота:*\n\n• Натисніть кнопку "Переглянути каталог" для перегляду товарів.\n• Для кожного товару доступні кнопки "Деталі" та "Купити".\n• При оформленні замовлення вас попросять вказати ім\'я, телефон та адресу доставки.\n• Після оформлення замовлення з вами зв\'яжеться наш менеджер для підтвердження.\n\nЯкщо у вас є питання, натисніть кнопку "Зв\'язатися з підтримкою".', {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: '🛍️ Переглянути каталог', callback_data: 'catalog' }],
        [{ text: '📞 Зв\'язатися з підтримкою', callback_data: 'support' }]
      ]
    }
  });
});

console.log('Бот запущено!');

// Експортуємо об'єкти для адмінського модуля
module.exports = { bot, adminOrders };
