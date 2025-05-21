
const { Telegraf, Markup } = require('telegraf');
const bot = new Telegraf('YOUR_BOT_TOKEN'); // Replace with actual token or process.env

// Основне меню зі звичайною клавіатурою
const mainMenu = Markup.keyboard([
    ['Каталог', 'Про нас'],
    ['Контакти', 'Допомога']
]).resize();

// Обробник старту
bot.start((ctx) => {
    ctx.reply('Вітаємо у нашому магазині!', mainMenu);
});

// Обробка натискань на кнопки меню
bot.hears('Каталог', (ctx) => {
    ctx.reply('Ось наш каталог...', mainMenu);
});
bot.hears('Про нас', (ctx) => {
    ctx.reply('Ми займаємось продажем...', mainMenu);
});
bot.hears('Контакти', (ctx) => {
    ctx.reply('Наші контакти: ...', mainMenu);
});
bot.hears('Допомога', (ctx) => {
    ctx.reply('Як ми можемо вам допомогти?', mainMenu);
});

bot.launch();
console.log('Бот запущено');
