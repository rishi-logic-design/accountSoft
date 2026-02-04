const db = require("../../models/");
const Notification = db.Notification;

exports.createNotification = async (payload) => {
  return await Notification.create({
    userId: payload.userId,
    userRole: payload.userRole,
    title: payload.title,
    message: payload.message,
    type: payload.type || "SYSTEM",
    level: payload.level || "INFO",
    entityType: payload.entityType || null,
    entityId: payload.entityId || null,
  });
};

exports.getNotificationsByUser = async (userId, userRole) => {
  return await Notification.findAll({
    where: {
      userId,
      userRole,
    },
    order: [["createdAt", "DESC"]],
  });
};

exports.markOneAsRead = async (id, userId) => {
  return await Notification.update({ isRead: true }, { where: { id, userId } });
};

exports.markAllAsRead = async (userId, userRole) => {
  return await Notification.update(
    { isRead: true },
    { where: { userId, userRole } },
  );
};
