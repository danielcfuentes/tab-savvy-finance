import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Trash2, Edit } from "lucide-react";

type BankAccount = {
  id: string;
  name: string;
  account_type: string;
  balance: number;
};

const Dashboard = () => {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<BankAccount | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    account_type: "checking",
    balance: "",
  });
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("bank_accounts")
      .select("*")
      .order("created_at", { ascending: true });

    if (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch accounts",
      });
    } else {
      setAccounts(data || []);
    }
    setLoading(false);
  };

  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { error } = await supabase.from("bank_accounts").insert({
      user_id: session.user.id,
      name: formData.name,
      account_type: formData.account_type,
      balance: parseFloat(formData.balance),
    });

    if (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to add account",
      });
    } else {
      toast({
        title: "Success!",
        description: "Bank account added",
      });
      setDialogOpen(false);
      setFormData({ name: "", account_type: "checking", balance: "" });
      fetchAccounts();
    }
  };

  const handleEditAccount = (account: BankAccount) => {
    setEditingAccount(account);
    setFormData({
      name: account.name,
      account_type: account.account_type,
      balance: account.balance.toString(),
    });
    setEditDialogOpen(true);
  };

  const handleUpdateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!editingAccount) return;

    const { error } = await supabase
      .from("bank_accounts")
      .update({
        name: formData.name,
        account_type: formData.account_type,
        balance: parseFloat(formData.balance),
      })
      .eq("id", editingAccount.id);

    if (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update account",
      });
    } else {
      toast({
        title: "Success!",
        description: "Account updated",
      });
      setEditDialogOpen(false);
      setEditingAccount(null);
      setFormData({ name: "", account_type: "checking", balance: "" });
      fetchAccounts();
    }
  };

  const handleDeleteAccount = async (id: string) => {
    const { error } = await supabase
      .from("bank_accounts")
      .delete()
      .eq("id", id);

    if (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete account",
      });
    } else {
      toast({
        title: "Deleted",
        description: "Account removed",
      });
      fetchAccounts();
    }
  };

  const formatAccountType = (type: string) => {
    return type.split("_").map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  const totalBalance = accounts.reduce((sum, acc) => sum + Number(acc.balance), 0);

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
              <h1 className="text-3xl font-bold text-foreground">Bank Tab 🏦</h1>
              <p className="text-muted-foreground">Manage your accounts</p>
            </div>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="secondary">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Account
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Bank Account</DialogTitle>
                  <DialogDescription>
                    Add a new account to track your balance
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleAddAccount} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Account Name</Label>
                    <Input
                      id="name"
                      placeholder="My Checking Account"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="type">Account Type</Label>
                    <Select
                      value={formData.account_type}
                      onValueChange={(value) => setFormData({ ...formData, account_type: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="checking">Checking</SelectItem>
                        <SelectItem value="savings">Savings</SelectItem>
                        <SelectItem value="digital_wallet">Digital Wallet</SelectItem>
                        <SelectItem value="credit_card">Credit Card</SelectItem>
                        <SelectItem value="loan">Loan</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="balance">Current Balance</Label>
                    <Input
                      id="balance"
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={formData.balance}
                      onChange={(e) => setFormData({ ...formData, balance: e.target.value })}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full" variant="secondary">
                    Add Account
                  </Button>
                </form>
              </DialogContent>
            </Dialog>

            {/* Edit Account Dialog */}
            <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Edit Bank Account</DialogTitle>
                  <DialogDescription>
                    Update your account information
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleUpdateAccount} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-name">Account Name</Label>
                    <Input
                      id="edit-name"
                      placeholder="My Checking Account"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-type">Account Type</Label>
                    <Select
                      value={formData.account_type}
                      onValueChange={(value) => setFormData({ ...formData, account_type: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="checking">Checking</SelectItem>
                        <SelectItem value="savings">Savings</SelectItem>
                        <SelectItem value="digital_wallet">Digital Wallet</SelectItem>
                        <SelectItem value="credit_card">Credit Card</SelectItem>
                        <SelectItem value="loan">Loan</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-balance">Current Balance</Label>
                    <Input
                      id="edit-balance"
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={formData.balance}
                      onChange={(e) => setFormData({ ...formData, balance: e.target.value })}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full" variant="secondary">
                    Update Account
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <Card className="border-2 bg-secondary/10">
            <CardHeader>
              <CardTitle className="text-2xl">Total Balance</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold text-secondary">
                ${formatCurrency(totalBalance)}
              </p>
            </CardContent>
          </Card>

          {accounts.length === 0 ? (
            <Card className="border-2">
              <CardContent className="py-16 text-center">
                <p className="text-muted-foreground mb-4">
                  No tabs open yet — add your first account.
                </p>
                <Button variant="secondary" onClick={() => setDialogOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Your First Account
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {accounts.map((account) => (
                <Card key={account.id} className="border-2 hover:shadow-card-hover transition-smooth">
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle>{account.name}</CardTitle>
                        <CardDescription>{formatAccountType(account.account_type)}</CardDescription>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEditAccount(account)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteAccount(account.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold text-foreground">
                      ${formatCurrency(Number(account.balance))}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
    </div>
  );
};

export default Dashboard;
