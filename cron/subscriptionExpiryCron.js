const cron = require("node-cron");
const { SubscriptionModel, VendorModel } = require("../models");
const { Op } = require("sequelize");

// Run every day at 12:00 AM (midnight)
const checkAndUpdateExpiredSubscriptions = cron.schedule(
  "0 0 * * *",
  async () => {
    try {
      console.log("🔄 Running subscription expiry check...");

      const today = new Date().toISOString().split("T")[0];

      // Find all active subscriptions that expired today or before
      const expiredSubscriptions = await SubscriptionModel.findAll({
        where: {
          status: "active",
          endDate: {
            [Op.lte]: today,
          },
        },
        include: [{ model: VendorModel, as: "vendor" }],
      });

      if (expiredSubscriptions.length > 0) {
        console.log(
          `⚠️ Found ${expiredSubscriptions.length} expired subscription(s)`
        );

        // Update subscriptions to expired status
        for (const subscription of expiredSubscriptions) {
          await subscription.update({ status: "expired" });

          // Update vendor status to Inactive
          if (subscription.vendor) {
            await subscription.vendor.update({ status: "Inactive" });
            console.log(
              `❌ Vendor ${subscription.vendor.vendorName} subscription expired`
            );
          }
        }

        console.log("✅ Successfully updated expired subscriptions");
      } else {
        console.log("✅ No expired subscriptions found");
      }
    } catch (error) {
      console.error("❌ Error checking expired subscriptions:", error);
    }
  }
);

// Run every day at 9:00 AM to send alerts for subscriptions expiring within 7 days
const checkExpiringSubscriptions = cron.schedule("0 9 * * *", async () => {
  try {
    console.log("🔔 Checking for expiring subscriptions...");

    const today = new Date();
    const next7Days = new Date();
    next7Days.setDate(next7Days.getDate() + 7);

    const expiringSubscriptions = await SubscriptionModel.findAll({
      where: {
        status: "active",
        endDate: {
          [Op.between]: [
            today.toISOString().split("T")[0],
            next7Days.toISOString().split("T")[0],
          ],
        },
      },
      include: [{ model: VendorModel, as: "vendor" }],
    });

    if (expiringSubscriptions.length > 0) {
      console.log(
        `⚠️ Found ${expiringSubscriptions.length} subscription(s) expiring soon`
      );

      for (const subscription of expiringSubscriptions) {
        const endDate = new Date(subscription.endDate);
        const daysLeft = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));

        console.log(
          `📅 ${
            subscription.vendor?.vendorName || "Unknown"
          } - ${daysLeft} day(s) remaining`
        );

        // Here you can implement email/SMS notification logic
        // sendNotification(subscription, daysLeft);
      }
    } else {
      console.log("✅ No subscriptions expiring in the next 7 days");
    }
  } catch (error) {
    console.error("❌ Error checking expiring subscriptions:", error);
  }
});

// Start both cron jobs
const startSubscriptionCronJobs = () => {
  checkAndUpdateExpiredSubscriptions.start();
  checkExpiringSubscriptions.start();
  console.log("✅ Subscription cron jobs started");
};

// Stop cron jobs
const stopSubscriptionCronJobs = () => {
  checkAndUpdateExpiredSubscriptions.stop();
  checkExpiringSubscriptions.stop();
  console.log("⏸️ Subscription cron jobs stopped");
};

module.exports = {
  startSubscriptionCronJobs,
  stopSubscriptionCronJobs,
  checkAndUpdateExpiredSubscriptions,
  checkExpiringSubscriptions,
};