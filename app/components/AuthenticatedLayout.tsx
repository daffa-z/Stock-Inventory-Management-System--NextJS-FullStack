"use client";

import { Card } from "@/components/ui/card";
import React, { useEffect } from "react";
import AppHeader from "../AppHeader/AppHeader";
import { useAuth } from "../authContext";
import { usePathname, useRouter } from "next/navigation";

interface AuthenticatedLayoutProps {
  children: React.ReactNode;
  showHeader?: boolean;
}

const AuthenticatedLayout: React.FC<AuthenticatedLayoutProps> = ({
  children,
  showHeader = true
}) => {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const isAdmin = (user?.role || "USER").toUpperCase() === "ADMIN";
  const isInvoiceRoute = pathname?.startsWith("/invoices");
  const isRestrictedForUserRole = Boolean(user) && !isAdmin && !isInvoiceRoute;

  useEffect(() => {
    if (!user) return;

    if (isRestrictedForUserRole) {
      router.replace("/invoices");
    }
  }, [isRestrictedForUserRole, user, router]);

  return (
    <div className="poppins w-full min-h-screen bg-gray-50 dark:bg-[#121212]">
      {/* Responsive Card */}
      <Card className="flex flex-col shadow-none space-y-4 lg:space-y-6 lg:mx-8 lg:my-6 lg:rounded-lg lg:border lg:shadow-md">
        {/* Header Section */}
        {showHeader && <AppHeader />}

        {/* Main Content */}
        <div className="p-0 lg:p-4">
          {isRestrictedForUserRole ? null : children}
        </div>
      </Card>
    </div>
  );
};

export default AuthenticatedLayout;
