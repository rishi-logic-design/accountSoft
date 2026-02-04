const notificationService = require("../../services/vendor/notificationService");

exports.getMyNotifications = async (req, res) => {
  try {
    const { id, role } = req.user;

    const notifications = await notificationService.getNotificationsByUser(
      id,
      role,
    );

    res.json({
      success: true,
      data: notifications,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.markAsRead = async (req, res) => {
  try {
    const { id } = req.user;
    const { notificationId } = req.params;

    await notificationService.markOneAsRead(notificationId, id);

    res.json({
      success: true,
      message: "Notification marked as read",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.markAllRead = async (req, res) => {
  try {
    const { id, role } = req.user;

    await notificationService.markAllAsRead(id, role);

    res.json({
      success: true,
      message: "All notifications marked as read",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
