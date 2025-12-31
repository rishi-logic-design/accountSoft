const express = require("express");
const router = express.Router();
const productCtrl = require("../../controllers/vendor/productController");
const auth = require("../../middleware/authMiddleware");
const role = require("../../middleware/roleMiddleware");

router.use(auth);
router.use(role(["vendor", "admin", "superadmin"]));

// Category management
router.post("/categories", productCtrl.createCategory);
router.get("/categories", productCtrl.listCategories);
router.put("/categories/:id", productCtrl.updateCategory);
router.delete("/categories/:id", productCtrl.deleteCategory);

// Size management
router.post("/sizes", productCtrl.createSize);
router.get("/sizes", productCtrl.listSizes);
router.put("/sizes/:id", productCtrl.updateSize);
router.delete("/sizes/:id", productCtrl.deleteSize);

// Products
router.post("/", productCtrl.createProduct);
router.get("/", productCtrl.listProducts);
router.get("/:id", productCtrl.getProductDetail);
router.put("/:id", productCtrl.updateProduct);
router.delete("/:id", productCtrl.deleteProduct);

// Stock management
router.post("/stock/change", productCtrl.changeStock);

module.exports = router;