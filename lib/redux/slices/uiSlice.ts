import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface UIState {
	isMobileSidebarOpen: boolean;
	theme: 'light' | 'dark';
}

const initialState: UIState = {
	isMobileSidebarOpen: false,
	theme: 'light',
};

export const uiSlice = createSlice({
	name: 'ui',
	initialState,
	reducers: {
		toggleMobileSidebar: state => {
			state.isMobileSidebarOpen = !state.isMobileSidebarOpen;
		},
		setMobileSidebarOpen: (state, action: PayloadAction<boolean>) => {
			state.isMobileSidebarOpen = action.payload;
		},
		setTheme: (state, action: PayloadAction<'light' | 'dark'>) => {
			state.theme = action.payload;
		},
	},
});

export const { toggleMobileSidebar, setMobileSidebarOpen, setTheme } = uiSlice.actions;
export default uiSlice.reducer;
