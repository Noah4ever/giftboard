import { apiFetch } from "./client";
import type { Wish, WishList, WishPriority } from "../types";

export interface CreateListPayload {
  title: string;
  ownerName: string;
  code?: string;
  description?: string;
}

export interface UpdateListPayload {
  title?: string;
  description?: string;
  ownerName: string;
}

export interface CreateWishPayload {
  title: string;
  priority?: WishPriority;
  description?: string;
  link?: string;
  image?: string;
  price?: number | null;
  priceRange?: string;
  quantity?: number;
}

export interface UpdateWishPayload {
  title?: string;
  priority?: WishPriority;
  description?: string;
  link?: string;
  image?: string;
  price?: number | null;
  priceRange?: string;
  quantity?: number;
}

export function fetchList(code: string) {
  return apiFetch<WishList>(`/lists/${code}`);
}

export function createList(payload: CreateListPayload) {
  return apiFetch<WishList>("/lists", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function fetchOwnedLists(ownerName: string) {
  return apiFetch<WishList[]>(
    `/lists?ownerName=${encodeURIComponent(ownerName)}`
  );
}

export function updateList(code: string, payload: UpdateListPayload) {
  return apiFetch<WishList>(`/lists/${code}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function deleteList(code: string, ownerName: string) {
  return apiFetch<void>(`/lists/${code}`, {
    method: "DELETE",
    body: JSON.stringify({ ownerName }),
  });
}

export function addWish(code: string, payload: CreateWishPayload) {
  return apiFetch<Wish>(`/lists/${code}/wishes`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateWish(
  code: string,
  wishId: string,
  payload: UpdateWishPayload
) {
  return apiFetch<Wish>(`/lists/${code}/wishes/${wishId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function deleteWish(code: string, wishId: string) {
  return apiFetch<void>(`/lists/${code}/wishes/${wishId}`, {
    method: "DELETE",
  });
}

export function toggleWish(
  code: string,
  wishId: string,
  ticked: boolean,
  userName: string
) {
  return apiFetch<Wish>(`/lists/${code}/wishes/${wishId}/tick`, {
    method: "PATCH",
    body: JSON.stringify({ ticked, userName }),
  });
}
