module.exports = (sequelize, DataTypes) => {
  const Notification = sequelize.define(
    "Notification",
    {
      userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },

      userRole: {
        type: DataTypes.ENUM("ADMIN", "VENDOR", "CUSTOMER"),
        allowNull: false,
      },

      title: {
        type: DataTypes.STRING,
        allowNull: false,
      },

      message: {
        type: DataTypes.TEXT,
        allowNull: false,
      },

      type: {
        type: DataTypes.ENUM("SYSTEM", "TRANSACTION"),
        allowNull: false,
      },

      level: {
        type: DataTypes.ENUM("INFO", "SUCCESS", "ERROR", "WARNING"),
        defaultValue: "INFO",
      },

      entityType: {
        type: DataTypes.STRING, 
      },

      entityId: {
        type: DataTypes.INTEGER,
      },

      isRead: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
    },
    {
      tableName: "notifications",
    },
  );

  return Notification;
};
