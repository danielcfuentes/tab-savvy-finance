import AppNav from "@/components/AppNav";
import { Card, CardContent } from "@/components/ui/card";

const CloseOut = () => {
  return (
    <div className="min-h-screen bg-background">
      <AppNav />
      <main className="md:ml-64 p-4 md:p-8 pb-24 md:pb-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold text-foreground mb-2">Close Out Tab ✅</h1>
          <p className="text-muted-foreground mb-6">Monthly summary</p>
          <Card className="border-2">
            <CardContent className="py-16 text-center">
              <p className="text-muted-foreground">Coming soon</p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default CloseOut;
