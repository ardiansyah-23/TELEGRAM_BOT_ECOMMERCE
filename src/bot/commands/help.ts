import { Bot } from 'grammy';

export const setupHelpCommand = (bot: Bot) => {
  bot.command('help', async (ctx) => {
    const helpMessage = `
Daftar Perintah yang tersedia:
/start - Memulai bot dan menampilkan menu utama
/help - Menampilkan pesan bantuan ini
    `;
    await ctx.reply(helpMessage);
  });
};
