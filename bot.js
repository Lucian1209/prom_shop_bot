require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

// Створення бота з токеном з .env
const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

const adminModule = require('./admin'); // Підключення адмін-панелі

// Зберігання замовлень для адміністратора
const adminOrders = [];

// Зберігання стану користувачів
const userStates = {};
const userOrders = {};

const lastMessages = {};
const mainMenu = {
  reply_markup: {
    keyboard: [
      ['🛍 Каталог', '📦 Відстежити замовлення'],
      ['☎️ Підтримка', '📖 Допомога']
    ],
    resize_keyboard: true,
    one_time_keyboard: false
  }
};

const catalogMenu = {
  reply_markup: {
    keyboard: [
      ['📄 Список товарів', '🔍 Пошук товару'],
      ['🏠 Головне меню']
    ],
    resize_keyboard: true,
    one_time_keyboard: false
  }
};

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
  userStates[chatId] = 'main_menu';
  
  bot.sendMessage(chatId, 
    '👋 *Вітаємо у нашому магазині!*\n\nОберіть товар із каталогу, і ми швидко доставимо його вам.', 
    Object.assign({ parse_mode: 'Markdown' }, mainMenu)
  );
});

// Обробка текстових повідомлень
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;
  const userId = msg.from.id;
  
  // Ігноруємо команди
  if (text && text.startsWith('/')) {
    return;
  }
  
  const currentState = userStates[chatId] || 'main_menu';
  
  switch (text) {
    case '🛍 Каталог':
      userStates[chatId] = 'catalog';
      bot.sendMessage(chatId, 
        '📂 *Каталог товарів*\n\nОберіть дію:', 
        Object.assign({ parse_mode: 'Markdown' }, catalogMenu)
      );
      break;
      
    case '📄 Список товарів':
      if (currentState === 'catalog') {
        await showProductsList(chatId);
      }
      break;
      
    case '🔍 Пошук товару':
      if (currentState === 'catalog') {
        userStates[chatId] = 'search_product';
        bot.sendMessage(chatId, 
          '🔍 *Пошук товару*\n\nВведіть назву товару для пошуку:', 
          { 
            parse_mode: 'Markdown',
            reply_markup: {
              keyboard: [['🏠 Головне меню']],
              resize_keyboard: true
            }
          }
        );
      }
      break;
      
    case '📦 Відстежити замовлення':
      bot.sendMessage(chatId, 
        '📦 *Відстеження замовлення*\n\nВведіть номер вашого замовлення:', 
        { 
          parse_mode: 'Markdown',
          reply_markup: {
            keyboard: [['🏠 Головне меню']],
            resize_keyboard: true
          }
        }
      );
      userStates[chatId] = 'track_order';
      break;
      
    case '☎️ Підтримка':
      bot.sendMessage(chatId, 
        '*📞 Наша підтримка:*\n\n• Телеграм: @josnik_lamer\n• Email: support@example.com\n• Телефон: +380669419224\n\nМи відповімо вам у найкоротший термін!', 
        Object.assign({ parse_mode: 'Markdown' }, mainMenu)
      );
      userStates[chatId] = 'main_menu';
      break;
      
    case '📖 Допомога':
      bot.sendMessage(chatId, 
        '📖 *Довідка з використання бота:*\n\n• Натисніть кнопку "Каталог" для перегляду товарів\n• Оберіть "Список товарів" для перегляду всіх товарів\n• Використовуйте "Пошук товару" для знаходження конкретного товару\n• При оформленні замовлення вас попросять вказати ім\'я, телефон та адресу доставки\n• Після оформлення замовлення з вами зв\'яжеться наш менеджер\n\nЯкщо у вас є питання, натисніть кнопку "Підтримка".', 
        Object.assign({ parse_mode: 'Markdown' }, mainMenu)
      );
      userStates[chatId] = 'main_menu';
      break;
      
    case '🏠 Головне меню':
      userStates[chatId] = 'main_menu';
      bot.sendMessage(chatId, 
        '🏠 *Головне меню*\n\nОберіть дію:', 
        Object.assign({ parse_mode: 'Markdown' }, mainMenu)
      );
      break;
      
    case '◀️ Назад':
      if (currentState === 'view_products') {
        userStates[chatId] = 'catalog';
        bot.sendMessage(chatId, 
          '📂 *Каталог товарів*\n\nОберіть дію:', 
          Object.assign({ parse_mode: 'Markdown' }, catalogMenu)
        );
      }
      break;
      
    default:
      await handleUserInput(chatId, text, currentState);
      break;
  }
});

// Функція обробки введення користувача
async function handleUserInput(chatId, text, currentState) {
  switch (currentState) {
    case 'search_product':
      await searchProducts(chatId, text);
      break;
      
    case 'track_order':
      await trackOrder(chatId, text);
      break;
      
    case 'order_name':
      userOrders[chatId].name = text;
      userStates[chatId] = 'order_phone';
      bot.sendMessage(chatId, 
        `Дякуємо, *${text}*!\n\nТепер вкажіть ваш номер телефону:`, 
        { 
          parse_mode: 'Markdown',
          reply_markup: {
            keyboard: [['🏠 Головне меню']],
            resize_keyboard: true
          }
        }
      );
      break;
      
    case 'order_phone':
      userOrders[chatId].phone = text;
      userStates[chatId] = 'order_address';
      bot.sendMessage(chatId, 
        'Чудово! Вкажіть адресу доставки:', 
        { 
          reply_markup: {
            keyboard: [['🏠 Головне меню']],
            resize_keyboard: true
          }
        }
      );
      break;
      
    case 'order_address':
      userOrders[chatId].address = text;
      await processOrder(chatId);
      break;
      
    default:
      // Перевіряємо, чи це номер товару для покупки
      if (text.match(/^\d+$/)) {
        await handleProductSelection(chatId, text, currentState);
      } else {
        bot.sendMessage(chatId, 
          '❓ Не розумію вашу команду. Скористайтеся кнопками меню.', 
          Object.assign({}, getMenuForState(currentState))
        );
      }
      break;
  }
}

// Функція для отримання меню залежно від стану
function getMenuForState(state) {
  switch (state) {
    case 'catalog':
      return catalogMenu;
    case 'view_products':
      return {
        reply_markup: {
          keyboard: [['◀️ Назад', '🏠 Головне меню']],
          resize_keyboard: true
        }
      };
    default:
      return mainMenu;
  }
}

// Функція відображення списку товарів
async function showProductsList(chatId) {
  const loadingMsg = await bot.sendMessage(chatId, '⏳ *Завантажую каталог товарів...*', {
    parse_mode: 'Markdown'
  });
  
  try {
    const products = await getCatalogProducts(20);
    
    if (!products || products.length === 0) {
      await bot.editMessageText('😔 На жаль, товари не знайдено. Спробуйте пізніше.', {
        chat_id: chatId,
        message_id: loadingMsg.message_id
      });
      return;
    }
    
    await bot.deleteMessage(chatId, loadingMsg.message_id);
    
    let productList = '*📄 Список товарів:*\n\n';
    
    products.forEach((product, index) => {
      const price = product.price ? `${product.price} грн` : 'Ціна за запитом';
      const availability = product.presence === 'available' ? '✅' : '⌛';
      productList += `${index + 1}. *${product.name}*\n   💰 ${price} ${availability}\n\n`;
    });
    
    productList += `\n📝 *Як замовити:*\nВведіть номер товару (1-${products.length}) для оформлення замовлення`;
    
    bot.sendMessage(chatId, productList, {
      parse_mode: 'Markdown',
      reply_markup: {
        keyboard: [['◀️ Назад', '🏠 Головне меню']],
        resize_keyboard: true
      }
    });
    
    userStates[chatId] = 'view_products';
    userOrders[chatId] = { products: products };
    
  } catch (error) {
    console.error('Помилка при відображенні каталогу:', error.message);
    bot.editMessageText('❌ Сталася помилка при завантаженні каталогу. Спробуйте пізніше.', {
      chat_id: chatId,
      message_id: loadingMsg.message_id
    });
  }
}

// Функція пошуку товарів
async function searchProducts(chatId, query) {
  const loadingMsg = await bot.sendMessage(chatId, '🔍 *Шукаю товари...*', {
    parse_mode: 'Markdown'
  });
  
  try {
    const products = await getCatalogProducts(50);
    const filteredProducts = products.filter(product => 
      product.name.toLowerCase().includes(query.toLowerCase())
    );
    
    await bot.deleteMessage(chatId, loadingMsg.message_id);
    
    if (filteredProducts.length === 0) {
      bot.sendMessage(chatId, 
        `😔 За запитом "*${query}*" товари не знайдено.\n\nСпробуйте інший запит або переглянте весь каталог.`, 
        { 
          parse_mode: 'Markdown',
          reply_markup: {
            keyboard: [['📄 Список товарів', '🏠 Головне меню']],
            resize_keyboard: true
          }
        }
      );
      userStates[chatId] = 'catalog';
      return;
    }
    
    let searchResults = `🔍 *Результати пошуку "${query}":*\n\n`;
    
    filteredProducts.slice(0, 10).forEach((product, index) => {
      const price = product.price ? `${product.price} грн` : 'Ціна за запитом';
      const availability = product.presence === 'available' ? '✅' : '⌛';
      searchResults += `${index + 1}. *${product.name}*\n   💰 ${price} ${availability}\n\n`;
    });
    
    if (filteredProducts.length > 10) {
      searchResults += `\n... та ще ${filteredProducts.length - 10} товарів\n`;
    }
    
    searchResults += `\n📝 *Як замовити:*\nВведіть номер товару (1-${Math.min(filteredProducts.length, 10)}) для оформлення замовлення`;
    
    bot.sendMessage(chatId, searchResults, {
      parse_mode: 'Markdown',
      reply_markup: {
        keyboard: [['🔍 Новий пошук', '📄 Список товарів', '🏠 Головне меню']],
        resize_keyboard: true
      }
    });
    
    userStates[chatId] = 'view_products';
    userOrders[chatId] = { products: filteredProducts.slice(0, 10) };
    
  } catch (error) {
    console.error('Помилка пошуку:', error.message);
    bot.editMessageText('❌ Сталася помилка при пошуку. Спробуйте пізніше.', {
      chat_id: chatId,
      message_id: loadingMsg.message_id
    });
  }
}

// Функція обробки вибору товару
async function handleProductSelection(chatId, productNumber, currentState) {
  if (currentState !== 'view_products' || !userOrders[chatId] || !userOrders[chatId].products) {
    bot.sendMessage(chatId, 
      '❌ Спочатку перегляньте каталог товарів.', 
      Object.assign({}, mainMenu)
    );
    return;
  }
  
  const index = parseInt(productNumber) - 1;
  const products = userOrders[chatId].products;
  
  if (index < 0 || index >= products.length) {
    bot.sendMessage(chatId, 
      `❌ Неправильний номер товару. Введіть число від 1 до ${products.length}.`
    );
    return;
  }
  
  const product = products[index];
  const price = product.price ? `${product.price} грн` : 'Ціна за запитом';
  const availability = product.presence === 'available' ? '✅ В наявності' : '⌛ Під замовлення';
  
  // Показуємо детальну інформацію про товар
  let productInfo = `🛒 *Товар для замовлення:*\n\n*${product.name}*\n\n💰 *${price}*\n${availability}\n\n`;
  
  if (product.description) {
    productInfo += `📝 ${product.description.substring(0, 200)}${product.description.length > 200 ? '...' : ''}\n\n`;
  }
  
  if (product.vendor_code) {
    productInfo += `🏷 Артикул: ${product.vendor_code}\n`;
  }
  
  if (product.brand) {
    productInfo += `🏢 Бренд: ${product.brand}\n`;
  }
  
  productInfo += '\n*Підтверджуєте замовлення?*';
  
  bot.sendMessage(chatId, productInfo, {
    parse_mode: 'Markdown',
    reply_markup: {
      keyboard: [
        ['✅ Підтверджую замовлення'],
        ['◀️ Назад', '🏠 Головне меню']
      ],
      resize_keyboard: true
    }
  });
  
  userOrders[chatId].selectedProduct = product;
  userStates[chatId] = 'confirm_order';
}

// Обробка підтвердження замовлення
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;
  
  if (text === '✅ Підтверджую замовлення' && userStates[chatId] === 'confirm_order') {
    userStates[chatId] = 'order_name';
    bot.sendMessage(chatId, 
      '🛒 *Оформлення замовлення*\n\nДля продовження, вкажіть ваше ім\'я:', 
      { 
        parse_mode: 'Markdown',
        reply_markup: {
          keyboard: [['🏠 Головне меню']],
          resize_keyboard: true
        }
      }
    );
  } else if (text === '🔍 Новий пошук') {
    userStates[chatId] = 'search_product';
    bot.sendMessage(chatId, 
      '🔍 *Пошук товару*\n\nВведіть назву товару для пошуку:', 
      { 
        parse_mode: 'Markdown',
        reply_markup: {
          keyboard: [['🏠 Головне меню']],
          resize_keyboard: true
        }
      }
    );
  }
});

// Функція обробки замовлення
async function processOrder(chatId) {
  const orderData = userOrders[chatId];
  
  if (!orderData || !orderData.selectedProduct) {
    bot.sendMessage(chatId, '❌ Помилка оформлення замовлення.', Object.assign({}, mainMenu));
    return;
  }
  
  const product = orderData.selectedProduct;
  
  // Відправляємо повідомлення про обробку
  bot.sendMessage(chatId, '⏳ Оформлюємо ваше замовлення...');
  
  // Створюємо замовлення через API
  const orderResult = await createOrder({
    name: orderData.name,
    phone: orderData.phone,
    address: orderData.address,
    productId: product.id
  });
  
  // Зберігаємо для адміна
  const newOrder = {
    id: orderResult?.id || `temp_${Date.now()}`,
    product: product.name,
    name: orderData.name,
    phone: orderData.phone,
    address: orderData.address,
    date: new Date().toISOString()
  };
  
  adminOrders.push(newOrder);
  
  // Повідомляємо адміна
  const adminText = `🆕 *Нове замовлення!*\n\n📦 Товар: *${product.name}*\n💰 Ціна: ${product.price || 'за запитом'} грн\n👤 Клієнт: ${orderData.name}\n📞 Телефон: ${orderData.phone}\n🏠 Адреса: ${orderData.address}`;
  
  if (process.env.ADMIN_CHAT_ID) {
    bot.sendMessage(process.env.ADMIN_CHAT_ID, adminText, {
      parse_mode: 'Markdown'
    });
  }
  
  // Повідомляємо клієнта
  bot.sendMessage(chatId, 
    `✅ *Замовлення успішно оформлено!*\n\n📦 Товар: *${product.name}*\n💰 Ціна: ${product.price || 'за запитом'} грн\n👤 Ім'я: ${orderData.name}\n📞 Телефон: ${orderData.phone}\n🏠 Адреса: ${orderData.address}\n\nМи зв'яжемося з вами найближчим часом для підтвердження замовлення. Дякуємо за покупку! 🙏`, 
    Object.assign({ parse_mode: 'Markdown' }, mainMenu)
  );
  
  // Очищаємо стан користувача
  userStates[chatId] = 'main_menu';
  delete userOrders[chatId];
}

// Функція відстеження замовлення
async function trackOrder(chatId, orderNumber) {
  // Тут можна реалізувати логіку відстеження через API Prom.ua
  bot.sendMessage(chatId, 
    `📦 *Відстеження замовлення №${orderNumber}*\n\nЗамовлення обробляється нашими менеджерами.\nЗ вами зв'яжуться найближчим часом для підтвердження деталей доставки.\n\nДля додаткової інформації зверніться до підтримки.`, 
    Object.assign({ parse_mode: 'Markdown' }, mainMenu)
  );
  
  userStates[chatId] = 'main_menu';
}

// Обробка команди для отримання допомоги
bot.onText(/\/help/, (msg) => {
  const chatId = msg.chat.id;
  
  bot.sendMessage(chatId, 
    '📖 *Довідка з використання бота:*\n\n• Натисніть кнопку "Каталог" для перегляду товарів\n• Оберіть "Список товарів" для перегляду всіх товарів\n• Використовуйте "Пошук товару" для знаходження конкретного товару\n• При оформленні замовлення вас попросять вказати ім\'я, телефон та адресу доставки\n• Після оформлення замовлення з вами зв\'яжеться наш менеджер\n\nЯкщо у вас є питання, натисніть кнопку "Підтримка".', 
    Object.assign({ parse_mode: 'Markdown' }, mainMenu)
  );
});

console.log('Бот запущено!');

// Експортуємо об'єкти для адмінського модуля
module.exports = { bot, adminOrders };
adminModule(bot, [], adminOrders);
