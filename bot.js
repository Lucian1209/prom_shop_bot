require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

const orders = {};
const adminOrders = [];

bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, 'Привіт! Обери дію:', {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🛍 Каталог', callback_data: 'catalog' }],
        [{ text: '📞 Підтримка', callback_data: 'support' }]
      ]
    }
  });
});

bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const data = query.data;

  if (data === 'catalog') return await sendCatalog(chatId);
  if (data === 'support') {
    return bot.sendMessage(chatId, 'Підтримка: @josnik_lamer');
  }

  if (data.startsWith('buy_')) {
    const productId = data.split('_')[1];
    orders[chatId] = { productId, step: 'name' };

    return bot.sendMessage(chatId, 'Введіть ваше *імʼя*:', { parse_mode: 'Markdown' });
  }

  bot.answerCallbackQuery(query.id);
});

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  if (!orders[chatId]) return;

  const order = orders[chatId];

  if (order.step === 'name') {
    order.name = text;
    order.step = 'phone';
    return bot.sendMessage(chatId, 'Введіть ваш *номер телефону*:', { parse_mode: 'Markdown' });
  }

  if (order.step === 'phone') {
    order.phone = text;
    order.step = 'address';
    return bot.sendMessage(chatId, 'Введіть *адресу доставки*:', { parse_mode: 'Markdown' });
  }

  if (order.step === 'address') {
    order.address = text;
    order.step = 'done';

    const productInfo = await getProductInfo(order.productId);
    const orderText = `🛒 *Нове замовлення*\n\nТовар: ${productInfo?.name || 'ID ' + order.productId}\nІмʼя: ${order.name}\nТелефон: ${order.phone}\nАдреса: ${order.address}`;

    await bot.sendMessage(process.env.ADMIN_CHAT_ID, orderText, { parse_mode: 'Markdown' });
    await bot.sendMessage(chatId, '✅ Замовлення оформлено! Ми звʼяжемось з вами найближчим часом.');

    delete orders[chatId];
  }
});

async function sendCatalog(chatId) {
  try {
    const res = await axios.get('https://my.prom.ua/api/v1/products/list', {
      headers: {
        Authorization: `Bearer ${process.env.PROM_TOKEN}`
      },
      params: {
        shop_id: process.env.PROM_SHOP_ID,
        limit: 5
      }
    });

    const products = res.data.products || [];

    if (!products.length) {
      return bot.sendMessage(chatId, 'Каталог порожній.');
    }

    for (const product of products) {
      const caption = `*${product.name}*\nЦіна: ${product.price} грн\n[Деталі](${product.url})`;
      const image = product.main_image?.url_original;

      const inline_keyboard = [[
        { text: '🛒 Купити', callback_data: `buy_${product.id}` }
      ]];

      if (image) {
        await bot.sendPhoto(chatId, image, {
          caption,
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard }
        });
      } else {
        await bot.sendMessage(chatId, caption, {
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard }
        });
      }
    }
  } catch (err) {
    console.error(err.response?.data || err.message);
    bot.sendMessage(chatId, 'Помилка при завантаженні товарів.');
  }
}

async function getProductInfo(id) {
  try {
    const res = await axios.get(`https://my.prom.ua/api/v1/products/${id}`, {
      headers: {
        Authorization: `Bearer ${process.env.PROM_TOKEN}`
      }
    });
    return res.data.product;
  } catch {
    return null;
  }
}


const mainMenu = {
  reply_markup: {
    keyboard: [['🛍 Каталог', '📦 Мої замовлення'], ['☎️ Підтримка']],
    resize_keyboard: true,
    one_time_keyboard: false
  }
};

const lastMenuMessage = {};

bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, 'Вітаю! Оберіть пункт меню:', mainMenu).then(sent => {
    lastMenuMessage[msg.chat.id] = sent.message_id;
  });
});

bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  if (text.startsWith('/')) return; // не реагуємо на команди тут

  if (lastMenuMessage[chatId]) {
    bot.deleteMessage(chatId, lastMenuMessage[chatId]).catch(() => {});
  }

  if (text === '🛍 Каталог') {
    bot.sendMessage(chatId, 'Ось наш каталог товарів...', mainMenu).then(sent => {
      lastMenuMessage[chatId] = sent.message_id;
    });
  } else if (text === '📦 Мої замовлення') {
    bot.sendMessage(chatId, 'Ось ваші замовлення...', mainMenu).then(sent => {
      lastMenuMessage[chatId] = sent.message_id;
    });
  } else if (text === '☎️ Підтримка') {
    bot.sendMessage(chatId, 'Звʼяжіться з нами: @josnik_lamer', mainMenu).then(sent => {
      lastMenuMessage[chatId] = sent.message_id;
    });
  }
});


// Підключення адмінки
require('./admin')(bot, orders, adminOrders);
