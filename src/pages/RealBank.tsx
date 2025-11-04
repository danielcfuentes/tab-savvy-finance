import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Wallet, CreditCard, TrendingDown, TrendingUp, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

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
  const totalBankExpenses = bankAccounts.reduce((sum, account) => sum + getExpensesByAccount(account.id), 0) + unallocatedExpenses;
  const totalRealBankBalance = totalBankBalance - totalBankExpenses;

  const totalCreditBalance = creditAccounts.reduce((sum, account) => sum + Number(account.balance), 0);
  const totalCreditExpenses = creditAccounts.reduce((sum, account) => sum + getExpensesByAccount(account.id), 0);
  const totalRealCreditBalance = totalCreditBalance + totalCreditExpenses;

  // Overall real balance (bank - credit)
  const overallRealBalance = totalRealBankBalance - totalCreditBalance;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 p-4">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Real Bank Tab 💰</h1>
        <p className="text-muted-foreground">Your actual spending power after accounting for all accounts and expenses.</p>
      </div>

      {/* Overall Summary */}
      <Card className={cn(
        "border-2",
        overallRealBalance >= 0 
          ? "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800" 
          : "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800"
      )}>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Overall Real Balance</p>
              <p className={cn(
                "text-3xl font-bold",
                overallRealBalance >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
              )}>
                ${formatCurrency(Math.abs(overallRealBalance))}
              </p>
            </div>
            {overallRealBalance < 0 && (
              <AlertCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
            )}
          </div>
        </CardContent>
      </Card>

      {/* Bank Accounts Section */}
      {bankAccounts.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Wallet className="w-5 h-5 text-green-600 dark:text-green-400" />
            <h2 className="text-2xl font-bold">Bank Accounts</h2>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border-2">
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground mb-1">Total Balance</p>
                <p className="text-2xl font-bold">{formatCurrency(totalBankBalance)}</p>
              </CardContent>
            </Card>
            <Card className="border-2">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingDown className="w-4 h-4 text-red-600 dark:text-red-400" />
                  <p className="text-sm text-muted-foreground">Coasting Expenses</p>
                </div>
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                  {formatCurrency(totalBankExpenses)}
                </p>
              </CardContent>
            </Card>
            <Card className={cn(
              "border-2",
              totalRealBankBalance >= 0 
                ? "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800" 
                : "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800"
            )}>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground mb-1">Real Bank Balance</p>
                <p className={cn(
                  "text-2xl font-bold",
                  totalRealBankBalance >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                )}>
                  ${formatCurrency(Math.abs(totalRealBankBalance))}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Individual Accounts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {bankAccounts.map((account) => {
              const expenses = getExpensesByAccount(account.id);
              const realBalance = Number(account.balance) - expenses;
              
              return (
                <Card key={account.id} className="border-2 hover:shadow-lg transition-shadow">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">{account.name}</CardTitle>
                    <p className="text-sm text-muted-foreground capitalize">
                      {account.account_type.replace('_', ' ')}
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Bank Balance</span>
                      <span className="text-lg font-semibold">{formatCurrency(Number(account.balance))}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Coasting Expenses</span>
                      <span className="text-lg font-semibold text-red-600 dark:text-red-400">
                        {expenses > 0 ? `(${formatCurrency(expenses)})` : '-'}
                      </span>
                    </div>
                    <div className="pt-2 border-t">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">Real Balance</span>
                        <span className={cn(
                          "text-xl font-bold",
                          realBalance >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                        )}>
                          ${formatCurrency(Math.abs(realBalance))}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {unallocatedExpenses > 0 && (
            <Card className="border-2 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800">
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">
                  <span className="font-semibold">Note:</span> ${formatCurrency(unallocatedExpenses)} in unallocated expenses included in Total
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Credit Accounts Section */}
      {creditAccounts.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-pink-600 dark:text-pink-400" />
            <h2 className="text-2xl font-bold">Credit Accounts</h2>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border-2">
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground mb-1">Total Credit Balance</p>
                <p className="text-2xl font-bold">{formatCurrency(totalCreditBalance)}</p>
              </CardContent>
            </Card>
            <Card className="border-2">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <p className="text-sm text-muted-foreground">Coasting Expenses</p>
                </div>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  +{formatCurrency(totalCreditExpenses)}
                </p>
              </CardContent>
            </Card>
            <Card className="border-2 bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800">
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground mb-1">Real Credit Balance</p>
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                  ${formatCurrency(Math.abs(totalRealCreditBalance))}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Individual Accounts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {creditAccounts.map((account) => {
              const expenses = getExpensesByAccount(account.id);
              const realBalance = Number(account.balance) + expenses;
              
              return (
                <Card key={account.id} className="border-2 hover:shadow-lg transition-shadow">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">{account.name}</CardTitle>
                    <p className="text-sm text-muted-foreground capitalize">
                      {account.account_type.replace('_', ' ')}
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Credit Balance</span>
                      <span className="text-lg font-semibold">{formatCurrency(Number(account.balance))}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Coasting Expenses</span>
                      <span className="text-lg font-semibold text-blue-600 dark:text-blue-400">
                        {expenses > 0 ? `+${formatCurrency(expenses)}` : '-'}
                      </span>
                    </div>
                    <div className="pt-2 border-t">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">Real Balance</span>
                        <span className="text-xl font-bold text-red-600 dark:text-red-400">
                          ${formatCurrency(Math.abs(realBalance))}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty State */}
      {bankAccounts.length === 0 && creditAccounts.length === 0 && (
        <Card className="border-2">
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
