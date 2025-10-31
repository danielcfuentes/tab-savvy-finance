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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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
  due_date: string | null;
  due_date_next: string | null;
  bank_account_id: string;
  bank_accounts: BankAccount;
};

const Income = () => {
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingIncome, setEditingIncome] = useState<Income | null>(null);
  const [dueDate, setDueDate] = useState<Date | undefined>();
  const [dueDateNext, setDueDateNext] = useState<Date | undefined>();
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
      supabase.from("income").select("*, bank_accounts(id, name)").order("due_date", { ascending: true, nullsFirst: false }),
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
    // Handle empty strings and convert to 0 if needed
    const amountNow = formData.amount_now === "" ? 0 : parseFloat(formData.amount_now) || 0;
    const amountNext = formData.amount_next === "" ? 0 : parseFloat(formData.amount_next) || 0;

    // Validate: date required only if amount > 0
    // When amount is $0, dates are optional and can be null
    if (amountNow > 0 && !dueDate) {
      toast({ variant: "destructive", title: "Error", description: "Please select a date for This Month when amount is greater than $0" });
      return;
    }
    if (amountNext > 0 && !dueDateNext) {
      toast({ variant: "destructive", title: "Error", description: "Please select a date for Next Month when amount is greater than $0" });
      return;
    }
    
    // When amount is 0, explicitly allow null dates (dates are optional)
    // No validation needed for $0 amounts without dates

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    if (editingIncome) {
      // Update existing income
      const { error } = await supabase
        .from("income")
        .update({
          name: formData.name,
          amount_now: amountNow,
          amount_next: amountNext,
          // Allow null dates when amount is 0 - dates only required when amount > 0
          // Validation above ensures dates exist when amount > 0, so we can safely use null here
          due_date: dueDate ? dueDate.toISOString() : null,
          due_date_next: dueDateNext ? dueDateNext.toISOString() : null,
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
        setDueDateNext(undefined);
        fetchData();
      }
    } else {
      // Insert new income
    const { error } = await supabase.from("income").insert({
      user_id: session.user.id,
      name: formData.name,
        amount_now: amountNow,
        amount_next: amountNext,
        // Allow null dates when amount is 0 - dates only required when amount > 0
        due_date: dueDate ? dueDate.toISOString() : null,
        due_date_next: dueDateNext ? dueDateNext.toISOString() : null,
      bank_account_id: formData.bank_account_id,
    });

    if (error) {
        toast({ variant: "destructive", title: "Error", description: "Failed to add income" });
    } else {
        toast({ title: "Success!", description: "Income added" });
      setDialogOpen(false);
      setFormData({ name: "", amount_now: "", amount_next: "", bank_account_id: "" });
      setDueDate(undefined);
        setDueDateNext(undefined);
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
    setDueDate(income.due_date ? new Date(income.due_date) : undefined);
    setDueDateNext(income.due_date_next ? new Date(income.due_date_next) : undefined);
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

  const toTzDate = (dIso: string | null) => {
    if (!dIso) return null;
    const d = new Date(new Date(dIso).toLocaleString("en-US", { timeZone: resolvedTz }));
    d.setHours(0, 0, 0, 0);
    return d;
  };
  
  // Separate past and future paydays for this month
  const incomesThisMonthData = incomes
    .filter(i => {
      const d = toTzDate(i.due_date);
      return d && isSameMonth(d, thisMonth);
    })
    .map(i => {
      const d = toTzDate(i.due_date);
      return { date: d!, income: i };
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
  
  // Get next month paydays from both due_date_next and due_date (if in next month)
  const incomesNextMonth = incomes
    .filter(i => {
      const dNext = toTzDate(i.due_date_next);
      const d = toTzDate(i.due_date);
      return (dNext && isSameMonth(dNext, nextMonth)) || (d && isSameMonth(d, nextMonth));
    })
    .map(i => {
      const dNext = toTzDate(i.due_date_next);
      const d = toTzDate(i.due_date);
      // Prefer due_date_next if it exists and is in next month, otherwise use due_date
      const targetDate = (dNext && isSameMonth(dNext, nextMonth)) ? dNext : d;
      if (targetDate) {
        targetDate.setHours(0, 0, 0, 0);
        return targetDate;
      }
      return null;
    })
    .filter((d): d is Date => d !== null);

  // Per-paycheck color coding for This Month and Next Month - more vibrant colors
  const colorPalette = [
    "#00A86B", // Mint Ledger primary - keep this one
    "#00C987", // Brighter mint green
    "#00D9A5", // Vibrant emerald
    "#28E8A0", // Bright teal
    "#3DF5B8", // Light mint
    "#16C785", // Deep mint
  ];

  type ModRecord = Record<string, Date[]>;
  const thisMonthModifiers: ModRecord = {};
  const nextMonthModifiers: ModRecord = {};

  // Build modifiers with paycheck info for tooltips
  const paycheckInfoByDate = new Map<string, { name: string; amount: number; idx: number }>();
  
  // Build modifiersClassNames with inline styles for colors
  const thisMonthClassNames: Record<string, string> = {
    paydaysPast: "paydays-past",
  };
  const nextMonthClassNames: Record<string, string> = {};
  
  incomes.forEach((inc, idx) => {
    const keyThis = `pay${idx}This`;
    const keyNext = `pay${idx}Next`;
    const dateThis = toTzDate(inc.due_date);
    const dateNext = toTzDate(inc.due_date_next);
    
    // This Month: use due_date if it exists and is in this month
    if (dateThis && isSameMonth(dateThis, thisMonth)) {
      const normalizedDate = startOfDay(dateThis);
      // Use date only (no time) for matching
      const dateOnly = new Date(normalizedDate.getFullYear(), normalizedDate.getMonth(), normalizedDate.getDate());
      thisMonthModifiers[keyThis] = [dateOnly];
      thisMonthClassNames[keyThis] = `cal-${idx}-this`;
      paycheckInfoByDate.set(dateOnly.toISOString(), { name: inc.name, amount: inc.amount_now, idx });
    }
    
    // Next Month: prefer due_date_next, fallback to due_date if in next month
    let nextDate: Date | null = null;
    if (dateNext && isSameMonth(dateNext, nextMonth)) {
      nextDate = startOfDay(dateNext);
    } else if (dateThis && isSameMonth(dateThis, nextMonth)) {
      nextDate = startOfDay(dateThis);
    }
    
    if (nextDate) {
      // Use date only (no time) for matching
      const dateOnly = new Date(nextDate.getFullYear(), nextDate.getMonth(), nextDate.getDate());
      nextMonthModifiers[keyNext] = [dateOnly];
      nextMonthClassNames[keyNext] = `cal-${idx}-next`;
      paycheckInfoByDate.set(`next-${dateOnly.toISOString()}`, { name: inc.name, amount: inc.amount_next, idx });
    }
  });

  // Fallback: aggregate all next-month paydays to ensure visibility even if per-paycheck mapping fails
  const nextMonthAll: Date[] = Object.values(nextMonthModifiers).flat();
  if (nextMonthAll.length > 0) {
    (nextMonthModifiers as any).anyNextPay = nextMonthAll;
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
        /* Override Tailwind button ghost variant for payday buttons */
        .rdp button[class*="cal-"] {
          background-color: var(--payday-color) !important;
          color: #FFFFFF !important;
          font-weight: 700 !important;
          border-radius: 0.5rem !important;
        }
        
        /* Today's date - subtle blue highlight when not a payday - must override Tailwind */
        .rdp button.rdp-day.rdp-day_today:not([class*="cal-"]):not([class*="paydays-past"]) {
          background-color: #E3F2FD !important;
          color: #1565C0 !important;
          font-weight: 600 !important;
          border: 2px solid #2196F3 !important;
          border-radius: 0.5rem !important;
          box-shadow: 0 1px 3px rgba(33, 150, 243, 0.2) !important;
        }
        
        /* Past payday styling - already received */
        .rdp button.rdp-day[class*="paydays-past"] {
          background-color: #E0E0E0 !important;
          color: #616161 !important;
          font-weight: 600 !important;
          border-radius: 0.5rem !important;
          border: 2px dashed #9E9E9E !important;
          opacity: 0.8 !important;
        }
        
        /* Dynamically generated per-paycheck colors (same color for this & next) */
        ${incomes
          .map((_, idx) => {
            const color = colorPalette[idx % colorPalette.length];
            return `
              /* This Month payday colors - ultra-specific selectors to override Tailwind */
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
              /* Next Month payday colors (slightly transparent) */
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
              /* Today that is also a payday - override today's blue with payday color */
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
        /* Generic next-month fallback */
        .rdp button[class*="cal-any-next"] {
          background-color: #00A86B !important;
          background: #00A86B !important;
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
            <TooltipProvider>
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
                  cell: "h-10 w-10 p-0 relative",
                  day: "h-10 w-10 p-0 m-0",
                  // Remove Tailwind today styling - we'll use CSS instead
                }}
                components={{
                  Day: (dayProps: any) => {
                    const { date, className, displayMonth, ...props } = dayProps;
                    const dateKey = startOfDay(date).toISOString();
                    const paycheckInfo = paycheckInfoByDate.get(dateKey);
                    
                    // Filter out non-DOM props
                    const { displayMonth: _, ...restProps } = props;
                    const buttonProps: any = { ...restProps };
                    
                    // Apply color directly if this is a payday
                    if (paycheckInfo) {
                      const paycheckIdx = paycheckInfo.idx;
                      const paydayColor = colorPalette[paycheckIdx % colorPalette.length];
                      
                      buttonProps.style = {
                        backgroundColor: paydayColor,
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
                        boxShadow: `0 2px 4px ${paydayColor}33`,
                        ...props.style,
                      };
                      buttonProps.className = cn(className, `cal-${paycheckIdx}-this`);
                      
                      return (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button {...buttonProps}>{date.getDate()}</button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="font-semibold">{paycheckInfo.name}</p>
                            <p>${paycheckInfo.amount.toFixed(2)}</p>
                          </TooltipContent>
                        </Tooltip>
                      );
                    }
                    
                    // Check if it's today
                    const isDateToday = isSameMonth(date, thisMonth) && isToday(date);
                    if (isDateToday && !paycheckInfo) {
                      buttonProps.style = {
                        backgroundColor: '#E3F2FD',
                        color: '#1565C0',
                        fontWeight: '600',
                        border: '2px solid #2196F3',
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
                        boxShadow: '0 1px 3px rgba(33, 150, 243, 0.2)',
                        ...props.style,
                      };
                    }
                    
                    // Ensure all buttons have consistent styling
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
                    
                    buttonProps.className = cn(className, props.className);
                    return <button {...buttonProps}>{date.getDate()}</button>;
                  }
                }}
                className="pointer-events-auto"
              />
            </TooltipProvider>
          </CardContent>
        </Card>

        <Card className="border-2">
          <CardHeader className="pb-2">
            <CardTitle>Next Month</CardTitle>
            <CardDescription>Upcoming paydays</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <TooltipProvider>
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
                  // Remove Tailwind today styling - we'll use CSS instead
                }}
                components={{
                  Day: (dayProps: any) => {
                    const { date, className, displayMonth, ...props } = dayProps;
                    // Check both with and without "next-" prefix for matching
                    const dateKeyISO = startOfDay(date).toISOString();
                    const dateKeyWithNext = `next-${dateKeyISO}`;
                    
                    // Try to find paycheck info - check both keys
                    let paycheckInfo = paycheckInfoByDate.get(dateKeyWithNext);
                    if (!paycheckInfo) {
                      // Also check if any income has this date in next month
                      const matchingIncome = incomes.find(inc => {
                        const dateNext = toTzDate(inc.due_date_next);
                        const dateThis = toTzDate(inc.due_date);
                        const checkDate = dateNext && isSameMonth(dateNext, nextMonth) 
                          ? dateNext 
                          : (dateThis && isSameMonth(dateThis, nextMonth) ? dateThis : null);
                        if (!checkDate) return false;
                        const checkDateISO = startOfDay(checkDate).toISOString();
                        return checkDateISO === dateKeyISO;
                      });
                      if (matchingIncome) {
                        const idx = incomes.indexOf(matchingIncome);
                        paycheckInfo = { 
                          name: matchingIncome.name, 
                          amount: matchingIncome.amount_next || matchingIncome.amount_now, 
                          idx 
                        };
                      }
                    }
                    
                    // Filter out non-DOM props
                    const { displayMonth: _, ...restProps } = props;
                    const buttonProps: any = { ...restProps };
                    
                    // Apply color directly if this is a payday
                    if (paycheckInfo) {
                      const paycheckIdx = paycheckInfo.idx;
                      const paydayColor = colorPalette[paycheckIdx % colorPalette.length];
                      
                      buttonProps.style = {
                        backgroundColor: paydayColor,
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
                        boxShadow: `0 1px 2px ${paydayColor}26`,
                        ...props.style,
                      };
                      buttonProps.className = cn(className, `cal-${paycheckIdx}-next`);
                      
                      return (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button {...buttonProps}>{date.getDate()}</button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="font-semibold">{paycheckInfo.name}</p>
                            <p>${paycheckInfo.amount.toFixed(2)}</p>
                          </TooltipContent>
                        </Tooltip>
                      );
                    }
                    
                    // Check if it's today in next month
                    const isDateToday = isSameMonth(date, nextMonth) && isToday(date);
                    if (isDateToday && !paycheckInfo) {
                      buttonProps.style = {
                        backgroundColor: '#E3F2FD',
                        color: '#1565C0',
                        fontWeight: '600',
                        border: '2px solid #2196F3',
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
                        boxShadow: '0 1px 3px rgba(33, 150, 243, 0.2)',
                        ...props.style,
                      };
                    }
                    
                    // Ensure all buttons have consistent styling
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
                    
                    buttonProps.className = cn(className, props.className);
                    return <button {...buttonProps}>{date.getDate()}</button>;
                  }
                }}
                className="pointer-events-auto"
              />
            </TooltipProvider>
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
                    const isPaydayPast = paydayDate && isPast(paydayDate) && !isToday(paydayDate);
                    return isPaydayPast ? (
                        <Badge variant="secondary" className="text-xs">Already received</Badge>
                      ) : null;
                    })()}
                  </div>
                  <CardDescription>
                    {income.bank_accounts.name} 
                    {income.due_date && ` • This Month: ${format(new Date(income.due_date), "MMM d")}`}
                    {income.due_date_next && ` • Next Month: ${format(new Date(income.due_date_next), "MMM d")}`}
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
                    const isPaydayPast = paydayDate && isPast(paydayDate) && !isToday(paydayDate);
                    const displayAmount = isPaydayPast ? 0 : Number(income.amount_now);
                    return (
                      <>
                        <p className="text-2xl font-bold text-foreground">${displayAmount.toFixed(2)}</p>
                        {isPaydayPast && paydayDate && (
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
          setDueDateNext(undefined);
        }
      }}>
              <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
                <DialogHeader>
            <DialogTitle>{editingIncome ? "Edit Paycheck" : "Add Paycheck"}</DialogTitle>
            <DialogDescription>
              {editingIncome 
                ? "Update paycheck amounts for this month and next month"
                : "Visualize your upcoming income. Dates are only required when amount is greater than $0."
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
              <Label>This Month Payday Date {parseFloat(formData.amount_now) > 0 && <span className="text-destructive">*</span>}</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !dueDate && "text-muted-foreground")}> 
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {dueDate ? format(dueDate, "PPP") : <span>Pick a date {parseFloat(formData.amount_now) > 0 ? "(required)" : "(optional)"}</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={dueDate} onSelect={setDueDate} initialFocus className="pointer-events-auto" />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="space-y-2">
              <Label>Next Month Payday Date {parseFloat(formData.amount_next) > 0 && <span className="text-destructive">*</span>}</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !dueDateNext && "text-muted-foreground")}> 
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {dueDateNext ? format(dueDateNext, "PPP") : <span>Pick a date {parseFloat(formData.amount_next) > 0 ? "(required)" : "(optional)"}</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={dueDateNext} onSelect={setDueDateNext} initialFocus className="pointer-events-auto" />
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
