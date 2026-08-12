import { createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";

// Fork feature: the wishlist screen has its own in-place search, kept separate
// from the catalogue's so typing on /wishlist doesn't pollute catalogue state.
export interface WishlistSearchState {
  searchQuery: string;
}

const initialState: WishlistSearchState = {
  searchQuery: "",
};

export const wishlistSearchSlice = createSlice({
  name: "wishlistSearch",
  initialState,
  reducers: {
    setWishlistSearchQuery: (state, action: PayloadAction<string>) => {
      state.searchQuery = action.payload;
    },
  },
});

export const { setWishlistSearchQuery } = wishlistSearchSlice.actions;
