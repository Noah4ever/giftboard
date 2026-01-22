export type WishPriority = "low" | "medium" | "high";

export interface Wish {
  id: string;
  title: string;
  priority: WishPriority;
  description: string;
  link?: string;
  image?: string;
  price: number | null;
  priceRange?: string;
  quantity: number;
  reservedCount: number;
  reservations: { userName: string; at: string }[];
  ticked: boolean;
  tickedBy: string | null;
  tickedAt: string | null;
  createdAt?: string;
}

export interface WishList {
  id: string;
  title: string;
  code: string;
  owner: string;
  description?: string;
  createdAt?: string;
  wishes: Wish[];
}
