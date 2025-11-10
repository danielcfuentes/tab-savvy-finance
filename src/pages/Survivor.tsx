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

  // Calculate per-account values for Close Out
  const closeOutAccountData = accountIds.map(accountId => {
    const account = bankAccounts.find(acc => acc.id === accountId);
    const accountRealBalance = getClosingTabPerAccount(bankAccounts, coasterItems, accountId);
    const billsToClose = getBillsToClosePerAccount(bills, nextPaycheckDate, accountId);
    const closedTab = accountRealBalance - billsToClose;
    const openBills = getOpenBillsPerAccount(bills, nextPaycheckDate, accountId);
    
    return {
      id: accountId,
      name: account?.name || "Unknown Account",
      realBalance: accountRealBalance,
      billsToClose,
      closedTab,
      openBills,
    };
  });

  // Calculate totals for End of Month (Abek Tab)
  const totalClosingTab = accountData.reduce((sum, acc) => sum + acc.closingTab, 0);
  const totalOpenBills = accountData.reduce((sum, acc) => sum + acc.openBills, 0);
  const totalNextPaycheck = accountData.reduce((sum, acc) => sum + acc.nextPaycheck, 0);
  const totalCoastingEst = accountData.reduce((sum, acc) => sum + acc.coastingEst, 0);
  // Abek Tab = Closing Tab - Open Bills + Next Paycheck - Coasting Estimate
  const survivorTab = totalClosingTab - totalOpenBills + totalNextPaycheck - totalCoastingEst;
  const monthsCovered = getMonthsCovered(survivorTab, fullMonthRanges.totals.total);

  // Calculate totals for Close Out
  const totalRealBalance = closeOutAccountData.reduce((sum, acc) => sum + acc.realBalance, 0);
  const totalBillsToClose = closeOutAccountData.reduce((sum, acc) => sum + acc.billsToClose, 0);
  const totalClosedTab = closeOutAccountData.reduce((sum, acc) => sum + acc.closedTab, 0);
  const totalOpenBillsCloseOut = closeOutAccountData.reduce((sum, acc) => sum + acc.openBills, 0);

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
            {/* Real Balance Total at Top */}
            <div className="bg-green-100 dark:bg-green-900/30 p-3 md:p-4 rounded-lg">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
                <span className="text-base md:text-lg font-bold flex items-center gap-2">
                  Real Balance
                  <InfoTooltip content="Your total account balance minus all coaster expenses. This represents your actual spending power across all accounts." />
                </span>
                <span className={cn(
                  "text-xl md:text-2xl font-bold",
                  totalRealBalance >= 0 
                    ? "text-green-600 dark:text-green-400" 
                    : "text-red-600 dark:text-red-400"
                )}>
                  ${formatCurrency(Math.abs(totalRealBalance))}
                </span>
              </div>
            </div>

            {/* Close Out Section */}
            <div className="space-y-3 md:space-y-4">
              <div className="bg-yellow-100 dark:bg-yellow-900/30 p-3 md:p-4 rounded-lg">
                <h3 className="text-base md:text-lg font-bold text-foreground mb-3 md:mb-4">CLOSE OUT</h3>
                
                {/* Mobile: Stacked layout, Desktop: Grid layout */}
                <div className="space-y-3 md:space-y-0">
                  {/* Desktop Header - Hidden on mobile */}
                  <div className="hidden md:grid md:grid-cols-5 gap-2 text-xs md:text-sm font-semibold border-b pb-2 mb-2">
                    <div>Account</div>
                    <div className="text-right flex items-center justify-end gap-1">
                      Real Balance
                      <InfoTooltip content="Your account balance minus any coaster expenses allocated to this account." />
                    </div>
                    <div className="text-right flex items-center justify-end gap-1">
                      - Bills to Close
                      <InfoTooltip content="Bills that are due before your next paycheck. These bills will be paid from your current balance." />
                    </div>
                    <div className="text-right flex items-center justify-end gap-1">
                      = Closed Tab
                      <InfoTooltip content="Your balance after paying bills scheduled before your next paycheck. This shows how much you'll have left after closing out these bills." />
                    </div>
                    <div className="text-right flex items-center justify-end gap-1">
                      Open Bills
                      <InfoTooltip content="Bills that are due on or after your next paycheck. These are future expenses you need to plan for." />
                    </div>
                  </div>
                  
                  {/* Account Rows */}
                  {closeOutAccountData.map((acc) => (
                    <div key={acc.id} className="md:grid md:grid-cols-5 gap-2 text-xs md:text-sm border-b md:border-b-0 pb-3 md:pb-0 last:border-b-0">
                      {/* Mobile: Card layout */}
                      <div className="md:hidden space-y-2">
                        <div className="font-bold text-sm">{acc.name}</div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <div className="text-muted-foreground flex items-center gap-1">
                              Real Balance
                              <InfoTooltip content="Your account balance minus any coaster expenses allocated to this account." />
                            </div>
                            <div className={cn("font-semibold", acc.realBalance < 0 && "text-yellow-600 dark:text-yellow-400")}>
                              {formatCurrencyWithSign(acc.realBalance)}
                            </div>
                          </div>
                          <div>
                            <div className="text-muted-foreground flex items-center gap-1">
                              Bills to Close
                              <InfoTooltip content="Bills that are due before your next paycheck. These bills will be paid from your current balance." />
                            </div>
                            <div className={cn("font-semibold", acc.billsToClose > 0 && "text-red-600 dark:text-red-400")}>
                              {acc.billsToClose > 0 ? formatCurrencyWithSign(-acc.billsToClose) : "-"}
                            </div>
                          </div>
                          <div>
                            <div className="text-muted-foreground flex items-center gap-1">
                              Closed Tab
                              <InfoTooltip content="Your balance after paying bills scheduled before your next paycheck. This shows how much you'll have left after closing out these bills." />
                            </div>
                            <div className={cn("font-semibold", acc.closedTab < 0 && "text-yellow-600 dark:text-yellow-400")}>
                              {formatCurrencyWithSign(acc.closedTab)}
                            </div>
                          </div>
                          <div>
                            <div className="text-muted-foreground flex items-center gap-1">
                              Open Bills
                              <InfoTooltip content="Bills that are due on or after your next paycheck. These are future expenses you need to plan for." />
                            </div>
                            <div className={cn("font-semibold", acc.openBills > 0 && "text-yellow-600 dark:text-yellow-400")}>
                              {acc.openBills > 0 ? formatCurrencyWithSign(acc.openBills) : "-"}
                            </div>
                          </div>
                        </div>
                      </div>
                      {/* Desktop: Grid layout */}
                      <div className="hidden md:contents">
                        <div className="font-medium truncate">{acc.name}</div>
                        <div className={cn("text-right", acc.realBalance < 0 && "text-yellow-600 dark:text-yellow-400")}>
                          {formatCurrencyWithSign(acc.realBalance)}
                        </div>
                        <div className={cn("text-right", acc.billsToClose > 0 && "text-red-600 dark:text-red-400")}>
                          {acc.billsToClose > 0 ? formatCurrencyWithSign(-acc.billsToClose) : "-"}
                        </div>
                        <div className={cn("text-right", acc.closedTab < 0 && "text-yellow-600 dark:text-yellow-400")}>
                          {formatCurrencyWithSign(acc.closedTab)}
                        </div>
                        <div className={cn("text-right", acc.openBills > 0 && "text-yellow-600 dark:text-yellow-400")}>
                          {acc.openBills > 0 ? formatCurrencyWithSign(acc.openBills) : "-"}
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {/* Totals Row */}
                  <div className="md:grid md:grid-cols-5 gap-2 text-xs md:text-sm font-bold border-t pt-2 md:pt-3">
                    <div className="hidden md:block">Total</div>
                    <div className="md:hidden font-bold text-sm mb-2">Totals</div>
                    <div className="md:contents">
                      <div className="md:hidden text-xs text-muted-foreground mb-1">Real Balance</div>
                      <div className={cn("text-right md:text-right font-semibold", totalRealBalance < 0 && "text-yellow-600 dark:text-yellow-400")}>
                        {formatCurrencyWithSign(totalRealBalance)}
                      </div>
                    </div>
                    <div className="md:contents">
                      <div className="md:hidden text-xs text-muted-foreground mb-1">Bills to Close</div>
                      <div className={cn("text-right md:text-right font-semibold", totalBillsToClose > 0 && "text-red-600 dark:text-red-400")}>
                        {totalBillsToClose > 0 ? formatCurrencyWithSign(-totalBillsToClose) : "-"}
                      </div>
                    </div>
                    <div className="md:contents">
                      <div className="md:hidden text-xs text-muted-foreground mb-1">Closed Tab</div>
                      <div className={cn("text-right md:text-right font-semibold", totalClosedTab < 0 && "text-yellow-600 dark:text-yellow-400")}>
                        {formatCurrencyWithSign(totalClosedTab)}
                      </div>
                    </div>
                    <div className="md:contents">
                      <div className="md:hidden text-xs text-muted-foreground mb-1">Open Bills</div>
                      <div className={cn("text-right md:text-right font-semibold", totalOpenBillsCloseOut > 0 && "text-yellow-600 dark:text-yellow-400")}>
                        {totalOpenBillsCloseOut > 0 ? formatCurrencyWithSign(totalOpenBillsCloseOut) : "-"}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
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
