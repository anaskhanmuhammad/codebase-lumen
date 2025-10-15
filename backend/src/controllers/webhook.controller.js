import { verifyWebhook } from "@clerk/express/webhooks";

/**
 * Main webhook handler - Just for testing
 */
export const clerkWebHook = async (req, res) => {
  try {
    console.log(`CLERK_WEBHOOK_
SIGNING_SECRET=${process.env.CLERK_WEBHOOK_SIGNING_SECRET}`);

    const evt = await verifyWebhook(req);

    const { id } = evt.data;
    const eventType = evt.type;

    console.log("=====================================");
    console.log("🎉 WEBHOOK RECEIVED SUCCESSFULLY!");
    console.log("=====================================");
    console.log(`Event Type: ${eventType}`);
    console.log(`User ID: ${id}`);
    console.log("Full payload:", evt.data);
    console.log("=====================================");

    return res.status(200).send("Webhook received");
  } catch (err) {
    console.error("❌ Error verifying webhook:", err);
    return res.status(400).send("Error verifying webhook");
  }
};
