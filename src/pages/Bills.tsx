import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Trash2, Calendar as CalendarIcon, X, Edit2, Info, ChevronDown, ChevronUp } from "lucide-react";
import { format, startOfToday, startOfDay, addMonths, isSameMonth, startOfMonth, isPast, isToday } from "date-fns";
import { cn } from "@/lib/utils";
import { getNextIncomeDue, type IncomeItem } from "@/lib/calculations";

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

const Bills = () => {
  const [bills, setBills] = useState<Bill[]>([]);
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [incomes, setIncomes] = useState<IncomeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingBill, setEditingBill] = useState<Bill | null>(null);
  const [paymentDate, setPaymentDate] = useState<Date | undefined>();
  const [dismissedSlots, setDismissedSlots] = useState<Set<number>>(new Set());
  const [calendarsOpen, setCalendarsOpen] = useState(false);
  const [billsListOpen, setBillsListOpen] = useState(true);
  const [billsSummaryOpen, setBillsSummaryOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    category: "",
    amount_now: "",
    amount_next: "",
    bank_account_id: "",
    scheduled_type: "Scheduled",
  });
  const { toast } = useToast();
  const hasCheckedUpdatesRef = useRef(false);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Automatically update bill dates when month transitions
  useEffect(() => {
    if (bills.length === 0 || loading) return;
    if (hasCheckedUpdatesRef.current) return;
    hasCheckedUpdatesRef.current = true;

    const updateBillDates = async () => {
      const resolvedTz = localStorage.getItem("userTimezone") || Intl.DateTimeFormat().resolvedOptions().timeZone;
      const nowInTz = () => new Date(new Date().toLocaleString("en-US", { timeZone: resolvedTz }));
      const tzNow = nowInTz();
      const thisMonth = startOfMonth(tzNow);
      const today = startOfToday();

      const toTzDate = (dIso: string | null) => {
        if (!dIso) return null;
        const d = new Date(new Date(dIso).toLocaleString("en-US", { timeZone: resolvedTz }));
        d.setHours(0, 0, 0, 0);
        return d;
      };

      const updates: Array<{ id: string; payment_date: string | null; payment_date_next: string | null; amount_now: number; amount_next: number }> = [];

      for (const bill of bills) {
        const dateThis = toTzDate(bill.payment_date);
        const dateNext = toTzDate(bill.payment_date_next);
        let needsUpdate = false;
        let newPaymentDate: Date | null = dateThis;
        let newPaymentDateNext: Date | null = dateNext;
        let newAmountNow = bill.amount_now;
        let newAmountNext = bill.amount_next;

        // If payment_date is in the past month, move it forward
        // But keep the bill visible and preserve amounts
        if (dateThis && !isSameMonth(dateThis, thisMonth)) {
          // If payment_date is in a past month, we need to handle it
          // If we have a payment_date_next that's in this month, use it
          if (dateNext && isSameMonth(dateNext, thisMonth)) {
            newPaymentDate = dateNext;
            newAmountNow = bill.amount_next;
            // Generate next month date from the new payment date
            const nextMonthDate = addMonths(newPaymentDate, 1);
            newPaymentDateNext = nextMonthDate;
            newAmountNext = bill.amount_next; // Keep the amount
            needsUpdate = true;
          } else if (dateThis < thisMonth) {
            // Payment date is in past month, but no valid next date
            // Keep the bill but move the date to next occurrence (same day next month)
            const nextOccurrence = addMonths(dateThis, 1);
            // If next occurrence is still in past, move to this month's same day
            if (nextOccurrence < thisMonth) {
              const thisMonthDay = new Date(thisMonth);
              thisMonthDay.setDate(dateThis.getDate());
              // If the day doesn't exist in this month (e.g., Feb 30), use last day of month
              if (thisMonthDay.getMonth() !== thisMonth.getMonth()) {
                thisMonthDay.setDate(0); // Last day of previous month
                thisMonthDay.setMonth(thisMonth.getMonth());
                thisMonthDay.setDate(new Date(thisMonth.getFullYear(), thisMonth.getMonth() + 1, 0).getDate());
              }
              newPaymentDate = thisMonthDay;
            } else {
              newPaymentDate = nextOccurrence;
            }
            // Generate next month date
            newPaymentDateNext = addMonths(newPaymentDate, 1);
            needsUpdate = true;
          }
        }
        // If payment_date_next is now in "this month", move it to payment_date
        else if (dateNext && isSameMonth(dateNext, thisMonth) && dateThis && !isSameMonth(dateThis, thisMonth)) {
          newPaymentDate = dateNext;
          newAmountNow = bill.amount_next;
          // Generate next month date from the new payment date
          const nextMonthDate = addMonths(newPaymentDate, 1);
          newPaymentDateNext = nextMonthDate;
          newAmountNext = bill.amount_next;
          needsUpdate = true;
        }

        if (needsUpdate) {
          updates.push({
            id: bill.id,
            payment_date: newPaymentDate ? newPaymentDate.toISOString() : null,
            payment_date_next: newPaymentDateNext ? newPaymentDateNext.toISOString() : null,
            amount_now: newAmountNow,
            amount_next: newAmountNext,
          });
        }
      }

      // Batch update all bills that need updating
      if (updates.length > 0) {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        // Update each bill
        for (const update of updates) {
          await supabase
            .from("bills")
            .update({
              payment_date: update.payment_date,
              payment_date_next: update.payment_date_next,
              amount_now: update.amount_now,
              amount_next: update.amount_next,
            })
            .eq("id", update.id);
        }

        // Refresh data after updates
        fetchData();
      }
    };

    updateBillDates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bills.length, loading]);

  const fetchData = async () => {
    setLoading(true);
    const [billsRes, accountsRes, incomesRes] = await Promise.all([
      supabase.from("bills").select("*, bank_accounts(id, name)").order("payment_date", { ascending: true, nullsFirst: false }),
      supabase.from("bank_accounts").select("id, name"),
      supabase.from("income").select("*").order("due_date", { ascending: true }),
    ]);

    if (billsRes.error) {
      toast({ variant: "destructive", title: "Error", description: "Failed to fetch bills data" });
    } else {
      setBills(billsRes.data || []);
      hasCheckedUpdatesRef.current = false;
    }

    if (accountsRes.error) {
      toast({ variant: "destructive", title: "Error", description: "Failed to fetch accounts" });
    } else {
      setAccounts(accountsRes.data || []);
    }

    if (incomesRes.error) {
      toast({ variant: "destructive", title: "Error", description: "Failed to fetch income" });
    } else {
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
    }

    setLoading(false);
  };

  const handleAddBill = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNow = formData.amount_now === "" ? 0 : parseFloat(formData.amount_now) || 0;
    const amountNext = formData.amount_next === "" ? 0 : parseFloat(formData.amount_next) || 0;

    // Payment date is always required for bills
    if (!paymentDate) {
      toast({ variant: "destructive", title: "Error", description: "Please select a payment date for This Month" });
      return;
    }

    if (!formData.category) {
      toast({ variant: "destructive", title: "Error", description: "Please select a category" });
      return;
    }

    if (!formData.bank_account_id) {
      toast({ variant: "destructive", title: "Error", description: "Please select a bank account" });
      return;
    }

    // Auto-generate next month payment date from this month's payment date
    const nextMonthDate = addMonths(paymentDate, 1);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    if (editingBill) {
      // Update existing bill
      // Extract calendar_day from payment_date (day of month, 1-31)
      const calendarDay = paymentDate.getDate();
      
      const { error } = await supabase
        .from("bills")
        .update({
          name: formData.name,
          category: formData.category,
          amount_now: amountNow,
          amount_next: amountNext,
          amount_this_month: amountNow, // Map to amount_this_month if column exists
          amount_next_month: amountNext, // Map to amount_next_month if column exists
          payment_date: paymentDate.toISOString(),
          payment_date_next: nextMonthDate.toISOString(),
          bank_account_id: formData.bank_account_id,
          scheduled_type: formData.scheduled_type,
          autopay_marker: formData.scheduled_type, // Map scheduled_type to autopay_marker
          calendar_day: calendarDay,
        })
        .eq("id", editingBill.id);

      if (error) {
        console.error("Update bill error:", error);
        toast({ 
          variant: "destructive", 
          title: "Error", 
          description: error.message || "Failed to update bill" 
        });
      } else {
        toast({ title: "Success!", description: "Bill updated" });
        setDialogOpen(false);
        setEditingBill(null);
        setFormData({ name: "", category: "", amount_now: "", amount_next: "", bank_account_id: "", scheduled_type: "Scheduled" });
        setPaymentDate(undefined);
        fetchData();
      }
    } else {
      // Insert new bill
      // Extract calendar_day from payment_date (day of month, 1-31)
      const calendarDay = paymentDate.getDate();
      
      const { error } = await supabase.from("bills").insert({
        user_id: session.user.id,
        name: formData.name,
        category: formData.category,
        amount_now: amountNow,
        amount_next: amountNext,
        amount_this_month: amountNow, // Map to amount_this_month if column exists
        amount_next_month: amountNext, // Map to amount_next_month if column exists
        payment_date: paymentDate.toISOString(),
        payment_date_next: nextMonthDate.toISOString(),
        bank_account_id: formData.bank_account_id,
        scheduled_type: formData.scheduled_type,
        autopay_marker: formData.scheduled_type, // Map scheduled_type to autopay_marker
        calendar_day: calendarDay,
      });

      if (error) {
        console.error("Add bill error:", error);
        console.error("Insert data:", {
          user_id: session.user.id,
          name: formData.name,
          category: formData.category,
          amount_now: amountNow,
          amount_next: amountNext,
          payment_date: paymentDate.toISOString(),
          payment_date_next: nextMonthDate.toISOString(),
          bank_account_id: formData.bank_account_id,
          scheduled_type: formData.scheduled_type,
        });
        toast({ 
          variant: "destructive", 
          title: "Error", 
          description: error.message || "Failed to add bill" 
        });
      } else {
        toast({ title: "Success!", description: "Bill added" });
        setDialogOpen(false);
        setFormData({ name: "", category: "", amount_now: "", amount_next: "", bank_account_id: "", scheduled_type: "Scheduled" });
        setPaymentDate(undefined);
        fetchData();
      }
    }
  };

  const handleEditBill = (bill: Bill) => {
    setEditingBill(bill);
    setFormData({
      name: bill.name,
      category: bill.category,
      amount_now: bill.amount_now.toString(),
      amount_next: bill.amount_next.toString(),
      bank_account_id: bill.bank_account_id,
      scheduled_type: bill.scheduled_type,
    });
    setPaymentDate(bill.payment_date ? new Date(bill.payment_date) : undefined);
    setDialogOpen(true);
  };

  const handleDeleteBill = async (id: string) => {
    const { error } = await supabase.from("bills").delete().eq("id", id);
    if (error) {
      toast({ variant: "destructive", title: "Error", description: "Failed to delete bill" });
    } else {
      toast({ title: "Deleted", description: "Bill removed" });
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

  const toTzDate = (dIso: string | null) => {
    if (!dIso) return null;
    const d = new Date(new Date(dIso).toLocaleString("en-US", { timeZone: resolvedTz }));
    d.setHours(0, 0, 0, 0);
    return d;
  };

  // Get bills for this month and next month
  const billsThisMonthData = bills
    .filter(b => {
      const d = toTzDate(b.payment_date);
      const dNext = toTzDate(b.payment_date_next);
      return (d && isSameMonth(d, thisMonth)) || (dNext && isSameMonth(dNext, thisMonth));
    })
    .map(b => {
      const d = toTzDate(b.payment_date);
      const dNext = toTzDate(b.payment_date_next);
      const targetDate = (d && isSameMonth(d, thisMonth)) ? d : dNext;
      return { date: targetDate!, bill: b };
    });

  const billsThisMonthPast = billsThisMonthData
    .filter(item => {
      const itemDate = item.date;
      const today = startOfDay(startOfToday());
      return itemDate < today && !isToday(itemDate);
    })
    .map(item => startOfDay(item.date));

  const billsThisMonthFuture = billsThisMonthData
    .filter(item => {
      const itemDate = item.date;
      const today = startOfToday();
      return itemDate >= today || isToday(itemDate);
    })
    .map(item => item.date);

  const billsThisMonth = billsThisMonthData.map(item => item.date);

  // Get next paycheck date
  const nextPaycheckDate = getNextIncomeDue(incomes);

  // Get next month bills
  const billsNextMonth = bills
    .filter(b => {
      const dNext = toTzDate(b.payment_date_next);
      const d = toTzDate(b.payment_date);
      return (dNext && isSameMonth(dNext, nextMonth)) || (d && isSameMonth(d, nextMonth));
    })
    .map(b => {
      const dNext = toTzDate(b.payment_date_next);
      const d = toTzDate(b.payment_date);
      const targetDate = (dNext && isSameMonth(dNext, nextMonth)) ? dNext : d;
      if (targetDate) {
        targetDate.setHours(0, 0, 0, 0);
        return targetDate;
      }
      return null;
    })
    .filter((d): d is Date => d !== null);

  // Per-bill color coding
  const colorPalette = [
    "#DC2626", // Red
    "#EA580C", // Orange
    "#CA8A04", // Yellow
    "#65A30D", // Green
    "#059669", // Emerald
    "#0891B2", // Cyan
    "#0284C7", // Blue
    "#2563EB", // Indigo
    "#7C3AED", // Purple
    "#C026D3", // Pink
  ];

  type ModRecord = Record<string, Date[]>;
  const thisMonthModifiers: ModRecord = {};
  const nextMonthModifiers: ModRecord = {};

  const billInfoByDate = new Map<string, { name: string; amount: number; idx: number }[]>();

  const thisMonthClassNames: Record<string, string> = {
    billsPast: "bills-past",
  };
  const nextMonthClassNames: Record<string, string> = {};

  bills.forEach((bill, idx) => {
    const keyThis = `bill${idx}This`;
    const keyNext = `bill${idx}Next`;
    const dateThis = toTzDate(bill.payment_date);
    const dateNext = toTzDate(bill.payment_date_next);

    // This Month
    let thisMonthDate: Date | null = null;
    let thisMonthAmount = bill.amount_now;

    if (dateThis && isSameMonth(dateThis, thisMonth)) {
      thisMonthDate = dateThis;
      thisMonthAmount = bill.amount_now;
    } else if (dateNext && isSameMonth(dateNext, thisMonth)) {
      thisMonthDate = dateNext;
      thisMonthAmount = bill.amount_next;
    }

    if (thisMonthDate) {
      const normalizedDate = startOfDay(thisMonthDate);
      const dateOnly = new Date(normalizedDate.getFullYear(), normalizedDate.getMonth(), normalizedDate.getDate());
      thisMonthModifiers[keyThis] = [dateOnly];
      thisMonthClassNames[keyThis] = `cal-${idx}-this`;
      const dateKey = dateOnly.toISOString();
      const existing = billInfoByDate.get(dateKey) || [];
      billInfoByDate.set(dateKey, [...existing, { name: bill.name, amount: thisMonthAmount, idx }]);
    }

    // Next Month
    let nextDate: Date | null = null;
    if (dateNext && isSameMonth(dateNext, nextMonth)) {
      nextDate = startOfDay(dateNext);
    } else if (dateThis && isSameMonth(dateThis, nextMonth)) {
      nextDate = startOfDay(dateThis);
    }

    if (nextDate) {
      const dateOnly = new Date(nextDate.getFullYear(), nextDate.getMonth(), nextDate.getDate());
      nextMonthModifiers[keyNext] = [dateOnly];
      nextMonthClassNames[keyNext] = `cal-${idx}-next`;
      const dateKey = `next-${dateOnly.toISOString()}`;
      const existing = billInfoByDate.get(dateKey) || [];
      billInfoByDate.set(dateKey, [...existing, { name: bill.name, amount: bill.amount_next, idx }]);
    }
  });

  const nextMonthAll: Date[] = Object.values(nextMonthModifiers).flat();
  if (nextMonthAll.length > 0) {
    (nextMonthModifiers as any).anyNextBill = nextMonthAll;
    nextMonthClassNames["anyNextBill"] = "cal-any-next";
  }

  // Add next paycheck date as a modifier
  if (nextPaycheckDate) {
    const paycheckDate = startOfDay(nextPaycheckDate);
    const paycheckDateOnly = new Date(paycheckDate.getFullYear(), paycheckDate.getMonth(), paycheckDate.getDate());
    
    // Add to this month if it's in this month
    if (isSameMonth(paycheckDateOnly, thisMonth)) {
      thisMonthModifiers["nextPaycheck"] = [paycheckDateOnly];
      thisMonthClassNames["nextPaycheck"] = "next-paycheck";
    }
    // Add to next month if it's in next month
    if (isSameMonth(paycheckDateOnly, nextMonth)) {
      nextMonthModifiers["nextPaycheck"] = [paycheckDateOnly];
      nextMonthClassNames["nextPaycheck"] = "next-paycheck";
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <Loader2 className="w-8 h-8 animate-spin text-secondary" />
      </div>
    );
  }

  const openPrefilledDialog = (name: string) => {
    setFormData(prev => ({ ...prev, name }));
    setDialogOpen(true);
  };

  const handleDismissSlot = (slotNumber: number) => {
    setDismissedSlots(prev => new Set(prev).add(slotNumber));
  };

  // Calculate scoreboard metrics
  // 1. This Month Bills Locked In - all bills in this month (including past ones)
  const thisMonthBillsLockedIn = bills
    .filter(b => {
      const d = toTzDate(b.payment_date);
      const dNext = toTzDate(b.payment_date_next);
      return (d && isSameMonth(d, thisMonth)) || (dNext && isSameMonth(dNext, thisMonth));
    })
    .reduce((sum, b) => {
      const d = toTzDate(b.payment_date);
      const dNext = toTzDate(b.payment_date_next);
      if (d && isSameMonth(d, thisMonth)) {
        return sum + Number(b.amount_now);
      } else if (dNext && isSameMonth(dNext, thisMonth)) {
        return sum + Number(b.amount_next);
      }
      return sum;
    }, 0);

  // 2. Next Month Bills Locked In - all bills in next month
  const nextMonthBillsLockedIn = bills
    .filter(b => {
      const dNext = toTzDate(b.payment_date_next);
      const d = toTzDate(b.payment_date);
      return (dNext && isSameMonth(dNext, nextMonth)) || (d && isSameMonth(d, nextMonth));
    })
    .reduce((sum, b) => {
      const dNext = toTzDate(b.payment_date_next);
      const d = toTzDate(b.payment_date);
      if (dNext && isSameMonth(dNext, nextMonth)) {
        return sum + Number(b.amount_next);
      } else if (d && isSameMonth(d, nextMonth)) {
        return sum + Number(b.amount_next);
      }
      return sum;
    }, 0);

  // 3. Bills to Close Before Next Paycheck - bills in this month that are due before next paycheck
  const billsToCloseBeforePaycheck = bills
    .filter(b => {
      const d = toTzDate(b.payment_date);
      const dNext = toTzDate(b.payment_date_next);
      const isInThisMonth = (d && isSameMonth(d, thisMonth)) || (dNext && isSameMonth(dNext, thisMonth));
      if (!isInThisMonth || !nextPaycheckDate) return false;
      const itemDate = (d && isSameMonth(d, thisMonth)) ? d : dNext;
      if (!itemDate) return false;
      return itemDate < nextPaycheckDate;
    })
    .reduce((sum, b) => {
      const d = toTzDate(b.payment_date);
      const dNext = toTzDate(b.payment_date_next);
      if (d && isSameMonth(d, thisMonth)) {
        const itemDate = d;
        if (nextPaycheckDate && itemDate < nextPaycheckDate) {
          return sum + Number(b.amount_now);
        }
      } else if (dNext && isSameMonth(dNext, thisMonth)) {
        const itemDate = dNext;
        if (nextPaycheckDate && itemDate < nextPaycheckDate) {
          return sum + Number(b.amount_next);
        }
      }
      return sum;
    }, 0);

  // 4. Bills Open After Paycheck - bills in this month that are due on or after next paycheck
  const billsOpenAfterPaycheck = bills
    .filter(b => {
      const d = toTzDate(b.payment_date);
      const dNext = toTzDate(b.payment_date_next);
      const isInThisMonth = (d && isSameMonth(d, thisMonth)) || (dNext && isSameMonth(dNext, thisMonth));
      if (!isInThisMonth) return false;
      const itemDate = (d && isSameMonth(d, thisMonth)) ? d : dNext;
      if (!itemDate) return false;
      if (!nextPaycheckDate) return true; // If no next paycheck, treat as open
      return itemDate >= nextPaycheckDate;
    })
    .reduce((sum, b) => {
      const d = toTzDate(b.payment_date);
      const dNext = toTzDate(b.payment_date_next);
      if (d && isSameMonth(d, thisMonth)) {
        const itemDate = d;
        if (!nextPaycheckDate || itemDate >= nextPaycheckDate) {
          return sum + Number(b.amount_now);
        }
      } else if (dNext && isSameMonth(dNext, thisMonth)) {
        const itemDate = dNext;
        if (!nextPaycheckDate || itemDate >= nextPaycheckDate) {
          return sum + Number(b.amount_next);
        }
      }
      return sum;
    }, 0);

  // Calculate totals for the summary row (keeping existing logic)
  const totalThisMonth = bills
    .filter(b => {
      const d = toTzDate(b.payment_date);
      const dNext = toTzDate(b.payment_date_next);
      const isInThisMonth = (d && isSameMonth(d, thisMonth)) || (dNext && isSameMonth(dNext, thisMonth));
      if (!isInThisMonth) return false;
      const itemDate = (d && isSameMonth(d, thisMonth)) ? d : dNext;
      if (!itemDate) return false;
      const today = startOfToday();
      return itemDate >= today || isToday(itemDate);
    })
    .reduce((sum, b) => {
      const d = toTzDate(b.payment_date);
      const dNext = toTzDate(b.payment_date_next);
      if (d && isSameMonth(d, thisMonth)) {
        const itemDate = d;
        const today = startOfToday();
        if (itemDate >= today || isToday(itemDate)) {
          return sum + Number(b.amount_now);
        }
      } else if (dNext && isSameMonth(dNext, thisMonth)) {
        const itemDate = dNext;
        const today = startOfToday();
        if (itemDate >= today || isToday(itemDate)) {
          return sum + Number(b.amount_next);
        }
      }
      return sum;
    }, 0);

  const totalNextMonth = bills
    .filter(b => {
      const dNext = toTzDate(b.payment_date_next);
      const d = toTzDate(b.payment_date);
      return (dNext && isSameMonth(dNext, nextMonth)) || (d && isSameMonth(d, nextMonth));
    })
    .reduce((sum, b) => {
      const dNext = toTzDate(b.payment_date_next);
      const d = toTzDate(b.payment_date);
      if (dNext && isSameMonth(dNext, nextMonth)) {
        return sum + Number(b.amount_next);
      } else if (d && isSameMonth(d, nextMonth)) {
        return sum + Number(b.amount_next);
      }
      return sum;
    }, 0);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Page Title */}
      <div className="text-center py-2">
        <h1 className="text-2xl font-bold">My Bills Tab</h1>
      </div>

      {/* Calendars - Collapsible */}
      <Collapsible open={calendarsOpen} onOpenChange={setCalendarsOpen}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Bills Calendars</h2>
          <CollapsibleTrigger asChild>
            <Button variant="outline" size="sm">
              {calendarsOpen ? (
                <>
                  <ChevronUp className="w-4 h-4 mr-2" />
                  Hide Bills Calendars
                </>
              ) : (
                <>
                  <ChevronDown className="w-4 h-4 mr-2" />
                  See Bills Calendars
                </>
              )}
            </Button>
          </CollapsibleTrigger>
        </div>
        <CollapsibleContent>
          {/* Today Banner */}
          <div className="text-center py-2 mb-4">
            <p className="text-sm text-muted-foreground">Today</p>
            <p className="text-lg font-semibold">{new Intl.DateTimeFormat("en-US", { weekday: "long", month: "short", day: "numeric", timeZone: resolvedTz }).format(new Date())}</p>
          </div>
      <style>{`
        .rdp .rdp-nav,
        .rdp button.rdp-nav_button_previous,
        .rdp button.rdp-nav_button_next,
        .rdp button[class*="nav"],
        .rdp .rdp-caption button,
        .rdp button[aria-label*="previous"],
        .rdp button[aria-label*="next"] {
          display: none !important;
          visibility: hidden !important;
          opacity: 0 !important;
          pointer-events: none !important;
        }
        
        .rdp button[class*="cal-"] {
          background-color: var(--bill-color) !important;
          color: #FFFFFF !important;
          font-weight: 700 !important;
          border-radius: 0.5rem !important;
        }
        
        .rdp button.rdp-day.rdp-day_today:not([class*="cal-"]):not([class*="bills-past"]):not([style*="background-color"]) {
          background-color: #FEF9E7 !important;
          color: #856404 !important;
          font-weight: 600 !important;
          border: 2px solid #F59E0B !important;
          border-radius: 0.5rem !important;
          box-shadow: 0 1px 3px rgba(245, 158, 11, 0.2) !important;
        }
        
        .rdp button.rdp-day[class*="bills-past"] {
          background-color: #E0E0E0 !important;
          color: #616161 !important;
          font-weight: 600 !important;
          border-radius: 0.5rem !important;
          border: 2px dashed #9E9E9E !important;
          opacity: 0.8 !important;
        }
        
        /* Date range highlighting for This Month */
        .rdp button.rdp-day.date-before-today:not([class*="cal-"]):not([class*="bills-past"]) {
          background-color: #E5E5E5 !important;
          color: #757575 !important;
        }
        
        .rdp button.rdp-day.date-today-to-paycheck:not([class*="cal-"]):not([class*="bills-past"]) {
          background-color: #FEF9E7 !important;
          color: #856404 !important;
        }
        
        .rdp button.rdp-day.date-after-paycheck:not([class*="cal-"]):not([class*="bills-past"]) {
          background-color: #F5F5F5 !important;
          color: #757575 !important;
        }
        
        /* All dates in Next Month calendar */
        .rdp button.rdp-day.next-month-date:not([class*="cal-"]):not([class*="bills-past"]) {
          background-color: #F5F5F5 !important;
          color: #757575 !important;
        }
        
        ${bills
          .map((_, idx) => {
            const color = colorPalette[idx % colorPalette.length];
            return `
              .rdp button.cal-${idx}-this,
              .rdp button.rdp-day.cal-${idx}-this,
              .rdp button[class*="cal-${idx}-this"],
              .rdp .rdp-day.cal-${idx}-this,
              .rdp [class*="cal-${idx}-this"] {
                background-color: ${color} !important;
                background: ${color} !important;
                color: #FFFFFF !important;
                font-weight: 700 !important;
                border-radius: 0.5rem !important;
                box-shadow: 0 2px 4px ${color}33 !important;
              }
              .rdp button.cal-${idx}-next,
              .rdp button.rdp-day.cal-${idx}-next,
              .rdp button[class*="cal-${idx}-next"],
              .rdp .rdp-day.cal-${idx}-next,
              .rdp [class*="cal-${idx}-next"] {
                background-color: ${color} !important;
                background: ${color} !important;
                color: #FFFFFF !important;
                font-weight: 700 !important;
                border-radius: 0.5rem !important;
                opacity: 0.7 !important;
                outline: 2px solid rgba(0,0,0,0.05) !important;
                box-shadow: 0 1px 2px ${color}26 !important;
              }
              .rdp button.rdp-day_today.cal-${idx}-this,
              .rdp button.rdp-day.rdp-day_today.cal-${idx}-this,
              .rdp button.rdp-day.rdp-day_today[class*="cal-${idx}-this"] {
                background-color: ${color} !important;
                background: ${color} !important;
                color: #FFFFFF !important;
                border: 2px solid ${color} !important;
                box-shadow: 0 3px 6px ${color}66 !important;
              }
              .rdp button.rdp-day_today.cal-${idx}-next,
              .rdp button.rdp-day.rdp-day_today.cal-${idx}-next,
              .rdp button.rdp-day.rdp-day_today[class*="cal-${idx}-next"] {
                background-color: ${color} !important;
                background: ${color} !important;
                color: #FFFFFF !important;
                border: 2px solid ${color} !important;
                opacity: 0.85 !important;
                box-shadow: 0 3px 6px ${color}66 !important;
              }
            `;
          })
          .join("\n")}
        .rdp button[class*="cal-any-next"] {
          background-color: #DC2626 !important;
          background: #DC2626 !important;
          color: #FFFFFF !important;
          font-weight: 700 !important;
          border-radius: 0.5rem !important;
          opacity: 0.6 !important;
        }
        
        /* Next Paycheck Date Marker */
        .rdp button.next-paycheck,
        .rdp button.rdp-day.next-paycheck,
        .rdp button[class*="next-paycheck"] {
          border: 3px solid #00A86B !important;
          border-style: dashed !important;
          box-shadow: 0 0 0 2px rgba(0, 168, 107, 0.2) !important;
          position: relative !important;
        }
        
        .rdp button.next-paycheck::after {
          content: "🚩" !important;
          position: absolute !important;
          top: -2px !important;
          right: -2px !important;
          font-size: 10px !important;
          background: #00A86B !important;
          border-radius: 50% !important;
          width: 16px !important;
          height: 16px !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          z-index: 10 !important;
        }
      `}</style>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-2">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>This Month</CardTitle>
                <CardDescription>Bills highlighted</CardDescription>
              </div>
              {nextPaycheckDate && (
                <Popover>
                  <PopoverTrigger asChild>
                    <button className="text-muted-foreground hover:text-foreground transition-colors">
                      <Info className="w-4 h-4" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent side="left" className="max-w-xs">
                    <p className="font-semibold mb-1">FYI: Close Out Tab Logic</p>
                    <p className="text-sm">
                      Bills before your next paycheck date ({format(nextPaycheckDate, "MMM d")}) are considered to be <span className="font-semibold text-green-600">closed</span>. Bills on or after your next pay date are <span className="font-semibold text-yellow-600">open</span>. This is used in the Close Out Tab.
                    </p>
                  </PopoverContent>
                </Popover>
              )}
            </div>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Calendar
              mode="single"
              selected={undefined}
              month={thisMonth}
              onMonthChange={() => {}}
              modifiers={{
                billsPast: billsThisMonthPast,
                ...thisMonthModifiers
              }}
              modifiersClassNames={thisMonthClassNames}
              classNames={{
                cell: "h-10 w-10 p-0 relative",
                day: "h-10 w-10 p-0 m-0",
              }}
              components={{
                IconLeft: () => null,
                IconRight: () => null,
                Day: (dayProps: any) => {
                  const { date, className, displayMonth, ...props } = dayProps;
                  const dateKey = startOfDay(date).toISOString();
                  const billsOnDate = billInfoByDate.get(dateKey) || [];
                  
                  // Check if this is the next paycheck date
                  const isNextPaycheck = nextPaycheckDate && 
                    startOfDay(date).getTime() === startOfDay(nextPaycheckDate).getTime() &&
                    isSameMonth(date, thisMonth);

                  // Determine date range for highlighting
                  const today = startOfToday();
                  const dateOnly = startOfDay(date);
                  let backgroundColor = "";
                  let textColor = "";
                  
                  // Check if date is from previous month (before this month)
                  const dateMonth = date.getMonth();
                  const dateYear = date.getFullYear();
                  const thisMonthNum = thisMonth.getMonth();
                  const thisYearNum = thisMonth.getFullYear();
                  
                  const isPreviousMonth = dateYear < thisYearNum || 
                    (dateYear === thisYearNum && dateMonth < thisMonthNum);
                  
                  // Check if date is from next month (after this month)
                  const isNextMonth = dateYear > thisYearNum || 
                    (dateYear === thisYearNum && dateMonth > thisMonthNum);
                  
                  if (isPreviousMonth) {
                    // Dates from previous month - gray background
                    backgroundColor = "#E5E5E5";
                    textColor = "#757575";
                  } else if (isNextMonth) {
                    // Dates from next month - light gray background
                    backgroundColor = "#F5F5F5";
                    textColor = "#757575";
                  } else if (isSameMonth(date, thisMonth)) {
                    // Dates in current month
                    if (dateOnly < today) {
                      // Before today (gray) - not including today
                      backgroundColor = "#E5E5E5";
                      textColor = "#757575";
                    } else if (nextPaycheckDate) {
                      const paycheckDate = startOfDay(nextPaycheckDate);
                      if (dateOnly <= paycheckDate) {
                        // Today to paycheck (light yellow) - including today and paycheck
                        backgroundColor = "#FEF9E7";
                        textColor = "#856404";
                      } else {
                        // After paycheck (light gray)
                        backgroundColor = "#F5F5F5";
                        textColor = "#757575";
                      }
                    } else {
                      // No paycheck date - all future dates are light gray
                      backgroundColor = "#F5F5F5";
                      textColor = "#757575";
                    }
                  }

                  const { displayMonth: _, ...restProps } = props;
                  const buttonProps: any = { ...restProps };
                  
                  if (billsOnDate.length > 0) {
                    // Use the first bill's color for the button
                    const firstBill = billsOnDate[0];
                    const billIdx = firstBill.idx;
                    const billColor = colorPalette[billIdx % colorPalette.length];
                    
                    buttonProps.style = {
                      backgroundColor: billColor,
                      color: '#FFFFFF',
                      fontWeight: '700',
                      borderRadius: '0.25rem',
                      width: '100%',
                      height: '100%',
                      minWidth: '100%',
                      minHeight: '100%',
                      padding: '0',
                      margin: '0',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: `0 2px 4px ${billColor}33`,
                      ...props.style,
                    };
                    buttonProps.className = cn(
                      className, 
                      `cal-${billIdx}-this`,
                      isNextPaycheck && "next-paycheck"
                    );
                    
                    const totalAmount = billsOnDate.reduce((sum, bill) => sum + bill.amount, 0);
                    
                    return (
                      <Popover>
                        <PopoverTrigger asChild>
                          <button {...buttonProps}>{date.getDate()}</button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-3" side="top">
                          {billsOnDate.length === 1 ? (
                            <>
                              <p className="font-semibold">{billsOnDate[0].name}</p>
                              <p className="text-sm">${formatCurrency(billsOnDate[0].amount)}</p>
                              {isNextPaycheck && (
                                <p className="text-xs text-muted-foreground mt-1">🚩 Next Paycheck</p>
                              )}
                            </>
                          ) : (
                            <>
                              <div className="space-y-2">
                                {billsOnDate.map((bill, idx) => (
                                  <div key={idx} className="flex justify-between items-center gap-4">
                                    <span className="text-sm">{bill.name}</span>
                                    <span className="text-sm font-semibold">${formatCurrency(bill.amount)}</span>
                                  </div>
                                ))}
                              </div>
                              <div className="mt-2 pt-2 border-t">
                                <div className="flex justify-between items-center">
                                  <span className="text-sm font-semibold">Total</span>
                                  <span className="text-sm font-bold">${formatCurrency(totalAmount)}</span>
                                </div>
                              </div>
                              {isNextPaycheck && (
                                <p className="text-xs text-muted-foreground mt-2">🚩 Next Paycheck</p>
                              )}
                            </>
                          )}
                        </PopoverContent>
                      </Popover>
                    );
                  }
                  
                  // Handle next paycheck date without a bill
                  if (isNextPaycheck && billsOnDate.length === 0) {
                    buttonProps.style = {
                      width: '100%',
                      height: '100%',
                      padding: '0',
                      margin: '0',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '3px dashed #00A86B',
                      boxShadow: '0 0 0 2px rgba(0, 168, 107, 0.2)',
                      position: 'relative',
                      ...props.style,
                    };
                    buttonProps.className = cn(className, "next-paycheck");
                    
                    return (
                      <Popover>
                        <PopoverTrigger asChild>
                          <button {...buttonProps}>{date.getDate()}</button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-2" side="top">
                          <p className="font-semibold">🚩 Next Paycheck</p>
                          {nextPaycheckDate && (
                            <p className="text-sm">{format(nextPaycheckDate, "MMM d, yyyy")}</p>
                          )}
                        </PopoverContent>
                      </Popover>
                    );
                  }
                  
                  // Apply background colors for dates without bills
                  if (billsOnDate.length === 0) {
                    const isDateToday = isSameMonth(date, thisMonth) && isToday(date);
                    // Build style object, ensuring backgroundColor comes after props.style
                    const baseStyle = {
                      width: '100%',
                      height: '100%',
                      padding: '0',
                      margin: '0',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      ...props.style,
                    };
                    
                    // Apply background color after props.style to ensure it takes precedence
                    if (backgroundColor) {
                      baseStyle.backgroundColor = backgroundColor;
                      baseStyle.color = textColor;
                    }
                    
                    // Apply today styling if needed
                    if (isDateToday) {
                      baseStyle.border = '2px solid #F59E0B';
                      baseStyle.fontWeight = '600';
                      baseStyle.boxShadow = '0 1px 3px rgba(245, 158, 11, 0.2)';
                    }
                    
                    buttonProps.style = baseStyle;
                  } else {
                    // For dates with bills, ensure base styles are set
                    if (!buttonProps.style) {
                      buttonProps.style = {
                        width: '100%',
                        height: '100%',
                        padding: '0',
                        margin: '0',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      };
                    }
                  }
                  
                  buttonProps.className = cn(className, props.className);
                  return <button {...buttonProps}>{date.getDate()}</button>;
                }
              }}
              className="pointer-events-auto"
            />
          </CardContent>
        </Card>

        <Card className="border-2">
          <CardHeader className="pb-2">
            <CardTitle>Next Month</CardTitle>
            <CardDescription>Upcoming bills</CardDescription>
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
                cell: "h-10 w-10 p-0 relative",
                day: "h-10 w-10 p-0 m-0",
              }}
              components={{
                IconLeft: () => null,
                IconRight: () => null,
                Day: (dayProps: any) => {
                  const { date, className, displayMonth, ...props } = dayProps;
                  const dateKeyISO = startOfDay(date).toISOString();
                  const dateKeyWithNext = `next-${dateKeyISO}`;
                  
                  // Check if this is the next paycheck date
                  const isNextPaycheck = nextPaycheckDate && 
                    startOfDay(date).getTime() === startOfDay(nextPaycheckDate).getTime() &&
                    isSameMonth(date, nextMonth);
                  
                  const billsOnDate = billInfoByDate.get(dateKeyWithNext) || [];
                  
                  // Determine background color for Next Month calendar
                  // All dates in Next Month calendar should be light gray (regardless of which month they're from)
                  let nextMonthBackgroundColor = "";
                  let nextMonthTextColor = "";
                  
                  // For Next Month calendar, all dates (previous month, current month, or future month) get light gray
                  // This creates a consistent "future/upcoming" visual
                  nextMonthBackgroundColor = "#F5F5F5";
                  nextMonthTextColor = "#757575";
                  
                  const { displayMonth: _, ...restProps } = props;
                  const buttonProps: any = { ...restProps };
                  
                  if (billsOnDate.length > 0) {
                    // Use the first bill's color for the button
                    const firstBill = billsOnDate[0];
                    const billIdx = firstBill.idx;
                    const billColor = colorPalette[billIdx % colorPalette.length];
                    
                    buttonProps.style = {
                      backgroundColor: billColor,
                      color: '#FFFFFF',
                      fontWeight: '700',
                      borderRadius: '0.25rem',
                      width: '100%',
                      height: '100%',
                      minWidth: '100%',
                      minHeight: '100%',
                      padding: '0',
                      margin: '0',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      opacity: 0.75,
                      outline: '2px solid rgba(0,0,0,0.05)',
                      boxShadow: `0 1px 2px ${billColor}26`,
                      ...props.style,
                    };
                    buttonProps.className = cn(
                      className, 
                      `cal-${billIdx}-next`,
                      isNextPaycheck && "next-paycheck"
                    );
                    
                    const totalAmount = billsOnDate.reduce((sum, bill) => sum + bill.amount, 0);
                    
                    return (
                      <Popover>
                        <PopoverTrigger asChild>
                          <button {...buttonProps}>{date.getDate()}</button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-3" side="top">
                          {billsOnDate.length === 1 ? (
                            <>
                              <p className="font-semibold">{billsOnDate[0].name}</p>
                              <p className="text-sm">${formatCurrency(billsOnDate[0].amount)}</p>
                              {isNextPaycheck && (
                                <p className="text-xs text-muted-foreground mt-1">🚩 Next Paycheck</p>
                              )}
                            </>
                          ) : (
                            <>
                              <div className="space-y-2">
                                {billsOnDate.map((bill, idx) => (
                                  <div key={idx} className="flex justify-between items-center gap-4">
                                    <span className="text-sm">{bill.name}</span>
                                    <span className="text-sm font-semibold">${formatCurrency(bill.amount)}</span>
                                  </div>
                                ))}
                              </div>
                              <div className="mt-2 pt-2 border-t">
                                <div className="flex justify-between items-center">
                                  <span className="text-sm font-semibold">Total</span>
                                  <span className="text-sm font-bold">${formatCurrency(totalAmount)}</span>
                                </div>
                              </div>
                              {isNextPaycheck && (
                                <p className="text-xs text-muted-foreground mt-2">🚩 Next Paycheck</p>
                              )}
                            </>
                          )}
                        </PopoverContent>
                      </Popover>
                    );
                  }
                  
                  // Handle next paycheck date without a bill
                  if (isNextPaycheck && billsOnDate.length === 0) {
                    buttonProps.style = {
                      width: '100%',
                      height: '100%',
                      padding: '0',
                      margin: '0',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '3px dashed #00A86B',
                      boxShadow: '0 0 0 2px rgba(0, 168, 107, 0.2)',
                      position: 'relative',
                      ...props.style,
                    };
                    buttonProps.className = cn(className, "next-paycheck");
                    
                    return (
                      <Popover>
                        <PopoverTrigger asChild>
                          <button {...buttonProps}>{date.getDate()}</button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-2" side="top">
                          <p className="font-semibold">🚩 Next Paycheck</p>
                          {nextPaycheckDate && (
                            <p className="text-sm">{format(nextPaycheckDate, "MMM d, yyyy")}</p>
                          )}
                        </PopoverContent>
                      </Popover>
                    );
                  }
                  
                  // Apply background colors for dates without bills in Next Month
                  if (billsOnDate.length === 0) {
                    const isDateToday = isSameMonth(date, nextMonth) && isToday(date);
                    // Build style object, ensuring backgroundColor comes after props.style
                    const baseStyle = {
                      width: '100%',
                      height: '100%',
                      padding: '0',
                      margin: '0',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      ...props.style,
                    };
                    
                    // Apply background color after props.style to ensure it takes precedence
                    if (nextMonthBackgroundColor) {
                      baseStyle.backgroundColor = nextMonthBackgroundColor;
                      baseStyle.color = nextMonthTextColor;
                    }
                    
                    // Apply today styling if needed
                    if (isDateToday) {
                      baseStyle.border = '2px solid #9E9E9E';
                      baseStyle.fontWeight = '600';
                      baseStyle.boxShadow = '0 1px 3px rgba(158, 158, 158, 0.2)';
                    }
                    
                    buttonProps.style = baseStyle;
                  } else {
                    // For dates with bills, ensure base styles are set
                    if (!buttonProps.style) {
                      buttonProps.style = {
                        width: '100%',
                        height: '100%',
                        padding: '0',
                        margin: '0',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      };
                    }
                  }
                  
                  buttonProps.className = cn(className, props.className);
                  return <button {...buttonProps}>{date.getDate()}</button>;
                }
              }}
              className="pointer-events-auto"
            />
          </CardContent>
        </Card>
      </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Bills Summary by Category - Collapsible */}
      <Collapsible open={billsSummaryOpen} onOpenChange={setBillsSummaryOpen}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Bills Summary</h2>
          <CollapsibleTrigger asChild>
            <Button variant="outline" size="sm">
              {billsSummaryOpen ? (
                <>
                  <ChevronUp className="w-4 h-4 mr-2" />
                  Hide Summary
                </>
              ) : (
                <>
                  <ChevronDown className="w-4 h-4 mr-2" />
                  Show Summary
                </>
              )}
            </Button>
          </CollapsibleTrigger>
        </div>
        <CollapsibleContent>
      <Card className="border-2">
        <CardContent className="pt-6">
          {/* Column Headers */}
          <div className="grid grid-cols-3 gap-4 pb-3 border-b mb-3">
            <div className="font-semibold text-sm">Category</div>
            <div className="font-semibold text-sm text-center">This Month</div>
            <div className="font-semibold text-sm text-center">Next Month</div>
          </div>

          <Accordion type="multiple" className="w-full">
            {(() => {
              let totalThisMonthSum = 0;
              let totalNextMonthSum = 0;
              
              const categoryItems = ["Rent", "Need", "Want", "Debt", "Savings", "Investment"].map((category) => {
                const categoryBills = bills.filter(b => b.category === category);
              
              // Calculate This Month totals
              const billsThisMonth = categoryBills
                .filter(b => {
                  const d = toTzDate(b.payment_date);
                  const dNext = toTzDate(b.payment_date_next);
                  return (d && isSameMonth(d, thisMonth)) || (dNext && isSameMonth(dNext, thisMonth));
                })
                .map(b => {
                  const d = toTzDate(b.payment_date);
                  const dNext = toTzDate(b.payment_date_next);
                  let amount = 0;
                  let itemDate: Date | null = null;
                  if (d && isSameMonth(d, thisMonth)) {
                    amount = Number(b.amount_now);
                    itemDate = d;
                  } else if (dNext && isSameMonth(dNext, thisMonth)) {
                    amount = Number(b.amount_next);
                    itemDate = dNext;
                  }
                  return { bill: b, amount, itemDate };
                });

              const thisMonthTotal = billsThisMonth.reduce((sum, { amount }) => sum + amount, 0);
              totalThisMonthSum += thisMonthTotal;

              // Calculate Bills to Close and Bills Open for This Month
              const billsToClose = billsThisMonth
                .filter(({ itemDate }) => {
                  if (!itemDate || !nextPaycheckDate) return false;
                  return itemDate < nextPaycheckDate;
                })
                .reduce((sum, { amount }) => sum + amount, 0);

              const billsOpen = billsThisMonth
                .filter(({ itemDate }) => {
                  if (!itemDate) return false;
                  if (!nextPaycheckDate) return true;
                  return itemDate >= nextPaycheckDate;
                })
                .reduce((sum, { amount }) => sum + amount, 0);
              
              // Calculate Next Month totals
              const billsNextMonth = categoryBills
                .filter(b => {
                  const dNext = toTzDate(b.payment_date_next);
                  const d = toTzDate(b.payment_date);
                  return (dNext && isSameMonth(dNext, nextMonth)) || (d && isSameMonth(d, nextMonth));
                })
                .map(b => {
                  const dNext = toTzDate(b.payment_date_next);
                  const d = toTzDate(b.payment_date);
                  let amount = 0;
                  if (dNext && isSameMonth(dNext, nextMonth)) {
                    amount = Number(b.amount_next);
                  } else if (d && isSameMonth(d, nextMonth)) {
                    amount = Number(b.amount_next);
                  }
                  return { bill: b, amount };
                });

              const nextMonthTotal = billsNextMonth.reduce((sum, { amount }) => sum + amount, 0);
              totalNextMonthSum += nextMonthTotal;
              
              return (
                <AccordionItem key={category} value={category} className="border-b">
                  <AccordionTrigger className="hover:no-underline">
                    <div className="grid grid-cols-3 gap-4 w-full pr-4">
                      <span className="font-semibold text-sm text-left">{category}</span>
                      <span className="text-sm text-center">${formatCurrency(thisMonthTotal)}</span>
                      <span className="text-sm text-center">${formatCurrency(nextMonthTotal)}</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="pt-4">
                      {/* Get all unique bills for this category */}
                      {(() => {
                        const allBills = new Map<string, { bill: Bill; thisMonthAmount: number; nextMonthAmount: number; thisMonthDate: Date | null }>();
                        
                        // Add This Month bills
                        billsThisMonth.forEach(({ bill, amount, itemDate }) => {
                          if (!allBills.has(bill.id)) {
                            allBills.set(bill.id, { bill, thisMonthAmount: amount, nextMonthAmount: 0, thisMonthDate: itemDate });
                          } else {
                            const existing = allBills.get(bill.id)!;
                            existing.thisMonthAmount = amount;
                            existing.thisMonthDate = itemDate;
                          }
                        });
                        
                        // Add Next Month bills
                        billsNextMonth.forEach(({ bill, amount }) => {
                          if (!allBills.has(bill.id)) {
                            allBills.set(bill.id, { bill, thisMonthAmount: 0, nextMonthAmount: amount, thisMonthDate: null });
                          } else {
                            const existing = allBills.get(bill.id)!;
                            existing.nextMonthAmount = amount;
                          }
                        });
                        
                        const uniqueBills = Array.from(allBills.values());
                        
                        if (uniqueBills.length === 0) {
                          return <p className="text-xs text-muted-foreground py-1">No bills</p>;
                        }
                        
                        return (
                          <div className="space-y-1">
                            {uniqueBills.map(({ bill, thisMonthAmount, nextMonthAmount, thisMonthDate }) => {
                              const isToClose = thisMonthDate && nextPaycheckDate && thisMonthDate < nextPaycheckDate;
                              return (
                                <div key={bill.id} className="grid grid-cols-3 gap-4 items-center text-xs py-1 px-2 rounded bg-muted/50">
                                  <span className="text-left">{bill.name}</span>
                                  <span className={cn(
                                    "text-center font-semibold",
                                    thisMonthAmount > 0 && (isToClose ? "text-green-600 dark:text-green-400" : "text-yellow-600 dark:text-yellow-400")
                                  )}>
                                    {thisMonthAmount > 0 ? `$${formatCurrency(thisMonthAmount)}` : '-'}
                                  </span>
                                  <span className="text-center font-semibold">
                                    {nextMonthAmount > 0 ? `$${formatCurrency(nextMonthAmount)}` : '-'}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })()}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            });
            
            return categoryItems;
          })()}
          </Accordion>

          {/* Total Row */}
          {(() => {
            // Calculate totals by summing all category totals
            let totalThisMonthSum = 0;
            let totalNextMonthSum = 0;
            
            ["Rent", "Need", "Want", "Debt", "Savings", "Investment"].forEach((category) => {
              const categoryBills = bills.filter(b => b.category === category);
              
              const billsThisMonth = categoryBills
                .filter(b => {
                  const d = toTzDate(b.payment_date);
                  const dNext = toTzDate(b.payment_date_next);
                  return (d && isSameMonth(d, thisMonth)) || (dNext && isSameMonth(dNext, thisMonth));
                })
                .map(b => {
                  const d = toTzDate(b.payment_date);
                  const dNext = toTzDate(b.payment_date_next);
                  let amount = 0;
                  if (d && isSameMonth(d, thisMonth)) {
                    amount = Number(b.amount_now);
                  } else if (dNext && isSameMonth(dNext, thisMonth)) {
                    amount = Number(b.amount_next);
                  }
                  return { amount };
                });
              
              const billsNextMonth = categoryBills
                .filter(b => {
                  const dNext = toTzDate(b.payment_date_next);
                  const d = toTzDate(b.payment_date);
                  return (dNext && isSameMonth(dNext, nextMonth)) || (d && isSameMonth(d, nextMonth));
                })
                .map(b => {
                  const dNext = toTzDate(b.payment_date_next);
                  const d = toTzDate(b.payment_date);
                  let amount = 0;
                  if (dNext && isSameMonth(dNext, nextMonth)) {
                    amount = Number(b.amount_next);
                  } else if (d && isSameMonth(d, nextMonth)) {
                    amount = Number(b.amount_next);
                  }
                  return { amount };
                });
              
              totalThisMonthSum += billsThisMonth.reduce((sum, { amount }) => sum + amount, 0);
              totalNextMonthSum += billsNextMonth.reduce((sum, { amount }) => sum + amount, 0);
            });
            
            return (
              <div className="mt-4 pt-4 border-t-2">
                <div className="grid grid-cols-3 gap-4 mb-3">
                  <div className="font-bold text-sm">Total</div>
                  <div className="text-sm text-center font-bold">${formatCurrency(totalThisMonthSum)}</div>
                  <div className="text-sm text-center font-bold">${formatCurrency(totalNextMonthSum)}</div>
                </div>
                {/* Breakdown for This Month */}
                <div className="pt-3 border-t">
                  <div className="grid grid-cols-3 gap-4 text-xs">
                    <div className="text-muted-foreground font-medium">This Month Breakdown:</div>
                    <div className="space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Bills to Close:</span>
                        <span className="font-semibold text-green-600 dark:text-green-400">${formatCurrency(billsToCloseBeforePaycheck)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Bills Open:</span>
                        <span className="font-semibold text-yellow-600 dark:text-yellow-400">${formatCurrency(billsOpenAfterPaycheck)}</span>
                      </div>
                      <div className="flex justify-between items-center pt-1 border-t">
                        <span className="font-semibold">Total:</span>
                        <span className="font-bold">${formatCurrency(totalThisMonthSum)}</span>
                      </div>
                    </div>
                    <div></div>
                  </div>
                </div>
              </div>
            );
          })()}
        </CardContent>
      </Card>
        </CollapsibleContent>
      </Collapsible>

      {/* Bills List */}
      <Collapsible open={billsListOpen} onOpenChange={setBillsListOpen}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">My Bills</h2>
          <div className="flex items-center gap-2">
            <CollapsibleTrigger asChild>
              <Button variant="outline" size="sm">
                {billsListOpen ? (
                  <>
                    <ChevronUp className="w-4 h-4 mr-2" />
                    Hide Bills
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-4 h-4 mr-2" />
                    Show Bills
                  </>
                )}
              </Button>
            </CollapsibleTrigger>
            <Button variant="secondary" onClick={() => setDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Bill
            </Button>
          </div>
        </div>
        <CollapsibleContent>
      <div className="grid gap-4">
        {bills.map((bill) => (
          <Card key={bill.id} className="border-2 hover:shadow-card-hover transition-smooth">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <CardTitle>{bill.name}</CardTitle>
                    <span className="text-xs px-2 py-1 bg-muted rounded-full">{bill.category}</span>
                  </div>
                  <CardDescription>
                    {bill.bank_accounts.name}
                    {bill.payment_date && ` • This Month: ${format(new Date(bill.payment_date), "MMM d")}`}
                    {bill.payment_date_next && ` • Next Month: ${format(new Date(bill.payment_date_next), "MMM d")}`}
                    {` • ${bill.scheduled_type}`}
                  </CardDescription>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => handleEditBill(bill)}>
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDeleteBill(bill.id)}>
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
                    const paydayDate = toTzDate(bill.payment_date);
                    const isPaydayPast = paydayDate && isPast(paydayDate) && !isToday(paydayDate);
                    const displayAmount = isPaydayPast ? 0 : Number(bill.amount_now);
                    return (
                      <>
                        <p className="text-2xl font-bold text-foreground">${formatCurrency(displayAmount)}</p>
                        {isPaydayPast && paydayDate && (
                          <p className="text-xs text-muted-foreground mt-1">Paid on {format(paydayDate, "MMM d")}</p>
                        )}
                      </>
                    );
                  })()}
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Next Month</p>
                  <p className="text-2xl font-bold text-foreground">${formatCurrency(Number(bill.amount_next))}</p>
                  <p className="text-xs text-muted-foreground mt-1">Expected amount</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {/* Default slots */}
        {Array.from({ length: Math.max(0, 3 - bills.length) }).map((_, idx) => {
          const slotNumber = bills.length + idx + 1;
          const slotName = `Bill ${slotNumber}`;
          if (dismissedSlots.has(slotNumber)) return null;

          return (
            <Card key={`slot-${slotNumber}`} className="border-2 border-dashed">
              <CardContent className="py-6 flex items-center justify-between">
                <div className="space-y-1">
                  <p className="font-medium">{slotName}</p>
                  <p className="text-sm text-muted-foreground">Create a recurring bill</p>
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
      </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Add/Edit Bill Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => {
        setDialogOpen(open);
        if (!open) {
          setEditingBill(null);
          setFormData({ name: "", category: "", amount_now: "", amount_next: "", bank_account_id: "", scheduled_type: "Scheduled" });
          setPaymentDate(undefined);
        }
      }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingBill ? "Edit Bill" : "Add Bill"}</DialogTitle>
            <DialogDescription>
              {editingBill
                ? "Update bill information. Payment date is required for recurring bills."
                : "Add a recurring bill. The payment date is required and will be used to auto-generate next month's date."
              }
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddBill} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Bill Name</Label>
              <Input
                id="name"
                placeholder="Rent, Internet, Gym, etc."
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">Category <span className="text-destructive">*</span></Label>
              <Select
                value={formData.category}
                onValueChange={(value) => setFormData({ ...formData, category: value })}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Rent">1. Rent</SelectItem>
                  <SelectItem value="Need">2. Need</SelectItem>
                  <SelectItem value="Want">3. Want</SelectItem>
                  <SelectItem value="Debt">4. Debt</SelectItem>
                  <SelectItem value="Savings">5. Savings</SelectItem>
                  <SelectItem value="Investment">6. Investment</SelectItem>
                </SelectContent>
              </Select>
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
              <Label>This Month Payment Date <span className="text-destructive">*</span></Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn("w-full justify-start text-left font-normal", !paymentDate && "text-muted-foreground")}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {paymentDate ? format(paymentDate, "PPP") : <span>Pick a date (required)</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={paymentDate}
                    onSelect={setPaymentDate}
                    month={thisMonth}
                    onMonthChange={() => {}}
                    disabled={(date) => !isSameMonth(date, thisMonth)}
                    components={{
                      IconLeft: () => null,
                      IconRight: () => null,
                    }}
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
              {paymentDate && (
                <p className="text-xs text-muted-foreground">
                  Next month will be: {format(addMonths(paymentDate, 1), "MMM d, yyyy")}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="bank_account">Paid From Account <span className="text-destructive">*</span></Label>
              <Select
                value={formData.bank_account_id}
                onValueChange={(value) => setFormData({ ...formData, bank_account_id: value })}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select account" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="scheduled_type">Scheduled / Auto</Label>
              <Select
                value={formData.scheduled_type}
                onValueChange={(value) => setFormData({ ...formData, scheduled_type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Scheduled">Schedule</SelectItem>
                  <SelectItem value="Autopay">Autopay</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" className="w-full" variant="secondary">
              {editingBill ? "Update Bill" : "Save Bill"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Bills;