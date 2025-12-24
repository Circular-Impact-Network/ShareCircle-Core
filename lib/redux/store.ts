import { configureStore } from '@reduxjs/toolkit';
import userReducer from './slices/userSlice';
import uiReducer from './slices/uiSlice';
import { userApi } from './api/userApi';
import { itemsApi } from './api/itemsApi';

export const store = configureStore({
	reducer: {
		user: userReducer,
		ui: uiReducer,
		[userApi.reducerPath]: userApi.reducer,
		[itemsApi.reducerPath]: itemsApi.reducer,
	},
	middleware: getDefaultMiddleware => getDefaultMiddleware().concat(userApi.middleware, itemsApi.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
