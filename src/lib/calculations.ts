import { differenceInDays, isAfter, startOfToday } from "date-fns";

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
  due_date: string;
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
 * Returns the earliest future income date, or null if none found
 */
export function getNextIncomeDue(incomes: IncomeItem[]): Date | null {
  const today = startOfToday();
  const futureIncomes = incomes.filter(income => 
    isAfter(new Date(income.due_date), today)
  );
  
  if (futureIncomes.length === 0) return null;
  
  return new Date(
    futureIncomes.reduce((earliest, income) => {
      const incomeDate = new Date(income.due_date);
      return incomeDate < earliest ? incomeDate : earliest;
    }, new Date(futureIncomes[0].due_date))
  );
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
 * Calculate real bank balance: sum of bank balances minus sum of coaster expenses through today
 */
export function getRealBankBalance(
  bankAccounts: BankAccount[],
  coasterItems: CoasterItem[]
): number {
  const totalBalance = bankAccounts.reduce((sum, account) => sum + Number(account.balance), 0);
  
  const today = startOfToday();
  const totalExpenses = coasterItems
    .filter(item => {
      const itemDate = new Date(item.expense_date);
      return itemDate <= today;
    })
    .reduce((sum, item) => sum + Number(item.amount), 0);
  
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
 * Calculate spending pace vs daily budget
 */
export function getSpendingPace(
  coasterItems: CoasterItem[],
  dailyBudget: number,
  coastingDays: number
): {
  spentToday: number;
  spentTotal: number;
  projectedSpend: number;
  isOnTrack: boolean;
} {
  const today = startOfToday();
  const spentToday = coasterItems
    .filter(item => {
      const itemDate = new Date(item.expense_date);
      return itemDate.toDateString() === today.toDateString();
    })
    .reduce((sum, item) => sum + Number(item.amount), 0);

  const spentTotal = coasterItems
    .filter(item => {
      const itemDate = new Date(item.expense_date);
      return itemDate <= today;
    })
    .reduce((sum, item) => sum + Number(item.amount), 0);

  const projectedSpend = dailyBudget * coastingDays;
  const isOnTrack = spentTotal <= projectedSpend;

  return {
    spentToday,
    spentTotal,
    projectedSpend,
    isOnTrack,
  };
}

