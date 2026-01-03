"use client";

import EstimatorEmbed from "@/components/site/EstimatorEmbed";

export default function EstimatorBlockClient({
  pageSlug,
  serviceName,
  placeName,
  zip,
}: {
  pageSlug: string;
  serviceName?: string;
  placeName?: string;
  zip?: string;
}) {
  return (
    <EstimatorEmbed pageSlug={pageSlug} serviceName={serviceName} placeName={placeName} zip={zip} />
  );
}
