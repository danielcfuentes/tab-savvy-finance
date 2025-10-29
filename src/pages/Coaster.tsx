import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Trash2, Calendar as CalendarIcon, TrendingDown, TrendingUp } from "lucide-react";
import { format, startOfToday, addDays, differenceInDays } from "date-fns";
import { cn } from "@/lib/utils";
import { getRealBankBalance, getCoastingDays, getDailyBudget, getSpendingPace, getNextIncomeDue } from "@/lib/calculations";
import type { BankAccount, CoasterItem, IncomeItem } from "@/lib/calculations";

const Coaster = () => {
  const [coasterItems, setCoasterItems] = useState<CoasterItem[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [incomes, setIncomes] = useState<IncomeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [expenseDate, setExpenseDate] = useState<Date>(new Date());
  const [formData, setFormData] = useState({
    name: "",
    amount: "",
    bank_account_id: "",
    category: "General",
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    
    const [coasterRes, accountsRes, incomesRes] = await Promise.all([
      supabase
        .from("coaster_items")
        .select("*")
        .order("expense_date", { ascending: false }),
      supabase.from("bank_accounts").select("id, name, balance"),
      supabase.from("income").select("*").order("due_date", { ascending: true }),
    ]);

    if (coasterRes.error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch expenses",
      });
    } else {
      setCoasterItems(coasterRes.data || []);
    }

    if (accountsRes.error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch accounts",
      });
    } else {
      setBankAccounts(accountsRes.data || []);
    }

    if (incomesRes.error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch income",
      });
    } else {
      setIncomes(incomesRes.data || []);
    }

    setLoading(false);
  };

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { error } = await supabase.from("coaster_items").insert({
      user_id: session.user.id,
      name: formData.name,
      amount: parseFloat(formData.amount),
      expense_date: expenseDate.toISOString(),
      bank_account_id: formData.bank_account_id || null,
      category: formData.category,
    });

    if (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to add expense",
      });
    } else {
      toast({
        title: "Success! 🍺",
        description: "Expense added",
      });
      setDialogOpen(false);
      setFormData({ name: "", amount: "", bank_account_id: "", category: "General" });
      fetchData();
    }
  };

  const handleDeleteExpense = async (id: string) => {
    const { error } = await supabase.from("coaster_items").delete().eq("id", id);

    if (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete expense",
      });
    } else {
      toast({
        title: "Deleted",
        description: "Expense removed",
      });
      fetchData();
    }
  };

  const realBalance = getRealBankBalance(bankAccounts, coasterItems);
  const nextIncome = getNextIncomeDue(incomes);
  const coastingDays = getCoastingDays(nextIncome);
  const dailyBudget = getDailyBudget(realBalance, coastingDays);
  const spendingPace = getSpendingPace(coasterItems, dailyBudget, coastingDays);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  const progressPercentage = coastingDays > 0 && spendingPace.projectedSpend > 0
    ? Math.min(100, (spendingPace.spentTotal / spendingPace.projectedSpend) * 100)
    : 0;

  const categories = ["General", "Food", "Transport", "Entertainment", "Shopping", "Bills", "Other"];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <Loader2 className="w-8 h-8 animate-spin text-secondary" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Coaster Tab 🍻</h1>
          <p className="text-muted-foreground">Track your daily spending</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="secondary">
              <Plus className="w-4 h-4 mr-2" />
              Add Expense
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add Expense</DialogTitle>
              <DialogDescription>Track your daily spending</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddExpense} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Coasting Expense</Label>
                <Input
                  id="name"
                  placeholder="Coffee, Lunch, Gas, etc."
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="amount">Coasting Expense Amount</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Coaster Item Expense Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !expenseDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {expenseDate ? format(expenseDate, "PPP") : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={expenseDate}
                      onSelect={(date) => date && setExpenseDate(date)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label htmlFor="bank_account">Bank Account</Label>
                <Select
                  value={formData.bank_account_id || undefined}
                  onValueChange={(value) => setFormData({ ...formData, bank_account_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select account" />
                  </SelectTrigger>
                  <SelectContent>
                    {bankAccounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Category (Optional)</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) => setFormData({ ...formData, category: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full" variant="secondary">
                Add Expense 🍺
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Bar */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className={cn(
          "border-2",
          realBalance >= 0 ? "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800" 
          : "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800"
        )}>
          <CardHeader className="pb-2">
            <CardTitle className={cn(
              "text-lg md:text-xl",
              realBalance >= 0 ? "text-green-700 dark:text-green-300" : "text-red-700 dark:text-red-300"
            )}>
              💰 Real Bank Balance
            </CardTitle>
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

        <Card className="border-2">
          <CardHeader>
            <CardTitle className="text-lg">📅 Coasting Calendar</CardTitle>
            <CardDescription className="text-sm text-muted-foreground">
              {coastingDays} day{coastingDays !== 1 ? 's' : ''} until next paycheck
              <span className="block mt-1">💡 Click on any day to add an expense</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Calendar
              mode="single"
              modifiers={{
                coastingDays: nextIncome ? (() => {
                  const days: Date[] = [];
                  const today = new Date();
                  const endDate = new Date(nextIncome);
                  today.setHours(0, 0, 0, 0);
                  endDate.setHours(0, 0, 0, 0);
                  
                  for (let d = new Date(today); d <= endDate; d.setDate(d.getDate() + 1)) {
                    days.push(new Date(d));
                  }
                  return days;
                })() : [],
                nextPayday: nextIncome ? [new Date(nextIncome)] : [],
              }}
              modifiersClassNames={{
                coastingDays: "bg-secondary/20 text-secondary rounded-full",
                nextPayday: "bg-secondary text-secondary-foreground rounded-full font-bold ring-2 ring-secondary",
              }}
              disabled={(date) => {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                date.setHours(0, 0, 0, 0);
                // Allow dates from today up to next payday (or 30 days if no income set)
                const maxDate = nextIncome || new Date();
                if (nextIncome) {
                  maxDate.setHours(0, 0, 0, 0);
                  return date < today || date > maxDate;
                }
                maxDate.setDate(maxDate.getDate() + 30);
                return date < today || date > maxDate;
              }}
              onSelect={(date) => {
                if (date && (!nextIncome || date <= nextIncome)) {
                  setExpenseDate(date);
                  setDialogOpen(true);
                }
              }}
              className="cursor-pointer"
            />
          </CardContent>
        </Card>
      </div>

      {/* Daily Budget and Progress */}
      {coastingDays > 0 && (
        <Card className="border-2">
          <CardHeader>
            <CardTitle>Daily Budget Dashboard</CardTitle>
            <CardDescription>
              Track your spending pace
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Daily Budget</p>
                <p className="text-xl font-bold text-foreground">
                  ${formatCurrency(dailyBudget)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Spent Today</p>
                <p className="text-xl font-bold text-foreground">
                  ${formatCurrency(spendingPace.spentToday)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Total Spent</p>
                <p className="text-xl font-bold text-foreground">
                  ${formatCurrency(spendingPace.spentTotal)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Status</p>
                <div className="flex items-center gap-2">
                  {spendingPace.isOnTrack ? (
                    <TrendingUp className="w-5 h-5 text-green-600" />
                  ) : (
                    <TrendingDown className="w-5 h-5 text-red-600" />
                  )}
                  <p className={cn(
                    "text-lg font-bold",
                    spendingPace.isOnTrack ? "text-green-600" : "text-red-600"
                  )}>
                    {spendingPace.isOnTrack ? "On Track" : "Over Budget"}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Spending Progress</span>
                <span className="text-muted-foreground">
                  {formatCurrency(spendingPace.spentTotal)} / {formatCurrency(spendingPace.projectedSpend)}
                </span>
              </div>
              <Progress value={progressPercentage} className="h-3" />
            </div>
          </CardContent>
        </Card>
      )}

      {coasterItems.length === 0 ? (
        <Card className="border-2">
          <CardContent className="py-16 text-center">
            <p className="text-muted-foreground mb-4">
              No expenses yet — coast smart until next payday 🪙
            </p>
            <Button variant="secondary" onClick={() => setDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Your First Expense
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {coasterItems.map((item) => (
            <Card key={item.id} className="border-2 hover:shadow-card-hover transition-smooth">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <CardTitle>{item.name}</CardTitle>
                      <Badge variant="secondary">{item.category || "General"}</Badge>
                    </div>
                    <CardDescription>
                      {format(new Date(item.expense_date), "PPP")}
                      {item.bank_account_id && bankAccounts.find(acc => acc.id === item.bank_account_id) && (
                        ` • ${bankAccounts.find(acc => acc.id === item.bank_account_id)?.name}`
                      )}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="text-xl font-bold text-foreground">
                      ${formatCurrency(Number(item.amount))}
                    </p>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteExpense(item.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default Coaster;
