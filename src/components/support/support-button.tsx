"use client";

import { LifeBuoy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { openSupportChat } from "@/components/support/support-chat";

export function SupportButton() {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      leftIcon={<LifeBuoy className="h-4 w-4" />}
      onClick={openSupportChat}
    >
      Suporte
    </Button>
  );
}
