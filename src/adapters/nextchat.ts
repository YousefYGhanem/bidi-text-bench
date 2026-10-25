// NextChat v2.16 (audit/targets/nextchat/compose.yaml). Chats live in the browser profile.
import type { Adapter } from './adapter.ts';
import { settled } from './adapter.ts';

const URL = 'http://127.0.0.1:3102/';
// Assistant messages only: the user's carry an extra chat-message-user class.
const replies =
  'div[class*="chat_chat-message__"]:not([class*="chat-message-user"]) .markdown-body';

export const nextchat: Adapter = {
  id: 'nextchat',
  mode: 'auto-chat',
  async open(page) {
    await page.goto(URL);
    await page.locator('textarea').waitFor();
  },
  async send(page, fx) {
    const before = await page.locator(replies).count();
    await page.locator('textarea').fill(`#fx:${fx.id}`);
    await page.keyboard.press('Enter');
    const reply = page.locator(replies).nth(before);
    await reply.waitFor();
    await settled(reply);
    return reply;
  },
  input: async (page) => page.locator('textarea'),
  exclude: ['button', '.copy-code-button'],
};
