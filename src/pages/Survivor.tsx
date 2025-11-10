import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ChevronDown, ChevronRight, Calculator, PieChart, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  getNextIncomeDue,
  getCoastingDays,
  getRealBankBalance,
  getDailyBudget,
  getClosingTabPerAccount,
  getBillsToClosePerAccount,
  getOpenBillsPerAccount,
  getNextPaycheckTotal,
  getNextPaycheckPerAccount,
  getCoastingEstimate,
  getCoastingEstimatePerAccount,
  getFullMonthTabByRanges,
  getMonthsCovered,
  type BankAccount,
  type IncomeItem,
  type CoasterItem,
  type Bill,
} from "@/lib/calculations";
import { format } from "date-fns";
import { CheckCircle2, Clock, Wallet, CreditCard } from "lucide-react";

// Reusable Info Tooltip Component (clickable for mobile and desktop)
const InfoTooltip = ({ content, children }: { content: string; children?: React.ReactNode }) => {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center justify-center rounded-full focus:outline-none focus:ring-2 focus:ring-secondary focus:ring-offset-2 touch-manipulation"
          onClick={(e) => {
            // Prevent any parent click handlers
            e.stopPropagation();
          }}
          aria-label="More information"
        >
          {children || (
            <Info className="w-3.5 h-3.5 md:w-4 md:h-4 text-muted-foreground hover:text-foreground active:text-foreground transition-colors" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        className="max-w-xs text-xs md:text-sm z-50 p-3"
        onClick={(e) => e.stopPropagation()}
        sideOffset={8}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <p className="leading-relaxed">{content}</p>
      </PopoverContent>
    </Popover>
  );
};

const Survivor = () => {
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [incomes, setIncomes] = useState<IncomeItem[]>([]);
  const [coasterItems, setCoasterItems] = useState<CoasterItem[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [closeOutExpanded, setCloseOutExpanded] = useState(false);
  const [budgetExpanded, setBudgetExpanded] = useState(false);
  const [expandedCloseOutAccounts, setExpandedCloseOutAccounts] = useState<Set<string>>(new Set());
  const [expandedBillsToClose, setExpandedBillsToClose] = useState<Set<string>>(new Set());
  const [expandedOpenBills, setExpandedOpenBills] = useState<Set<string>>(new Set());
  const [expandedCoastingExpenses, setExpandedCoastingExpenses] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [accountsRes, incomesRes, coasterRes, billsRes] = await Promise.all([
        supabase.from("bank_accounts").select("*").order("created_at", { ascending: true }),
        supabase.from("income").select("*").order("due_date", { ascending: true }),
        supabase.from("coaster_items").select("*").order("expense_date", { ascending: false }),
        supabase.from("bills").select("*").order("payment_date", { ascending: true }),
      ]);

      if (accountsRes.error) throw accountsRes.error;
      if (incomesRes.error) throw incomesRes.error;
      if (coasterRes.error) throw coasterRes.error;
      if (billsRes.error) throw billsRes.error;

      setBankAccounts((accountsRes.data || []) as BankAccount[]);
      
      const mappedIncomes = (incomesRes.data || []).map((income: any) => ({
        id: income.id,
        name: income.name,
        amount_now: income.amount_now,
        amount_next: income.amount_next,
        due_date: income.due_date,
        due_date_next: income.due_date_next,
        bank_account_id: income.bank_account_id,
      }));
      setIncomes(mappedIncomes);
      
      setCoasterItems((coasterRes.data || []) as CoasterItem[]);
      setBills((billsRes.data || []) as Bill[]);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error?.message || "Failed to fetch data",
      });
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const formatCurrencyWithSign = (amount: number) => {
    const formatted = formatCurrency(Math.abs(amount));
    return amount < 0 ? `(${formatted})` : formatted;
  };

  // Get all unique account IDs (from bank accounts and bills) - must be calculated first
  const allAccountIds = new Set<string>();
  bankAccounts.forEach(acc => allAccountIds.add(acc.id));
  bills.forEach(bill => allAccountIds.add(bill.bank_account_id));
  const accountIds = Array.from(allAccountIds);

  // Calculations
  const nextPaycheckDate = getNextIncomeDue(incomes);
  const coastingDays = getCoastingDays(nextPaycheckDate);
  const realBalance = getRealBankBalance(bankAccounts, coasterItems);
  const dailyBudget = getDailyBudget(realBalance, coastingDays);
  const nextPaycheckTotal = getNextPaycheckTotal(incomes, nextPaycheckDate);
  const coastingEstimate = getCoastingEstimate(realBalance, coastingDays);
  const fullMonthRanges = getFullMonthTabByRanges(coasterItems, bills, accountIds);

  // Calculate per-account values for End of Month (Abek Tab)
  const accountData = accountIds.map(accountId => {
    const account = bankAccounts.find(acc => acc.id === accountId);
    const closingTab = getClosingTabPerAccount(bankAccounts, coasterItems, accountId);
    const openBills = getOpenBillsPerAccount(bills, nextPaycheckDate, accountId);
    const nextPaycheck = getNextPaycheckPerAccount(incomes, nextPaycheckDate, accountId);
    const coastingEst = getCoastingEstimatePerAccount(accountId, accountIds, realBalance, coastingDays);
    
    return {
      id: accountId,
      name: account?.name || "Unknown Account",
      closingTab,
      openBills,
      nextPaycheck,
      coastingEst,
    };
  });

  // Separate accounts by type for Close Out
  const bankAccountsCloseOut = bankAccounts.filter(acc => 
    ['checking', 'savings', 'digital_wallet'].includes(acc.account_type?.toLowerCase() || '')
  );
  const creditAccountsCloseOut = bankAccounts.filter(acc => 
    ['credit_card', 'loan'].includes(acc.account_type?.toLowerCase() || '')
  );

  // Calculate per-account values for Close Out
  const closeOutAccountData = accountIds.map(accountId => {
    const account = bankAccounts.find(acc => acc.id === accountId);
    if (!account) {
      return {
        id: accountId,
        name: "Unknown Account",
        accountType: "",
        bankBalance: 0,
        coastingExpenses: 0,
        realBalance: 0,
        billsToClose: 0,
        closedTab: 0,
        openBills: 0,
        isBankAccount: false,
        isCreditAccount: false,
      };
    }
    
    const accountType = account.account_type?.toLowerCase() || '';
    const isBankAccount = ['checking', 'savings', 'digital_wallet'].includes(accountType);
    const isCreditAccount = ['credit_card', 'loan'].includes(accountType);
    
    // Calculate bank balance
    const bankBalance = Number(account.balance);
    
    // Calculate coasting expenses for this account
    const accountCoastingExpenses = coasterItems
      .filter(item => item.bank_account_id === accountId)
      .reduce((sum, item) => sum + Number(item.amount), 0);
    
    // Calculate real balance
    const accountRealBalance = isBankAccount 
      ? bankBalance - accountCoastingExpenses
      : bankBalance + accountCoastingExpenses;
    
    const billsToClose = getBillsToClosePerAccount(bills, nextPaycheckDate, accountId);
    const closedTab = accountRealBalance - billsToClose;
    const openBills = getOpenBillsPerAccount(bills, nextPaycheckDate, accountId);
    
    return {
      id: accountId,
      name: account.name,
      accountType,
      isBankAccount,
      isCreditAccount,
      bankBalance,
      coastingExpenses: accountCoastingExpenses,
      realBalance: accountRealBalance,
      billsToClose,
      closedTab,
      openBills,
    };
  });

  // Separate close out data by account type
  const bankAccountsCloseOutData = closeOutAccountData.filter(acc => acc.isBankAccount);
  const creditAccountsCloseOutData = closeOutAccountData.filter(acc => acc.isCreditAccount);

  // Calculate totals for End of Month (Abek Tab)
  const totalClosingTab = accountData.reduce((sum, acc) => sum + acc.closingTab, 0);
  const totalOpenBills = accountData.reduce((sum, acc) => sum + acc.openBills, 0);
  const totalNextPaycheck = accountData.reduce((sum, acc) => sum + acc.nextPaycheck, 0);
  const totalCoastingEst = accountData.reduce((sum, acc) => sum + acc.coastingEst, 0);
  // Abek Tab = Closing Tab - Open Bills + Next Paycheck - Coasting Estimate
  const survivorTab = totalClosingTab - totalOpenBills + totalNextPaycheck - totalCoastingEst;
  const monthsCovered = getMonthsCovered(survivorTab, fullMonthRanges.totals.total);

  // Calculate unallocated expenses (for bank accounts)
  const unallocatedExpenses = coasterItems
    .filter(item => !item.bank_account_id)
    .reduce((sum, item) => sum + Number(item.amount), 0);

  // Calculate totals for Close Out - Bank Accounts (My Tab)
  const totalBankBalance = bankAccountsCloseOutData.reduce((sum, acc) => sum + acc.bankBalance, 0);
  const totalBankCoastingExpenses = bankAccountsCloseOutData.reduce((sum, acc) => sum + acc.coastingExpenses, 0) + unallocatedExpenses;
  const totalRealBankBalance = totalBankBalance - totalBankCoastingExpenses;
  const totalBankBillsToClose = bankAccountsCloseOutData.reduce((sum, acc) => sum + acc.billsToClose, 0);
  const totalBankClosedTab = bankAccountsCloseOutData.reduce((sum, acc) => sum + acc.closedTab, 0);
  const totalBankOpenBills = bankAccountsCloseOutData.reduce((sum, acc) => sum + acc.openBills, 0);

  // Calculate totals for Close Out - Credit Accounts (My Credit Tab)
  const totalCreditBalance = creditAccountsCloseOutData.reduce((sum, acc) => sum + acc.bankBalance, 0);
  const totalCreditCoastingExpenses = creditAccountsCloseOutData.reduce((sum, acc) => sum + acc.coastingExpenses, 0);
  const totalRealCreditBalance = totalCreditBalance + totalCreditCoastingExpenses;
  const totalCreditBillsToClose = creditAccountsCloseOutData.reduce((sum, acc) => sum + acc.billsToClose, 0);
  const totalCreditClosedTab = creditAccountsCloseOutData.reduce((sum, acc) => sum + acc.closedTab, 0);
  const totalCreditOpenBills = creditAccountsCloseOutData.reduce((sum, acc) => sum + acc.openBills, 0);

  // Budget calculations - group bills by category
  const budgetByCategory = bills.reduce((acc, bill) => {
    const category = bill.category || "Uncategorized";
    if (!acc[category]) {
      acc[category] = {
        category,
        total: 0,
        bills: [],
      };
    }
    acc[category].total += Number(bill.amount_now);
    acc[category].bills.push(bill);
    return acc;
  }, {} as Record<string, { category: string; total: number; bills: Bill[] }>);

  const totalIncome = nextPaycheckTotal || incomes.reduce((sum, inc) => sum + Number(inc.amount_now), 0);
  const totalBudget = Object.values(budgetByCategory).reduce((sum, cat) => sum + cat.total, 0);
  const coasterTab = totalIncome - totalBudget;

  // Helper functions for Close Out bills and expenses
  const getBillsToCloseForAccount = (accountId: string) => {
    if (!nextPaycheckDate) return [];
    return bills.filter(bill => {
      const billDate = new Date(bill.payment_date);
      billDate.setHours(0, 0, 0, 0);
      return bill.bank_account_id === accountId && billDate < nextPaycheckDate;
    });
  };

  const getOpenBillsForAccount = (accountId: string) => {
    if (!nextPaycheckDate) return [];
    return bills.filter(bill => {
      const billDate = new Date(bill.payment_date);
      billDate.setHours(0, 0, 0, 0);
      return bill.bank_account_id === accountId && billDate >= nextPaycheckDate;
    });
  };

  const getCoastingExpensesForAccount = (accountId: string) => {
    return coasterItems.filter(item => item.bank_account_id === accountId);
  };

  const toggleCloseOutAccountExpanded = (accountId: string) => {
    const newExpanded = new Set(expandedCloseOutAccounts);
    if (newExpanded.has(accountId)) {
      newExpanded.delete(accountId);
    } else {
      newExpanded.add(accountId);
    }
    setExpandedCloseOutAccounts(newExpanded);
  };

  const toggleBillsToCloseExpanded = (accountId: string) => {
    const newExpanded = new Set(expandedBillsToClose);
    if (newExpanded.has(accountId)) {
      newExpanded.delete(accountId);
    } else {
      newExpanded.add(accountId);
    }
    setExpandedBillsToClose(newExpanded);
  };

  const toggleOpenBillsExpanded = (accountId: string) => {
    const newExpanded = new Set(expandedOpenBills);
    if (newExpanded.has(accountId)) {
      newExpanded.delete(accountId);
    } else {
      newExpanded.add(accountId);
    }
    setExpandedOpenBills(newExpanded);
  };

  const toggleCoastingExpensesExpanded = (accountId: string) => {
    const newExpanded = new Set(expandedCoastingExpenses);
    if (newExpanded.has(accountId)) {
      newExpanded.delete(accountId);
    } else {
      newExpanded.add(accountId);
    }
    setExpandedCoastingExpenses(newExpanded);
  };

  // Render Close Out account card
  const renderCloseOutAccountCard = (accountData: typeof closeOutAccountData[0]) => {
    const isExpanded = expandedCloseOutAccounts.has(accountData.id);
    const billsToClose = getBillsToCloseForAccount(accountData.id);
    const openBills = getOpenBillsForAccount(accountData.id);
    const coastingExpenses = getCoastingExpensesForAccount(accountData.id);
    const billsToCloseExpanded = expandedBillsToClose.has(accountData.id);
    const openBillsExpanded = expandedOpenBills.has(accountData.id);
    const coastingExpensesExpanded = expandedCoastingExpenses.has(accountData.id);

    const headerColor = accountData.isBankAccount 
      ? "bg-gradient-to-br from-green-400 to-green-500 dark:from-green-500 dark:to-green-600"
      : "bg-gradient-to-br from-pink-300 to-pink-400 dark:from-pink-400 dark:to-pink-500";
    const ringColor = accountData.isBankAccount 
      ? "ring-green-200 dark:ring-green-800"
      : "ring-pink-200 dark:ring-pink-800";

    return (
      <Card 
        key={accountData.id} 
        className={cn(
          "border-2 shadow-lg hover:shadow-xl transition-all duration-200",
          isExpanded && `ring-2 ${ringColor}`
        )}
      >
        <CardHeader 
          className={cn(
            headerColor,
            "pb-3 px-4 pt-4 cursor-pointer transition-all duration-200 group"
          )}
          onClick={() => toggleCloseOutAccountExpanded(accountData.id)}
        >
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-white text-base font-bold truncate flex-1">
              {accountData.name}
            </CardTitle>
            <div className="flex-shrink-0 transition-transform duration-200 group-hover:scale-110">
              {isExpanded ? (
                <ChevronDown className="w-4 h-4 text-white" />
              ) : (
                <ChevronRight className="w-4 h-4 text-white" />
              )}
            </div>
          </div>
        </CardHeader>
        {isExpanded && (
          <CardContent className="p-0 animate-in slide-in-from-top-2 duration-200">
            <div className="divide-y divide-border">
              {/* Bank Balance */}
              <div className="p-4 bg-gradient-to-br from-muted/40 to-muted/20">
                <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
                  {accountData.isBankAccount ? "Bank Balance" : accountData.isCreditAccount ? "Credit Balance" : "Balance"}
                </p>
                <p className="text-xl md:text-2xl font-bold text-foreground">
                  {formatCurrency(accountData.bankBalance)}
                </p>
              </div>

              {/* Coasting Expenses */}
              <div 
                className="p-4 bg-gradient-to-br from-yellow-50/80 to-yellow-100/50 dark:from-yellow-900/20 dark:to-yellow-800/10 cursor-pointer hover:from-yellow-100 dark:hover:from-yellow-900/30 transition-all duration-200 group"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleCoastingExpensesExpanded(accountData.id);
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
                      Coasting Expenses
                    </p>
                    <p className={cn(
                      "text-base md:text-lg font-bold",
                      accountData.isBankAccount ? "text-red-600 dark:text-red-400" : "text-blue-600 dark:text-blue-400"
                    )}>
                      {accountData.coastingExpenses > 0 
                        ? (accountData.isBankAccount ? `(${formatCurrency(accountData.coastingExpenses)})` : `+${formatCurrency(accountData.coastingExpenses)}`)
                        : '-'
                      }
                    </p>
                  </div>
                  {coastingExpenses.length > 0 && (
                    <div className="mt-1 transition-transform duration-200 group-hover:scale-110">
                      {coastingExpensesExpanded ? (
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      )}
                    </div>
                  )}
                </div>
                {coastingExpensesExpanded && coastingExpenses.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-yellow-200 dark:border-yellow-800 space-y-2 max-h-64 overflow-y-auto">
                    {coastingExpenses.map((expense) => (
                      <div 
                        key={expense.id} 
                        className="text-xs bg-white dark:bg-gray-800 p-2 rounded border border-yellow-200 dark:border-yellow-800"
                      >
                        <div className="flex justify-between items-start mb-1">
                          <span className="font-medium truncate flex-1 mr-2 text-foreground">
                            {expense.name}
                          </span>
                          <span className={cn(
                            "font-bold whitespace-nowrap",
                            accountData.isBankAccount 
                              ? "text-red-600 dark:text-red-400" 
                              : "text-blue-600 dark:text-blue-400"
                          )}>
                            {formatCurrency(Number(expense.amount))}
                          </span>
                        </div>
                        <div className="text-muted-foreground text-[10px]">
                          {format(new Date(expense.expense_date), "MMM d, yyyy")}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Real Balance */}
              <div className={cn(
                "p-4 bg-gradient-to-br",
                accountData.realBalance >= 0 && accountData.isBankAccount
                  ? "from-green-50 to-green-100/50 dark:from-green-900/20 dark:to-green-800/10" 
                  : "from-red-50 to-red-100/50 dark:from-red-900/20 dark:to-red-800/10"
              )}>
                <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
                  {accountData.isBankAccount ? "Real Balance" : accountData.isCreditAccount ? "Real Credit Balance" : "Real Balance"}
                </p>
                <p className={cn(
                  "text-xl md:text-2xl font-bold",
                  accountData.realBalance >= 0 && accountData.isBankAccount 
                    ? "text-green-600 dark:text-green-400" 
                    : "text-red-600 dark:text-red-400"
                )}>
                  ${formatCurrency(Math.abs(accountData.realBalance))}
                </p>
              </div>

              {/* Bills to Close */}
              <div 
                className="p-4 bg-gradient-to-br from-yellow-50/80 to-yellow-100/50 dark:from-yellow-900/20 dark:to-yellow-800/10 cursor-pointer hover:from-yellow-100 dark:hover:from-yellow-900/30 transition-all duration-200 group"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleBillsToCloseExpanded(accountData.id);
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide flex items-center gap-1">
                      Bills to Close
                      <InfoTooltip content="Bills that are due before your next paycheck. These bills will be paid from your current balance." />
                    </p>
                    <p className="text-base md:text-lg font-bold text-red-600 dark:text-red-400">
                      {accountData.billsToClose > 0 
                        ? `(${formatCurrency(accountData.billsToClose)})`
                        : '-'
                      }
                    </p>
                  </div>
                  {billsToClose.length > 0 && (
                    <div className="mt-1 transition-transform duration-200 group-hover:scale-110">
                      {billsToCloseExpanded ? (
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      )}
                    </div>
                  )}
                </div>
                {billsToCloseExpanded && billsToClose.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-yellow-200 dark:border-yellow-800 space-y-2 max-h-64 overflow-y-auto">
                    {billsToClose.map((bill) => (
                      <div 
                        key={bill.id} 
                        className="text-xs bg-white dark:bg-gray-800 p-2 rounded border border-yellow-200 dark:border-yellow-800"
                      >
                        <div className="flex justify-between items-start mb-1">
                          <span className="font-medium truncate flex-1 mr-2 text-foreground">
                            {bill.name}
                          </span>
                          <span className="font-bold whitespace-nowrap text-red-600 dark:text-red-400">
                            ${formatCurrency(Number(bill.amount_now))}
                          </span>
                        </div>
                        <div className="text-muted-foreground text-[10px]">
                          {format(new Date(bill.payment_date), "MMM d, yyyy")}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Closed Tab */}
              <div className={cn(
                "p-4 bg-gradient-to-br",
                accountData.closedTab >= 0
                  ? "from-green-50 to-green-100/50 dark:from-green-900/20 dark:to-green-800/10" 
                  : "from-red-50 to-red-100/50 dark:from-red-900/20 dark:to-red-800/10"
              )}>
                <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide flex items-center gap-1">
                  Closed Tab
                  <InfoTooltip content="Your balance after paying bills scheduled before your next paycheck. This shows how much you'll have left after closing out these bills." />
                </p>
                <p className={cn(
                  "text-xl md:text-2xl font-bold",
                  accountData.closedTab >= 0 
                    ? "text-green-600 dark:text-green-400" 
                    : "text-red-600 dark:text-red-400"
                )}>
                  ${formatCurrency(Math.abs(accountData.closedTab))}
                </p>
              </div>

              {/* Open Bills */}
              <div 
                className="p-4 bg-gradient-to-br from-yellow-50/80 to-yellow-100/50 dark:from-yellow-900/20 dark:to-yellow-800/10 cursor-pointer hover:from-yellow-100 dark:hover:from-yellow-900/30 transition-all duration-200 group"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleOpenBillsExpanded(accountData.id);
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide flex items-center gap-1">
                      Open Bills
                      <InfoTooltip content="Bills that are due on or after your next paycheck. These are future expenses you need to plan for." />
                    </p>
                    <p className="text-base md:text-lg font-bold text-yellow-600 dark:text-yellow-400">
                      {accountData.openBills > 0 
                        ? formatCurrency(accountData.openBills)
                        : '-'
                      }
                    </p>
                  </div>
                  {openBills.length > 0 && (
                    <div className="mt-1 transition-transform duration-200 group-hover:scale-110">
                      {openBillsExpanded ? (
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      )}
                    </div>
                  )}
                </div>
                {openBillsExpanded && openBills.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-yellow-200 dark:border-yellow-800 space-y-2 max-h-64 overflow-y-auto">
                    {openBills.map((bill) => (
                      <div 
                        key={bill.id} 
                        className="text-xs bg-white dark:bg-gray-800 p-2 rounded border border-yellow-200 dark:border-yellow-800"
                      >
                        <div className="flex justify-between items-start mb-1">
                          <span className="font-medium truncate flex-1 mr-2 text-foreground">
                            {bill.name}
                          </span>
                          <span className="font-bold whitespace-nowrap text-yellow-600 dark:text-yellow-400">
                            ${formatCurrency(Number(bill.amount_now))}
                          </span>
                        </div>
                        <div className="text-muted-foreground text-[10px]">
                          {format(new Date(bill.payment_date), "MMM d, yyyy")}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        )}
      </Card>
    );
  };

  // Render Total Tab for Close Out
  const renderCloseOutTotalTab = (isBankAccount: boolean) => {
    const accountData = isBankAccount ? bankAccountsCloseOutData : creditAccountsCloseOutData;
    const totalBalance = isBankAccount ? totalBankBalance : totalCreditBalance;
    const totalCoastingExp = isBankAccount ? totalBankCoastingExpenses : totalCreditCoastingExpenses;
    const totalRealBal = isBankAccount ? totalRealBankBalance : totalRealCreditBalance;
    const totalBillsToClose = isBankAccount ? totalBankBillsToClose : totalCreditBillsToClose;
    const totalClosedTab = isBankAccount ? totalBankClosedTab : totalCreditClosedTab;
    const totalOpenBills = isBankAccount ? totalBankOpenBills : totalCreditOpenBills;

    const allBillsToClose = bills.filter(bill => {
      if (!nextPaycheckDate) return false;
      const billDate = new Date(bill.payment_date);
      billDate.setHours(0, 0, 0, 0);
      if (billDate >= nextPaycheckDate) return false;
      const account = bankAccounts.find(acc => acc.id === bill.bank_account_id);
      if (!account) return false;
      const accountType = account.account_type?.toLowerCase() || '';
      return isBankAccount 
        ? ['checking', 'savings', 'digital_wallet'].includes(accountType)
        : ['credit_card', 'loan'].includes(accountType);
    });
    const allOpenBills = bills.filter(bill => {
      if (!nextPaycheckDate) return true;
      const billDate = new Date(bill.payment_date);
      billDate.setHours(0, 0, 0, 0);
      if (billDate < nextPaycheckDate) return false;
      const account = bankAccounts.find(acc => acc.id === bill.bank_account_id);
      if (!account) return false;
      const accountType = account.account_type?.toLowerCase() || '';
      return isBankAccount 
        ? ['checking', 'savings', 'digital_wallet'].includes(accountType)
        : ['credit_card', 'loan'].includes(accountType);
    });
    const allCoastingExpenses = coasterItems.filter(item => {
      if (!item.bank_account_id) return isBankAccount; // Unallocated goes to bank accounts
      const account = bankAccounts.find(acc => acc.id === item.bank_account_id);
      if (!account) return false;
      const accountType = account.account_type?.toLowerCase() || '';
      return isBankAccount 
        ? ['checking', 'savings', 'digital_wallet'].includes(accountType)
        : ['credit_card', 'loan'].includes(accountType);
    });
    const totalBillsToCloseExpanded = expandedBillsToClose.has(isBankAccount ? "total-bank" : "total-credit");
    const totalOpenBillsExpanded = expandedOpenBills.has(isBankAccount ? "total-bank" : "total-credit");
    const totalCoastingExpensesExpanded = expandedCoastingExpenses.has(isBankAccount ? "total-bank" : "total-credit");

    const headerColor = isBankAccount
      ? "bg-gradient-to-br from-green-600 to-green-700 dark:from-green-700 dark:to-green-800"
      : "bg-gradient-to-br from-pink-500 to-pink-600 dark:from-pink-600 dark:to-pink-700";

    return (
      <Card className="border-2 shadow-lg hover:shadow-xl transition-shadow">
        <CardHeader className={cn(headerColor, "pb-3 px-4 pt-4")}>
          <CardTitle className="text-white text-base font-bold">Total Tab</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {/* Bank/Credit Balance */}
            <div className="p-4 bg-gradient-to-br from-muted/40 to-muted/20">
              <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
                {isBankAccount ? "Bank Balance" : "Credit Balance"}
              </p>
              <p className="text-xl md:text-2xl font-bold text-foreground">
                {formatCurrency(totalBalance)}
              </p>
            </div>

            {/* Coasting Expenses */}
            <div 
              className="p-4 bg-gradient-to-br from-yellow-50/80 to-yellow-100/50 dark:from-yellow-900/20 dark:to-yellow-800/10 cursor-pointer hover:from-yellow-100 dark:hover:from-yellow-900/30 transition-all duration-200 group"
              onClick={() => {
                const newExpanded = new Set(expandedCoastingExpenses);
                const key = isBankAccount ? "total-bank" : "total-credit";
                if (newExpanded.has(key)) {
                  newExpanded.delete(key);
                } else {
                  newExpanded.add(key);
                }
                setExpandedCoastingExpenses(newExpanded);
              }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
                    Coasting Expenses
                  </p>
                  <p className={cn(
                    "text-base md:text-lg font-bold",
                    isBankAccount ? "text-red-600 dark:text-red-400" : "text-blue-600 dark:text-blue-400"
                  )}>
                    {totalCoastingExp > 0 
                      ? (isBankAccount ? `(${formatCurrency(totalCoastingExp)})` : `+${formatCurrency(totalCoastingExp)}`)
                      : '-'
                    }
                  </p>
                </div>
                <div className="mt-1 transition-transform duration-200 group-hover:scale-110">
                  {totalCoastingExpensesExpanded ? (
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  )}
                </div>
              </div>
              {totalCoastingExpensesExpanded && allCoastingExpenses.length > 0 && (
                <div className="mt-3 pt-3 border-t border-yellow-200 dark:border-yellow-800 space-y-2 max-h-64 overflow-y-auto">
                  {allCoastingExpenses.map((expense) => {
                    const account = bankAccounts.find(acc => acc.id === expense.bank_account_id);
                    const accountType = account?.account_type?.toLowerCase() || '';
                    const isBankAcc = ['checking', 'savings', 'digital_wallet'].includes(accountType);
                    return (
                      <div 
                        key={expense.id} 
                        className="text-xs bg-white dark:bg-gray-800 p-2 rounded border border-yellow-200 dark:border-yellow-800"
                      >
                        <div className="flex justify-between items-start mb-1">
                          <span className="font-medium truncate flex-1 mr-2 text-foreground">
                            {expense.name}
                          </span>
                          <span className={cn(
                            "font-bold whitespace-nowrap",
                            isBankAcc 
                              ? "text-red-600 dark:text-red-400" 
                              : "text-blue-600 dark:text-blue-400"
                          )}>
                            {formatCurrency(Number(expense.amount))}
                          </span>
                        </div>
                        <div className="text-muted-foreground text-[10px]">
                          {format(new Date(expense.expense_date), "MMM d, yyyy")}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Real Balance */}
            <div className={cn(
              "p-4 bg-gradient-to-br",
              totalRealBal >= 0 && isBankAccount
                ? "from-green-50 to-green-100/50 dark:from-green-900/20 dark:to-green-800/10" 
                : "from-red-50 to-red-100/50 dark:from-red-900/20 dark:to-red-800/10"
            )}>
              <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
                {isBankAccount ? "Real Balance" : "Real Credit Balance"}
              </p>
              <p className={cn(
                "text-xl md:text-2xl font-bold",
                totalRealBal >= 0 && isBankAccount 
                  ? "text-green-600 dark:text-green-400" 
                  : "text-red-600 dark:text-red-400"
              )}>
                ${formatCurrency(Math.abs(totalRealBal))}
              </p>
            </div>

            {/* Bills to Close */}
            <div 
              className="p-4 bg-gradient-to-br from-yellow-50/80 to-yellow-100/50 dark:from-yellow-900/20 dark:to-yellow-800/10 cursor-pointer hover:from-yellow-100 dark:hover:from-yellow-900/30 transition-all duration-200 group"
              onClick={() => {
                const newExpanded = new Set(expandedBillsToClose);
                const key = isBankAccount ? "total-bank" : "total-credit";
                if (newExpanded.has(key)) {
                  newExpanded.delete(key);
                } else {
                  newExpanded.add(key);
                }
                setExpandedBillsToClose(newExpanded);
              }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
                    Bills to Close
                  </p>
                  <p className="text-base md:text-lg font-bold text-red-600 dark:text-red-400">
                    {totalBillsToClose > 0 
                      ? `(${formatCurrency(totalBillsToClose)})`
                      : '-'
                    }
                  </p>
                </div>
                <div className="mt-1 transition-transform duration-200 group-hover:scale-110">
                  {totalBillsToCloseExpanded ? (
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  )}
                </div>
              </div>
              {totalBillsToCloseExpanded && allBillsToClose.length > 0 && (
                <div className="mt-3 pt-3 border-t border-yellow-200 dark:border-yellow-800 space-y-2 max-h-64 overflow-y-auto">
                  {allBillsToClose.map((bill) => (
                    <div 
                      key={bill.id} 
                      className="text-xs bg-white dark:bg-gray-800 p-2 rounded border border-yellow-200 dark:border-yellow-800"
                    >
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-medium truncate flex-1 mr-2 text-foreground">
                          {bill.name}
                        </span>
                        <span className="font-bold whitespace-nowrap text-red-600 dark:text-red-400">
                          ${formatCurrency(Number(bill.amount_now))}
                        </span>
                      </div>
                      <div className="text-muted-foreground text-[10px]">
                        {format(new Date(bill.payment_date), "MMM d, yyyy")}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Closed Tab */}
            <div className={cn(
              "p-4 bg-gradient-to-br",
              totalClosedTab >= 0 && isBankAccount
                ? "from-green-50 to-green-100/50 dark:from-green-900/20 dark:to-green-800/10" 
                : "from-red-50 to-red-100/50 dark:from-red-900/20 dark:to-red-800/10"
            )}>
              <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
                Closed Tab
              </p>
              <p className={cn(
                "text-xl md:text-2xl font-bold",
                totalClosedTab >= 0 && isBankAccount
                  ? "text-green-600 dark:text-green-400" 
                  : "text-red-600 dark:text-red-400"
              )}>
                ${formatCurrency(Math.abs(totalClosedTab))}
              </p>
            </div>

            {/* Open Bills */}
            <div 
              className="p-4 bg-gradient-to-br from-yellow-50/80 to-yellow-100/50 dark:from-yellow-900/20 dark:to-yellow-800/10 cursor-pointer hover:from-yellow-100 dark:hover:from-yellow-900/30 transition-all duration-200 group"
              onClick={() => {
                const newExpanded = new Set(expandedOpenBills);
                const key = isBankAccount ? "total-bank" : "total-credit";
                if (newExpanded.has(key)) {
                  newExpanded.delete(key);
                } else {
                  newExpanded.add(key);
                }
                setExpandedOpenBills(newExpanded);
              }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
                    Open Bills
                  </p>
                  <p className="text-base md:text-lg font-bold text-yellow-600 dark:text-yellow-400">
                    {totalOpenBills > 0 
                      ? formatCurrency(totalOpenBills)
                      : '-'
                    }
                  </p>
                </div>
                <div className="mt-1 transition-transform duration-200 group-hover:scale-110">
                  {totalOpenBillsExpanded ? (
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  )}
                </div>
              </div>
              {totalOpenBillsExpanded && allOpenBills.length > 0 && (
                <div className="mt-3 pt-3 border-t border-yellow-200 dark:border-yellow-800 space-y-2 max-h-64 overflow-y-auto">
                  {allOpenBills.map((bill) => (
                    <div 
                      key={bill.id} 
                      className="text-xs bg-white dark:bg-gray-800 p-2 rounded border border-yellow-200 dark:border-yellow-800"
                    >
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-medium truncate flex-1 mr-2 text-foreground">
                          {bill.name}
                        </span>
                        <span className="font-bold whitespace-nowrap text-yellow-600 dark:text-yellow-400">
                          ${formatCurrency(Number(bill.amount_now))}
                        </span>
                      </div>
                      <div className="text-muted-foreground text-[10px]">
                        {format(new Date(bill.payment_date), "MMM d, yyyy")}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-4 md:space-y-6 p-3 md:p-6">
      <div className="space-y-1 md:space-y-2">
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">Abek</h1>
        <p className="text-sm md:text-base text-muted-foreground">Master your money</p>
      </div>

      {/* Abek: Close Out */}
      <Card className="border-2">
        <CardHeader
          className="cursor-pointer hover:bg-muted/50 transition-colors p-4 md:p-6"
          onClick={() => setCloseOutExpanded(!closeOutExpanded)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 md:gap-3">
              <Calculator className="w-4 h-4 md:w-5 md:h-5 text-secondary" />
              <CardTitle className="text-base md:text-xl">Abek: Close Out</CardTitle>
            </div>
            {closeOutExpanded ? (
              <ChevronDown className="w-4 h-4 md:w-5 md:h-5 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-4 h-4 md:w-5 md:h-5 text-muted-foreground" />
            )}
          </div>
        </CardHeader>
        {closeOutExpanded && (
          <CardContent className="space-y-4 md:space-y-6 pt-0 p-4 md:p-6">
            {/* My Tab Section */}
            {bankAccountsCloseOutData.length > 0 && (
              <div className="space-y-5">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                    <Wallet className="w-5 h-5 text-green-600 dark:text-green-400" />
                  </div>
                  <h2 className="text-2xl md:text-3xl font-bold">My Tab</h2>
                </div>

                {/* Total Tab - Full Width */}
                <div className="w-full">
                  {renderCloseOutTotalTab(true)}
                </div>

                {/* Individual Bank Accounts - Responsive Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {bankAccountsCloseOutData.map((accountData) => renderCloseOutAccountCard(accountData))}
                </div>

                {unallocatedExpenses > 0 && (
                  <Card className="border-2 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 shadow-sm">
                    <CardContent className="p-4">
                      <p className="text-sm text-muted-foreground">
                        <span className="font-semibold text-amber-900 dark:text-amber-200">Note:</span> ${formatCurrency(unallocatedExpenses)} in unallocated expenses included in Total Tab
                      </p>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {/* My Credit Tab Section */}
            {creditAccountsCloseOutData.length > 0 && (
              <div className="space-y-5">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-pink-100 dark:bg-pink-900/30 rounded-lg">
                    <CreditCard className="w-5 h-5 text-pink-600 dark:text-pink-400" />
                  </div>
                  <h2 className="text-2xl md:text-3xl font-bold">My Credit Tab</h2>
                </div>

                {/* Total Tab - Full Width */}
                <div className="w-full">
                  {renderCloseOutTotalTab(false)}
                </div>

                {/* Individual Credit Accounts - Responsive Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {creditAccountsCloseOutData.map((accountData) => renderCloseOutAccountCard(accountData))}
                </div>
              </div>
            )}

            {/* Empty State */}
            {bankAccountsCloseOutData.length === 0 && creditAccountsCloseOutData.length === 0 && (
              <Card className="border-2 shadow-lg">
                <CardContent className="py-16 text-center">
                  <p className="text-muted-foreground">
                    No accounts found. Add accounts in the Bank Tab.
                  </p>
                </CardContent>
              </Card>
            )}
          </CardContent>
        )}
      </Card>

      {/* Abek: Budget */}
      <Card className="border-2">
        <CardHeader
          className="cursor-pointer hover:bg-muted/50 transition-colors p-4 md:p-6"
          onClick={() => setBudgetExpanded(!budgetExpanded)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 md:gap-3">
              <PieChart className="w-4 h-4 md:w-5 md:h-5 text-secondary" />
              <CardTitle className="text-base md:text-xl">Abek: Budget</CardTitle>
            </div>
            {budgetExpanded ? (
              <ChevronDown className="w-4 h-4 md:w-5 md:h-5 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-4 h-4 md:w-5 md:h-5 text-muted-foreground" />
            )}
          </div>
        </CardHeader>
        {budgetExpanded && (
          <CardContent className="space-y-4 md:space-y-6 pt-0 p-4 md:p-6">
            {/* Income Section */}
            <div className="space-y-2">
              <h3 className="text-base md:text-lg font-bold text-foreground flex items-center gap-2">
                INCOME
                <InfoTooltip content="Your total monthly income from all sources. This is typically your next paycheck amount or the sum of all income items for the current month." />
              </h3>
              <div className="text-xl md:text-2xl font-bold text-secondary">
                ${formatCurrency(totalIncome)}
              </div>
            </div>

            {/* Bills & Savings Section */}
            <div className="space-y-3 md:space-y-4">
              <h3 className="text-base md:text-lg font-bold text-foreground flex items-center gap-2">
                BILLS & SAVINGS
                <InfoTooltip content="All your monthly bills and savings contributions, organized by category. This shows where your money is going and helps you understand your spending patterns." />
              </h3>
              
              <div className="space-y-2 md:space-y-3">
                {Object.values(budgetByCategory)
                  .sort((a, b) => b.total - a.total)
                  .map((category) => {
                    const percentage = totalIncome > 0 ? (category.total / totalIncome) * 100 : 0;
                    return (
                      <Card key={category.category} className="border p-3 md:p-4">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2 md:gap-0 mb-2 md:mb-3">
                          <div className="flex-1">
                            <h4 className="font-bold text-sm md:text-base text-foreground">{category.category}</h4>
                            <p className="text-xs md:text-sm text-muted-foreground">
                              {category.bills.length} item{category.bills.length !== 1 ? "s" : ""}
                            </p>
                          </div>
                          <div className="text-right w-full md:w-auto">
                            <div className="text-lg md:text-xl font-bold text-foreground">
                              ${formatCurrency(category.total)}
                            </div>
                            <div className="text-xs md:text-sm text-muted-foreground">
                              {formatCurrency(percentage)}%
                            </div>
                          </div>
                        </div>
                        
                        {/* Bill items in this category */}
                        <div className="mt-2 md:mt-3 space-y-1 pl-3 md:pl-4 border-l-2 border-muted">
                          {category.bills.map((bill) => (
                            <div key={bill.id} className="flex justify-between items-center text-xs md:text-sm">
                              <span className="text-muted-foreground truncate pr-2">{bill.name}</span>
                              <span className="font-medium flex-shrink-0">${formatCurrency(Number(bill.amount_now))}</span>
                            </div>
                          ))}
                        </div>
                      </Card>
                    );
                  })}
              </div>

              {/* Grand Total */}
              <div className="border-t-2 pt-3 md:pt-4">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
                  <span className="text-base md:text-lg font-bold">Grand Total</span>
                  <span className="text-xl md:text-2xl font-bold text-foreground">
                    ${formatCurrency(totalBudget)}
                  </span>
                </div>
              </div>
            </div>

            {/* Coaster Tab Section */}
            <div className="bg-secondary/10 p-3 md:p-4 rounded-lg">
              <div className="space-y-2">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
                  <span className="text-base md:text-lg font-bold flex items-center gap-2">
                    Coaster Tab
                    <InfoTooltip content="The money left over after paying all your bills. This is your discretionary spending money - what you can use for daily expenses, entertainment, and unexpected costs. Coaster Tab Per Diem shows how much you can spend per day until your next paycheck." />
                  </span>
                  <span className="text-xl md:text-2xl font-bold text-secondary">
                    ${formatCurrency(coasterTab)}
                  </span>
                </div>
                <div className="text-xs md:text-sm text-muted-foreground">
                  {totalIncome > 0 ? formatCurrency((coasterTab / totalIncome) * 100) : "0.00"}% of income
                </div>
                {coastingDays > 0 && (
                  <div className="text-xs md:text-sm text-muted-foreground flex items-center gap-1">
                    Coaster Tab Per Diem: ${formatCurrency(coasterTab / coastingDays)}
                    <InfoTooltip content="Your daily spending budget. Divide your Coaster Tab by the number of days until your next paycheck to see how much you can spend each day." />
                  </div>
                )}
              </div>
            </div>
        </CardContent>
        )}
      </Card>
    </div>
  );
};

export default Survivor;
