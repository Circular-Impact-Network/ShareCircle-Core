import { configureStore } from '@reduxjs/toolkit';
import userReducer from './slices/userSlice';
import uiReducer from './slices/uiSlice';
import { userApi } from './api/userApi';

export const store = configureStore({
	reducer: {
		user: userReducer,
		ui: uiReducer,
		[userApi.reducerPath]: userApi.reducer,
	},
	middleware: getDefaultMiddleware => getDefaultMiddleware().concat(userApi.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
