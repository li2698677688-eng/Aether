import { Badge } from "@/components/ui/badge";
import { formatConfidence, labelEvidenceSource } from "@/lib/design-spec";
import type { EvidenceMeta } from "@/types/site";

export function EvidenceBadge({ confidence, source }: EvidenceMeta) {
  return (
    <Badge className="font-normal text-muted-foreground" variant="outline">
      {labelEvidenceSource(source)} · {formatConfidence(confidence)}
    </Badge>
  );
}
