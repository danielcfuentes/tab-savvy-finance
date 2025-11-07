import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle2, Clock, ChevronDown, ChevronRight, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { getNextIncomeDue, type IncomeItem } from "@/lib/calculations";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type BankAccount = {
  id: string;
  name: string;
};

type Bill = {
  id: string;
  name: string;
  category: string;
  payment_date: string;
  payment_date_next: string | null;
  amount_now: number;
  amount_next: number;
  bank_account_id: string;
  scheduled_type: string;
  bank_accounts: BankAccount;
};

const CloseOut = () => {
  const [bills, setBills] = useState<Bill[]>([]);
  const [incomes, setIncomes] = useState<IncomeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedBills, setExpandedBills] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [billsRes, incomesRes] = await Promise.all([
        supabase
          .from("bills")
          .select("*, bank_accounts(id, name)")
          .order("payment_date", { ascending: true }),
        supabase
          .from("income")
          .select("*")
          .order("due_date", { ascending: true }),
      ]);

      if (billsRes.error) throw billsRes.error;
      if (incomesRes.error) throw incomesRes.error;

      setBills((billsRes.data || []) as Bill[]);
      
      // Map income data to match IncomeItem type
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

  // Get next paycheck date
  const nextPaycheckDate = getNextIncomeDue(incomes);
  
  // Helper to convert bill payment_date to Date
  const getBillPaymentDate = (bill: Bill): Date | null => {
    if (!bill.payment_date) return null;
    const date = new Date(bill.payment_date);
    date.setHours(0, 0, 0, 0);
    return date;
  };

  // Separate bills into Closed Out and Open
  const closedOutBills = bills.filter((bill) => {
    const billDate = getBillPaymentDate(bill);
    if (!billDate || !nextPaycheckDate) return false;
    return billDate < nextPaycheckDate;
  });

  const openBills = bills.filter((bill) => {
    const billDate = getBillPaymentDate(bill);
    if (!billDate || !nextPaycheckDate) return true; // If no next paycheck, treat as open
    return billDate >= nextPaycheckDate;
  });

  // Calculate totals
  const totalClosedOut = closedOutBills.reduce(
    (sum, bill) => sum + Number(bill.amount_now),
    0
  );
  const totalOpen = openBills.reduce(
    (sum, bill) => sum + Number(bill.amount_now),
    0
  );

  const toggleBillExpanded = (billId: string) => {
    const newExpanded = new Set(expandedBills);
    if (newExpanded.has(billId)) {
      newExpanded.delete(billId);
    } else {
      newExpanded.add(billId);
    }
    setExpandedBills(newExpanded);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Render bill card component
  const renderBillCard = (bill: Bill, isClosedOut: boolean) => {
    const isExpanded = expandedBills.has(bill.id);
    const billDate = getBillPaymentDate(bill);
    const headerColor = isClosedOut
      ? "bg-gradient-to-br from-green-400 to-green-500 dark:from-green-500 dark:to-green-600"
      : "bg-gradient-to-br from-yellow-400 to-yellow-500 dark:from-yellow-500 dark:to-yellow-600";
    const ringColor = isClosedOut
      ? "ring-green-200 dark:ring-green-800"
      : "ring-yellow-200 dark:ring-yellow-800";

    return (
      <Card
        key={bill.id}
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
          onClick={() => toggleBillExpanded(bill.id)}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {isClosedOut ? (
                <CheckCircle2 className="w-5 h-5 text-white flex-shrink-0" />
              ) : (
                <Clock className="w-5 h-5 text-white flex-shrink-0" />
              )}
              <CardTitle className="text-white text-base font-bold truncate">
                {bill.name}
              </CardTitle>
            </div>
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
                  Amount
                </p>
                <p className="text-xl md:text-2xl font-bold text-foreground">
                  ${formatCurrency(Number(bill.amount_now))}
                </p>
              </div>
              <div className="p-4 bg-gradient-to-br from-muted/30 to-muted/10">
                <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
                  Due Date
                </p>
                <p className="text-base font-semibold text-foreground">
                  {billDate ? format(billDate, "MMM d, yyyy") : "No date"}
                </p>
              </div>
              <div className="p-4 bg-gradient-to-br from-muted/30 to-muted/10">
                <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
                  Paid From Account
                </p>
                <p className="text-base font-semibold text-foreground">
                  {bill.bank_accounts.name}
                </p>
              </div>
              <div className="p-4 bg-gradient-to-br from-muted/30 to-muted/10">
                <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
                  Category
                </p>
                <p className="text-base font-semibold text-foreground">
                  {bill.category}
                </p>
              </div>
              <div className={cn(
                "p-4 bg-gradient-to-br",
                isClosedOut
                  ? "from-green-50 to-green-100/50 dark:from-green-900/20 dark:to-green-800/10"
                  : "from-yellow-50 to-yellow-100/50 dark:from-yellow-900/20 dark:to-yellow-800/10"
              )}>
                <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
                  Status
                </p>
                <p className={cn(
                  "text-lg font-bold",
                  isClosedOut
                    ? "text-green-600 dark:text-green-400"
                    : "text-yellow-600 dark:text-yellow-400"
                )}>
                  {isClosedOut ? "Closed Out" : "Open"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {isClosedOut
                    ? "Due before next paycheck"
                    : "Due on or after next paycheck"}
                </p>
              </div>
            </div>
          </CardContent>
        )}
      </Card>
    );
  };

  // Render total summary card
  const renderTotalCard = (isClosedOut: boolean) => {
    const total = isClosedOut ? totalClosedOut : totalOpen;
    const count = isClosedOut ? closedOutBills.length : openBills.length;
    const headerColor = isClosedOut
      ? "bg-gradient-to-br from-green-600 to-green-700 dark:from-green-700 dark:to-green-800"
      : "bg-gradient-to-br from-yellow-500 to-yellow-600 dark:from-yellow-600 dark:to-yellow-700";

    return (
      <Card className="border-2 shadow-lg hover:shadow-xl transition-shadow">
        <CardHeader className={cn(headerColor, "pb-3 px-4 pt-4")}>
          <div className="flex items-center gap-2">
            {isClosedOut ? (
              <CheckCircle2 className="w-5 h-5 text-white" />
            ) : (
              <Clock className="w-5 h-5 text-white" />
            )}
            <CardTitle className="text-white text-base font-bold">
              {isClosedOut ? "Total Closed Out" : "Total Open"}
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            <div className="p-4 bg-gradient-to-br from-muted/40 to-muted/20">
              <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
                Total Amount
              </p>
              <p className="text-2xl md:text-3xl font-bold text-foreground">
                ${formatCurrency(total)}
              </p>
            </div>
            <div className="p-4 bg-gradient-to-br from-muted/30 to-muted/10">
              <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
                Number of Bills
              </p>
              <p className="text-xl font-bold text-foreground">{count}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 p-4 md:p-6">
      <div className="space-y-2">
        <h1 className="text-3xl md:text-4xl font-bold text-foreground">
          Close Out Tab ✅
        </h1>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <p className="text-muted-foreground text-sm md:text-base">
              Track which bills have been completed for the current pay period and
              which ones are still pending.
            </p>
            {nextPaycheckDate && (
              <p className="text-sm text-muted-foreground mt-1">
                Next paycheck: {format(nextPaycheckDate, "MMM d, yyyy")}
              </p>
            )}
          </div>
          {nextPaycheckDate && (
            <Popover>
              <PopoverTrigger asChild>
                <button className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0">
                  <Info className="w-5 h-5" />
                </button>
              </PopoverTrigger>
              <PopoverContent side="left" className="max-w-xs">
                <p className="font-semibold mb-1">FYI: Close Out Tab Logic</p>
                <p className="text-sm">
                  Bills before your next paycheck date ({format(nextPaycheckDate, "MMM d")}) are considered to be <span className="font-semibold text-green-600">closed</span>. Bills on or after your next pay date are <span className="font-semibold text-yellow-600">open</span>.
                </p>
              </PopoverContent>
            </Popover>
          )}
        </div>
      </div>

      {/* Closed Out Bills Section */}
      {closedOutBills.length > 0 && (
        <div className="space-y-5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <h2 className="text-2xl md:text-3xl font-bold">
              Closed Out Bills
            </h2>
          </div>

          {/* Total Closed Out - Full Width */}
          <div className="w-full">
            {renderTotalCard(true)}
          </div>

          {/* Individual Closed Out Bills - Responsive Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {closedOutBills.map((bill) => renderBillCard(bill, true))}
          </div>
        </div>
      )}

      {/* Open Bills Section */}
      {openBills.length > 0 && (
        <div className="space-y-5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
              <Clock className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
            </div>
            <h2 className="text-2xl md:text-3xl font-bold">Open Bills</h2>
          </div>

          {/* Total Open - Full Width */}
          <div className="w-full">
            {renderTotalCard(false)}
          </div>

          {/* Individual Open Bills - Responsive Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {openBills.map((bill) => renderBillCard(bill, false))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {bills.length === 0 && (
        <Card className="border-2 shadow-lg">
          <CardContent className="py-16 text-center">
            <p className="text-muted-foreground">
              No bills found. Add bills in the Bills Tab.
            </p>
          </CardContent>
        </Card>
      )}

      {/* No Next Paycheck Warning */}
      {!nextPaycheckDate && bills.length > 0 && (
        <Card className="border-2 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 shadow-sm">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold text-amber-900 dark:text-amber-200">
                Note:
              </span>{" "}
              No upcoming paycheck found. Add income in the Income Tab to
              categorize bills as closed out or open.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default CloseOut;
