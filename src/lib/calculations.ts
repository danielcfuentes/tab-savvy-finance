import { differenceInDays, isAfter, isToday, startOfToday } from "date-fns";

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

