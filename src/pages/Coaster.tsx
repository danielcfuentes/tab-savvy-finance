import { Card, CardContent } from "@/components/ui/card";

const Coaster = () => {
  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold text-foreground mb-2">Coaster Tab 🍻</h1>
      <p className="text-muted-foreground mb-6">Daily spending tracker</p>
      <Card className="border-2">
        <CardContent className="py-16 text-center">
          <p className="text-muted-foreground">Coming in Phase 2</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Coaster;
