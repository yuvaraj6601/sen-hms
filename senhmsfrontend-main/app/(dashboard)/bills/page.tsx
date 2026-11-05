"use client";

import { Suspense } from "react";
import BillWorkspace from "../../_components/billing/BillWorkspace";

export default function BillsPage() {
  // useSearchParams (inside BillWorkspace) requires a Suspense boundary.
  return (
    <Suspense fallback={null}>
      <BillWorkspace showCraft />
    </Suspense>
  );
}
