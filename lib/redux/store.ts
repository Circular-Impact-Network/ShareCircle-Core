import { configureStore } from '@reduxjs/toolkit';
import userReducer from './slices/userSlice';
import uiReducer from './slices/uiSlice';
import { userApi } from './api/userApi';
import { itemsApi } from './api/itemsApi';
import { borrowApi } from './api/borrowApi';
import { notificationsApi } from './api/notificationsApi';
import { messagesApi } from './api/messagesApi';
import { circlesApi } from './api/circlesApi';
import { notificationPreferencesApi } from './api/notificationPreferencesApi';

export const store = configureStore({
	reducer: {
		user: userReducer,
		ui: uiReducer,
		[userApi.reducerPath]: userApi.reducer,
		[itemsApi.reducerPath]: itemsApi.reducer,
		[borrowApi.reducerPath]: borrowApi.reducer,
		[notificationsApi.reducerPath]: notificationsApi.reducer,
		[messagesApi.reducerPath]: messagesApi.reducer,
		[circlesApi.reducerPath]: circlesApi.reducer,
		[notificationPreferencesApi.reducerPath]: notificationPreferencesApi.reducer,
	},
	middleware: getDefaultMiddleware =>
		getDefaultMiddleware().concat(
			userApi.middleware,
			itemsApi.middleware,
			borrowApi.middleware,
			notificationsApi.middleware,
			messagesApi.middleware,
			circlesApi.middleware,
			notificationPreferencesApi.middleware
		),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
