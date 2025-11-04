import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { getRealBankBalance } from "@/lib/calculations";
import type { BankAccount, CoasterItem } from "@/lib/calculations";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type BankAccountWithType = BankAccount & {
  account_type: string;
};

const RealBank = () => {
  const [accounts, setAccounts] = useState<BankAccountWithType[]>([]);
  const [coasterItems, setCoasterItems] = useState<CoasterItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const userEmail = session?.user?.email;
      
      if (userEmail !== "dani@gmail.com") {
        toast({
          variant: "destructive",
          title: "Access Denied",
          description: "This page is restricted.",
        });
        navigate("/dashboard");
        return;
      }
      
      setCheckingAuth(false);
      fetchData();
    };

    checkAuth();
  }, [navigate, toast]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch bank accounts
      const { data: accountsData, error: accountsError } = await supabase
        .from("bank_accounts")
        .select("*")
        .order("created_at", { ascending: true });

      if (accountsError) throw accountsError;

      // Fetch coaster items
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

  const formatAccountType = (type: string) => {
    return type.split("_").map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
  };

  // Separate accounts by type
  const bankAccounts = accounts.filter(acc => 
    ['checking', 'savings', 'digital_wallet'].includes(acc.account_type?.toLowerCase() || '')
  );
  const creditAccounts = accounts.filter(acc => 
    ['credit_card', 'loan'].includes(acc.account_type?.toLowerCase() || '')
  );

  // Calculate totals
  const totalBankBalance = bankAccounts.reduce((sum, account) => sum + Number(account.balance), 0);
  const totalCreditBalance = creditAccounts.reduce((sum, account) => sum + Number(account.balance), 0);
  const totalExpenses = coasterItems.reduce((sum, item) => sum + Number(item.amount), 0);
  const realBalance = getRealBankBalance(accounts as BankAccount[], coasterItems);

  if (checkingAuth || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Real Bank Tab 💰</h1>
        <p className="text-muted-foreground">Your actual spending power after accounting for all accounts and expenses.</p>
      </div>

      {/* Real Bank Balance Summary */}
      <Card className={cn(
        "border-2",
        realBalance >= 0 ? "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800" 
        : "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800"
      )}>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2 flex-wrap">
            <CardTitle className={cn(
              "text-lg md:text-xl",
              realBalance >= 0 ? "text-green-700 dark:text-green-300" : "text-red-700 dark:text-red-300"
            )}>
              💰 Real Bank Balance
            </CardTitle>
            <Popover>
              <PopoverTrigger asChild>
                <button type="button" className="touch-manipulation">
                  <Info className="w-4 h-4 text-muted-foreground cursor-pointer hover:text-foreground" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="max-w-[300px] text-sm" align="start">
                <p className="font-semibold mb-2">Real Bank Balance</p>
                <p>
                  Real Bank Balance is your actual spending power — what's left in your accounts after subtracting credit balances and all Coasting Expenses.
                </p>
                <p className="mt-3 text-xs text-muted-foreground">
                  Calculation: (Bank Accounts) - (Credit Accounts) - (All Coasting Expenses)
                </p>
              </PopoverContent>
            </Popover>
          </div>
          <CardDescription>
            Your actual spending power
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className={cn(
            "text-xl md:text-3xl font-bold break-words",
            realBalance >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
          )}>
            ${formatCurrency(Math.abs(realBalance))}
            {realBalance < 0 && " ⚠️"}
          </p>
        </CardContent>
      </Card>

      {/* Account Breakdown */}
      <div className="space-y-4">
        {/* Bank Accounts */}
        {bankAccounts.length > 0 && (
          <Card className="border-2">
            <CardHeader>
              <CardTitle className="text-lg md:text-xl">Bank Accounts</CardTitle>
              <CardDescription>
                Total: ${formatCurrency(totalBankBalance)}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {bankAccounts.map((account) => (
                <div key={account.id} className="flex justify-between items-center py-2 border-b last:border-0">
                  <div className="flex-1">
                    <p className="font-medium">{account.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatAccountType(account.account_type)}
                    </p>
                  </div>
                  <p className="text-lg font-semibold text-green-600 dark:text-green-400">
                    ${formatCurrency(Number(account.balance))}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Credit Accounts */}
        {creditAccounts.length > 0 && (
          <Card className="border-2">
            <CardHeader>
              <CardTitle className="text-lg md:text-xl">Credit Accounts</CardTitle>
              <CardDescription>
                Total: ${formatCurrency(totalCreditBalance)} (subtracted)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {creditAccounts.map((account) => (
                <div key={account.id} className="flex justify-between items-center py-2 border-b last:border-0">
                  <div className="flex-1">
                    <p className="font-medium">{account.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatAccountType(account.account_type)}
                    </p>
                  </div>
                  <p className="text-lg font-semibold text-red-600 dark:text-red-400">
                    ${formatCurrency(Number(account.balance))}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Expenses */}
        {coasterItems.length > 0 && (
          <Card className="border-2">
            <CardHeader>
              <CardTitle className="text-lg md:text-xl">Coasting Expenses</CardTitle>
              <CardDescription>
                Total: ${formatCurrency(totalExpenses)} (subtracted)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {coasterItems.length} expense{coasterItems.length !== 1 ? 's' : ''} scheduled
              </p>
            </CardContent>
          </Card>
        )}

        {/* Calculation Breakdown */}
        <Card className="border-2 bg-muted/50">
          <CardHeader>
            <CardTitle className="text-lg md:text-xl">Calculation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Bank Accounts:</span>
              <span className="font-medium text-green-600 dark:text-green-400">
                +${formatCurrency(totalBankBalance)}
              </span>
            </div>
            {creditAccounts.length > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Credit Accounts:</span>
                <span className="font-medium text-red-600 dark:text-red-400">
                  -${formatCurrency(totalCreditBalance)}
                </span>
              </div>
            )}
            {coasterItems.length > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Coasting Expenses:</span>
                <span className="font-medium text-red-600 dark:text-red-400">
                  -${formatCurrency(totalExpenses)}
                </span>
              </div>
            )}
            <div className="flex justify-between pt-2 border-t font-bold text-lg">
              <span>Real Bank Balance:</span>
              <span className={cn(
                realBalance >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
              )}>
                ${formatCurrency(Math.abs(realBalance))}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default RealBank;

