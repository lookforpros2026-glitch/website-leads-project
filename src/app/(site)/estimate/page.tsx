import { Suspense } from "react";
import EstimateWizard from "@/components/site/EstimateWizard";

export default function EstimatePage() {
  return (
    <Suspense fallback={null}>
      <EstimateWizard open={true} />
    </Suspense>
  );
}
