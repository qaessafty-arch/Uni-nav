"use client";
import { GENDERED_ROOM_TYPES, type Room } from "@campusnav/core";
import { useApp } from "@/lib/store";
import { Badge } from "./ui";

/** "Men" / "Women" / "Everyone" for toilets and prayer rooms; nothing for other rooms or when not set. */
export function GenderBadge({ room }: { room: Pick<Room, "type" | "gender"> }) {
  const { t } = useApp();
  if (!room.gender || !GENDERED_ROOM_TYPES.includes(room.type)) return null;
  return <Badge tone={room.gender === "all" ? "neutral" : "info"}>{t(`gender.${room.gender}`)}</Badge>;
}
