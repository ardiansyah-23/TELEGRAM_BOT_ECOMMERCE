import { setupCategoriesCallback } from './categories';
import { setupProductsCallback } from './products';
import { setupCartCallback } from './cart';
import { setupCheckoutCallback } from './checkout';
import { setupOrdersCallback } from './orders';

export const setupShopCallbacks = (bot: any) => {
  setupCategoriesCallback(bot);
  setupProductsCallback(bot);
  setupCartCallback(bot);
  setupCheckoutCallback(bot);
  setupOrdersCallback(bot);
};
