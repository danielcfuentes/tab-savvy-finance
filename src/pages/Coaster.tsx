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
import { Loader2, Plus, Trash2, Calendar as CalendarIcon, Info } from "lucide-react";
import { format, startOfToday, startOfMonth, differenceInDays, isToday, isPast, isFuture } from "date-fns";
import { cn } from "@/lib/utils";
import { getRealBankBalance, getCoastingDays, getNextIncomeDue } from "@/lib/calculations";
import type { BankAccount, CoasterItem, IncomeItem } from "@/lib/calculations";

const Coaster = () => {
  const [coasterItems, setCoasterItems] = useState<CoasterItem[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [incomes, setIncomes] = useState<IncomeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
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

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    try {
      const today = startOfToday();
      const nextIncomeDate = getNextIncomeDue(incomes);
      
      // If repeatDaily is checked, create expenses for every day in the coasting period
      if (formData.repeatDaily && nextIncomeDate) {
        const expensesToCreate: any[] = [];
        const endDate = new Date(nextIncomeDate);
        endDate.setHours(0, 0, 0, 0);
        
        // Create an expense for each day from today to next paycheck
        for (let d = new Date(today); d <= endDate; d.setDate(d.getDate() + 1)) {
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

  const realBalance = getRealBankBalance(bankAccounts, coasterItems);
  const nextIncome = getNextIncomeDue(incomes);
  const coastingDays = getCoastingDays(nextIncome);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
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
          <p className="text-muted-foreground">Track your daily spending</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            // Reset form when dialog closes
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
                          const today = startOfToday();
                          date.setHours(0, 0, 0, 0);
                          const maxDate = nextIncome || new Date();
                          if (nextIncome) {
                            maxDate.setHours(0, 0, 0, 0);
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
                    value={`Every day from today until ${format(nextIncome, "PPP")} (${coastingDays} days)`}
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
                      Create this expense for all {coastingDays} days in the coasting period
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
                {formData.repeatDaily && nextIncome ? `Add ${coastingDays} Expenses 🍺` : "Add Expense 🍺"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Coasting Calendar - Main Feature */}
      <Card className="border-2">
        <CardHeader>
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
          <CardDescription className="text-base md:text-lg text-muted-foreground">
            <span className="font-semibold text-foreground">{coastingDays} day{coastingDays !== 1 ? 's' : ''}</span> until next paycheck
            <span className="block mt-2 text-sm">💡 Click on any day to add an expense</span>
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
              box-shadow: 0 4px 6px rgba(255, 158, 122, 0.4), 0 2px 4px rgba(255, 184, 154, 0.3) !important;
              border: 2px solid #FF9E7A !important;
              position: relative !important;
              width: 100% !important;
              height: 100% !important;
              min-height: 3.5rem !important;
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
              border: 3px solid #10b981 !important;
              box-shadow: 0 6px 12px rgba(16, 185, 129, 0.4), 0 4px 6px rgba(16, 185, 129, 0.3) !important;
              font-weight: 800 !important;
            }
            /* Next payday - same as coasting days (peach) */
            .rdp button[class*="next-payday"],
            .rdp .rdp-day[class*="next-payday"],
            .rdp button.next-payday,
            .rdp .rdp-day.next-payday {
              background: linear-gradient(135deg, #FFB89A 0%, #FF9E7A 100%) !important;
              color: #ffffff !important;
              font-weight: 800 !important;
              border-radius: 0.5rem !important;
              box-shadow: 0 4px 6px rgba(255, 158, 122, 0.4), 0 2px 4px rgba(255, 184, 154, 0.3) !important;
              border: 2px solid #FF9E7A !important;
              position: relative !important;
              width: 100% !important;
              height: 100% !important;
              min-height: 3.5rem !important;
            }
            .rdp button[class*="next-payday"]:hover,
            .rdp .rdp-day[class*="next-payday"]:hover,
            .rdp button.next-payday:hover,
            .rdp .rdp-day.next-payday:hover {
              background: linear-gradient(135deg, #FF9E7A 0%, #FF8E6B 100%) !important;
              box-shadow: 0 6px 8px rgba(255, 158, 122, 0.5), 0 4px 6px rgba(255, 142, 107, 0.4) !important;
            }
            /* Make calendar bigger and full width */
            .rdp {
              font-size: 1.15rem;
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
              border-spacing: 0.25rem;
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
              height: 4rem;
              padding: 0.25rem;
              vertical-align: middle;
              text-align: center;
              box-sizing: border-box;
              flex: none !important;
            }
            .rdp .rdp-day {
              width: 100% !important;
              height: 100% !important;
              min-height: 3.5rem;
              max-width: 100% !important;
              font-size: 1.15rem;
              font-weight: 700;
              display: inline-flex;
              align-items: center;
              justify-content: center;
              margin: 0;
              padding: 0;
              box-sizing: border-box;
              overflow: hidden;
              text-overflow: ellipsis;
              border-radius: 0.5rem;
            }
            .rdp .rdp-head_cell {
              display: table-cell !important;
              width: calc(100% / 7) !important;
              max-width: calc(100% / 7) !important;
              min-width: calc(100% / 7) !important;
              font-size: 1rem;
              font-weight: 600;
              padding: 0.5rem 0;
              text-align: center;
              box-sizing: border-box;
              flex: none !important;
            }
            .rdp .rdp-caption_label {
              font-size: 1.35rem;
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
                height: 4.5rem;
                padding: 0.375rem;
              }
              .rdp .rdp-day {
                font-size: 1.25rem;
                min-height: 4rem;
              }
              .rdp .rdp-head_cell {
                font-size: 1.1rem;
              }
              .rdp .rdp-table {
                border-spacing: 0.375rem;
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
                height: 5rem;
                padding: 0.5rem;
              }
              .rdp .rdp-day {
                font-size: 1.35rem;
                min-height: 4.5rem;
              }
              .rdp .rdp-head_cell {
                font-size: 1.15rem;
              }
              .rdp .rdp-caption_label {
                font-size: 1.5rem;
              }
              .rdp .rdp-table {
                border-spacing: 0.5rem;
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
                
                // Create array of all days from today through next paycheck
                for (let d = new Date(today); d <= endDate; d.setDate(d.getDate() + 1)) {
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
                backgroundColor: '#FFB89A',
                color: '#ffffff',
                fontWeight: 800,
              },
            }}
            classNames={{
              cell: "text-center text-base p-0 relative",
              day: "p-0 font-normal text-base",
              months: "w-full",
              month: "w-full",
              table: "w-full",
              row: "w-full",
              head_row: "w-full",
            }}
            disabled={(date) => {
              const today = startOfToday();
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
            className="cursor-pointer w-full"
          />
        </CardContent>
      </Card>

      {/* Real Bank Balance - Below Calendar */}
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
                  Real Bank Balance is your actual spending power — what's left in your accounts after subtracting your active Coasting Expenses.
                </p>
                <p className="mt-3 text-xs text-muted-foreground">
                  Calculation: (Total Bank Accounts from Bank Tab) – (All Coasting Expenses)
                </p>
              </PopoverContent>
            </Popover>
          </div>
          <CardDescription>
            Your actual spending power for the remaining days
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

      {/* Add Your First Expense - Below Real Bank Balance */}
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
          {coasterItems.map((item) => {
            const itemDate = new Date(item.expense_date);
            itemDate.setHours(0, 0, 0, 0);
            const today = startOfToday();
            const isPastDate = isPast(itemDate) && !isToday(itemDate);
            const isTodayDate = isToday(itemDate);
            const isFutureDate = isFuture(itemDate);
            const daysUntil = differenceInDays(itemDate, today);
            
            return (
              <Card 
                key={item.id} 
                className={cn(
                  "border-2 hover:shadow-card-hover transition-smooth",
                  isPastDate && "opacity-60"
                )}
              >
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <CardTitle className={cn(isPastDate && "line-through text-muted-foreground")}>
                          {item.name}
                        </CardTitle>
                        <Badge variant="secondary">{(item as any).category || "General"}</Badge>
                        {isTodayDate && (
                          <Badge variant="default" className="bg-blue-500 hover:bg-blue-600">
                            Today
                          </Badge>
                        )}
                        {isFutureDate && daysUntil > 0 && (
                          <Badge variant="outline" className="border-blue-300 text-blue-700 dark:text-blue-300">
                            {daysUntil} day{daysUntil !== 1 ? 's' : ''} away
                          </Badge>
                        )}
                      </div>
                      <CardDescription className={cn(isPastDate && "line-through")}>
                        {format(new Date(item.expense_date), "PPP")}
                        {item.bank_account_id && bankAccounts.find(acc => acc.id === item.bank_account_id) && (
                          ` • ${bankAccounts.find(acc => acc.id === item.bank_account_id)?.name}`
                        )}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-3">
                      <p className={cn(
                        "text-xl font-bold",
                        isPastDate ? "text-muted-foreground line-through" : "text-foreground"
                      )}>
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
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Coaster;
