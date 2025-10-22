import { Card, CardContent } from "@/components/ui/card";

const Bills = () => {
  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold text-foreground mb-2">Bills Tab 🧾</h1>
      <p className="text-muted-foreground mb-6">Manage your payments</p>
      <Card className="border-2">
        <CardContent className="py-16 text-center">
          <p className="text-muted-foreground">Coming soon</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Bills;
