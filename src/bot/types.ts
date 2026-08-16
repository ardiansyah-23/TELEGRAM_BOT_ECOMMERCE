import { Context, SessionFlavor } from 'grammy';
import { ConversationFlavor, Conversation } from '@grammyjs/conversations';

export type MyContext = Context & SessionFlavor<any> & ConversationFlavor<Context>;
export type MyConversation = Conversation<MyContext>;
