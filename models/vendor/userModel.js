module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define(
    "User",
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      email: {
        type: DataTypes.STRING(255),
        allowNull: false,
        unique: true,
        validate: { isEmail: true },
      },
      role: {
        type: DataTypes.ENUM("admin", "superadmin", "vendor", "customer"),
        defaultValue: "vendor",
        allowNull: false,
      },
      mobile: {
        type: DataTypes.STRING(15),
        allowNull: false, 
        unique: true,
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
      },
    },
    {
      tableName: "users",
      timestamps: true,
    }
  );

  User.prototype.isAdmin = function () {
    return this.role === "admin" || this.role === "superadmin";
  };

  User.prototype.isSuperAdmin = function () {
    return this.role === "superadmin";
  };

  return User;
};
