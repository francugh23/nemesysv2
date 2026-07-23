import { Badge } from "@/components/ui/badge";

interface ActionBadgeProps {
  action: string;
}

export function ActionBadge({ action }: ActionBadgeProps) {
  switch (action) {
    case "CREATE":
      return <Badge className="bg-green-600 hover:bg-green-600">Create</Badge>;

    case "UPDATE":
      return <Badge className="bg-amber-500 hover:bg-amber-500">Update</Badge>;

    case "DELETE":
      return <Badge variant="destructive">Delete</Badge>;

    default:
      return <Badge variant="outline">{action}</Badge>;
  }
}
