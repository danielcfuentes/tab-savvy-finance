import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Wallet, CreditCard, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

type BankAccountWithType = {
  id: string;
  name: string;
  balance: number;
  account_type: string;
};

type CoasterItem = {
  id: string;
  name: string;
  amount: number;
  expense_date: string;
  bank_account_id: string | null;
  category: string;
};

const RealBank = () => {
  const [accounts, setAccounts] = useState<BankAccountWithType[]>([]);
  const [coasterItems, setCoasterItems] = useState<CoasterItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedAccounts, setExpandedAccounts] = useState<Set<string>>(new Set());
  const [expandedExpenses, setExpandedExpenses] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: accountsData, error: accountsError } = await supabase
        .from("bank_accounts")
        .select("*")
        .order("created_at", { ascending: true });

      if (accountsError) throw accountsError;

      const { data: coasterData, error: coasterError } = await supabase
        .from("coaster_items")
        .select("*")
        .order("expense_date", { ascending: true });

      if (coasterError) throw coasterError;

      setAccounts((accountsData || []) as BankAccountWithType[]);
      setCoasterItems((coasterData || []) as CoasterItem[]);
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
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  // Separate accounts by type
  const bankAccounts = accounts.filter(acc => 
    ['checking', 'savings', 'digital_wallet'].includes(acc.account_type?.toLowerCase() || '')
  );
  const creditAccounts = accounts.filter(acc => 
    ['credit_card', 'loan'].includes(acc.account_type?.toLowerCase() || '')
  );

  // Calculate expenses per account
  const getExpensesByAccount = (accountId: string) => {
    return coasterItems.filter(item => item.bank_account_id === accountId);
  };

  const getExpensesTotalByAccount = (accountId: string) => {
    return coasterItems
      .filter(item => item.bank_account_id === accountId)
      .reduce((sum, item) => sum + Number(item.amount), 0);
  };

  // Calculate unallocated expenses
  const unallocatedExpenses = coasterItems
    .filter(item => !item.bank_account_id)
    .reduce((sum, item) => sum + Number(item.amount), 0);

  // Calculate totals
  const totalBankBalance = bankAccounts.reduce((sum, account) => sum + Number(account.balance), 0);
  const totalBankExpenses = bankAccounts.reduce((sum, account) => sum + getExpensesTotalByAccount(account.id), 0) + unallocatedExpenses;
  const totalRealBankBalance = totalBankBalance - totalBankExpenses;

  const totalCreditBalance = creditAccounts.reduce((sum, account) => sum + Number(account.balance), 0);
  const totalCreditExpenses = creditAccounts.reduce((sum, account) => sum + getExpensesTotalByAccount(account.id), 0);
  const totalRealCreditBalance = totalCreditBalance + totalCreditExpenses;

  const toggleAccountExpanded = (accountId: string) => {
    const newExpanded = new Set(expandedAccounts);
    if (newExpanded.has(accountId)) {
      newExpanded.delete(accountId);
    } else {
      newExpanded.add(accountId);
    }
    setExpandedAccounts(newExpanded);
  };

  const toggleExpensesExpanded = (accountId: string) => {
    const newExpanded = new Set(expandedExpenses);
    if (newExpanded.has(accountId)) {
      newExpanded.delete(accountId);
    } else {
      newExpanded.add(accountId);
    }
    setExpandedExpenses(newExpanded);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Render account card component
  const renderAccountCard = (
    account: BankAccountWithType,
    isBankAccount: boolean,
    showExpanded: boolean
  ) => {
    const expenses = getExpensesByAccount(account.id);
    const expensesTotal = getExpensesTotalByAccount(account.id);
    const realBalance = isBankAccount 
      ? Number(account.balance) - expensesTotal
      : Number(account.balance) + expensesTotal;
    const isExpanded = expandedAccounts.has(account.id);
    const expensesExpanded = expandedExpenses.has(account.id);
    const headerColor = isBankAccount 
      ? "bg-gradient-to-br from-green-600 to-green-700 dark:from-green-700 dark:to-green-800"
      : "bg-gradient-to-br from-pink-500 to-pink-600 dark:from-pink-600 dark:to-pink-700";
    const ringColor = isBankAccount 
      ? "ring-green-200 dark:ring-green-800"
      : "ring-pink-200 dark:ring-pink-800";
    const hoverColor = isBankAccount
      ? "hover:from-green-700 hover:to-green-800 dark:hover:from-green-600 dark:hover:to-green-700"
      : "hover:from-pink-600 hover:to-pink-700 dark:hover:from-pink-500 dark:hover:to-pink-600";

    return (
      <Card 
        key={account.id} 
        className={cn(
          "border-2 shadow-lg hover:shadow-xl transition-all duration-200",
          isExpanded && showExpanded && `ring-2 ${ringColor}`
        )}
      >
        <CardHeader 
          className={cn(
            headerColor,
            "pb-3 px-4 pt-4 cursor-pointer transition-all duration-200 group"
          )}
          onClick={() => toggleAccountExpanded(account.id)}
        >
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-white text-base font-bold truncate flex-1">{account.name}</CardTitle>
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
              <div className="p-4 bg-gradient-to-br from-muted/40 to-muted/20">
                <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
                  {isBankAccount ? "Bank Balance" : "Credit Balance"}
                </p>
                <p className="text-xl md:text-2xl font-bold text-foreground">{formatCurrency(Number(account.balance))}</p>
              </div>
              <div 
                className="p-4 bg-gradient-to-br from-yellow-50/80 to-yellow-100/50 dark:from-yellow-900/20 dark:to-yellow-800/10 cursor-pointer hover:from-yellow-100 dark:hover:from-yellow-900/30 transition-all duration-200 group"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleExpensesExpanded(account.id);
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Coasting Expenses</p>
                    <p className={cn(
                      "text-base md:text-lg font-bold",
                      isBankAccount ? "text-red-600 dark:text-red-400" : "text-blue-600 dark:text-blue-400"
                    )}>
                      {expensesTotal > 0 
                        ? (isBankAccount ? `(${formatCurrency(expensesTotal)})` : `+${formatCurrency(expensesTotal)}`)
                        : '-'
                      }
                    </p>
                  </div>
                  {expenses.length > 0 && (
                    <div className="mt-1 transition-transform duration-200 group-hover:scale-110">
                      {expensesExpanded ? (
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      )}
                    </div>
                  )}
                </div>
                {expensesExpanded && expenses.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-yellow-200 dark:border-yellow-800 space-y-2 max-h-64 overflow-y-auto">
                    {expenses.map((expense) => (
                      <div key={expense.id} className="text-xs bg-white dark:bg-gray-800 p-2 rounded border border-yellow-200 dark:border-yellow-800">
                        <div className="flex justify-between items-start mb-1">
                          <span className="text-foreground font-medium truncate flex-1 mr-2">{expense.name}</span>
                          <span className={cn(
                            "font-bold whitespace-nowrap",
                            isBankAccount ? "text-red-600 dark:text-red-400" : "text-blue-600 dark:text-blue-400"
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
              <div className={cn(
                "p-4 bg-gradient-to-br",
                realBalance >= 0 && isBankAccount
                  ? "from-green-50 to-green-100/50 dark:from-green-900/20 dark:to-green-800/10" 
                  : "from-red-50 to-red-100/50 dark:from-red-900/20 dark:to-red-800/10"
              )}>
                <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
                  {isBankAccount ? "Real Balance" : "Real Credit Balance"}
                </p>
                <p className={cn(
                  "text-xl md:text-2xl font-bold",
                  realBalance >= 0 && isBankAccount 
                    ? "text-green-600 dark:text-green-400" 
                    : "text-red-600 dark:text-red-400"
                )}>
                  ${formatCurrency(Math.abs(realBalance))}
                </p>
              </div>
            </div>
          </CardContent>
        )}
      </Card>
    );
  };

  // Render total tab card
  const renderTotalTab = (isBankAccount: boolean) => {
    const totalBalance = isBankAccount ? totalBankBalance : totalCreditBalance;
    const totalExpenses = isBankAccount ? totalBankExpenses : totalCreditExpenses;
    const totalRealBalance = isBankAccount ? totalRealBankBalance : totalRealCreditBalance;
    const headerColor = isBankAccount
      ? "bg-gradient-to-br from-green-600 to-green-700 dark:from-green-700 dark:to-green-800"
      : "bg-gradient-to-br from-pink-500 to-pink-600 dark:from-pink-600 dark:to-pink-700";
    const expensesKey = isBankAccount ? "total-bank" : "total-credit";
    const filteredExpenses = isBankAccount
      ? coasterItems.filter(item => {
          if (!item.bank_account_id) return true;
          return bankAccounts.some(acc => acc.id === item.bank_account_id);
        })
      : coasterItems.filter(item => {
          if (!item.bank_account_id) return false;
          return creditAccounts.some(acc => acc.id === item.bank_account_id);
        });

    return (
      <Card className="border-2 shadow-lg hover:shadow-xl transition-shadow">
        <CardHeader className={cn(headerColor, "pb-3 px-4 pt-4")}>
          <CardTitle className="text-white text-base font-bold">Total Tab</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            <div className="p-4 bg-gradient-to-br from-muted/40 to-muted/20">
              <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
                {isBankAccount ? "Bank Balance" : "Credit Balance"}
              </p>
              <p className="text-xl md:text-2xl font-bold text-foreground">{formatCurrency(totalBalance)}</p>
            </div>
            <div 
              className="p-4 bg-gradient-to-br from-yellow-50/80 to-yellow-100/50 dark:from-yellow-900/20 dark:to-yellow-800/10 cursor-pointer hover:from-yellow-100 dark:hover:from-yellow-900/30 transition-all duration-200 group"
              onClick={() => {
                const newExpanded = new Set(expandedExpenses);
                if (newExpanded.has(expensesKey)) {
                  newExpanded.delete(expensesKey);
                } else {
                  newExpanded.add(expensesKey);
                }
                setExpandedExpenses(newExpanded);
              }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Coasting Expenses</p>
                  <p className={cn(
                    "text-base md:text-lg font-bold",
                    isBankAccount ? "text-red-600 dark:text-red-400" : "text-blue-600 dark:text-blue-400"
                  )}>
                    {isBankAccount 
                      ? `(${formatCurrency(totalExpenses)})`
                      : `+${formatCurrency(totalExpenses)}`
                    }
                  </p>
                </div>
                <div className="mt-1 transition-transform duration-200 group-hover:scale-110">
                  {expandedExpenses.has(expensesKey) ? (
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  )}
                </div>
              </div>
              {expandedExpenses.has(expensesKey) && (
                <div className="mt-3 pt-3 border-t border-yellow-200 dark:border-yellow-800 space-y-2 max-h-64 overflow-y-auto">
                  {filteredExpenses.length > 0 ? (
                    filteredExpenses.map((expense) => (
                      <div key={expense.id} className="text-xs bg-white dark:bg-gray-800 p-2 rounded border border-yellow-200 dark:border-yellow-800">
                        <div className="flex justify-between items-start mb-1">
                          <span className="text-foreground font-medium truncate flex-1 mr-2">{expense.name}</span>
                          <span className={cn(
                            "font-bold whitespace-nowrap",
                            isBankAccount ? "text-red-600 dark:text-red-400" : "text-blue-600 dark:text-blue-400"
                          )}>
                            {formatCurrency(Number(expense.amount))}
                          </span>
                        </div>
                        <div className="text-muted-foreground text-[10px]">
                          {format(new Date(expense.expense_date), "MMM d, yyyy")}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-muted-foreground italic">No expenses</p>
                  )}
                </div>
              )}
            </div>
            <div className={cn(
              "p-4 bg-gradient-to-br",
              totalRealBalance >= 0 && isBankAccount
                ? "from-green-50 to-green-100/50 dark:from-green-900/20 dark:to-green-800/10" 
                : "from-red-50 to-red-100/50 dark:from-red-900/20 dark:to-red-800/10"
            )}>
              <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
                {isBankAccount ? "Real Balance" : "Real Credit Balance"}
              </p>
              <p className={cn(
                "text-xl md:text-2xl font-bold",
                totalRealBalance >= 0 && isBankAccount 
                  ? "text-green-600 dark:text-green-400" 
                  : "text-red-600 dark:text-red-400"
              )}>
                ${formatCurrency(Math.abs(totalRealBalance))}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 p-4 md:p-6">
      <div className="space-y-2">
        <h1 className="text-3xl md:text-4xl font-bold text-foreground">Real Bank Tab 💰</h1>
        <p className="text-muted-foreground text-sm md:text-base">
          Your actual spending power after accounting for all accounts and expenses.
        </p>
      </div>

      {/* My Tab Section */}
      {bankAccounts.length > 0 && (
        <div className="space-y-5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <Wallet className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <h2 className="text-2xl md:text-3xl font-bold">My Tab</h2>
          </div>

          {/* Total Tab - Full Width */}
          <div className="w-full">
            {renderTotalTab(true)}
          </div>

          {/* Individual Bank Accounts - Responsive Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {bankAccounts.map((account) => renderAccountCard(account, true, true))}
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
      {creditAccounts.length > 0 && (
        <div className="space-y-5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-pink-100 dark:bg-pink-900/30 rounded-lg">
              <CreditCard className="w-5 h-5 text-pink-600 dark:text-pink-400" />
            </div>
            <h2 className="text-2xl md:text-3xl font-bold">My Credit Tab</h2>
          </div>

          {/* Total Tab - Full Width */}
          <div className="w-full">
            {renderTotalTab(false)}
          </div>

          {/* Individual Credit Accounts - Responsive Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {creditAccounts.map((account) => renderAccountCard(account, false, true))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {bankAccounts.length === 0 && creditAccounts.length === 0 && (
        <Card className="border-2 shadow-lg">
          <CardContent className="py-16 text-center">
            <p className="text-muted-foreground">
              No bank accounts found. Add accounts in the Bank Tab.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default RealBank;
