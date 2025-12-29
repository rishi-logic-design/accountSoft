const { Sequelize } = require("sequelize");

const isProduction = process.env.NODE_ENV === "production";

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASS,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    dialect: "mysql",
    logging: false,

    // ✅ SSL ONLY FOR AIVEN / PRODUCTION
    dialectOptions: isProduction
      ? {
          ssl: {
            require: true,
            rejectUnauthorized: false,
          },
        }
      : {},

    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
  }
);

(async () => {
  try {
    await sequelize.authenticate();
    console.log("✅ MySQL Database connected successfully...");
  } catch (err) {
    console.error("❌ Database connection failed!");
    console.error("Reason:", err.message);
    // process.exit(1);
  }
})();

module.exports = { sequelize, Sequelize };
