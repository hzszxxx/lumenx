"use client";

import dynamic from "next/dynamic";

const AdminConsole = dynamic(() => import("@/components/platform/AdminConsole"), { ssr: false });

export default function AdminPage() {
  return <AdminConsole />;
}
