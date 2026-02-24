const express = require("express");
const router = express.Router();
const inventoryController = require("../../controllers/vendor/inventoryController");
const authMiddleware = require("../../middleware/authMiddleware");

// All inventory routes require authentication
router.use(authMiddleware);

// Dashboard stats
router.get("/stats", inventoryController.getStats);

// Categories
router.post("/categories", inventoryController.createCategory);
router.get("/categories", inventoryController.listCategories);
router.put("/categories/:id", inventoryController.updateCategory);
router.delete("/categories/:id", inventoryController.deleteCategory);

// Items
router.post("/items", inventoryController.createItem);
router.get("/items", inventoryController.listItems);
router.put("/items/:id", inventoryController.updateItem);
router.delete("/items/:id", inventoryController.deleteItem);

module.exports = router;
