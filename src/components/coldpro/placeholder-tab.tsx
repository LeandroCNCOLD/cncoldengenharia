import { Card, CardContent } from "@/components/ui/card";

export function PlaceholderTab({ title, description }: { title: string; description: string }) {
  return (
    <Card>
      <CardContent className="py-12 text-center">
        <h3 className="text-base font-semibold">{title}</h3>
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}
