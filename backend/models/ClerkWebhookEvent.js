const mongoose = require('mongoose');

// One row per Clerk webhook delivery we've accepted, keyed by svix-id.
// Clerk delivers at least once and retries with the same svix-id, so a
// second delivery finds its row and is acknowledged without being applied
// again. Rows expire after 30 days, well past Clerk's retry window.
const clerkWebhookEventSchema = new mongoose.Schema({
  svixId: { type: String, required: true, unique: true },
  type: { type: String, required: true },
  clerkUserId: String,
  receivedAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 30 },
});

module.exports = mongoose.model('ClerkWebhookEvent', clerkWebhookEventSchema);
