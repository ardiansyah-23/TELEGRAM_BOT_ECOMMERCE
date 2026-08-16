import { Conversation } from '@grammyjs/conversations';
import { createCategory } from '../../database/categories';
import { createProduct } from '../../database/products';
import { getCategories } from '../../database/categories';
import { InlineKeyboard } from 'grammy';
import type { MyContext, MyConversation } from '../types';

export async function addCategoryConversation(conversation: MyConversation, ctx: MyContext) {
  await ctx.reply('Masukkan nama kategori baru: (atau /cancel)');
  const { message: nameMsg } = await conversation.wait();
  if (nameMsg?.text === '/cancel') return ctx.reply('Batal.');

  await ctx.reply('Masukkan slug kategori (misal: pakaian-pria):');
  const { message: slugMsg } = await conversation.wait();
  if (slugMsg?.text === '/cancel') return ctx.reply('Batal.');

  const category = await createCategory(nameMsg!.text!, slugMsg!.text!);
  if (category) {
    await ctx.reply(`✅ Kategori ${category.name} berhasil dibuat!`);
  } else {
    await ctx.reply('❌ Gagal membuat kategori. Pastikan slug unik.');
  }
}

export async function addProductConversation(conversation: MyConversation, ctx: MyContext) {
  const categories = await getCategories(false);
  if (categories.length === 0) {
    await ctx.reply('❌ Buat kategori terlebih dahulu.');
    return;
  }
  
  await ctx.reply('Masukkan nama produk: (atau /cancel)');
  const { message: nameMsg } = await conversation.wait();
  if (nameMsg?.text === '/cancel') return ctx.reply('Batal.');
  
  await ctx.reply('Masukkan slug unik (tanpa spasi):');
  const { message: slugMsg } = await conversation.wait();
  if (slugMsg?.text === '/cancel') return ctx.reply('Batal.');
  
  await ctx.reply('Masukkan harga (hanya angka):');
  const { message: priceMsg } = await conversation.wait();
  if (priceMsg?.text === '/cancel') return ctx.reply('Batal.');
  const price = parseInt(priceMsg!.text!);
  if (isNaN(price) || price < 0) return ctx.reply('❌ Harga tidak valid.');
  
  await ctx.reply('Masukkan stok awal (hanya angka):');
  const { message: stockMsg } = await conversation.wait();
  if (stockMsg?.text === '/cancel') return ctx.reply('Batal.');
  const stock = parseInt(stockMsg!.text!);
  if (isNaN(stock) || stock < 0) return ctx.reply('❌ Stok tidak valid.');

  const kb = new InlineKeyboard();
  categories.forEach((c: any) => kb.text(c.name, `select_cat_${c.id}`).row());
  await ctx.reply('Pilih Kategori:', { reply_markup: kb });
  
  const cb = await conversation.waitForCallbackQuery(/select_cat_(.+)/);
  await cb.answerCallbackQuery();
  const category_id = cb.match[1];
  
  const product = await createProduct(
    category_id, nameMsg!.text!, slugMsg!.text!, price, stock
  );
  
  if (product) {
    await cb.editMessageText(`✅ Produk ${product.name} berhasil ditambahkan!`);
  } else {
    await cb.editMessageText('❌ Gagal membuat produk.');
  }
}
