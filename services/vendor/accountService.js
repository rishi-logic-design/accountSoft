const { AccountModel, AccountTransactionModel } = require("../../models");
const { Op } = require("sequelize");

function toNum(v) {
  return parseFloat(v || 0);
}

exports.getAccountList = async (vendorId, { accountType, search } = {}) => {
  const where = { vendorId };
  if (accountType) {
    if (accountType === "CASH_BANK") {
      where.accountType = { [Op.in]: ["CASH", "BANK"] };
    } else {
      where.accountType = accountType;
    }
  }

  if (search) {
    where.accountName = { [Op.like]: `%${search}%` };
  }

  const accounts = await AccountModel.findAll({
    where,
    order: [["accountName", "ASC"]],
  });

  const results = await Promise.all(
    accounts.map(async (account) => {
      // Calculate current balance
      // Balance = Opening Balance + (Deposits + Transfers IN) - (Withdrawals + Transfers OUT)
      const [totalIn, totalOut] = await Promise.all([
        AccountTransactionModel.sum("amount", {
          where: {
            vendorId,
            [Op.or]: [
              {
                accountId: account.id,
                transactionType: {
                  [Op.in]: ["DEPOSIT", "PAYMENT_IN", "ADJUSTMENT"],
                },
              },
              { toAccountId: account.id, transactionType: "TRANSFER" },
            ],
          },
        }).then(toNum),
        AccountTransactionModel.sum("amount", {
          where: {
            vendorId,
            [Op.or]: [
              {
                accountId: account.id,
                transactionType: { [Op.in]: ["WITHDRAWAL", "PAYMENT_OUT"] },
              },
              { accountId: account.id, transactionType: "TRANSFER" },
            ],
          },
        }).then(toNum),
      ]);

      const balance = +(
        toNum(account.openingBalance) +
        totalIn -
        totalOut
      ).toFixed(2);

      return {
        ...account.toJSON(),
        balance,
      };
    }),
  );

  return results;
};

exports.createAccount = async (vendorId, data) => {
  return await AccountModel.create({
    ...data,
    vendorId,
  });
};

exports.updateAccount = async (vendorId, accountId, data) => {
  const account = await AccountModel.findOne({
    where: { id: accountId, vendorId },
  });
  if (!account) throw new Error("Account not found");
  return await account.update(data);
};

exports.deleteAccount = async (vendorId, accountId) => {
  const account = await AccountModel.findOne({
    where: { id: accountId, vendorId },
  });
  if (!account) throw new Error("Account not found");

  // Check if there are transactions
  const txCount = await AccountTransactionModel.count({
    where: {
      [Op.or]: [{ accountId }, { toAccountId: accountId }],
    },
  });
  if (txCount > 0)
    throw new Error("Cannot delete account with existing transactions");

  return await account.destroy();
};

exports.adjustBalance = async (
  vendorId,
  { accountId, amount, type, date, remark, voucherNumber },
) => {
  const account = await AccountModel.findOne({
    where: { id: accountId, vendorId },
  });
  if (!account) throw new Error("Account not found");

  const transactionType = type === "ADD" ? "DEPOSIT" : "WITHDRAWAL";

  return await AccountTransactionModel.create({
    vendorId,
    accountId,
    amount,
    transactionType,
    transactionDate: date || new Date(),
    remark,
    voucherNumber,
  });
};

exports.createContraEntry = async (
  vendorId,
  { fromAccountId, toAccountId, amount, date, remark, voucherNumber },
) => {
  const [fromAccount, toAccount] = await Promise.all([
    AccountModel.findOne({ where: { id: fromAccountId, vendorId } }),
    AccountModel.findOne({ where: { id: toAccountId, vendorId } }),
  ]);

  if (!fromAccount || !toAccount)
    throw new Error("One or both accounts not found");

  return await AccountTransactionModel.create({
    vendorId,
    accountId: fromAccountId,
    toAccountId: toAccountId,
    amount,
    transactionType: "TRANSFER",
    transactionDate: date || new Date(),
    remark,
    voucherNumber,
  });
};

exports.getAccountLedger = async (
  vendorId,
  accountId,
  { fromDate, toDate, search } = {},
) => {
  const account = await AccountModel.findOne({
    where: { id: accountId, vendorId },
  });
  if (!account) throw new Error("Account not found");

  const where = {
    vendorId,
    [Op.or]: [{ accountId }, { toAccountId: accountId }],
  };

  if (fromDate) where.transactionDate = { [Op.gte]: fromDate };
  if (toDate) {
    where.transactionDate = {
      ...where.transactionDate,
      [Op.lte]: toDate,
    };
  }

  // Opening balance calculation
  let openingBalance = toNum(account.openingBalance);
  if (fromDate) {
    const [prevIn, prevOut] = await Promise.all([
      AccountTransactionModel.sum("amount", {
        where: {
          vendorId,
          transactionDate: { [Op.lt]: fromDate },
          [Op.or]: [
            {
              accountId: account.id,
              transactionType: {
                [Op.in]: ["DEPOSIT", "PAYMENT_IN", "ADJUSTMENT"],
              },
            },
            { toAccountId: account.id, transactionType: "TRANSFER" },
          ],
        },
      }).then(toNum),
      AccountTransactionModel.sum("amount", {
        where: {
          vendorId,
          transactionDate: { [Op.lt]: fromDate },
          [Op.or]: [
            {
              accountId: account.id,
              transactionType: { [Op.in]: ["WITHDRAWAL", "PAYMENT_OUT"] },
            },
            { accountId: account.id, transactionType: "TRANSFER" },
          ],
        },
      }).then(toNum),
    ]);
    openingBalance = +(openingBalance + prevIn - prevOut).toFixed(2);
  }

  const transactions = await AccountTransactionModel.findAll({
    where,
    order: [
      ["transactionDate", "ASC"],
      ["createdAt", "ASC"],
    ],
    include: [
      { model: AccountModel, as: "account", attributes: ["accountName"] },
      { model: AccountModel, as: "toAccount", attributes: ["accountName"] },
    ],
  });

  let runningBalance = openingBalance;
  const entries = transactions.map((tx) => {
    let debit = 0;
    let credit = 0;
    let particulars = tx.remark || tx.transactionType;

    if (tx.transactionType === "TRANSFER") {
      if (tx.accountId === accountId) {
        // Money going OUT of this account
        credit = toNum(tx.amount);
        particulars = `Transfer to ${tx.toAccount?.accountName || "Unknown"}`;
      } else {
        // Money coming IN to this account
        debit = toNum(tx.amount);
        particulars = `Transfer from ${tx.account?.accountName || "Unknown"}`;
      }
    } else if (
      ["DEPOSIT", "PAYMENT_IN", "ADJUSTMENT"].includes(tx.transactionType)
    ) {
      debit = toNum(tx.amount);
    } else {
      credit = toNum(tx.amount);
    }

    runningBalance = +(runningBalance + debit - credit).toFixed(2);

    return {
      id: tx.id,
      date: tx.transactionDate,
      voucherNumber: tx.voucherNumber,
      particulars,
      type: tx.transactionType,
      debit,
      credit,
      balance: runningBalance,
    };
  });

  return {
    account,
    openingBalance,
    entries,
    closingBalance: runningBalance,
  };
};
