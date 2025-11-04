import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Trash2, Edit2, Calendar as CalendarIcon, Info } from "lucide-react";
import { format, startOfToday, startOfDay, startOfMonth, differenceInDays, isToday, isPast, isFuture } from "date-fns";
import { cn } from "@/lib/utils";
import { getCoastingDays, getNextIncomeDue } from "@/lib/calculations";
import type { BankAccount, CoasterItem, IncomeItem } from "@/lib/calculations";

const Coaster = () => {
  const [coasterItems, setCoasterItems] = useState<CoasterItem[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [incomes, setIncomes] = useState<IncomeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<CoasterItem | null>(null);
  const [expenseDate, setExpenseDate] = useState<Date>(new Date());
  const [calendarMonth, setCalendarMonth] = useState<Date>(startOfMonth(startOfToday()));
  const lastCheckedDateRef = useRef<string>(startOfToday().toDateString());
  const [formData, setFormData] = useState({
    name: "",
    amount: "",
    bank_account_id: "",
    category: "General",
    repeatDaily: false,
  });
  const { toast } = useToast();

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
      // Map the data to include due_date_next if missing
      const mappedIncomes = (incomesRes.data || []).map((income: any) => ({
        ...income,
        due_date_next: income.due_date_next || null,
        due_date: income.due_date || null,
      }));
      setIncomes(mappedIncomes);
    }

    setLoading(false);
  };

  // Initial data fetch
  useEffect(() => {
    fetchData();
  }, []);

  // Automatically update countdown daily - check if date has changed
  useEffect(() => {
    const checkDateChange = () => {
      const today = startOfToday().toDateString();
      const lastChecked = lastCheckedDateRef.current;
      
      // If date has changed (new day), refetch data to update countdown
      if (today !== lastChecked) {
        lastCheckedDateRef.current = today;
        fetchData();
      }
    };

    // Check immediately on mount, then set up interval to check every minute
    checkDateChange();
    const interval = setInterval(checkDateChange, 60000); // Check every minute

    return () => clearInterval(interval);
  }, []); // Empty deps - we use refs to track state

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();

    // If editing, use update handler instead
    if (editingExpense) {
      await handleUpdateExpense(e);
      return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    try {
      const today = startOfToday();
      const nextIncomeDate = getNextIncomeDue(incomes);
      
      // If repeatDaily is checked, create expenses for every day in the coasting period (excluding payday)
      if (formData.repeatDaily && nextIncomeDate) {
        const expensesToCreate: any[] = [];
        const endDate = new Date(nextIncomeDate);
        endDate.setHours(0, 0, 0, 0);
        
        // Create an expense for each day from today to day before next paycheck (exclude payday)
        for (let d = new Date(today); d < endDate; d.setDate(d.getDate() + 1)) {
          const dayDate = new Date(d);
          dayDate.setHours(0, 0, 0, 0);
          
          const basePayload: any = {
            user_id: session.user.id,
            name: formData.name,
            amount: parseFloat(formData.amount),
            expense_date: dayDate.toISOString(),
          };

          const withOptional: any = { ...basePayload };
          if (formData.bank_account_id) withOptional.bank_account_id = formData.bank_account_id;
          if (formData.category) withOptional.category = formData.category;
          
          expensesToCreate.push(withOptional);
        }

        // Insert all expenses at once
        const { error } = await supabase.from("coaster_items").insert(expensesToCreate);

        if (error) {
          throw error;
        }

        toast({
          title: "Success! 🍺",
          description: `Added ${expensesToCreate.length} recurring expenses`,
        });
        setDialogOpen(false);
        setFormData({ name: "", amount: "", bank_account_id: "", category: "General", repeatDaily: false });
        fetchData();
      } else {
        // Single expense - original behavior
        const basePayload: any = {
          user_id: session.user.id,
          name: formData.name,
          amount: parseFloat(formData.amount),
          expense_date: expenseDate.toISOString(),
        };

        const withOptional: any = { ...basePayload };
        if (formData.bank_account_id) withOptional.bank_account_id = formData.bank_account_id;
        if (formData.category) withOptional.category = formData.category;

        let { error } = await supabase.from("coaster_items").insert(withOptional);

        // If backend schema doesn't have one of the optional columns, retry by stripping only that column
        if (error && error.code === "PGRST204") {
          const message = String(error.message || "");
          const retryPayload: any = { ...withOptional };
          if (message.includes("bank_account_id")) delete retryPayload.bank_account_id;
          if (message.includes("category")) delete retryPayload.category;
          const retry = await supabase.from("coaster_items").insert(retryPayload);
          error = retry.error;
        }

        if (error) {
          throw error;
        }

        toast({
          title: "Success! 🍺",
          description: "Expense added",
        });
        setDialogOpen(false);
        setFormData({ name: "", amount: "", bank_account_id: "", category: "General", repeatDaily: false });
        fetchData();
      }
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: err?.message || "Failed to add expense",
      });
      console.error("Failed to add expense:", err);
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

  const handleDeleteExpenseGroup = async (expenseGroup: CoasterItem[]) => {
    const ids = expenseGroup.map(expense => expense.id);
    const { error } = await supabase.from("coaster_items").delete().in("id", ids);

    if (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete expenses",
      });
    } else {
      toast({
        title: "Deleted",
        description: `${expenseGroup.length} expense${expenseGroup.length > 1 ? 's' : ''} removed`,
      });
      fetchData();
    }
  };

  const handleEditExpense = (expense: CoasterItem) => {
    setEditingExpense(expense);
    
    // Check if this expense is part of a recurring group
    const matchingExpenses = coasterItems.filter(item => 
      item.name === expense.name &&
      item.amount === expense.amount &&
      (item as any).category === ((expense as any).category || "General") &&
      item.bank_account_id === expense.bank_account_id
    );
    
    const isRecurring = matchingExpenses.length > 1;
    
    setFormData({
      name: expense.name,
      amount: expense.amount.toString(),
      bank_account_id: expense.bank_account_id || "",
      category: (expense as any).category || "General",
      repeatDaily: isRecurring, // Set to true if it's part of a recurring group
    });
    setExpenseDate(new Date(expense.expense_date));
    setDialogOpen(true);
  };

  const handleUpdateExpense = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!editingExpense) return;

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    try {
      // Find all expenses in the same group (for recurring expenses)
      const matchingExpenses = coasterItems.filter(item => 
        item.name === editingExpense.name &&
        item.amount === editingExpense.amount &&
        (item as any).category === ((editingExpense as any).category || "General") &&
        item.bank_account_id === editingExpense.bank_account_id
      );

      const wasRecurring = matchingExpenses.length > 1;
      const isNowRecurring = formData.repeatDaily;

      // If changing from recurring to one-time
      if (wasRecurring && !isNowRecurring) {
        // Delete all expenses in the group
        const ids = matchingExpenses.map(exp => exp.id);
        await supabase.from("coaster_items").delete().in("id", ids);

        // Create a single expense with the updated data
        const basePayload: any = {
          name: formData.name,
          amount: parseFloat(formData.amount),
          expense_date: expenseDate.toISOString(),
        };

        const withOptional: any = { ...basePayload };
        if (formData.bank_account_id) withOptional.bank_account_id = formData.bank_account_id;
        if (formData.category) withOptional.category = formData.category;

        await supabase.from("coaster_items").insert({
          ...withOptional,
          user_id: session.user.id,
        });

        toast({
          title: "Updated!",
          description: "Converted to one-time expense",
        });
      }
      // If changing from one-time to recurring
      else if (!wasRecurring && isNowRecurring && nextIncome) {
        // Delete the single expense
        await supabase.from("coaster_items").delete().eq("id", editingExpense.id);

        // Create recurring expenses for remaining days (excluding payday)
        const today = startOfToday();
        const endDate = new Date(nextIncome);
        today.setHours(0, 0, 0, 0);
        endDate.setHours(0, 0, 0, 0);

        const expensesToCreate = [];
        // Exclude payday - create expenses from today to day before payday
        for (let d = new Date(today); d < endDate; d.setDate(d.getDate() + 1)) {
          const expenseDate = new Date(d);
          expenseDate.setHours(0, 0, 0, 0);

          const basePayload: any = {
            user_id: session.user.id,
            name: formData.name,
            amount: parseFloat(formData.amount),
            expense_date: expenseDate.toISOString(),
          };

          const withOptional: any = { ...basePayload };
          if (formData.bank_account_id) withOptional.bank_account_id = formData.bank_account_id;
          if (formData.category) withOptional.category = formData.category;

          expensesToCreate.push(withOptional);
        }

        await supabase.from("coaster_items").insert(expensesToCreate);

        toast({
          title: "Updated!",
          description: `Converted to recurring expense for ${expensesToCreate.length} days`,
        });
      }
      // If staying as recurring (just updating the group)
      else if (wasRecurring && isNowRecurring) {
        // Update all expenses in the group
        const ids = matchingExpenses.map(exp => exp.id);
        
        const basePayload: any = {
          name: formData.name,
          amount: parseFloat(formData.amount),
        };

        const withOptional: any = { ...basePayload };
        if (formData.bank_account_id) withOptional.bank_account_id = formData.bank_account_id;
        if (formData.category) withOptional.category = formData.category;

        // Update all expenses in the group
        await supabase
          .from("coaster_items")
          .update(withOptional)
          .in("id", ids);

        toast({
          title: "Updated!",
          description: "Recurring expense updated",
        });
      }
      // If staying as one-time (just updating the single expense)
      else {
        const basePayload: any = {
          name: formData.name,
          amount: parseFloat(formData.amount),
          expense_date: expenseDate.toISOString(),
        };

        const withOptional: any = { ...basePayload };
        if (formData.bank_account_id) withOptional.bank_account_id = formData.bank_account_id;
        if (formData.category) withOptional.category = formData.category;

        await supabase
          .from("coaster_items")
          .update(withOptional)
          .eq("id", editingExpense.id);

        toast({
          title: "Updated!",
          description: "Expense updated successfully",
        });
      }

      setDialogOpen(false);
      setEditingExpense(null);
      setFormData({ name: "", amount: "", bank_account_id: "", category: "General", repeatDaily: false });
      fetchData();
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: err?.message || "Failed to update expense",
      });
    }
  };

  const nextIncome = getNextIncomeDue(incomes);
  const coastingDays = getCoastingDays(nextIncome);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  // Group expenses by name, amount, category, and bank_account_id
  const groupExpenses = () => {
    const grouped = new Map<string, CoasterItem[]>();
    
    coasterItems.forEach(item => {
      const key = `${item.name}|${item.amount}|${(item as any).category || "General"}|${item.bank_account_id || ""}`;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(item);
    });

    return Array.from(grouped.values()).map(group => {
      // Sort by date
      group.sort((a, b) => {
        const dateA = new Date(a.expense_date).getTime();
        const dateB = new Date(b.expense_date).getTime();
        return dateA - dateB;
      });
      return group;
    });
  };

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
          <p className="text-muted-foreground">Keep a list of planned expenses.</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            // Reset form when dialog closes
            setEditingExpense(null);
            setFormData({ name: "", amount: "", bank_account_id: "", category: "General", repeatDaily: false });
            setExpenseDate(new Date());
          }
        }}>
          <DialogTrigger asChild>
            <Button variant="secondary">
              <Plus className="w-4 h-4 mr-2" />
              Add Expense
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editingExpense ? "Edit Expense" : "Add Expense"}</DialogTitle>
              <DialogDescription>{editingExpense ? "Update your expense details" : "Keep a list of planned expenses."}</DialogDescription>
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
              {!formData.repeatDaily && (
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
                        modifiers={{
                          coastingDays: nextIncome ? (() => {
                            const days: Date[] = [];
                            const today = startOfToday();
                            const endDate = new Date(nextIncome);
                            today.setHours(0, 0, 0, 0);
                            endDate.setHours(0, 0, 0, 0);
                            
                            // Exclude payday - only include days from today to day before payday
                            for (let d = new Date(today); d < endDate; d.setDate(d.getDate() + 1)) {
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
                          const today = startOfToday();
                          date.setHours(0, 0, 0, 0);
                          const maxDate = nextIncome || new Date();
                          if (nextIncome) {
                            maxDate.setHours(0, 0, 0, 0);
                            // Disable payday (it's part of new pay cycle, not coasting period)
                            const isPayday = date.getTime() === maxDate.getTime();
                            if (isPayday) return true;
                            // Disable dates before today or after payday
                            return date < today || date > maxDate;
                          }
                          maxDate.setDate(maxDate.getDate() + 30);
                          return date < today || date > maxDate;
                        }}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              )}
              {formData.repeatDaily && nextIncome && (
                <div className="space-y-2">
                  <Label>Expense Date</Label>
                  <Input
                    value={`Every day starting today until ${format(nextIncome, "PPP")} (${coastingDays} days, payday excluded)`}
                    disabled
                    className="bg-muted"
                  />
                </div>
              )}
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
              {nextIncome && coastingDays > 0 && (
                <div className="flex items-start space-x-3 rounded-md border p-4 bg-secondary/50">
                  <Checkbox
                    id="repeatDaily"
                    checked={formData.repeatDaily}
                    onCheckedChange={(checked) => 
                      setFormData({ ...formData, repeatDaily: checked === true })
                    }
                  />
                  <div className="space-y-1 leading-none">
                    <Label
                      htmlFor="repeatDaily"
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                    >
                      Repeat every day until next paycheck
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      {editingExpense 
                        ? (formData.repeatDaily 
                          ? `This expense will repeat for all ${coastingDays} remaining days. Uncheck to convert to a one-time expense.` 
                          : "Check to convert this to a recurring expense for all remaining days.")
                        : `Create this expense for all ${coastingDays} days starting today (including today, payday excluded)`
                      }
                      {formData.repeatDaily && (
                        <span className="block mt-1 font-semibold text-foreground">
                          ${formatCurrency(parseFloat(formData.amount) || 0)} × {coastingDays} days = ${formatCurrency((parseFloat(formData.amount) || 0) * coastingDays)}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              )}
              <Button type="submit" className="w-full" variant="secondary">
                {editingExpense ? "Update Expense" : (formData.repeatDaily && nextIncome ? `Add ${coastingDays} Expenses 🍺` : "Add Expense 🍺")}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Coasting Calendar - Main Feature */}
      <Card className="border-2">
        <CardHeader>
          <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-2xl md:text-3xl">📅 Coasting Calendar</CardTitle>
            <Popover>
              <PopoverTrigger asChild>
                <button type="button" className="touch-manipulation">
                  <Info className="w-4 h-4 text-muted-foreground cursor-pointer" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="max-w-[260px] text-sm" align="start">
                Coasting Days = number of days from today until your next
                income date. Use this window to pace daily spending.
              </PopoverContent>
            </Popover>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Today</p>
              <p className="text-base font-semibold">{format(startOfToday(), "EEEE, MMM d")}</p>
            </div>
          </div>
          <CardDescription className="text-base md:text-lg text-muted-foreground">
            <span className="font-semibold text-foreground">{coastingDays} day{coastingDays !== 1 ? 's' : ''}</span> until next paycheck (payday excluded)
            {!nextIncome && (
              <span className="block mt-2 text-sm text-amber-600 dark:text-amber-400">
                No upcoming paycheck found. Add income dates in the Income Tab.
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="w-full pb-8">
          <style>{`
            /* Enhanced styling for coasting days - make them really stand out */
            .rdp button[class*="coasting-day"],
            .rdp .rdp-day[class*="coasting-day"],
            .rdp button.coasting-day,
            .rdp .rdp-day.coasting-day {
              background: linear-gradient(135deg, #FFB89A 0%, #FF9E7A 100%) !important;
              color: #ffffff !important;
              font-weight: 800 !important;
              border-radius: 0.5rem !important;
              box-shadow: 0 1px 2px rgba(255, 158, 122, 0.3) !important;
              border: 1px solid #FF9E7A !important;
              position: relative !important;
              width: 100% !important;
              height: 100% !important;
              min-height: 2.5rem !important;
              margin: 0 !important;
              padding: 0 !important;
            }
            .rdp button[class*="coasting-day"]:hover,
            .rdp .rdp-day[class*="coasting-day"]:hover,
            .rdp button.coasting-day:hover,
            .rdp .rdp-day.coasting-day:hover {
              background: linear-gradient(135deg, #FF9E7A 0%, #FF8E6B 100%) !important;
              box-shadow: 0 6px 8px rgba(255, 158, 122, 0.5), 0 4px 6px rgba(255, 142, 107, 0.4) !important;
            }
            .rdp button[class*="coasting-day"].rdp-day_today,
            .rdp .rdp-day[class*="coasting-day"].rdp-day_today,
            .rdp button.coasting-day.rdp-day_today,
            .rdp .rdp-day.coasting-day.rdp-day_today,
            .rdp button.rdp-day_today[class*="coasting-day"],
            .rdp .rdp-day.rdp-day_today[class*="coasting-day"] {
              background: linear-gradient(135deg, #10b981 0%, #059669 100%) !important;
              border: 1px solid #10b981 !important;
              box-shadow: 0 2px 4px rgba(16, 185, 129, 0.3) !important;
              font-weight: 800 !important;
              margin: 0 !important;
              padding: 0 !important;
            }
            /* Next payday - subtle double border to indicate it's payday (not part of coasting period) */
            .rdp button[class*="next-payday"],
            .rdp .rdp-day[class*="next-payday"],
            .rdp button.next-payday,
            .rdp .rdp-day.next-payday {
              background: #f3f4f6 !important;
              color: #374151 !important;
              font-weight: 700 !important;
              border-radius: 0.5rem !important;
              box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1) !important;
              border: 2px double #6b7280 !important;
              position: relative !important;
              width: 100% !important;
              height: 100% !important;
              min-height: 2.5rem !important;
              margin: 0 !important;
              padding: 0 !important;
            }
            .rdp button[class*="next-payday"]:hover,
            .rdp .rdp-day[class*="next-payday"]:hover,
            .rdp button.next-payday:hover,
            .rdp .rdp-day.next-payday:hover {
              background: #e5e7eb !important;
              box-shadow: 0 2px 4px rgba(0, 0, 0, 0.15) !important;
            }
            /* Dark mode styles for payday */
            .dark .rdp button[class*="next-payday"],
            .dark .rdp .rdp-day[class*="next-payday"],
            .dark .rdp button.next-payday,
            .dark .rdp .rdp-day.next-payday {
              background: #1f2937 !important;
              color: #d1d5db !important;
              border: 2px double #9ca3af !important;
            }
            .dark .rdp button[class*="next-payday"]:hover,
            .dark .rdp .rdp-day[class*="next-payday"]:hover,
            .dark .rdp button.next-payday:hover,
            .dark .rdp .rdp-day.next-payday:hover {
              background: #374151 !important;
            }
            /* Make calendar full width */
            .rdp {
              font-size: 0.875rem;
              width: 100%;
              padding: 1rem;
            }
            .rdp .rdp-months {
              width: 100%;
            }
            .rdp .rdp-month {
              width: 100%;
              max-width: 100%;
            }
            .rdp .rdp-table {
              width: 100%;
              table-layout: fixed;
              border-collapse: separate;
              border-spacing: 0;
              margin: 0 auto;
            }
            .rdp .rdp-row {
              width: 100% !important;
              display: table-row !important;
              flex-wrap: nowrap !important;
              margin: 0 !important;
            }
            .rdp .rdp-head_row {
              width: 100% !important;
              display: table-row !important;
              flex-wrap: nowrap !important;
            }
            .rdp .rdp-cell {
              display: table-cell !important;
              width: calc(100% / 7) !important;
              max-width: calc(100% / 7) !important;
              min-width: calc(100% / 7) !important;
              height: 2.5rem !important;
              padding: 0 !important;
              vertical-align: middle !important;
              text-align: center !important;
              box-sizing: border-box !important;
              flex: none !important;
              margin: 0 !important;
              position: relative !important;
            }
            
            /* Ensure cells don't have any padding that would offset content */
            .rdp .rdp-cell > * {
              margin: 0 auto !important;
            }
            
            /* Target disabled days specifically */
            .rdp button.rdp-day.rdp-day_disabled,
            .rdp button.rdp-day[disabled] {
              width: 100% !important;
              margin: 0 !important;
              padding: 0 !important;
              display: flex !important;
              align-items: center !important;
              justify-content: center !important;
              text-align: center !important;
            }
            
            /* Target all day buttons to ensure consistent positioning */
            .rdp button.rdp-day {
              transform: none !important;
              left: 0 !important;
              right: 0 !important;
              margin-left: 0 !important;
              margin-right: 0 !important;
            }
            
            /* Override any default calendar library styles that might offset buttons */
            .rdp .rdp-cell button.rdp-day {
              position: absolute !important;
              top: 50% !important;
              left: 50% !important;
              transform: translate(-50%, -50%) !important;
              width: 100% !important;
              height: 100% !important;
            }
            
            /* But keep highlighted days as they are (they're already centered) */
            .rdp .rdp-cell button.rdp-day[class*="coasting-day"],
            .rdp .rdp-cell button.rdp-day[class*="next-payday"] {
              position: relative !important;
              top: auto !important;
              left: auto !important;
              transform: none !important;
            }
            /* Regular day buttons - ensure proper centering and make them appear "off" */
            .rdp .rdp-day:not(.coasting-day):not(.next-payday):not([class*="coasting-day"]):not([class*="next-payday"]),
            .rdp button.rdp-day:not(.coasting-day):not(.next-payday):not([class*="coasting-day"]):not([class*="next-payday"]) {
              width: 100% !important;
              height: 100% !important;
              min-height: 2.5rem !important;
              max-width: 100% !important;
              font-size: 0.875rem !important;
              font-weight: 700;
              display: flex !important;
              align-items: center !important;
              justify-content: center !important;
              margin: 0 auto !important;
              padding: 0 !important;
              box-sizing: border-box !important;
              overflow: hidden;
              text-overflow: ellipsis;
              border-radius: 0.5rem;
              text-align: center !important;
              position: relative !important;
              left: 0 !important;
              right: 0 !important;
              opacity: 0.4 !important;
              color: #9ca3af !important;
              cursor: not-allowed !important;
            }
            
            /* Ensure text content is centered - target the actual number */
            .rdp button.rdp-day:not(.coasting-day):not(.next-payday):not([class*="coasting-day"]):not([class*="next-payday"]) {
              padding-left: 0 !important;
              padding-right: 0 !important;
              margin-left: 0 !important;
              margin-right: 0 !important;
            }
            
            /* Target the actual button content */
            .rdp button.rdp-day:not(.coasting-day):not(.next-payday):not([class*="coasting-day"]):not([class*="next-payday"])::before,
            .rdp button.rdp-day:not(.coasting-day):not(.next-payday):not([class*="coasting-day"]):not([class*="next-payday"])::after {
              content: none !important;
            }
            
            /* Ensure highlighted days have pointer cursor and are clickable */
            .rdp button.rdp-day.coasting-day,
            .rdp button.rdp-day.next-payday,
            .rdp button.rdp-day[class*="coasting-day"],
            .rdp button.rdp-day[class*="next-payday"] {
              cursor: pointer !important;
            }
            .rdp .rdp-head_cell {
              display: table-cell !important;
              width: calc(100% / 7) !important;
              max-width: calc(100% / 7) !important;
              min-width: calc(100% / 7) !important;
              font-size: 1rem;
              font-weight: 600;
              padding: 0.5rem 0 !important;
              text-align: center !important;
              box-sizing: border-box;
              flex: none !important;
              margin: 0 !important;
            }
            .rdp .rdp-caption_label {
              font-size: 1rem;
              font-weight: 700;
            }
            .rdp .rdp-caption {
              margin-bottom: 1.5rem;
              padding-bottom: 0.5rem;
            }
            .rdp .rdp-caption_label {
              margin: 0 0.5rem;
            }
            .rdp .rdp-nav {
              gap: 0.5rem;
            }
            .rdp .rdp-nav_button_previous,
            .rdp .rdp-nav_button_next {
              margin: 0 0.25rem;
            }
            .rdp .rdp-head_row {
              margin-top: 1rem;
              margin-bottom: 0.75rem;
              padding-top: 0.5rem;
            }
            .rdp .rdp-table {
              margin-top: 0;
            }
            @media (min-width: 768px) {
              .rdp .rdp-cell {
                height: 2.5rem !important;
                padding: 0 !important;
              }
              .rdp .rdp-day {
                font-size: 0.875rem !important;
                min-height: 2.5rem !important;
              }
              .rdp .rdp-head_cell {
                font-size: 0.875rem;
              }
              .rdp .rdp-table {
                border-spacing: 0;
                margin-top: 1rem;
              }
              .rdp .rdp-caption {
                margin-bottom: 2rem;
                padding-bottom: 0.75rem;
              }
              .rdp .rdp-caption_label {
                margin: 0 0.75rem;
              }
              .rdp .rdp-nav {
                gap: 0.75rem;
              }
              .rdp .rdp-nav_button_previous,
              .rdp .rdp-nav_button_next {
                margin: 0 0.5rem;
              }
              .rdp .rdp-head_row {
                margin-top: 1.25rem;
                margin-bottom: 1rem;
                padding-top: 0.75rem;
              }
            }
            @media (min-width: 1024px) {
              .rdp .rdp-cell {
                height: 2.5rem !important;
                padding: 0 !important;
              }
              .rdp .rdp-day {
                font-size: 0.875rem !important;
                min-height: 2.5rem !important;
              }
              .rdp .rdp-head_cell {
                font-size: 0.875rem;
              }
              .rdp .rdp-caption_label {
                font-size: 1rem;
              }
              .rdp .rdp-table {
                border-spacing: 0;
                margin-top: 1.25rem;
              }
              .rdp .rdp-caption {
                margin-bottom: 2.5rem;
                padding-bottom: 1rem;
              }
              .rdp .rdp-caption_label {
                margin: 0 1rem;
              }
              .rdp .rdp-nav {
                gap: 1rem;
              }
              .rdp .rdp-nav_button_previous,
              .rdp .rdp-nav_button_next {
                margin: 0 0.75rem;
              }
              .rdp .rdp-head_row {
                margin-top: 1.5rem;
                margin-bottom: 1.25rem;
                padding-top: 1rem;
              }
            }
            /* Keep navigation arrows visible and working for coasting calendar */
            .rdp .rdp-nav_button_previous,
            .rdp .rdp-nav_button_next {
              opacity: 1 !important;
              visibility: visible !important;
              display: flex !important;
              pointer-events: auto !important;
            }
          `}</style>
          <Calendar
            mode="single"
            month={calendarMonth}
            onMonthChange={setCalendarMonth}
            modifiers={{
              coastingDays: nextIncome ? (() => {
                const days: Date[] = [];
                const today = startOfToday();
                const endDate = new Date(nextIncome);
                today.setHours(0, 0, 0, 0);
                endDate.setHours(0, 0, 0, 0);
                
                // Create array of all days from today to day before payday (exclude payday)
                for (let d = new Date(today); d < endDate; d.setDate(d.getDate() + 1)) {
                  days.push(new Date(d));
                }
                return days;
              })() : [],
              nextPayday: nextIncome ? [new Date(nextIncome)] : [],
            }}
            modifiersClassNames={{
              coastingDays: "coasting-day",
              nextPayday: "next-payday",
            }}
            modifiersStyles={{
              coastingDays: {
                backgroundColor: '#FFB89A',
                color: '#ffffff',
                fontWeight: 800,
              },
              nextPayday: {
                backgroundColor: '#f3f4f6',
                color: '#374151',
                fontWeight: 700,
                border: '2px double #6b7280',
              },
            }}
            classNames={{
              cell: "h-10 w-10 p-0 relative",
              day: "h-10 w-10 p-0 m-0",
              months: "w-full",
              month: "w-full",
              table: "w-full",
              row: "w-full",
              head_row: "w-full",
            }}
            components={{
              Day: (dayProps: any) => {
                const { date, className, displayMonth, modifiers, ...props } = dayProps;
                const dateOnly = startOfDay(date);
                
                // Check if this date is a coasting day (exclude payday)
                const coastingDaysArray = nextIncome ? (() => {
                  const days: Date[] = [];
                  const todayDate = startOfToday();
                  const endDate = new Date(nextIncome);
                  todayDate.setHours(0, 0, 0, 0);
                  endDate.setHours(0, 0, 0, 0);
                  // Exclude payday - only include days from today to day before payday
                  for (let d = new Date(todayDate); d < endDate; d.setDate(d.getDate() + 1)) {
                    days.push(new Date(d));
                  }
                  return days;
                })() : [];
                
                const isCoastingDay = coastingDaysArray.some(d => {
                  const dOnly = startOfDay(d);
                  return dOnly.getTime() === dateOnly.getTime();
                });
                
                // Check if this date is the next payday
                const isNextPayday = nextIncome && dateOnly.getTime() === startOfDay(nextIncome).getTime();
                
                // Get expenses for this date
                const dateExpenses = coasterItems.filter(item => {
                  const itemDate = startOfDay(new Date(item.expense_date));
                  return itemDate.getTime() === dateOnly.getTime();
                });
                
                const totalExpenses = dateExpenses.reduce((sum, item) => sum + Number(item.amount), 0);
                
                // Filter out non-DOM props
                const { displayMonth: _, ...restProps } = props;
                const buttonProps: any = { ...restProps };
                
                // Apply centering styles
                buttonProps.style = {
                  width: '100%',
                  height: '100%',
                  minWidth: '100%',
                  minHeight: '100%',
                  padding: '0',
                  margin: '0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  ...props.style,
                };
                
                buttonProps.className = cn(className, props.className);
                
                // If it's a coasting day, show popover with expenses
                if (isCoastingDay) {
                  // Apply the peach gradient styling
                  buttonProps.style = {
                    background: 'linear-gradient(135deg, #FFB89A 0%, #FF9E7A 100%)',
                    color: '#ffffff',
                    fontWeight: '800',
                    borderRadius: '0.5rem',
                    border: '1px solid #FF9E7A',
                    boxShadow: '0 1px 2px rgba(255, 158, 122, 0.3)',
                    width: '100%',
                    height: '100%',
                    minWidth: '100%',
                    minHeight: '100%',
                    padding: '0',
                    margin: '0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    ...props.style,
                  };
                  buttonProps.className = cn(className, 'coasting-day', props.className);
                }
                // If it's payday, show with double border (subtle indicator) - show popover with "Payday" text
                else if (isNextPayday) {
                  buttonProps.style = {
                    background: '#f3f4f6',
                    color: '#374151',
                    fontWeight: '700',
                    borderRadius: '0.5rem',
                    border: '2px double #6b7280',
                    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.1)',
                    width: '100%',
                    height: '100%',
                    minWidth: '100%',
                    minHeight: '100%',
                    padding: '0',
                    margin: '0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    ...props.style,
                  };
                  buttonProps.className = cn(className, 'next-payday', props.className);
                  
                  // Show popover with "Payday" text (regardless of expenses)
                  return (
                    <Popover>
                      <PopoverTrigger asChild>
                        <button {...buttonProps}>{date.getDate()}</button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-3" side="top">
                        <p className="font-semibold mb-2">{format(date, "EEEE, MMMM d")} - Payday</p>
                        <p className="text-sm text-muted-foreground">Payday - new pay cycle starts here</p>
                      </PopoverContent>
                    </Popover>
                  );
                }
                
                // Show popover for coasting days only (payday is handled above)
                if (isCoastingDay) {
                  return (
                    <Popover>
                      <PopoverTrigger asChild>
                        <button {...buttonProps}>{date.getDate()}</button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-3" side="top">
                        <p className="font-semibold mb-2">{format(date, "EEEE, MMMM d")}</p>
                        {dateExpenses.length > 0 ? (
                          <>
                            <div className="space-y-1">
                              {dateExpenses.map((expense, idx) => (
                                <div key={idx} className="flex justify-between items-center gap-4">
                                  <span className="text-sm">{expense.name}</span>
                                  <span className="text-sm font-semibold">${Number(expense.amount).toFixed(2)}</span>
                                </div>
                              ))}
                            </div>
                            <div className="mt-2 pt-2 border-t">
                              <div className="flex justify-between items-center">
                                <span className="text-sm font-semibold">Total</span>
                                <span className="text-sm font-bold">${totalExpenses.toFixed(2)}</span>
                              </div>
                            </div>
                          </>
                        ) : (
                          <p className="text-sm text-muted-foreground">No expenses on this day</p>
                        )}
                      </PopoverContent>
                    </Popover>
                  );
                }
                
                // Regular day - make it appear "off" (grayed out)
                buttonProps.style = {
                  width: '100%',
                  height: '100%',
                  minWidth: '100%',
                  minHeight: '100%',
                  padding: '0',
                  margin: '0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: 0.4,
                  color: '#9ca3af',
                  cursor: 'not-allowed',
                  ...props.style,
                };
                
                return <button {...buttonProps}>{date.getDate()}</button>;
              },
            }}
            disabled={(date) => {
              const today = startOfToday();
              date.setHours(0, 0, 0, 0);
              const maxDate = nextIncome || new Date();
              if (nextIncome) {
                maxDate.setHours(0, 0, 0, 0);
                // Don't disable payday - allow clicking it but it will show "Payday" popover
                // Only disable if it's NOT a coasting day (coasting days exclude payday)
                const dateOnly = startOfDay(date);
                const coastingDaysArray = (() => {
                  const days: Date[] = [];
                  const todayDate = startOfToday();
                  const endDate = new Date(nextIncome);
                  todayDate.setHours(0, 0, 0, 0);
                  endDate.setHours(0, 0, 0, 0);
                  // Exclude payday - only include days from today to day before payday
                  for (let d = new Date(todayDate); d < endDate; d.setDate(d.getDate() + 1)) {
                    days.push(new Date(d));
                  }
                  return days;
                })();
                const isCoastingDay = coastingDaysArray.some(d => {
                  const dOnly = startOfDay(d);
                  return dOnly.getTime() === dateOnly.getTime();
                });
                // Allow payday to be clickable
                const isPayday = date.getTime() === maxDate.getTime();
                if (isPayday) return false;
                // Don't disable coasting days
                if (isCoastingDay) return false;
                return date < today || date > maxDate;
              }
              maxDate.setDate(maxDate.getDate() + 30);
              return date < today || date > maxDate;
            }}
            className="cursor-pointer w-full"
          />
        </CardContent>
      </Card>

      {/* Add Your First Expense - Below Calendar */}
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
      ) : null}

      {/* Expense List */}
      {coasterItems.length > 0 && (
        <div className="grid gap-4">
          {groupExpenses().map((expenseGroup, groupIdx) => {
            const firstExpense = expenseGroup[0];
            const today = startOfToday();
            
            // Filter out past dates - only show today and future dates
            const remainingItems = expenseGroup.filter(item => {
            const itemDate = new Date(item.expense_date);
            itemDate.setHours(0, 0, 0, 0);
              return !isPast(itemDate) || isToday(itemDate);
            });
            
            // Skip if no remaining items (all dates have passed)
            if (remainingItems.length === 0) {
              return null;
            }
            
            const isRecurring = expenseGroup.length > 1;
            const hasRemainingRecurring = remainingItems.length > 1;
            
            // Get all dates from remaining items and sort them
            const dates = remainingItems.map(item => new Date(item.expense_date));
            
            // Find the earliest and latest dates
            const earliestDate = dates.reduce((earliest, date) => 
              date < earliest ? date : earliest, dates[0]
            );
            const latestDate = dates.reduce((latest, date) => 
              date > latest ? date : latest, dates[0]
            );
            
            // Check if any dates are past (this should be false now, but keeping for consistency)
            const hasPastDates = remainingItems.some(item => {
              const itemDate = new Date(item.expense_date);
              itemDate.setHours(0, 0, 0, 0);
              return isPast(itemDate) && !isToday(itemDate);
            });
            
            // Check if any dates are today
            const hasTodayDate = remainingItems.some(item => {
              const itemDate = new Date(item.expense_date);
              itemDate.setHours(0, 0, 0, 0);
              return isToday(itemDate);
            });
            
            // Check if any dates are future
            const hasFutureDates = remainingItems.some(item => {
              const itemDate = new Date(item.expense_date);
              itemDate.setHours(0, 0, 0, 0);
              return isFuture(itemDate);
            });
            
            // For recurring expenses: only gray out if ALL dates have passed (no future dates)
            // For one-time expenses: gray out if the date has passed
            const shouldGrayOut = isRecurring 
              ? !hasFutureDates && !hasTodayDate  // All dates are past (no future, no today)
              : hasPastDates;  // Single date is past
            
            // Format dates for display (only showing remaining dates)
            const formatDates = () => {
              if (!isRecurring) {
                const itemDate = new Date(remainingItems[0].expense_date);
                itemDate.setHours(0, 0, 0, 0);
            const isPastDate = isPast(itemDate) && !isToday(itemDate);
                return format(itemDate, isPastDate ? "MMM d" : "PPP");
              }
              
              // For recurring expenses, show compact format with only remaining dates
              const sortedDates = [...dates].sort((a, b) => a.getTime() - b.getTime());
              
              // Try to group consecutive dates
              const dateGroups: { start: Date; end: Date; count: number }[] = [];
              let currentGroup: { start: Date; end: Date; count: number } | null = null;
              
              sortedDates.forEach((date, idx) => {
                const dateOnly = startOfDay(date);
                const prevDate = idx > 0 ? startOfDay(sortedDates[idx - 1]) : null;
                
                if (prevDate && dateOnly.getTime() === prevDate.getTime() + 86400000) {
                  // Consecutive date (exactly one day after previous)
                  if (currentGroup) {
                    currentGroup.end = dateOnly;
                    currentGroup.count++;
                  }
                } else {
                  // New group
                  if (currentGroup) {
                    dateGroups.push(currentGroup);
                  }
                  currentGroup = { start: dateOnly, end: dateOnly, count: 1 };
                }
              });
              
              if (currentGroup) {
                dateGroups.push(currentGroup);
              }
              
              // Format groups
              const formattedParts = dateGroups.map(group => {
                if (group.count === 1) {
                  return format(group.start, "MMM d");
                } else {
                  return `${format(group.start, "MMM d")}-${format(group.end, "d")}`;
                }
              });
              
              // Limit to first 10 dates and add "..." if more
              if (formattedParts.length > 10) {
                return formattedParts.slice(0, 10).join(", ") + ", ...";
              }
              
              return formattedParts.join(", ");
            };
            
            return (
              <Card 
                key={groupIdx}
                className={cn(
                  "border-2 hover:shadow-card-hover transition-smooth",
                  shouldGrayOut && "opacity-60"
                )}
              >
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <CardTitle className={cn(shouldGrayOut && "text-muted-foreground")}>
                          {firstExpense.name}
                        </CardTitle>
                        {hasTodayDate && (
                          <Badge variant="default" className="bg-blue-500 hover:bg-blue-600">
                            Today
                          </Badge>
                        )}
                          <Badge variant="outline" className="border-blue-300 text-blue-700 dark:text-blue-300">
                          {isRecurring ? "Repeats" : "One-Time Expense"}
                          </Badge>
                      </div>
                      <CardDescription className={cn(shouldGrayOut && "text-muted-foreground")}>
                        {isRecurring ? `Repeats on ${formatDates()}` : formatDates()}
                        {firstExpense.bank_account_id && bankAccounts.find(acc => acc.id === firstExpense.bank_account_id) && (
                          ` • ${bankAccounts.find(acc => acc.id === firstExpense.bank_account_id)?.name}`
                        )}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-3">
                      <p className={cn(
                        "text-xl font-bold",
                        shouldGrayOut ? "text-muted-foreground" : "text-foreground"
                      )}>
                        ${formatCurrency(Number(firstExpense.amount))}
                        {isRecurring && ` × ${remainingItems.length}`}
                      </p>
                      <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                          onClick={() => handleEditExpense(firstExpense)}
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteExpenseGroup(expenseGroup)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                      </div>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Coaster;
