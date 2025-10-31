import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Trash2, Calendar as CalendarIcon, X, Edit2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format, startOfToday, startOfDay, addMonths, isSameMonth, startOfMonth, isPast, isToday } from "date-fns";
import { cn } from "@/lib/utils";
import type { IncomeItem } from "@/lib/calculations";

type BankAccount = {
  id: string;
  name: string;
};

type Income = {
  id: string;
  name: string;
  amount_now: number;
  amount_next: number;
  due_date: string;
  bank_account_id: string;
  bank_accounts: BankAccount;
};

const Income = () => {
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingIncome, setEditingIncome] = useState<Income | null>(null);
  const [dueDate, setDueDate] = useState<Date>();
  const [dismissedSlots, setDismissedSlots] = useState<Set<number>>(new Set());
  const [formData, setFormData] = useState({
    name: "",
    amount_now: "",
    amount_next: "",
    bank_account_id: "",
  });
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const [incomesRes, accountsRes] = await Promise.all([
      supabase.from("income").select("*, bank_accounts(id, name)").order("due_date", { ascending: true }),
      supabase.from("bank_accounts").select("id, name"),
    ]);

    if (incomesRes.error) {
      toast({ variant: "destructive", title: "Error", description: "Failed to fetch income data" });
    } else {
      setIncomes(incomesRes.data || []);
    }

    if (accountsRes.error) {
      toast({ variant: "destructive", title: "Error", description: "Failed to fetch accounts" });
    } else {
      setAccounts(accountsRes.data || []);
    }

    setLoading(false);
  };

  const handleAddIncome = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dueDate) {
      toast({ variant: "destructive", title: "Error", description: "Please select a due date" });
      return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    if (editingIncome) {
      // Update existing income
      const { error } = await supabase
        .from("income")
        .update({
          name: formData.name,
          amount_now: parseFloat(formData.amount_now),
          amount_next: parseFloat(formData.amount_next),
          due_date: dueDate.toISOString(),
          bank_account_id: formData.bank_account_id,
        })
        .eq("id", editingIncome.id);

      if (error) {
        toast({ variant: "destructive", title: "Error", description: "Failed to update income" });
      } else {
        toast({ title: "Success!", description: "Paycheck updated" });
        setDialogOpen(false);
        setEditingIncome(null);
        setFormData({ name: "", amount_now: "", amount_next: "", bank_account_id: "" });
        setDueDate(undefined);
        fetchData();
      }
    } else {
      // Insert new income
    const { error } = await supabase.from("income").insert({
      user_id: session.user.id,
      name: formData.name,
      amount_now: parseFloat(formData.amount_now),
      amount_next: parseFloat(formData.amount_next),
      due_date: dueDate.toISOString(),
      bank_account_id: formData.bank_account_id,
    });

    if (error) {
        toast({ variant: "destructive", title: "Error", description: "Failed to add income" });
    } else {
        toast({ title: "Success!", description: "Income added" });
      setDialogOpen(false);
      setFormData({ name: "", amount_now: "", amount_next: "", bank_account_id: "" });
      setDueDate(undefined);
      fetchData();
    }
    }
  };

  const handleEditIncome = (income: Income) => {
    setEditingIncome(income);
    setFormData({
      name: income.name,
      amount_now: income.amount_now.toString(),
      amount_next: income.amount_next.toString(),
      bank_account_id: income.bank_account_id,
    });
    setDueDate(new Date(income.due_date));
    setDialogOpen(true);
  };

  const handleDeleteIncome = async (id: string) => {
    const { error } = await supabase.from("income").delete().eq("id", id);
    if (error) {
      toast({ variant: "destructive", title: "Error", description: "Failed to delete income" });
    } else {
      toast({ title: "Deleted", description: "Income removed" });
      fetchData();
    }
  };

  const resolvedTz = localStorage.getItem("userTimezone") || Intl.DateTimeFormat().resolvedOptions().timeZone;
  const nowInTz = () => new Date(new Date().toLocaleString("en-US", { timeZone: resolvedTz }));

  const tzNow = nowInTz();
  const tzToday = startOfToday();
  tzToday.setHours(tzNow.getHours(), tzNow.getMinutes(), tzNow.getSeconds(), tzNow.getMilliseconds());
  const thisMonth = startOfMonth(tzNow);
  const nextMonth = startOfMonth(addMonths(tzNow, 1));

  const toTzDate = (dIso: string) => {
    const d = new Date(new Date(dIso).toLocaleString("en-US", { timeZone: resolvedTz }));
    d.setHours(0, 0, 0, 0);
    return d;
  };
  
  // Separate past and future paydays for this month
  const incomesThisMonthData = incomes
    .filter(i => isSameMonth(toTzDate(i.due_date), thisMonth))
    .map(i => {
      const d = toTzDate(i.due_date);
      return { date: d, income: i };
    });
  
  const incomesThisMonthPast = incomesThisMonthData
    .filter(item => {
      const itemDate = item.date;
      const today = startOfDay(startOfToday());
      return itemDate < today && !isToday(itemDate);
    })
    .map(item => startOfDay(item.date));
  
  const incomesThisMonthFuture = incomesThisMonthData
    .filter(item => {
      const itemDate = item.date;
      const today = startOfToday();
      return itemDate >= today || isToday(itemDate);
    })
    .map(item => item.date);
  
  const incomesThisMonth = incomesThisMonthData.map(item => item.date);
  
  const incomesNextMonth = incomes
    .filter(i => isSameMonth(toTzDate(i.due_date), nextMonth))
    .map(i => {
      const d = toTzDate(i.due_date);
      d.setHours(0, 0, 0, 0);
      return d;
    });

  // Per-paycheck color coding for This Month and Next Month
  const colorPalette = [
    "#00A86B", // Mint Ledger primary
    "#4CD964",
    "#1DB954",
    "#34D399",
    "#10B981",
    "#2DD4BF",
  ];

  type ModRecord = Record<string, Date[]>;
  const thisMonthModifiers: ModRecord = {};
  const nextMonthModifiers: ModRecord = {};
  const dynamicClassNames: Record<string, string> = {};

  incomes.forEach((inc, idx) => {
    const keyThis = `pay${idx}This`;
    const keyNext = `pay${idx}Next`;
    const date = toTzDate(inc.due_date);
    const normalizedDate = startOfDay(date);

    // If paycheck is in this month, mark it and also project it to next month (same day)
    if (isSameMonth(date, thisMonth)) {
      thisMonthModifiers[keyThis] = [normalizedDate];
      dynamicClassNames[keyThis] = `cal-${idx}-this`;

      const projectedNext = startOfDay(addMonths(normalizedDate, 1));
      if (isSameMonth(projectedNext, nextMonth)) {
        nextMonthModifiers[keyNext] = [projectedNext];
        dynamicClassNames[keyNext] = `cal-${idx}-next`;
      }
    }

    // If paycheck is already dated in next month, just mark next month
    if (isSameMonth(date, nextMonth)) {
      nextMonthModifiers[keyNext] = [normalizedDate];
      dynamicClassNames[keyNext] = `cal-${idx}-next`;
    }
  });

  // Fallback: aggregate all next-month paydays to ensure visibility even if per-paycheck mapping fails
  const nextMonthAll: Date[] = Object.values(nextMonthModifiers).flat();
  if (nextMonthAll.length > 0) {
    (nextMonthModifiers as any).anyNextPay = nextMonthAll;
  }

  // Build modifiersClassNames with inline styles for colors
  const thisMonthClassNames: Record<string, string> = {
    paydaysPast: "paydays-past",
  };
  const nextMonthClassNames: Record<string, string> = {};
  
  incomes.forEach((inc, idx) => {
    const keyThis = `pay${idx}This`;
    const keyNext = `pay${idx}Next`;
    const date = toTzDate(inc.due_date);
    const color = colorPalette[idx % colorPalette.length];
    
    if (isSameMonth(date, thisMonth)) {
      thisMonthClassNames[keyThis] = `cal-${idx}-this`;
    }
    if (isSameMonth(date, nextMonth)) {
      nextMonthClassNames[keyNext] = `cal-${idx}-next`;
    }
  });
  if (nextMonthAll.length > 0) {
    nextMonthClassNames["anyNextPay"] = "cal-any-next";
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <Loader2 className="w-8 h-8 animate-spin text-secondary" />
      </div>
    );
  }

  // Helper to prefill default paycheck names
  const openPrefilledDialog = (name: string) => {
    setFormData(prev => ({ ...prev, name }));
    setDialogOpen(true);
  };

  const handleDismissSlot = (slotNumber: number) => {
    setDismissedSlots(prev => new Set(prev).add(slotNumber));
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Today Banner (timezone-aware) */}
      <div className="text-center py-2">
        <p className="text-sm text-muted-foreground">Today</p>
        <p className="text-lg font-semibold">{new Intl.DateTimeFormat("en-US", { weekday: "long", month: "short", day: "numeric", timeZone: resolvedTz }).format(new Date())}</p>
      </div>

      {/* Calendars */}
      <style>{`
        /* Base: future/upcoming payday styling (actual colors added below) */
        .rdp-day.paydays:not(.paydays-past),
        button.rdp-day.paydays:not(.paydays-past) {
          color: #FFFFFF !important;
          font-weight: 700 !important;
          border-radius: 0.5rem !important;
        }
        /* Past payday styling - already received */
        .rdp-day.paydays-past,
        button.rdp-day.paydays-past,
        .rdp-day_selected.paydays-past {
          background-color: #E0E0E0 !important;
          color: #616161 !important;
          font-weight: 600 !important;
          border-radius: 0.5rem !important;
          border: 2px dashed #9E9E9E !important;
          opacity: 0.8 !important;
        }
        /* Today's date - subtle blue highlight when not a payday */
        .rdp-day_today:not(.paydays),
        button.rdp-day_today:not(.paydays):not([class*="paydays"]) {
          background-color: #E3F2FD !important;
          color: #1565C0 !important;
          font-weight: 600 !important;
          border: 2px solid #2196F3 !important;
          border-radius: 0.5rem !important;
          box-shadow: 0 1px 3px rgba(33, 150, 243, 0.2) !important;
        }
        /* Today that is also a payday - combine both styles with priority to payday */
        .rdp-day_today.paydays,
        button.rdp-day_today.paydays {
          background-color: #00A86B !important;
          color: #FFFFFF !important;
          border: 2px solid #00C580 !important;
          box-shadow: 0 3px 6px rgba(0, 168, 107, 0.5) !important;
        }
        /* Dynamically generated per-paycheck colors (same color for this & next) */
        ${incomes
          .map((_, idx) => {
            const color = colorPalette[idx % colorPalette.length];
            return `
              /* This Month payday colors */
              .cal-${idx}-this,
              .rdp-day.cal-${idx}-this,
              button.cal-${idx}-this,
              button.rdp-day.cal-${idx}-this,
              [class*="cal-${idx}-this"],
              button[class*="cal-${idx}-this"].rdp-day,
              .rdp-day[class*="cal-${idx}-this"],
              button.rdp-day[class*="cal-${idx}-this"] {
                background-color: ${color} !important;
                color: #FFFFFF !important;
                font-weight: 700 !important;
                border-radius: 0.5rem !important;
                box-shadow: 0 2px 4px ${color}33 !important;
              }
              /* Next Month payday colors (slightly transparent) */
              .cal-${idx}-next,
              .rdp-day.cal-${idx}-next,
              button.cal-${idx}-next,
              button.rdp-day.cal-${idx}-next,
              [class*="cal-${idx}-next"],
              button[class*="cal-${idx}-next"].rdp-day,
              .rdp-day[class*="cal-${idx}-next"],
              button.rdp-day[class*="cal-${idx}-next"] {
                background-color: ${color} !important;
                color: #FFFFFF !important;
                font-weight: 700 !important;
                border-radius: 0.5rem !important;
                opacity: 0.7 !important;
                outline: 2px solid rgba(0,0,0,0.05) !important;
                box-shadow: 0 1px 2px ${color}26 !important;
              }
            `;
          })
          .join("\n")}
        /* Generic next-month fallback */
        .cal-any-next {
          background-color: #00A86B !important;
          color: #FFFFFF !important;
          font-weight: 700 !important;
          border-radius: 0.5rem !important;
          opacity: 0.6 !important;
        }
      `}</style>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-2">
          <CardHeader className="pb-2">
            <CardTitle>This Month</CardTitle>
            <CardDescription>Paydays highlighted</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Calendar
              mode="single"
              selected={undefined}
              month={thisMonth}
              onMonthChange={() => {}}
              modifiers={{ 
                paydaysPast: incomesThisMonthPast,
                ...thisMonthModifiers
              }}
              modifiersClassNames={thisMonthClassNames}
              classNames={{
                cell: "h-10 w-10 p-0",
                day: "h-10 w-10 rounded-md",
                day_today: "bg-blue-100 dark:bg-blue-900/30 border-2 border-blue-500 text-blue-700 dark:text-blue-300"
              }}
              className="pointer-events-none"
            />
          </CardContent>
        </Card>

        <Card className="border-2">
          <CardHeader className="pb-2">
            <CardTitle>Next Month</CardTitle>
            <CardDescription>Upcoming paydays</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Calendar
              mode="single"
              selected={undefined}
              month={nextMonth}
              onMonthChange={() => {}}
              modifiers={{ ...nextMonthModifiers }}
              modifiersClassNames={nextMonthClassNames}
              classNames={{
                cell: "h-10 w-10 p-0",
                day: "h-10 w-10 rounded-md",
                day_today: "bg-blue-100 dark:bg-blue-900/30 border-2 border-blue-500 text-blue-700 dark:text-blue-300"
              }}
              className="pointer-events-none"
            />
          </CardContent>
        </Card>
      </div>

      {/* Paycheck Slots */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Paychecks</h2>
        <Button variant="secondary" onClick={() => setDialogOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Paycheck
        </Button>
      </div>

      <div className="grid gap-4">
        {/* Existing Paycheck Entries */}
        {incomes.map((income) => (
          <Card key={income.id} className="border-2 hover:shadow-card-hover transition-smooth">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <CardTitle>{income.name}</CardTitle>
                    {(() => {
                      const paydayDate = toTzDate(income.due_date);
                      const isPaydayPast = isPast(paydayDate) && !isToday(paydayDate);
                      return isPaydayPast ? (
                        <Badge variant="secondary" className="text-xs">Already received</Badge>
                      ) : null;
                    })()}
                  </div>
                  <CardDescription>
                    {income.bank_accounts.name} • {format(new Date(income.due_date), "PPP")}
                  </CardDescription>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => handleEditIncome(income)}>
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDeleteIncome(income.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">This Month</p>
                  {(() => {
                    const paydayDate = toTzDate(income.due_date);
                    const isPaydayPast = isPast(paydayDate) && !isToday(paydayDate);
                    const displayAmount = isPaydayPast ? 0 : Number(income.amount_now);
                    return (
                      <>
                        <p className="text-2xl font-bold text-foreground">${displayAmount.toFixed(2)}</p>
                        {isPaydayPast && (
                          <p className="text-xs text-muted-foreground mt-1">Received on {format(paydayDate, "MMM d")}</p>
                        )}
                      </>
                    );
                  })()}
                </div>
            <div>
                  <p className="text-sm text-muted-foreground mb-1">Next Month</p>
                  <p className="text-2xl font-bold text-foreground">${Number(income.amount_next).toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground mt-1">Expected amount</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {/* Show enough default slots so the user sees 3 total (replace dynamically, not by name) */}
        {Array.from({ length: Math.max(0, 3 - incomes.length) }).map((_, idx) => {
          const slotNumber = incomes.length + idx + 1; // e.g., if 1 exists -> 2,3
          const slotName = `Paycheck ${slotNumber}`;
          if (dismissedSlots.has(slotNumber)) return null;

          return (
            <Card key={`slot-${slotNumber}`} className="border-2 border-dashed">
              <CardContent className="py-6 flex items-center justify-between">
                <div className="space-y-1">
                  <p className="font-medium">{slotName}</p>
                  <p className="text-sm text-muted-foreground">Create an expected paycheck</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="icon" onClick={() => handleDismissSlot(slotNumber)}>
                    <X className="w-4 h-4" />
                  </Button>
                  <Button variant="secondary" onClick={() => openPrefilledDialog(slotName)}>
                    Add
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {/* Additional paycheck slots beyond the default 3 */}
        {incomes.length > 3 && Array.from({ length: incomes.length - 3 }).map((_, idx) => {
          const slotNumber = 4 + idx;
          const slotName = `Paycheck ${slotNumber}`;
          const exists = incomes.some(inc => inc.name === slotName);
          if (exists) return null;
          
          return (
            <Card key={`slot-${slotNumber}`} className="border-2 border-dashed">
              <CardContent className="py-6 flex items-center justify-between">
                <div className="space-y-1">
                  <p className="font-medium">{slotName}</p>
                  <p className="text-sm text-muted-foreground">Create an expected paycheck</p>
            </div>
                <Button variant="secondary" onClick={() => openPrefilledDialog(slotName)}>
                  Add
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Add/Edit Paycheck Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => {
        setDialogOpen(open);
        if (!open) {
          setEditingIncome(null);
          setFormData({ name: "", amount_now: "", amount_next: "", bank_account_id: "" });
          setDueDate(undefined);
        }
      }}>
              <DialogContent className="max-w-md">
                <DialogHeader>
            <DialogTitle>{editingIncome ? "Edit Paycheck" : "Add Paycheck"}</DialogTitle>
            <DialogDescription>
              {editingIncome 
                ? "Update paycheck amounts for this month and next month"
                : "Visualize your upcoming income"
              }
            </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleAddIncome} className="space-y-4">
                  <div className="space-y-2">
              <Label htmlFor="name">Paycheck Name</Label>
              <Input id="name" placeholder="Paycheck 1, Freelance, etc." value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
                  </div>
            <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                <Label htmlFor="amount_now">This Month Amount</Label>
                    <Input
                      id="amount_now"
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={formData.amount_now}
                      onChange={(e) => setFormData({ ...formData, amount_now: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                <Label htmlFor="amount_next">Next Month Amount</Label>
                    <Input
                      id="amount_next"
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={formData.amount_next}
                      onChange={(e) => setFormData({ ...formData, amount_next: e.target.value })}
                      required
                    />
              </div>
                  </div>
                  <div className="space-y-2">
              <Label>Payday Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !dueDate && "text-muted-foreground")}> 
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {dueDate ? format(dueDate, "PPP") : <span>Pick a date</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={dueDate} onSelect={setDueDate} initialFocus className="pointer-events-auto" />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bank_account">Bank Account</Label>
              <Select value={formData.bank_account_id} onValueChange={(value) => setFormData({ ...formData, bank_account_id: value })} required>
                      <SelectTrigger>
                        <SelectValue placeholder="Select account" />
                      </SelectTrigger>
                      <SelectContent>
                        {accounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>{account.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button type="submit" className="w-full" variant="secondary">
              {editingIncome ? "Update Paycheck" : "Save Paycheck"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
    </div>
  );
};

export default Income;
