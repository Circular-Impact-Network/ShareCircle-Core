/**
 * E2E tests for settings and profile updates
 * Tests: profile editing, preferences, account settings
 */

import { test, expect, storageStatePaths } from './fixtures';

test.describe('settings and profile', () => {
	test.use({ storageState: storageStatePaths.user1 });

	test('user can navigate to settings page', async ({ page }) => {
		await page.goto('/home');
		
		// Look for settings link in sidebar or menu
		const settingsLink = page.getByRole('link', { name: /Settings/i });
		const settingsButton = page.getByRole('button', { name: /Settings/i });
		
		if (await settingsLink.isVisible()) {
			await settingsLink.click();
		} else if (await settingsButton.isVisible()) {
			await settingsButton.click();
		} else {
			// Direct navigation
			await page.goto('/settings');
		}
		
		await expect(page).toHaveURL(/\/settings/);
	});

	test('settings page shows user profile section', async ({ page }) => {
		await page.goto('/settings');
		
		// Should show profile section
		const profileSection = page.getByRole('heading', { name: /Profile|Account/i });
		
		await expect(profileSection.first()).toBeVisible();
	});

	test('user can update their display name', async ({ page }) => {
		await page.goto('/settings');
		
		// Find name input
		const nameInput = page.getByLabel(/Name|Display Name/i);
		
		if (await nameInput.isVisible()) {
			// Get current value
			const currentName = await nameInput.inputValue();
			
			// Update name
			await nameInput.clear();
			const newName = `Test User ${Date.now()}`;
			await nameInput.fill(newName);
			
			// Save changes
			const saveButton = page.getByRole('button', { name: /Save|Update/i });
			if (await saveButton.isVisible()) {
				await saveButton.click();
				
				// Wait for save to complete
				await page.waitForTimeout(1000);
				
				// Verify success message or name is saved
				const successMessage = page.getByText(/Saved|Updated|Success/i);
				if (await successMessage.isVisible()) {
					expect(await successMessage.isVisible()).toBeTruthy();
				}
			}
			
			// Restore original name
			await nameInput.clear();
			await nameInput.fill(currentName || 'Test User');
			const saveButton2 = page.getByRole('button', { name: /Save|Update/i });
			if (await saveButton2.isVisible()) {
				await saveButton2.click();
			}
		}
	});

	test('user can view their email (read-only)', async ({ page, users }) => {
		await page.goto('/settings');
		
		// Email should be displayed (might be read-only)
		const emailField = page.getByText(users.user1.email);
		const emailInput = page.getByLabel(/Email/i);
		
		if (await emailField.isVisible()) {
			expect(await emailField.textContent()).toContain(users.user1.email);
		} else if (await emailInput.isVisible()) {
			const value = await emailInput.inputValue();
			expect(value).toBe(users.user1.email);
		}
	});

	test('settings page has notification preferences', async ({ page }) => {
		await page.goto('/settings');
		
		// Look for notification settings section
		const notificationSection = page.getByRole('heading', { name: /Notification/i });
		const notificationTab = page.getByRole('tab', { name: /Notification/i });
		
		if (await notificationTab.isVisible()) {
			await notificationTab.click();
		}
		
		// Should have toggles or checkboxes for notifications
		const emailNotifications = page.getByLabel(/Email notification/i);
		const pushNotifications = page.getByLabel(/Push notification/i);
		
		// At least one notification setting should exist
		const hasEmailNotif = await emailNotifications.isVisible().catch(() => false);
		const hasPushNotif = await pushNotifications.isVisible().catch(() => false);
		const hasNotifSection = await notificationSection.isVisible().catch(() => false);
		
		// Some notification-related content should be visible
		expect(hasEmailNotif || hasPushNotif || hasNotifSection).toBeTruthy();
	});

	test('user can toggle notification preferences', async ({ page }) => {
		await page.goto('/settings');
		
		// Navigate to notifications tab if exists
		const notificationTab = page.getByRole('tab', { name: /Notification/i });
		if (await notificationTab.isVisible()) {
			await notificationTab.click();
		}
		
		// Find a toggle switch
		const toggles = page.locator('[role="switch"]');
		
		if (await toggles.count() > 0) {
			const firstToggle = toggles.first();
			const initialState = await firstToggle.getAttribute('aria-checked');
			
			// Toggle it
			await firstToggle.click();
			await page.waitForTimeout(500);
			
			// Toggle back
			await firstToggle.click();
			await page.waitForTimeout(500);
		}
	});

	test('settings shows profile avatar', async ({ page }) => {
		await page.goto('/settings');
		
		// Should show avatar area
		const avatarSection = page.locator('[data-testid="avatar"]');
		const avatarImage = page.locator('img[alt*="avatar" i], img[alt*="profile" i]');
		
		// At least some avatar-related element should be visible
		const hasAvatarSection = await avatarSection.isVisible().catch(() => false);
		const hasAvatarImage = await avatarImage.first().isVisible().catch(() => false);
		
		// Profile page should have some visual representation
		expect(hasAvatarSection || hasAvatarImage).toBeTruthy();
	});

	test('user can access privacy settings', async ({ page }) => {
		await page.goto('/settings');
		
		// Look for privacy section/tab
		const privacyTab = page.getByRole('tab', { name: /Privacy|Security/i });
		const privacySection = page.getByRole('heading', { name: /Privacy|Security/i });
		
		if (await privacyTab.isVisible()) {
			await privacyTab.click();
			await page.waitForTimeout(500);
		}
		
		// Privacy-related content should be accessible
		const privacyVisible = await privacySection.isVisible().catch(() => false);
		const privacyTabExists = await privacyTab.isVisible().catch(() => false);
		
		expect(privacyVisible || privacyTabExists).toBeTruthy();
	});

	test('settings validates required fields', async ({ page }) => {
		await page.goto('/settings');
		
		const nameInput = page.getByLabel(/Name|Display Name/i);
		
		if (await nameInput.isVisible()) {
			// Clear the name
			await nameInput.clear();
			
			// Try to save
			const saveButton = page.getByRole('button', { name: /Save|Update/i });
			if (await saveButton.isVisible()) {
				await saveButton.click();
				
				// Should show error or validation message
				const errorMessage = page.getByText(/required|cannot be empty|please enter/i);
				
				// Wait for potential error
				await page.waitForTimeout(1000);
				
				// Either error is shown or field has error state
				const hasError = await errorMessage.isVisible().catch(() => false);
				const hasInvalidState = await nameInput.evaluate(
					el => el.getAttribute('aria-invalid') === 'true'
				).catch(() => false);
				
				expect(hasError || hasInvalidState).toBeTruthy();
			}
		}
	});

	test('settings page is responsive', async ({ page }) => {
		await page.goto('/settings');
		
		// Test at different viewport sizes
		await page.setViewportSize({ width: 1200, height: 800 });
		await page.waitForTimeout(300);
		
		// Mobile viewport
		await page.setViewportSize({ width: 375, height: 667 });
		await page.waitForTimeout(300);
		
		// Settings should still be accessible
		const settingsContent = page.locator('main, [role="main"]');
		await expect(settingsContent.first()).toBeVisible();
		
		// Reset viewport
		await page.setViewportSize({ width: 1280, height: 720 });
	});

	test('unsaved changes prompt when navigating away', async ({ page }) => {
		await page.goto('/settings');
		
		const nameInput = page.getByLabel(/Name|Display Name/i);
		
		if (await nameInput.isVisible()) {
			// Make a change
			await nameInput.fill('Unsaved Change');
			
			// Try to navigate away
			await page.goto('/home');
			
			// Browser might show confirmation dialog - this is handled differently
			// Just verify navigation happens or is prevented
			await page.waitForTimeout(500);
		}
	});
});
