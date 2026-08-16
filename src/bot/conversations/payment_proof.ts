import { MyContext, MyConversation } from '../index';
import { InlineKeyboard } from 'grammy';
import { getOrderById, updateOrderStatus } from '../../database/orders';
import { config } from '../../config/env';
import { bot } from '../index';

export async function paymentProofConversation(conversation: MyConversation, ctx: MyContext) {
  // @ts-ignore
  const order_id = ctx.session?.payment_order_id;
  
  if (!order_id) {
    await ctx.reply('Terjadi kesalahan. Order ID tidak ditemukan.');
    return;
  }

  const data = await getOrderById(order_id);
  if (!data) {
    await ctx.reply('❌ Pesanan tidak ditemukan.');
    return;
  }

  await ctx.reply(
    '📸 **Kirim Bukti Pembayaran**\n\nSilakan unggah foto (screenshot) bukti transfer Anda di obrolan ini.\nKetik "batal" jika ingin membatalkan pengiriman bukti.',
    { parse_mode: 'Markdown' }
  );

  let photoFileId: string | null = null;

  while (true) {
    const response = await conversation.waitFor('message');
    
    if (response.message?.text?.toLowerCase() === 'batal') {
      await ctx.reply('Pengiriman bukti dibatalkan.');
      return;
    }

    if (response.message?.photo) {
      // Get the highest resolution photo
      const photo = response.message.photo[response.message.photo.length - 1];
      photoFileId = photo.file_id;
      break;
    } else {
      await ctx.reply('Tolong kirimkan dalam bentuk gambar/foto (Ketik "batal" untuk membatalkan).');
    }
  }

  if (photoFileId) {
    await ctx.reply('🔄 Mengirim bukti ke sistem...');

    // Update order status
    await updateOrderStatus(order_id, 'verifying');

    // Notify Admin
    if (config.ADMIN_TELEGRAM_ID) {
      try {
        const kb = new InlineKeyboard()
          .text('✅ Terima', `admin:payment:approve:${order_id}`)
          .text('❌ Tolak', `admin:payment:reject:${order_id}`);

        const adminMsg = `🚨 **Verifikasi Pembayaran Baru!**\n\nOrder: ${data.order.order_number}\nUser: @${ctx.from?.username || ctx.from?.first_name}\nTotal: Rp ${data.order.total.toLocaleString('id-ID')}`;

        await conversation.external(async () => {
          await bot.api.sendPhoto(config.ADMIN_TELEGRAM_ID!, photoFileId!, {
            caption: adminMsg,
            reply_markup: kb,
            parse_mode: 'Markdown'
          });
        });

      } catch (err) {
        console.error('Gagal mengirim ke admin:', err);
      }
    }

    await ctx.reply(
      '✅ **Bukti Terkirim!**\n\nBukti pembayaran Anda sedang diverifikasi oleh tim kami. Kami akan mengabari Anda setelah proses verifikasi selesai.',
      { parse_mode: 'Markdown' }
    );
  }
}
