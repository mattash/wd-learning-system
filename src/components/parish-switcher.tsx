"use client";

import { useRouter } from "next/navigation";

import { Select } from "@/components/ui/select";

interface ParishOption {
  id: string;
  name: string;
  slug: string;
}

export function ParishSwitcher({
  activeParishId,
  parishes,
}: {
  activeParishId: string;
  parishes: ParishOption[];
}) {
  const router = useRouter();

  return (
    <Select
      aria-label="Active parish"
      className="h-9 min-w-[220px]"
      onChange={(event) => {
        const nextParishId = event.target.value;
        if (!nextParishId || nextParishId === activeParishId) return;
        router.push(`/app/select-parish/activate?parishId=${encodeURIComponent(nextParishId)}`);
      }}
      value={activeParishId}
    >
      {parishes.map((parish) => (
        <option key={parish.id} value={parish.id}>
          {parish.name}
        </option>
      ))}
    </Select>
  );
}
