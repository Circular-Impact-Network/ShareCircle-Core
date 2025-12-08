import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface UserState {
	id: string | null;
	name: string | null;
	email: string | null;
	image: string | null;
	phoneNumber: string | null;
	countryCode: string | null;
	bio: string | null;
}

const initialState: UserState = {
	id: null,
	name: null,
	email: null,
	image: null,
	phoneNumber: null,
	countryCode: null,
	bio: null,
};

export const userSlice = createSlice({
	name: 'user',
	initialState,
	reducers: {
		setUser: (state, action: PayloadAction<Partial<UserState>>) => {
			return { ...state, ...action.payload };
		},
		updateUserProfile: (state, action: PayloadAction<Partial<UserState>>) => {
			return { ...state, ...action.payload };
		},
		clearUser: () => initialState,
	},
});

export const { setUser, updateUserProfile, clearUser } = userSlice.actions;
export default userSlice.reducer;
