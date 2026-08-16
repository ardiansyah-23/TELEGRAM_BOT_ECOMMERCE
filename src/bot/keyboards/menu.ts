import { InlineKeyboard } from 'grammy';

export const getMainMenu = () => {
  return new InlineKeyboard()
    .text('👤 Profil', 'menu_profile')
    .text('⚙️ Pengaturan', 'menu_settings')
    .row()
    .webApp('💬 Bantuan', `${process.env.WEBHOOK_URL || ''}/web/index.html?page=support`)
    .text('ℹ️ Tentang', 'menu_about');
};
