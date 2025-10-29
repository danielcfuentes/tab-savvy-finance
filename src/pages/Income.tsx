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
import { Loader2, Plus, Trash2, Calendar as CalendarIcon, Info } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { cn } from "@/lib/utils";
import { getNextIncomeDue, getCoastingDays, getTotalThisMonth } from "@/lib/calculations";
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
  const [dueDate, setDueDate] = useState<Date>();
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
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch income data",
      });
    } else {
      setIncomes(incomesRes.data || []);
    }

    if (accountsRes.error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch accounts",
      });
    } else {
      setAccounts(accountsRes.data || []);
    }

    setLoading(false);
  };

  const handleAddIncome = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!dueDate) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please select a due date",
      });
      return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { error } = await supabase.from("income").insert({
      user_id: session.user.id,
      name: formData.name,
      amount_now: parseFloat(formData.amount_now),
      amount_next: parseFloat(formData.amount_next),
      due_date: dueDate.toISOString(),
      bank_account_id: formData.bank_account_id,
    });

    if (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to add income",
      });
    } else {
      toast({
        title: "Success!",
        description: "Income added",
      });
      setDialogOpen(false);
      setFormData({ name: "", amount_now: "", amount_next: "", bank_account_id: "" });
      setDueDate(undefined);
      fetchData();
    }
  };

  const handleDeleteIncome = async (id: string) => {
    const { error } = await supabase.from("income").delete().eq("id", id);

    if (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete income",
      });
    } else {
      toast({
        title: "Deleted",
        description: "Income removed",
      });
      fetchData();
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  // Calculate summary metrics
  const nextIncome = getNextIncomeDue(incomes as IncomeItem[]);
  const coastingDays = getCoastingDays(nextIncome);
  const totalThisMonth = getTotalThisMonth(incomes as IncomeItem[]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <Loader2 className="w-8 h-8 animate-spin text-secondary" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Income Tab 💵</h1>
              <p className="text-muted-foreground">Track your paychecks</p>
            </div>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="secondary">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Income
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Add Income</DialogTitle>
                  <DialogDescription>Track your paycheck or income source</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleAddIncome} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Income Name</Label>
                    <Input
                      id="name"
                      placeholder="Paycheck, Freelance, etc."
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="amount_now">Income Amount for This Month</Label>
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
                    <Label htmlFor="amount_next">Income Amount for Next Month</Label>
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
                  <div className="space-y-2">
                    <Label>Income Due Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !dueDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {dueDate ? format(dueDate, "PPP") : <span>Pick a date</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={dueDate}
                          onSelect={setDueDate}
                          initialFocus
                          className="pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bank_account">Bank Account for Income Item</Label>
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
                  <Button type="submit" className="w-full" variant="secondary">
                    Add Income
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {/* Summary Bar */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border-2 bg-secondary/10">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base md:text-lg">💵 Next Income Due</CardTitle>
                  <Popover>
                    <PopoverTrigger asChild>
                      <button type="button" className="touch-manipulation">
                        <Info className="w-4 h-4 text-muted-foreground cursor-pointer" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="max-w-[260px] text-sm" align="start">
                      The soonest scheduled income date in the future.
                    </PopoverContent>
                  </Popover>
                </div>
                </CardHeader>
                <CardContent>
                  <p className="text-xl md:text-2xl font-bold text-secondary">
                    {nextIncome ? format(nextIncome, "MMM d") : "–"}
                  </p>
                </CardContent>
              </Card>

            <Card className="border-2 bg-secondary/10">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base md:text-lg">⏱️ Coasting Days</CardTitle>
                  <Popover>
                    <PopoverTrigger asChild>
                      <button type="button" className="touch-manipulation">
                        <Info className="w-4 h-4 text-muted-foreground cursor-pointer" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="max-w-[260px] text-sm" align="start">
                      Number of days from today until the next income date.
                    </PopoverContent>
                  </Popover>
                </div>
                </CardHeader>
                <CardContent>
                  <p className="text-xl md:text-2xl font-bold text-secondary">
                    {coastingDays} day{coastingDays !== 1 ? 's' : ''}
                  </p>
                </CardContent>
              </Card>

            <Card className="border-2 bg-secondary/10">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base md:text-lg">📊 Total This Month</CardTitle>
                  <Popover>
                    <PopoverTrigger asChild>
                      <button type="button" className="touch-manipulation">
                        <Info className="w-4 h-4 text-muted-foreground cursor-pointer" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="max-w-[260px] text-sm" align="start">
                      Sum of income amounts scheduled in the current calendar month.
                    </PopoverContent>
                  </Popover>
                </div>
                </CardHeader>
                <CardContent>
                  <p className="text-xl md:text-2xl font-bold text-secondary">
                    ${formatCurrency(totalThisMonth)}
                  </p>
              </CardContent>
            </Card>
          </div>

          {incomes.length === 0 ? (
            <Card className="border-2">
              <CardContent className="py-16 text-center">
                <p className="text-muted-foreground mb-4">
                  No income tracked yet — add your first paycheck.
                </p>
                <Button variant="secondary" onClick={() => setDialogOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Your First Income
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {incomes.map((income) => {
                const daysUntil = differenceInDays(new Date(income.due_date), new Date());
                return (
                  <Card key={income.id} className="border-2 hover:shadow-card-hover transition-smooth">
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div className="space-y-1">
                          <CardTitle>{income.name}</CardTitle>
                          <CardDescription>
                            {income.bank_accounts.name} • Due {format(new Date(income.due_date), "PPP")}
                          </CardDescription>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteIncome(income.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-muted-foreground mb-1">This Month</p>
                          <p className="text-2xl font-bold text-foreground">
                            ${Number(income.amount_now).toFixed(2)}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground mb-1">Next Month</p>
                          <p className="text-2xl font-bold text-foreground">
                            ${Number(income.amount_next).toFixed(2)}
                          </p>
                        </div>
                      </div>
                      {daysUntil >= 0 && (
                        <div className="mt-3 pt-3 border-t">
                          <p className="text-sm text-muted-foreground">
                            {daysUntil === 0 ? "Due today!" : `${daysUntil} days away`}
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
    </div>
  );
};

export default Income;
