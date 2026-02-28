import { verifyWebhook } from "@clerk/express/webhooks";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const clerkWebHook = async (req, res) => {
  try {
    const evt = await verifyWebhook(req);
    const eventType = evt.type;
    const data = evt.data;

    console.log(`📨 Clerk webhook received: ${eventType}`);

    // ─── user.created ───────────────────────────────────────────────────
    if (eventType === "user.created") {
      const primaryEmail = data.email_addresses?.find(
        (e) => e.id === data.primary_email_address_id
      )?.email_address;

      const username =
        data.username ||
        primaryEmail?.split("@")[0] ||
        data.id; // fallback to Clerk ID if nothing else exists

      await prisma.user.create({
        data: {
          clerkUserId: data.id,
          email: primaryEmail,
          name:
            [data.first_name, data.last_name].filter(Boolean).join(" ") || null,
          username,
          imageUrl: data.image_url || null,
        },
      });

      console.log(`✅ User created in DB: ${primaryEmail}`);
    }

    // ─── user.updated ───────────────────────────────────────────────────
    else if (eventType === "user.updated") {
      const primaryEmail = data.email_addresses?.find(
        (e) => e.id === data.primary_email_address_id
      )?.email_address;

      await prisma.user.update({
        where: { clerkUserId: data.id },
        data: {
          email: primaryEmail,
          name:
            [data.first_name, data.last_name].filter(Boolean).join(" ") || null,
          username: data.username || undefined,
          imageUrl: data.image_url || null,
        },
      });

      console.log(`✅ User updated in DB: ${data.id}`);
    }

    // ─── user.deleted ───────────────────────────────────────────────────
    else if (eventType === "user.deleted") {
      // Soft delete — keeps data intact but marks user as inactive
      await prisma.user.update({
        where: { clerkUserId: data.id },
        data: { isActive: false },
      });

      console.log(`🗑️ User soft-deleted in DB: ${data.id}`);
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error("❌ Webhook error:", err.message);
    return res.status(400).json({ error: "Webhook processing failed" });
  }
};
