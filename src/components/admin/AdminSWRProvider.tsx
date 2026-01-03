"use client";

import { SWRConfig } from "swr";
import { ReactNode } from "react";

type Props = { children: ReactNode };

export function AdminSWRProvider({ children }: Props) {
  return (
    <SWRConfig
      value={{
        revalidateOnFocus: false,
        dedupingInterval: 10_000,
        keepPreviousData: true,
      }}
    >
      {children}
    </SWRConfig>
  );
}
