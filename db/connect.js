const { Sequelize } = require("sequelize");

const isProduction = process.env.NODE_ENV === "production";

console.log("🔧 Database Configuration:");
console.log("Environment:", process.env.NODE_ENV);
console.log("Host:", process.env.DB_HOST);
console.log("Port:", process.env.DB_PORT);
console.log("Database:", process.env.DB_NAME);
console.log("SSL Enabled:", isProduction);

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASS,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 15307,
    dialect: "mysql",
    logging: console.log, // ✅ Enable logging to see queries

    dialectOptions: isProduction
      ? {
          ssl: {
            require: true,
            rejectUnauthorized: false,
          },
          connectTimeout: 60000,
        }
      : {
          connectTimeout: 60000,
        },

    pool: {
      max: 5,
      min: 0,
      acquire: 60000,
      idle: 10000,
    },

    retry: {
      max: 3,
    },
  }
);

// Test connection immediately
(async () => {
  try {
    await sequelize.authenticate();
    console.log("✅ MySQL Database connected successfully");
  } catch (err) {
    console.error("❌ Database connection failed!");
    console.error("Error:", err.message);
    console.error("Full Error:", err);
  }
})();

module.exports = { sequelize, Sequelize };