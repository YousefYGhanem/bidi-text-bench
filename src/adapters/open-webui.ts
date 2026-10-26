// Open WebUI v0.12 (audit/targets/open-webui/compose.yaml), single user with WEBUI_AUTH=False.
import type { Adapter } from './adapter.ts';
import { settled } from './adapter.ts';

// TARGET_HOST: host.docker.internal when the browser runs in Docker (npm run audit).
const url = () => `http://${process.env.TARGET_HOST ?? '127.0.0.1'}:3101/`;
const replies = '.chat-assistant #response-content-container .markdown-prose';

export const openWebui: Adapter = {
  id: 'open-webui',
  mode: 'auto-chat',
  url,
  async open(page) {
    await page.goto(url());
    await page.locator('#chat-input').waitFor();
    // The release-notes dialog opens once per browser profile and blocks the compose box.
    const ok = page.getByRole('button', { name: "Okay, Let's Go!" });
    await ok
      .waitFor({ timeout: 3000 })
      .then(() => ok.click())
      .catch(() => {});
  },
  async send(page, fx) {
    const before = await page.locator(replies).count();
    await page.locator('#chat-input').fill(`#fx:${fx.id}`);
    await page.keyboard.press('Enter');
    const reply = page.locator(replies).nth(before);
    await reply.waitFor();
    await settled(reply);
    return reply;
  },
  input: async (page) => page.locator('#chat-input'),
  exclude: ['button'],
};
