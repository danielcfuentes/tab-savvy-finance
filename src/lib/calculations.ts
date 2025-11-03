import { differenceInDays, isAfter, isToday, startOfToday } from "date-fns";

export type BankAccount = {
  id: string;
  name: string;
  balance: number;
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
 * Calculate coasting days between now and next income
 */
export function getCoastingDays(
  nextIncome: Date | null,
  today: Date = startOfToday()
): number {
  if (!nextIncome) return 0;
  return Math.max(0, differenceInDays(nextIncome, today));
}

/**
 * Calculate real bank balance: sum of bank balances minus ALL coaster expenses
 * This represents actual spending power - all expenses (past, present, and future) are subtracted
 */
export function getRealBankBalance(
  bankAccounts: BankAccount[],
  coasterItems: CoasterItem[]
): number {
  const totalBalance = bankAccounts.reduce((sum, account) => sum + Number(account.balance), 0);
  
  // Subtract ALL coasting expenses (not just through today)
  // This shows actual available cash after accounting for all scheduled expenses
  const totalExpenses = coasterItems.reduce((sum, item) => sum + Number(item.amount), 0);
  
  return totalBalance - totalExpenses;
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

