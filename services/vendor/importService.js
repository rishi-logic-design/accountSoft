const {
  CustomerModel: Customer,
  ProductModel: Product,
  ChallanModel: Challan,
  BillModel: Bill,
  PaymentModel: Payment,
  FirmModel: Firm,
  GstSlabModel: GstSlab,
  ChallanItemModel: ChallanItem,
  BillItemModel: BillItem,
  sequelize,
} = require("../../models");

const BATCH_SIZE = 100;

async function processBatch(items, processFn, batchSize = BATCH_SIZE) {
  const results = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(processFn));
    results.push(...batchResults);
  }
  return results;
}

exports.processImport = async (vendorId, data) => {
  const summary = {
    customers: { inserted: 0, skipped: 0, errors: [] },
    products: { inserted: 0, skipped: 0, errors: [] },
    challans: { inserted: 0, skipped: 0, errors: [] },
    bills: { inserted: 0, skipped: 0, errors: [] },
    payments: { inserted: 0, skipped: 0, errors: [] },
    firm: { updated: false, error: null },
    gstSlabs: { inserted: 0, skipped: 0, errors: [] },
  };

  // Use transaction for data integrity
  const transaction = await sequelize.transaction({
    isolationLevel: sequelize.Transaction.ISOLATION_LEVELS.READ_COMMITTED,
  });

  try {
    console.log("Starting import process for vendor:", vendorId);

    // =====================
    // 1. FIRM (single) - Quick operation
    // =====================
    if (data.firm) {
      try {
        const firmData = { ...data.firm };
        delete firmData.id;
        delete firmData.createdAt;
        delete firmData.updatedAt;
        delete firmData.vendorId;

        await Firm.upsert(
          {
            ...firmData,
            vendorId,
          },
          { transaction },
        );
        summary.firm.updated = true;
        console.log("Firm data updated");
      } catch (err) {
        summary.firm.error = err.message;
        console.error("Firm update error:", err.message);
      }
    }

    // =====================
    // 2. GST SLABS - Batch insert
    // =====================
    if (Array.isArray(data.gstSlabs) && data.gstSlabs.length > 0) {
      console.log(`Processing ${data.gstSlabs.length} GST slabs...`);

      // Get existing slabs for this vendor
      const existingSlabs = await GstSlab.findAll({
        where: { vendorId },
        attributes: ["slabName"],
        raw: true,
        transaction,
      });

      const existingSlabNames = new Set(existingSlabs.map((s) => s.slabName));

      const slabsToInsert = [];

      for (const slab of data.gstSlabs) {
        if (!slab.slabName || slab.rate == null) {
          summary.gstSlabs.skipped++;
          continue;
        }

        if (existingSlabNames.has(slab.slabName)) {
          summary.gstSlabs.skipped++;
          continue;
        }

        const slabData = { ...slab };
        delete slabData.id;
        delete slabData.createdAt;
        delete slabData.updatedAt;
        delete slabData.vendorId;

        slabsToInsert.push({
          ...slabData,
          vendorId,
        });
      }

      if (slabsToInsert.length > 0) {
        await GstSlab.bulkCreate(slabsToInsert, { transaction });
        summary.gstSlabs.inserted = slabsToInsert.length;
      }

      console.log(
        `GST Slabs: ${summary.gstSlabs.inserted} inserted, ${summary.gstSlabs.skipped} skipped`,
      );
    }

    // =====================
    // 3. PRODUCTS - Batch insert
    // =====================
    if (Array.isArray(data.products) && data.products.length > 0) {
      console.log(`Processing ${data.products.length} products...`);

      // Get existing products
      const existingProducts = await Product.findAll({
        where: { createdBy: vendorId },
        attributes: ["name"],
        raw: true,
        transaction,
      });

      const existingProductNames = new Set(existingProducts.map((p) => p.name));

      const productsToInsert = [];

      for (const p of data.products) {
        if (!p.name || p.price == null) {
          summary.products.skipped++;
          continue;
        }

        if (existingProductNames.has(p.name)) {
          summary.products.skipped++;
          continue;
        }

        const productData = { ...p };
        delete productData.id;
        delete productData.createdAt;
        delete productData.updatedAt;
        delete productData.createdBy;

        productsToInsert.push({
          ...productData,
          createdBy: vendorId,
        });
      }

      if (productsToInsert.length > 0) {
        // Insert in batches
        for (let i = 0; i < productsToInsert.length; i += BATCH_SIZE) {
          const batch = productsToInsert.slice(i, i + BATCH_SIZE);
          await Product.bulkCreate(batch, { transaction });
          summary.products.inserted += batch.length;
          console.log(
            `Products: ${summary.products.inserted}/${productsToInsert.length} inserted`,
          );
        }
      }

      console.log(
        `Products: ${summary.products.inserted} inserted, ${summary.products.skipped} skipped`,
      );
    }

    // =====================
    // 4. CUSTOMERS - Batch insert
    // =====================
    if (Array.isArray(data.customers) && data.customers.length > 0) {
      console.log(`Processing ${data.customers.length} customers...`);

      // Get existing customers
      const existingCustomers = await Customer.findAll({
        where: { createdBy: vendorId },
        attributes: ["mobileNumber"],
        raw: true,
        transaction,
      });

      const existingMobiles = new Set(
        existingCustomers.map((c) => c.mobileNumber),
      );

      const customersToInsert = [];

      for (const c of data.customers) {
        if (!c.customerName || !c.mobileNumber) {
          summary.customers.skipped++;
          continue;
        }

        if (existingMobiles.has(c.mobileNumber)) {
          summary.customers.skipped++;
          continue;
        }

        const customerData = { ...c };
        delete customerData.id;
        delete customerData.createdAt;
        delete customerData.updatedAt;
        delete customerData.createdBy;

        customersToInsert.push({
          ...customerData,
          createdBy: vendorId,
        });
      }

      if (customersToInsert.length > 0) {
        // Insert in batches
        for (let i = 0; i < customersToInsert.length; i += BATCH_SIZE) {
          const batch = customersToInsert.slice(i, i + BATCH_SIZE);
          await Customer.bulkCreate(batch, { transaction });
          summary.customers.inserted += batch.length;
          console.log(
            `Customers: ${summary.customers.inserted}/${customersToInsert.length} inserted`,
          );
        }
      }

      console.log(
        `Customers: ${summary.customers.inserted} inserted, ${summary.customers.skipped} skipped`,
      );
    }

    // Commit the first transaction (firm, slabs, products, customers)
    await transaction.commit();
    console.log("First phase committed successfully");

    // =====================
    // 5. CHALLANS with ITEMS - Process in separate transaction
    // =====================
    if (Array.isArray(data.challans) && data.challans.length > 0) {
      console.log(`Processing ${data.challans.length} challans...`);

      const challanTransaction = await sequelize.transaction();

      try {
        // Get customer mapping
        const customers = await Customer.findAll({
          where: { createdBy: vendorId },
          attributes: ["id", "mobileNumber"],
          raw: true,
        });

        const customerMap = new Map(
          customers.map((c) => [c.mobileNumber, c.id]),
        );

        // Get existing challans
        const existingChallans = await Challan.findAll({
          where: { vendorId },
          attributes: ["challanNumber"],
          raw: true,
        });

        const existingChallanNumbers = new Set(
          existingChallans.map((ch) => ch.challanNumber),
        );

        for (const ch of data.challans) {
          try {
            if (!ch.challanNumber || !ch.customerMobile) {
              summary.challans.skipped++;
              continue;
            }

            if (existingChallanNumbers.has(ch.challanNumber)) {
              summary.challans.skipped++;
              continue;
            }

            const customerId = customerMap.get(ch.customerMobile);
            if (!customerId) {
              summary.challans.skipped++;
              summary.challans.errors.push({
                challan: ch.challanNumber,
                error: "Customer not found",
              });
              continue;
            }

            const challanData = { ...ch };
            delete challanData.id;
            delete challanData.createdAt;
            delete challanData.updatedAt;
            delete challanData.customerMobile;
            delete challanData.customer;
            delete challanData.vendorId;
            delete challanData.customerId;

            const items = challanData.items || [];
            delete challanData.items;

            const newChallan = await Challan.create(
              {
                ...challanData,
                vendorId,
                customerId,
              },
              { transaction: challanTransaction },
            );

            if (items.length > 0) {
              const itemsToInsert = items.map((item) => {
                const itemData = { ...item };
                delete itemData.id;
                delete itemData.createdAt;
                delete itemData.updatedAt;
                delete itemData.challanId;
                return {
                  ...itemData,
                  challanId: newChallan.id,
                };
              });

              await ChallanItem.bulkCreate(itemsToInsert, {
                transaction: challanTransaction,
              });
            }

            summary.challans.inserted++;

            if (summary.challans.inserted % 50 === 0) {
              console.log(`Challans: ${summary.challans.inserted} inserted`);
            }
          } catch (err) {
            summary.challans.errors.push({
              challan: ch.challanNumber,
              error: err.message,
            });
            summary.challans.skipped++;
          }
        }

        await challanTransaction.commit();
        console.log(
          `Challans: ${summary.challans.inserted} inserted, ${summary.challans.skipped} skipped`,
        );
      } catch (err) {
        await challanTransaction.rollback();
        console.error("Challan import failed:", err);
        throw err;
      }
    }

    // =====================
    // 6. BILLS with ITEMS - Process in separate transaction
    // =====================
    if (Array.isArray(data.bills) && data.bills.length > 0) {
      console.log(`Processing ${data.bills.length} bills...`);

      const billTransaction = await sequelize.transaction();

      try {
        // Get customer mapping
        const customers = await Customer.findAll({
          where: { createdBy: vendorId },
          attributes: ["id", "mobileNumber"],
          raw: true,
        });

        const customerMap = new Map(
          customers.map((c) => [c.mobileNumber, c.id]),
        );

        // Get existing bills
        const existingBills = await Bill.findAll({
          where: { vendorId },
          attributes: ["billNumber"],
          raw: true,
        });

        const existingBillNumbers = new Set(
          existingBills.map((b) => b.billNumber),
        );

        for (const b of data.bills) {
          try {
            if (!b.billNumber || !b.customerMobile) {
              summary.bills.skipped++;
              continue;
            }

            if (existingBillNumbers.has(b.billNumber)) {
              summary.bills.skipped++;
              continue;
            }

            const customerId = customerMap.get(b.customerMobile);
            if (!customerId) {
              summary.bills.skipped++;
              summary.bills.errors.push({
                bill: b.billNumber,
                error: "Customer not found",
              });
              continue;
            }

            const billData = { ...b };
            delete billData.id;
            delete billData.createdAt;
            delete billData.updatedAt;
            delete billData.customerMobile;
            delete billData.customer;
            delete billData.vendorId;
            delete billData.customerId;

            const items = billData.items || [];
            delete billData.items;

            const newBill = await Bill.create(
              {
                ...billData,
                vendorId,
                customerId,
              },
              { transaction: billTransaction },
            );

            if (items.length > 0) {
              const itemsToInsert = items.map((item) => {
                const itemData = { ...item };
                delete itemData.id;
                delete itemData.createdAt;
                delete itemData.updatedAt;
                delete itemData.billId;
                return {
                  ...itemData,
                  billId: newBill.id,
                };
              });

              await BillItem.bulkCreate(itemsToInsert, {
                transaction: billTransaction,
              });
            }

            summary.bills.inserted++;

            if (summary.bills.inserted % 50 === 0) {
              console.log(`Bills: ${summary.bills.inserted} inserted`);
            }
          } catch (err) {
            summary.bills.errors.push({
              bill: b.billNumber,
              error: err.message,
            });
            summary.bills.skipped++;
          }
        }

        await billTransaction.commit();
        console.log(
          `Bills: ${summary.bills.inserted} inserted, ${summary.bills.skipped} skipped`,
        );
      } catch (err) {
        await billTransaction.rollback();
        console.error("Bill import failed:", err);
        throw err;
      }
    }

    // =====================
    // 7. PAYMENTS - Process in separate transaction
    // =====================
    if (Array.isArray(data.payments) && data.payments.length > 0) {
      console.log(`Processing ${data.payments.length} payments...`);

      const paymentTransaction = await sequelize.transaction();

      try {
        // Get customer mapping
        const customers = await Customer.findAll({
          where: { createdBy: vendorId },
          attributes: ["id", "mobileNumber"],
          raw: true,
        });

        const customerMap = new Map(
          customers.map((c) => [c.mobileNumber, c.id]),
        );

        // Get existing payments
        const existingPayments = await Payment.findAll({
          where: { vendorId },
          attributes: ["paymentNumber"],
          raw: true,
        });

        const existingPaymentNumbers = new Set(
          existingPayments.map((p) => p.paymentNumber),
        );

        const paymentsToInsert = [];

        for (const p of data.payments) {
          try {
            if (!p.paymentNumber || !p.type || !p.amount || !p.paymentDate) {
              summary.payments.skipped++;
              continue;
            }

            if (existingPaymentNumbers.has(p.paymentNumber)) {
              summary.payments.skipped++;
              continue;
            }

            let customerId = null;
            if (p.customerMobile) {
              customerId = customerMap.get(p.customerMobile);
              if (!customerId) {
                summary.payments.skipped++;
                summary.payments.errors.push({
                  payment: p.paymentNumber,
                  error: "Customer not found",
                });
                continue;
              }
            }

            const paymentData = { ...p };
            delete paymentData.id;
            delete paymentData.createdAt;
            delete paymentData.updatedAt;
            delete paymentData.customerMobile;
            delete paymentData.customer;
            delete paymentData.vendorId;
            delete paymentData.customerId;

            paymentsToInsert.push({
              ...paymentData,
              vendorId,
              customerId,
            });
          } catch (err) {
            summary.payments.errors.push({
              payment: p.paymentNumber,
              error: err.message,
            });
            summary.payments.skipped++;
          }
        }

        if (paymentsToInsert.length > 0) {
          // Insert in batches
          for (let i = 0; i < paymentsToInsert.length; i += BATCH_SIZE) {
            const batch = paymentsToInsert.slice(i, i + BATCH_SIZE);
            await Payment.bulkCreate(batch, {
              transaction: paymentTransaction,
            });
            summary.payments.inserted += batch.length;
            console.log(
              `Payments: ${summary.payments.inserted}/${paymentsToInsert.length} inserted`,
            );
          }
        }

        await paymentTransaction.commit();
        console.log(
          `Payments: ${summary.payments.inserted} inserted, ${summary.payments.skipped} skipped`,
        );
      } catch (err) {
        await paymentTransaction.rollback();
        console.error("Payment import failed:", err);
        throw err;
      }
    }

    console.log("Import completed successfully");
    console.log("Final Summary:", JSON.stringify(summary, null, 2));

    return summary;
  } catch (error) {
    // Rollback main transaction if still active
    if (!transaction.finished) {
      await transaction.rollback();
    }
    console.error("Import failed:", error);
    throw error;
  }
};
