import { differenceInDays, isAfter, isToday, startOfToday, getDate, endOfMonth, startOfMonth } from "date-fns";

export type BankAccount = {
  id: string;
  name: string;
  balance: number;
  account_type?: string;
};

export type IncomeItem = {
  id: string;
  name: string;
  amount_now: number;
  amount_next: number;
  due_date: string | null;
  due_date_next: string | null;
  bank_account_id: string;
};

export type CoasterItem = {
  id: string;
  name: string;
  amount: number;
  expense_date: string;
  bank_account_id: string | null;
  category: string;
};

/**
 * Get the next income due date from a list of income items
 * Returns the earliest FUTURE income date (excluding today and past dates)
 * Automatically filters out passed paychecks and looks for the next one
 * Checks both due_date and due_date_next fields
 */
export function getNextIncomeDue(incomes: IncomeItem[]): Date | null {
  const today = startOfToday();
  const allDates: Date[] = [];
  
  incomes.forEach(income => {
    // Check due_date (this month's paycheck)
    if (income.due_date) {
      const date = new Date(income.due_date);
      date.setHours(0, 0, 0, 0);
      // Only include future dates (after today) - exclude today and past dates
      if (isAfter(date, today)) {
        allDates.push(date);
      }
    }
    // Check due_date_next (next month's paycheck)
    if (income.due_date_next) {
      const date = new Date(income.due_date_next);
      date.setHours(0, 0, 0, 0);
      // Only include future dates (after today) - exclude today and past dates
      if (isAfter(date, today)) {
        allDates.push(date);
      }
    }
  });
  
  // If no future dates found, return null
  if (allDates.length === 0) return null;
  
  // Return the earliest future date (the next upcoming paycheck)
  return allDates.reduce((earliest, date) => {
    return date < earliest ? date : earliest;
  }, allDates[0]);
}

/**
 * Calculate coasting days between now and next income (excluding payday, including today)
 * Payday is considered part of the new pay cycle, so it's excluded
 * Today is included in the count
 * Example: If today is Nov 1 and payday is Nov 7, returns 6 (Nov 1-6, excluding Nov 7)
 */
export function getCoastingDays(
  nextIncome: Date | null,
  today: Date = startOfToday()
): number {
  if (!nextIncome) return 0;
  // differenceInDays gives the number of full days between two dates
  // differenceInDays(Nov 7, Nov 1) = 6 means Nov 7 is 6 full days after Nov 1
  // This represents days: Nov 1, 2, 3, 4, 5, 6 (6 days, excluding Nov 7)
  // So differenceInDays already excludes payday and includes today - perfect!
  return Math.max(0, differenceInDays(nextIncome, today));
}

/**
 * Calculate real bank balance: sum of bank balances minus credit balances minus ALL coaster expenses
 * Bank accounts (checking, savings, digital_wallet) are added
 * Credit accounts (credit_card, loan) are subtracted
 * Then all coaster expenses are subtracted
 * This represents actual spending power - all expenses (past, present, and future) are subtracted
 */
export function getRealBankBalance(
  bankAccounts: BankAccount[],
  coasterItems: CoasterItem[]
): number {
  // Separate bank accounts and credit accounts
  const bankAccountsList = bankAccounts.filter(acc => {
    const accountType = acc.account_type?.toLowerCase() || '';
    return ['checking', 'savings', 'digital_wallet'].includes(accountType);
  });
  
  const creditAccounts = bankAccounts.filter(acc => {
    const accountType = acc.account_type?.toLowerCase() || '';
    return ['credit_card', 'loan'].includes(accountType);
  });
  
  // Sum bank account balances (positive)
  const totalBankBalance = bankAccountsList.reduce((sum, account) => sum + Number(account.balance), 0);
  
  // Sum credit account balances (these are debts, so subtract them)
  const totalCreditBalance = creditAccounts.reduce((sum, account) => sum + Number(account.balance), 0);
  
  // Subtract ALL coasting expenses (not just through today)
  // This shows actual available cash after accounting for all scheduled expenses
  const totalExpenses = coasterItems.reduce((sum, item) => sum + Number(item.amount), 0);
  
  // Real balance = Bank accounts - Credit accounts - Expenses
  return totalBankBalance - totalCreditBalance - totalExpenses;
}

/**
 * Calculate total income for current month
 */
export function getTotalThisMonth(incomes: IncomeItem[]): number {
  const today = startOfToday();
  const thisMonth = today.getMonth();
  const thisYear = today.getFullYear();
  
  return incomes
    .filter(income => {
      const incomeDate = new Date(income.due_date);
      return incomeDate.getMonth() === thisMonth && 
             incomeDate.getFullYear() === thisYear;
    })
    .reduce((sum, income) => sum + Number(income.amount_now), 0);
}

/**
 * Calculate full month income - all income items for the current month
 * This includes both due_date and due_date_next if they fall in the current month
 */
export function getFullMonthIncome(incomes: IncomeItem[]): number {
  const today = startOfToday();
  const thisMonth = today.getMonth();
  const thisYear = today.getFullYear();
  
  return incomes.reduce((sum, income) => {
    let total = 0;
    
    // Check due_date (this month's income)
    if (income.due_date) {
      const incomeDate = new Date(income.due_date);
      if (incomeDate.getMonth() === thisMonth && incomeDate.getFullYear() === thisYear) {
        total += Number(income.amount_now);
      }
    }
    
    // Check due_date_next (next month's income that might be in current month)
    if (income.due_date_next) {
      const incomeDateNext = new Date(income.due_date_next);
      if (incomeDateNext.getMonth() === thisMonth && incomeDateNext.getFullYear() === thisYear) {
        total += Number(income.amount_next);
      }
    }
    
    return sum + total;
  }, 0);
}

/**
 * Calculate daily budget based on real balance and remaining coasting days
 */
export function getDailyBudget(
  realBalance: number,
  coastingDays: number
): number {
  if (coastingDays <= 0) return 0;
  return realBalance / coastingDays;
}

/**
 * Calculate spending pace favoring coasting expenses vs daily budget
 * Shows expenses scheduled within the coasting period (today through next payday)
 */
export function getSpendingPace(
  coasterItems: CoasterItem[],
  dailyBudget: number,
  coastingDays: number,
  nextIncome: Date | null
): {
  spentInCoastingPeriod: number;
  spentTotal: number;
  projectedSpend: number;
  isOnTrack: boolean;
} {
  const today = startOfToday();
  const endDate = nextIncome || new Date();
  endDate.setHours(23, 59, 59, 999); // Include the full payday
  
  // Expenses scheduled within the coasting period (today through next payday)
  const spentInCoastingPeriod = coasterItems
    .filter(item => {
      const itemDate = new Date(item.expense_date);
      itemDate.setHours(0, 0, 0, 0);
      return itemDate >= today && itemDate <= endDate;
    })
    .reduce((sum, item) => sum + Number(item.amount), 0);

  // Total expenses through today (for Real Bank Balance calculation consistency)
  const spentTotal = coasterItems
    .filter(item => {
      const itemDate = new Date(item.expense_date);
      return itemDate <= today;
    })
    .reduce((sum, item) => sum + Number(item.amount), 0);

  // Projected spend over the entire coasting period
  const projectedSpend = dailyBudget * coastingDays;
  const isOnTrack = spentInCoastingPeriod <= projectedSpend;

  return {
    spentInCoastingPeriod,
    spentTotal,
    projectedSpend,
    isOnTrack,
  };
}

export type Bill = {
  id: string;
  name: string;
  category: string;
  payment_date: string;
  payment_date_next: string | null;
  amount_now: number;
  amount_next: number;
  bank_account_id: string;
};

/**
 * Calculate closing tab balance per account
 * Closing Tab = Bank balance - Credit balance - Coaster expenses for that account
 */
export function getClosingTabPerAccount(
  bankAccounts: BankAccount[],
  coasterItems: CoasterItem[],
  accountId: string
): number {
  const account = bankAccounts.find(acc => acc.id === accountId);
  if (!account) return 0;

  const accountType = account.account_type?.toLowerCase() || '';
  const isBankAccount = ['checking', 'savings', 'digital_wallet'].includes(accountType);
  const isCreditAccount = ['credit_card', 'loan'].includes(accountType);

  let balance = 0;
  if (isBankAccount) {
    balance = Number(account.balance);
  } else if (isCreditAccount) {
    balance = -Number(account.balance); // Credit accounts are negative
  }

  // Subtract coaster expenses allocated to this account
  const accountExpenses = coasterItems
    .filter(item => item.bank_account_id === accountId)
    .reduce((sum, item) => sum + Number(item.amount), 0);

  return balance - accountExpenses;
}

/**
 * Calculate bills to close total per account
 * Bills to close are bills due before the next paycheck
 */
export function getBillsToClosePerAccount(
  bills: Bill[],
  nextPaycheckDate: Date | null,
  accountId: string
): number {
  if (!nextPaycheckDate) return 0;

  return bills
    .filter(bill => {
      const billDate = new Date(bill.payment_date);
      billDate.setHours(0, 0, 0, 0);
      return bill.bank_account_id === accountId && billDate < nextPaycheckDate;
    })
    .reduce((sum, bill) => sum + Number(bill.amount_now), 0);
}

/**
 * Calculate open bills total per account
 * Open bills are bills due on or after the next paycheck
 */
export function getOpenBillsPerAccount(
  bills: Bill[],
  nextPaycheckDate: Date | null,
  accountId: string
): number {
  if (!nextPaycheckDate) return 0;

  return bills
    .filter(bill => {
      const billDate = new Date(bill.payment_date);
      billDate.setHours(0, 0, 0, 0);
      return bill.bank_account_id === accountId && billDate >= nextPaycheckDate;
    })
    .reduce((sum, bill) => sum + Number(bill.amount_now), 0);
}

/**
 * Calculate next paycheck amount per account
 */
export function getNextPaycheckPerAccount(
  incomes: IncomeItem[],
  nextPaycheckDate: Date | null,
  accountId: string
): number {
  if (!nextPaycheckDate) return 0;

  return incomes
    .filter(income => income.bank_account_id === accountId)
    .filter(income => {
      const dueDate = income.due_date ? new Date(income.due_date) : null;
      const dueDateNext = income.due_date_next ? new Date(income.due_date_next) : null;
      const checkDate = dueDate && dueDate.getTime() === nextPaycheckDate.getTime() 
        ? dueDate 
        : dueDateNext && dueDateNext.getTime() === nextPaycheckDate.getTime() 
        ? dueDateNext 
        : null;
      return checkDate !== null;
    })
    .reduce((sum, income) => {
      const dueDate = income.due_date ? new Date(income.due_date) : null;
      const dueDateNext = income.due_date_next ? new Date(income.due_date_next) : null;
      if (dueDate && dueDate.getTime() === nextPaycheckDate.getTime()) {
        return sum + Number(income.amount_now);
      }
      if (dueDateNext && dueDateNext.getTime() === nextPaycheckDate.getTime()) {
        return sum + Number(income.amount_next);
      }
      return sum;
    }, 0);
}

/**
 * Calculate total next paycheck amount
 */
export function getNextPaycheckTotal(incomes: IncomeItem[], nextPaycheckDate: Date | null): number {
  if (!nextPaycheckDate) return 0;

  return incomes
    .filter(income => {
      const dueDate = income.due_date ? new Date(income.due_date) : null;
      const dueDateNext = income.due_date_next ? new Date(income.due_date_next) : null;
      const checkDate = dueDate && dueDate.getTime() === nextPaycheckDate.getTime() 
        ? dueDate 
        : dueDateNext && dueDateNext.getTime() === nextPaycheckDate.getTime() 
        ? dueDateNext 
        : null;
      return checkDate !== null;
    })
    .reduce((sum, income) => {
      const dueDate = income.due_date ? new Date(income.due_date) : null;
      const dueDateNext = income.due_date_next ? new Date(income.due_date_next) : null;
      if (dueDate && dueDate.getTime() === nextPaycheckDate.getTime()) {
        return sum + Number(income.amount_now);
      }
      if (dueDateNext && dueDateNext.getTime() === nextPaycheckDate.getTime()) {
        return sum + Number(income.amount_next);
      }
      return sum;
    }, 0);
}

/**
 * Calculate coasting estimate (daily budget * remaining days)
 * This is typically shown only for the first/main account
 */
export function getCoastingEstimate(
  realBalance: number,
  coastingDays: number
): number {
  if (coastingDays <= 0) return 0;
  const dailyBudget = getDailyBudget(realBalance, coastingDays);
  return dailyBudget * coastingDays;
}

/**
 * Calculate coasting estimate per account
 * For now, we'll only show it for the first account (main checking account)
 */
export function getCoastingEstimatePerAccount(
  accountId: string,
  accountIds: string[],
  realBalance: number,
  coastingDays: number
): number {
  // Only show coasting estimate for the first account (typically main checking)
  if (accountIds.length === 0 || accountId !== accountIds[0]) return 0;
  return getCoastingEstimate(realBalance, coastingDays);
}

/**
 * Calculate coasting estimate for Abek Balance section
 * Coasting Estimate = (Coasting Total) / Number of Coasting Days × No. of Days between last Coasting Day and the End of the Current Month
 * 
 * @param coastingTotal - Total amount of coasting expenses
 * @param coastingDays - Number of days in the coasting period (from today to next paycheck)
 * @param nextPaycheckDate - The last coasting day (next paycheck date)
 * @returns The estimated coasting expenses from next paycheck to end of current month
 */
export function getCoastingEstimateForAbekBalance(
  coastingTotal: number,
  coastingDays: number,
  nextPaycheckDate: Date | null
): number {
  if (!nextPaycheckDate || coastingDays <= 0 || coastingTotal <= 0) return 0;
  
  const today = startOfToday();
  const endOfCurrentMonth = endOfMonth(today);
  
  // Calculate days from next paycheck date to end of current month
  // If next paycheck is after end of month, return 0
  if (isAfter(nextPaycheckDate, endOfCurrentMonth)) return 0;
  
  // Calculate days between next paycheck and end of month (inclusive)
  const daysFromPaycheckToEndOfMonth = differenceInDays(endOfCurrentMonth, nextPaycheckDate) + 1;
  
  // Calculate average coasting per day
  const averageCoastingPerDay = coastingTotal / coastingDays;
  
  // Estimate = average per day × days remaining in month
  return averageCoastingPerDay * daysFromPaycheckToEndOfMonth;
}

/**
 * Calculate full month tab expenses by day ranges per account
 */
export function getFullMonthTabByRanges(
  coasterItems: CoasterItem[],
  bills: Bill[],
  accountIds: string[]
): {
  byAccount: Record<string, {
    range1_5: number;
    range6_10: number;
    range11_15: number;
    range16_20: number;
    range21_25: number;
    range25_31: number;
    total: number;
  }>;
  totals: {
    range1_5: number;
    range6_10: number;
    range11_15: number;
    range16_20: number;
    range21_25: number;
    range25_31: number;
    total: number;
  };
} {
  const today = startOfToday();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth();

  const byAccount: Record<string, {
    range1_5: number;
    range6_10: number;
    range11_15: number;
    range16_20: number;
    range21_25: number;
    range25_31: number;
    total: number;
  }> = {};

  // Initialize all accounts
  accountIds.forEach(accountId => {
    byAccount[accountId] = {
      range1_5: 0,
      range6_10: 0,
      range11_15: 0,
      range16_20: 0,
      range21_25: 0,
      range25_31: 0,
      total: 0,
    };
  });

  // Process coaster items
  coasterItems.forEach(item => {
    const itemDate = new Date(item.expense_date);
    if (itemDate.getFullYear() === currentYear && itemDate.getMonth() === currentMonth) {
      const day = getDate(itemDate);
      const amount = Number(item.amount);
      const accountId = item.bank_account_id || "unallocated";
      
      if (!byAccount[accountId]) {
        byAccount[accountId] = {
          range1_5: 0,
          range6_10: 0,
          range11_15: 0,
          range16_20: 0,
          range21_25: 0,
          range25_31: 0,
          total: 0,
        };
      }
      
      if (day >= 1 && day <= 5) byAccount[accountId].range1_5 += amount;
      else if (day >= 6 && day <= 10) byAccount[accountId].range6_10 += amount;
      else if (day >= 11 && day <= 15) byAccount[accountId].range11_15 += amount;
      else if (day >= 16 && day <= 20) byAccount[accountId].range16_20 += amount;
      else if (day >= 21 && day <= 25) byAccount[accountId].range21_25 += amount;
      else if (day >= 25 && day <= 31) byAccount[accountId].range25_31 += amount;
      
      byAccount[accountId].total += amount;
    }
  });

  // Process bills
  bills.forEach(bill => {
    const billDate = new Date(bill.payment_date);
    if (billDate.getFullYear() === currentYear && billDate.getMonth() === currentMonth) {
      const day = getDate(billDate);
      const amount = Number(bill.amount_now);
      const accountId = bill.bank_account_id;
      
      if (!byAccount[accountId]) {
        byAccount[accountId] = {
          range1_5: 0,
          range6_10: 0,
          range11_15: 0,
          range16_20: 0,
          range21_25: 0,
          range25_31: 0,
          total: 0,
        };
      }
      
      if (day >= 1 && day <= 5) byAccount[accountId].range1_5 += amount;
      else if (day >= 6 && day <= 10) byAccount[accountId].range6_10 += amount;
      else if (day >= 11 && day <= 15) byAccount[accountId].range11_15 += amount;
      else if (day >= 16 && day <= 20) byAccount[accountId].range16_20 += amount;
      else if (day >= 21 && day <= 25) byAccount[accountId].range21_25 += amount;
      else if (day >= 25 && day <= 31) byAccount[accountId].range25_31 += amount;
      
      byAccount[accountId].total += amount;
    }
  });

  // Calculate totals
  const totals = Object.values(byAccount).reduce((acc, account) => ({
    range1_5: acc.range1_5 + account.range1_5,
    range6_10: acc.range6_10 + account.range6_10,
    range11_15: acc.range11_15 + account.range11_15,
    range16_20: acc.range16_20 + account.range16_20,
    range21_25: acc.range21_25 + account.range21_25,
    range25_31: acc.range25_31 + account.range25_31,
    total: acc.total + account.total,
  }), {
    range1_5: 0,
    range6_10: 0,
    range11_15: 0,
    range16_20: 0,
    range21_25: 0,
    range25_31: 0,
    total: 0,
  });

  return { byAccount, totals };
}

/**
 * Calculate number of months covered
 * Number of Months Covered = Abek Tab / Full Month Total
 */
export function getMonthsCovered(abekTab: number, fullMonthTotal: number): number {
  if (fullMonthTotal <= 0) return 0;
  return abekTab / fullMonthTotal;
}

