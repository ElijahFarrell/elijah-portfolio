// Vercel BotID: marks requests from real browsers so /api/chat can turn bots away.
// Bundled to public/botid.js by `npm run build`; chat.js loads it once the chat is on.
import { initBotId } from 'botid/client/core';

initBotId({
  protect: [{ path: '/api/chat', method: 'POST' }],
});
