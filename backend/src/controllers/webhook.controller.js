import { verifyWebhook } from "@clerk/express/webhooks";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const clerkWebHook = async (req, res) => {
  try {
    const evt = await verifyWebhook(req);
    const eventType = evt.type;
    const data = evt.data;

    

    
    if (eventType === "user.created") {
      const primaryEmail = data.email_addresses?.find(
        (e) => e.id === data.primary_email_address_id
      )?.email_address;

      const username =
        data.username ||
        primaryEmail?.split("@")[0] ||
        data.id;

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

      
    }

    
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

      
    }

    
    else if (eventType === "user.deleted") {
      
      await prisma.user.update({
        where: { clerkUserId: data.id },
        data: { isActive: false },
      });

      
    }

    return res.status(200).json({ received: true });
    } catch (err) {
      return res.status(400).json({ error: "Webhook processing failed" });
    }
};
