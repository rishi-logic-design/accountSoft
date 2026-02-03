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
  const transaction = await sequelize.transaction();

  try {
    // =====================
    // 1. FIRM (single)
    // =====================
    if (data.firm) {
      try {
        const firmData = { ...data.firm };
        delete firmData.id;
        delete firmData.createdAt;
        delete firmData.updatedAt;

        await Firm.upsert(
          {
            ...firmData,
            vendorId,
          },
          { transaction },
        );
        summary.firm.updated = true;
      } catch (err) {
        summary.firm.error = err.message;
      }
    }

    // =====================
    // 2. GST SLABS
    // =====================
    if (Array.isArray(data.gstSlabs)) {
      for (const slab of data.gstSlabs) {
        try {
          if (!slab.slabName || slab.rate == null) {
            summary.gstSlabs.skipped++;
            continue;
          }

          const slabData = { ...slab };
          delete slabData.id;
          delete slabData.createdAt;
          delete slabData.updatedAt;

          // Check if slab already exists
          const exists = await GstSlab.findOne({
            where: { slabName: slab.slabName, vendorId },
            transaction,
          });

          if (exists) {
            summary.gstSlabs.skipped++;
            continue;
          }

          await GstSlab.create(
            {
              ...slabData,
              vendorId,
            },
            { transaction },
          );

          summary.gstSlabs.inserted++;
        } catch (err) {
          summary.gstSlabs.errors.push({
            slab: slab.slabName,
            error: err.message,
          });
          summary.gstSlabs.skipped++;
        }
      }
    }

    // =====================
    // 3. PRODUCTS
    // =====================
    if (Array.isArray(data.products)) {
      for (const p of data.products) {
        try {
          if (!p.name || p.price == null) {
            summary.products.skipped++;
            continue;
          }

          const productData = { ...p };
          delete productData.id;
          delete productData.createdAt;
          delete productData.updatedAt;

          // Check if product already exists
          const exists = await Product.findOne({
            where: { name: p.name, createdBy: vendorId },
            transaction,
          });

          if (exists) {
            summary.products.skipped++;
            continue;
          }

          await Product.create(
            {
              ...productData,
              createdBy: vendorId,
            },
            { transaction },
          );

          summary.products.inserted++;
        } catch (err) {
          summary.products.errors.push({
            product: p.name,
            error: err.message,
          });
          summary.products.skipped++;
        }
      }
    }

    // =====================
    // 4. CUSTOMERS
    // =====================
    if (Array.isArray(data.customers)) {
      for (const c of data.customers) {
        try {
          if (!c.customerName || !c.mobileNumber) {
            summary.customers.skipped++;
            continue;
          }

          const customerData = { ...c };
          delete customerData.id;
          delete customerData.createdAt;
          delete customerData.updatedAt;

          const exists = await Customer.findOne({
            where: { mobileNumber: c.mobileNumber, createdBy: vendorId },
            transaction,
          });

          if (exists) {
            summary.customers.skipped++;
            continue;
          }

          await Customer.create(
            {
              ...customerData,
              createdBy: vendorId,
            },
            { transaction },
          );

          summary.customers.inserted++;
        } catch (err) {
          summary.customers.errors.push({
            customer: c.customerName,
            mobile: c.mobileNumber,
            error: err.message,
          });
          summary.customers.skipped++;
        }
      }
    }

    // =====================
    // 5. CHALLANS with ITEMS
    // =====================
    if (Array.isArray(data.challans)) {
      for (const ch of data.challans) {
        try {
          if (!ch.challanNumber || !ch.customerMobile) {
            summary.challans.skipped++;
            continue;
          }

          const customer = await Customer.findOne({
            where: { mobileNumber: ch.customerMobile, createdBy: vendorId },
            transaction,
          });

          if (!customer) {
            summary.challans.skipped++;
            summary.challans.errors.push({
              challan: ch.challanNumber,
              error: "Customer not found",
            });
            continue;
          }

          // Check if challan already exists
          const exists = await Challan.findOne({
            where: { challanNumber: ch.challanNumber, vendorId },
            transaction,
          });

          if (exists) {
            summary.challans.skipped++;
            continue;
          }

          const challanData = { ...ch };
          delete challanData.id;
          delete challanData.createdAt;
          delete challanData.updatedAt;
          delete challanData.customerMobile;
          delete challanData.customer;

          // Extract items before creating challan
          const items = challanData.items || [];
          delete challanData.items;

          const newChallan = await Challan.create(
            {
              ...challanData,
              vendorId,
              customerId: customer.id,
            },
            { transaction },
          );

          // Create challan items if present
          if (items.length > 0) {
            for (const item of items) {
              const itemData = { ...item };
              delete itemData.id;
              delete itemData.createdAt;
              delete itemData.updatedAt;

              await ChallanItem.create(
                {
                  ...itemData,
                  challanId: newChallan.id,
                },
                { transaction },
              );
            }
          }

          summary.challans.inserted++;
        } catch (err) {
          summary.challans.errors.push({
            challan: ch.challanNumber,
            error: err.message,
          });
          summary.challans.skipped++;
        }
      }
    }

    // =====================
    // 6. BILLS with ITEMS
    // =====================
    if (Array.isArray(data.bills)) {
      for (const b of data.bills) {
        try {
          if (!b.billNumber || !b.customerMobile) {
            summary.bills.skipped++;
            continue;
          }

          const customer = await Customer.findOne({
            where: { mobileNumber: b.customerMobile, createdBy: vendorId },
            transaction,
          });

          if (!customer) {
            summary.bills.skipped++;
            summary.bills.errors.push({
              bill: b.billNumber,
              error: "Customer not found",
            });
            continue;
          }

          // Check if bill already exists
          const exists = await Bill.findOne({
            where: { billNumber: b.billNumber, vendorId },
            transaction,
          });

          if (exists) {
            summary.bills.skipped++;
            continue;
          }

          const billData = { ...b };
          delete billData.id;
          delete billData.createdAt;
          delete billData.updatedAt;
          delete billData.customerMobile;
          delete billData.customer;

          // Extract items before creating bill
          const items = billData.items || [];
          delete billData.items;

          const newBill = await Bill.create(
            {
              ...billData,
              vendorId,
              customerId: customer.id,
            },
            { transaction },
          );

          // Create bill items if present
          if (items.length > 0) {
            for (const item of items) {
              const itemData = { ...item };
              delete itemData.id;
              delete itemData.createdAt;
              delete itemData.updatedAt;

              await BillItem.create(
                {
                  ...itemData,
                  billId: newBill.id,
                },
                { transaction },
              );
            }
          }

          summary.bills.inserted++;
        } catch (err) {
          summary.bills.errors.push({
            bill: b.billNumber,
            error: err.message,
          });
          summary.bills.skipped++;
        }
      }
    }

    // =====================
    // 7. PAYMENTS
    // =====================
    if (Array.isArray(data.payments)) {
      for (const p of data.payments) {
        try {
          if (!p.paymentNumber || !p.type || !p.amount || !p.paymentDate) {
            summary.payments.skipped++;
            continue;
          }

          let customerId = null;

          if (p.customerMobile) {
            const customer = await Customer.findOne({
              where: { mobileNumber: p.customerMobile, createdBy: vendorId },
              transaction,
            });
            if (!customer) {
              summary.payments.skipped++;
              summary.payments.errors.push({
                payment: p.paymentNumber,
                error: "Customer not found",
              });
              continue;
            }
            customerId = customer.id;
          }

          // Check if payment already exists
          const exists = await Payment.findOne({
            where: { paymentNumber: p.paymentNumber, vendorId },
            transaction,
          });

          if (exists) {
            summary.payments.skipped++;
            continue;
          }

          const paymentData = { ...p };
          delete paymentData.id;
          delete paymentData.createdAt;
          delete paymentData.updatedAt;
          delete paymentData.customerMobile;
          delete paymentData.customer;

          await Payment.create(
            {
              ...paymentData,
              vendorId,
              customerId,
            },
            { transaction },
          );

          summary.payments.inserted++;
        } catch (err) {
          summary.payments.errors.push({
            payment: p.paymentNumber,
            error: err.message,
          });
          summary.payments.skipped++;
        }
      }
    }

    // Commit transaction if everything succeeded
    await transaction.commit();

    console.log("Import completed successfully");
    console.log("Summary:", JSON.stringify(summary, null, 2));

    return summary;
  } catch (error) {
    // Rollback transaction on error
    await transaction.rollback();
    console.error("Import failed, transaction rolled back:", error);
    throw error;
  }
};
